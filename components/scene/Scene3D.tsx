/**
 * Scene3D - Modern scene orchestrator
 *
 * This is the new entry point for 3D scenes, replacing ThreeSixty.tsx.
 * It provides a clean, modular architecture using r182 patterns.
 *
 * Features:
 * - Splat-first background system
 * - Unified camera management
 * - World configuration support
 * - Marble Labs integration ready
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createXRStore, XR, XROrigin } from '@react-three/xr';
import { Stats } from '@react-three/drei';
import styled from 'styled-components';
import { ArticleData } from '@/types/api';

import SceneCanvas, { useSceneCapabilities } from './SceneCanvas';
import SceneEnvironment from './SceneEnvironment';
import SceneBackground from './SceneBackground';
import SceneCamera from './SceneCamera';

import PostProcessingEffects from '@/components/3d/atmosphere/PostProcessingEffects';
import ClickingGame from '@/components/3d/game/ClickingGame';
import type { GameState, GameStats } from '@/components/3d/game/ClickingGame';
import type { WorldConfig, CameraMode, QualityLevel } from '@/lib/worlds/types';
import { loadWorld, DEFAULT_WORLD } from '@/lib/worlds/loader';

// Re-export game types for convenience
export type { GameState, GameStats } from '@/components/3d/game/ClickingGame';

interface Scene3DProps {
  /** World ID or configuration */
  world?: string | WorldConfig;
  /** Force a specific quality level */
  quality?: QualityLevel;
  /** Enable XR/VR mode */
  enableXR?: boolean;
  /** Show performance stats (dev mode) */
  showStats?: boolean;
  /** Articles data for the idea experience */
  articles?: ArticleData[];
  /** Children to render in the scene */
  children?: React.ReactNode;
  /** Callback when scene is ready */
  onReady?: () => void;
  /** Callback for camera mode changes */
  onCameraModeChange?: (mode: CameraMode) => void;
  /** Callback for game state changes */
  onGameStateChange?: (state: string) => void;
  /** Game props (for ClickingGame inside Canvas) */
  gameState?: GameState | string;
  onStartGame?: () => void;
  onGameEnd?: (score: number, stats: GameStats) => void;
  onScoreUpdate?: (score: number) => void;
  onComboUpdate?: (combo: number) => void;
  onTimeUpdate?: (timeRemaining: number) => void;
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
  };
}

const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 4;
`;

// Physics removed - no current consumers use cannon.js through Scene3D.
// Game physics lives in the legacy ThreeSixty.tsx system.

/**
 * Scene3D - The modern scene orchestrator
 */
export default function Scene3D({
  world: worldProp,
  quality: qualityOverride,
  enableXR = false,
  showStats = false,
  articles,
  children,
  onReady,
  onCameraModeChange,
  onGameStateChange,
  gameState: gameStateProp = 'IDLE',
  onStartGame,
  onGameEnd,
  onScoreUpdate,
  onComboUpdate,
  onTimeUpdate,
}: Scene3DProps) {
  // Scene state
  const [worldConfig, setWorldConfig] = useState<WorldConfig>(DEFAULT_WORLD);
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');

  // XR store
  const xrStore = useMemo(() => createXRStore(), []);

  // Load world configuration
  useEffect(() => {
    async function load() {
      try {
        let config: WorldConfig;
        if (typeof worldProp === 'string') {
          config = await loadWorld(worldProp);
        } else if (worldProp) {
          config = mergeWorldConfig(worldProp);
        } else {
          config = DEFAULT_WORLD;
        }
        setWorldConfig(config);
      } catch (error) {
        console.error('Failed to load world:', error);
        setWorldConfig(DEFAULT_WORLD);
      } finally {
        onReady?.();
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldProp, onReady]);

  // Handle camera mode changes
  const handleSetCameraMode = useCallback(
    (mode: CameraMode) => {
      setCameraMode(mode);
      onCameraModeChange?.(mode);
    },
    [onCameraModeChange]
  );

  return (
    <Container>
      <SceneCanvas
        quality={qualityOverride}
        shadows={worldConfig.lighting?.shadowsEnabled}
      >
        {enableXR ? (
          <XR store={xrStore}>
            <XROrigin position={[0, 0, 0]}>
              <SceneContent
                worldConfig={worldConfig}
                cameraMode={cameraMode}
              >
                {children}
              </SceneContent>
            </XROrigin>
          </XR>
        ) : (
          <SceneContent
            worldConfig={worldConfig}
            cameraMode={cameraMode}
            gameState={gameStateProp as GameState}
            onStartGame={onStartGame}
            onGameEnd={onGameEnd}
            onScoreUpdate={onScoreUpdate}
            onComboUpdate={onComboUpdate}
            onTimeUpdate={onTimeUpdate}
          >
            {children}
          </SceneContent>
        )}

        {showStats && <Stats />}
      </SceneCanvas>
    </Container>
  );
}

/**
 * Inner scene content - separated for XR wrapping
 */
function SceneContent({
  worldConfig,
  cameraMode,
  gameState = 'IDLE',
  onStartGame,
  onGameEnd,
  onScoreUpdate,
  onComboUpdate,
  onTimeUpdate,
  children,
}: {
  worldConfig: WorldConfig;
  cameraMode: CameraMode;
  gameState?: GameState;
  onStartGame?: () => void;
  onGameEnd?: (score: number, stats: GameStats) => void;
  onScoreUpdate?: (score: number) => void;
  onComboUpdate?: (combo: number) => void;
  onTimeUpdate?: (timeRemaining: number) => void;
  children?: React.ReactNode;
}) {
  const capabilities = useSceneCapabilities();

  return (
    <>
      {/* Background (splat-first) */}
      <SceneBackground
        assets={worldConfig.assets}
        quality={capabilities.qualityLevel}
        supportsSplats={capabilities.supportsSplats}
      />

      {/* Environment lighting */}
      <SceneEnvironment
        lighting={worldConfig.lighting}
        envMapPath={worldConfig.assets.skybox}
      />

      {/* Camera system */}
      <SceneCamera
        mode={cameraMode}
        config={worldConfig.camera}
      />

      {/* Post-processing effects */}
      <PostProcessingEffects
        quality={capabilities.qualityLevel}
        enabled={capabilities.qualityLevel !== 'low'}
        isMobile={capabilities.isMobile}
      />

      {/* Clicking Game (R3F component, renders inside Canvas) */}
      {onStartGame && onGameEnd && (
        <ClickingGame
          gameState={gameState}
          onGameStart={onStartGame}
          onGameEnd={onGameEnd}
          onScoreUpdate={onScoreUpdate}
          onComboUpdate={onComboUpdate}
          onTimeUpdate={onTimeUpdate}
        />
      )}

      {/* Scene children */}
      {children}
    </>
  );
}

/**
 * Context for scene state access
 */
export interface SceneContextValue {
  worldConfig: WorldConfig;
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  capabilities: ReturnType<typeof useSceneCapabilities>;
}

/**
 * Hook exports for convenience
 */
export { useSceneCapabilities } from './SceneCanvas';
export { useCameraControl } from './SceneCamera';
