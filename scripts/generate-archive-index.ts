// Pre-build step: lib/generated/article-manifest.json → the static archive index the dock fetches
// instead of /api/arc/archive:
//
//   public/arc/archive.json       slim records (the six dock fields) for ARCHIVE and collections
//   public/arc/archive-full.json  complete records (searchText, keywords, ...) for FIND
//
// Both carry the API's `{ records, total }` envelope in archiveOrder (lib/archive/server.ts), which
// the API alias also uses. The files are committed like the rest of public/arc, and the output is
// deterministic, so CI's generated-files check catches a stale copy. One record per line keeps a
// content change a readable diff.
//
// Runs as scripts/steps/pre/60-archive-index.ts (after 50-article-manifest), or directly:
// `tsx scripts/generate-archive-index.ts`.

import fs from 'node:fs'
import path from 'node:path'
import { ARCHIVE_FULL_URL, ARCHIVE_URL } from '../lib/archive/http'
import { toSlim } from '../lib/archive/records'
import { archiveOrder, BundledManifestSource } from '../lib/archive/server'

/** `{ records, total }` as valid JSON with one record per line. */
export function envelopeJson(records: object[]): string {
  const lines = records.map((record) => JSON.stringify(record)).join(',\n')
  return `{"records":[\n${lines}\n],"total":${records.length}}\n`
}

/** The two index files' contents, keyed by their public URL. Throws on an empty manifest. */
export async function buildArchiveIndex(
  manifest: unknown
): Promise<{ total: number; files: Record<string, string> }> {
  // load() rather than listRecords(): a broken manifest must fail the build, not write [].
  const records = (await new BundledManifestSource(manifest).load()).sort(archiveOrder)
  if (records.length === 0) throw new Error('archive index: the article manifest has no records')
  return {
    total: records.length,
    files: {
      [ARCHIVE_URL]: envelopeJson(records.map(toSlim)),
      [ARCHIVE_FULL_URL]: envelopeJson(records),
    },
  }
}

export async function writeArchiveIndex(root: string = process.cwd()): Promise<void> {
  const manifestPath = path.join(root, 'lib', 'generated', 'article-manifest.json')
  const { total, files } = await buildArchiveIndex(
    JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  )
  for (const [url, json] of Object.entries(files)) {
    const out = path.join(root, 'public', url)
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, json)
    console.log(`[archive-index] ${url}: ${total} records, ${Math.round(json.length / 1024)} KiB`)
  }
}

// CLI entry. Importing the module (the build step, the tests) only defines the functions.
if (/generate-archive-index\.ts$/.test(process.argv[1] ?? '')) {
  writeArchiveIndex().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
