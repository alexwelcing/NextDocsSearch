// Node-only corpus reader for scripts/generate-search-index.ts and scripts/eval-retrieval.ts.
// Runtime code (the Worker, the browser) must never import this module.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { OPERATOR_PANELS } from '../immersive/operatorData'
import type { BuildInput, BuildRecord, VectorSource } from './build'
import type { RecordBlock } from './chunk'
import type { VectorSourceManifest } from './types'

export function corpusPaths(root = process.cwd()) {
  return {
    records: path.join(root, 'public/arc/records'),
    articleManifest: path.join(root, 'lib/generated/article-manifest.json'),
    vectors: path.join(root, 'data/search'),
  }
}

type Paths = ReturnType<typeof corpusPaths>

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

/** public/arc/records joined with article-manifest type, keywords and domains. */
export function readBuildRecords(paths: Paths = corpusPaths()): BuildRecord[] {
  const meta = new Map<string, Record<string, unknown>>()
  if (existsSync(paths.articleManifest)) {
    const manifest: unknown = JSON.parse(readFileSync(paths.articleManifest, 'utf8'))
    if (Array.isArray(manifest)) {
      for (const article of manifest as Record<string, unknown>[]) {
        if (typeof article?.slug === 'string') meta.set(article.slug, article)
      }
    }
  }
  return readdirSync(paths.records)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const record = JSON.parse(readFileSync(path.join(paths.records, file), 'utf8'))
      const slug = String(record.slug ?? file.replace(/\.json$/, ''))
      const article = meta.get(slug) ?? {}
      return {
        slug,
        title: String(record.title ?? slug),
        date: String(record.date || article.date || ''),
        description: String(record.description || article.description || ''),
        blocks: (Array.isArray(record.blocks) ? record.blocks : []) as RecordBlock[],
        type: typeof article.articleType === 'string' ? article.articleType : undefined,
        keywords: strings(article.keywords),
        domains: strings(article.domains),
      }
    })
}

function isVectorManifest(value: unknown): value is VectorSourceManifest {
  const manifest = value as VectorSourceManifest
  return (
    typeof manifest?.model === 'string' &&
    typeof manifest.dims === 'number' &&
    typeof manifest.chunkerVersion === 'string' &&
    Array.isArray(manifest.hashes)
  )
}

/** Every data/search/<name>.json that has a sibling <name>.bin and reads as a vector manifest. */
export function readVectorSources(dir = corpusPaths().vectors) {
  const sources: VectorSource[] = []
  const warnings: string[] = []
  if (!existsSync(dir)) return { sources, warnings }
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue
    const bin = path.join(dir, file.replace(/\.json$/, '.bin'))
    if (!existsSync(bin)) continue
    try {
      const manifest: unknown = JSON.parse(readFileSync(path.join(dir, file), 'utf8'))
      if (!isVectorManifest(manifest)) throw new Error('not a vector manifest')
      sources.push({ manifest, bytes: new Uint8Array(readFileSync(bin)) })
    } catch (error) {
      warnings.push(`data/search/${file}: ${(error as Error).message}; skipped`)
    }
  }
  return { sources, warnings }
}

/** Optional data/search/doc2query.v1.json: { [chunkHash]: string[] }. */
export function readDoc2Query(dir = corpusPaths().vectors): Record<string, string[]> | undefined {
  const file = path.join(dir, 'doc2query.v1.json')
  if (!existsSync(file)) return undefined
  const value: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (!value || typeof value !== 'object') return undefined
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([hash, questions]) => [
      hash,
      strings(questions),
    ])
  )
}

export function readBuildInput(root = process.cwd()): { input: BuildInput; warnings: string[] } {
  const paths = corpusPaths(root)
  const { sources, warnings } = readVectorSources(paths.vectors)
  return {
    input: {
      records: readBuildRecords(paths),
      operatorPanels: Object.values(OPERATOR_PANELS),
      vectorSources: sources,
      doc2query: readDoc2Query(paths.vectors),
    },
    warnings,
  }
}
