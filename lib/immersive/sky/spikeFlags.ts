// SPIKE (H1 sky, do not merge as-is): query-string switches for the sky delivery experiment.
// Everything is opt-in; with no ?sky= param the app behaves exactly as on main.
//
//   ?sky=ktx2|cube|jpg|legacy  ktx2 = direction-sampled equirect from a KTX2 tier (preview first),
//                          jpg  = same sampler over the current 2048 JPEG (A/B baseline),
//                          cube = CompressedCubeTexture repro (+ &ctl=1 for an uncompressed control)
//                          legacy = main's UV-sphere PanoramaSphere, but with the debug camera
//   &tier=8k-uastc|8k-etc1s|4k-uastc|4k-etc1s   (default 8k-uastc)
//   &world=<world id>      start in that world (assets: /images/spike-sky/<id>-<tier>.ktx2)
//   &asset=<id>            asset basename override (e.g. test-grid) — world stays &world
//   &pano=<url>            JPEG override for sky=jpg|legacy (e.g. /images/spike-sky/test-grid-2k.jpg)
//   &nograd=1              plain sample(fract(u)) without the seam-safe gradients (shows the seam line)
//   &depth=1               displace a dense sphere by the world's depth map (parallax)
//   &edge=0|1|2            depth-edge mitigation: 0 raw, 1 stretch-discard, 2 discard + far shell
//   &dmap=raw              unconditioned DA-2 disparity (default: median+dilate+blur conditioned)
//   &yaw=&pitch=&fov=      initial view in degrees (yaw 0 = start view, -90 = image seam)
//   &lean=x,y              fixed head-lean in [-1,1] (else pointer-driven when depth=1)
//   &still=1               no idle drift (camera or panorama) — for repeatable screenshots

export interface SkySpikeFlags {
  sky: 'ktx2' | 'cube' | 'jpg' | 'legacy' | null
  tier: string
  world: string | null
  asset: string | null
  pano: string | null
  nograd: boolean
  depth: boolean
  edge: number
  dmap: string
  yaw: number | null
  pitch: number | null
  fov: number | null
  lean: [number, number] | null
  still: boolean
  ctl: boolean
}

function parse(): SkySpikeFlags {
  const q =
    typeof window === 'undefined'
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search)
  const num = (k: string) => (q.has(k) && q.get(k) !== '' ? Number(q.get(k)) : null)
  const sky = q.get('sky')
  const lean = q.get('lean')?.split(',').map(Number)
  return {
    sky: sky === 'ktx2' || sky === 'cube' || sky === 'jpg' || sky === 'legacy' ? sky : null,
    tier: q.get('tier') ?? '8k-uastc',
    world: q.get('world'),
    asset: q.get('asset'),
    pano: q.get('pano'),
    nograd: q.get('nograd') === '1',
    depth: q.get('depth') === '1',
    edge: num('edge') ?? 0,
    dmap: q.get('dmap') === 'raw' ? 'depth-raw' : 'depth',
    yaw: num('yaw'),
    pitch: num('pitch'),
    fov: num('fov'),
    lean: lean && lean.length === 2 && lean.every(Number.isFinite) ? [lean[0], lean[1]] : null,
    still: q.get('still') === '1',
    ctl: q.get('ctl') === '1',
  }
}

export const SKY_SPIKE: SkySpikeFlags = parse()

/** Spike-only debug surface for the screenshot driver (scripts/spike/sky-shoot.mjs). */
export interface SkySpikeHandle {
  metrics: Record<string, unknown>
  view?: (v: { yaw?: number; pitch?: number; fov?: number; lean?: [number, number] }) => void
  renderer?: unknown
}

export function spikeHandle(): SkySpikeHandle {
  const w = window as unknown as { __skySpike?: SkySpikeHandle }
  if (!w.__skySpike) w.__skySpike = { metrics: {} }
  return w.__skySpike
}

/** Record a metric and echo it as a console.warn (production builds strip console.log). */
export function spikeMetric(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  spikeHandle().metrics[key] = value
  console.warn(`[sky-spike] ${key} ${JSON.stringify(value)}`)
}
