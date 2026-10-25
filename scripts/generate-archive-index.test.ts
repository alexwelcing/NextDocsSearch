import { describe, expect, it } from 'vitest'
import { ARCHIVE_FULL_URL, ARCHIVE_URL } from '../lib/archive/http'
import { toSlim } from '../lib/archive/records'
import { BundledManifestSource } from '../lib/archive/server'
import { buildArchiveIndex, envelopeJson } from './generate-archive-index'

const manifest = [
  { slug: 'older', title: 'Older', date: '2024-12-23', description: 'x'.repeat(300) },
  { slug: 'newest', title: 'Newest', date: '2067-12-31', searchText: 'body text' },
  { slug: 'equal-b', title: 'Equal B', date: '2024-12-23' },
  { slug: 'equal-a', title: 'Equal A', date: '2024-12-23' },
]

describe('envelopeJson', () => {
  it('writes the API envelope as valid JSON with one record per line', () => {
    const records = [{ slug: 'a' }, { slug: 'b' }]
    const json = envelopeJson(records)

    expect(JSON.parse(json)).toEqual({ records, total: 2 })
    expect(json.split('\n')).toEqual([
      '{"records":[',
      '{"slug":"a"},',
      '{"slug":"b"}',
      '],"total":2}',
      '',
    ])
  })
})

describe('buildArchiveIndex', () => {
  it('writes the slim and full views of the same records in archive order', async () => {
    const { total, files } = await buildArchiveIndex(manifest)
    const full = JSON.parse(files[ARCHIVE_FULL_URL])
    const slim = JSON.parse(files[ARCHIVE_URL])

    expect(total).toBe(4)
    expect(full.records.map((r: { slug: string }) => r.slug)).toEqual([
      'newest',
      'equal-a',
      'equal-b',
      'older',
    ])
    expect(full).toEqual({
      records: expect.arrayContaining(await new BundledManifestSource(manifest).load()),
      total: 4,
    })
    expect(slim).toEqual({ records: full.records.map(toSlim), total: 4 })
    expect(slim.records[3].description).toHaveLength(220)
  })

  it('is deterministic, so the committed copies only change with the manifest', async () => {
    const reversed = [...manifest].reverse()
    expect(await buildArchiveIndex(reversed)).toEqual(await buildArchiveIndex(manifest))
  })

  it.each([[], {}, [{ title: 'Missing slug' }]])(
    'fails the build on a manifest like %j',
    async (value) => {
      await expect(buildArchiveIndex(value)).rejects.toThrow(/archive/)
    }
  )
})
