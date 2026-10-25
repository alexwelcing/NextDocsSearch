// SPIKE (H1 sky, do not merge as-is): high-resolution sky delivery experiment, mounted by
// PanoramaSphere only when ?sky= is present (see lib/immersive/sky/spikeFlags.ts).
//
//  - ?sky=ktx2  1024 WebP preview -> 8K/4K KTX2 (UASTC or ETC1S) 2D equirect, swapped in place.
//  - ?sky=jpg   the same direction sampler over today's 2048 JPEG (A/B baseline).
//  - &depth=1   dense sphere displaced in TSL by an 8-bit disparity map (head-lean parallax).
//  - ?sky=cube  minimal repro: KTX2 cubemap -> CompressedCubeTexture under WebGPURenderer r185.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { Discard, Fn, cubeTexture, normalize, positionLocal, texture } from 'three/tsl'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { worldById } from '@/lib/immersive/worlds'
import { SKY_SPIKE, spikeMetric } from '@/lib/immersive/sky/spikeFlags'
import { depthDisplacement, makeDepthUniforms, sampleEquirect } from './skyNodes'

const RADIUS = 60
const NEAR = 4 // depth map 1.0 -> 4 units; 0.0 -> RADIUS
const SEGMENTS_FLAT: [number, number] = [64, 32]
const SEGMENTS_DEPTH: [number, number] = [1024, 512]
const STRETCH_DISCARD = 1.18

let ktx2: KTX2Loader | null = null
function ktx2Loader(renderer: THREE.WebGPURenderer): KTX2Loader {
  if (!ktx2) {
    ktx2 = new KTX2Loader().setTranscoderPath('/basis/')
    // detectSupport reads renderer.hasFeature(), so it must run after renderer.init() — the
    // R3F gl factory awaits init before the scene mounts, so it is safe here.
    ktx2.detectSupport(renderer as unknown as Parameters<KTX2Loader['detectSupport']>[0])
    const cfg = (ktx2 as unknown as { workerConfig: Record<string, boolean> }).workerConfig
    spikeMetric('ktx2.support', cfg)
  }
  return ktx2
}

const FORMAT_NAMES: Record<number, string> = {
  [THREE.RGBA_BPTC_Format]: 'BC7 (bptc)',
  [THREE.RGBA_ASTC_4x4_Format]: 'ASTC 4x4',
  [THREE.RGB_ETC1_Format]: 'ETC1',
  [THREE.RGB_ETC2_Format]: 'ETC2 RGB',
  [THREE.RGBA_ETC2_EAC_Format]: 'ETC2 RGBA',
  [THREE.RGBAFormat]: 'RGBA8 (uncompressed fallback)',
}
const BYTES_PER_PX: Record<number, number> = {
  [THREE.RGBA_BPTC_Format]: 1,
  [THREE.RGBA_ASTC_4x4_Format]: 1,
  [THREE.RGB_ETC1_Format]: 0.5,
  [THREE.RGB_ETC2_Format]: 0.5,
  [THREE.RGBA_ETC2_EAC_Format]: 1,
  [THREE.RGBAFormat]: 4,
}

/** Sum the actual mip chain the loader produced (bytes of transcoded GPU data). */
function gpuBytes(tex: THREE.CompressedTexture): number {
  return (tex.mipmaps as Array<{ data: ArrayBufferView }>).reduce(
    (n, m) => n + m.data.byteLength,
    0
  )
}

async function loadKtx2(
  renderer: THREE.WebGPURenderer,
  url: string
): Promise<THREE.CompressedTexture> {
  const t0 = performance.now()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  const bytes = buf.byteLength // the transcoder worker detaches the buffer
  const t1 = performance.now()
  const tex = await new Promise<THREE.CompressedTexture>((resolve, reject) =>
    ktx2Loader(renderer).parse(buf, (t) => resolve(t as THREE.CompressedTexture), reject)
  )
  const t2 = performance.now()
  const w = tex.image.width as number
  const h = tex.image.height as number
  const fmt = tex.format as number
  spikeMetric('ktx2.load', {
    url,
    bytes,
    fetchMs: Math.round(t1 - t0),
    transcodeMs: Math.round(t2 - t1),
    size: `${w}x${h}`,
    mips: tex.mipmaps?.length,
    format: FORMAT_NAMES[fmt] ?? fmt,
    gpuMiB: +(gpuBytes(tex) / 2 ** 20).toFixed(1),
    estMiB: +(((w * h * (BYTES_PER_PX[fmt] ?? 4)) / 2 ** 20) * (4 / 3)).toFixed(1),
  })
  return tex
}

async function loadImage(url: string, colorSpace: string): Promise<THREE.Texture> {
  const t0 = performance.now()
  const tex = await new THREE.TextureLoader().loadAsync(url)
  tex.flipY = false // the sampler assumes row 0 = zenith (see skyNodes.dirToEquirect)
  tex.colorSpace = colorSpace
  spikeMetric('image.load', { url, ms: Math.round(performance.now() - t0) })
  return tex
}

function placeholder(colorSpace: string): THREE.Texture {
  const t = new THREE.DataTexture(new Uint8Array([2, 4, 3, 255]), 1, 1)
  // Must be *filterable* like the real sky: three's WGSL builder decides per texture whether
  // to declare a sampler binding (Nearest+Nearest = unfilterable = no sampler), and a
  // grad/level sample against a sampler-less placeholder fails WGSL validation. Matching
  // filterability also keeps a later .value swap from changing the bind group layout.
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.colorSpace = colorSpace
  t.needsUpdate = true
  return t
}

function configureSky(tex: THREE.Texture, renderer: THREE.WebGPURenderer) {
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.anisotropy = renderer.getMaxAnisotropy()
  tex.needsUpdate = true
}

export function SkySpike() {
  return SKY_SPIKE.sky === 'cube' ? <CubeRepro /> : <EquirectSky />
}

function EquirectSky() {
  const renderer = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const worldId = useImmersiveStore((s) => s.worldId)
  const setSceneReady = useImmersiveStore((s) => s.setSceneReady)
  const reducedMotion = useImmersiveStore((s) => s.reducedMotion)
  const world = worldById(worldId)
  const asset = SKY_SPIKE.asset ?? worldId
  const group = useRef<THREE.Group>(null)
  const swappedAt = useRef<number | null>(null)
  const depth = SKY_SPIKE.depth
  const edge = SKY_SPIKE.edge

  const sky = useMemo(() => {
    const colorTex = texture(placeholder(THREE.SRGBColorSpace))
    const depthTex = texture(placeholder(THREE.NoColorSpace))
    const segs = depth ? SEGMENTS_DEPTH : SEGMENTS_FLAT
    const mat = new THREE.MeshBasicNodeMaterial({
      side: depth ? THREE.DoubleSide : THREE.BackSide,
      depthWrite: depth,
      fog: false,
      toneMapped: false,
    })
    const uniforms = makeDepthUniforms(NEAR, RADIUS)
    if (depth) {
      // Placeholder depth is black -> disparity 0 -> radius = far, i.e. a flat shell until the
      // map arrives.
      const d = depthDisplacement(depthTex, uniforms, segs)
      mat.positionNode = d.position
      // Edge mode >= 1: drop triangles that straddle a depth discontinuity (the rubber sheet).
      mat.colorNode =
        edge >= 1
          ? Fn(() => {
              Discard(d.stretch.greaterThan(STRETCH_DISCARD))
              return sampleEquirect(colorTex, normalize(positionLocal))
            })()
          : sampleEquirect(colorTex, normalize(positionLocal))
    } else {
      mat.colorNode = sampleEquirect(colorTex, normalize(positionLocal), 1, SKY_SPIKE.nograd)
    }
    const geo = new THREE.SphereGeometry(RADIUS, segs[0], segs[1])
    // Hole fill for edge mode 2: a flat far shell, defocused, behind the displaced mesh.
    let shell: { geo: THREE.SphereGeometry; mat: THREE.MeshBasicNodeMaterial } | null = null
    if (depth && edge >= 2) {
      const smat = new THREE.MeshBasicNodeMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      })
      smat.colorNode = sampleEquirect(colorTex, normalize(positionLocal), 6)
      shell = { geo: new THREE.SphereGeometry(RADIUS + 2, 64, 32), mat: smat }
    }
    return { colorTex, depthTex, mat, geo, shell, uniforms }
  }, [depth, edge])

  useEffect(
    () => () => {
      sky.mat.dispose()
      sky.geo.dispose()
      sky.shell?.mat.dispose()
      sky.shell?.geo.dispose()
    },
    [sky]
  )

  useEffect(() => {
    if (SKY_SPIKE.world && worldId !== SKY_SPIKE.world) return // wait for the override
    let live = true
    const t0 = performance.now()
    const swap = (node: typeof sky.colorTex, tex: THREE.Texture) => {
      const old = node.value as THREE.Texture
      node.value = tex
      if (old !== tex) old.dispose()
    }
    ;(async () => {
      try {
        if (SKY_SPIKE.sky === 'jpg') {
          const tex = await loadImage(SKY_SPIKE.pano ?? world.panorama, THREE.SRGBColorSpace)
          if (!live) return tex.dispose()
          configureSky(tex, renderer)
          swap(sky.colorTex, tex)
          setSceneReady(true)
        } else {
          const preview = await loadImage(`/spike/${asset}-preview-1024.webp`, THREE.SRGBColorSpace)
          if (!live) return preview.dispose()
          configureSky(preview, renderer)
          swap(sky.colorTex, preview)
          setSceneReady(true)
          spikeMetric('sky.previewMs', Math.round(performance.now() - t0))
          const full = await loadKtx2(renderer, `/images/spike-sky/${asset}-${SKY_SPIKE.tier}.ktx2`)
          if (!live) return full.dispose()
          configureSky(full, renderer)
          // Upload the whole mip chain now (writeTexture is synchronous on the main thread) so
          // the cost is attributable rather than hidden inside the next render.
          const tu = performance.now()
          renderer.initTexture(full)
          spikeMetric('sky.uploadMs', +(performance.now() - tu).toFixed(1))
          swap(sky.colorTex, full)
          swappedAt.current = 0
          spikeMetric('sky.fullMs', Math.round(performance.now() - t0))
        }
        if (depth) {
          const d = await loadImage(`/spike/${worldId}-${SKY_SPIKE.dmap}.png`, THREE.NoColorSpace)
          if (!live) return d.dispose()
          d.wrapS = THREE.RepeatWrapping
          d.wrapT = THREE.ClampToEdgeWrapping
          d.generateMipmaps = false
          d.minFilter = THREE.LinearFilter
          d.magFilter = THREE.LinearFilter
          d.needsUpdate = true
          swap(sky.depthTex, d)
          spikeMetric('depth.ready', { ms: Math.round(performance.now() - t0) })
        }
      } catch (err) {
        console.error('[sky-spike] load failed:', err)
        setSceneReady(true)
      }
    })()
    return () => {
      live = false
    }
  }, [worldId, asset, world.panorama, renderer, sky, depth, setSceneReady])

  useFrame((_, delta) => {
    if (group.current && !reducedMotion && !SKY_SPIKE.still) {
      group.current.rotation.y += world.drift * delta * 10
    }
    if (swappedAt.current !== null) {
      // Frame delta of the frame *after* the first render with the new texture (pipeline /
      // bind-group rebuild for the swapped texture lands there).
      if (swappedAt.current++ === 1) {
        spikeMetric('sky.swapFrameMs', Math.round(delta * 1000))
        swappedAt.current = null
      }
    }
  })

  return (
    <group ref={group}>
      <mesh geometry={sky.geo} material={sky.mat} renderOrder={-1} frustumCulled={false} />
      {sky.shell && (
        <mesh
          geometry={sky.shell.geo}
          material={sky.shell.mat}
          renderOrder={-2}
          frustumCulled={false}
        />
      )}
    </group>
  )
}

/**
 * Minimal repro for the critique's claim: a 6-face KTX2 (faceCount 6) becomes a
 * CompressedCubeTexture, which r185's WebGPU backend cannot size, mip or upload.
 * ?sky=cube&fmt=uastc|etc1s ; &ctl=1 renders an uncompressed CubeTexture with the same labels
 * through the identical node path (proves the cube sampling itself is fine).
 */
function CubeRepro() {
  const renderer = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const setSceneReady = useImmersiveStore((s) => s.setSceneReady)
  const q = new URLSearchParams(window.location.search)
  const fmt = q.get('fmt') ?? 'uastc'
  const shim = q.get('shim') === '1'

  const mat = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    })
    return m
  }, [])

  useEffect(() => {
    let live = true
    ;(async () => {
      let tex: THREE.Texture
      if (SKY_SPIKE.ctl) {
        tex = labelledCube()
      } else {
        try {
          tex = await new Promise<THREE.Texture>((resolve, reject) =>
            ktx2Loader(renderer).load(`/spike/test-cube-${fmt}.ktx2`, resolve, undefined, reject)
          )
        } catch (err) {
          spikeMetric('cube.loadError', String(err))
          setSceneReady(true)
          return
        }
      }
      if (!live) return
      if (shim && (tex as { isCompressedCubeTexture?: boolean }).isCompressedCubeTexture) {
        shimCompressedCube(tex as THREE.CompressedTexture)
      }
      const t = tex as THREE.CubeTexture & { mipmaps?: unknown[]; image: unknown[] }
      spikeMetric('cube.texture', {
        type: t.constructor.name,
        isCompressedCubeTexture: (t as { isCompressedCubeTexture?: boolean })
          .isCompressedCubeTexture,
        isCubeTexture: t.isCubeTexture,
        isCompressedTexture: (t as { isCompressedTexture?: boolean }).isCompressedTexture,
        mipmaps: t.mipmaps === undefined ? 'undefined' : t.mipmaps.length,
        faces: Array.isArray(t.image) ? t.image.length : typeof t.image,
        face0: (() => {
          const f = Array.isArray(t.image)
            ? (t.image[0] as { width?: number; height?: number; mipmaps?: unknown[] })
            : null
          return f ? { w: f.width, h: f.height, mips: f.mipmaps?.length } : null
        })(),
        format: FORMAT_NAMES[t.format as number] ?? t.format,
      })
      // Drive the upload directly so the failure is attributable (initTexture -> Textures ->
      // WebGPUTextureUtils), then also try to render with it.
      try {
        renderer.initTexture(tex)
        spikeMetric('cube.initTexture', 'ok')
      } catch (err) {
        const e = err as Error
        spikeMetric('cube.initTexture', {
          error: `${e.name}: ${e.message}`,
          at: (e.stack ?? '').split('\n').slice(1, 4).join(' | ').slice(0, 220),
        })
      }
      mat.colorNode = cubeTexture(tex as THREE.CubeTexture, normalize(positionLocal))
      mat.needsUpdate = true
      setSceneReady(true)
    })()
    return () => {
      live = false
    }
  }, [renderer, mat, fmt, shim, setSceneReady])

  return (
    <mesh renderOrder={-1} frustumCulled={false} material={mat}>
      <sphereGeometry args={[RADIUS, 64, 32]} />
    </mesh>
  )
}

type Mip = { data: Uint8Array; width: number; height: number }

/**
 * Loader-side shim (option (a) feasibility, no three patch): reshape KTX2Loader's
 * CompressedCubeTexture so r185's *compressed array* upload path writes it. Each level's six
 * face payloads are concatenated (writeTextureLayer offsets by layer * bytesPerImage), the face
 * array gets width/height so Textures.getSize stops returning 1x1, and one level is withheld
 * because Textures.updateTexture adds a level to every cube with mipmaps (the uncompressed-cube
 * convention) — so the 1x1 tail is left unwritten. A real fix belongs in Textures.js +
 * WebGPUTextureUtils.js (isCompressedCubeTexture branches).
 */
function shimCompressedCube(tex: THREE.CompressedTexture) {
  const faces = tex.image as unknown as Array<{ width: number; height: number; mipmaps: Mip[] }> & {
    width?: number
    height?: number
  }
  const n = faces[0].mipmaps.length
  const mips: Mip[] = []
  for (let i = 0; i < Math.max(1, n - 1); i++) {
    const parts = faces.map((f) => f.mipmaps[i].data)
    const data = new Uint8Array(parts.reduce((a, p) => a + p.byteLength, 0))
    let o = 0
    for (const p of parts) {
      data.set(new Uint8Array(p.buffer, p.byteOffset, p.byteLength), o)
      o += p.byteLength
    }
    mips.push({ data, width: faces[0].mipmaps[i].width, height: faces[0].mipmaps[i].height })
  }
  ;(tex as unknown as { mipmaps: Mip[] }).mipmaps = mips
  faces.width = faces[0].width
  faces.height = faces[0].height
  tex.needsUpdate = true
}

function labelledCube(): THREE.CubeTexture {
  const faces = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'].map((label, i) => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    g.fillStyle = ['#c0392b', '#16a085', '#2980b9', '#8e44ad', '#d35400', '#27ae60'][i]
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = '#fff'
    g.font = 'bold 110px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(label, 128, 128)
    g.font = '28px sans-serif'
    g.fillText('top', 128, 24)
    return c
  })
  const t = new THREE.CubeTexture(faces as unknown as HTMLImageElement[])
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}
