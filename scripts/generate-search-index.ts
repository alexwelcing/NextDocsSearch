// Build the static hybrid search index from public/arc/records and the operator panels. Network
// free: vectors come only from data/search/<model>.{json,bin} (joined by chunk hash), so a chunk
// without one stays lexical-only and is reported here. Emits content-hashed assets into
// public/search/ plus lib/generated/search-manifest.json, which the Ship runtime imports.
//
//   pnpm exec tsx scripts/generate-search-index.ts [--dry-run]

import fs from 'node:fs'
import path from 'node:path'
import { buildSearchIndex, emitSearchIndex } from '../lib/retrieval/build'
import { readBuildInput } from '../lib/retrieval/nodeSources'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'public', 'search')
const MANIFEST = path.join(ROOT, 'lib', 'generated', 'search-manifest.json')
const dryRun = process.argv.includes('--dry-run')

async function main() {
  const started = Date.now()
  const { input, warnings: readWarnings } = readBuildInput(ROOT)
  const built = await buildSearchIndex(input)
  const { assets, manifest } = await emitSearchIndex(built)

  const kinds = new Map<string, number>()
  for (const chunk of built.chunks.chunks) kinds.set(chunk.kind, (kinds.get(chunk.kind) ?? 0) + 1)
  const lengths = built.chunks.chunks
    .filter((chunk) => chunk.kind === 'body')
    .map((chunk) => chunk.text.length)
    .sort((a, b) => a - b)
  const median = lengths[Math.floor(lengths.length / 2)] ?? 0

  for (const warning of [...readWarnings, ...built.warnings]) {
    console.warn(`[search-index] warning: ${warning}`)
  }

  if (!dryRun) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
    for (const file of fs.readdirSync(OUT_DIR)) {
      // Drop stale content-hashed outputs so public/search holds exactly one index.
      if (/^(chunks|bm25|vec)\.[0-9a-f]+\.(json|bin)$/.test(file)) {
        fs.rmSync(path.join(OUT_DIR, file))
      }
    }
    for (const asset of assets) {
      fs.writeFileSync(path.join(ROOT, 'public', asset.path), asset.bytes)
    }
    fs.mkdirSync(path.dirname(MANIFEST), { recursive: true })
    fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  }

  const counts = [...kinds].map(([kind, count]) => `${count} ${kind}`).join(', ')
  const longest = lengths[lengths.length - 1] ?? 0
  const sets = manifest.vectors.map((set) => `${set.model} d${set.dims} ${set.present}/${set.rows}`)
  console.log(
    `[search-index] ${manifest.docs} docs, ${manifest.chunks} chunks (${counts}; body median ` +
      `${median}, max ${longest} chars), ${built.bm25.terms.length} terms, ` +
      `vectors: ${sets.join('; ') || 'none'} in ${Date.now() - started} ms` +
      (dryRun ? ' (dry run, nothing written)' : '')
  )
  for (const asset of assets) {
    const kib = (asset.bytes.byteLength / 1024).toFixed(0)
    console.log(
      `[search-index] ${dryRun ? 'would write' : 'wrote'} public${asset.path} (${kib} KiB)`
    )
  }
}

main().catch((error) => {
  console.error('[search-index] failed:', error)
  process.exit(1)
})
