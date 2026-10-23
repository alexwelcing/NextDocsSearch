// Server entrypoint: browser consumers import ./index instead so Node's filesystem stays
// out of client bundles. Only the generated manifest is read, never the MDX source tree.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { listRecords as loadRecords } from './load'
import type { ArchiveRecord, ArchiveSource } from './types'

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function stringList(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function fromManifest(value: unknown): ArchiveRecord {
  if (
    !value ||
    typeof value !== 'object' ||
    !('slug' in value) ||
    typeof value.slug !== 'string' ||
    !('title' in value) ||
    typeof value.title !== 'string'
  ) {
    throw new Error('archive: invalid manifest record')
  }

  const article = value as Record<string, unknown>
  const description = stringValue(article.description)
  const fallbackMinutes = Math.max(
    1,
    Math.round((typeof article.description === 'string' ? article.description.length : 600) / 180)
  )
  const readingTime = Number(article.readingTime ?? 0)
  const hero = [article.heroImage, article.ogImage, article.thumbnail].find(
    (image): image is string => typeof image === 'string'
  )

  return {
    slug: value.slug,
    title: value.title,
    date: stringValue(article.date),
    description,
    type: stringValue(article.articleType, 'article'),
    minutes: Number.isFinite(readingTime) && readingTime ? readingTime : fallbackMinutes,
    keywords: stringList(article.keywords),
    domains: stringList(article.domains),
    mechanics: stringList(article.mechanics),
    searchText: stringValue(article.searchText),
    hero: hero ?? null,
    ...(typeof article.horizon === 'string' ? { horizon: article.horizon } : {}),
    ...(typeof article.polarity === 'string' ? { polarity: article.polarity } : {}),
  }
}

export class FsManifestSource implements ArchiveSource {
  constructor(
    private readonly manifestPath = path.join(process.cwd(), 'lib/generated/article-manifest.json')
  ) {}

  async load(): Promise<ArchiveRecord[]> {
    const manifest: unknown = JSON.parse(await readFile(this.manifestPath, 'utf8'))
    if (!Array.isArray(manifest)) throw new Error('archive: invalid manifest')
    return manifest.map(fromManifest)
  }
}

const manifestSource = new FsManifestSource()

/** The server default; the browser entrypoint requires an explicit source. */
export function listRecords(source: ArchiveSource = manifestSource): Promise<ArchiveRecord[]> {
  return loadRecords(source)
}
