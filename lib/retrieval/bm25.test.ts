import { describe, expect, it } from 'vitest'
import { searchRecords } from '../archive/search'
import { buildBm25, loadBm25, searchBm25, type Bm25Fields } from './bm25'
import { FIXTURE_ARCHIVE } from './testing'
import { findMatch, foldText, matchingTermRange, normalizedTokens, queryTerms } from './tokenize'
import { readBuildRecords } from './nodeSources'

function index(docs: Bm25Fields[]) {
  return loadBm25(buildBm25(docs))
}

function matches(docs: Bm25Fields[], term: string): number[] {
  return searchBm25(index(docs), term, docs.length)
    .map((hit) => hit.doc)
    .sort((a, b) => a - b)
}

describe('tokenizer exports', () => {
  it('tokenizes ASCII exactly as FIND always has', () => {
    expect(normalizedTokens('The AI-driven VR headset, v2 and 3D!')).toEqual([
      'ai',
      'driven',
      'vr',
      'headset',
      'v2',
      '3d',
    ])
    expect(queryTerms('agents and Agents of the AI')).toEqual(['agents', 'ai'])
    expect(findMatch('she said the aim', 'ai')).toBe(-1)
    expect(findMatch('an ai-driven aim', 'ai')).toBe(3)
    expect(findMatch('agentic systems', 'agent')).toBe(0)
    expect(findMatch('a reagent', 'agent')).toBe(-1)
  })

  it('finds whole-word and prefix ranges in a sorted vocabulary', () => {
    const terms = ['agent', 'agentic', 'agents', 'ai', 'aim', 'said', 'vr', 'vrml']
    expect(matchingTermRange(terms, 'ai')).toEqual([3, 4])
    expect(matchingTermRange(terms, 'vr')).toEqual([6, 7])
    expect(matchingTermRange(terms, 'agent')).toEqual([0, 3])
    expect(matchingTermRange(terms, 'zebra')).toEqual([8, 8])
  })
})

describe('BM25 tokenization parity with searchRecords', () => {
  const texts = [
    'She said the aim was clear.',
    'An AI-driven roadmap for VR headsets.',
    'Agentic systems and agents.',
    'A reagent in the lab.',
    'vrml scenes and ai2 models',
    'Immersive VR and mixed reality.',
    'Solène met Tomáš in Tromsø, a naïve résumé of Tūhoe history.',
  ]
  const docs = texts.map((body) => ({ body }))
  const parity = (term: string) =>
    texts
      .map((text, i) => (findMatch(foldText(text), term) >= 0 ? i : -1))
      .filter((i) => i >= 0)

  it.each(['ai', 'vr', 'agent', 'agents', 'immers', 'reality', 'lab', 'solene', 'tomas', 'tromso',
    'naive', 'resum', 'tuhoe', 'sol', 'na', 'ne'])(
    "matches '%s' exactly where findMatch does",
    (term) => {
      expect(matches(docs, term)).toEqual(parity(term))
    }
  )

  it('agrees with findMatch over real records, accented names included', () => {
    const fields = readBuildRecords()
      .map((record) => ({
        title: record.title,
        body: record.blocks.map((block) => block.x).join(' '),
      }))
      // The first 60, plus every record with an accented Latin letter (Solène, Tomáš, Tūhoe, ...).
      .filter((doc, i) => i < 60 || /[\u00c0-\u024f]/.test(doc.body))
    const terms = ['ai', 'vr', 'agent', 'align', 'quantum', 'neural', 'cartograph', 'legal', 'eval']
    terms.push('solene', 'tomas', 'tuhoe', 'maori', 'tromso', 'lodz', 'cafe')
    const built = index(fields)
    const texts = fields.map((doc) => foldText(`${doc.title} ${doc.body}`))
    for (const term of terms) {
      const expected = texts
        .map((text, i) => (findMatch(text, term) >= 0 ? i : -1))
        .filter((i) => i >= 0)
      const found = searchBm25(built, term, fields.length).map((hit) => hit.doc)
      expect(found.sort((a, b) => a - b)).toEqual(expected)
    }
  })

  it('drops the same stop words and short tokens as FIND', () => {
    expect(searchBm25(index([{ body: 'the and of a' }]), 'the and of a', 10)).toEqual([])
    expect(searchRecords(FIXTURE_ARCHIVE, 'the and of a')).toEqual([])
  })
})

describe('BM25F scoring', () => {
  it('weights title over heading over body', () => {
    const hits = searchBm25(
      index([{ body: 'quantum notes' }, { heading: 'quantum notes' }, { title: 'quantum notes' }]),
      'quantum',
      10
    )
    expect(hits.map((hit) => hit.doc)).toEqual([2, 1, 0])
  })

  it('normalizes by field length and rewards matching more terms', () => {
    const hits = searchBm25(
      index([
        { body: `quantum ${'filler '.repeat(60)}` },
        { body: 'quantum keys' },
        { body: 'quantum key distribution keys' },
      ]),
      'quantum distribution',
      10
    )
    expect(hits.map((hit) => hit.doc)).toEqual([2, 1, 0])
    expect(hits[0].score).toBeGreaterThan(hits[1].score)
  })

  it('normalizes a field by the chunks that have it, so sparse fields keep their weight', () => {
    // Like the real index: keywords exist only on the card, body on every chunk.
    const words = (prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ')
    const card = { title: 'Card', keywords: `quantum ${words('kw', 27)}`, body: 'short card' }
    const bodies = Array.from({ length: 9 }, () => ({
      title: 'Article',
      body: `quantum ${words('word', 99)}`,
    }))
    const file = buildBm25([card, ...bodies])
    expect(file.avgLengths[file.fields.indexOf('keywords')]).toBe(28)
    const { norms } = loadBm25(file)
    const keywordNorm = norms[file.fields.indexOf('keywords')]
    expect(keywordNorm).toBeCloseTo(1)
    const hits = searchBm25(loadBm25(file), 'quantum', 10)
    expect(hits[0].doc).toBe(0)
    expect(hits[0].score).toBeGreaterThan(hits[1].score)
  })

  it('treats prefix expansions as one term', () => {
    const hits = searchBm25(
      index([{ body: 'agent agents agentic' }, { body: 'agent' }]),
      'agent',
      10
    )
    expect(hits.map((hit) => hit.doc)).toEqual([0, 1])
  })

  it('ignores the doc2query field until it has data, then uses it', () => {
    expect(searchBm25(index([{ body: 'x' }]), 'pricing', 5)).toEqual([])
    const hits = searchBm25(index([{ body: 'x', doc2query: 'how is pricing set' }]), 'pricing', 5)
    expect(hits).toHaveLength(1)
  })

  it('rejects postings built by another tokenizer', () => {
    const file = buildBm25([{ body: 'x' }])
    expect(() => loadBm25({ ...file, tokenizer: 'other' })).toThrow(/incompatible/)
  })
})
