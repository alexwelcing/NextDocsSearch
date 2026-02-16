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

import SceneCanvas, { useSceneCapabilities } from './SceneCanvas';
import SceneEnvironment from './SceneEnvironment';
import SceneBackground from './SceneBackground';
import SceneCamera from './SceneCamera';

import PostProcessingEffects from '@/components/3d/atmosphere/PostProcessingEffects';
import type { WorldConfig, CameraMode, QualityLevel } from '@/lib/worlds/types';
import { loadWorld, preloadWorld, DEFAULT_WORLD } from '@/lib/worlds/loader';

// Re-export game types for convenience
export type { GameState } from '@/components/3d/game/ClickingGame';

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
  articles?: any[];
  /** Children to render in the scene */
  children?: React.ReactNode;
  /** Callback when scene is ready */
  onReady?: () => void;
  /** Callback for camera mode changes */
  onCameraModeChange?: (mode: CameraMode) => void;
  /** Callback for game state changes */
  onGameStateChange?: (state: string) => void;
  /** Callback when cinematic intro finishes (or was already watched) */
  onCinematicComplete?: () => void;
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
  onCinematicComplete: onCinematicCompleteProp,
}: Scene3DProps) {
  // Scene state
  const [worldConfig, setWorldConfig] = useState<WorldConfig>(DEFAULT_WORLD);
  const [isLoading, setIsLoading] = useState(true);
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');

  // Cinematic state
  const [showCinematic, setShowCinematic] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('hasWatchedIntro');
    }
    return false;
  });
  const [cinematicProgress, setCinematicProgress] = useState(0);

  // XR store
  const xrStore = useMemo(() => createXRStore(), []);

  // Load world configuration and preload assets before cinematic
  useEffect(() => {
    async function load() {
      setIsLoading(true);
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

        // Preload assets before cinematic starts to prevent stutter
        if (showCinematic && config.id) {
          await preloadWorld(config.id);
        }
      } catch (error) {
        console.error('Failed to load world:', error);
        setWorldConfig(DEFAULT_WORLD);
      } finally {
        setIsLoading(false);
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

  // Handle cinematic completion
  const handleCinematicComplete = useCallback(() => {
    setShowCinematic(false);
    handleSetCameraMode('orbit');
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasWatchedIntro', 'true');
    }
    onCinematicCompleteProp?.();
  }, [handleSetCameraMode, onCinematicCompleteProp]);

  // Handle cinematic progress
  const handleCinematicProgress = useCallback((progress: number) => {
    setCinematicProgress(progress);
  }, []);

  // Replay intro
  const replayIntro = useCallback(() => {
    setShowCinematic(true);
    handleSetCameraMode('cinematic');
    setCinematicProgress(0);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hasWatchedIntro');
    }
  }, [handleSetCameraMode]);

  // Notify parent immediately if cinematic was already watched
  useEffect(() => {
    if (!showCinematic) {
      onCinematicCompleteProp?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Start cinematic if needed
  useEffect(() => {
    if (showCinematic && !isLoading) {
      handleSetCameraMode('cinematic');
    }
  }, [showCinematic, isLoading, handleSetCameraMode]);

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
                showCinematic={showCinematic}
                cinematicProgress={cinematicProgress}
                onCinematicComplete={handleCinematicComplete}
                onCinematicProgress={handleCinematicProgress}
              >
                {children}
              </SceneContent>
            </XROrigin>
          </XR>
        ) : (
          <SceneContent
            worldConfig={worldConfig}
            cameraMode={cameraMode}
            showCinematic={showCinematic}
            cinematicProgress={cinematicProgress}
            onCinematicComplete={handleCinematicComplete}
            onCinematicProgress={handleCinematicProgress}
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
  showCinematic,
  cinematicProgress,
  onCinematicComplete,
  onCinematicProgress,
  children,
}: {
  worldConfig: WorldConfig;
  cameraMode: CameraMode;
  showCinematic: boolean;
  cinematicProgress: number;
  onCinematicComplete: () => void;
  onCinematicProgress: (progress: number) => void;
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
        isCinematic={showCinematic}
        cinematicProgress={cinematicProgress}
      />

      {/* Camera system */}
      <SceneCamera
        mode={showCinematic ? 'cinematic' : cameraMode}
        config={worldConfig.camera}
        onCinematicComplete={onCinematicComplete}
        onCinematicProgress={onCinematicProgress}
      />

      {/* Post-processing effects (DOF during cinematic on desktop, bloom/vignette always) */}
      <PostProcessingEffects
        quality={capabilities.qualityLevel}
        enabled={capabilities.qualityLevel !== 'low'}
        isCinematic={showCinematic}
        cinematicProgress={cinematicProgress}
        isMobile={capabilities.isMobile}
      />

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
  cinematicProgress: number;
  replayIntro: () => void;
  capabilities: ReturnType<typeof useSceneCapabilities>;
}

/**
 * Hook exports for convenience
 */
export { useSceneCapabilities } from './SceneCanvas';
export { useCameraControl } from './SceneCamera';
