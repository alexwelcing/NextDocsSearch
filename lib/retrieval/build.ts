// Network-free index build: chunks + BM25 postings from the records and operator panels, joined
// by chunk hash to whatever vector sets are committed. scripts/generate-search-index.ts does the
// file IO; the eval harness builds the same index in memory.
import { buildBm25, type Bm25Fields } from './bm25'
import {
  CHUNKER_VERSION,
  OPERATOR_DOCS,
  cardChunk,
  chunkBlocks,
  chunkHash,
  embedText,
  operatorBlocks,
  operatorTarget,
  sha256Hex,
  type ChunkDraft,
  type OperatorPanelSource,
  type RecordBlock,
} from './chunk'
import {
  decodeFloat32Rows,
  decodeInt8Rows,
  encodeInt8Rows,
  normalize,
  quantizeRow,
  type Int8RowMatrix,
} from './quantize'
import { TOKENIZER_VERSION } from './tokenize'
import type {
  Bm25File,
  ChunksFile,
  SearchChunk,
  SearchDoc,
  SearchManifest,
  VectorSetEntry,
  VectorSourceManifest,
} from './types'

/** A public/arc/records file joined with its article-manifest metadata. */
export interface BuildRecord {
  slug: string
  title: string
  date: string
  description: string
  blocks: RecordBlock[]
  type?: string
  keywords?: string[]
  domains?: string[]
}

export interface VectorSource {
  manifest: VectorSourceManifest
  bytes: Uint8Array
}

export interface BuildInput {
  records: BuildRecord[]
  operatorPanels: OperatorPanelSource[]
  vectorSources?: VectorSource[]
  /** Optional precomputed expansion questions keyed by chunk hash (indexed by BM25 only). */
  doc2query?: Record<string, string[]>
}

export interface BuiltVectorSet {
  entry: Omit<VectorSetEntry, 'asset'>
  matrix: Int8RowMatrix
  /** Chunk ids with no vector; they stay lexical-only. */
  missing: string[]
}

export interface BuiltIndex {
  chunks: ChunksFile
  bm25: Bm25File
  vectors: BuiltVectorSet[]
  /** Digest of the chunk hashes in order. */
  hashes: string
  warnings: string[]
}

function collectDrafts(input: BuildInput) {
  const docs: SearchDoc[] = []
  const drafts: { doc: number; draft: ChunkDraft }[] = []
  const records = [...input.records].sort((a, b) => a.slug.localeCompare(b.slug))
  for (const record of records) {
    const keywords = record.keywords ?? []
    const doc = docs.length
    docs.push({
      slug: record.slug,
      title: record.title,
      date: record.date,
      type: record.type || 'article',
      description: record.description,
      keywords,
      domains: record.domains ?? [],
      target: { type: 'article' },
    })
    drafts.push({ doc, draft: cardChunk({ ...record, keywords }) })
    for (const draft of chunkBlocks(record)) drafts.push({ doc, draft })
  }
  for (const operator of OPERATOR_DOCS) {
    const panel = input.operatorPanels.find((candidate) => candidate.id === operator.panel)
    if (!panel) continue
    const blocks = operatorBlocks(panel)
    const doc = docs.length
    docs.push({
      slug: operator.slug,
      title: operator.title,
      date: '',
      type: 'operator',
      description: blocks.find((block) => block.t === 'p')?.x ?? panel.title,
      keywords: [],
      domains: [],
      target: operatorTarget(operator.panel),
    })
    const source = { slug: operator.slug, title: operator.title, blocks }
    for (const draft of chunkBlocks(source, 'operator')) drafts.push({ doc, draft })
  }
  return { docs, drafts }
}

type RowReader = (row: number, out: Int8Array, offset: number) => number

function rowReader({ manifest, bytes }: VectorSource): RowReader {
  const { dims, quant, hashes } = manifest
  if (quant === 'int8-row') {
    const decoded = decodeInt8Rows(bytes, hashes.length, dims)
    return (row, out, offset) => {
      out.set(decoded.data.subarray(row * dims, (row + 1) * dims), offset)
      return decoded.scales[row]
    }
  }
  if (quant === 'f32') {
    const decoded = decodeFloat32Rows(bytes, hashes.length, dims)
    return (row, out, offset) =>
      quantizeRow(normalize(decoded.slice(row * dims, (row + 1) * dims)), out, offset)
  }
  throw new Error(`unsupported quant ${String(quant)}`)
}

/** Align a vector source to the chunk order by hash; unmatched chunks get a zero-scale row. */
export function joinVectors(source: VectorSource, chunks: SearchChunk[], warnings: string[]) {
  const { model, dims, hashes, chunkerVersion } = source.manifest
  let read: RowReader
  try {
    if (!(dims > 0) || !Array.isArray(hashes)) throw new Error('invalid manifest')
    read = rowReader(source)
  } catch (error) {
    warnings.push(`vectors ${model}: ${(error as Error).message}; skipped`)
    return null
  }
  if (chunkerVersion !== CHUNKER_VERSION) {
    warnings.push(
      `vectors ${model}: built for chunker ${chunkerVersion}, index is ${CHUNKER_VERSION}`
    )
  }
  const rowByHash = new Map<string, number>()
  hashes.forEach((hash, row) => {
    if (!rowByHash.has(hash)) rowByHash.set(hash, row)
  })
  const data = new Int8Array(chunks.length * dims)
  const scales = new Float32Array(chunks.length)
  const missing: string[] = []
  chunks.forEach((chunk, i) => {
    const row = rowByHash.get(chunk.hash)
    if (row === undefined) missing.push(chunk.id)
    else scales[i] = read(row, data, i * dims)
  })
  if (missing.length) {
    warnings.push(
      `vectors ${model}: ${missing.length} of ${chunks.length} chunks have no vector and stay ` +
        `lexical-only (e.g. ${missing.slice(0, 3).join(', ')})`
    )
  }
  const matrix: Int8RowMatrix = { rows: chunks.length, dims, data, scales }
  return { matrix, missing }
}

export async function buildSearchIndex(input: BuildInput): Promise<BuiltIndex> {
  const warnings: string[] = []
  const { docs, drafts } = collectDrafts(input)
  const chunks: SearchChunk[] = []
  for (const { doc, draft } of drafts) {
    const { id, kind, heading, b0, b1, text } = draft
    chunks.push({ id, doc, kind, heading, b0, b1, text, hash: await chunkHash(draft.embedText) })
  }

  const doc2query = input.doc2query ?? {}
  const fields: Bm25Fields[] = chunks.map((chunk) => {
    const doc = docs[chunk.doc]
    const card = chunk.kind === 'card'
    return {
      title: doc.title,
      heading: chunk.heading,
      keywords: card ? [...doc.keywords, ...doc.domains].join(' ') : '',
      body: card ? doc.description : chunk.text,
      doc2query: (doc2query[chunk.hash] ?? []).join(' '),
    }
  })

  const hashes = await sha256Hex(chunks.map((chunk) => chunk.hash).join('\n'))
  const vectors: BuiltVectorSet[] = []
  for (const source of input.vectorSources ?? []) {
    const { manifest } = source
    if (vectors.some((set) => set.entry.model === manifest.model)) {
      warnings.push(`vectors ${manifest.model}: duplicate model; skipped`)
      continue
    }
    const joined = joinVectors(source, chunks, warnings)
    if (!joined) continue
    if (chunks.length && joined.missing.length === chunks.length) {
      warnings.push(`vectors ${manifest.model}: no chunk matched; skipped`)
      continue
    }
    vectors.push({
      ...joined,
      entry: {
        model: manifest.model,
        dims: manifest.dims,
        quant: 'int8-row',
        chunkerVersion: manifest.chunkerVersion,
        rows: chunks.length,
        present: chunks.length - joined.missing.length,
        hashes,
        ...(manifest.runtime ? { runtime: manifest.runtime } : {}),
        ...(manifest.queryInstruction !== undefined
          ? { queryInstruction: manifest.queryInstruction }
          : {}),
        ...(typeof manifest.cosineFloor === 'number' ? { cosineFloor: manifest.cosineFloor } : {}),
      },
    })
  }
  if (!vectors.length) warnings.push('no vector sets joined; the index is lexical-only')

  return {
    chunks: { schema: 1, chunkerVersion: CHUNKER_VERSION, docs, chunks },
    bm25: buildBm25(fields),
    vectors,
    hashes,
    warnings,
  }
}

/** One line of the embedding job's input: the exact text a document vector must encode. */
export interface EmbedInput {
  id: string
  /** The chunk hash the resulting vector row is keyed by in data/search/<model>.json. */
  hash: string
  text: string
}

/**
 * What an external embedding job (a Workers AI batch, a static model's trainer) must embed per
 * chunk; chunkHash(text) is always the chunk's hash, so its vector rows join back by hash.
 */
export function embedInputs(file: ChunksFile): EmbedInput[] {
  return file.chunks.map((chunk) => ({
    id: chunk.id,
    hash: chunk.hash,
    text: embedText(file.docs[chunk.doc].title, chunk.heading, chunk.text),
  }))
}

export interface EmittedAsset {
  /** Public path, e.g. '/search/chunks.<hash>.json'. */
  path: string
  bytes: Uint8Array
}

/** Serialize a built index into content-hashed assets plus the manifest that names them. */
export async function emitSearchIndex(
  built: BuiltIndex,
  base = '/search'
): Promise<{ assets: EmittedAsset[]; manifest: SearchManifest }> {
  const encoder = new TextEncoder()
  const assets: EmittedAsset[] = []
  const add = async (name: string, ext: string, bytes: Uint8Array) => {
    const path = `${base}/${name}.${await sha256Hex(bytes, 12)}.${ext}`
    assets.push({ path, bytes })
    return path
  }
  const chunks = await add('chunks', 'json', encoder.encode(JSON.stringify(built.chunks)))
  const bm25 = await add('bm25', 'json', encoder.encode(JSON.stringify(built.bm25)))
  const vectors: VectorSetEntry[] = []
  for (const set of built.vectors) {
    vectors.push({ ...set.entry, asset: await add('vec', 'bin', encodeInt8Rows(set.matrix)) })
  }
  return {
    assets,
    manifest: {
      schema: 1,
      chunkerVersion: built.chunks.chunkerVersion,
      tokenizer: TOKENIZER_VERSION,
      docs: built.chunks.docs.length,
      chunks: built.chunks.chunks.length,
      hashes: built.hashes,
      assets: { chunks, bm25 },
      vectors,
    },
  }
}
