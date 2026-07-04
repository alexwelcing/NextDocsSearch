// Precompiles GPU render pipelines for every material currently in the scene while the CRT boot
// overlay still covers the canvas, so the reveal doesn't pay a first-frame shader-compile hitch.
//
// Windfoil text meshes all share one NodeMaterial graph shape per font, and WebGPU's pipeline
// cache keys on the compiled shader code (not material instance identity — see
// Pipelines.js#_getRenderCacheKey), so warming the always-mounted dock brand-plate text here
// covers every other windfoil text mesh the app creates afterward (dock rows, search/ship
// results, the article reader, HUD). Requires three's `compileAsync()` (non-blocking since r184).

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useImmersiveStore } from '@/stores/immersiveStore'

export function ShaderWarmup() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const setShadersWarm = useImmersiveStore((s) => s.setShadersWarm)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const renderer = gl as unknown as { compileAsync?: (s: typeof scene, c: typeof camera) => Promise<unknown> }
    if (typeof renderer.compileAsync !== 'function') {
      setShadersWarm(true) // older/foreign renderer — don't block boot on a missing API
      return
    }
    renderer.compileAsync(scene, camera).then(
      () => setShadersWarm(true),
      (err: unknown) => {
        console.error('[arc] shader warmup failed (continuing):', err)
        setShadersWarm(true)
      }
    )
  }, [gl, scene, camera, setShadersWarm])

  return null
}
