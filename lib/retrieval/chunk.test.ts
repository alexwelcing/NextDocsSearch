import { describe, expect, it } from 'vitest'
import { OPERATOR_PANELS } from '../immersive/operatorData'
import { buildSearchIndex, type BuildRecord } from './build'
import {
  CHUNKER_VERSION,
  CHUNK_LIMITS,
  cardChunk,
  chunkBlocks,
  chunkHash,
  embedText,
  operatorBlocks,
  splitSentences,
  type ChunkDraft,
  type RecordBlock,
} from './chunk'
import { readBuildRecords } from './nodeSources'

const records = readBuildRecords()

/** Rebuild the block sequence from chunks: a chunk starting at a heading holds it in `heading`. */
function piecesOf(blocks: RecordBlock[], chunks: ChunkDraft[]): string[] {
  return chunks.flatMap((chunk) => [
    ...(blocks[chunk.b0]?.t === 'h' ? [chunk.heading] : []),
    ...(chunk.text ? chunk.text.split('\n') : []),
  ])
}

describe('chunkBlocks on the real corpus', () => {
  it('reads every committed record', () => {
    expect(records.length).toBeGreaterThan(300)
  })

  it('is deterministic', () => {
    for (const record of records.slice(0, 40)) {
      expect(chunkBlocks(record)).toEqual(chunkBlocks(structuredClone(record)))
    }
  })

  it('covers every block exactly once, in order, without crossing records', () => {
    for (const record of records) {
      const chunks = chunkBlocks(record)
      const blocks = record.blocks.filter((block) => block.x.trim())
      expect(piecesOf(record.blocks, chunks)).toEqual(blocks.map((block) => block.x.trim()))
      chunks.forEach((chunk, i) => {
        expect(chunk.slug).toBe(record.slug)
        expect(chunk.id).toBe(`${record.slug}#${i}`)
        expect(chunk.b0).toBeLessThanOrEqual(chunk.b1)
        if (i > 0) expect(chunk.b0).toBe(chunks[i - 1].b1 + 1)
      })
      if (chunks.length) {
        expect(chunks[0].b0).toBe(0)
        expect(chunks[chunks.length - 1].b1).toBe(record.blocks.length - 1)
      }
    }
  })

  it('keeps chunks inside the v1 size bounds', () => {
    const { headingBreak, split, mergeTail } = CHUNK_LIMITS
    let total = 0
    for (const record of records) {
      const chunks = chunkBlocks(record)
      total += chunks.length
      chunks.forEach((chunk, i) => {
        const headed = record.blocks[chunk.b0]?.t === 'h' ? chunk.heading.length : 0
        // Never past split once a chunk holds headingBreak, plus one merged tail (2 separators).
        expect(chunk.text.length).toBeLessThanOrEqual(split + headingBreak + mergeTail + 2)
        if (i < chunks.length - 1) expect(chunk.text.length).toBeGreaterThanOrEqual(headingBreak)
        else if (i > 0) expect(chunk.text.length + headed).toBeGreaterThanOrEqual(mergeTail)
      })
    }
    expect(total).toBeGreaterThan(1800)
    expect(total).toBeLessThan(3200)
  })

  it('prefixes the embed text with the title and heading', () => {
    const [chunk] = chunkBlocks({
      slug: 's',
      title: 'Title',
      blocks: [
        { t: 'h', x: 'Section' },
        { t: 'p', x: 'Body.' },
      ],
    })
    expect(chunk).toMatchObject({ heading: 'Section', text: 'Body.', b0: 0, b1: 1 })
    expect(chunk.embedText).toBe('Title › Section\nBody.')
    expect(embedText('Title', '', 'Body.')).toBe('Title\nBody.')
  })
})

describe('chunkBlocks rules', () => {
  const sentence = (n: number) => `Sentence number ${n} has a few words in it and then it ends.`
  const long = Array.from({ length: 60 }, (_, i) => sentence(i)).join(' ')

  it('splits a block over the limit at sentence boundaries, losslessly', () => {
    expect(long.length).toBeGreaterThan(CHUNK_LIMITS.split)
    const parts = splitSentences(long)
    expect(parts.length).toBeGreaterThan(2)
    expect(parts.join(' ')).toBe(long)
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(CHUNK_LIMITS.close)
      expect(part.endsWith('ends.')).toBe(true)
    }

    const chunks = chunkBlocks({ slug: 'long', title: 'Long', blocks: [{ t: 'p', x: long }] })
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.map((chunk) => chunk.text.split('\n').join(' ')).join(' ')).toBe(long)
    for (const chunk of chunks) expect(chunk).toMatchObject({ b0: 0, b1: 0 })
  })

  it('breaks a run-on sentence at the last space before the limit', () => {
    const runOn = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ')
    const parts = splitSentences(runOn)
    expect(parts.join(' ')).toBe(runOn)
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(CHUNK_LIMITS.close)
  })

  it('closes at headings only once the open chunk holds enough text', () => {
    const blocks: RecordBlock[] = [
      { t: 'h', x: 'One' },
      { t: 'p', x: 'a'.repeat(120) },
      { t: 'h', x: 'Two' }, // open chunk is short: the sub-heading stays inside it
      { t: 'p', x: 'b'.repeat(320) },
      { t: 'h', x: 'Three' }, // now past headingBreak: closes and starts a new chunk
      { t: 'p', x: 'c'.repeat(500) },
    ]
    const chunks = chunkBlocks({ slug: 'h', title: 'H', blocks })
    expect(chunks.map((chunk) => [chunk.heading, chunk.b0, chunk.b1])).toEqual([
      ['One', 0, 3],
      ['Three', 4, 5],
    ])
    expect(chunks[0].text.split('\n')[1]).toBe('Two')
  })

  it('merges a short trailing chunk into the previous one', () => {
    const blocks: RecordBlock[] = [
      { t: 'p', x: 'a'.repeat(1100) },
      { t: 'h', x: 'Coda' },
      { t: 'p', x: 'short ending' },
    ]
    const chunks = chunkBlocks({ slug: 't', title: 'T', blocks })
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toMatchObject({ b0: 0, b1: 2 })
    expect(chunks[0].text.split('\n')).toEqual(['a'.repeat(1100), 'Coda', 'short ending'])
  })

  it('builds cards from title, description and keywords', () => {
    const card = cardChunk({
      slug: 'x',
      title: 'X',
      description: 'About x.',
      keywords: ['k1', 'k2'],
    })
    expect(card).toMatchObject({ id: 'x#card', kind: 'card', b0: -1, b1: -1 })
    expect(card.embedText).toBe('X\nAbout x.\nKeywords: k1, k2')
  })

  it('maps operator panel blocks, keeping item meta', () => {
    const blocks = operatorBlocks(OPERATOR_PANELS.about)
    expect(blocks[0]).toEqual({ t: 'h', x: 'IDENTITY' })
    expect(blocks[1].x).toMatch(/^Northeast AI product leader .*: Alex Welcing$/)
  })
})

describe('chunk hashes and the built index', () => {
  it('hashes the chunker version with the embed text', async () => {
    const hash = await chunkHash('Title\nBody')
    expect(hash).toMatch(/^[0-9a-f]{16}$/)
    expect(await chunkHash('Title\nBody')).toBe(hash)
    expect(await chunkHash('Title\nBody', 'v0')).not.toBe(hash)
    expect(CHUNKER_VERSION).toBe('v1')
  })

  it('emits one card per record plus the three operator docs', async () => {
    const sample: BuildRecord[] = records.slice(0, 25)
    const built = await buildSearchIndex({
      records: sample,
      operatorPanels: Object.values(OPERATOR_PANELS),
    })
    const { docs, chunks } = built.chunks
    expect(docs.map((doc) => doc.slug).slice(-3)).toEqual(['about', 'current-work', 'pitch'])
    expect(docs.slice(-3).map((doc) => doc.target)).toEqual([
      { type: 'data', panel: 'about' },
      { type: 'data', panel: 'work' },
      { type: 'data', panel: 'pitch' },
    ])
    for (const record of sample) {
      expect(chunks.filter((chunk) => chunk.id === `${record.slug}#card`)).toHaveLength(1)
    }
    const operator = chunks.filter((chunk) => chunk.kind === 'operator')
    expect(new Set(operator.map((chunk) => docs[chunk.doc].slug))).toEqual(
      new Set(['about', 'current-work', 'pitch'])
    )
    expect(new Set(chunks.map((chunk) => chunk.id)).size).toBe(chunks.length)
    expect(new Set(chunks.map((chunk) => chunk.hash)).size).toBe(chunks.length)

    const again = await buildSearchIndex({
      records: [...sample].reverse(),
      operatorPanels: Object.values(OPERATOR_PANELS),
    })
    expect(again.hashes).toBe(built.hashes)
    expect(again.chunks).toEqual(built.chunks)
  })
})
