import type { NextApiRequest, NextApiResponse } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../pages/api/arc/archive'
import { HttpIndexSource, searchRecords, toSlim, type ArchiveRecord } from './index'
import { listRecords } from './server'

vi.mock('./server', () => ({ listRecords: vi.fn() }))

const fixture: ArchiveRecord[] = [
  {
    slug: 'rich',
    title: 'A complete record',
    date: '2026-10-22',
    description: 'A description with enough detail. '.repeat(10),
    type: 'fiction',
    minutes: 8,
    keywords: ['quantum'],
    domains: ['Governance'],
    mechanics: ['agency-multiplication'],
    searchText: 'The body alone mentions cartography.',
    hero: '/images/hero.jpg',
    horizon: 'N5',
    polarity: 'P1',
  },
]

async function request(query: NextApiRequest['query'] = {}) {
  const setHeader = vi.fn()
  const status = vi.fn()
  const json = vi.fn()
  const res = { setHeader, status, json }
  status.mockReturnValue(res)
  await handler({ query } as NextApiRequest, res as unknown as NextApiResponse)
  return { setHeader, status, body: json.mock.calls[0][0] }
}

beforeEach(() => vi.mocked(listRecords).mockResolvedValue(fixture))
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('/api/arc/archive compatibility', () => {
  it('keeps the dock envelope, status, cache header, and exact slim record fields', async () => {
    const { body, status, setHeader } = await request()

    expect(status).toHaveBeenCalledWith(200)
    expect(setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400'
    )
    expect(body).toEqual({ records: [toSlim(fixture[0])], total: 1 })
    expect(Object.keys(body.records[0])).toEqual([
      'slug',
      'title',
      'date',
      'description',
      'type',
      'minutes',
    ])
    expect(body.records[0].description).toHaveLength(220)
  })

  it('preserves the legacy newest-first and equal-date ordering without mutating loaded records', async () => {
    const records = [
      { ...fixture[0], slug: 'older', date: '2024-01-01' },
      { ...fixture[0], slug: 'first' },
      { ...fixture[0], slug: 'second' },
    ]
    vi.mocked(listRecords).mockResolvedValue(records)

    const { body } = await request()
    expect(body.records.map((r: ArchiveRecord) => r.slug)).toEqual(['second', 'first', 'older'])
    expect(records.map((r) => r.slug)).toEqual(['older', 'first', 'second'])
  })

  it('provides complete records only for an explicit full view', async () => {
    expect((await request({ view: 'full' })).body).toEqual({ records: fixture, total: 1 })
    expect((await request({ view: 'other' })).body.records).toEqual(fixture.map(toSlim))
    expect((await request({ view: ['full', 'full'] })).body.records).toEqual(fixture.map(toSlim))
  })

  it('returns the existing empty envelope when the manifest is absent', async () => {
    vi.mocked(listRecords).mockResolvedValue([])
    expect((await request()).body).toEqual({ records: [], total: 0 })
  })

  it('gives HTTP and server consumers identical rich-field search results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'https://archive.test')
        const { body } = await request({ view: url.searchParams.get('view') ?? undefined })
        return new Response(JSON.stringify(body))
      })
    )

    const browserRecords = await new HttpIndexSource().load()
    for (const query of ['cartography', 'quantum', 'governance', 'multiplication']) {
      const serverHits = searchRecords(fixture, query)
      expect(serverHits).toHaveLength(1)
      expect(searchRecords(browserRecords, query)).toEqual(serverHits)
    }
    expect(browserRecords[0].description).toBe(fixture[0].description)
  })
})
