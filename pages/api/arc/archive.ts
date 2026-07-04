// Slim archive index for the ARC dock: every record's dock-facing fields in one cacheable
// payload (the manifest's searchText/keywords stay server-side).

import type { NextApiRequest, NextApiResponse } from 'next'

interface ManifestArticle {
  slug: string
  title: string
  date: string
  description?: string
  articleType?: string
  readingTime?: string | number
  horizon?: string
  domains?: string[] | string
}

export interface ArcRecord {
  slug: string
  title: string
  date: string
  description: string
  type: string
  minutes: number
}

const manifest = require('../../../lib/generated/article-manifest.json') as ManifestArticle[]

const records: ArcRecord[] = manifest
  .map((a) => ({
    slug: a.slug,
    title: a.title,
    date: a.date ?? '',
    description: (a.description ?? '').slice(0, 220),
    type: a.articleType ?? 'article',
    minutes: Number(a.readingTime ?? 0) || Math.max(1, Math.round((a.description?.length ?? 600) / 180)),
  }))
  .sort((x, y) => (x.date < y.date ? 1 : -1))

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.status(200).json({ records, total: records.length })
}
