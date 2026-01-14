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
import { Physics } from '@react-three/cannon';
import { createXRStore, XR, XROrigin } from '@react-three/xr';
import { Stats } from '@react-three/drei';
import styled from 'styled-components';

import SceneCanvas, { useSceneCapabilities } from './SceneCanvas';
import SceneEnvironment from './SceneEnvironment';
import SceneBackground from './SceneBackground';
import SceneCamera from './SceneCamera';

import type { WorldConfig, CameraMode, QualityLevel } from '@/lib/worlds/types';
import { loadWorld, mergeWorldConfig, DEFAULT_WORLD } from '@/lib/worlds/loader';
import { IdeaExperience } from '@/components/ideas';

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
}

const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 4;
`;

/**
 * Physics configuration - optimized for game performance
 */
const PHYSICS_CONFIG = {
  gravity: [0, -9.81, 0] as [number, number, number],
  iterations: 5,
  tolerance: 0.01,
  allowSleep: true,
  broadphase: 'SAP' as const,
  defaultContactMaterial: {
    friction: 0.1,
    restitution: 0.7,
  },
};

/**
 * Scene3D - The modern scene orchestrator
 */
export default function Scene3D({
  world: worldProp,
  quality: qualityOverride,
  enableXR = true,
  showStats = process.env.NODE_ENV === 'development',
  articles,
  children,
  onReady,
  onCameraModeChange,
  onGameStateChange,
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

  // Load world configuration
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        if (typeof worldProp === 'string') {
          const config = await loadWorld(worldProp);
          setWorldConfig(config);
        } else if (worldProp) {
          // Merge provided partial config with defaults
          const config = mergeWorldConfig(worldProp, worldProp.id || 'custom');
          setWorldConfig(config);
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
  }, [handleSetCameraMode]);

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
                articles={articles}
                onCinematicComplete={handleCinematicComplete}
                onCinematicProgress={handleCinematicProgress}
                onGameStateChange={onGameStateChange}
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
            articles={articles}
            onCinematicComplete={handleCinematicComplete}
            onCinematicProgress={handleCinematicProgress}
            onGameStateChange={onGameStateChange}
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
  articles,
  onCinematicComplete,
  onCinematicProgress,
  onGameStateChange,
  children,
}: {
  worldConfig: WorldConfig;
  cameraMode: CameraMode;
  showCinematic: boolean;
  cinematicProgress: number;
  articles?: any[];
  onCinematicComplete: () => void;
  onCinematicProgress: (progress: number) => void;
  onGameStateChange?: (state: string) => void;
  children?: React.ReactNode;
}) {
  const capabilities = useSceneCapabilities();

  return (
    <Physics {...PHYSICS_CONFIG}>
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

      {/* Idea Experience - The new spatial content system */}
      {!showCinematic && (
        <IdeaExperience 
          articles={articles} 
          onGameStateChange={onGameStateChange}
          isActive={true}
        />
      )}

      {/* Scene children (game, UI, etc.) */}
      {children}
    </Physics>
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
