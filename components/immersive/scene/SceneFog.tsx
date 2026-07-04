// Aerial perspective via the r185 scene.fogNode: a range fog whose color and reach follow the
// active world's haze token. One fog node is mounted for the lifetime of the canvas and driven
// entirely through uniforms — swapping the node itself would change every material's pipeline
// cache key and recompile the scene on each world switch. Vacuum worlds (haze 0) just push the
// far plane out past everything instead of unsetting the node, for the same reason.
//
// What the fog is allowed to touch is as important as what it does: the panorama sphere, the
// CRT screen stack, and all windfoil text opt out with material.fog = false — the backdrop
// would take a flat color wash (it's all at one radius) and emissive UI must never haze. The
// fog exists for the things IN the world: dock chassis at arm's length (untouched, near < 6),
// game spheres mid-flight, and any future set dressing.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { fog, rangeFogFactor, uniform } from 'three/tsl'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { worldById } from '@/lib/immersive/worlds'

const FOG_NEAR = 6
/** haze 1 → fog closes in at 26m; haze 0 → pushed to 500m (nothing renderable is out there). */
const farForHaze = (haze: number) => (haze <= 0.01 ? 500 : 70 - haze * 44)
/** Haze color: the world's ambient tint pulled way down toward the void — night air, not milk. */
const colorForWorld = (id: string) => {
  const w = worldById(id)
  return new THREE.Color(w.ambient.color).multiplyScalar(0.16 + w.haze * 0.1)
}

type FogScene = THREE.Scene & { fogNode: ReturnType<typeof fog> | null }

export function SceneFog() {
  const scene = useThree((s) => s.scene) as FogScene
  const worldId = useImmersiveStore((s) => s.worldId)

  const uniforms = useMemo(
    () => ({
      color: uniform(new THREE.Color('#020403')),
      far: uniform(500),
    }),
    []
  )

  useEffect(() => {
    scene.fogNode = fog(uniforms.color, rangeFogFactor(FOG_NEAR, uniforms.far))
    return () => {
      scene.fogNode = null
    }
  }, [scene, uniforms])

  // Glide toward the new world's haze in step with the panorama crossfade instead of snapping.
  const target = useRef({ color: new THREE.Color('#020403'), far: 500 })
  useEffect(() => {
    target.current = { color: colorForWorld(worldId), far: farForHaze(worldById(worldId).haze) }
  }, [worldId])

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-2.2 * delta)
    uniforms.color.value.lerp(target.current.color, k)
    uniforms.far.value += (target.current.far - uniforms.far.value) * k
  })

  return null
}
