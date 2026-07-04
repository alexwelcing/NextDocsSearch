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

// Register the three/webgpu catalogue so JSX intrinsics resolve to WebGPU-capable classes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(THREE as any)

export default function ImmersiveCanvas({ children }: { children?: ReactNode }) {
  const quality = useImmersiveStore((s) => s.quality)

  return (
    <Canvas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gl={async (props: any) => {
        const renderer = new THREE.WebGPURenderer({
          ...props,
          antialias: true,
          powerPreference: 'high-performance',
        })
        await renderer.init()
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
      {children}
    </Canvas>
  )
}
