import { describe, expect, it } from 'vitest'
import { denseTopK } from './dense'
import {
  decodeFloat32Rows,
  decodeInt8Rows,
  dequantizeRow,
  encodeInt8Rows,
  normalize,
  quantizeRow,
  quantizeRows,
  truncateNormalize,
} from './quantize'
import { cosine, randomVector, seeded } from './testing'

describe('int8 per-row quantization', () => {
  it.each([37, 256, 512, 1024])('round-trips %i-dim vectors with cosine error < 0.01', (dims) => {
    const random = seeded(dims)
    const rows = 64
    const vectors = new Float32Array(rows * dims)
    for (let row = 0; row < rows; row++) vectors.set(randomVector(random, dims), row * dims)
    const matrix = quantizeRows(vectors.slice(), dims)
    for (let row = 0; row < rows; row++) {
      const original = vectors.subarray(row * dims, (row + 1) * dims)
      expect(1 - cosine(original, dequantizeRow(matrix, row))).toBeLessThan(0.01)
    }
  })

  it('encodes and decodes the on-disk layout exactly', () => {
    const random = seeded(7)
    const matrix = quantizeRows(randomVector(random, 3 * 5), 5)
    const bytes = encodeInt8Rows(matrix)
    expect(bytes.byteLength).toBe(3 * 5 + 3 * 4)
    expect(decodeInt8Rows(bytes, 3, 5)).toEqual(matrix)
    // A view at an odd offset still decodes (scales are copied, not aliased).
    const padded = new Uint8Array(bytes.byteLength + 1)
    padded.set(bytes, 1)
    expect(decodeInt8Rows(padded.subarray(1), 3, 5)).toEqual(matrix)
    expect(() => decodeInt8Rows(bytes, 4, 5)).toThrow(/expected/)
  })

  it('decodes little-endian float32 rows', () => {
    const rows = Float32Array.from([0.5, -1, 2, 0.25])
    expect(decodeFloat32Rows(new Uint8Array(rows.buffer), 2, 2)).toEqual(rows)
    expect(() => decodeFloat32Rows(new Uint8Array(rows.buffer), 3, 2)).toThrow()
  })

  it('gives zero rows a zero scale', () => {
    const out = new Int8Array(4)
    expect(quantizeRow([0, 0, 0, 0], out)).toBe(0)
    expect(quantizeRow([Number.NaN, 1, 0, 0], out)).toBe(0)
  })

  it('truncates Matryoshka-style and renormalizes', () => {
    const [x, y] = truncateNormalize([3, 4, 12, 0], 2)
    expect(x).toBeCloseTo(0.6, 6)
    expect(y).toBeCloseTo(0.8, 6)
    expect(() => truncateNormalize([1], 2)).toThrow(/dims/)
    expect(Array.from(normalize(new Float32Array(3)))).toEqual([0, 0, 0])
  })
})

describe('denseTopK', () => {
  const dims = 64
  const random = seeded(42)
  const rows = 300
  const vectors = new Float32Array(rows * dims)
  for (let row = 0; row < rows; row++) vectors.set(randomVector(random, dims), row * dims)
  const matrix = quantizeRows(vectors.slice(), dims)

  it('ranks rows like an exact scan over the dequantized matrix', () => {
    const query = normalize(randomVector(random, dims))
    const dot = (a: Float32Array, b: Float32Array) => a.reduce((sum, v, i) => sum + v * b[i], 0)
    const exact = Array.from({ length: rows }, (_, row) => ({
      row,
      score: dot(query, dequantizeRow(matrix, row)),
    })).sort((a, b) => b.score - a.score)
    const hits = denseTopK(matrix, query, 10)
    expect(hits.map((hit) => hit.row)).toEqual(exact.slice(0, 10).map((hit) => hit.row))
    for (let i = 0; i < hits.length; i++) expect(hits[i].score).toBeCloseTo(exact[i].score, 4)
  })

  it('finds a stored vector as its own nearest neighbour', () => {
    const row = 123
    const query = vectors.slice(row * dims, (row + 1) * dims)
    const [best] = denseTopK(matrix, query, 1)
    expect(best.row).toBe(row)
    expect(best.score).toBeGreaterThan(0.99)
  })

  it('skips missing rows, applies the floor, and truncates longer queries', () => {
    const sparse = { ...matrix, scales: matrix.scales.slice() }
    sparse.scales.fill(0, 1)
    const query = vectors.slice(0, dims)
    expect(denseTopK(sparse, query, 5).map((hit) => hit.row)).toEqual([0])
    expect(denseTopK(matrix, query, 50, 0.5).every((hit) => hit.score >= 0.5)).toBe(true)
    const longer = new Float32Array(dims * 2)
    longer.set(query)
    expect(denseTopK(matrix, longer, 1)[0].row).toBe(0)
    expect(() => denseTopK(matrix, query.subarray(0, dims - 1), 1)).toThrow()
    expect(denseTopK(matrix, query, 0)).toEqual([])
  })
})
