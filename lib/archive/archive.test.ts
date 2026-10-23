import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  HttpIndexSource,
  listRecords,
  searchRecords,
  toSlim,
  type ArchiveRecord,
  type ArchiveSource,
} from './index'

function record(slug: string, fields: Partial<ArchiveRecord> = {}): ArchiveRecord {
  return {
    slug,
    title: 'An archive entry',
    date: '2026-01-01',
    description: '',
    type: 'article',
    minutes: 3,
    keywords: [],
    domains: [],
    mechanics: [],
    searchText: '',
    hero: null,
    ...fields,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('toSlim', () => {
  it('projects exactly the existing dock fields and truncates only the projection', () => {
    const full = record('test', {
      description: 'x'.repeat(250),
      keywords: ['secret keyword'],
      searchText: 'The complete searchable body',
      hero: '/images/test.jpg',
      horizon: 'N5',
      polarity: 'P1',
    })

    expect(toSlim(full)).toEqual({
      slug: 'test',
      title: 'An archive entry',
      date: '2026-01-01',
      description: 'x'.repeat(220),
      type: 'article',
      minutes: 3,
    })
    expect(full.description).toHaveLength(250)
    expect(full.searchText).toBe('The complete searchable body')
  })
})

describe('listRecords', () => {
  it('sorts newest first without reordering the source array', async () => {
    const input = [record('old', { date: '2024-01-01' }), record('new', { date: '2026-01-01' })]
    const source = { load: vi.fn().mockResolvedValue(input) }

    expect((await listRecords(source)).map((r) => r.slug)).toEqual(['new', 'old'])
    expect(input.map((r) => r.slug)).toEqual(['old', 'new'])
  })

  it('shares concurrent and subsequent loads for the same source', async () => {
    let finish!: (records: ArchiveRecord[]) => void
    const pending = new Promise<ArchiveRecord[]>((resolve) => {
      finish = resolve
    })
    const source = { load: vi.fn().mockReturnValue(pending) }
    const first = listRecords(source)
    const second = listRecords(source)
    finish([record('cached')])

    expect(await first).toEqual([record('cached')])
    expect(await second).toEqual([record('cached')])
    expect(await listRecords(source)).toEqual([record('cached')])
    expect(source.load).toHaveBeenCalledTimes(1)
  })

  it('isolates caches by source identity, including successful empty loads', async () => {
    const absent = { load: vi.fn().mockResolvedValue([]) }
    const present = { load: vi.fn().mockResolvedValue([record('present')]) }

    expect(await listRecords(absent)).toEqual([])
    expect(await listRecords(present)).toEqual([record('present')])
    expect(await listRecords(absent)).toEqual([])
    expect(absent.load).toHaveBeenCalledTimes(1)
  })

  it('returns an empty result on failure and retries instead of caching the failure', async () => {
    const source = {
      load: vi
        .fn()
        .mockRejectedValueOnce(new Error('not built'))
        .mockResolvedValue([record('ready')]),
    }

    expect(await listRecords(source)).toEqual([])
    expect(await listRecords(source)).toEqual([record('ready')])
    expect(source.load).toHaveBeenCalledTimes(2)
  })

  it('also tolerates a source that throws before returning a promise', async () => {
    const source: ArchiveSource = {
      load: () => {
        throw new Error('unavailable')
      },
    }
    expect(await listRecords(source)).toEqual([])
  })
})

describe('HttpIndexSource', () => {
  it('explicitly requests full records and retains every search field', async () => {
    const full = record('rich', {
      description: 'd'.repeat(250),
      searchText: 'body-only evidence',
      keywords: ['keyword-only'],
      domains: ['domain-only'],
      mechanics: ['mechanic-only'],
    })
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ records: [full], total: 1 })))
    vi.stubGlobal('fetch', fetcher)

    expect(await new HttpIndexSource().load()).toEqual([full])
    const url = new URL(String(fetcher.mock.calls[0][0]), 'https://archive.test')
    expect(url.pathname).toBe('/api/arc/archive')
    expect(url.searchParams.get('view')).toBe('full')
  })

  it('preserves existing query parameters when selecting the full contract', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ records: [] })))
    vi.stubGlobal('fetch', fetcher)

    await new HttpIndexSource('/api/arc/archive?lang=en').load()
    const url = new URL(String(fetcher.mock.calls[0][0]), 'https://archive.test')
    expect(url.searchParams.get('lang')).toBe('en')
    expect(url.searchParams.get('view')).toBe('full')
  })

  it('rejects the slim response rather than inventing missing search information', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ records: [toSlim(record('slim'))], total: 1 }))
        )
    )

    await expect(new HttpIndexSource().load()).rejects.toThrow()
  })

  it.each([
    { records: null },
    { records: [record('bad', { keywords: 'keyword' as unknown as string[] })] },
    { records: [record('bad', { minutes: '3' as unknown as number })] },
    { records: [record('bad', { searchText: undefined as unknown as string })] },
  ])('rejects a malformed full-record payload: %j', async (payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))))
    await expect(new HttpIndexSource().load()).rejects.toThrow()
  })

  it('rejects unsuccessful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    await expect(new HttpIndexSource().load()).rejects.toThrow(/503/)
  })
})

describe('searchRecords', () => {
  it('weights title and metadata ahead of body matches', () => {
    const records = [
      record('body', { searchText: 'orbit' }),
      record('mechanic', { mechanics: ['orbit'] }),
      record('domain', { domains: ['orbit'] }),
      record('description', { description: 'orbit' }),
      record('keyword', { keywords: ['orbit'] }),
      record('title', { title: 'Orbit dynamics' }),
    ]

    expect(searchRecords(records, 'orbit signal').map((hit) => hit.record.slug)).toEqual([
      'title',
      'keyword',
      'description',
      'domain',
      'mechanic',
      'body',
    ])
  })

  it('boosts an exact title phrase and resolves equal scores newest first', () => {
    const records = [
      record('older', { title: 'Orbital flight', date: '2024-01-01' }),
      record('newer', { title: 'Orbital flight', date: '2026-01-01' }),
      record('phrase', { title: 'Flight orbital', date: '2023-01-01' }),
    ]

    expect(searchRecords(records, 'flight orbital').map((hit) => hit.record.slug)).toEqual([
      'phrase',
      'newer',
      'older',
    ])
  })

  it('normalizes punctuation and case, ignores stopwords, and counts query tokens once', () => {
    const records = [record('one', { title: 'Orbit dynamics', searchText: 'signal' })]

    expect(searchRecords(records, 'ORBIT, SIGNAL!')).toEqual(searchRecords(records, 'orbit signal'))
    expect(searchRecords(records, 'orbit orbit signal')).toEqual(
      searchRecords(records, 'orbit signal')
    )
    expect(searchRecords(records, 'the AI SHIP and Alex Welcing with')).toEqual([])
    expect(searchRecords(records, '  ')).toEqual([])
  })

  it('returns the best hit per slug and applies result limits after deduplication', () => {
    const better = record('same', { title: 'Orbit dynamics' })
    const records = [
      record('same', { description: 'orbit' }),
      better,
      record('second', { searchText: 'orbit' }),
    ]

    expect(searchRecords(records, 'orbit signal', 2).map((hit) => hit.record)).toEqual([
      better,
      records[2],
    ])
    expect(searchRecords(records, 'orbit signal', 1)).toHaveLength(1)
    expect(searchRecords(records, 'orbit signal', 0)).toEqual([])
    expect(searchRecords(records, 'orbit signal', -1)).toEqual([])
  })

  it('defaults to at most thirty hits and does not mutate the source', () => {
    const records = Array.from({ length: 40 }, (_, i) =>
      record(`entry-${i}`, { searchText: 'orbit' })
    )
    const original = records.slice()

    expect(searchRecords(records, 'orbit')).toHaveLength(30)
    expect(records).toEqual(original)
  })

  it('extracts a normalized body snippet around the earliest matching token', () => {
    const searchText = `${'padding '.repeat(80)}ORBIT\n\t signal ${'continuation '.repeat(80)}`
    const [hit] = searchRecords([record('body', { searchText })], 'orbit signal')

    expect(hit.snippet).toContain('ORBIT signal')
    expect(hit.snippet).toMatch(/^\.\.\. /)
    expect(hit.snippet).toMatch(/ \.\.\.$/)
    expect(hit.snippet).not.toMatch(/[\n\t]/)
    expect(hit.snippet.length).toBeLessThanOrEqual(470)
  })

  it('uses the description when no body is available', () => {
    const [hit] = searchRecords(
      [record('entry', { title: 'Orbit', description: 'A\n short\t description' })],
      'orbit'
    )
    expect(hit.snippet).toBe('A short description')
  })
})
