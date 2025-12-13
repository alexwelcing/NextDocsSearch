/**
 * Scene Components - Modern 3D scene system
 *
 * Usage:
 * ```tsx
 * import { Scene3D, useSceneCapabilities, useCameraControl } from '@/components/scene';
 *
 * function MyApp() {
 *   return (
 *     <Scene3D world="cyberpunk">
 *       <MyGameComponents />
 *     </Scene3D>
 *   );
 * }
 * ```
 */

// Main orchestrator
export { default as Scene3D } from './Scene3D';
export type { SceneContextValue } from './Scene3D';

// Individual components (for advanced usage)
export { default as SceneCanvas, useSceneCapabilities } from './SceneCanvas';
export { default as SceneEnvironment, SceneSpotlight } from './SceneEnvironment';
export { default as SceneBackground } from './SceneBackground';
export { default as SceneCamera, useCameraControl } from './SceneCamera';

// Re-export types
export type {
  WorldConfig,
  WorldAssets,
  WorldCamera,
  CameraConstraints,
  CameraMode,
  CameraKeyframe,
  LightingConfig,
  LightingPreset,
  AtmosphereConfig,
  PostProcessingConfig,
  QualityLevel,
  DeviceCapabilities,
  SceneState,
} from '@/lib/worlds/types';

// Re-export loader
export { loadWorld, listWorlds, preloadWorld, DEFAULT_WORLD } from '@/lib/worlds/loader';
