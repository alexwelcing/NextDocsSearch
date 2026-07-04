// The WebGPU R3F canvas hosting the whole immersive app: panorama world, atmosphere, lights,
// camera rig, and whatever feature layers (dock, modals, game) are passed as children.
// Always dynamically imported with ssr: false — three/webgpu touches navigator at module scope.

import { ReactNode } from 'react'
import * as THREE from 'three/webgpu'
import { Canvas, extend } from '@react-three/fiber'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { PanoramaSphere } from './scene/PanoramaSphere'
import { Atmosphere } from './scene/Atmosphere'
import { SceneLights } from './scene/SceneLights'
import { CameraRig } from './scene/CameraRig'
import { ShaderWarmup } from './scene/ShaderWarmup'
import { ArcDock } from './dock/ArcDock'
import { ImmersiveModals } from './ImmersiveModals'
import { SphereHunter } from './game/SphereHunter'

// Register the three/webgpu catalogue so JSX intrinsics resolve to WebGPU-capable classes.
 
extend(THREE as any)

export default function ImmersiveCanvas({ children }: { children?: ReactNode }) {
  const quality = useImmersiveStore((s) => s.quality)

  return (
    <Canvas
       
      gl={async (props: any) => {
        const renderer = new THREE.WebGPURenderer({
          ...props,
          antialias: true,
          powerPreference: 'high-performance',
        })
        try {
          await renderer.init()
          // three silently falls back to a WebGL2 backend when no adapter is grantable; the
          // windfoil text engine is WGSL-only, so that fallback is unusable here.
          const backend = (renderer as unknown as { backend?: { isWebGPUBackend?: boolean } })
            .backend
          if (!backend?.isWebGPUBackend) {
            throw new Error('WebGPU adapter unavailable (WebGL2 fallback refused)')
          }
        } catch (err) {
          // navigator.gpu can exist while no adapter/device is grantable (blocklists, remote
          // sessions). Async rejections never reach React error boundaries, so downgrade the
          // store directly — ImmersiveApp unmounts this canvas and shows the flat feed.
          console.error('[arc] WebGPU init failed, compatibility mode:', err)
          useImmersiveStore.getState().setBootPhase('unsupported')
          throw err
        }
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.05
        return renderer
      }}
      camera={{ fov: 70, near: 0.05, far: 300, position: [0, 0, 0] }}
      dpr={quality === 'low' ? [1, 1.25] : [1, 2]}
      frameloop="always"
      style={{ position: 'fixed', inset: 0, zIndex: 10, background: '#020403' }}
    >
      <PanoramaSphere />
      <Atmosphere />
      <SceneLights />
      <CameraRig />
      <ShaderWarmup />
      <ArcDock />
      <ImmersiveModals />
      <SphereHunter />
      {children}
    </Canvas>
  )
}
