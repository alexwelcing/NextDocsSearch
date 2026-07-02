import React, { useEffect, useState } from 'react'
import { Stats } from '@react-three/drei'
import styled from 'styled-components'

import SceneCanvas, { useSceneCapabilities } from './SceneCanvas'
import SceneEnvironment from './SceneEnvironment'
import SceneBackground from './SceneBackground'
import SceneCamera from './SceneCamera'

import PostProcessingEffects from '@/components/3d/atmosphere/PostProcessingEffects'
import type { WorldConfig, CameraMode, QualityLevel } from '@/lib/worlds/types'
import { loadWorld, DEFAULT_WORLD } from '@/lib/worlds/loader'

interface Scene3DProps {
  world?: string | Partial<WorldConfig>
  quality?: QualityLevel
  showStats?: boolean
  children?: React.ReactNode
  onReady?: () => void
}

export function mergeWorldConfig(world: Partial<WorldConfig>): WorldConfig {
  return {
    ...DEFAULT_WORLD,
    ...world,
    assets: {
      ...DEFAULT_WORLD.assets,
      ...world.assets,
    },
    camera: {
      ...DEFAULT_WORLD.camera,
      ...world.camera,
      constraints: {
        ...DEFAULT_WORLD.camera.constraints,
        ...world.camera?.constraints,
      },
    },
    lighting: {
      ...DEFAULT_WORLD.lighting,
      ...world.lighting,
    },
    atmosphere: {
      ...DEFAULT_WORLD.atmosphere,
      ...world.atmosphere,
    },
  }
}

const Container = styled.div`
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 4;
`

export default function Scene3D({
  world: worldProp,
  quality: qualityOverride,
  showStats = false,
  children,
  onReady,
}: Scene3DProps) {
  const [worldConfig, setWorldConfig] = useState<WorldConfig>(DEFAULT_WORLD)
  const cameraMode: CameraMode = 'orbit'

  useEffect(() => {
    async function load() {
      try {
        let config: WorldConfig
        if (typeof worldProp === 'string') {
          config = await loadWorld(worldProp)
        } else if (worldProp) {
          config = mergeWorldConfig(worldProp)
        } else {
          config = DEFAULT_WORLD
        }
        setWorldConfig(config)
      } catch (error) {
        console.error('Failed to load world:', error)
        setWorldConfig(DEFAULT_WORLD)
      } finally {
        onReady?.()
      }
    }
    load()
  }, [worldProp, onReady])

  return (
    <Container>
      <SceneCanvas quality={qualityOverride} shadows={worldConfig.lighting?.shadowsEnabled}>
        <SceneContent worldConfig={worldConfig} cameraMode={cameraMode}>
          {children}
        </SceneContent>
        {showStats && <Stats />}
      </SceneCanvas>
    </Container>
  )
}

function SceneContent({
  worldConfig,
  cameraMode,
  children,
}: {
  worldConfig: WorldConfig
  cameraMode: CameraMode
  children?: React.ReactNode
}) {
  const capabilities = useSceneCapabilities()
  const effectsEnabled =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('effects') === 'on'

  return (
    <>
      <SceneBackground
        assets={worldConfig.assets}
        quality={capabilities.qualityLevel}
        supportsSplats={capabilities.supportsSplats}
      />
      <SceneEnvironment lighting={worldConfig.lighting} envMapPath={worldConfig.assets.skybox} />
      <SceneCamera mode={cameraMode} config={worldConfig.camera} />
      <PostProcessingEffects
        quality={capabilities.qualityLevel}
        enabled={effectsEnabled}
        isMobile={capabilities.isMobile}
      />
      {children}
    </>
  )
}
