// Retrieval eval: article-level Recall@5, MRR@10 and nDCG@10 over judged queries, for any
// number of pluggable configurations. scripts/eval-retrieval.ts does the IO; an external
// research program adds its own models, configurations and benchmarks through EvalPlugin.
import type { ArchiveRecord } from '../archive/types'
import type { BuildInput, BuiltIndex, VectorSource } from './build'
import type { CoreIndex } from './load'
import type { RetrievalDeps, SearchManifest } from './types'

export interface EvalQuery {
  id: string
  query: string
  /** slug → graded relevance (> 0). Slugs are article slugs or operator ids. */
  relevant: Record<string, number>
  tags: string[]
}

export interface Benchmark {
  name: string
  queries: EvalQuery[]
}

/** JSONL lines: {"id","query","relevant": ["slug", ...] | {"slug": grade}, "tags"?: [...]} */
export function parseQueries(jsonl: string, source = 'queries'): EvalQuery[] {
  return jsonl
    .split('\n')
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => line && !line.startsWith('//'))
    .map(({ line, index }) => {
      const value = JSON.parse(line) as Partial<EvalQuery> & { relevant?: unknown }
      const relevant: Record<string, number> = Array.isArray(value.relevant)
        ? Object.fromEntries(value.relevant.map((slug) => [String(slug), 1]))
        : Object.fromEntries(
            Object.entries((value.relevant ?? {}) as Record<string, unknown>).map(
              ([slug, grade]) => [slug, Number(grade)]
            )
          )
      if (typeof value.query !== 'string' || !value.query.trim()) {
        throw new Error(`${source}:${index + 1}: missing query`)
      }
      if (!Object.values(relevant).some((grade) => grade > 0)) {
        throw new Error(`${source}:${index + 1}: no relevant slugs`)
      }
      return {
        id: value.id ? String(value.id) : `${source}:${index + 1}`,
        query: value.query,
        relevant,
        tags: Array.isArray(value.tags) ? value.tags.map(String) : [],
      }
    })
}

function uniqueTop(ranked: string[], k: number): string[] {
  return [...new Set(ranked)].slice(0, k)
}

/** Fraction of relevant slugs found in the top k. */
export function recallAt(ranked: string[], relevant: Record<string, number>, k: number): number {
  const wanted = Object.keys(relevant).filter((slug) => relevant[slug] > 0)
  if (!wanted.length) return 0
  const top = new Set(uniqueTop(ranked, k))
  return wanted.filter((slug) => top.has(slug)).length / wanted.length
}

/** Reciprocal rank of the first relevant slug within the top k, else 0. */
export function mrrAt(ranked: string[], relevant: Record<string, number>, k: number): number {
  const index = uniqueTop(ranked, k).findIndex((slug) => (relevant[slug] ?? 0) > 0)
  return index < 0 ? 0 : 1 / (index + 1)
}

/** nDCG with exponential gain (2^grade - 1) and log2 discount. */
export function ndcgAt(ranked: string[], relevant: Record<string, number>, k: number): number {
  const gain = (grade: number) => (grade > 0 ? 2 ** grade - 1 : 0)
  const dcg = uniqueTop(ranked, k).reduce(
    (sum, slug, i) => sum + gain(relevant[slug] ?? 0) / Math.log2(i + 2),
    0
  )
  const ideal = Object.values(relevant)
    .filter((grade) => grade > 0)
    .sort((a, b) => b - a)
    .slice(0, k)
    .reduce((sum, grade, i) => sum + gain(grade) / Math.log2(i + 2), 0)
  return ideal > 0 ? dcg / ideal : 0
}

export interface EvalConfiguration {
  name: string
  description?: string
  /** Ranked unique slugs, best first; at least k when that many match. */
  search(query: string, k: number): Promise<string[]> | string[]
}

export interface MetricSummary {
  queries: number
  'recall@5': number
  'mrr@10': number
  'ndcg@10': number
}

export const METRICS = ['recall@5', 'mrr@10', 'ndcg@10'] as const

export interface QueryOutcome {
  id: string
  /** 1-based rank of the first relevant slug within the top 10, or null. */
  firstRelevant: number | null
  top: string[]
}

export interface ConfigurationReport {
  name: string
  description?: string
  all: MetricSummary
  byTag: Record<string, MetricSummary>
  meanMs: number
  queries: QueryOutcome[]
}

function summarize(rows: { recall: number; mrr: number; ndcg: number }[]): MetricSummary {
  const mean = (pick: (row: (typeof rows)[number]) => number) =>
    rows.length ? rows.reduce((sum, row) => sum + pick(row), 0) / rows.length : 0
  return {
    queries: rows.length,
    'recall@5': mean((row) => row.recall),
    'mrr@10': mean((row) => row.mrr),
    'ndcg@10': mean((row) => row.ndcg),
  }
}

export async function evaluate(
  configuration: EvalConfiguration,
  queries: EvalQuery[],
  k = 10
): Promise<ConfigurationReport> {
  const rows: { tags: string[]; recall: number; mrr: number; ndcg: number }[] = []
  const outcomes: QueryOutcome[] = []
  let elapsed = 0
  for (const query of queries) {
    const started = performance.now()
    const ranked = uniqueTop(await configuration.search(query.query, k), k)
    elapsed += performance.now() - started
    const first = ranked.findIndex((slug) => (query.relevant[slug] ?? 0) > 0)
    outcomes.push({
      id: query.id,
      firstRelevant: first < 0 ? null : first + 1,
      top: ranked.slice(0, 5),
    })
    rows.push({
      tags: query.tags,
      recall: recallAt(ranked, query.relevant, 5),
      mrr: mrrAt(ranked, query.relevant, 10),
      ndcg: ndcgAt(ranked, query.relevant, 10),
    })
  }
  const tags = [...new Set(rows.flatMap((row) => row.tags))].sort()
  return {
    name: configuration.name,
    ...(configuration.description ? { description: configuration.description } : {}),
    all: summarize(rows),
    byTag: Object.fromEntries(
      tags.map((tag) => [tag, summarize(rows.filter((row) => row.tags.includes(tag)))])
    ),
    meanMs: queries.length ? elapsed / queries.length : 0,
    queries: outcomes,
  }
}

/** What a plugin sees once the index is built. */
export interface EvalContext {
  /** Article-manifest records, as today's searchRecords ranks them. */
  records: ArchiveRecord[]
  built: BuiltIndex
  manifest: SearchManifest
  core: CoreIndex
  /** Serves the in-memory index assets, as env.ASSETS would in the Worker. */
  fetchAsset: RetrievalDeps['fetchAsset']
}

/**
 * A module loaded with --plugin <path>; its default export (or named `plugin`) is an EvalPlugin.
 * Everything is optional, so a plugin can add just a benchmark, just a model, or both.
 */
export interface EvalPlugin {
  name: string
  /** Document vectors computed in memory (a static model in JS, say), keyed by chunk hash. */
  vectorSources?(input: {
    built: BuiltIndex
    input: BuildInput
  }): VectorSource[] | Promise<VectorSource[]>
  /** Query embedders by vector-set model id; each enables dense:<model> and hybrid:<model>. */
  embedders?: Record<string, (q: string, signal: AbortSignal) => Promise<Float32Array>>
  configurations?(context: EvalContext): EvalConfiguration[] | Promise<EvalConfiguration[]>
  benchmarks?(context: EvalContext): Benchmark[] | Promise<Benchmark[]>
}
