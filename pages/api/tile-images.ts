import { NextApiRequest, NextApiResponse } from 'next'

// Curated tile pool: manually verified high-quality, no-people, abstract-tech
// renders. Do not auto-scan folders here — that risks pulling story-series
// images of people back into the cannon gallery.
import tilePool from '../../lib/generated/tile-pool.json'

let cache: { images: typeof tilePool; ts: number } | null = null
const CACHE_TTL = 60_000 // 1 minute

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const now = Date.now()
    if (cache && now - cache.ts < CACHE_TTL) {
      return res.status(200).json(cache.images)
    }

    // Shuffle lightly so the wall feels alive on reloads, but keep the set fixed.
    const images = [...tilePool].sort(() => Math.random() - 0.5)

    cache = { images, ts: now }
    res.status(200).json(images)
  } catch (error) {
    console.error('tile-images error:', error)
    res.status(500).json({ error: 'Unable to load tile images.' })
  }
}
