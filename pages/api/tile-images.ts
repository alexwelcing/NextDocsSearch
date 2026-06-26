import type { NextApiRequest, NextApiResponse } from 'next'

const imageManifest = require('../../lib/generated/image-manifest.json') as Record<string, ManifestImageEntry>

interface ManifestImageEntry {
  heroImage?: string | null
  thumbnail?: string | null
  ogImage?: string | null
  multiArt?: { path: string; model?: string; option?: number }[]
}

const CURATED_TECH_TILES = [
  '/images/multi-art/tech-quantum-key-distribution/option-1-fast-sdxl.png',
  '/images/multi-art/tech-quantum-error-correction-qiskit/option-1-schnell.png',
  '/images/multi-art/tech-quantum-annealing-optimization/option-1-schnell.png',
  '/images/multi-art/tech-optical-neural-networks/option-1-fast-sdxl.png',
  '/images/multi-art/tech-neural-ode/option-1-fast-sdxl.png',
  '/images/multi-art/tech-graph-neural-networks/option-1-fast-sdxl.png',
  '/images/multi-art/tech-graphql-api-federation/option-1-fast-sdxl.png',
  '/images/multi-art/tech-nanoscale-self-assembly/option-1-fast-sdxl.png',
  '/images/multi-art/tech-vector-database-optimization/option-1-schnell.png',
  '/images/multi-art/tech-federated-learning-pytorch/option-1-schnell.png',
  '/images/multi-art/tech-molecular-dynamics-simulation/option-1-schnell.png',
  '/images/multi-art/tech-neuromorphic-computing/option-1-fast-sdxl.png',
]

function altFromPath(src: string) {
  const slug = src.split('/').filter(Boolean).at(-2) || src.split('/').pop() || 'article image'
  return slug.replace(/[-_]/g, ' ')
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

function buildTilePool() {
  const manifestImages = Object.values(imageManifest).flatMap((entry) => [
    ...(entry.multiArt ?? []).map((item) => item.path),
    entry.thumbnail,
    entry.heroImage,
    entry.ogImage,
  ])

  return unique([...CURATED_TECH_TILES, ...manifestImages].filter(Boolean) as string[])
    .slice(0, 150)
    .map((src) => ({ src, alt: altFromPath(src) }))
}

const TILE_POOL = buildTilePool()

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json(TILE_POOL.slice(0, 100))
}
