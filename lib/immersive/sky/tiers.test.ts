import { describe, expect, it } from 'vitest'
import type { SkyAssets } from '@/lib/immersive/worlds'
import {
  TIER_RANK,
  fallbackFor,
  holdTarget,
  isDesktopClass,
  planKey,
  skyTierPlan,
  type SkyEnv,
} from './tiers'

const KTX: SkyAssets = {
  preview: '/w/preview.webp',
  k4: '/w/k4.ktx2',
  k8: 'https://assets.example/w/k8.ktx2',
}
const LEGACY: SkyAssets = { preview: '/w/p.webp', legacyJpeg: '/background/w.jpg' }
const BOTH: SkyAssets = { ...KTX, legacyJpeg: '/background/w.jpg' }

const DESKTOP_HIGH: SkyEnv = {
  quality: 'high',
  desktop: true,
  compressed: true,
  maxTextureSize: 8192,
}
const tiers = (sky: SkyAssets, env: Partial<SkyEnv> = {}) =>
  skyTierPlan(sky, { ...DESKTOP_HIGH, ...env }).map((s) => s.tier)

describe('skyTierPlan', () => {
  it('ladders preview -> k4 -> k8 on a high-quality desktop', () => {
    expect(tiers(KTX)).toEqual(['preview', 'k4', 'k8'])
    expect(skyTierPlan(KTX, DESKTOP_HIGH).map((s) => s.url)).toEqual([KTX.preview, KTX.k4, KTX.k8])
  })

  it('keeps k4 as the default everywhere else', () => {
    expect(tiers(KTX, { quality: 'low' })).toEqual(['preview', 'k4'])
    expect(tiers(KTX, { desktop: false })).toEqual(['preview', 'k4'])
  })

  it('caps at k4 when the adapter has no BC/ASTC/ETC2 (RGBA32 fallback: 4x the VRAM)', () => {
    expect(tiers(KTX, { compressed: false })).toEqual(['preview', 'k4'])
  })

  it('never asks for a texture larger than the device allows', () => {
    expect(tiers(KTX, { maxTextureSize: 4096 })).toEqual(['preview', 'k4'])
    expect(tiers(LEGACY, { maxTextureSize: 2048 })).toEqual(['preview', 'legacy'])
  })

  it('serves a legacy world its JPEG, and never loads the JPEG alongside a KTX2', () => {
    expect(tiers(LEGACY)).toEqual(['preview', 'legacy'])
    expect(tiers(BOTH)).toEqual(['preview', 'k4', 'k8'])
  })

  it('honours the debug cap, but always shows something', () => {
    expect(tiers(KTX, { cap: 'k4' })).toEqual(['preview', 'k4'])
    expect(tiers(BOTH, { cap: 'legacy' })).toEqual(['preview', 'legacy'])
    expect(tiers(KTX, { cap: 'preview' })).toEqual(['preview'])
    expect(tiers(LEGACY, { cap: 'preview' })).toEqual(['preview'])
  })

  it('orders every plan lowest tier first', () => {
    for (const sky of [KTX, LEGACY, BOTH]) {
      for (const env of [{}, { quality: 'low' as const }, { compressed: false }]) {
        const ranks = skyTierPlan(sky, { ...DESKTOP_HIGH, ...env }).map((s) => TIER_RANK[s.tier])
        expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
      }
    }
  })
})

describe('fallbackFor', () => {
  it('drops a failed k4 back to the legacy JPEG when the world has one', () => {
    expect(fallbackFor('k4', BOTH, DESKTOP_HIGH)).toEqual({ tier: 'legacy', url: BOTH.legacyJpeg })
  })

  it('otherwise keeps what is already up (no fallback step)', () => {
    expect(fallbackFor('k4', KTX, DESKTOP_HIGH)).toBeNull()
    expect(fallbackFor('k8', BOTH, DESKTOP_HIGH)).toBeNull()
    expect(fallbackFor('preview', BOTH, DESKTOP_HIGH)).toBeNull()
    expect(fallbackFor('legacy', LEGACY, DESKTOP_HIGH)).toBeNull()
  })
})

describe('holdTarget', () => {
  it('holds a world switch for the full tier, never for the 8K', () => {
    expect(holdTarget(skyTierPlan(KTX, DESKTOP_HIGH))).toBe('k4')
    expect(holdTarget(skyTierPlan(LEGACY, DESKTOP_HIGH))).toBe('legacy')
    expect(holdTarget(skyTierPlan(KTX, { ...DESKTOP_HIGH, cap: 'preview' }))).toBe('preview')
    expect(holdTarget([])).toBeNull()
  })
})

describe('isDesktopClass', () => {
  it('needs a fine pointer, a non-mobile UA and 8 GiB when reported', () => {
    expect(isDesktopClass({ coarsePointer: false })).toBe(true)
    expect(isDesktopClass({ coarsePointer: false, mobileUA: false, deviceMemory: 8 })).toBe(true)
    expect(isDesktopClass({ coarsePointer: true })).toBe(false)
    expect(isDesktopClass({ coarsePointer: false, mobileUA: true })).toBe(false)
    expect(isDesktopClass({ coarsePointer: false, deviceMemory: 4 })).toBe(false)
  })
})

describe('planKey', () => {
  it('changes exactly when the ladder does', () => {
    const a = skyTierPlan(KTX, DESKTOP_HIGH)
    expect(planKey(a)).toBe(planKey(skyTierPlan({ ...KTX }, { ...DESKTOP_HIGH })))
    expect(planKey(a)).not.toBe(planKey(skyTierPlan(KTX, { ...DESKTOP_HIGH, quality: 'low' })))
  })
})
