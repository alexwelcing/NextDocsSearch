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

function fromManifestList(manifest: unknown): ArchiveRecord[] {
  if (!Array.isArray(manifest)) throw new Error('archive: invalid manifest')
  return manifest.map(fromManifest)
}

export class FsManifestSource implements ArchiveSource {
  constructor(
    private readonly manifestPath = path.join(process.cwd(), 'lib/generated/article-manifest.json')
  ) {}

  async load(): Promise<ArchiveRecord[]> {
    return fromManifestList(JSON.parse(await readFile(this.manifestPath, 'utf8')))
  }
}

/**
 * A manifest already in memory, e.g. a static JSON import the bundler inlines, so the consumer
 * needs no filesystem at runtime (a Cloudflare Worker has none).
 */
export class BundledManifestSource implements ArchiveSource {
  constructor(private readonly manifest: unknown) {}

  async load(): Promise<ArchiveRecord[]> {
    return fromManifestList(this.manifest)
  }
}

/**
 * The archive's one listing order: newest `date` first, equal dates by slug. The static index files
 * and the API alias share it, so the dock lists the same order from either. It replaces the API's
 * old comparator, which never returned 0 and so reversed runs of equal dates by accident.
 */
export function archiveOrder(a: ArchiveRecord, b: ArchiveRecord): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0
}

const manifestSource = new FsManifestSource()

/** The server default; the browser entrypoint requires an explicit source. */
export function listRecords(source: ArchiveSource = manifestSource): Promise<ArchiveRecord[]> {
  return loadRecords(source)
}
