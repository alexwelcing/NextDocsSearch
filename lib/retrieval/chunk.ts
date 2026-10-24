// Chunker v1: heading-scoped passages over public/arc/records blocks, plus one card per record
// and the operator panels. Pure and deterministic; any rule change bumps CHUNKER_VERSION, which
// changes every chunk hash and so invalidates every vector set built against the old chunks.
import type { ChunkKind, OperatorPanelId, RetrievalTarget } from './types'

export const CHUNKER_VERSION = 'v1'

export const CHUNK_LIMITS = {
  /** A heading closes the open chunk once it holds this many characters. */
  headingBreak: 400,
  /** A chunk closes as soon as it reaches this many characters. */
  close: 1000,
  /** Longer blocks split at sentences; a chunk past headingBreak never grows beyond this. */
  split: 1600,
  /** A record's trailing chunk shorter than this merges into the previous one. */
  mergeTail: 300,
} as const

/** public/arc/records block: h = heading, p = paragraph, l = list item, q = quote. */
export interface RecordBlock {
  t: 'h' | 'p' | 'l' | 'q'
  x: string
}

export interface ChunkSource {
  slug: string
  title: string
  blocks: RecordBlock[]
}

export interface ChunkDraft {
  id: string
  slug: string
  kind: ChunkKind
  heading: string
  b0: number
  b1: number
  text: string
  /** What an embedding model sees: `${title} › ${heading}\n${text}`. */
  embedText: string
}

export function embedText(title: string, heading: string, text: string): string {
  return `${heading ? `${title} › ${heading}` : title}\n${text}`
}

/**
 * Split one long block into sentence-aligned parts of at most `max` characters. Parts joined
 * with single spaces reproduce the (whitespace-normalized) block exactly.
 */
export function splitSentences(text: string, max: number = CHUNK_LIMITS.close): string[] {
  const parts: string[] = []
  let current = ''
  const push = (piece: string) => {
    if (!current) current = piece
    else if (current.length + 1 + piece.length <= max) current += ` ${piece}`
    else {
      parts.push(current)
      current = piece
    }
  }
  for (let sentence of text.split(/(?<=[.!?…]["'”’)\]]*)\s+/)) {
    // A run-on with no boundary inside the limit breaks at the last space before it.
    while (sentence.length > max) {
      const cut = sentence.lastIndexOf(' ', max)
      if (cut <= 0) break
      push(sentence.slice(0, cut))
      sentence = sentence.slice(cut + 1)
    }
    if (sentence) push(sentence)
  }
  if (current) parts.push(current)
  return parts
}

interface OpenChunk {
  heading: string
  /** The chunk began at a heading block whose text lives in `heading`, not in the pieces. */
  headed: boolean
  b0: number
  b1: number
  pieces: string[]
  length: number
}

function append(chunk: OpenChunk, piece: string, index: number) {
  chunk.length += (chunk.pieces.length ? 1 : 0) + piece.length
  chunk.pieces.push(piece)
  chunk.b1 = index
}

/** Heading-scoped chunks for one record. Chunks never cross records. */
export function chunkBlocks(source: ChunkSource, kind: ChunkKind = 'body'): ChunkDraft[] {
  const { headingBreak, close, split, mergeTail } = CHUNK_LIMITS
  const closed: OpenChunk[] = []
  let open: OpenChunk | null = null
  let heading = ''
  const start = (b0: number, headed: boolean): OpenChunk => {
    const chunk: OpenChunk = { heading, headed, b0, b1: b0, pieces: [], length: 0 }
    open = chunk
    return chunk
  }
  const finish = () => {
    if (open) closed.push(open)
    open = null
  }

  source.blocks.forEach((block, index) => {
    const text = block.x.trim()
    if (!text) return
    if (block.t === 'h') {
      if (open && open.length >= headingBreak) finish()
      heading = text
      if (open) append(open, text, index) // a sub-heading inside a short section stays in its text
      else start(index, true)
      return
    }
    for (const unit of text.length > split ? splitSentences(text) : [text]) {
      if (open && open.length >= headingBreak && open.length + 1 + unit.length > split) finish()
      const chunk: OpenChunk = open ?? start(index, false)
      append(chunk, unit, index)
      if (chunk.length >= close) finish()
    }
  })
  finish()

  const tail = closed[closed.length - 1]
  if (closed.length > 1 && tail.length + (tail.headed ? tail.heading.length : 0) < mergeTail) {
    closed.pop()
    const previous = closed[closed.length - 1]
    if (tail.headed) append(previous, tail.heading, tail.b0)
    for (const piece of tail.pieces) append(previous, piece, tail.b1)
    previous.b1 = tail.b1
  }

  return closed.map((chunk, n) => {
    const text = chunk.pieces.join('\n')
    return {
      id: `${source.slug}#${n}`,
      slug: source.slug,
      kind,
      heading: chunk.heading,
      b0: chunk.b0,
      b1: chunk.b1,
      text,
      embedText: embedText(source.title, chunk.heading, text),
    }
  })
}

export interface CardSource {
  slug: string
  title: string
  description: string
  keywords: string[]
}

/** One record-level card: title + description + keywords. */
export function cardChunk(source: CardSource): ChunkDraft {
  const text = [
    source.description.trim(),
    source.keywords.length ? `Keywords: ${source.keywords.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  return {
    id: `${source.slug}#card`,
    slug: source.slug,
    kind: 'card',
    heading: '',
    b0: -1,
    b1: -1,
    text,
    embedText: embedText(source.title, '', text),
  }
}

/** lib/immersive/operatorData.ts panel shape, restated so this module stays dependency-free. */
export interface OperatorPanelSource {
  id: OperatorPanelId
  title: string
  blocks: { kind: 'heading' | 'paragraph' | 'item'; text: string; meta?: string }[]
}

/** Operator docs keep their route ids as slugs; their targets open the in-scene Data panel. */
export const OPERATOR_DOCS: { slug: string; panel: OperatorPanelId; title: string }[] = [
  { slug: 'about', panel: 'about', title: 'About Alex Welcing' },
  { slug: 'current-work', panel: 'work', title: 'Current Work: Active Research Threads' },
  { slug: 'pitch', panel: 'pitch', title: 'The Pitch: AI Product and Engineering' },
]

export function operatorTarget(panel: OperatorPanelId): RetrievalTarget {
  return { type: 'data', panel }
}

/** Panel blocks as record blocks; items keep their meta line ('Role — Company: text'). */
export function operatorBlocks(panel: OperatorPanelSource): RecordBlock[] {
  return panel.blocks.map((block) => {
    if (block.kind === 'heading') return { t: 'h', x: block.text }
    if (block.kind === 'paragraph') return { t: 'p', x: block.text }
    return { t: 'l', x: block.meta ? `${block.meta}: ${block.text}` : block.text }
  })
}

/** Hex prefix of a SHA-256 via Web Crypto, so it runs in Node, Workers and browsers alike. */
export async function sha256Hex(value: string | Uint8Array, hexChars = 16): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, hexChars)
}

/** Model-independent: hash = first 16 hex of sha256(chunkerVersion | embedText). */
export function chunkHash(text: string, chunkerVersion: string = CHUNKER_VERSION) {
  return sha256Hex(`${chunkerVersion}|${text}`)
}
