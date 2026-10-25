import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_WORLD_ID, LISTED_WORLDS, WORLDS, worldById } from './worlds'
import { LEGACY_HERO_U } from './sky/equirect'

const publicFile = (url: string) => path.join(process.cwd(), 'public', url)

describe('world exposure', () => {
  it('gives every world a finite, bounded sky gain', () => {
    for (const w of WORLDS) {
      expect(Number.isFinite(w.exposure)).toBe(true)
      expect(w.exposure).toBeGreaterThanOrEqual(0.7)
      expect(w.exposure).toBeLessThanOrEqual(2)
    }
  })

  it('lifts the darkest sky and tames the brightest toward mid-grey', () => {
    expect(worldById('the-stacks').exposure).toBeGreaterThan(1)
    expect(worldById('night-train').exposure).toBeLessThan(1)
  })
})

describe('world skies', () => {
  it('gives every world a preview and at least one full tier', () => {
    for (const { id, sky } of WORLDS) {
      expect(sky.preview, id).toMatch(/\.webp$/)
      expect(sky.k4 || sky.legacyJpeg || sky.k8, id).toBeTruthy()
    }
  })

  it('points every in-git tier at a file that exists', () => {
    for (const { id, sky } of WORLDS) {
      for (const url of [sky.preview, sky.k4, sky.legacyJpeg, sky.depth]) {
        if (!url) continue
        expect(url.startsWith('/'), `${id}: ${url}`).toBe(true)
        expect(existsSync(publicFile(url)), `${id}: ${url} missing from public/`).toBe(true)
      }
    }
  })

  it('keeps 8K masters out of git (R2 only) and committed tiers small', () => {
    for (const { id, sky } of WORLDS) {
      if (sky.k8) expect(sky.k8, id).toMatch(/^https:\/\//)
      for (const url of [sky.preview, sky.k4]) {
        if (!url) continue
        // 6 MB: well under the 25 MiB Workers asset cap, and what a 4K UASTC world costs
        expect(statSync(publicFile(url)).size, `${id}: ${url}`).toBeLessThan(6_000_000)
      }
    }
  })

  it('content-hashes the new assets (they are served immutable)', () => {
    for (const { id, sky } of WORLDS) {
      for (const url of [sky.preview, sky.k4, sky.k8, sky.depth]) {
        if (url) expect(url, id).toMatch(/\.[0-9a-f]{8}\.(webp|ktx2|png)$/)
      }
    }
  })

  it('keeps the legacy JPEG worlds framed as they always were', () => {
    const legacy = WORLDS.filter((w) => w.sky.legacyJpeg && !w.sky.k4)
    expect(legacy.length).toBe(12)
    for (const w of legacy) {
      expect(w.sky.legacyJpeg).toMatch(/^\/background\/[a-z0-9-]+\.jpg$/)
      expect(w.sky.heroU).toBe(LEGACY_HERO_U)
    }
  })

  it('frames every sky with a hero position inside the image', () => {
    for (const { id, sky } of WORLDS) {
      const u = sky.heroU ?? 0.5
      expect(u >= 0 && u < 1, id).toBe(true)
    }
  })
})

describe('hidden worlds', () => {
  it('are left off the dock list but stay reachable by id', () => {
    const hidden = WORLDS.filter((w) => w.hidden)
    expect(hidden.map((w) => w.id)).toContain('the-stacks-pilot')
    for (const w of hidden) {
      expect(LISTED_WORLDS).not.toContain(w)
      expect(worldById(w.id)).toBe(w)
    }
    expect(LISTED_WORLDS.length).toBe(WORLDS.length - hidden.length)
  })

  it('never include the default world', () => {
    expect(worldById(DEFAULT_WORLD_ID).hidden).toBeFalsy()
    expect(LISTED_WORLDS[0].id).toBe(DEFAULT_WORLD_ID)
  })

  it('the pilot ships KTX2 with its hero at u = 0.5 and no legacy JPEG', () => {
    const pilot = worldById('the-stacks-pilot')
    expect(pilot.sky.k4).toMatch(/^\/worlds\/the-stacks\/k4\.[0-9a-f]{8}\.ktx2$/)
    expect(pilot.sky.legacyJpeg).toBeUndefined()
    expect(pilot.sky.heroU ?? 0.5).toBe(0.5)
  })
})
