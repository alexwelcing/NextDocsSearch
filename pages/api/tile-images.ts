import { NextApiRequest, NextApiResponse } from 'next'
import * as fs from 'fs'
import * as path from 'path'

interface TileImage {
  src: string
  alt: string
  mtime: number
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])

let cache: { images: { src: string; alt: string }[]; ts: number } | null = null
const CACHE_TTL = 60_000 // 1 minute

function scanTechMultiArt(baseDir: string): TileImage[] {
  const results: TileImage[] = []
  if (!fs.existsSync(baseDir)) return results

  for (const folder of fs.readdirSync(baseDir)) {
    const folderPath = path.join(baseDir, folder)
    if (!fs.statSync(folderPath).isDirectory()) continue

    // Gallery policy: only abstract/technology subjects. Story series may
    // contain people, so they are excluded from the tile pool.
    if (!folder.startsWith('tech-')) continue

    const files = fs
      .readdirSync(folderPath)
      .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
    if (files.length === 0) continue

    // Prefer the highest-quality render available, avoiding the fast/speed
    // options. Order: SD 3.5 Large > Stable Cascade > SDXL/Kolors/V2 > first.
    const pick = files.find((f) => f.toLowerCase().includes('stable-diffusion-v35-large'))
      ?? files.find((f) => f.toLowerCase().includes('stable-cascade'))
      ?? files.find((f) => f.toLowerCase().includes('fast-sdxl'))
      ?? files.find((f) => f.toLowerCase().includes('schnell'))
      ?? files.find((f) => f.toLowerCase().includes('kolors'))
      ?? files.find((f) => f.toLowerCase().includes('v2'))
      ?? files[0]
    const fullPath = path.join(folderPath, pick)
    const stat = fs.statSync(fullPath)

    results.push({
      src: `/images/multi-art/${folder}/${pick}`,
      alt: folder.replace(/^tech-/, '').replace(/-/g, ' '),
      mtime: stat.mtimeMs,
    })
  }
  return results
}

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const now = Date.now()
    if (cache && now - cache.ts < CACHE_TTL) {
      return res.status(200).json(cache.images)
    }

    const publicDir = path.join(process.cwd(), 'public')
    const images = scanTechMultiArt(path.join(publicDir, 'images', 'multi-art'))
      .sort((a, b) => b.mtime - a.mtime)
      .map(({ src, alt }) => ({ src, alt }))

    cache = { images, ts: now }
    res.status(200).json(images)
  } catch (error) {
    console.error('tile-images scan error:', error)
    res.status(500).json({ error: 'Unable to scan tile images.' })
  }
}
