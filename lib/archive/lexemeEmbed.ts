// arc-lexeme query embedder: the static lookup-and-pool model behind RE-MEANING (research/arcforge).
//
// A bundle is a handful of static assets loaded once per isolate through fetchAsset:
// arc-lexeme.meta.json naming lexicon.bin (a front-coded sorted key table, read in place),
// vectors<D>.i8 (per-row int8), scales.f16, weights.f16 (optional) and bias.f16 (b_query then
// b_doc). A query is folded and split by lib/retrieval/tokenize.ts itself (foldText, then
// normalizedTokens' split), matched greedily against the lexicon (multiword, then entity or
// word, then hashed character n-grams), and embedded as normalize(b + Σ p·w·e). Pure
// TypeScript, no WASM: well under a millisecond once the bundle is loaded.
//
// research/arcforge/arcforge/models is the Python twin (it builds the lexicon and the bundle).
// lexemeEmbed.test.ts holds the two together: identical token streams on 10k strings and
// bit-identical vectors on the committed toy bundle.
//
// The default export is an EvalPlugin for scripts/eval-retrieval.ts:
//   ARC_LEXEME_BUNDLE=<dir with arc-lexeme.meta.json> \
//     pnpm exec tsx scripts/eval-retrieval.ts --plugin lib/archive/lexemeEmbed.ts
// It registers the bundle's query embedder (dense:<model>, hybrid:<model>) and, unless a
// committed data/search vector source already serves that model, embeds every chunk in memory
// from the lookup table, as CI does for records added between GPU runs.
import { embedText, sha256Hex } from '../retrieval/chunk'
import { TOKENIZER_VERSION, foldText } from '../retrieval/tokenize'
import type { VectorSource } from '../retrieval/build'
import type { EvalPlugin } from '../retrieval/eval'
import type { RetrievalDeps } from '../retrieval/types'

export const LEXEME_TOKENIZER_VERSION = 'arc-lexeme-tok/1'
export const LEXEME_BUNDLE_SCHEMA = 'arc-lexeme-bundle/1'
export const LEXEME_META_NAME = 'arc-lexeme.meta.json'

// ---- Words (fold.py) -------------------------------------------------------------------------

// normalizedTokens' word split (lib/retrieval/tokenize.ts): letters and digits of any script.
const NON_WORD = /[^\p{L}\p{N}]+/u
const SPLIT_PATTERN = '[^\\p{L}\\p{N}]+'

/**
 * Every word of the site's folded text (foldText, then normalizedTokens' split), with stop words
 * and single characters kept: multiword lexemes ('the pause') span them.
 */
export function lexemeWords(value: string): string[] {
  return foldText(value)
    .split(NON_WORD)
    .filter((word) => word.length > 0)
}

// ---- Lexicon (lexicon.py) --------------------------------------------------------------------

export const LEXEME_KIND = {
  word: 0,
  general: 1,
  multiword: 2,
  entity: 3,
  alias: 4,
  bucket: 5,
} as const
export type LexemeKind = (typeof LEXEME_KIND)[keyof typeof LEXEME_KIND]

export interface LexemeTokenizerSpec {
  version: string
  fold: string
  split: string
  min_word: number
  stop_words: string[]
  ngrams: { min: number; max: number; buckets: number; hash: string; pad: string[] }
}

interface LexiconHeader {
  format: string
  spec: LexemeTokenizerSpec
  spec_sha256: string
  entries: number
  blocks: number
  block_size: number
  bucket_base: number
  rows: number
  max_words: number
}

export interface LexiconHit {
  row: number
  kind: LexemeKind
  /** Alias entries only: the entity rows a shared bare name can mean. */
  candidates: number[]
}

const MAGIC = 'ARCLEX01'
const MAX_KEY_BYTES = 255
const utf8 = new TextEncoder()

/** lexicon.bin, read in place: binary search over block heads, then one block decoded. */
export class LexemeLexicon {
  readonly header: LexiconHeader
  readonly spec: LexemeTokenizerSpec
  readonly rows: number
  readonly bucketBase: number
  readonly maxWords: number
  private readonly bytes: Uint8Array
  private readonly view: DataView
  private readonly offsetsStart: number
  private readonly dataStart: number
  private readonly stopWords: Set<string>
  private readonly key = new Uint8Array(MAX_KEY_BYTES)

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    if (bytes.length < 12 || String.fromCharCode(...bytes.subarray(0, 8)) !== MAGIC) {
      throw new Error('lexicon: bad magic')
    }
    const headerLength = this.view.getUint32(8, true)
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + headerLength)))
    if (header?.format !== 'arc-lexicon/1') throw new Error('lexicon: unsupported format')
    const spec = header.spec as LexemeTokenizerSpec
    if (spec?.version !== LEXEME_TOKENIZER_VERSION) {
      throw new Error(`lexicon: unsupported tokenizer ${spec?.version}`)
    }
    // The fold is the site's own foldText: a lexicon built for another version of it would be
    // matched against differently folded words.
    if (spec.fold !== TOKENIZER_VERSION) {
      throw new Error(
        `lexicon: built for site tokenizer ${spec.fold}, this build is ${TOKENIZER_VERSION}`
      )
    }
    if (
      spec.split !== SPLIT_PATTERN ||
      spec.ngrams?.hash !== 'fnv1a32' ||
      spec.ngrams.pad?.join('') !== '<>'
    ) {
      throw new Error('lexicon: unsupported split or n-gram hashing')
    }
    this.header = header as LexiconHeader
    this.spec = spec
    this.rows = header.rows
    this.bucketBase = header.bucket_base
    this.maxWords = header.max_words
    this.stopWords = new Set(spec.stop_words)
    this.offsetsStart = 12 + headerLength
    this.dataStart = this.offsetsStart + 4 * (header.blocks + 1)
    if (this.dataStart + this.offset(header.blocks) !== bytes.length) {
      throw new Error('lexicon: truncated or padded entry data')
    }
  }

  private offset(block: number): number {
    return this.view.getUint32(this.offsetsStart + 4 * block, true)
  }

  /** Whether a single word is a candidate at all: the site's 2+ characters, no stop words. */
  keeps(word: string): boolean {
    return word.length >= this.spec.min_word && !this.stopWords.has(word)
  }

  /** Compare the block head (in place) with `key`: <0, 0 or >0. */
  private compareHead(block: number, key: Uint8Array): number {
    const pos = this.dataStart + this.offset(block)
    const length = this.bytes[pos + 1]
    return compareBytes(this.bytes, pos + 2, length, key, key.length)
  }

  lookup(text: string): LexiconHit | null {
    const key = utf8.encode(text)
    if (key.length > MAX_KEY_BYTES) return null
    let lo = 0
    let hi = this.header.blocks - 1
    let block = -1
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      if (this.compareHead(mid, key) <= 0) {
        block = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    if (block < 0) return null
    const bytes = this.bytes
    const buffer = this.key
    const cursor = { pos: this.dataStart + this.offset(block) }
    const end = this.dataStart + this.offset(block + 1)
    while (cursor.pos < end) {
      const shared = bytes[cursor.pos]
      const suffix = bytes[cursor.pos + 1]
      buffer.set(bytes.subarray(cursor.pos + 2, cursor.pos + 2 + suffix), shared)
      cursor.pos += 2 + suffix
      const kind = bytes[cursor.pos++] as LexemeKind
      const row = readVarint(bytes, cursor)
      const candidates: number[] = []
      if (kind === LEXEME_KIND.alias) {
        for (let n = readVarint(bytes, cursor); n > 0; n--)
          candidates.push(readVarint(bytes, cursor))
      }
      const order = compareBytes(buffer, 0, shared + suffix, key, key.length)
      if (order === 0) return { row, kind, candidates }
      if (order > 0) return null
    }
    return null
  }
}

function compareBytes(
  a: Uint8Array,
  start: number,
  length: number,
  b: Uint8Array,
  bLength: number
) {
  const n = Math.min(length, bLength)
  for (let i = 0; i < n; i++) {
    const diff = a[start + i] - b[i]
    if (diff) return diff
  }
  return length - bLength
}

/** LEB128, advancing cursor.pos. */
function readVarint(bytes: Uint8Array, cursor: { pos: number }): number {
  let value = 0
  let scale = 1
  for (;;) {
    const byte = bytes[cursor.pos++]
    value += (byte & 0x7f) * scale
    if (!(byte & 0x80)) return value
    scale *= 128
    if (scale > 2 ** 35) throw new Error('lexicon: varint too long')
  }
}

// ---- Tokenizer (tokenizer.py) ----------------------------------------------------------------

export interface LexemeToken {
  row: number
  kind: LexemeKind
  /** [w0, w1): the lexemeWords(text) this token covers. */
  w0: number
  w1: number
  /** 1, or 1/k for each of an unknown word's k n-gram buckets. */
  weight: number
}

export type LexemeMode = 'query' | 'document'

function fnv1a32(bytes: Uint8Array, start: number, end: number): number {
  let hash = 0x811c9dc5
  for (let i = start; i < end; i++) {
    hash ^= bytes[i]
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

/** Bucket indexes of the code-point n-grams of '<word>' (each hashed as UTF-8), by n then position. */
export function ngramBuckets(word: string, spec: LexemeTokenizerSpec): number[] {
  const { min, max, buckets } = spec.ngrams
  if (!(buckets > 0)) return []
  const bytes = utf8.encode(`<${word}>`)
  // Byte offset of every code point, and one past the end.
  const starts: number[] = []
  for (let i = 0; i < bytes.length; i++) if ((bytes[i] & 0xc0) !== 0x80) starts.push(i)
  starts.push(bytes.length)
  const points = starts.length - 1
  const out: number[] = []
  for (let n = min; n <= max; n++) {
    for (let i = 0; i + n <= points; i++) {
      out.push(fnv1a32(bytes, starts[i], starts[i + n]) % buckets)
    }
  }
  return out
}

/**
 * Greedy longest match over lexemeWords(text): the longest multiword key starting at each word,
 * else the word's own row when it passes the site filter, else its n-gram buckets. A shared
 * bare name (alias) stays an alias in query mode (it raises the ALIAS PROMPT); in document mode
 * it becomes the person `aliases` maps it to, else the candidate mentioned most recently in the
 * same text, else it stays an alias.
 */
export function tokenizeLexemes(
  lexicon: LexemeLexicon,
  text: string,
  mode: LexemeMode = 'query',
  aliases?: ReadonlyMap<number, number>
): LexemeToken[] {
  const words = lexemeWords(text)
  const out: LexemeToken[] = []
  const lastSeen = new Map<number, number>()
  let mentions = 0
  let i = 0
  while (i < words.length) {
    let hit: LexiconHit | null = null
    let length = Math.min(lexicon.maxWords, words.length - i)
    for (; length >= 2; length--) {
      hit = lexicon.lookup(words.slice(i, i + length).join(' '))
      if (hit) break
    }
    if (!hit) {
      length = 1
      if (lexicon.keeps(words[i])) hit = lexicon.lookup(words[i])
    }
    if (hit) {
      let { row, kind } = hit
      if (mode === 'document') {
        if (kind === LEXEME_KIND.alias) {
          const mapped = aliases?.get(row)
          let best = -1
          for (const candidate of hit.candidates) {
            const seen = lastSeen.get(candidate)
            if (seen !== undefined && (best < 0 || seen > (lastSeen.get(best) ?? -1))) {
              best = candidate
            }
          }
          if (mapped !== undefined) [row, kind] = [mapped, LEXEME_KIND.entity]
          else if (best >= 0) [row, kind] = [best, LEXEME_KIND.entity]
        }
        if (kind === LEXEME_KIND.entity) lastSeen.set(row, ++mentions)
      }
      out.push({ row, kind, w0: i, w1: i + length, weight: 1 })
    } else if (lexicon.keeps(words[i])) {
      const buckets = ngramBuckets(words[i], lexicon.spec)
      const weight = buckets.length ? 1 / buckets.length : 0
      for (const bucket of buckets) {
        out.push({
          row: lexicon.bucketBase + bucket,
          kind: LEXEME_KIND.bucket,
          w0: i,
          w1: i + 1,
          weight,
        })
      }
    }
    i += length
  }
  return out
}

// ---- Bundle (bundle.py) ----------------------------------------------------------------------

export interface LexemeBundleFile {
  path: string
  bytes: number
  sha256: string
}

export interface LexemeBundleMeta {
  schema: string
  /** 'arc-lexeme@<run_id>': the vector set's model id. */
  model: string
  run_id: string
  corpus_id: string
  verdict_status: string
  dims: number
  rows: number
  quant: 'int8-row-f16'
  pooling: 'sum' | 'mean'
  mrl: boolean
  tokenizer: { version: string; spec_sha256: string }
  files: {
    lexicon: LexemeBundleFile
    vectors: LexemeBundleFile
    scales: LexemeBundleFile
    bias: LexemeBundleFile
    weights?: LexemeBundleFile
  }
}

export interface LexemeBundle {
  meta: LexemeBundleMeta
  lexicon: LexemeLexicon
  dims: number
  rows: number
  vectors: Int8Array
  scales: Float64Array
  weights: Float64Array | null
  bQuery: Float64Array
  bDoc: Float64Array
}

/** IEEE 754 half → double, exactly. */
export function halfToFloat(half: number): number {
  const sign = half & 0x8000 ? -1 : 1
  const exponent = (half >> 10) & 0x1f
  const fraction = half & 0x3ff
  if (exponent === 0) return sign * fraction * 2 ** -24
  if (exponent === 31) return fraction ? NaN : sign * Infinity
  return sign * (1 + fraction / 1024) * 2 ** (exponent - 15)
}

function decodeHalves(bytes: Uint8Array): Float64Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out = new Float64Array(bytes.byteLength >> 1)
  for (let i = 0; i < out.length; i++) out[i] = halfToFloat(view.getUint16(2 * i, true))
  return out
}

type BundleFiles = Record<keyof LexemeBundleMeta['files'], Uint8Array | undefined>

/** Check a meta file and its loaded files against each other (sizes, schema, tokenizer). */
export function parseLexemeBundle(meta: LexemeBundleMeta, files: BundleFiles): LexemeBundle {
  if (meta?.schema !== LEXEME_BUNDLE_SCHEMA) {
    throw new Error(`arc-lexeme: unsupported bundle schema ${meta?.schema}`)
  }
  if (meta.quant !== 'int8-row-f16' || (meta.pooling !== 'sum' && meta.pooling !== 'mean')) {
    throw new Error('arc-lexeme: unsupported quant or pooling')
  }
  for (const [name, entry] of Object.entries(meta.files)) {
    const bytes = files[name as keyof BundleFiles]
    if (!entry || !bytes || bytes.length !== entry.bytes) {
      throw new Error(`arc-lexeme: ${entry?.path ?? name} is missing or has the wrong size`)
    }
  }
  const { dims, rows } = meta
  const lexicon = new LexemeLexicon(files.lexicon!)
  if (lexicon.rows !== rows || meta.tokenizer?.version !== LEXEME_TOKENIZER_VERSION) {
    throw new Error('arc-lexeme: lexicon does not match the meta')
  }
  if (lexicon.header.spec_sha256 !== meta.tokenizer.spec_sha256) {
    throw new Error('arc-lexeme: lexicon tokenizer spec does not match the meta')
  }
  const vectorBytes = files.vectors!
  const vectors = new Int8Array(vectorBytes.buffer, vectorBytes.byteOffset, vectorBytes.byteLength)
  const scales = decodeHalves(files.scales!)
  const weights = files.weights ? decodeHalves(files.weights) : null
  const bias = decodeHalves(files.bias!)
  if (
    vectors.length !== rows * dims ||
    scales.length !== rows ||
    (weights && weights.length !== rows) ||
    bias.length !== 2 * dims
  ) {
    throw new Error('arc-lexeme: bundle files do not match rows × dims')
  }
  return {
    meta,
    lexicon,
    dims,
    rows,
    vectors,
    scales,
    weights,
    bQuery: bias.subarray(0, dims),
    bDoc: bias.subarray(dims),
  }
}

export interface LoadLexemeBundleOptions {
  /** Refuse a bundle built from another corpus snapshot than the served index. */
  corpusId?: string
  /** Verify every file's sha256 against the meta (default true). */
  verify?: boolean
}

function resolveAsset(metaPath: string, file: string): string {
  const slash = metaPath.lastIndexOf('/')
  return slash >= 0 ? `${metaPath.slice(0, slash + 1)}${file}` : file
}

async function fetchBytes(fetchAsset: RetrievalDeps['fetchAsset'], path: string) {
  const response = await fetchAsset(path)
  if (!response.ok) throw new Error(`arc-lexeme asset ${path}: HTTP ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

/** Load a bundle by its meta path; every file is resolved next to the meta. */
export async function loadLexemeBundle(
  fetchAsset: RetrievalDeps['fetchAsset'],
  metaPath: string,
  options: LoadLexemeBundleOptions = {}
): Promise<LexemeBundle> {
  const metaBytes = await fetchBytes(fetchAsset, metaPath)
  const meta = JSON.parse(new TextDecoder().decode(metaBytes)) as LexemeBundleMeta
  if (options.corpusId !== undefined && meta?.corpus_id !== options.corpusId) {
    throw new Error(`arc-lexeme: bundle corpus ${meta?.corpus_id} is not ${options.corpusId}`)
  }
  const entries = Object.entries(meta?.files ?? {}) as [keyof BundleFiles, LexemeBundleFile][]
  const loaded = await Promise.all(
    entries.map(async ([name, entry]) => {
      const bytes = await fetchBytes(fetchAsset, resolveAsset(metaPath, entry.path))
      if (options.verify !== false && (await sha256Hex(bytes, 64)) !== entry.sha256) {
        throw new Error(`arc-lexeme: ${entry.path} does not match its sha256`)
      }
      return [name, bytes] as const
    })
  )
  return parseLexemeBundle(meta, Object.fromEntries(loaded) as BundleFiles)
}

// ---- Embedding (bundle.py embed) -------------------------------------------------------------

export interface LexemeEmbedding {
  vector: Float32Array
  tokens: LexemeToken[]
  /** A shared bare name matched in query mode: ask which person (the ALIAS PROMPT). */
  aliasPrompt: boolean
}

/**
 * normalize(b + Σ p·w·e) in float64, token then dimension order, as bundle.py computes it;
 * 'mean' pooling divides the sum by Σ p before the bias. No contributing token: all zeros, which
 * lib/retrieval treats as no dense signal.
 */
export function embedLexemes(
  bundle: LexemeBundle,
  text: string,
  mode: LexemeMode = 'query',
  aliases?: ReadonlyMap<number, number>
): LexemeEmbedding {
  const { dims, vectors, scales, weights } = bundle
  const tokens = tokenizeLexemes(bundle.lexicon, text, mode, aliases)
  const acc = new Float64Array(dims)
  let total = 0
  let contributing = false
  for (const token of tokens) {
    total += token.weight
    const scale = scales[token.row]
    if (scale === 0 || token.weight === 0) continue
    const factor = token.weight * (weights ? weights[token.row] : 1) * scale
    const base = token.row * dims
    for (let d = 0; d < dims; d++) acc[d] += factor * vectors[base + d]
    contributing = true
  }
  const aliasPrompt = tokens.some((token) => token.kind === LEXEME_KIND.alias)
  const vector = new Float32Array(dims)
  if (!contributing) return { vector, tokens, aliasPrompt }
  if (bundle.meta.pooling === 'mean') for (let d = 0; d < dims; d++) acc[d] = acc[d] / total
  const bias = mode === 'query' ? bundle.bQuery : bundle.bDoc
  let squares = 0
  for (let d = 0; d < dims; d++) {
    acc[d] += bias[d]
    squares += acc[d] * acc[d]
  }
  const norm = Math.sqrt(squares)
  if (norm > 0) for (let d = 0; d < dims; d++) vector[d] = acc[d] / norm
  return { vector, tokens, aliasPrompt }
}

const bundleCache = new Map<string, Promise<LexemeBundle>>()

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
}

/**
 * RetrievalDeps.embedQuery for an arc-lexeme bundle. The bundle loads on first use and stays
 * cached per meta path for the isolate's life; a failed load is retried on the next query.
 */
export function createLexemeEmbedder(
  fetchAsset: RetrievalDeps['fetchAsset'],
  metaPath: string,
  options: LoadLexemeBundleOptions = {}
): NonNullable<RetrievalDeps['embedQuery']> {
  return async (q, signal) => {
    if (signal.aborted) throw abortError(signal)
    let pending = bundleCache.get(metaPath)
    if (!pending) {
      pending = loadLexemeBundle(fetchAsset, metaPath, options)
      bundleCache.set(metaPath, pending)
      pending.catch(() => bundleCache.delete(metaPath))
    }
    const bundle = await new Promise<LexemeBundle>((resolve, reject) => {
      const onAbort = () => reject(abortError(signal))
      signal.addEventListener('abort', onAbort, { once: true })
      pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
    })
    return embedLexemes(bundle, q, 'query').vector
  }
}

// ---- EvalPlugin -----------------------------------------------------------------------------

type ReadFile = (path: string) => Promise<Uint8Array>

/** Node's fs, without a static import: this module also runs in the Worker and the browser. */
function nodeReadFile(): ReadFile {
  const fs = globalThis.process?.getBuiltinModule?.('node:fs/promises')
  if (!fs) throw new Error('arc-lexeme eval plugin: needs Node (fs)')
  return async (path) => new Uint8Array(await fs.readFile(path))
}

/**
 * An EvalPlugin over the bundle in `dir`. Chunk vectors are embedded in document mode, one chunk
 * at a time (document-local alias rewriting sees one chunk), from embedText(title, heading, text)
 * as any embedding job would; a committed vector source for the same model takes precedence.
 */
export function lexemeEvalPlugin(dir: string, readFile: ReadFile = nodeReadFile()): EvalPlugin {
  const embedders: NonNullable<EvalPlugin['embedders']> = {}
  const fetchAsset: RetrievalDeps['fetchAsset'] = async (path) => {
    try {
      return new Response(await readFile(path))
    } catch {
      return new Response('not found', { status: 404 })
    }
  }
  return {
    name: 'arc-lexeme',
    // A getter: scripts/eval-retrieval.ts reads embedders after vectorSources has loaded the
    // bundle and learned its model id.
    get embedders() {
      return embedders
    },
    async vectorSources({ built, input }) {
      const bundle = await loadLexemeBundle(
        fetchAsset,
        `${dir.replace(/\/$/, '')}/${LEXEME_META_NAME}`
      )
      const model = bundle.meta.model
      embedders[model] = async (q) => embedLexemes(bundle, q, 'query').vector
      if (input.vectorSources?.some((source) => source.manifest.model === model)) return []
      const { docs, chunks } = built.chunks
      const data = new Float32Array(chunks.length * bundle.dims)
      chunks.forEach((chunk, i) => {
        const text = embedText(docs[chunk.doc].title, chunk.heading, chunk.text)
        data.set(embedLexemes(bundle, text, 'document').vector, i * bundle.dims)
      })
      const source: VectorSource = {
        manifest: {
          model,
          dims: bundle.dims,
          quant: 'f32',
          chunkerVersion: built.chunks.chunkerVersion,
          hashes: chunks.map((chunk) => chunk.hash),
          runtime: model,
          mrl: bundle.meta.mrl,
        },
        bytes: new Uint8Array(data.buffer),
      }
      return [source]
    },
  }
}

function pluginFromEnv(): EvalPlugin {
  const dir = globalThis.process?.env?.ARC_LEXEME_BUNDLE
  if (dir) return lexemeEvalPlugin(dir)
  return {
    name: 'arc-lexeme',
    vectorSources() {
      console.warn('[arc-lexeme] ARC_LEXEME_BUNDLE is not set: no bundle, no lexeme configs')
      return []
    },
  }
}

export const plugin: EvalPlugin = pluginFromEnv()
export default plugin
