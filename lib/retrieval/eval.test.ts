import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { OPERATOR_DOCS } from './chunk'
import { evaluate, mrrAt, ndcgAt, parseQueries, recallAt } from './eval'
import { readBuildRecords } from './nodeSources'

describe('retrieval metrics', () => {
  const relevant = { a: 1, b: 1 }

  it('computes Recall@k over the relevant set', () => {
    expect(recallAt(['a', 'x', 'y', 'z', 'w', 'b'], relevant, 5)).toBe(0.5)
    expect(recallAt(['b', 'a'], relevant, 5)).toBe(1)
    expect(recallAt(['a', 'a', 'x', 'y', 'z', 'b'], relevant, 5)).toBe(1) // duplicates collapse
  })

  it('computes MRR@k from the first relevant rank', () => {
    expect(mrrAt(['x', 'b', 'a'], relevant, 10)).toBe(0.5)
    expect(mrrAt(['x', 'y'], relevant, 10)).toBe(0)
    expect(mrrAt(['x', 'y', 'a'], relevant, 2)).toBe(0)
  })

  it('computes graded nDCG@k', () => {
    expect(ndcgAt(['a', 'b'], relevant, 10)).toBeCloseTo(1)
    expect(ndcgAt(['x', 'a'], { a: 1 }, 10)).toBeCloseTo(1 / Math.log2(3))
    const graded = { a: 2, b: 1 }
    expect(ndcgAt(['b', 'a'], graded, 10)).toBeLessThan(ndcgAt(['a', 'b'], graded, 10))
    expect(ndcgAt([], graded, 10)).toBe(0)
  })

  it('parses JSONL with array or graded judgments and rejects bad lines', () => {
    const queries = parseQueries(
      [
        '// comment',
        '{"id":"q1","query":"who is alex","relevant":["about"],"tags":["profile"]}',
        '',
        '{"query":"maps","relevant":{"cartography-01-the-unnamed-continent":2,"x":0}}',
      ].join('\n'),
      'inline'
    )
    expect(queries).toEqual([
      { id: 'q1', query: 'who is alex', relevant: { about: 1 }, tags: ['profile'] },
      {
        id: 'inline:4',
        query: 'maps',
        relevant: { 'cartography-01-the-unnamed-continent': 2, x: 0 },
        tags: [],
      },
    ])
    expect(() => parseQueries('{"query":"x","relevant":[]}')).toThrow(/no relevant/)
    expect(() => parseQueries('{"relevant":["a"]}')).toThrow(/missing query/)
  })

  it('aggregates per configuration and per tag', async () => {
    const queries = parseQueries(
      [
        '{"id":"1","query":"one","relevant":["a"],"tags":["t1"]}',
        '{"id":"2","query":"two","relevant":["b"],"tags":["t2"]}',
      ].join('\n')
    )
    const report = await evaluate({ name: 'fixed', search: () => ['a', 'x', 'b'] }, queries)
    expect(report.all).toEqual({
      queries: 2,
      'recall@5': 1,
      'mrr@10': (1 + 1 / 3) / 2,
      'ndcg@10': expect.any(Number),
    })
    expect(report.byTag.t1['mrr@10']).toBe(1)
    expect(report.byTag.t2['mrr@10']).toBeCloseTo(1 / 3)
    expect(report.queries.map((query) => query.firstRelevant)).toEqual([1, 3])
  })
})

describe('eval/queries.seed.jsonl', () => {
  const file = path.join(process.cwd(), 'eval/queries.seed.jsonl')
  const queries = parseQueries(readFileSync(file, 'utf8'), 'seed')
  const slugs = new Set([
    ...readBuildRecords().map((record) => record.slug),
    ...OPERATOR_DOCS.map((doc) => doc.slug),
  ])

  it('holds about 60 uniquely identified, tagged queries', () => {
    expect(queries.length).toBeGreaterThanOrEqual(55)
    expect(new Set(queries.map((query) => query.id)).size).toBe(queries.length)
    for (const query of queries) expect(query.tags.length).toBeGreaterThan(0)
  })

  it('judges only real article slugs and operator ids', () => {
    for (const query of queries) {
      for (const slug of Object.keys(query.relevant)) {
        expect(slugs.has(slug), `${query.id}: ${slug}`).toBe(true)
      }
    }
  })
})
