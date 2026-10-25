// Debug-only query switches for the sky (read once at load; none of them change what a visitor
// without them sees). They exist for real-GPU verification — screenshots at fixed views, forced
// tiers, the leak probe — and for the depth-parallax experiment, which the H1 spike's verifier
// kept out of the shipped build.
//
//   ?depth=1            depth-parallax experiment on worlds that carry a sky.depth map: displaced
//                       dense sphere + head-lean camera (NO-GO for shipping; see nodes.ts)
//   ?look=yaw,pitch[,fov]  initial view in degrees (yaw 0 = start view, +right; pitch +up)
//   ?still=1            no idle motion (sky drift, camera attract drift)
//   ?skytier=preview|legacy|k4|k8   never load above this tier
//   ?skydebug=1         expose window.__sky (renderer.info, slot state, setWorld, look) for probes

import type { SkyTier } from './tiers'

export interface SkyDebugFlags {
  depth: boolean
  look: { yaw: number; pitch: number; fov: number | null } | null
  still: boolean
  tier: SkyTier | null
  handle: boolean
}

const TIERS: readonly SkyTier[] = ['preview', 'legacy', 'k4', 'k8']

/** Parse the switches from a query string (pure; exported for tests). */
export function parseSkyDebug(search: string): SkyDebugFlags {
  const q = new URLSearchParams(search)
  let look: SkyDebugFlags['look'] = null
  const parts = q
    .get('look')
    ?.split(',')
    .map((p) => (p.trim() === '' ? NaN : Number(p)))
  if (parts && parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    const fov = parts.length > 2 && Number.isFinite(parts[2]) ? parts[2] : null
    look = { yaw: parts[0], pitch: parts[1], fov }
  }
  const tier = q.get('skytier')
  return {
    depth: q.get('depth') === '1',
    look,
    still: q.get('still') === '1',
    tier: TIERS.includes(tier as SkyTier) ? (tier as SkyTier) : null,
    handle: q.get('skydebug') === '1',
  }
}

export const SKY_DEBUG: SkyDebugFlags = parseSkyDebug(
  typeof window === 'undefined' ? '' : window.location.search
)

/** window.__sky, populated by Sky.tsx and CameraRig.tsx when ?skydebug=1. */
export interface SkyDebugHandle {
  [key: string]: unknown
}

export function skyDebugHandle(): SkyDebugHandle | null {
  if (!SKY_DEBUG.handle || typeof window === 'undefined') return null
  const w = window as unknown as { __sky?: SkyDebugHandle }
  w.__sky ??= {}
  return w.__sky
}
