// The default dock index remains slim. Full-record consumers explicitly request ?view=full.

import type { NextApiRequest, NextApiResponse } from 'next'
import { toSlim } from '../../../lib/archive/records'
import { listRecords } from '../../../lib/archive/server'
import type { ArcRecordSlim } from '../../../lib/archive/types'

export type ArcRecord = ArcRecordSlim

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Retain the dock endpoint's historical ordering, including reversed equal-date entries.
  const archive = [...(await listRecords())].sort((x, y) => (x.date < y.date ? 1 : -1))
  const records = req.query.view === 'full' ? archive : archive.map(toSlim)
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.status(200).json({ records, total: records.length })
}
