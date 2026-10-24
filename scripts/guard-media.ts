// Build guard: refuse to build from a checkout that is missing its media. public/images (~1.1 GB,
// git-tracked) is left out of sparse agent checkouts, and the manifest generators read a missing
// directory as empty: generate-image-manifest would overwrite lib/generated/image-manifest.json
// (317 records) with {}, generate-media-manifest would write public/arc/media.json with 0 films,
// and the article manifest would lose every hero image. Nothing else fails, so the damage ships.
//
// Runs as the first pre-build step (scripts/steps/pre/05-guard-media.ts), or directly:
// `tsx scripts/guard-media.ts`. ALLOW_EMPTY_MEDIA=1 turns the failure into a warning for builds
// that knowingly go without media.

import fs from 'node:fs'
import path from 'node:path'

/** Main carries ~1,950 images; a few hundred missing still means a broken checkout. */
export const MIN_IMAGES = 300

const IMAGE_FILE = /\.(avif|gif|jpe?g|png|svg|webp)$/i

export interface MediaCensus {
  /** Image files anywhere under public/images. */
  images: number
  /** .mp4 files in public/images/article-videos — exactly the films media.json will list. */
  films: number
  /** Human-readable reasons the build should stop; empty when the media looks whole. */
  problems: string[]
}

function countFiles(dir: string, match: RegExp): number {
  let count = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name), match)
    else if (match.test(entry.name)) count += 1
  }
  return count
}

export function censusMedia(root: string = process.cwd()): MediaCensus {
  const imagesDir = path.join(root, 'public', 'images')
  const videosDir = path.join(imagesDir, 'article-videos')
  const problems: string[] = []

  const images = fs.existsSync(imagesDir) ? countFiles(imagesDir, IMAGE_FILE) : 0
  const films = fs.existsSync(videosDir)
    ? fs.readdirSync(videosDir).filter((file) => file.endsWith('.mp4')).length
    : 0

  if (!fs.existsSync(imagesDir)) problems.push('public/images is missing')
  else if (images < MIN_IMAGES) {
    problems.push(`public/images has ${images} images (expected at least ${MIN_IMAGES})`)
  }
  if (films === 0) {
    problems.push('public/images/article-videos has no .mp4 films, so media.json would list 0')
  }

  return { images, films, problems }
}

/** Throws when the media is missing, unless ALLOW_EMPTY_MEDIA=1. */
export function guardMedia(
  root: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env
): MediaCensus {
  const census = censusMedia(root)
  if (census.problems.length === 0) {
    console.log(`[guard-media] ok: ${census.images} images, ${census.films} films`)
    return census
  }

  const detail = census.problems.join('; ')
  if (env.ALLOW_EMPTY_MEDIA === '1') {
    console.warn(`[guard-media] ALLOW_EMPTY_MEDIA=1, building anyway: ${detail}`)
    return census
  }
  throw new Error(
    `[guard-media] refusing to build: ${detail}. Build from a full checkout (the media is ` +
      'git-tracked under public/images), or set ALLOW_EMPTY_MEDIA=1 to accept empty media manifests.'
  )
}

// CLI entry. Importing the module (the build step, the tests) only defines the functions.
if (/guard-media\.ts$/.test(process.argv[1] ?? '')) {
  try {
    guardMedia()
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
