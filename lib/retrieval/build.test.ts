import { describe, expect, it } from 'vitest'
import { OPERATOR_PANELS } from '../immersive/operatorData'
import { buildSearchIndex, emitSearchIndex, type VectorSource } from './build'
import { CHUNKER_VERSION } from './chunk'
import { decodeInt8Rows, dequantizeRow, encodeInt8Rows, quantizeRows } from './quantize'
import { FIXTURE_RECORDS, cosine, randomVector, seeded } from './testing'

const input = { records: FIXTURE_RECORDS, operatorPanels: Object.values(OPERATOR_PANELS) }

/** A vector source covering `hashes` in the given (shuffled) order. */
function source(hashes: string[], dims: number, quant: 'int8-row' | 'f32' = 'int8-row') {
  const random = seeded(dims + hashes.length)
  const floats = new Float32Array(hashes.length * dims)
  for (let row = 0; row < hashes.length; row++) floats.set(randomVector(random, dims), row * dims)
  const bytes =
    quant === 'f32'
      ? new Uint8Array(floats.slice().buffer)
      : encodeInt8Rows(quantizeRows(floats.slice(), dims))
  const vectorSource: VectorSource = {
    manifest: {
      model: `test-${quant}-d${dims}`,
      dims,
      quant,
      chunkerVersion: CHUNKER_VERSION,
      hashes,
    },
    bytes,
  }
  return { vectorSource, floats }
}

describe('buildSearchIndex vector join', () => {
  it('aligns vectors to chunks by hash and reports chunks without one', async () => {
    const lexical = await buildSearchIndex(input)
    const chunks = lexical.chunks.chunks
    const covered = chunks
      .map((chunk) => chunk.hash)
      .filter((_, i) => i % 4 !== 0)
      .reverse()
    const { vectorSource, floats } = source(covered, 24)
    const built = await buildSearchIndex({ ...input, vectorSources: [vectorSource] })

    expect(built.chunks).toEqual(lexical.chunks)
    const [set] = built.vectors
    expect(set.entry).toMatchObject({
      model: 'test-int8-row-d24',
      dims: 24,
      quant: 'int8-row',
      rows: chunks.length,
      present: covered.length,
      hashes: built.hashes,
    })
    expect(set.missing).toEqual(chunks.filter((_, i) => i % 4 === 0).map((chunk) => chunk.id))
    expect(built.warnings.join('\n')).toMatch(/have no vector and stay lexical-only/)
    chunks.forEach((chunk, i) => {
      const row = covered.indexOf(chunk.hash)
      if (row < 0) {
        expect(set.matrix.scales[i]).toBe(0)
      } else {
        const original = floats.subarray(row * 24, (row + 1) * 24)
        expect(cosine(original, dequantizeRow(set.matrix, i))).toBeGreaterThan(0.99)
      }
    })
  })

  it('quantizes float32 sources at build time', async () => {
    const lexical = await buildSearchIndex(input)
    const hashes = lexical.chunks.chunks.map((chunk) => chunk.hash)
    const { vectorSource, floats } = source(hashes, 16, 'f32')
    const [set] = (await buildSearchIndex({ ...input, vectorSources: [vectorSource] })).vectors
    expect(set.entry.present).toBe(hashes.length)
    expect(cosine(floats.subarray(0, 16), dequantizeRow(set.matrix, 0))).toBeGreaterThan(0.99)
  })

  it('skips broken, stale and duplicate sources with a warning, never failing the build', async () => {
    const lexical = await buildSearchIndex(input)
    const hashes = lexical.chunks.chunks.map((chunk) => chunk.hash)
    const good = source(hashes, 8).vectorSource
    const truncated = { ...good, bytes: good.bytes.subarray(1) }
    const stale = source(['0000000000000000'], 8).vectorSource
    stale.manifest = { ...stale.manifest, model: 'stale', chunkerVersion: 'v0' }
    const built = await buildSearchIndex({
      ...input,
      vectorSources: [truncated, good, good, stale],
    })
    expect(built.vectors.map((set) => set.entry.model)).toEqual([good.manifest.model])
    const warnings = built.warnings.join('\n')
    expect(warnings).toMatch(/expected .* bytes/)
    expect(warnings).toMatch(/duplicate model/)
    expect(warnings).toMatch(/stale: built for chunker v0/)
    expect(warnings).toMatch(/stale: no chunk matched/)
  })

  it('stays lexical-only, with a warning, when no vectors exist', async () => {
    const built = await buildSearchIndex(input)
    expect(built.vectors).toEqual([])
    expect(built.warnings).toContain('no vector sets joined; the index is lexical-only')
  })

  it('emits content-hashed assets and a manifest that names them', async () => {
    const lexical = await buildSearchIndex(input)
    const hashes = lexical.chunks.chunks.map((chunk) => chunk.hash)
    const built = await buildSearchIndex({
      ...input,
      vectorSources: [source(hashes, 8).vectorSource],
    })
    const { assets, manifest } = await emitSearchIndex(built)
    expect(assets.map((asset) => asset.path)).toEqual([
      manifest.assets.chunks,
      manifest.assets.bm25,
      manifest.vectors[0].asset,
    ])
    expect(manifest.assets.chunks).toMatch(/^\/search\/chunks\.[0-9a-f]{12}\.json$/)
    expect(manifest.assets.bm25).toMatch(/^\/search\/bm25\.[0-9a-f]{12}\.json$/)
    expect(manifest.vectors[0].asset).toMatch(/^\/search\/vec\.[0-9a-f]{12}\.bin$/)
    expect(manifest).toMatchObject({
      schema: 1,
      chunkerVersion: CHUNKER_VERSION,
      docs: FIXTURE_RECORDS.length + 3,
      chunks: hashes.length,
      hashes: built.hashes,
    })
    const vec = assets[2].bytes
    expect(decodeInt8Rows(vec, hashes.length, 8)).toEqual(built.vectors[0].matrix)
    expect((await emitSearchIndex(built)).manifest).toEqual(manifest)
  })
})
