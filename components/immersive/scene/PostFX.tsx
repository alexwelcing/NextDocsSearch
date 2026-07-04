// Full-frame post: bloom + a whisper of chromatic aberration + film grain, via the r185
// RenderPipeline (the PostProcessing rename). Mounted only above 'low' quality — unmounting
// hands the frame back to R3F's automatic render loop.
//
// Color-pipeline note (why this is safe for the site's look): the WebGPU renderer never tone
// maps per material — every direct frame ALREADY renders linear into an internal framebuffer
// target and gets ACES + sRGB applied by a full-frame output quad (Renderer._renderOutput;
// material.toneMapped doesn't exist in this backend). RenderPipeline reproduces exactly that
// topology — pass() renders the scene linear, outputNode composites, and the final quad applies
// the same renderOutput transform — so windfoil text, the panorama, and the CRT stack come
// through with precisely the colors they have today; the effects are inserted in the middle.

import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { float, pass } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js'
import { film } from 'three/addons/tsl/display/FilmNode.js'

// Tuned for restraint: the scene is mostly dark with small bright emitters (motes, phosphor
// text, panorama highlights) — bloom past ~0.4 turns the CRT into soup.
const BLOOM_STRENGTH = 0.32
const BLOOM_RADIUS = 0.25
const BLOOM_THRESHOLD = 0.78
// CA reads as lens character at the frame edge, defect in the middle: tiny scale step, and the
// default center (screen middle) means zero shift where the dock and reading surfaces live.
const CA_STRENGTH = 0.55
const CA_SCALE = 1.012
const GRAIN = 0.11

export function PostFX() {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  const { pipeline, scenePass } = useMemo(() => {
    const scenePass = pass(scene, camera)
    const bloomed = scenePass.add(bloom(scenePass, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD))
    // float() wrappers where the typings insist on Nodes (the runtime takes plain numbers too).
    const fringed = chromaticAberration(bloomed, float(CA_STRENGTH), null, float(CA_SCALE))
    const pipeline = new THREE.RenderPipeline(gl)
    pipeline.outputNode = film(fringed, float(GRAIN))
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
  useFrame(() => {
    pipeline.render()
  }, 1)

  return null
}
