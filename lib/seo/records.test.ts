import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_OG_IMAGE,
  THIN_WORDS,
  bodyWords,
  imageSize,
  ogImageCandidates,
  readImageSize,
  resolveOgImage,
  thinReason,
} from './records'

/** Bytes from numbers, ASCII strings and arrays of either. */
function bytes(...parts: (number | string | number[])[]): Uint8Array {
  const out: number[] = []
  for (const part of parts.flat()) {
    if (typeof part === 'number') out.push(part)
    else for (const char of part) out.push(char.charCodeAt(0))
  }
  return Uint8Array.from(out)
}
const be16 = (n: number) => [n >> 8, n & 0xff]
const be32 = (n: number) => [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
const le16 = (n: number) => [n & 0xff, n >> 8]
const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, n >> 16]
const le32 = (n: number) => [...le16(n & 0xffff), ...le16(n >>> 16)]
const zeros = (n: number) => Array<number>(n).fill(0)

const png = (width: number, height: number) =>
  bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    be32(13),
    'IHDR',
    be32(width),
    be32(height)
  )
const sof = (marker: number, width: number, height: number) => [
  0xff,
  marker,
  ...be16(17),
  8,
  ...be16(height),
  ...be16(width),
  3,
  ...zeros(9),
]
const app0 = [
  0xff,
  0xe0,
  ...be16(16),
  ...'JFIF'.split('').map((c) => c.charCodeAt(0)),
  ...zeros(10),
]

describe('thin-content guard', () => {
  it('counts the words of the rendered blocks', () => {
    expect(bodyWords([{ x: 'One two  three' }, { x: '\tfour\nfive ' }, { x: '' }])).toBe(5)
    expect(bodyWords([])).toBe(0)
  })

  it(`flags bodies under ${THIN_WORDS} words`, () => {
    expect(thinReason('an-essay', THIN_WORDS - 1)).toBe(`${THIN_WORDS - 1} words < ${THIN_WORDS}`)
    expect(thinReason('an-essay', THIN_WORDS)).toBeNull()
  })

  it('flags the stub families at any length, but not the backstory-shadows series', () => {
    expect(thinReason('tech-neural-ode', 2000)).toBe('tech-* stub family, 2000 words')
    expect(thinReason('backstory-07-fusion-nanotech-2027-09', 20)).toBe(
      'backstory-NN fragment family, 20 words'
    )
    expect(thinReason('backstory-shadows-01-the-test-subjects-garden', 1580)).toBeNull()
  })
})

describe('ogImageCandidates', () => {
  it('puts the prepared social card first and the site preview last', () => {
    expect(ogImageCandidates('/images/hero.png', { ogImage: '/images/og/x.jpg' })).toEqual([
      '/images/og/x.jpg',
      '/images/hero.png',
      DEFAULT_OG_IMAGE,
    ])
  })

  it('keeps raster heroes in order, never an SVG, without repeats', () => {
    const images = { ogImage: '/images/og/x.svg', heroImage: '/images/articles/x.jpg' }
    expect(ogImageCandidates('/images/multi-art/x/option-1.png', images)).toEqual([
      '/images/multi-art/x/option-1.png',
      '/images/articles/x.jpg',
      DEFAULT_OG_IMAGE,
    ])
    expect(ogImageCandidates('/images/articles/x.jpg', images)).toEqual([
      '/images/articles/x.jpg',
      DEFAULT_OG_IMAGE,
    ])
  })

  it('offers only the site preview when there is no raster', () => {
    expect(ogImageCandidates('/images/og/x.svg', { ogImage: '/images/og/x.svg' })).toEqual([
      DEFAULT_OG_IMAGE,
    ])
    expect(ogImageCandidates(null)).toEqual([DEFAULT_OG_IMAGE])
  })
})

describe('imageSize', () => {
  it('reads a PNG header', () => {
    expect(imageSize(png(1200, 630))).toEqual({ width: 1200, height: 630 })
  })

  it('walks JPEG segments to the baseline or progressive frame', () => {
    expect(imageSize(bytes(0xff, 0xd8, app0, sof(0xc0, 1792, 1024)))).toEqual({
      width: 1792,
      height: 1024,
    })
    // A DHT segment (C4) sits in the SOF range but is not a frame; SOF2 follows it.
    const dht = [0xff, 0xc4, ...be16(4), 0, 0]
    expect(imageSize(bytes(0xff, 0xd8, dht, sof(0xc2, 1024, 576)))).toEqual({
      width: 1024,
      height: 576,
    })
  })

  it('reads the three WebP layouts', () => {
    const riff = (chunk: string, body: number[]) =>
      bytes('RIFF', le32(0), 'WEBP', chunk, le32(0), body)
    const lossy = riff('VP8 ', [...zeros(3), 0x9d, 0x01, 0x2a, ...le16(1024), ...le16(576), 0, 0])
    const lossless = riff('VP8L', [0x2f, ...le32(1199 | (629 << 14)), ...zeros(5)])
    const extended = riff('VP8X', [...zeros(4), ...le24(1599), ...le24(899)])

    expect(imageSize(lossy)).toEqual({ width: 1024, height: 576 })
    expect(imageSize(lossless)).toEqual({ width: 1200, height: 630 })
    expect(imageSize(extended)).toEqual({ width: 1600, height: 900 })
  })

  it('returns null for other formats and cut-off headers', () => {
    expect(imageSize(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
    expect(imageSize(png(1200, 630).subarray(0, 20))).toBeNull()
    expect(imageSize(bytes(0xff, 0xd8, app0))).toBeNull()
    expect(imageSize(new Uint8Array())).toBeNull()
  })
})

describe('readImageSize', () => {
  let directory: string | undefined
  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true })
  })

  it('sniffs a file by content, not extension, and tolerates a missing file', async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'seo-test-'))
    const file = path.join(directory, 'option-1.png') // really a JPEG, as many plates here are
    await writeFile(file, bytes(0xff, 0xd8, app0, sof(0xc0, 640, 480)))

    expect(readImageSize(file)).toEqual({ width: 640, height: 480 })
    expect(readImageSize(path.join(directory, 'missing.jpg'))).toBeNull()
  })
})

describe('resolveOgImage', () => {
  let root: string | undefined
  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true })
  })

  async function publicFiles(files: Record<string, Uint8Array>) {
    root = await mkdtemp(path.join(os.tmpdir(), 'seo-og-test-'))
    for (const [file, contents] of Object.entries(files)) {
      const target = path.join(root, 'public', file)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, contents)
    }
    return root
  }

  it('uses the first candidate on disk, with its size', async () => {
    const dir = await publicFiles({
      'images/og/x.jpg': bytes(0xff, 0xd8, app0, sof(0xc0, 1200, 630)),
      'social-preview.png': png(1280, 640),
    })
    expect(resolveOgImage(dir, '/images/hero.png', { ogImage: '/images/og/x.jpg' })).toEqual({
      path: '/images/og/x.jpg',
      width: 1200,
      height: 630,
    })
  })

  it('skips a missing card and an unreadable hero instead of shipping a 404', async () => {
    const dir = await publicFiles({
      'images/hero.png': bytes('<svg/>'),
      'images/articles/x.jpg': png(1792, 1024),
      'social-preview.png': png(1280, 640),
    })
    const images = { ogImage: '/images/og/x.jpg', heroImage: '/images/articles/x.jpg' }
    expect(resolveOgImage(dir, '/images/hero.png', images)).toEqual({
      path: '/images/articles/x.jpg',
      width: 1792,
      height: 1024,
    })
    expect(resolveOgImage(dir, '/images/gone.jpg')).toEqual({
      path: DEFAULT_OG_IMAGE,
      width: 1280,
      height: 640,
    })
  })

  it('fails the build when not even the site preview is readable', async () => {
    const dir = await publicFiles({})
    expect(() => resolveOgImage(dir, '/images/gone.jpg')).toThrow(
      /none of \/images\/gone\.jpg, \/social-preview\.png is a readable image under public\//
    )
  })
})
