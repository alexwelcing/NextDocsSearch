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
import { WorldTitleCard } from './scene/WorldTitleCard'
import { SceneFog } from './scene/SceneFog'
import { PostFX } from './scene/PostFX'
import { ShaderWarmup } from './scene/ShaderWarmup'
import { ArcDock } from './dock/ArcDock'
import { ImmersiveModals } from './ImmersiveModals'
import { SphereHunter } from './game/SphereHunter'
import { SKY_SPIKE, spikeHandle } from '@/lib/immersive/sky/spikeFlags'

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
          // SPIKE (H1 sky): GPU pass timing for the sky experiment only.
          ...(SKY_SPIKE.sky ? { trackTimestamp: true } : {}),
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
        if (SKY_SPIKE.sky) spikeHandle().renderer = renderer
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.05

        // Mid-session recovery: a lost device (driver reset, OOM, mobile backgrounding) leaves
        // this renderer permanently inert. 'destroyed' is us tearing it down on purpose (e.g. a
        // future dev-mode remount) — anything else is unexpected and needs the reconnect screen,
        // since there's no supported way to hand this renderer a fresh device in place.
        renderer.onDeviceLost = (info) => {
          console.error('[arc] WebGPU device lost:', info.reason ?? 'unknown', info.message)
          if (info.reason !== 'destroyed') {
            useImmersiveStore.getState().setBootPhase('lost')
          }
        }
        // Non-fatal validation/internal errors that don't cause a device loss — tag them into
        // our own log channel instead of three's unprefixed default console.error.
        renderer.onError = (errorMessage) => {
          console.error('[arc] WebGPU uncaptured error:', errorMessage)
        }

        return renderer
      }}
      camera={{ fov: 70, near: 0.05, far: 300, position: [0, 0, 0] }}
      dpr={quality === 'low' ? [1, 1.25] : [1, 2]}
      frameloop="always"
      style={{ position: 'fixed', inset: 0, zIndex: 10, background: '#020403' }}
    >
      <PanoramaSphere />
      <SceneFog />
      <Atmosphere />
      <SceneLights />
      <CameraRig />
      <WorldTitleCard />
      <ShaderWarmup />
      <ArcDock />
      <ImmersiveModals />
      <SphereHunter />
      {quality !== 'low' && <PostFX />}
      {children}
    </Canvas>
  )
}
