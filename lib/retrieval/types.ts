// The retrieval contract shared by the Ship handler (Worker and the transitional Vercel adapter),
// the index generator and the eval harness. Model-agnostic: dense vectors are optional, and any
// embedding model's int8 matrix plugs in through a vector set entry in the search manifest.

/** What the runtime needs from its host. Both the Worker and Node adapters provide these. */
export interface RetrievalDeps {
  /**
   * Embed a query with the model the active vector set was built with (the caller names it in
   * ShipContextOptions.model). Optional: when it is absent, throws, misses the deadline or returns
   * an unusable vector, retrieval answers lexical-only with the same shape.
   */
  embedQuery?(q: string, signal: AbortSignal): Promise<Float32Array>
  /** Fetch a built index asset by its public path, e.g. '/search/chunks.<hash>.json'. */
  fetchAsset(path: string): Promise<Response>
}

/** Operator panels the dock's Data surface can open (mirrors stores/immersiveStore.ts). */
export type OperatorPanelId = 'about' | 'work' | 'pitch'

/** Where a result opens in-scene: an article reader, or an operator data panel. */
export type RetrievalTarget = { type: 'article' } | { type: 'data'; panel: OperatorPanelId }

/**
 * One instant result: a superset of lib/chat/shipAnswer.ts InstantAnswerItem, so a
 * RetrievalResult is assignable to LocalArchiveQueryResult. The slug is always a real article
 * slug or operator id ('about', 'current-work', 'pitch'), never a heading anchor.
 */
export interface RetrievalItem {
  slug: string
  title: string
  heading: string
  description: string
  snippet: string
  articleType?: string
  score: number
  keywords: string[]
  domains: string[]
  target: RetrievalTarget
}

/** Which rung of the fallback ladder answered. */
export type RetrievalMode = 'hybrid' | 'lexical' | 'records' | 'none'

/** LocalArchiveQueryResult-compatible, plus how the answer was produced. */
export interface RetrievalResult {
  profileIntent: boolean
  profileFacts: string[]
  context: string
  instantResults: RetrievalItem[]
  mode: RetrievalMode
  /** Why a rung was skipped: no embedder, timeout, model mismatch, asset load failure. */
  fallbackReason?: string
}

// ---- Built index artifacts -------------------------------------------------------------------

export type ChunkKind = 'body' | 'card' | 'operator'

/** Per-slug metadata shared by that slug's chunks. */
export interface SearchDoc {
  slug: string
  title: string
  date: string
  /** articleType for records ('fiction' | 'research' | ...), 'operator' for operator docs. */
  type: string
  description: string
  keywords: string[]
  domains: string[]
  target: RetrievalTarget
}

export interface SearchChunk {
  /** '<slug>#<n>' for body and operator chunks, '<slug>#card' for the record card. */
  id: string
  /** Index into ChunksFile.docs. */
  doc: number
  kind: ChunkKind
  heading: string
  /** First and last record block covered (inclusive); -1 for cards. */
  b0: number
  b1: number
  text: string
  /** Model-independent content hash; vector sets join to chunks by it. */
  hash: string
}

/** public/search/chunks.<hash>.json */
export interface ChunksFile {
  schema: 1
  chunkerVersion: string
  docs: SearchDoc[]
  chunks: SearchChunk[]
}

export type Bm25FieldName = 'title' | 'heading' | 'keywords' | 'body' | 'doc2query' | 'meta'

/**
 * public/search/bm25.<hash>.json: precomputed BM25F postings over the chunks.
 * postings[t] is a flat list of pairs [docDelta, tf * 8 + field] for terms[t] (sorted), with
 * doc indexes delta-encoded per term; a doc with tf in several fields repeats with delta 0.
 */
export interface Bm25File {
  schema: 1
  tokenizer: string
  k1: number
  b: number
  fields: Bm25FieldName[]
  weights: number[]
  docs: number
  /** docs × fields, row-major token counts. */
  lengths: number[]
  avgLengths: number[]
  terms: string[]
  postings: number[][]
}

/**
 * A committed vector source: data/search/<model>.json beside data/search/<model>.bin. The .bin
 * holds rows in `hashes` order, either Int8Array[rows × dims] then Float32Array[rows] scales
 * ('int8-row') or Float32Array[rows × dims] ('f32', quantized at build time); little-endian.
 */
export interface VectorSourceManifest {
  model: string
  dims: number
  quant: 'int8-row' | 'f32'
  chunkerVersion: string
  /** Chunk hash per row. */
  hashes: string[]
  /** Provenance a runtime may need: the serving id, instructions, a tuned cosine floor. */
  runtime?: string
  queryInstruction?: string | null
  docInstruction?: string | null
  cosineFloor?: number
  /**
   * Matryoshka-trained: a prefix of a longer query vector is a valid query for these rows. Only
   * then may a longer query be truncated to `dims`; otherwise its length must equal `dims`.
   */
  mrl?: boolean
}

/** A built vector set: public/search/vec.<hash>.bin, rows aligned with ChunksFile.chunks. */
export interface VectorSetEntry {
  model: string
  dims: number
  quant: 'int8-row'
  chunkerVersion: string
  /** Rows (= chunk count) and how many have a vector; missing rows have scale 0. */
  rows: number
  present: number
  /** Digest of the chunk hashes in row order, so a stale vector file is detectable. */
  hashes: string
  asset: string
  runtime?: string
  queryInstruction?: string | null
  /** Dense hits below this cosine are dropped; unset means unfloored (see VectorSourceManifest). */
  cosineFloor?: number
  /** Copied from the source: whether a longer query vector may be truncated to `dims`. */
  mrl?: boolean
}

/** lib/generated/search-manifest.json, imported statically so a deploy stays atomic. */
export interface SearchManifest {
  schema: 1
  chunkerVersion: string
  tokenizer: string
  docs: number
  chunks: number
  /** Digest of the chunk hashes in order (equals every vector set's `hashes`). */
  hashes: string
  assets: { chunks: string; bm25: string }
  vectors: VectorSetEntry[]
}
