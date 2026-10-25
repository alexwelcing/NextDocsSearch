// Sky v2 loading: one KTX2Loader for the app (created after renderer.init(), which detectSupport
// needs), the image path for previews and legacy JPEGs, the explicit GPU upload, and the memory
// hygiene the H1 spike's verifier asked for:
//  - The transcoder in public/basis/ is version-locked to three: re-copy
//    node_modules/three/examples/jsm/libs/basis/basis_transcoder.{js,wasm} on every three upgrade
//    (transcoder.test.ts fails when they drift).
//  - One transcoder worker, terminated once idle: each worker's WASM heap grows to fit the largest
//    transcode (~140 MB of renderer RSS after an 8K) and never shrinks while it lives.
//  - CPU-side mip data is dropped right after the upload: KTX2Loader keeps the whole transcoded
//    chain in JS memory (42.7 MiB for an 8K) for the life of the texture otherwise.
//  - Upload is explicit (uploadSky → renderer.initTexture) so Sky.tsx can place it where a
//    45-70 ms main-thread write (8K) is not seen: under the boot overlay, inside a world switch's
//    hold, or at a quiet moment — never inside a frame the visitor is steering.

import * as THREE from 'three/webgpu'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'

/** Where public/basis/ is served. */
export const TRANSCODER_PATH = '/basis/'
/** Transcoder workers. Sky tiers load one at a time, so a second worker only buys memory. */
export const WORKER_LIMIT = 1
/** Terminate the worker after this long with nothing to transcode, ms. */
export const WORKER_IDLE_MS = 10_000

type Renderer = THREE.WebGPURenderer

interface LoaderState {
  renderer: Renderer
  ktx2: KTX2Loader
  inflight: number
  idleTimer: ReturnType<typeof setTimeout> | null
}

let state: LoaderState | null = null

/** The app's KTX2Loader, bound to `renderer` (a new renderer — a remounted canvas — replaces it). */
export function skyKtx2Loader(renderer: Renderer): KTX2Loader {
  if (state && state.renderer !== renderer) disposeSkyLoader()
  if (!state) {
    const ktx2 = new KTX2Loader().setTranscoderPath(TRANSCODER_PATH).setWorkerLimit(WORKER_LIMIT)
    // detectSupport reads renderer.hasFeature(), so it must run after renderer.init() — the R3F
    // gl factory awaits init before anything in the scene mounts.
    ktx2.detectSupport(renderer as unknown as Parameters<KTX2Loader['detectSupport']>[0])
    state = { renderer, ktx2, inflight: 0, idleTimer: null }
  }
  return state.ktx2
}

/** Release the loader and its worker (canvas unmount). */
export function disposeSkyLoader(): void {
  if (!state) return
  if (state.idleTimer) clearTimeout(state.idleTimer)
  state.ktx2.dispose()
  state = null
}

interface WorkerConfig {
  astcSupported?: boolean
  bptcSupported?: boolean
  etc2Supported?: boolean
  etc1Supported?: boolean
  dxtSupported?: boolean
}

/** Whether the adapter takes a GPU block format UASTC transcodes to (else RGBA32 fallback). */
export function compressedSkySupport(renderer: Renderer): boolean {
  const cfg = (skyKtx2Loader(renderer) as unknown as { workerConfig: WorkerConfig | null })
    .workerConfig
  return !!(cfg && (cfg.astcSupported || cfg.bptcSupported || cfg.etc2Supported))
}

/** device.limits.maxTextureDimension2D (8192 when the backend doesn't say). */
export function maxTextureSize(renderer: Renderer): number {
  const device = (
    renderer.backend as unknown as { device?: { limits?: { maxTextureDimension2D?: number } } }
  ).device
  return device?.limits?.maxTextureDimension2D ?? 8192
}

function workerBusy() {
  if (!state) return
  state.inflight++
  if (state.idleTimer) clearTimeout(state.idleTimer)
  state.idleTimer = null
}

function workerIdle() {
  const s = state
  if (!s) return
  s.inflight = Math.max(0, s.inflight - 1)
  if (s.inflight > 0) return
  if (s.idleTimer) clearTimeout(s.idleTimer)
  s.idleTimer = setTimeout(() => {
    s.idleTimer = null
    // WorkerPool.dispose() terminates the workers but keeps the creator, so the next transcode
    // starts a fresh one (KTX2Loader.dispose() would revoke the worker source for good). Only
    // safe with nothing in flight: a terminated worker never answers.
    if (state === s && s.inflight === 0) {
      ;(s.ktx2 as unknown as { workerPool: { dispose(): void } }).workerPool.dispose()
    }
  }, WORKER_IDLE_MS)
}

/** Sampler setup shared by every sky tier. Must happen before the upload: the texture is never
 *  touched again afterwards (its CPU data is gone). */
function configureSky(tex: THREE.Texture, renderer: Renderer) {
  tex.flipY = false // row 0 = zenith; compressed textures can't flip, so no tier does
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.anisotropy = renderer.getMaxAnisotropy()
  tex.colorSpace = THREE.SRGBColorSpace
}

/** Thrown for a response that is not a sky (404, HTML error page, …). */
export class SkyFetchError extends Error {}

/** Thrown when a load finishes for a world the visitor already left. */
export class SkyStaleError extends Error {}

/**
 * Fetch and transcode a KTX2 sky tier (UASTC → BC7/ASTC/ETC2 in the worker). `isLive` is checked
 * after the fetch, so a world the visitor already left never queues a transcode.
 */
export async function loadKtx2Sky(
  renderer: Renderer,
  url: string,
  isLive: () => boolean = () => true
): Promise<THREE.CompressedTexture> {
  const loader = skyKtx2Loader(renderer)
  const res = await fetch(url)
  if (!res.ok) throw new SkyFetchError(`${url}: HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  if (!isLive()) throw new SkyStaleError(url)
  workerBusy()
  try {
    const tex = await new Promise<THREE.CompressedTexture>((resolve, reject) =>
      loader.parse(buf, (t) => resolve(t as THREE.CompressedTexture), reject)
    )
    if (
      !(tex as { isCompressedTexture?: boolean }).isCompressedTexture ||
      tex.mipmaps.length === 0
    ) {
      tex.dispose()
      throw new SkyFetchError(`${url}: not a 2D compressed texture`)
    }
    configureSky(tex, renderer)
    return tex
  } finally {
    workerIdle()
  }
}

// Default orientation ('from-image', no flip): row 0 stays the zenith, as in a KTX2, and
// texture.flipY is false everywhere. Decoding happens off the main thread in createImageBitmap.
const imageLoader = new THREE.ImageBitmapLoader().setOptions({ premultiplyAlpha: 'none' })

/** Load a WebP/JPEG sky tier (preview or legacy), decoded off the main thread. */
export async function loadImageSky(renderer: Renderer, url: string): Promise<THREE.Texture> {
  const bitmap = await imageLoader.loadAsync(url)
  const tex = new THREE.Texture(bitmap)
  configureSky(tex, renderer)
  tex.needsUpdate = true
  return tex
}

/** Bytes of GPU memory a sky texture takes once uploaded (block data incl. mips, or RGBA8 +1/3
 *  for generated mips). For the debug handle and leak checks; three's own info counts a
 *  compressed texture as 1 byte. */
export function skyGpuBytes(tex: THREE.Texture): number {
  const mips = (tex as { mipmaps?: Array<{ data?: ArrayBufferView }> }).mipmaps
  if ((tex as { isCompressedTexture?: boolean }).isCompressedTexture && mips?.length) {
    return mips.reduce((n, m) => n + (m.data?.byteLength ?? 0), 0)
  }
  const img = tex.image as { width?: number; height?: number } | null
  return Math.round((img?.width ?? 0) * (img?.height ?? 0) * 4 * (4 / 3))
}

const EMPTY = new Uint8Array(0)

/**
 * Upload a sky texture now (synchronous writeTexture of the whole mip chain on the main thread),
 * then drop its CPU copy. Returns the upload time in ms and the GPU bytes it took. The texture
 * must not be modified afterwards: a later needsUpdate would have nothing left to upload.
 */
export function uploadSky(renderer: Renderer, tex: THREE.Texture): { ms: number; bytes: number } {
  const bytes = skyGpuBytes(tex)
  const t0 = performance.now()
  renderer.initTexture(tex)
  const ms = performance.now() - t0
  releaseCpuCopy(tex)
  return { ms, bytes }
}

/** Free a sky texture's CPU-side pixels once the GPU has them (see uploadSky). */
export function releaseCpuCopy(tex: THREE.Texture): void {
  const mips = (
    tex as { mipmaps?: Array<{ data: ArrayBufferView; width: number; height: number }> }
  ).mipmaps
  if ((tex as { isCompressedTexture?: boolean }).isCompressedTexture && mips) {
    // Keep the level list (three sizes the GPU texture from it); only the payloads go.
    for (const m of mips) m.data = EMPTY
    return
  }
  const img = tex.image as ImageBitmap | null
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) img.close()
}
