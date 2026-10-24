// Full-frame post: bloom + a lens fringe confined to the outer edge of the frame + fine grain,
// via the r185 RenderPipeline (the PostProcessing rename). Mounted only above 'low' quality —
// unmounting hands the frame back to R3F's automatic render loop.
//
// Color-pipeline note (why this is safe for the site's look): the WebGPU renderer never tone
// maps per material — every direct frame ALREADY renders linear into an internal framebuffer
// target and gets Neutral tone mapping + sRGB applied by a full-frame output quad
// (Renderer._renderOutput; material.toneMapped doesn't exist in this backend). RenderPipeline
// reproduces exactly that topology — pass() renders the scene linear, outputNode composites, and
// the final quad applies the same renderOutput transform — so windfoil text, the panorama, and
// the CRT stack come through with precisely their direct-path colors; the effects sit in between.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import {
  Fn,
  fract,
  pass,
  rand,
  screenSize,
  smoothstep,
  time,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'

// Tuned for restraint: the scene is mostly dark with small bright emitters (motes, phosphor
// text, panorama highlights) — bloom past ~0.4 turns the CRT into soup.
const BLOOM_STRENGTH = 0.32
const BLOOM_RADIUS = 0.25
const BLOOM_THRESHOLD = 0.78
// Lateral chromatic aberration as lens character, never as a defect on anything you read: the
// fringe is exactly zero inside a circle CA_INNER screen-heights from the centre (the title card,
// the summon chip, the dock and every modal live there) and eases in to CA_SHIFT of the
// centre-to-edge vector at CA_OUTER — about 1.5 px per channel at the left/right edge of a 1600 px
// frame. (The stock ChromaticAberrationNode is a constant per-channel magnification: it fringed
// the frame centre too, splitting windfoil glyphs into red/blue ghosts, and it costs a
// full-screen render-to-texture of its input on top.)
const CA_INNER = 0.45
const CA_OUTER = 1.0
const CA_SHIFT = 0.0021
// Zero-mean luminance grain, ±GRAIN/2. (FilmNode only ever brightens — +6% on average at the old
// 0.11 — and its per-pixel noise swamped the glyph edges.)
const GRAIN = 0.05

export function PostFX() {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  const { pipeline, scenePass } = useMemo(() => {
    const scenePass = pass(scene, camera)
    const sceneColor = scenePass.getTextureNode('output')
    const bloomed = bloom(scenePass, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD)

    const lens = Fn(() => {
      const st = uv()
      const centered = st.sub(0.5)
      // radius in screen heights, so the clear zone is a circle whatever the aspect
      const radius = vec2(centered.x.mul(screenSize.x.div(screenSize.y)), centered.y).length()
      const shift = centered.mul(smoothstep(CA_INNER, CA_OUTER, radius).mul(CA_SHIFT))
      const base = sceneColor.sample(st)
      const fringed = vec3(
        sceneColor.sample(st.add(shift)).r,
        base.g,
        sceneColor.sample(st.sub(shift)).b
      )
      const grain = rand(fract(st.add(time)))
        .sub(0.5)
        .mul(GRAIN)
        .add(1)
      return vec4(fringed.add(bloomed.rgb).mul(grain), base.a.add(bloomed.a))
    })

    const pipeline = new THREE.RenderPipeline(gl)
    pipeline.outputNode = lens()
    return { pipeline, scenePass }
  }, [gl, scene, camera])

  useEffect(() => {
    return () => {
      // dispose() only covers the composite quad — the pass's scene render target is ours.
      pipeline.dispose()
      scenePass.dispose()
    }
  }, [pipeline, scenePass])

  // Priority 1 takes over R3F's render loop; the pipeline renders the scene through the chain.
  // If the post chain ever fails at runtime (driver-specific WGSL rejection, addon regressions),
  // drop to the direct render path for the session instead of a dead black canvas — same spirit
  // as the device-lost screen: degraded beats dark.
  const postBroken = useRef(false)
  useFrame(() => {
    if (postBroken.current) {
      gl.render(scene, camera)
      return
    }
    try {
      pipeline.render()
    } catch (err) {
      postBroken.current = true
      console.error('[arc] PostFX pipeline failed, dropping to direct render:', err)
      gl.render(scene, camera)
    }
  }, 1)

  return null
}
