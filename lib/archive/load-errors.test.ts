import { describe, expect, it, vi } from 'vitest'
import { listRecords } from './load'
import type { ArchiveRecord, ArchiveSource } from './types'

function record(slug: string, date = '2026-01-01'): ArchiveRecord {
  return {
    slug,
    title: slug,
    date,
    description: '',
    type: 'article',
    minutes: 3,
    keywords: [],
    domains: [],
    mechanics: [],
    searchText: '',
    hero: null,
  }
}

describe('listRecords error policies', () => {
  it('preserves a source failure for strict callers', async () => {
    const failure = new Error('archive: HTTP 503')
    const source = { load: vi.fn().mockRejectedValue(failure) }

    await expect(listRecords(source, { throwOnError: true })).rejects.toBe(failure)
  })

  it('also rejects strict calls when the source throws synchronously', async () => {
    const failure = new Error('invalid index')
    const source: ArchiveSource = {
      load: () => {
        throw failure
      },
    }

    await expect(listRecords(source, { throwOnError: true })).rejects.toBe(failure)
  })

  it.each([true, false])(
    'shares a failed request while applying each caller policy (strict first: %s)',
    async (strictFirst) => {
      const failure = new Error('invalid full-record payload')
      let rejectLoad!: (error: Error) => void
      const pending = new Promise<ArchiveRecord[]>((_, reject) => {
        rejectLoad = reject
      })
      const source = { load: vi.fn().mockReturnValue(pending) }
      const first = listRecords(source, { throwOnError: strictFirst })
      const second = listRecords(source, { throwOnError: !strictFirst })
      const strict = strictFirst ? first : second
      const tolerant = strictFirst ? second : first
      const strictAssertion = expect(strict).rejects.toBe(failure)

      rejectLoad(failure)

      await strictAssertion
      expect(await tolerant).toEqual([])
      expect(source.load).toHaveBeenCalledTimes(1)
    }
  )

  it('evicts failed strict loads so a later tolerant caller can retry', async () => {
    const records = [record('recovered')]
    const source = {
      load: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(records),
    }

    await expect(listRecords(source, { throwOnError: true })).rejects.toThrow('offline')
    expect(await listRecords(source)).toEqual(records)
    expect(await listRecords(source, { throwOnError: true })).toEqual(records)
    expect(source.load).toHaveBeenCalledTimes(2)
  })

  it('evicts failed tolerant loads so a later strict caller can retry', async () => {
    const records = [record('recovered')]
    const source = {
      load: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(records),
    }

    expect(await listRecords(source)).toEqual([])
    expect(await listRecords(source, { throwOnError: true })).toEqual(records)
    expect(source.load).toHaveBeenCalledTimes(2)
  })

  it('treats a successful empty index as valid and cached for either policy', async () => {
    const source = { load: vi.fn().mockResolvedValue([]) }

    await expect(listRecords(source, { throwOnError: true })).resolves.toEqual([])
    expect(await listRecords(source)).toEqual([])
    expect(await listRecords(source, { throwOnError: true })).toEqual([])
    expect(source.load).toHaveBeenCalledTimes(1)
  })

  it('returns independent sorted arrays while sharing the successful cache', async () => {
    const input = [record('old', '2024-01-01'), record('new', '2026-01-01')]
    const source = { load: vi.fn().mockResolvedValue(input) }
    const [strict, tolerant] = await Promise.all([
      listRecords(source, { throwOnError: true }),
      listRecords(source),
    ])

    strict.pop()
    expect(tolerant.map((entry) => entry.slug)).toEqual(['new', 'old'])
    tolerant.reverse()
    expect((await listRecords(source, { throwOnError: true })).map((entry) => entry.slug)).toEqual([
      'new',
      'old',
    ])
    expect(input.map((entry) => entry.slug)).toEqual(['old', 'new'])
    expect(source.load).toHaveBeenCalledTimes(1)
  })
})
