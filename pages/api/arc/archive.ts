// Legacy alias of the static archive index (public/arc/archive.json and archive-full.json, written
// by scripts/generate-archive-index.ts), which the dock now fetches directly. It serves the same
// records in the same order from a bundled copy of the manifest, so it reads no files at runtime.
// The default view is slim; full-record consumers explicitly request ?view=full.

import type { NextApiRequest, NextApiResponse } from 'next'
import manifest from '../../../lib/generated/article-manifest.json'
import { toSlim } from '../../../lib/archive/records'
import { archiveOrder, BundledManifestSource, listRecords } from '../../../lib/archive/server'
import type { ArcRecordSlim } from '../../../lib/archive/types'

export type ArcRecord = ArcRecordSlim

const source = new BundledManifestSource(manifest)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const archive = [...(await listRecords(source))].sort(archiveOrder)
  const records = req.query.view === 'full' ? archive : archive.map(toSlim)
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.status(200).json({ records, total: records.length })
}
