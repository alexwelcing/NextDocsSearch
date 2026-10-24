import { describe, expect, it } from 'vitest'
import { RRF_K, RRF_WEIGHTS, byDateThenSlug, fuseRrf } from './rrf'

describe('fuseRrf', () => {
  it('scores weight / (k + rank) summed across lists', () => {
    const fused = fuseRrf([
      { name: 'dense', weight: 1, keys: ['a', 'b', 'c'] },
      { name: 'bm25', weight: 1, keys: ['c', 'a'] },
      { name: 'records', weight: 0.5, keys: ['d'] },
    ])
    expect(fused.map((hit) => hit.key)).toEqual(['a', 'c', 'b', 'd'])
    expect(fused[0].score).toBeCloseTo(1 / (RRF_K + 1) + 1 / (RRF_K + 2))
    expect(fused[3].score).toBeCloseTo(0.5 / (RRF_K + 1))
    expect(RRF_K).toBe(60)
    expect(RRF_WEIGHTS).toEqual({ dense: 1, bm25: 1, records: 0.5 })
  })

  it('counts a repeated key once, at its first rank, and skips zero-weight lists', () => {
    const fused = fuseRrf([
      { name: 'x', weight: 1, keys: ['a', 'a', 'b'] },
      { name: 'off', weight: 0, keys: ['z'] },
    ])
    expect(fused).toEqual([
      { key: 'a', score: 1 / (RRF_K + 1) },
      { key: 'b', score: 1 / (RRF_K + 2) },
    ])
  })

  it('breaks ties like searchRecords: newer date first, then slug', () => {
    const meta: Record<string, { date: string; slug: string }> = {
      old: { date: '2024-01-01', slug: 'old' },
      newer: { date: '2026-01-01', slug: 'newer' },
      'b-same': { date: '2025-01-01', slug: 'b-same' },
      'a-same': { date: '2025-01-01', slug: 'a-same' },
    }
    // Every key sits at rank 1 of its own list, so every score ties.
    const fused = fuseRrf(
      Object.keys(meta).map((key) => ({ name: key, weight: 1, keys: [key] })),
      { compare: byDateThenSlug((key) => meta[key]) }
    )
    expect(fused.map((hit) => hit.key)).toEqual(['newer', 'a-same', 'b-same', 'old'])
  })

  it('orders keys that share a slug with the final comparator', () => {
    const doc = { date: '2025-01-01', slug: 'same' }
    const keys = ['1000', '999', '10']
    const lists = keys.map((key) => ({ name: key, weight: 1, keys: [key] }))
    const numeric = (a: string, b: string) => Number(a) - Number(b)
    expect(fuseRrf(lists, { compare: byDateThenSlug(() => doc) }).map((hit) => hit.key)).toEqual([
      '10',
      '1000',
      '999',
    ])
    expect(
      fuseRrf(lists, { compare: byDateThenSlug(() => doc, numeric) }).map((hit) => hit.key)
    ).toEqual(['10', '999', '1000'])
  })
})
