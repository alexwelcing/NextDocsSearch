import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LocalArchiveQueryResult } from '../chat/archiveQuery'
import { ABOUT_PANEL, OPERATOR_PANELS } from '../immersive/operatorData'
import { buildSearchIndex, emitSearchIndex, type VectorSource } from './build'
import { CHUNKER_VERSION } from './chunk'
import { resetSearchIndexCache } from './load'
import { readBuildRecords } from './nodeSources'
import { SHIP_CONTEXT_LIMITS, getShipContext } from './shipContext'
import { FIXTURE_ARCHIVE, FIXTURE_RECORDS, fixtureIndex, randomVector, seeded } from './testing'
import type { RetrievalResult } from './types'

const DIMS = 16
const MODEL = 'test-static-d16'
const REAL_SLUGS = new Set([
  ...FIXTURE_RECORDS.map((record) => record.slug),
  'about',
  'current-work',
  'pitch',
])

/** One random vector per chunk (f32 source, quantized at build); vectorOf(id) reads it back. */
async function denseFixture() {
  const random = seeded(99)
  const rowsByHash = new Map<string, Float32Array>()
  const index = await fixtureIndex((hashes) => {
    const floats = new Float32Array(hashes.length * DIMS)
    hashes.forEach((hash, row) => {
      const vector = randomVector(random, DIMS)
      rowsByHash.set(hash, vector)
      floats.set(vector, row * DIMS)
    })
    const source: VectorSource = {
      manifest: { model: MODEL, dims: DIMS, quant: 'f32', chunkerVersion: CHUNKER_VERSION, hashes },
      bytes: new Uint8Array(floats.buffer),
    }
    return [source]
  })
  const vectorOf = (chunkId: string) => {
    const chunk = index.built.chunks.chunks.find((candidate) => candidate.id === chunkId)
    return rowsByHash.get(chunk?.hash ?? '') as Float32Array
  }
  return { ...index, vectorOf }
}

function sectionsOf(result: RetrievalResult) {
  return result.context
    .split('\n\n---\n\n')
    .filter(Boolean)
    .map((section) => /^Slug: (.*)$/m.exec(section)?.[1])
}

function expectShape(result: RetrievalResult) {
  const compatible: LocalArchiveQueryResult = result
  expect(Object.keys(compatible).sort()).toEqual(
    expect.arrayContaining(['context', 'instantResults', 'profileFacts', 'profileIntent'])
  )
  expect(result.context.length).toBeLessThanOrEqual(SHIP_CONTEXT_LIMITS.contextChars)
  expect(result.instantResults.length).toBeLessThanOrEqual(SHIP_CONTEXT_LIMITS.instantResults)
  const perSlug = new Map<string, number>()
  for (const slug of sectionsOf(result)) {
    expect(REAL_SLUGS.has(slug as string)).toBe(true)
    perSlug.set(slug as string, (perSlug.get(slug as string) ?? 0) + 1)
  }
  for (const count of perSlug.values()) expect(count).toBeLessThanOrEqual(2)
  for (const item of result.instantResults) {
    expect(REAL_SLUGS.has(item.slug)).toBe(true)
    expect(item.slug).not.toContain('#')
    expect(item.target).toEqual(
      ['about', 'current-work', 'pitch'].includes(item.slug)
        ? { type: 'data', panel: item.slug === 'current-work' ? 'work' : item.slug }
        : { type: 'article' }
    )
    expect(item).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        description: expect.any(String),
        snippet: expect.any(String),
        score: expect.any(Number),
        keywords: expect.any(Array),
        domains: expect.any(Array),
      })
    )
  }
}

afterEach(() => {
  resetSearchIndexCache()
  vi.useRealTimers()
})

describe('getShipContext lexical', () => {
  it('ranks chunk BM25 and records with real slugs and bounded context', async () => {
    const { manifest, fetchAsset } = await fixtureIndex()
    const result = await getShipContext(
      'photon polarization BB84',
      { fetchAsset },
      {
        manifest,
        records: FIXTURE_ARCHIVE,
      }
    )
    expectShape(result)
    expect(result.mode).toBe('lexical')
    expect(result.fallbackReason).toBe('no vector sets in the index')
    expect(result.instantResults[0]).toMatchObject({
      slug: 'quantum-key-distribution',
      articleType: 'research',
      target: { type: 'article' },
    })
    expect(result.instantResults[0].snippet.toLowerCase()).toContain('photon polarization')
    expect(result.context).toContain('Slug: quantum-key-distribution')
    expect(result.context).toContain('Heading: The BB84 Protocol')
    expect(result.profileIntent).toBe(false)
    expect(result.profileFacts).toEqual([])
  })

  it('caps context at two chunks per slug and 3,000 characters', async () => {
    const { manifest, fetchAsset } = await fixtureIndex()
    const result = await getShipContext('passage paragraph explains', { fetchAsset }, { manifest })
    expectShape(result)
    expect(sectionsOf(result).length).toBeGreaterThan(2)
  })

  it('answers profile intent with about-panel facts kept out of the context', async () => {
    const { manifest, fetchAsset, built } = await fixtureIndex()
    const result = await getShipContext('who is alex?', { fetchAsset }, { manifest })
    expectShape(result)
    expect(result.profileIntent).toBe(true)
    expect(result.profileFacts.length).toBeGreaterThan(0)
    expect(result.profileFacts.length).toBeLessThanOrEqual(3)
    expect(result.profileFacts[0]).toContain('Alex Welcing')
    const { docs, chunks } = built.chunks
    const about = chunks
      .filter((chunk) => docs[chunk.doc].slug === 'about')
      .map((chunk) => chunk.text.replace(/\s+/g, ' '))
    expect(about.join(' ')).toContain(ABOUT_PANEL.blocks[2].text)
    for (const fact of result.profileFacts) {
      const text = fact.replace(/ \.\.\.$/, '')
      expect(fact.length).toBeLessThanOrEqual(SHIP_CONTEXT_LIMITS.factChars)
      expect(about.some((chunk) => chunk.startsWith(text))).toBe(true)
      expect(result.context).not.toContain(text.slice(0, 120))
    }
    expect(result.instantResults[0]).toMatchObject({
      slug: 'about',
      target: { type: 'data', panel: 'about' },
    })
  })

  it('loads each asset once per isolate and never caches a failed load', async () => {
    const { manifest, fetchAsset, calls } = await fixtureIndex()
    let failNext = true
    const flaky = vi.fn(async (path: string) => {
      if (failNext) {
        failNext = false
        throw new Error('network down')
      }
      return fetchAsset(path)
    })
    const first = await getShipContext('quantum', { fetchAsset: flaky }, { manifest })
    expect(first.mode).toBe('none')
    await getShipContext('quantum', { fetchAsset: flaky }, { manifest })
    await getShipContext('agents', { fetchAsset: flaky }, { manifest })
    expect(calls.filter((path) => path === manifest.assets.chunks)).toHaveLength(1)
  })
})

describe('getShipContext on the real corpus', () => {
  it('only ever emits real article slugs or operator ids, within the bounds', async () => {
    const records = readBuildRecords()
    const built = await buildSearchIndex({
      records,
      operatorPanels: Object.values(OPERATOR_PANELS),
    })
    const { assets, manifest } = await emitSearchIndex(built)
    const files = new Map(assets.map((asset) => [asset.path, asset.bytes]))
    const fetchAsset = async (path: string) => new Response(files.get(path) ?? null)
    const real = new Set([
      ...records.map((record) => record.slug),
      'about',
      'current-work',
      'pitch',
    ])
    for (const query of [
      'who is alex welcing',
      'the cartography series',
      'EU AI Act deadlines',
      'raft leader election',
      'stories about grief',
    ]) {
      const result = await getShipContext(query, { fetchAsset }, { manifest })
      expect(result.mode).toBe('lexical')
      expect(result.instantResults.length).toBeGreaterThan(0)
      expect(result.context.length).toBeLessThanOrEqual(SHIP_CONTEXT_LIMITS.contextChars)
      const slugs = [
        ...result.instantResults.map((item) => item.slug),
        ...result.context.split('\n\n---\n\n').map((part) => /^Slug: (.*)$/m.exec(part)?.[1]),
      ]
      for (const slug of slugs) expect(real.has(slug as string), `${query}: ${slug}`).toBe(true)
    }
  })
})

describe('getShipContext fallback ladder', () => {
  it('falls back to record-level ranking when an asset load rejects', async () => {
    const { manifest } = await fixtureIndex()
    const result = await getShipContext(
      'photon polarization',
      { fetchAsset: () => Promise.reject(new Error('asset fetch failed')) },
      { manifest, records: FIXTURE_ARCHIVE }
    )
    expectShape(result)
    expect(result.mode).toBe('records')
    expect(result.fallbackReason).toMatch(/index unavailable: asset fetch failed/)
    expect(result.instantResults[0].slug).toBe('quantum-key-distribution')
  })

  it('treats a 404 or a manifest mismatch as unavailable, too', async () => {
    const { manifest, fetchAsset } = await fixtureIndex()
    const notFound = await getShipContext(
      'quantum',
      { fetchAsset: async () => new Response('gone', { status: 404 }) },
      { manifest, records: () => Promise.resolve(FIXTURE_ARCHIVE) }
    )
    expect(notFound.mode).toBe('records')
    resetSearchIndexCache()
    const stale = await getShipContext(
      'quantum',
      { fetchAsset },
      {
        manifest: { ...manifest, chunks: manifest.chunks + 1 },
        records: FIXTURE_ARCHIVE,
      }
    )
    expect(stale.mode).toBe('records')
    expect(stale.fallbackReason).toMatch(/do not match the manifest/)
  })

  it('returns an empty, well-formed result with nothing to search', async () => {
    const result = await getShipContext('quantum', {
      fetchAsset: () => Promise.reject(new Error('down')),
    })
    expect(result).toEqual({
      profileIntent: false,
      profileFacts: [],
      context: '',
      instantResults: [],
      mode: 'none',
      fallbackReason: 'no search manifest',
    })
  })
})

describe('getShipContext dense', () => {
  it('fuses dense hits when the embedder answers in time', async () => {
    const { manifest, fetchAsset, vectorOf } = await denseFixture()
    expect(manifest.vectors).toHaveLength(1)
    // The query has no lexical match, so only the dense list can find the target chunk.
    const embedQuery = vi.fn(async () => vectorOf('the-last-cartographer#0'))
    const result = await getShipContext('zzz qqq', { fetchAsset, embedQuery }, { manifest })
    expectShape(result)
    expect(result.mode).toBe('hybrid')
    expect(result.fallbackReason).toBeUndefined()
    expect(result.instantResults[0].slug).toBe('the-last-cartographer')
    expect(embedQuery).toHaveBeenCalledWith('zzz qqq', expect.any(AbortSignal))
  })

  const lexicalOf = async (
    embedQuery?: (q: string, signal: AbortSignal) => Promise<Float32Array>
  ) => {
    const { manifest, fetchAsset } = await denseFixture()
    return getShipContext(
      'agent credentials',
      { fetchAsset, ...(embedQuery ? { embedQuery } : {}) },
      { manifest, records: FIXTURE_ARCHIVE, limits: { embedTimeoutMs: 30 } }
    )
  }

  it('falls back to lexical with the identical result when embedQuery throws', async () => {
    const baseline = await lexicalOf()
    resetSearchIndexCache()
    const failed = await lexicalOf(async () => {
      throw new Error('AI binding error')
    })
    expect(failed.mode).toBe('lexical')
    expect(failed.fallbackReason).toBe('query embedding failed: AI binding error')
    expect({ ...failed, fallbackReason: undefined }).toEqual({
      ...baseline,
      fallbackReason: undefined,
    })
    expectShape(failed)
  })

  it('falls back to lexical when embedQuery misses the deadline, aborting it', async () => {
    const baseline = await lexicalOf()
    resetSearchIndexCache()
    let aborted = false
    const slow = await lexicalOf(
      (_q, signal) =>
        new Promise((resolve) => {
          signal.addEventListener('abort', () => {
            aborted = true
          })
          setTimeout(() => resolve(new Float32Array(DIMS)), 500)
        })
    )
    expect(slow.mode).toBe('lexical')
    expect(slow.fallbackReason).toBe('query embedding failed: timed out after 30ms')
    expect(aborted).toBe(true)
    expect(slow.instantResults).toEqual(baseline.instantResults)
    expect(SHIP_CONTEXT_LIMITS.embedTimeoutMs).toBe(800)
  })

  it('falls back to lexical on a dims mismatch or an unknown model', async () => {
    const short = await lexicalOf(async () => new Float32Array(DIMS - 1))
    expect(short.mode).toBe('lexical')
    expect(short.fallbackReason).toMatch(/dense scan failed/)

    const { manifest, fetchAsset } = await denseFixture()
    const embedQuery = vi.fn(async () => new Float32Array(DIMS))
    const other = await getShipContext(
      'agent',
      { fetchAsset, embedQuery },
      { manifest, model: 'other' }
    )
    expect(other.mode).toBe('lexical')
    expect(other.fallbackReason).toBe('no vector set for model other')
    expect(embedQuery).not.toHaveBeenCalled()
  })

  it('stays lexical when the vector asset cannot load', async () => {
    const { manifest, fetchAsset, vectorOf } = await denseFixture()
    const withoutVectors = async (path: string) =>
      path === manifest.vectors[0].asset ? new Response('', { status: 500 }) : fetchAsset(path)
    const result = await getShipContext(
      'agent credentials',
      { fetchAsset: withoutVectors, embedQuery: async () => vectorOf('the-last-cartographer#0') },
      { manifest }
    )
    expect(result.mode).toBe('lexical')
    expect(result.fallbackReason).toMatch(/vectors unavailable: .*HTTP 500/)
    expect(result.instantResults[0].slug).toBe('agent-authentication')
  })
})
