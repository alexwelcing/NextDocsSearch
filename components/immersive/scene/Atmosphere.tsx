// GPU-driven atmosphere: a shell of drifting phosphor motes around the viewer. All motion runs in
// the vertex stage (hash of instanceIndex + time), so the CPU cost is one draw call.

import { useMemo } from 'react'
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
import { worldById } from '@/lib/immersive/worlds'

const TAU = Math.PI * 2

export function Atmosphere() {
  const worldId = useImmersiveStore((s) => s.worldId)
  const quality = useImmersiveStore((s) => s.quality)
  const world = worldById(worldId)
  const count = Math.floor(world.particles.count * (quality === 'low' ? 0.4 : 1))

  const mesh = useMemo(() => {
    const geometry = new THREE.OctahedronGeometry(0.05, 0)
    const material = new THREE.NodeMaterial()

    // A Vector3 (not Color) uniform: uniform(Color) infers a 'color'-typed node, and pinned TSL's
    // overloads don't let a plain type-string argument relabel it to 'vec3' anymore. Building the
    // uniform from a Vector3 gets a genuinely vec3-typed node directly, one node simpler than the
    // old uniform(Color) + vec3()-conversion pair.
    const tintColor = new THREE.Color(world.particles.color)
    const tint = uniform(new THREE.Vector3(tintColor.r, tintColor.g, tintColor.b))

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
    // black, and hazier worlds swallow the far shell sooner. A floor on the haze term keeps a
    // whisper of depth cueing even in vacuum worlds — dimmer reads as farther.
    const hazeAmt = Math.max(world.haze, 0.25)
    const viewDepth = positionView.z.negate()
    const depthDim = smoothstep(float(8), float(28), viewDepth)
      .mul(0.85 * hazeAmt)
      .oneMinus()
    const twinkle = float(0.35).add(sin(time.mul(2.1).add(h4.mul(TAU))).mul(0.25))
    material.colorNode = vec4(tint.mul(twinkle).mul(depthDim), 1)
    material.transparent = true
    material.blending = THREE.AdditiveBlending
    material.depthWrite = false
    material.fog = false

    const instanced = new THREE.InstancedMesh(geometry, material, count)
    instanced.frustumCulled = false
    instanced.renderOrder = 1
    return { instanced, tint }
  }, [count, world.particles.color, world.haze])

  return <primitive object={mesh.instanced} />
}
