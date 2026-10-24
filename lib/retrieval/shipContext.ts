// Ship's retrieval: dense (optional) + chunk BM25 + record-level searchRecords, fused with RRF
// into the LocalArchiveQueryResult shape. Every failure degrades a rung instead of throwing:
// no embedder / timeout / mismatch → lexical; index assets unavailable → records; neither → none.
import { searchRecords } from '../archive/search'
import type { ArchiveRecord } from '../archive/types'
import { searchBm25 } from './bm25'
import { denseTopK } from './dense'
import { loadCoreIndex, loadDenseIndex, type CoreIndex } from './load'
import { PROFILE_SLUG, detectProfileIntent } from './profile'
import type { Int8RowMatrix } from './quantize'
import {
  RRF_WEIGHTS,
  byDateThenSlug,
  fuseRrf,
  type FusedHit,
  type RankedList,
  type RrfWeights,
} from './rrf'
import { findMatch, queryTerms } from './tokenize'
import type {
  RetrievalDeps,
  RetrievalItem,
  RetrievalMode,
  RetrievalResult,
  SearchManifest,
} from './types'

export const SHIP_CONTEXT_LIMITS = {
  embedTimeoutMs: 800,
  denseTopK: 50,
  bm25TopK: 50,
  recordsTopK: 20,
  perSlug: 2,
  contextChunks: 8,
  contextChars: 3000,
  instantResults: 5,
  profileFacts: 3,
  factChars: 320,
  snippetChars: 280,
}

export type ShipContextLimits = typeof SHIP_CONTEXT_LIMITS

export interface ShipContextOptions {
  /** The statically imported search manifest; without it only record-level ranking runs. */
  manifest?: SearchManifest | null
  /** Records for record-level searchRecords (RRF weight 0.5), and the fallback when the index is down. */
  records?: ArchiveRecord[] | (() => Promise<ArchiveRecord[]>)
  /** The model embedQuery speaks; defaults to the manifest's first vector set. */
  model?: string
  limits?: Partial<ShipContextLimits>
  /** RRF list weights; defaults to RRF_WEIGHTS. */
  weights?: Partial<RrfWeights>
}

const SECTION_SEPARATOR = '\n\n---\n\n'

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function clip(value: string, max: number): string {
  const text = collapse(value)
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 4)).trim()} ...`
}

/** Keep the first query-term match visible, like FIND's dock preview. */
function snippetFor(text: string, terms: string[], max: number): string {
  const value = collapse(text)
  const lower = value.toLowerCase()
  const positions = terms.map((term) => findMatch(lower, term)).filter((index) => index >= 0)
  const start = positions.length ? Math.max(0, Math.min(...positions) - 48) : 0
  const end = Math.min(value.length, start + max)
  return `${start > 0 ? '... ' : ''}${value.slice(start, end).trim()}${
    end < value.length ? ' ...' : ''
  }`
}

function section(fields: [string, string][]): string {
  return fields
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n')
}

/** Join sections under a character budget, clipping the last passage that partly fits. */
function budgetContext(sections: { head: [string, string][]; passage: string }[], budget: number) {
  const out: string[] = []
  let used = 0
  for (const { head, passage } of sections) {
    const separator = out.length ? SECTION_SEPARATOR.length : 0
    const full = section([...head, ['Passage', collapse(passage)]])
    if (used + separator + full.length <= budget) {
      out.push(full)
      used += separator + full.length
      continue
    }
    const room = budget - used - separator - section([...head, ['Passage', '']]).length - 12
    if (room >= 160) out.push(section([...head, ['Passage', clip(passage, room)]]))
    break
  }
  return out.join(SECTION_SEPARATOR)
}

async function embedWithDeadline(
  embed: (signal: AbortSignal) => Promise<Float32Array>,
  ms: number
): Promise<Float32Array> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const pending = Promise.resolve().then(() => embed(controller.signal))
  pending.catch(() => undefined) // a late rejection after the deadline is not unhandled
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error(`timed out after ${ms}ms`))
    }, ms)
  })
  try {
    return await Promise.race([pending, deadline])
  } finally {
    clearTimeout(timer)
  }
}

async function resolveRecords(source: ShipContextOptions['records']): Promise<ArchiveRecord[]> {
  try {
    return (typeof source === 'function' ? await source() : source) ?? []
  } catch {
    return []
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** L1 when the index is unavailable: record-level searchRecords over the bundled manifest. */
function recordsOnly(
  query: string,
  records: ArchiveRecord[],
  profileIntent: boolean,
  limits: ShipContextLimits,
  fallbackReason?: string
): RetrievalResult {
  const hits = searchRecords(records, query, Math.max(limits.instantResults, limits.contextChunks))
  const mode: RetrievalMode = records.length ? 'records' : 'none'
  return {
    profileIntent,
    profileFacts: [],
    context: budgetContext(
      hits.slice(0, limits.contextChunks).map(({ record, snippet }) => ({
        head: [
          ['Title', record.title],
          ['Slug', record.slug],
          ['Type', record.type],
        ],
        passage: snippet,
      })),
      limits.contextChars
    ),
    instantResults: hits.slice(0, limits.instantResults).map(({ record, score, snippet }) => ({
      slug: record.slug,
      title: record.title,
      heading: '',
      description: record.description,
      snippet: clip(snippet, limits.snippetChars),
      articleType: record.type,
      score,
      keywords: record.keywords,
      domains: record.domains,
      target: { type: 'article' as const },
    })),
    mode,
    ...(fallbackReason ? { fallbackReason } : {}),
  }
}

const operatorCache = new WeakMap<CoreIndex, ArchiveRecord[]>()

/** Operator docs as records, so record-level ranking covers the same docs as the index. */
function operatorRecords(core: CoreIndex): ArchiveRecord[] {
  let records = operatorCache.get(core)
  if (!records) {
    records = core.docs
      .map((doc, i) => ({ doc, i }))
      .filter(({ doc }) => doc.target.type === 'data')
      .map(({ doc, i }) => ({
        slug: doc.slug,
        title: doc.title,
        date: doc.date,
        description: doc.description,
        type: doc.type,
        minutes: 1,
        keywords: doc.keywords,
        domains: doc.domains,
        mechanics: [],
        searchText: core.chunksOfDoc[i].map((chunk) => core.chunks[chunk].text).join(' '),
        hero: null,
      }))
    operatorCache.set(core, records)
  }
  return records
}

function pickVectorSet(manifest: SearchManifest | null, model?: string) {
  if (!manifest?.vectors?.length) return { set: null, reason: 'no vector sets in the index' }
  const set = model ? manifest.vectors.find((entry) => entry.model === model) : manifest.vectors[0]
  return set ? { set, reason: '' } : { set: null, reason: `no vector set for model ${model}` }
}

export async function getShipContext(
  query: string,
  deps: RetrievalDeps,
  options: ShipContextOptions = {}
): Promise<RetrievalResult> {
  const limits = { ...SHIP_CONTEXT_LIMITS, ...options.limits }
  const q = query.trim()
  const profileIntent = detectProfileIntent(q)
  const manifest = options.manifest ?? null
  // Why dense did not contribute; the first failure wins.
  let denseReason: string | undefined
  const skipDense = (reason: string) => {
    denseReason ??= reason
  }

  // Start the embedding and every asset load at once; lexical scoring overlaps with them.
  const { set, reason } = pickVectorSet(manifest, options.model)
  let embedding: Promise<Float32Array | null> = Promise.resolve(null)
  let matrix: Promise<Int8RowMatrix | null> = Promise.resolve(null)
  if (!manifest) skipDense('no search manifest')
  else if (!set) skipDense(reason)
  else if (!deps.embedQuery) skipDense('no query embedder')
  else if (q) {
    const embed = deps.embedQuery.bind(deps)
    embedding = embedWithDeadline((signal) => embed(q, signal), limits.embedTimeoutMs).catch(
      (error) => {
        skipDense(`query embedding failed: ${message(error)}`)
        return null
      }
    )
    matrix = loadDenseIndex(manifest, set, deps.fetchAsset).catch((error) => {
      skipDense(`vectors unavailable: ${message(error)}`)
      return null
    })
  }
  let indexReason: string | undefined
  const [core, records] = await Promise.all([
    manifest
      ? loadCoreIndex(manifest, deps.fetchAsset).catch((error) => {
          indexReason = `index unavailable: ${message(error)}`
          return null
        })
      : Promise.resolve(null),
    resolveRecords(options.records),
  ])
  if (!core) {
    await Promise.all([embedding, matrix])
    return recordsOnly(q, records, profileIntent, limits, indexReason ?? denseReason)
  }

  const bm25Hits = searchBm25(core.bm25, q, limits.bm25TopK)
  const recordHits = records.length
    ? searchRecords([...records, ...operatorRecords(core)], q, limits.recordsTopK)
    : []
  const [vector, rows] = await Promise.all([embedding, matrix])
  let denseRows: number[] = []
  let dense = false
  if (vector && rows && set) {
    try {
      denseRows = denseTopK(rows, vector, limits.denseTopK, set.cosineFloor).map((hit) => hit.row)
      dense = true
    } catch (error) {
      skipDense(`dense scan failed: ${message(error)}`)
    }
  }

  return fuse(core, q, profileIntent, limits, {
    dense: denseRows,
    bm25: bm25Hits.map((hit) => hit.doc),
    records: recordHits.map((hit) => hit.record.slug),
    weights: options.weights,
    mode: dense ? 'hybrid' : 'lexical',
    fallbackReason: dense ? undefined : denseReason,
  })
}

export interface RankedInputs {
  /** Chunk indexes, best first. */
  dense: number[]
  bm25: number[]
  /** Doc slugs from searchRecords, best first. */
  records: string[]
  weights?: Partial<RrfWeights>
  mode: RetrievalMode
  fallbackReason?: string
}

/** RRF over chunk ids for context and over slugs for instant results; shared with the eval. */
export function fuse(
  core: CoreIndex,
  query: string,
  profileIntent: boolean,
  limits: ShipContextLimits,
  inputs: RankedInputs
): RetrievalResult {
  const { docs, chunks } = core
  const docOfKey = (key: string) => docs[chunks[Number(key)]?.doc]
  const byDate = byDateThenSlug(docOfKey)
  const compareChunks = (a: string, b: string) => byDate(a, b) || Number(a) - Number(b)
  // A record votes through its card chunk (operator docs have none: their first chunk).
  const cards = inputs.records
    .map((slug) => core.docBySlug.get(slug))
    .map((doc) =>
      doc === undefined
        ? -1
        : core.cardOfDoc[doc] >= 0
        ? core.cardOfDoc[doc]
        : core.chunksOfDoc[doc][0] ?? -1
    )
    .filter((chunk) => chunk >= 0)
  const weights = { ...RRF_WEIGHTS, ...inputs.weights }
  const chunkLists: RankedList[] = [
    { name: 'dense', weight: weights.dense, keys: inputs.dense.map(String) },
    { name: 'bm25', weight: weights.bm25, keys: inputs.bm25.map(String) },
    { name: 'records', weight: weights.records, keys: cards.map(String) },
  ]
  const chunkRank = fuseRrf(chunkLists, { compare: compareChunks })
  const slugOf = (key: string) => docs[chunks[Number(key)].doc].slug
  const slugRank = fuseRrf(
    chunkLists.map((list) => ({ ...list, keys: list.keys.map(slugOf) })),
    { compare: byDateThenSlug((slug) => docs[core.docBySlug.get(slug) ?? -1]) }
  )

  const terms = queryTerms(query)
  const bestChunk = new Map<string, number>()
  for (const hit of chunkRank) {
    const slug = slugOf(hit.key)
    if (!bestChunk.has(slug)) bestChunk.set(slug, Number(hit.key))
  }

  const profileChunks = new Set<number>()
  if (profileIntent) {
    const about = core.docBySlug.get(PROFILE_SLUG)
    const ranked = chunkRank.map((hit) => Number(hit.key))
    const own = about === undefined ? [] : core.chunksOfDoc[about]
    for (const chunk of [...ranked.filter((i) => chunks[i].doc === about), ...own]) {
      if (profileChunks.size >= limits.profileFacts) break
      profileChunks.add(chunk)
    }
  }
  // The most relevant about chunks, read in panel order so the identity block leads.
  const facts = [...profileChunks].sort((a, b) => a - b)

  const instantResults: RetrievalItem[] = slugRank
    .slice(0, limits.instantResults)
    .map(({ key: slug, score }: FusedHit) => {
      const doc = docs[core.docBySlug.get(slug) as number]
      const chunk = chunks[bestChunk.get(slug) as number]
      return {
        slug: doc.slug,
        title: doc.title,
        heading: chunk.heading,
        description: doc.description,
        snippet: snippetFor(chunk.text, terms, limits.snippetChars),
        articleType: doc.type,
        score,
        keywords: doc.keywords,
        domains: doc.domains,
        target: doc.target,
      }
    })

  const perSlug = new Map<string, number>()
  const picked: number[] = []
  for (const hit of chunkRank) {
    if (picked.length >= limits.contextChunks) break
    const index = Number(hit.key)
    if (profileChunks.has(index)) continue
    const slug = slugOf(hit.key)
    const count = perSlug.get(slug) ?? 0
    if (count >= limits.perSlug) continue
    perSlug.set(slug, count + 1)
    picked.push(index)
  }
  const context = budgetContext(
    picked.map((index) => {
      const chunk = chunks[index]
      const doc = docs[chunk.doc]
      return {
        head: [
          ['Title', doc.title],
          ['Slug', doc.slug],
          ['Type', doc.type],
          ['Heading', chunk.heading],
        ] as [string, string][],
        passage: chunk.kind === 'card' ? doc.description || chunk.text : chunk.text,
      }
    }),
    limits.contextChars
  )

  return {
    profileIntent,
    profileFacts: facts.map((index) => clip(chunks[index].text, limits.factChars)),
    context,
    instantResults,
    mode: inputs.mode,
    ...(inputs.fallbackReason ? { fallbackReason: inputs.fallbackReason } : {}),
  }
}
