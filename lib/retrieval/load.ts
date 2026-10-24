// Index assets load once per isolate through RetrievalDeps.fetchAsset and stay cached in module
// scope, keyed by their content-hashed paths. A failed load is never cached.
import { loadBm25, type Bm25Index } from './bm25'
import { decodeVectorSet } from './dense'
import type { Int8RowMatrix } from './quantize'
import type {
  Bm25File,
  ChunksFile,
  RetrievalDeps,
  SearchChunk,
  SearchDoc,
  SearchManifest,
  VectorSetEntry,
} from './types'

export interface CoreIndex {
  manifest: SearchManifest
  docs: SearchDoc[]
  chunks: SearchChunk[]
  bm25: Bm25Index
  docBySlug: Map<string, number>
  /** Chunk index of each doc's card, or -1. */
  cardOfDoc: Int32Array
  /** Chunk indexes per doc, in index order. */
  chunksOfDoc: number[][]
}

const coreCache = new Map<string, Promise<CoreIndex>>()
const denseCache = new Map<string, Promise<Int8RowMatrix>>()

function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>) {
  let pending = cache.get(key)
  if (!pending) {
    pending = load()
    cache.set(key, pending)
    pending.catch(() => cache.delete(key))
  }
  return pending
}

async function fetchOk(fetchAsset: RetrievalDeps['fetchAsset'], path: string) {
  const response = await fetchAsset(path)
  if (!response.ok) throw new Error(`search asset ${path}: HTTP ${response.status}`)
  return response
}

function indexCore(manifest: SearchManifest, file: ChunksFile, bm25File: Bm25File): CoreIndex {
  const { docs, chunks } = file
  if (
    file.schema !== 1 ||
    file.chunkerVersion !== manifest.chunkerVersion ||
    !Array.isArray(docs) ||
    !Array.isArray(chunks) ||
    docs.length !== manifest.docs ||
    chunks.length !== manifest.chunks ||
    bm25File.docs !== chunks.length
  ) {
    throw new Error('search index: assets do not match the manifest')
  }
  const docBySlug = new Map(docs.map((doc, i) => [doc.slug, i]))
  const cardOfDoc = new Int32Array(docs.length).fill(-1)
  const chunksOfDoc: number[][] = docs.map(() => [])
  chunks.forEach((chunk, i) => {
    if (!(chunk.doc >= 0 && chunk.doc < docs.length)) throw new Error('search index: bad doc ref')
    chunksOfDoc[chunk.doc].push(i)
    if (chunk.kind === 'card') cardOfDoc[chunk.doc] = i
  })
  return { manifest, docs, chunks, bm25: loadBm25(bm25File), docBySlug, cardOfDoc, chunksOfDoc }
}

/** Chunks + BM25 postings; rejects on any fetch, parse or consistency failure. */
export function loadCoreIndex(
  manifest: SearchManifest,
  fetchAsset: RetrievalDeps['fetchAsset']
): Promise<CoreIndex> {
  const { chunks, bm25 } = manifest.assets
  return cached(coreCache, `${chunks}|${bm25}`, async () => {
    const [chunksFile, bm25File] = await Promise.all([
      fetchOk(fetchAsset, chunks).then((response) => response.json() as Promise<ChunksFile>),
      fetchOk(fetchAsset, bm25).then((response) => response.json() as Promise<Bm25File>),
    ])
    return indexCore(manifest, chunksFile, bm25File)
  })
}

/** One vector set's int8 matrix, rows aligned with the manifest's chunks. */
export function loadDenseIndex(
  manifest: SearchManifest,
  entry: VectorSetEntry,
  fetchAsset: RetrievalDeps['fetchAsset']
): Promise<Int8RowMatrix> {
  return cached(denseCache, entry.asset, async () => {
    if (entry.hashes !== manifest.hashes || entry.chunkerVersion !== manifest.chunkerVersion) {
      throw new Error(`vectors ${entry.model}: built against different chunks`)
    }
    const response = await fetchOk(fetchAsset, entry.asset)
    return decodeVectorSet(entry, await response.arrayBuffer(), manifest.chunks)
  })
}

/** Tests and long-lived dev servers can drop the per-isolate cache. */
export function resetSearchIndexCache() {
  coreCache.clear()
  denseCache.clear()
}
