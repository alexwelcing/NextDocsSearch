// Per-world panorama exposure (WorldDef.exposure), applied at the scene level. The panorama
// sphere owns its meshes, so this finds the sky layers by what makes them unique in the scene —
// an equirect-mapped `map` — and sets each layer's material color, which multiplies the map and
// is a plain uniform (no pipeline recompile). Gain is resolved per TEXTURE, not per current
// world, so during a crossfade the outgoing and incoming layers each keep their own world's gain.
// Everything else (windfoil text, CRT, motes, lit dock) never sees it: one tone map, one UI look.

import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { worldByPanorama } from '@/lib/immersive/worlds'

const gainByTexture = new WeakMap<THREE.Texture, number>()

function panoramaGain(texture: THREE.Texture): number {
  const cached = gainByTexture.get(texture)
  if (cached !== undefined) return cached
  const src = (texture.image as { src?: string } | null | undefined)?.src
  if (!src) return 1 // not decoded yet — resolve on a later frame
  const gain = worldByPanorama(new URL(src, window.location.href).pathname)?.exposure ?? 1
  gainByTexture.set(texture, gain)
  return gain
}

function expose(object: THREE.Object3D) {
  const mesh = object as THREE.Mesh
  if (!mesh.isMesh) return
  const material = mesh.material as THREE.MeshBasicMaterial
  const map = material.map
  if (!map || map.mapping !== THREE.EquirectangularReflectionMapping) return
  const gain = panoramaGain(map)
  if (material.color.r !== gain) material.color.setScalar(gain)
}

export function WorldExposure() {
  const scene = useThree((s) => s.scene)

  // Two levels deep covers the sphere layers (scene > drift group > layer mesh) without walking
  // every text mesh in the dock each frame.
  useFrame(() => {
    for (const child of scene.children) {
      expose(child)
      for (const grandchild of child.children) expose(grandchild)
    }
  })

  return null
}
