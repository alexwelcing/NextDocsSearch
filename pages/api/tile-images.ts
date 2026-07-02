import { NextApiRequest, NextApiResponse } from 'next'
import * as fs from 'fs'
import * as path from 'path'

interface TileImage {
  src: string
  alt: string
  mtime: number
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
const CREATIVE_SERIES = [
  'far-shore',
  'backstory-shadows',
  'echo-chamber',
  'understory',
  'inheritance',
  'first-cartographers',
  'long-passage',
]

let cache: { images: { src: string; alt: string }[]; ts: number } | null = null
const CACHE_TTL = 60_000 // 1 minute

function scanMultiArt(baseDir: string): TileImage[] {
  const results: TileImage[] = []
  if (!fs.existsSync(baseDir)) return results

  for (const folder of fs.readdirSync(baseDir)) {
    const folderPath = path.join(baseDir, folder)
    if (!fs.statSync(folderPath).isDirectory()) continue

    const files = fs
      .readdirSync(folderPath)
      .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
    if (files.length === 0) continue

    // Prefer the Comfy render when a folder has one; otherwise keep the older
    // random option behaviour so folders with only alternates still appear.
    const comfyPick = files.find((f) => f.toLowerCase().includes('option-1-comfy'))
    const pick = comfyPick ?? files[Math.floor(Math.random() * files.length)]
    const fullPath = path.join(folderPath, pick)
    const stat = fs.statSync(fullPath)

    results.push({
      src: `/images/multi-art/${folder}/${pick}`,
      alt: folder.replace(/-/g, ' '),
      mtime: stat.mtimeMs,
    })
  }
  return results
}

function scanArticles(baseDir: string): TileImage[] {
  const results: TileImage[] = []
  if (!fs.existsSync(baseDir)) return results

  for (const file of fs.readdirSync(baseDir)) {
    if (!IMAGE_EXTS.has(path.extname(file).toLowerCase())) continue
    if (file.endsWith('.svg')) continue

    const fullPath = path.join(baseDir, file)
    const stat = fs.statSync(fullPath)
    if (!stat.isFile()) continue

    results.push({
      src: `/images/articles/${file}`,
      alt: path.basename(file, path.extname(file)).replace(/-/g, ' '),
      mtime: stat.mtimeMs,
    })
  }
  return results
}

function creativeScore(image: TileImage): number {
  const src = image.src.toLowerCase()
  let score = 0

  if (src.includes('/multi-art/')) score += 1000
  if (src.includes('option-1-comfy')) score += 450
  if (src.includes('comfy')) score += 250

  const seriesIndex = CREATIVE_SERIES.findIndex((series) => src.includes(series))
  if (seriesIndex >= 0) score += 700 - seriesIndex * 35

  return score
}

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const now = Date.now()
    if (cache && now - cache.ts < CACHE_TTL) {
      return res.status(200).json(cache.images)
    }

    const publicDir = path.join(process.cwd(), 'public')
    const multiArt = scanMultiArt(path.join(publicDir, 'images', 'multi-art'))
    const articles = scanArticles(path.join(publicDir, 'images', 'articles'))

    // Portfolio-first: prefer the most distinctive multi-art/Comfy generations,
    // then recency so new creative work still bubbles up automatically.
    const all = [...multiArt, ...articles].sort((a, b) => {
      const scoreDelta = creativeScore(b) - creativeScore(a)
      return scoreDelta || b.mtime - a.mtime
    })

    // Strip mtime from response
    const images = all.map(({ src, alt }) => ({ src, alt }))

    cache = { images, ts: now }
    res.status(200).json(images)
  } catch (error) {
    console.error('tile-images scan error:', error)
    res.status(500).json({ error: 'Unable to scan tile images.' })
  }
}
