import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MIN_IMAGES, censusMedia, guardMedia } from './guard-media'

let root: string

function touch(rel: string) {
  const file = path.join(root, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '')
}

function seed(images: number, films: number) {
  // Spread across nested dirs and extensions, as on main (articles/, multi-art/<slug>/, og/).
  const exts = ['jpg', 'png', 'svg', 'webp']
  for (let i = 0; i < images; i++) {
    touch(`public/images/set-${i % 7}/img-${i}.${exts[i % exts.length]}`)
  }
  for (let i = 0; i < films; i++) touch(`public/images/article-videos/film-${i}.mp4`)
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-media-'))
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('censusMedia', () => {
  it('passes a full media tree', () => {
    seed(MIN_IMAGES, 2)
    expect(censusMedia(root)).toEqual({ images: MIN_IMAGES, films: 2, problems: [] })
  })

  it('flags a checkout without public/images (the sparse-clone case)', () => {
    const census = censusMedia(root)
    expect(census.images).toBe(0)
    expect(census.problems).toEqual([
      'public/images is missing',
      'public/images/article-videos has no .mp4 films, so media.json would list 0',
    ])
  })

  it('flags too few images', () => {
    seed(MIN_IMAGES - 1, 1)
    expect(censusMedia(root).problems).toEqual([
      `public/images has ${MIN_IMAGES - 1} images (expected at least ${MIN_IMAGES})`,
    ])
  })

  it('flags a film directory with no mp4s', () => {
    seed(MIN_IMAGES, 0)
    touch('public/images/article-videos/.gitkeep')
    expect(censusMedia(root).problems).toEqual([
      'public/images/article-videos has no .mp4 films, so media.json would list 0',
    ])
  })

  it('counts only image files, recursively', () => {
    seed(10, 3)
    touch('public/images/multi-art/some-slug/option-1-flux.png')
    touch('public/images/articles/notes.json')
    touch('public/images/articles/.gitkeep')
    expect(censusMedia(root)).toMatchObject({ images: 11, films: 3 })
  })
})

describe('guardMedia', () => {
  it('returns the census when the media is whole', () => {
    seed(MIN_IMAGES, 1)
    expect(guardMedia(root, {}).problems).toEqual([])
  })

  it('throws when the media is missing', () => {
    expect(() => guardMedia(root, {})).toThrow(/refusing to build: public\/images is missing/)
  })

  it('warns instead of throwing under ALLOW_EMPTY_MEDIA=1', () => {
    const census = guardMedia(root, { ALLOW_EMPTY_MEDIA: '1' })
    expect(census.problems).toHaveLength(2)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('ALLOW_EMPTY_MEDIA=1'))
  })

  it('only honours the exact opt-in value', () => {
    expect(() => guardMedia(root, { ALLOW_EMPTY_MEDIA: 'true' })).toThrow(/refusing to build/)
  })
})
