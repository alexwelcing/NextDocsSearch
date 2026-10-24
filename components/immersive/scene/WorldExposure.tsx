// Per-world panorama exposure (WorldDef.exposure), applied at the scene level. The panorama
// sphere owns its meshes, so this finds the sky layers by what makes them unique in the scene —
// an equirect-mapped `map` — and sets each layer's material color, which multiplies the map and
// is a plain uniform (no pipeline recompile). Gain is resolved per TEXTURE, not per current
// world, so during a crossfade the outgoing and incoming layers each keep their own world's gain.
// Everything else (windfoil text, CRT, motes, lit dock) never sees it: one tone map, one UI look.
//
// This leans on PanoramaSphere's current shape: each sky layer a mesh at most two levels below
// the scene (scene > drift group > layer), with a MeshBasicMaterial whose `map` is the loaded
// equirect texture, whose image `src` is the registry URL. When that shape changes the gain
// would quietly fall back to 1, so both failure modes warn once instead (see below).
// TODO: move the gain into PanoramaSphere itself (or the H1 sky node's exposure uniforms) once
// that file is free to edit; this walk exists only because another stream owns it.

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { worldByPanorama } from '@/lib/immersive/worlds'
import { useImmersiveStore } from '@/stores/immersiveStore'

/** Consecutive frames the scene may be ready with no sky layer found before that's reported —
 *  rides out the frame or two between sceneReady and the layer's mount. */
const MISSING_LAYER_FRAMES = 60

const gainByTexture = new WeakMap<THREE.Texture, number>()
const warned = { unattributed: false, missing: false }

function panoramaGain(texture: THREE.Texture): number {
  const cached = gainByTexture.get(texture)
  if (cached !== undefined) return cached
  const image = texture.image as { src?: string } | null | undefined
  if (!image) return 1 // not loaded yet — resolve on a later frame
  const world = image.src ? worldByPanorama(image.src, window.location.href) : undefined
  if (!world && !warned.unattributed) {
    warned.unattributed = true
    console.warn(
      `[arc] WorldExposure: panorama texture ${image.src || '(no src)'} maps to no world, so ` +
        'its WorldDef.exposure is not applied. Did PanoramaSphere change how it loads skies?'
    )
  }
  const gain = world?.exposure ?? 1
  gainByTexture.set(texture, gain)
  return gain
}

/** Applies the gain if `object` is a sky layer; returns whether it was one. */
function expose(object: THREE.Object3D): boolean {
  const mesh = object as THREE.Mesh
  if (!mesh.isMesh) return false
  const material = mesh.material as THREE.MeshBasicMaterial
  const map = material.map
  if (!map || map.mapping !== THREE.EquirectangularReflectionMapping) return false
  const gain = panoramaGain(map)
  if (material.color.r !== gain) material.color.setScalar(gain)
  return true
}

export function WorldExposure() {
  const scene = useThree((s) => s.scene)
  const missingFor = useRef(0)

  // Two levels deep covers the sphere layers (scene > drift group > layer mesh) without walking
  // every text mesh in the dock each frame.
  useFrame(() => {
    let layers = 0
    for (const child of scene.children) {
      if (expose(child)) layers++
      for (const grandchild of child.children) if (expose(grandchild)) layers++
    }
    if (layers > 0 || warned.missing || !useImmersiveStore.getState().sceneReady) {
      missingFor.current = 0
      return
    }
    if (++missingFor.current < MISSING_LAYER_FRAMES) return
    warned.missing = true
    console.warn(
      '[arc] WorldExposure: the scene is ready but no equirect-mapped sky layer sits within two ' +
        'levels of it, so per-world exposure is off. Expected only if the panorama failed to ' +
        'load; otherwise PanoramaSphere changed shape (wrapper group, non-basic material).'
    )
  })

  return null
}
