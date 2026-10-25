// Sky v2 tier ladder: which of a world's sky assets to load, in what order, and what to fall back
// to when one fails. Pure (no three), so the rules are unit-tested; loader.ts and Sky.tsx act on
// the plan.
//
// Ladder (H1 sky spike, PR #203, and its verifier's conditions):
//   preview  1024x512 WebP in git: on screen within a few ms, and the fallback of last resort.
//   legacy   today's 2048x1024 JPEG: the top tier of a world that has no KTX2 yet.
//   k4       4096x2048 UASTC KTX2 (+mips, BC7/ASTC after transcode, 10.7 MiB of VRAM): default.
//   k8       8192x4096 UASTC KTX2 on R2 (42.7 MiB of VRAM, 2-3 s transcode, a 45-70 ms upload):
//            only for 'high' quality on a desktop-class device whose adapter takes compressed
//            formats and an 8192 texture. Mobile stays at k4 until it is measured.
// No ETC1S above the preview: it fails the banding gate on dark gradients.

import type { QualityTier } from '@/stores/immersiveStore'
import type { SkyAssets } from '@/lib/immersive/worlds'

export type SkyTier = 'preview' | 'legacy' | 'k4' | 'k8'

/** Higher is sharper. A tier never replaces one of equal or higher rank for the same world. */
export const TIER_RANK: Record<SkyTier, number> = { preview: 0, legacy: 1, k4: 2, k8: 3 }

export interface SkyStep {
  tier: SkyTier
  url: string
}

export interface SkyEnv {
  quality: QualityTier
  /** Desktop-class device (isDesktopClass). */
  desktop: boolean
  /** The adapter transcodes UASTC to a GPU block format (BC7, ASTC or ETC2). Without one the
   *  KTX2Loader falls back to uncompressed RGBA32: 4x the VRAM, so no k8. */
  compressed: boolean
  /** device.limits.maxTextureDimension2D (WebGPU guarantees at least 8192). */
  maxTextureSize: number
  /** Debug cap (?skytier=): never load above this tier. */
  cap?: SkyTier | null
}

export interface DeviceClassHints {
  /** matchMedia('(pointer: coarse)') — the primary pointer is a finger. */
  coarsePointer: boolean
  /** navigator.userAgentData?.mobile, where the browser reports it. */
  mobileUA?: boolean
  /** navigator.deviceMemory (Chromium only; GiB, capped at 8). */
  deviceMemory?: number
}

/** Desktop-class for the 8K tier: a fine pointer, not a mobile UA, and 8 GiB if reported. */
export function isDesktopClass({
  coarsePointer,
  mobileUA,
  deviceMemory,
}: DeviceClassHints): boolean {
  if (coarsePointer || mobileUA === true) return false
  return deviceMemory === undefined || deviceMemory >= 8
}

/** Width in px a tier needs from the adapter. */
const TIER_WIDTH: Record<SkyTier, number> = { preview: 1024, legacy: 2048, k4: 4096, k8: 8192 }

function allowed(tier: SkyTier, env: SkyEnv): boolean {
  if (env.cap && TIER_RANK[tier] > TIER_RANK[env.cap]) return false
  if (TIER_WIDTH[tier] > env.maxTextureSize) return false
  if (tier === 'k8') return env.quality === 'high' && env.desktop && env.compressed
  return true
}

/**
 * The tiers to load for a world, lowest first. The preview always comes first when allowed; the
 * world's best full tier follows (k4, else the legacy JPEG); k8 tops it only where allowed. A
 * KTX2 world never also loads its legacy JPEG — that is only a fallback (fallbackFor).
 */
export function skyTierPlan(sky: SkyAssets, env: SkyEnv): SkyStep[] {
  const plan: SkyStep[] = []
  const add = (tier: SkyTier, url: string | undefined) => {
    if (url && allowed(tier, env)) plan.push({ tier, url })
  }
  add('preview', sky.preview)
  if (sky.k4 && allowed('k4', env)) add('k4', sky.k4)
  else add('legacy', sky.legacyJpeg)
  add('k8', sky.k8)
  // A cap below every tier the world has still shows something: its lowest tier.
  if (plan.length === 0 && sky.preview) plan.push({ tier: 'preview', url: sky.preview })
  return plan
}

/**
 * The step to try when `failed` could not be loaded (after its one retry): a failed k4 falls
 * back to the legacy JPEG when the world still has one. Everything else just keeps whatever
 * lower tier is already up (null).
 */
export function fallbackFor(failed: SkyTier, sky: SkyAssets, env: SkyEnv): SkyStep | null {
  if (failed === 'k4' && sky.legacyJpeg && allowed('legacy', env)) {
    return { tier: 'legacy', url: sky.legacyJpeg }
  }
  return null
}

/** The tier a world switch holds the outgoing world for: the plan's best tier below k8 (the k4
 *  or the legacy JPEG), or the preview when that is all there is. */
export function holdTarget(plan: readonly SkyStep[]): SkyTier | null {
  let best: SkyTier | null = null
  for (const { tier } of plan) {
    if (tier !== 'k8' && (best === null || TIER_RANK[tier] > TIER_RANK[best])) best = tier
  }
  return best
}

/** A stable key for a plan, so an effect re-runs only when the ladder actually changes. */
export function planKey(plan: readonly SkyStep[]): string {
  return plan.map((s) => `${s.tier}:${s.url}`).join('|')
}
