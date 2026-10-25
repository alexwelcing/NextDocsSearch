import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { buildSearchIndex, emitSearchIndex } from '../retrieval/build'
import { queryVectorProblem } from '../retrieval/dense'
import { getShipContext } from '../retrieval/shipContext'
import { FIXTURE_ARCHIVE, FIXTURE_RECORDS } from '../retrieval/testing'
import { normalizedTokens } from '../retrieval/tokenize'
import type { RetrievalDeps } from '../retrieval/types'
import { OPERATOR_PANELS } from '../immersive/operatorData'
import {
  LEXEME_KIND,
  LEXEME_META_NAME,
  LexemeLexicon,
  createLexemeEmbedder,
  embedLexemes,
  foldLexemeText,
  halfToFloat,
  lexemeEvalPlugin,
  lexemeWords,
  loadLexemeBundle,
  ngramBuckets,
  parseLexemeBundle,
  tokenizeLexemes,
  type LexemeBundle,
  type LexemeBundleMeta,
  type LexemeToken,
} from './lexemeEmbed'

// Written by `python -m arcforge.models parity-fixtures` (research/arcforge/arcforge/models).
const FIXTURES = path.resolve(__dirname, '../../research/arcforge/fixtures/tokenizer')
const TOY = path.join(FIXTURES, 'toy')

type Stream = [number, number, number, number][]

interface ParityRecord {
  s: string
  h: string
  q?: Stream
  d?: Stream
}

const readFixture = (file: string) => new Uint8Array(readFileSync(file))

/** Serves the toy bundle the way env.ASSETS would, under /search/arc-lexeme/. */
function toyAssets(overrides: Record<string, Uint8Array> = {}) {
  const calls: string[] = []
  const fetchAsset: RetrievalDeps['fetchAsset'] = async (asset) => {
    calls.push(asset)
    const name = asset.replace('/search/arc-lexeme/', '')
    if (overrides[name]) return new Response(overrides[name])
    try {
      return new Response(readFixture(path.join(TOY, name)))
    } catch {
      return new Response('missing', { status: 404 })
    }
  }
  return { fetchAsset, calls }
}

const META_PATH = `/search/arc-lexeme/${LEXEME_META_NAME}`

let toyBundle: Promise<LexemeBundle> | undefined
const loadToy = () => (toyBundle ??= loadLexemeBundle(toyAssets().fetchAsset, META_PATH))

const stream = (tokens: LexemeToken[]): Stream => tokens.map((t) => [t.row, t.kind, t.w0, t.w1])
const digest = (tokens: Stream) =>
  createHash('sha256')
    .update(tokens.map((token) => token.join(',')).join(';'))
    .digest('hex')
    .slice(0, 8)

function readParity(): { header: Record<string, unknown>; records: ParityRecord[] } {
  // split('\n'), not a line regex: the strings may hold U+2028, which JSON leaves raw.
  const lines = gunzipSync(readFileSync(path.join(FIXTURES, 'parity.jsonl.gz')))
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
  return { header: JSON.parse(lines[0]), records: lines.slice(1).map((line) => JSON.parse(line)) }
}

describe('fold and split', () => {
  it('folds diacritics, ligatures, compatibility forms and undecomposed Latin letters', () => {
    expect(lexemeWords('Tomáš Tūhoe Solène')).toEqual(['tomas', 'tuhoe', 'solene'])
    expect(lexemeWords('straße ÆTHER Øresund Łódź Þórr Đorđe')).toEqual([
      'strasse',
      'aether',
      'oresund',
      'lodz',
      'thorr',
      'dorde',
    ])
    expect(lexemeWords('ﬁnd ＦＵＬＬ e\u0301te ½')).toEqual(['find', 'full', 'ete', '1', '2'])
    // Symbols split words instead of being spelled out by NFKD ('™' → 'TM').
    expect(lexemeWords('Pro™max')).toEqual(['pro', 'max'])
    expect(foldLexemeText('Plain ASCII, Only')).toBe('plain ascii, only')
  })

  it('keeps stop words and single characters for multiword matching', () => {
    expect(lexemeWords('The pause, a B-plan')).toEqual(['the', 'pause', 'a', 'b', 'plan'])
  })

  it("filters single words exactly like the site's normalizedTokens on ASCII text", async () => {
    const lexicon = (await loadToy()).lexicon
    const { records } = readParity()
    const ascii = records.map((record) => record.s).filter((s) => !/[^\x00-\x7f]/.test(s))
    expect(ascii.length).toBeGreaterThan(1000)
    for (const text of ascii) {
      expect(lexemeWords(text).filter((word) => lexicon.keeps(word))).toEqual(
        normalizedTokens(text)
      )
    }
  })
})

describe('lexicon.bin', () => {
  it('finds every key and nothing else', async () => {
    const { lexicon } = await loadToy()
    expect(lexicon.lookup('the pause')).toMatchObject({ kind: LEXEME_KIND.multiword })
    expect(lexicon.lookup('adaeze')).toMatchObject({ kind: LEXEME_KIND.alias })
    expect(lexicon.lookup('adaeze')?.candidates).toHaveLength(2)
    expect(lexicon.lookup('house')?.row).toBe(lexicon.lookup('home')?.row)
    for (const missing of ['', '0', 'aaaa', 'the', 'pause ', 'the paus', 'zzzz', 'zuriz', 'zurí']) {
      expect(lexicon.lookup(missing)).toBeNull()
    }
  })

  it('rejects a corrupt or truncated file', () => {
    const bytes = readFixture(path.join(TOY, 'lexicon.bin'))
    const badMagic = bytes.slice()
    badMagic[0] = 0
    expect(() => new LexemeLexicon(badMagic)).toThrow(/magic/)
    expect(() => new LexemeLexicon(bytes.subarray(0, bytes.length - 1))).toThrow(/truncated/)
  })

  it('hashes n-grams like the Python side (fnv1a32 over <word>)', async () => {
    const { lexicon } = await loadToy()
    const buckets = ngramBuckets('mail', lexicon.spec)
    // '<mail>' has 4 trigrams, 3 four-grams and 2 five-grams.
    expect(buckets).toHaveLength(9)
    expect(buckets.every((b) => b >= 0 && b < lexicon.spec.ngrams.buckets)).toBe(true)
  })
})

describe('tokenizer', () => {
  it('prefers the longest multiword, drops stop words and buckets unknown words', async () => {
    const { lexicon } = await loadToy()
    const tokens = tokenizeLexemes(lexicon, 'Hands of the Commons and the xyzzy')
    expect(tokens[0]).toMatchObject({ kind: LEXEME_KIND.multiword, w0: 0, w1: 4 })
    const buckets = tokens.slice(1)
    expect(buckets.every((t) => t.kind === LEXEME_KIND.bucket && t.w0 === 6)).toBe(true)
    expect(buckets.reduce((sum, t) => sum + t.weight, 0)).toBeCloseTo(1, 12)
  })

  it('keeps a shared name an alias in queries and rewrites it in documents', async () => {
    const { lexicon } = await loadToy()
    const nwosu = lexicon.lookup('adaeze nwosu')!.row
    const okonkwo = lexicon.lookup('adaeze okonkwo')!.row
    const alias = lexicon.lookup('adaeze')!.row
    const text = 'Adaeze Nwosu met Adaeze Okonkwo; later: Adaeze'
    expect(tokenizeLexemes(lexicon, text, 'query').at(-1)).toMatchObject({ row: alias })
    // The most recent mention wins, unless the person map says who the name means.
    expect(tokenizeLexemes(lexicon, text, 'document').at(-1)).toMatchObject({ row: okonkwo })
    expect(
      tokenizeLexemes(lexicon, text, 'document', new Map([[alias, nwosu]])).at(-1)
    ).toMatchObject({ row: nwosu, kind: LEXEME_KIND.entity })
    expect(tokenizeLexemes(lexicon, 'Adaeze, by the', 'document')).toEqual([
      { row: alias, kind: LEXEME_KIND.alias, w0: 0, w1: 1, weight: 1 },
    ])
  })

  it('reproduces the Python token streams on the 10k parity strings', async () => {
    const { lexicon } = await loadToy()
    const { header, records } = readParity()
    expect(records).toHaveLength(10_000)
    expect(header.lexicon_sha256).toBe(
      createHash('sha256')
        .update(readFixture(path.join(TOY, 'lexicon.bin')))
        .digest('hex')
    )
    const failures: string[] = []
    for (const [i, record] of records.entries()) {
      const q = stream(tokenizeLexemes(lexicon, record.s, 'query'))
      const d = stream(tokenizeLexemes(lexicon, record.s, 'document'))
      const qOk =
        digest(q) === record.h && (!record.q || JSON.stringify(q) === JSON.stringify(record.q))
      const dOk = record.d ? JSON.stringify(d) === JSON.stringify(record.d) : digest(d) === record.h
      if (!qOk || !dOk) {
        failures.push(`#${i} ${JSON.stringify(record.s)} ts=${JSON.stringify(qOk ? d : q)}`)
      }
    }
    expect(failures.slice(0, 5)).toEqual([])
  })
})

describe('bundle and embedding', () => {
  it('decodes float16 exactly', () => {
    expect(halfToFloat(0x3c00)).toBe(1)
    expect(halfToFloat(0xc000)).toBe(-2)
    expect(halfToFloat(0x7bff)).toBe(65504)
    expect(halfToFloat(0x0001)).toBe(2 ** -24)
    expect(halfToFloat(0x7c00)).toBe(Infinity)
    expect(halfToFloat(0x7e00)).toBeNaN()
  })

  it('matches the Python golden vectors to the bit', async () => {
    const bundle = await loadToy()
    const golden = JSON.parse(readFileSync(path.join(FIXTURES, 'golden.json'), 'utf8'))
    const { records } = readParity()
    expect(golden.dims).toBe(bundle.dims)
    expect(golden.cases.length).toBeGreaterThanOrEqual(100)
    for (const c of golden.cases) {
      const text = records[c.i].s
      const q = embedLexemes(bundle, text, 'query')
      const d = embedLexemes(bundle, text, 'document')
      expect(Array.from(q.vector)).toEqual(c.q.map(Math.fround))
      expect(Array.from(d.vector)).toEqual(c.d.map(Math.fround))
      expect(q.aliasPrompt).toBe(c.alias_prompt)
    }
  })

  it('embeds a query with nothing to look up as all zeros (no dense signal)', async () => {
    const bundle = await loadToy()
    for (const text of ['', 'the and of', '😀 ½']) {
      const { vector } = embedLexemes(bundle, text)
      expect(queryVectorProblem(vector, { dims: bundle.dims })).toBe('empty query embedding')
    }
    const { vector } = embedLexemes(bundle, 'calibration sickness')
    expect(queryVectorProblem(vector, { dims: bundle.dims })).toBeNull()
  })

  it('refuses files that do not match the meta', async () => {
    const meta = JSON.parse(readFileSync(path.join(TOY, LEXEME_META_NAME), 'utf8'))
    const tampered = readFixture(path.join(TOY, 'scales.f16'))
    tampered[0] ^= 1
    await expect(
      loadLexemeBundle(toyAssets({ 'scales.f16': tampered }).fetchAsset, META_PATH)
    ).rejects.toThrow(/sha256/)
    await expect(
      loadLexemeBundle(toyAssets().fetchAsset, META_PATH, { corpusId: 'another-snapshot' })
    ).rejects.toThrow(/corpus/)
    await expect(
      loadLexemeBundle(toyAssets().fetchAsset, '/search/elsewhere/arc-lexeme.meta.json')
    ).rejects.toThrow(/HTTP 404/)
    const files = Object.fromEntries(
      Object.entries(meta.files as LexemeBundleMeta['files']).map(([key, entry]) => [
        key,
        readFixture(path.join(TOY, entry!.path)),
      ])
    )
    expect(() => parseLexemeBundle({ ...meta, dims: meta.dims + 1 }, files as never)).toThrow()
    expect(() => parseLexemeBundle({ ...meta, schema: 'v0' }, files as never)).toThrow(/schema/)
  })
})

describe('RetrievalDeps.embedQuery', () => {
  it('loads the bundle once and embeds queries', async () => {
    const { fetchAsset, calls } = toyAssets()
    const embed = createLexemeEmbedder(fetchAsset, META_PATH)
    const bundle = await loadToy()
    const signal = new AbortController().signal
    const vector = await embed('The Fossil, calibration sickness', signal)
    expect(Array.from(vector)).toEqual(
      Array.from(embedLexemes(bundle, 'The Fossil, calibration sickness').vector)
    )
    const loads = calls.length
    await embed('zuri', signal)
    expect(calls.length).toBe(loads)
  })

  it('honours an aborted signal', async () => {
    const embed = createLexemeEmbedder(toyAssets().fetchAsset, '/search/abort/arc-lexeme.meta.json')
    const controller = new AbortController()
    controller.abort()
    await expect(embed('zuri', controller.signal)).rejects.toThrow()
  })

  it('serves hybrid retrieval through getShipContext', async () => {
    const plugin = lexemeEvalPlugin(TOY)
    const input = { records: FIXTURE_RECORDS, operatorPanels: Object.values(OPERATOR_PANELS) }
    const lexical = await buildSearchIndex(input)
    const sources = await plugin.vectorSources!({ built: lexical, input })
    const built = await buildSearchIndex({ ...input, vectorSources: sources })
    const { assets, manifest } = await emitSearchIndex(built)
    const bytes = new Map(assets.map((asset) => [asset.path, asset.bytes]))
    const fetchAsset: RetrievalDeps['fetchAsset'] = async (asset) =>
      bytes.has(asset) ? new Response(bytes.get(asset)) : new Response('missing', { status: 404 })
    const model = sources[0].manifest.model
    const result = await getShipContext(
      'quantum key distribution',
      { fetchAsset, embedQuery: plugin.embedders![model] },
      { manifest, records: FIXTURE_ARCHIVE, model }
    )
    expect(result.mode).toBe('hybrid')
    expect(result.instantResults[0].slug).toBe('quantum-key-distribution')
  })
})

describe('EvalPlugin', () => {
  it('embeds every chunk in memory and registers the query embedder', async () => {
    const plugin = lexemeEvalPlugin(TOY)
    const input = { records: FIXTURE_RECORDS, operatorPanels: Object.values(OPERATOR_PANELS) }
    const built = await buildSearchIndex(input)
    const [source] = await plugin.vectorSources!({ built, input })
    const bundle = await loadToy()
    expect(source.manifest).toMatchObject({
      model: 'arc-lexeme@toy',
      dims: bundle.dims,
      quant: 'f32',
      chunkerVersion: built.chunks.chunkerVersion,
      mrl: true,
    })
    expect(source.manifest.hashes).toEqual(built.chunks.chunks.map((chunk) => chunk.hash))
    expect(source.bytes.byteLength).toBe(built.chunks.chunks.length * bundle.dims * 4)
    expect(Object.keys(plugin.embedders!)).toEqual(['arc-lexeme@toy'])
    // A committed vector source for the same model wins over the in-memory one.
    const again = await lexemeEvalPlugin(TOY).vectorSources!({
      built,
      input: { ...input, vectorSources: [source] },
    })
    expect(again).toEqual([])
  })
})
