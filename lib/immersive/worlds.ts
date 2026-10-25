// Curated world definitions for the 360 scene: an equirect sky plus the lighting and atmosphere
// that sell it. The dock's WORLDS tab pages through this registry (minus hidden worlds).

import { LEGACY_HERO_U } from './sky/equirect'

/**
 * A world's sky, as a tier ladder (lib/immersive/sky/tiers.ts picks what to load). All tiers are
 * the same 2:1 equirect, row 0 = zenith. Paths are site-absolute; KTX2 names carry a content hash.
 */
export interface SkyAssets {
  /** 1024x512 WebP, in git: on screen within a few ms of a switch, and the last-resort fallback. */
  preview: string
  /** 4096x2048 UASTC KTX2 with its mip chain (~3-5 MB): the default tier. */
  k4?: string
  /** 8192x4096 UASTC KTX2 (11-25 MB, so on R2, never in git): 'high' quality desktops only. */
  k8?: string
  /** Today's 2048x1024 JPEG: the top tier of a world with no KTX2 yet, and the fallback when its
   *  k4 fails to load. Only set it where it is the same image as the KTX2 tiers. */
  legacyJpeg?: string
  /** Where the start view looks in the image (u, 0..1). New worlds author the hero at 0.5, the
   *  default, with the seam behind the viewer; legacy JPEGs keep LEGACY_HERO_U (0.75), the column
   *  the old inverted sphere showed at the start view, so their framing is unchanged. */
  heroU?: number
  /** DEBUG ONLY (?depth=1): 2048x1024 8-bit disparity (1/r: white = near 4, black = far 60). */
  depth?: string
}

export interface WorldDef {
  id: string
  name: string
  /** One-line dock description (windfoil text — keep it terminal-terse). */
  blurb: string
  sky: SkyAssets
  /** Left out of the dock's WORLDS list; reachable only by ?world=<id> (pilots awaiting review). */
  hidden?: boolean
  /** Scene lighting tint + intensity applied over the panorama. */
  ambient: { color: string; intensity: number }
  key: { color: string; intensity: number; position: [number, number, number] }
  /** Atmosphere particle tint (phosphor drift). */
  particles: { color: string; count: number }
  /** Subtle auto-rotation speed for idle drift, radians/second. */
  drift: number
  /** Aerial-perspective density 0..1 (0 = hard vacuum, 1 = thick air). Drives the scene
   *  fogNode range and the atmosphere motes' depth fade. */
  haze: number
  /** Linear gain on the panorama before the renderer's tone map, normalizing the library's wildly
   *  uneven JPEG brightness toward a common mid-grey. Each value moves its world halfway, in log
   *  terms, to sRGB luma ~96, clamped to 0.7–2 so dark worlds keep their mood and bright ones
   *  their sparkle. Mean displayed sRGB luma (0–255) across the 12 panoramas, computed offline by
   *  running each JPEG through the tone map: 5.8–155 under main's ACESFilmic at exposure 1.05;
   *  10–137 under Neutral at exposure 1 with no gain; 16–114 under Neutral at exposure 1 with
   *  these gains (the-stacks 10 → 16, night-train 137 → 114). Applied by the sky shader
   *  (scene/Sky.tsx, per crossfade slot), to the sky only: UI, motes and lit surfaces never see it. */
  exposure: number
}

/** A legacy world's sky: its 2K JPEG in public/background, previewed by a 1024 WebP made from it
 *  (scripts/worlds/sky_prep.py --no-chain), framed as it always was. */
function legacySky(name: string, previewHash: string): SkyAssets {
  return {
    preview: `/background/preview/${name}.${previewHash}.webp`,
    legacyJpeg: `/background/${name}.jpg`,
    heroU: LEGACY_HERO_U,
  }
}

export const WORLDS: WorldDef[] = [
  {
    id: 'the-stacks',
    name: 'THE STACKS',
    blurb: 'the archive itself. every record you can see is real.',
    sky: legacySky('the-stacks', 'bc9af1c4'),
    ambient: { color: '#a8ffc4', intensity: 0.55 },
    key: { color: '#c8ffd8', intensity: 0.85, position: [0, 9, -2] },
    particles: { color: '#70ff8f', count: 320 },
    drift: 0.003,
    haze: 0.35,
    exposure: 2,
  },
  {
    id: 'the-overlook',
    name: 'THE OVERLOOK',
    blurb: 'brass observation deck. two moons over a patient sea.',
    sky: legacySky('the-overlook', 'f9cfe311'),
    ambient: { color: '#ffd9b0', intensity: 0.8 },
    key: { color: '#ffb877', intensity: 1.15, position: [0, 4, -8] },
    particles: { color: '#ffd9a8', count: 160 },
    drift: 0.003,
    haze: 0.5,
    exposure: 2,
  },
  {
    id: 'signal-garden',
    name: 'SIGNAL GARDEN',
    blurb: 'bioluminescent flora under the antenna field. listen.',
    sky: legacySky('signal-garden', 'edf97540'),
    ambient: { color: '#7fd8e8', intensity: 0.55 },
    key: { color: '#66e8ff', intensity: 0.8, position: [-4, 8, 3] },
    particles: { color: '#7fefff', count: 380 },
    drift: 0.005,
    haze: 0.7,
    exposure: 2,
  },
  {
    id: 'high-orbit',
    name: 'HIGH ORBIT',
    blurb: 'ring station corridor. the gas giant does not care.',
    sky: legacySky('high-orbit', 'e57bcce7'),
    ambient: { color: '#d8e8ff', intensity: 0.85 },
    key: { color: '#aac8ff', intensity: 1.0, position: [6, 3, -5] },
    particles: { color: '#bcd8ff', count: 220 },
    drift: 0.004,
    haze: 0.05,
    exposure: 2,
  },
  {
    id: 'atrium',
    name: 'THE ATRIUM',
    blurb: 'default habitat. warm light, tall glass.',
    sky: legacySky('start', 'bdc23863'),
    ambient: { color: '#fff4e0', intensity: 0.9 },
    key: { color: '#ffd9a0', intensity: 1.2, position: [5, 8, 2] },
    particles: { color: '#ffe9b0', count: 220 },
    drift: 0.004,
    haze: 0.3,
    exposure: 1.15,
  },
  {
    id: 'deep-space',
    name: 'DEEP FIELD',
    blurb: 'hard vacuum. the archive looks better with starlight.',
    sky: legacySky('space', '38d8232a'),
    ambient: { color: '#8090ff', intensity: 0.5 },
    key: { color: '#b0c4ff', intensity: 0.9, position: [-6, 4, -3] },
    particles: { color: '#9db8ff', count: 340 },
    drift: 0.006,
    haze: 0.0,
    exposure: 1.1,
  },
  {
    id: 'signal-station',
    name: 'SIGNAL STATION',
    blurb: 'orbital relay. all channels open.',
    sky: legacySky('scifi1', '5017af47'),
    ambient: { color: '#a0f0ff', intensity: 0.7 },
    key: { color: '#7ce8ff', intensity: 1.1, position: [4, 6, -4] },
    particles: { color: '#7ce8ff', count: 260 },
    drift: 0.005,
    haze: 0.15,
    exposure: 1.6,
  },
  {
    id: 'undercroft',
    name: 'THE UNDERCROFT',
    blurb: 'cave system. good acoustics for long reads.',
    sky: legacySky('cave', '9c471081'),
    ambient: { color: '#5a748c', intensity: 0.6 },
    key: { color: '#8fb8d8', intensity: 0.8, position: [0, 10, 0] },
    particles: { color: '#9adfff', count: 180 },
    drift: 0.003,
    haze: 0.8,
    exposure: 1.6,
  },
  {
    id: 'night-train',
    name: 'NIGHT TRAIN',
    blurb: 'in transit. destination classified.',
    sky: legacySky('train', 'd1c33f28'),
    ambient: { color: '#ffd0b8', intensity: 0.75 },
    key: { color: '#ffb890', intensity: 1.0, position: [-3, 5, 4] },
    particles: { color: '#ffcf9e', count: 160 },
    drift: 0.004,
    haze: 0.4,
    exposure: 0.7,
  },
  {
    id: 'meridian',
    name: 'MERIDIAN',
    blurb: 'high desert horizon. dry air, long sightlines.',
    sky: legacySky('bg2', 'abb1ba8b'),
    ambient: { color: '#fff0d8', intensity: 0.95 },
    key: { color: '#ffe2ad', intensity: 1.15, position: [8, 7, 0] },
    particles: { color: '#ffedc2', count: 140 },
    drift: 0.004,
    haze: 0.25,
    exposure: 0.85,
  },
  {
    id: 'verdant',
    name: 'VERDANT',
    blurb: 'green world. photosynthesis as a service.',
    sky: legacySky('bg5', '30917a37'),
    ambient: { color: '#dcffe0', intensity: 0.85 },
    key: { color: '#c2ffc8', intensity: 1.0, position: [2, 9, 3] },
    particles: { color: '#baffc4', count: 240 },
    drift: 0.004,
    haze: 0.6,
    exposure: 1.6,
  },
  {
    id: 'ember',
    name: 'EMBER GATE',
    blurb: 'volcanic exterior. keep the dock hatch sealed.',
    sky: legacySky('bg8', 'fd7a2267'),
    ambient: { color: '#ffc4a0', intensity: 0.7 },
    key: { color: '#ff9a60', intensity: 1.25, position: [-5, 6, -2] },
    particles: { color: '#ffb083', count: 300 },
    drift: 0.005,
    haze: 0.75,
    exposure: 0.85,
  },
  {
    // World-forge pilot (FLUX.2-klein + ERP LoRA -> seam/pole repair -> SeedVR2 -> 8K master,
    // gs://hermes-artifacts-witching/worlds/pilot/the-stacks/), the first KTX2 world: the runtime
    // proof for Sky v2. Hidden until the owner reviews it; promoting it means giving the-stacks
    // this sky block (and exposure). No legacyJpeg: the old JPEG is a different image.
    id: 'the-stacks-pilot',
    name: 'THE STACKS',
    blurb: 'pilot sky. the archive nave at night, one lamp lit.',
    hidden: true,
    sky: {
      preview: '/worlds/the-stacks/preview.51e09b6a.webp',
      k4: '/worlds/the-stacks/k4.f3f41cae.ktx2',
      depth: '/worlds/the-stacks/depth.9cac3a15.png',
    },
    ambient: { color: '#a8ffc4', intensity: 0.55 },
    key: { color: '#d8ffe6', intensity: 0.85, position: [0, 9, -4] },
    particles: { color: '#70ff8f', count: 320 },
    drift: 0.003,
    haze: 0.35,
    // Mean displayed luma 18 under Neutral at gain 1 (the old JPEG: 10); halfway to 96 in log
    // terms wants ~4, so it takes the 2x ceiling like the world it would replace (-> 28).
    exposure: 2,
  },
]

export const DEFAULT_WORLD_ID = WORLDS[0].id

export function worldById(id: string): WorldDef {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0]
}

/** The worlds the dock lists: every registered world except hidden pilots. */
export const LISTED_WORLDS: WorldDef[] = WORLDS.filter((w) => !w.hidden)
