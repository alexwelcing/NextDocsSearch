import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listRecords, toSlim } from './index'
import { FsManifestSource } from './server'

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
