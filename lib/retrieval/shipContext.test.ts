import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LocalArchiveQueryResult } from '../chat/archiveQuery'
import { ABOUT_PANEL, OPERATOR_PANELS } from '../immersive/operatorData'
import { buildSearchIndex, emitSearchIndex, type VectorSource } from './build'
import { CHUNKER_VERSION } from './chunk'
import { resetSearchIndexCache } from './load'
import { readBuildRecords } from './nodeSources'
import { SHIP_CONTEXT_LIMITS, getShipContext } from './shipContext'
import { FIXTURE_ARCHIVE, FIXTURE_RECORDS, fixtureIndex, randomVector, seeded } from './testing'
import type { RetrievalDeps, RetrievalResult, VectorSourceManifest } from './types'

const DIMS = 16
const MODEL = 'test-static-d16'
const REAL_SLUGS = new Set([
  ...FIXTURE_RECORDS.map((record) => record.slug),
  'about',
  'current-work',
  'pitch',
])

/** One random vector per chunk (f32 source, quantized at build); vectorOf(id) reads it back. */
async function denseFixture(extra: Partial<VectorSourceManifest> = {}) {
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
      manifest: {
        model: MODEL,
        dims: DIMS,
        quant: 'f32',
        chunkerVersion: CHUNKER_VERSION,
        hashes,
        ...extra,
      },
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

  it('stays lexical on a zero query vector instead of ranking the first chunks', async () => {
    const records = readBuildRecords()
    const input = { records, operatorPanels: Object.values(OPERATOR_PANELS) }
    const lexical = await buildSearchIndex(input)
    const hashes = lexical.chunks.chunks.map((chunk) => chunk.hash)
    const random = seeded(7)
    const floats = new Float32Array(hashes.length * DIMS)
    for (let row = 0; row < hashes.length; row++) floats.set(randomVector(random, DIMS), row * DIMS)
    const source: VectorSource = {
      manifest: { model: MODEL, dims: DIMS, quant: 'f32', chunkerVersion: CHUNKER_VERSION, hashes },
      bytes: new Uint8Array(floats.buffer),
    }
    const { assets, manifest } = await emitSearchIndex(
      await buildSearchIndex({ ...input, vectorSources: [source] })
    )
    const files = new Map(assets.map((asset) => [asset.path, asset.bytes]))
    const fetchAsset = async (path: string) => new Response(files.get(path) ?? null)
    // A static model's answer to a stop-word-only or all-unknown-token query.
    const zero: RetrievalDeps['embedQuery'] = async () => new Float32Array(DIMS)
    for (const query of ['raft leader election', 'is it', 'xqzv blorpt']) {
      const baseline = await getShipContext(query, { fetchAsset }, { manifest, model: MODEL })
      const result = await getShipContext(
        query,
        { fetchAsset, embedQuery: zero },
        { manifest, model: MODEL }
      )
      expect(result.mode).toBe('lexical')
      expect(result.fallbackReason).toBe('empty query embedding')
      expect(result.instantResults).toEqual(baseline.instantResults)
      expect(result.context).toBe(baseline.context)
    }
    const raft = await getShipContext(
      'raft leader election',
      { fetchAsset, embedQuery: zero },
      { manifest, model: MODEL }
    )
    expect(raft.instantResults[0].slug).toBe('tech-raft-consensus-distributed')
    for (const query of ['is it', 'xqzv blorpt']) {
      const nothing = await getShipContext(
        query,
        { fetchAsset, embedQuery: zero },
        { manifest, model: MODEL }
      )
      expect(nothing.instantResults).toEqual([])
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

  it('answers from records at once when the index is down, aborting the embedding', async () => {
    const { manifest } = await denseFixture()
    let aborted = false
    // Never settles unless aborted: awaiting it would hang past the test timeout.
    const embedQuery = (_q: string, signal: AbortSignal) =>
      new Promise<Float32Array>((_, reject) => {
        signal.addEventListener('abort', () => {
          aborted = true
          reject(new Error('aborted'))
        })
      })
    const result = await getShipContext(
      'photon polarization',
      { fetchAsset: () => Promise.reject(new Error('asset fetch failed')), embedQuery },
      { manifest, model: MODEL, records: FIXTURE_ARCHIVE, limits: { embedTimeoutMs: 60_000 } }
    )
    expect(result.mode).toBe('records')
    expect(result.fallbackReason).toMatch(/index unavailable: asset fetch failed/)
    expect(aborted).toBe(true)
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
    const result = await getShipContext(
      'zzz qqq',
      { fetchAsset, embedQuery },
      { manifest, model: MODEL }
    )
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
      { manifest, model: MODEL, records: FIXTURE_ARCHIVE, limits: { embedTimeoutMs: 30 } }
    )
  }

  it('falls back to lexical with the identical result on a zero query vector', async () => {
    const baseline = await lexicalOf()
    resetSearchIndexCache()
    const zero = await lexicalOf(async () => new Float32Array(DIMS))
    expect(zero.mode).toBe('lexical')
    expect(zero.fallbackReason).toBe('empty query embedding')
    expect({ ...zero, fallbackReason: undefined }).toEqual({
      ...baseline,
      fallbackReason: undefined,
    })
    resetSearchIndexCache()
    const broken = await lexicalOf(async () => new Float32Array(DIMS).fill(NaN))
    expect(broken.fallbackReason).toBe('query vector is not finite')
    expect(broken.instantResults).toEqual(baseline.instantResults)
  })

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

  it('falls back to lexical on a dims mismatch, an unknown model or an undeclared one', async () => {
    const short = await lexicalOf(async () => new Float32Array(DIMS - 1))
    expect(short.mode).toBe('lexical')
    expect(short.fallbackReason).toBe(
      `query vector has ${DIMS - 1} dims, the vector set has ${DIMS}`
    )
    resetSearchIndexCache()
    // A longer vector is another model unless the set is Matryoshka.
    const long = await lexicalOf(async () => new Float32Array(DIMS * 4).fill(1))
    expect(long.mode).toBe('lexical')
    expect(long.fallbackReason).toMatch(/has 64 dims, the vector set has 16 and is not Matryoshka/)

    const { manifest, fetchAsset } = await denseFixture()
    const embedQuery = vi.fn(async () => new Float32Array(DIMS))
    const other = await getShipContext(
      'agent',
      { fetchAsset, embedQuery },
      { manifest, model: 'other' }
    )
    expect(other.mode).toBe('lexical')
    expect(other.fallbackReason).toBe('no vector set for model other')
    const undeclared = await getShipContext('agent', { fetchAsset, embedQuery }, { manifest })
    expect(undeclared.mode).toBe('lexical')
    expect(undeclared.fallbackReason).toBe('no model declared for the query embedder')
    expect(embedQuery).not.toHaveBeenCalled()
  })

  it('truncates a longer query vector for a Matryoshka vector set', async () => {
    const { manifest, fetchAsset, vectorOf } = await denseFixture({ mrl: true })
    expect(manifest.vectors[0].mrl).toBe(true)
    const longer = new Float32Array(DIMS * 4)
    longer.set(vectorOf('the-last-cartographer#0'))
    longer.fill(0.5, DIMS)
    const result = await getShipContext(
      'zzz qqq',
      { fetchAsset, embedQuery: async () => longer },
      { manifest, model: MODEL }
    )
    expect(result.mode).toBe('hybrid')
    expect(result.instantResults[0].slug).toBe('the-last-cartographer')
  })

  it('does not wait for a slow vector asset, and uses it once it has loaded', async () => {
    const { manifest, fetchAsset, vectorOf, calls } = await denseFixture()
    const vecPath = manifest.vectors[0].asset
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let vecLoaded = Promise.resolve()
    const slowVectors = (path: string) => {
      if (path !== vecPath) return fetchAsset(path)
      const response = gate.then(() => fetchAsset(path))
      vecLoaded = response.then(() => undefined)
      return response
    }
    const deps = {
      fetchAsset: slowVectors,
      embedQuery: async () => vectorOf('the-last-cartographer#0'),
    }
    const options = { manifest, model: MODEL, limits: { embedTimeoutMs: 30 } }
    // The vector fetch is held open until after this returns, so returning proves no wait.
    const first = await getShipContext('zzz qqq', deps, options)
    expect(first.mode).toBe('lexical')
    expect(first.fallbackReason).toBe('vectors not ready after 30ms')
    release()
    await vecLoaded
    await new Promise((resolve) => setTimeout(resolve, 0))
    const second = await getShipContext('zzz qqq', deps, options)
    expect(second.mode).toBe('hybrid')
    expect(second.instantResults[0].slug).toBe('the-last-cartographer')
    expect(calls.filter((path) => path === vecPath)).toHaveLength(1)
  })

  it('stays lexical when the vector asset cannot load', async () => {
    const { manifest, fetchAsset, vectorOf } = await denseFixture()
    const withoutVectors = async (path: string) =>
      path === manifest.vectors[0].asset ? new Response('', { status: 500 }) : fetchAsset(path)
    const result = await getShipContext(
      'agent credentials',
      { fetchAsset: withoutVectors, embedQuery: async () => vectorOf('the-last-cartographer#0') },
      { manifest, model: MODEL }
    )
    expect(result.mode).toBe('lexical')
    expect(result.fallbackReason).toMatch(/vectors unavailable: .*HTTP 500/)
    expect(result.instantResults[0].slug).toBe('agent-authentication')
  })
})
