import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listRecords, toSlim, type ArchiveRecord } from './index'
import { archiveOrder, BundledManifestSource, FsManifestSource } from './server'

let directory: string
let manifestPath: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'archive-test-'))
  manifestPath = path.join(directory, 'manifest.json')
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('FsManifestSource', () => {
  it('normalizes manifest metadata into complete records without trimming searchable text', async () => {
    const description = 'A long description. '.repeat(20)
    await writeFile(
      manifestPath,
      JSON.stringify([
        {
          slug: 'rich',
          title: 'Rich record',
          date: '2026-10-22',
          description,
          articleType: 'fiction',
          readingTime: '8',
          keywords: ['quantum'],
          domains: ['Computing'],
          mechanics: ['discovery-compression'],
          searchText: 'A full body containing otherwise invisible evidence.',
          heroImage: '/images/hero.jpg',
          horizon: 'N5',
          polarity: 'P1',
        },
      ])
    )

    const [record] = await listRecords(new FsManifestSource(manifestPath))
    expect(record).toEqual({
      slug: 'rich',
      title: 'Rich record',
      date: '2026-10-22',
      description,
      type: 'fiction',
      minutes: 8,
      keywords: ['quantum'],
      domains: ['Computing'],
      mechanics: ['discovery-compression'],
      searchText: 'A full body containing otherwise invisible evidence.',
      hero: '/images/hero.jpg',
      horizon: 'N5',
      polarity: 'P1',
    })
    expect(toSlim(record).description).toBe(description.slice(0, 220))
  })

  it('supplies full-contract defaults while preserving the dock minutes fallback', async () => {
    await writeFile(
      manifestPath,
      JSON.stringify([
        { slug: 'missing', title: 'Missing optional metadata' },
        { slug: 'empty', title: 'Empty description', description: '', readingTime: 0 },
        { slug: 'long', title: 'Long description', description: 'x'.repeat(900) },
      ])
    )

    const records = await listRecords(new FsManifestSource(manifestPath))
    expect(records.find((r) => r.slug === 'missing')).toEqual({
      slug: 'missing',
      title: 'Missing optional metadata',
      date: '',
      description: '',
      type: 'article',
      minutes: 3,
      keywords: [],
      domains: [],
      mechanics: [],
      searchText: '',
      hero: null,
    })
    expect(records.find((r) => r.slug === 'empty')?.minutes).toBe(1)
    expect(records.find((r) => r.slug === 'long')?.minutes).toBe(5)
  })

  it('tolerates an absent build artifact and retries when it becomes available', async () => {
    const source = new FsManifestSource(manifestPath)
    expect(await listRecords(source)).toEqual([])

    await writeFile(manifestPath, JSON.stringify([{ slug: 'ready', title: 'Ready' }]))
    expect((await listRecords(source)).map((r) => r.slug)).toEqual(['ready'])
  })

  it.each(['not JSON', '{}', '[{"title":"Missing slug"}]'])(
    'returns an empty list for an invalid manifest: %s',
    async (content) => {
      await writeFile(manifestPath, content)
      expect(await listRecords(new FsManifestSource(manifestPath))).toEqual([])
    }
  )
})

describe('BundledManifestSource', () => {
  const manifest = [
    {
      slug: 'rich',
      title: 'Rich record',
      date: '2026-10-22',
      articleType: 'fiction',
      readingTime: 8,
    },
    { slug: 'bare', title: 'Bare record' },
  ]

  it('normalizes an in-memory manifest exactly as the filesystem source does', async () => {
    await writeFile(manifestPath, JSON.stringify(manifest))
    const bundled = await new BundledManifestSource(manifest).load()

    expect(bundled).toEqual(await new FsManifestSource(manifestPath).load())
    expect(bundled.map((r) => [r.slug, r.type, r.minutes])).toEqual([
      ['rich', 'fiction', 8],
      ['bare', 'article', 3],
    ])
  })

  it.each([{}, null, [{ title: 'Missing slug' }]])(
    'rejects an invalid manifest: %j',
    async (value) => {
      await expect(new BundledManifestSource(value).load()).rejects.toThrow(/archive: invalid/)
      expect(await listRecords(new BundledManifestSource(value))).toEqual([])
    }
  )
})

describe('archiveOrder', () => {
  const entry = (slug: string, date: string) => ({ slug, date } as ArchiveRecord)

  it('lists newest first and breaks equal dates by slug, whatever the input order', () => {
    const expected = ['b', 'a-10', 'a-2', 'c', 'undated']
    const records = [
      entry('c', '2024-12-23'),
      entry('a-10', '2024-12-23'),
      entry('undated', ''),
      entry('a-2', '2024-12-23'),
      entry('b', '2067-12-31'),
    ]

    expect([...records].sort(archiveOrder).map((r) => r.slug)).toEqual(expected)
    expect(
      [...records]
        .reverse()
        .sort(archiveOrder)
        .map((r) => r.slug)
    ).toEqual(expected)
  })
})
