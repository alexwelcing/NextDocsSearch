// Retrieval eval harness: builds the search index in memory (exactly as
// generate-search-index.ts does, committed vectors included) and scores each configuration
// with article-level Recall@5, MRR@10 and nDCG@10 on every benchmark.
//
//   pnpm exec tsx scripts/eval-retrieval.ts [--queries eval/x.jsonl]... [--plugin mod.ts]...
//     [--pseudo] [--out eval/results/<date>.json | --out -] [--gate 'ship-lexical>=records']...
//
// Reports land in eval/results/ by default, which is git-ignored: quote the numbers in the PR.
//
// Built-in configurations: records (searchRecords over the article manifest, FIND's fallback),
// records+operators (the same over the operator panels too, as Ship ranks them), bm25 (chunk
// BM25 only), find (FIND as shipped: searchFullText, articles ranked by their best BM25F chunk),
// ship-lexical (getShipContext without an embedder: BM25 + records under RRF), and
// for each vector set whose model has a plugin embedder: dense:<model> and hybrid:<model>.
// --pseudo adds a known-item benchmark (each article's description as its query).
// Plugins (see EvalPlugin in lib/retrieval/eval.ts) add models, configurations and benchmarks.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { searchFullText, searchRecords } from '../lib/archive/search'
import { FsManifestSource } from '../lib/archive/server'
import { searchBm25 } from '../lib/retrieval/bm25'
import { buildSearchIndex, emitSearchIndex } from '../lib/retrieval/build'
import { denseTopK, queryVectorProblem } from '../lib/retrieval/dense'
import {
  METRICS,
  evaluate,
  parseQueries,
  pseudoQueries,
  type Benchmark,
  type ConfigurationReport,
  type EvalConfiguration,
  type EvalContext,
  type EvalPlugin,
} from '../lib/retrieval/eval'
import { loadCoreIndex, loadDenseIndex } from '../lib/retrieval/load'
import { readBuildInput } from '../lib/retrieval/nodeSources'
import { RRF_WEIGHTS } from '../lib/retrieval/rrf'
import { getShipContext, operatorRecords } from '../lib/retrieval/shipContext'

const ROOT = process.cwd()

function args(name: string): string[] {
  const values: string[] = []
  process.argv.forEach((arg, i) => {
    if (arg === name && process.argv[i + 1]) values.push(process.argv[i + 1])
    else if (arg.startsWith(`${name}=`)) values.push(arg.slice(name.length + 1))
  })
  return values
}

async function loadPlugin(file: string): Promise<EvalPlugin> {
  const mod = (await import(pathToFileURL(path.resolve(ROOT, file)).href)) as Record<
    string,
    unknown
  >
  const plugin = (mod.plugin ??
    mod.default ??
    (mod.default as Record<string, unknown>)?.default) as EvalPlugin | undefined
  if (!plugin?.name) throw new Error(`${file}: no EvalPlugin export (default or 'plugin')`)
  return plugin
}

function slugsOf(ids: number[], slugOf: (id: number) => string, k: number): string[] {
  const out: string[] = []
  for (const id of ids) {
    const slug = slugOf(id)
    if (!out.includes(slug)) out.push(slug)
    if (out.length >= k) break
  }
  return out
}

async function main() {
  const queryFiles = args('--queries')
  if (!queryFiles.length) queryFiles.push('eval/queries.seed.jsonl')
  const plugins = await Promise.all(args('--plugin').map(loadPlugin))

  const { input, warnings } = readBuildInput(ROOT)
  let built = await buildSearchIndex(input)
  const extra = (
    await Promise.all(plugins.map((plugin) => plugin.vectorSources?.({ built, input }) ?? []))
  ).flat()
  if (extra.length) {
    built = await buildSearchIndex({
      ...input,
      vectorSources: [...(input.vectorSources ?? []), ...extra],
    })
  }
  for (const warning of [...warnings, ...built.warnings]) console.warn(`[eval] warning: ${warning}`)

  const { assets, manifest } = await emitSearchIndex(built)
  const byPath = new Map(assets.map((asset) => [asset.path, asset.bytes]))
  const fetchAsset = async (assetPath: string) => {
    const bytes = byPath.get(assetPath)
    return bytes ? new Response(bytes) : new Response('not found', { status: 404 })
  }
  const core = await loadCoreIndex(manifest, fetchAsset)
  const records = await new FsManifestSource().load()
  const withOperators = [...records, ...operatorRecords(core)]
  const context: EvalContext = { records, built, manifest, core, fetchAsset }
  const slugOfChunk = (id: number) => core.docs[core.chunks[id].doc].slug
  const embedders = Object.assign(
    {},
    ...plugins.map((plugin) => plugin.embedders ?? {})
  ) as NonNullable<EvalPlugin['embedders']>

  const configurations: EvalConfiguration[] = [
    {
      name: 'records',
      description: "searchRecords over the article manifest (FIND's fallback, Ship's record vote)",
      search: (q, k) => searchRecords(records, q, k).map((hit) => hit.record.slug),
    },
    {
      name: 'records+operators',
      description: 'searchRecords over the article manifest plus the three operator panels',
      search: (q, k) => searchRecords(withOperators, q, k).map((hit) => hit.record.slug),
    },
    {
      name: 'bm25',
      description: 'chunk BM25F only (title×3 heading×2 keywords×2 body×1 doc2query×1.5)',
      search: (q, k) =>
        slugsOf(
          searchBm25(core.bm25, q, 200).map((hit) => hit.doc),
          slugOfChunk,
          k
        ),
    },
    {
      name: 'find',
      description: 'FIND: searchFullText, articles ranked by their best BM25F chunk',
      search: (q, k) => searchFullText(core, records, q, k).map((hit) => hit.record.slug),
    },
    ...[0.5, 0.25, 0].map((weight) => ({
      name: weight === RRF_WEIGHTS.records ? 'ship-lexical' : `ship-lexical:records=${weight}`,
      description: `getShipContext without an embedder: RRF(BM25 1.0, records ${weight})`,
      search: async (q: string, k: number) =>
        (
          await getShipContext(
            q,
            { fetchAsset },
            { manifest, records, limits: { instantResults: k }, weights: { records: weight } }
          )
        ).instantResults.map((item) => item.slug),
    })),
  ]
  for (const set of manifest.vectors) {
    const embed = embedders[set.model]
    if (!embed) {
      console.warn(`[eval] ${set.model}: no query embedder registered; dense configs skipped`)
      continue
    }
    const matrix = await loadDenseIndex(manifest, set, fetchAsset)
    configurations.push(
      {
        name: `dense:${set.model}`,
        description: `dense top-k only, d${set.dims} int8`,
        search: async (q, k) => {
          // The same gate as Ship: a zero or wrong-sized query vector is no dense ranking.
          const vector = await embed(q, new AbortController().signal)
          if (queryVectorProblem(vector, set)) return []
          return slugsOf(
            denseTopK(matrix, vector, 200, set.cosineFloor).map((hit) => hit.row),
            slugOfChunk,
            k
          )
        },
      },
      {
        name: `hybrid:${set.model}`,
        description: 'getShipContext with the embedder: RRF(dense 1.0, BM25 1.0, records 0.5)',
        search: async (q, k) =>
          (
            await getShipContext(
              q,
              { fetchAsset, embedQuery: embed },
              {
                manifest,
                records,
                model: set.model,
                limits: { instantResults: k, embedTimeoutMs: 60_000 },
              }
            )
          ).instantResults.map((item) => item.slug),
      }
    )
  }
  for (const plugin of plugins)
    configurations.push(...((await plugin.configurations?.(context)) ?? []))

  const benchmarks: Benchmark[] = queryFiles.map((file) => ({
    name: path.basename(file).replace(/\.jsonl$/, ''),
    queries: parseQueries(fs.readFileSync(path.resolve(ROOT, file), 'utf8'), file),
  }))
  if (process.argv.includes('--pseudo')) {
    benchmarks.push({ name: 'pseudo-description', queries: pseudoQueries(core.docs) })
  }
  for (const plugin of plugins) benchmarks.push(...((await plugin.benchmarks?.(context)) ?? []))

  const results: Record<string, ConfigurationReport[]> = {}
  for (const benchmark of benchmarks) {
    const reports: ConfigurationReport[] = []
    for (const configuration of configurations) {
      reports.push(await evaluate(configuration, benchmark.queries))
    }
    results[benchmark.name] = reports
    console.log(`\n${benchmark.name} (${benchmark.queries.length} queries)`)
    console.log(
      `  ${'configuration'.padEnd(34)}${METRICS.map((m) => m.padStart(10)).join('')}  ms/q`
    )
    for (const report of reports) {
      console.log(
        `  ${report.name.padEnd(34)}${METRICS.map((m) =>
          report.all[m].toFixed(3).padStart(10)
        ).join('')}` + `  ${report.meanMs.toFixed(1)}`
      )
    }
    const tags = [...new Set(benchmark.queries.flatMap((query) => query.tags))].sort()
    for (const tag of tags) {
      const line = reports
        .map((report) => `${report.name} ${(report.byTag[tag]?.['mrr@10'] ?? 0).toFixed(2)}`)
        .join(' · ')
      console.log(`    [${tag}] mrr@10: ${line}`)
    }
  }

  const outArg = args('--out')[0]
  const out =
    outArg ?? path.join('eval', 'results', `${new Date().toISOString().slice(0, 10)}.json`)
  if (out !== '-') {
    fs.mkdirSync(path.dirname(path.resolve(ROOT, out)), { recursive: true })
    const report = {
      date: new Date().toISOString(),
      index: {
        chunkerVersion: manifest.chunkerVersion,
        tokenizer: manifest.tokenizer,
        docs: manifest.docs,
        chunks: manifest.chunks,
        vectors: manifest.vectors.map(({ model, dims, present, rows }) => ({
          model,
          dims,
          present,
          rows,
        })),
      },
      plugins: plugins.map((plugin) => plugin.name),
      results,
    }
    fs.writeFileSync(path.resolve(ROOT, out), `${JSON.stringify(report, null, 2)}\n`)
    console.log(`\n[eval] wrote ${out}`)
  }

  // --gate 'A>=B': A must match or beat B on Recall@5 and MRR@10 on the first benchmark.
  let failed = false
  for (const gate of args('--gate')) {
    const [left, right] = gate.split('>=').map((name) => name.trim())
    const reports = results[benchmarks[0]?.name] ?? []
    const a = reports.find((report) => report.name === left)
    const b = reports.find((report) => report.name === right)
    if (!a || !b) {
      console.error(`[eval] gate ${gate}: unknown configuration`)
      failed = true
      continue
    }
    for (const metric of ['recall@5', 'mrr@10'] as const) {
      const ok = a.all[metric] >= b.all[metric]
      console.log(`[eval] gate ${left} >= ${right} on ${metric}: ${ok ? 'pass' : 'FAIL'}`)
      failed ||= !ok
    }
  }
  if (failed) process.exit(1)
}

main().catch((error) => {
  console.error('[eval] failed:', error)
  process.exit(1)
})
