// GPU-driven atmosphere: a shell of drifting phosphor motes around the viewer. All motion runs in
// the vertex stage (hash of instanceIndex + time), so the CPU cost is one draw call.
//
// Built ONCE, sized for the busiest world: a world switch only retargets uniforms (tint, depth
// fade) and the instanced draw count, so it never compiles a new pipeline or leaks the old mesh.

import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import {
  cos,
  float,
  hash,
  instanceIndex,
  positionLocal,
  positionView,
  sin,
  smoothstep,
  time,
  uniform,
  vec3,
  vec4,
} from 'three/tsl'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { WORLDS, worldById, type WorldDef } from '@/lib/immersive/worlds'

const TAU = Math.PI * 2
/** Instance capacity: the registry's largest mote count. Worlds draw a prefix of it. */
const MAX_MOTES = Math.max(...WORLDS.map((w) => w.particles.count))
const LOW_QUALITY_FRACTION = 0.4
/** Tint / depth-fade glide rate between worlds, per second. */
const RETARGET_RATE = 2.5

function tintOf(world: WorldDef, out = new THREE.Vector3()): THREE.Vector3 {
  const c = new THREE.Color(world.particles.color)
  return out.set(c.r, c.g, c.b)
}

/** Far-shell dimming strength. A floor on the haze term keeps a whisper of depth cueing even in
 *  vacuum worlds — dimmer reads as farther. */
function depthDimOf(world: WorldDef): number {
  return 0.85 * Math.max(world.haze, 0.25)
}

function buildMotes(world: WorldDef, count: number) {
  const geometry = new THREE.OctahedronGeometry(0.05, 0)
  const material = new THREE.NodeMaterial()

  // A Vector3 (not Color) uniform: uniform(Color) infers a 'color'-typed node, and pinned TSL's
  // overloads don't let a plain type-string argument relabel it to 'vec3' anymore. Building the
  // uniform from a Vector3 gets a genuinely vec3-typed node directly, one node simpler than the
  // old uniform(Color) + vec3()-conversion pair.
  const tint = uniform(tintOf(world))
  const dimStrength = uniform(depthDimOf(world))

  // Deterministic per-instance randoms.
  const h1 = hash(instanceIndex)
  const h2 = hash(instanceIndex.add(1013))
  const h3 = hash(instanceIndex.add(89117))
  const h4 = hash(instanceIndex.add(552211))

  // Spherical shell placement: radius 6..28, full azimuth, biased toward the horizon band.
  const radius = float(6).add(h1.mul(22))
  const theta = h2.mul(TAU)
  const phi = float(Math.PI / 2).add(h3.sub(0.5).mul(1.9))

  // Slow orbital drift + vertical bob, phase-offset per mote.
  const t = time.mul(0.05).add(h4.mul(TAU))
  const azimuth = theta.add(t.mul(h3.add(0.3)))
  const bob = sin(time.mul(0.4).add(h1.mul(TAU))).mul(0.8)

  const center = vec3(
    radius.mul(sin(phi)).mul(cos(azimuth)),
    radius.mul(cos(phi)).add(bob),
    radius.mul(sin(phi)).mul(sin(azimuth))
  )
  const scalePulse = float(0.6).add(sin(time.mul(1.3).add(h2.mul(TAU))).mul(0.4))
  material.positionNode = center.add(positionLocal.mul(scalePulse.add(h1.mul(1.2))))

  // Additive phosphor glow, twinkling, dimmed with view depth. Scene fog is deliberately OFF
  // here: fog mixes toward the haze color, which under additive blending ADDS haze wherever a
  // mote is instead of attenuating it. Aerial perspective for additive sprites is a fade to
  // black, and hazier worlds swallow the far shell sooner (dimStrength, per world).
  const viewDepth = positionView.z.negate()
  const depthDim = smoothstep(float(8), float(28), viewDepth).mul(dimStrength).oneMinus()
  const twinkle = float(0.35).add(sin(time.mul(2.1).add(h4.mul(TAU))).mul(0.25))
  material.colorNode = vec4(tint.mul(twinkle).mul(depthDim), 1)
  material.transparent = true
  material.blending = THREE.AdditiveBlending
  material.depthWrite = false
  material.fog = false

  const instanced = new THREE.InstancedMesh(geometry, material, MAX_MOTES)
  instanced.frustumCulled = false
  instanced.renderOrder = 1
  instanced.count = Math.min(count, MAX_MOTES)
  return { instanced, geometry, material, tint, dimStrength }
}

export function Atmosphere() {
  const worldId = useImmersiveStore((s) => s.worldId)
  const quality = useImmersiveStore((s) => s.quality)
  const world = worldById(worldId)
  const count = Math.floor(world.particles.count * (quality === 'low' ? LOW_QUALITY_FRACTION : 1))

  // Lazy state initializer = built exactly once, seeded with the starting world (no fade-in).
  const [motes] = useState(() => buildMotes(world, count))
  const target = useRef({ tint: tintOf(world), dim: depthDimOf(world) })

  // <primitive> objects are never disposed by R3F — release the GPU resources ourselves.
  useEffect(
    () => () => {
      motes.instanced.dispose()
      motes.geometry.dispose()
      motes.material.dispose()
    },
    [motes]
  )

  // Draw count is instant (hash placement keeps any prefix evenly spread); colour glides.
  useEffect(() => {
    motes.instanced.count = Math.min(count, MAX_MOTES)
  }, [motes, count])

  useEffect(() => {
    tintOf(world, target.current.tint)
    target.current.dim = depthDimOf(world)
  }, [world])

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-RETARGET_RATE * delta)
    motes.tint.value.lerp(target.current.tint, k)
    motes.dimStrength.value += (target.current.dim - motes.dimStrength.value) * k
  })

  return <primitive object={motes.instanced} />
}
