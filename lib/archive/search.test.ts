import { afterEach, describe, expect, it } from 'vitest'
import { OPERATOR_PANELS } from '../immersive/operatorData'
import { buildSearchIndex, emitSearchIndex, type BuildRecord } from '../retrieval/build'
import { loadCoreIndex, resetSearchIndexCache } from '../retrieval/load'
import { compareTitleThenSlug, searchFullText, searchRecords } from './search'
import type { ArchiveRecord } from './types'

// The article manifest's searchText is a preview (scripts/generate-article-manifest.ts).
const PREVIEW_CHARS = 2400

const filler = (topic: string, n: number) =>
  Array.from(
    { length: n },
    (_, i) =>
      `Paragraph ${i} about ${topic} keeps going in plain words, long enough to fill out a ` +
      `realistic block of archive text before anything distinctive turns up at all.`
  )

function buildRecord(slug: string, fields: Partial<BuildRecord> = {}): BuildRecord {
  return {
    slug,
    title: `Entry ${slug}`,
    date: '2026-01-01',
    description: `A record about ${slug}.`,
    type: 'research',
    keywords: [],
    domains: [],
    blocks: filler('weather stations', 2).map((x) => ({ t: 'p' as const, x })),
    ...fields,
  }
}

/** The manifest's view of a record: metadata plus a truncated searchText. */
function archiveRecord(record: BuildRecord): ArchiveRecord {
  return {
    slug: record.slug,
    title: record.title,
    date: record.date,
    description: record.description,
    type: record.type ?? 'article',
    minutes: 4,
    keywords: record.keywords ?? [],
    domains: record.domains ?? [],
    mechanics: [],
    searchText: record.blocks
      .map((block) => block.x)
      .join(' ')
      .slice(0, PREVIEW_CHARS),
    hero: null,
  }
}

async function corpus(records: BuildRecord[]) {
  const built = await buildSearchIndex({ records, operatorPanels: Object.values(OPERATOR_PANELS) })
  const { assets, manifest } = await emitSearchIndex(built)
  const files = new Map(assets.map((asset) => [asset.path, asset.bytes]))
  const index = await loadCoreIndex(manifest, async (path) => new Response(files.get(path)))
  return { index, records: records.map(archiveRecord) }
}

afterEach(() => resetSearchIndexCache())

describe('searchFullText', () => {
  const deep = buildRecord('deep', {
    title: 'First Cartographers',
    blocks: [
      ...filler('survey equipment', 30).map((x) => ({ t: 'p' as const, x })),
      { t: 'h', x: 'The Ward' },
      { t: 'p', x: 'Solène named it the calibration sickness, and the name stuck.' },
    ],
  })

  it('finds words past the manifest preview that searchRecords cannot see', async () => {
    const { index, records } = await corpus([deep, buildRecord('other')])
    expect(records[0].searchText).not.toContain('calibration')

    expect(searchRecords(records, 'calibration sickness')).toEqual([])
    const [hit, ...rest] = searchFullText(index, records, 'calibration sickness')
    expect(rest).toEqual([])
    expect(hit.record).toBe(records[0])
    expect(hit.snippet).toContain('calibration sickness')
  })

  it('matches accented names typed with or without their accents, and as prefixes', async () => {
    const { index, records } = await corpus([deep, buildRecord('other')])
    for (const query of ['Solène', 'solene', 'SOLENE', 'solen']) {
      const hits = searchFullText(index, records, query)
      expect(hits.map((hit) => hit.record.slug)).toEqual(['deep'])
      expect(hits[0].snippet).toContain('Solène named it')
    }
  })

  it('ranks each record once, by its best chunk', async () => {
    const strong = buildRecord('strong', {
      title: 'Orbital Debris',
      blocks: [{ t: 'p', x: `Orbital debris tracking. ${filler('debris', 1)}` }],
    })
    const weak = buildRecord('weak', {
      blocks: [
        ...filler('fisheries', 6).map((x) => ({ t: 'p' as const, x })),
        { t: 'p', x: 'A passing mention of debris.' },
      ],
    })
    const { index, records } = await corpus([weak, strong])
    const hits = searchFullText(index, records, 'debris')

    expect(hits.map((hit) => hit.record.slug)).toEqual(['strong', 'weak'])
    expect(hits[0].score).toBeGreaterThan(hits[1].score)
  })

  it('lists only the records it is given, never the operator panels', async () => {
    const { index, records } = await corpus([buildRecord('other')])
    expect(index.docs.some((doc) => doc.slug === 'about')).toBe(true)

    expect(searchFullText(index, records, 'operator dossier welcing')).toEqual([])
    expect(searchFullText(index, [], 'weather')).toEqual([])
  })

  it('returns nothing for empty or stop-word queries and honours the limit', async () => {
    const { index, records } = await corpus(['a', 'b', 'c'].map((slug) => buildRecord(slug)))

    expect(searchFullText(index, records, '  ')).toEqual([])
    expect(searchFullText(index, records, 'the and of')).toEqual([])
    expect(searchFullText(index, records, 'weather', 0)).toEqual([])
    expect(searchFullText(index, records, 'weather', Number.NaN)).toEqual([])
    expect(searchFullText(index, records, 'weather', 2)).toHaveLength(2)
    expect(searchFullText(index, records, 'weather')).toHaveLength(3)
  })

  it('breaks equal scores by title, then slug, never by date', async () => {
    const twin = (slug: string, title: string, date: string) =>
      buildRecord(slug, { title, date, description: 'Field notes.' })
    const { index, records } = await corpus([
      twin('far-shore-06', 'Zeta: The Last Handshake', '2067-12-31'),
      twin('b-report', 'Alpha Report', '2024-03-01'),
      twin('a-report', 'Alpha Report', '2025-06-01'),
    ])
    const hits = searchFullText(index, records, 'weather stations')

    expect(new Set(hits.map((hit) => hit.score)).size).toBe(1)
    expect(hits.map((hit) => hit.record.slug)).toEqual(['a-report', 'b-report', 'far-shore-06'])
  })
})

describe('searchRecords tiebreak', () => {
  const record = (slug: string, title: string, date: string): ArchiveRecord =>
    archiveRecord(buildRecord(slug, { title, date }))

  it('orders equal scores by title, then slug, so future-dated fiction gets no lift', () => {
    const records = [
      record('far-shore-06', 'The Last Handshake', '2067-12-31'),
      record('scarcity-inversion', 'Scarcity Inversion', '2025-02-01'),
      record('b-same', 'Same Title', '2030-01-01'),
      record('a-same', 'Same Title', '2024-01-01'),
    ]
    const hits = searchRecords(records, 'weather stations')

    expect(new Set(hits.map((hit) => hit.score)).size).toBe(1)
    expect(hits.map((hit) => hit.record.slug)).toEqual([
      'a-same',
      'b-same',
      'scarcity-inversion',
      'far-shore-06',
    ])
  })

  it('still ranks a better score first, whatever the title', () => {
    const records = [
      record('zulu', 'Zulu Weather Stations', '2020-01-01'),
      record('alpha', 'Alpha', '2067-01-01'),
    ]
    expect(searchRecords(records, 'weather').map((hit) => hit.record.slug)).toEqual([
      'zulu',
      'alpha',
    ])
  })

  it('compares titles in English collation, then slugs by code unit', () => {
    const entry = (title: string, slug: string) => ({ title, slug })
    expect(compareTitleThenSlug(entry('apple', 'z'), entry('Banana', 'a'))).toBeLessThan(0)
    expect(compareTitleThenSlug(entry('Émile', 'z'), entry('Frank', 'a'))).toBeLessThan(0)
    expect(compareTitleThenSlug(entry('Same', 'a-b'), entry('Same', 'ab'))).toBeLessThan(0)
    expect(compareTitleThenSlug(entry('Same', 'x'), entry('Same', 'x'))).toBe(0)
  })
})
