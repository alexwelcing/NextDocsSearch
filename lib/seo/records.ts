// SEO decisions about one record, shared by the article and video pages (at build time, in
// getStaticProps) and scripts/generate-sitemaps.ts, so a page's robots meta, its og:image and the
// sitemaps are computed by the same code and cannot disagree. Server-only: it reads files.

import fs from 'node:fs'
import path from 'node:path'

/**
 * Thin-content guard. A record whose server-rendered body (the public/arc/records blocks, which is
 * what crawlers read) has fewer than THIN_WORDS words is still prerendered, so in-scene deep links
 * work, but it carries `noindex,follow` and stays out of the sitemap until the editorial pass
 * merges, deletes or expands it. Code fences never reach the page, so the source MDX word count
 * overstates some records.
 */
export const THIN_WORDS = 300

/**
 * Stub families from the content audit, thin whatever their length: the tech-* one-line stubs
 * (median 20 words, invented bylines) and the backstory-NN journal fragments (median 151 words).
 * The Alex-bylined backstory-shadows-* series is a different family and is not matched.
 */
const STUB_FAMILIES: { match: RegExp; name: string }[] = [
  { match: /^tech-/, name: 'tech-* stub family' },
  { match: /^backstory-\d+-/, name: 'backstory-NN fragment family' },
]

export function bodyWords(blocks: readonly { x: string }[]): number {
  return blocks.reduce((n, block) => n + block.x.split(/\s+/).filter(Boolean).length, 0)
}

/** Why a record must not be indexed, or null when it may be. */
export function thinReason(slug: string, words: number): string | null {
  const family = STUB_FAMILIES.find((f) => f.match.test(slug))
  if (family) return `${family.name}, ${words} words`
  return words < THIN_WORDS ? `${words} words < ${THIN_WORDS}` : null
}

export const DEFAULT_OG_IMAGE = '/social-preview.png'
const RASTER = /\.(jpe?g|png|webp|gif)$/i

/** The image-manifest fields (lib/generated/image-manifest.json) that can supply an og:image. */
export interface OgImageCandidates {
  ogImage?: string | null
  heroImage?: string | null
}

const imageManifests = new Map<string, Record<string, OgImageCandidates>>()

/** lib/generated/image-manifest.json under root, parsed once per process. */
export function readImageManifest(root: string): Record<string, OgImageCandidates> {
  let images = imageManifests.get(root)
  if (!images) {
    const file = path.join(root, 'lib', 'generated', 'image-manifest.json')
    images = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, OgImageCandidates>
    imageManifests.set(root, images)
  }
  return images
}

/**
 * og:image for a record: the image manifest's ogImage (the 1200x630 card in public/images/og/, or
 * the curated selected plate), else a raster hero, else the site preview. SVG never qualifies:
 * X and most scrapers reject it.
 */
export function ogImagePath(hero: string | null | undefined, images?: OgImageCandidates): string {
  const candidates = [images?.ogImage, hero, images?.heroImage]
  return (
    candidates.find((p): p is string => typeof p === 'string' && RASTER.test(p)) ?? DEFAULT_OG_IMAGE
  )
}

export interface ImageSize {
  width: number
  height: number
}

/**
 * Pixel size from a PNG, JPEG or WebP header. Many '.png' files here are really JPEG or WebP, so
 * the format comes from the magic bytes, never the extension. Null when the bytes are not one of
 * those formats or are cut off before the size.
 */
export function imageSize(bytes: Uint8Array): ImageSize | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ascii = (at: number, length: number) =>
    String.fromCharCode(...bytes.subarray(at, at + length))
  const size = (width: number, height: number) =>
    width > 0 && height > 0 ? { width, height } : null

  // PNG: signature, then the IHDR chunk's big-endian width and height.
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && ascii(12, 4) === 'IHDR') {
    return size(view.getUint32(16), view.getUint32(20))
  }

  // JPEG: walk the marker segments to the first start-of-frame.
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2
    while (at + 9 <= bytes.length) {
      if (bytes[at] !== 0xff) return null
      const marker = bytes[at + 1]
      if (marker === 0xff) {
        at += 1 // fill byte
        continue
      }
      // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC), which share the range.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return size(view.getUint16(at + 7), view.getUint16(at + 5))
      }
      if (marker === 0xd9 || marker === 0xda) return null // end of image, start of scan
      // RSTn and TEM stand alone; every other marker carries a big-endian segment length.
      at += (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 ? 2 : 2 + view.getUint16(at + 2)
    }
    return null
  }

  // WebP: RIFF container; the size layout depends on the first chunk.
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4)
    if (chunk === 'VP8 ') {
      return size(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff)
    }
    if (chunk === 'VP8L') {
      const bits = view.getUint32(21, true)
      return size((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1)
    }
    if (chunk === 'VP8X') {
      const u24 = (at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)
      return size(u24(24) + 1, u24(27) + 1)
    }
  }
  return null
}

/** Enough of a file for its header; a JPEG's metadata segments can push its frame past 64 KiB. */
const HEADER_BYTES = 256 * 1024

/** imageSize() of a file on disk, or null when it is missing or unreadable. */
export function readImageSize(file: string): ImageSize | null {
  let fd: number | undefined
  try {
    fd = fs.openSync(file, 'r')
    const buffer = Buffer.alloc(HEADER_BYTES)
    const read = fs.readSync(fd, buffer, 0, HEADER_BYTES, 0)
    return imageSize(buffer.subarray(0, read))
  } catch {
    return null
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}
