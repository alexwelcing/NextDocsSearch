/**
 * World Configuration Types
 *
 * Defines the structure for Marble Labs world exports and scene configuration.
 * These types ensure type-safe world loading and camera/lighting setup.
 */

import type { Vector3Tuple } from 'three';

/**
 * Camera constraints for world navigation
 * All properties are optional as they get merged with defaults
 */
export interface CameraConstraints {
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;  // Radians - minimum vertical angle (0 = top)
  maxPolarAngle?: number;  // Radians - maximum vertical angle (PI = bottom)
  minAzimuthAngle?: number;  // Radians - horizontal rotation limit
  maxAzimuthAngle?: number;
  enablePan?: boolean;
}

/**
 * Camera configuration for a world
 */
export interface WorldCamera {
  initial: Vector3Tuple;
  target: Vector3Tuple;
  fov?: number;
  constraints?: CameraConstraints;
}

/**
 * Lighting presets for consistent mood across worlds
 */
export type LightingPreset =
  | 'day'
  | 'night'
  | 'sunset'
  | 'overcast'
  | 'studio'
  | 'dramatic'
  | 'neon'
  | 'custom';

/**
 * Custom lighting configuration
 * All properties are optional as they get merged with defaults
 */
export interface LightingConfig {
  preset?: LightingPreset;
  ambient?: number;
  directionalIntensity?: number;
  accentColor?: string;
  shadowsEnabled?: boolean;
  envMapIntensity?: number;
}

/**
 * Post-processing effect configuration
 */
export interface PostProcessingConfig {
  bloom?: {
    enabled: boolean;
    intensity?: number;
    threshold?: number;
    radius?: number;
  };
  ssao?: {
    enabled: boolean;
    intensity?: number;
    radius?: number;
  };
  colorGrading?: {
    enabled: boolean;
    saturation?: number;
    contrast?: number;
    brightness?: number;
  };
  vignette?: {
    enabled: boolean;
    intensity?: number;
  };
}

/**
 * Asset types supported for world construction
 */
export type AssetType = 'splat' | 'glb' | 'gltf' | 'hdr' | 'exr' | 'image';

/**
 * Individual prop/object in the world
 */
export interface WorldProp {
  id: string;
  path: string;
  type: AssetType;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple | number;
  visible?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * World asset configuration
 */
export interface WorldAssets {
  /** Primary environment - .splat or .glb */
  environment?: string;
  skybox?: string;           // .hdr path
  fallbackPanorama?: string;  // .jpg/.png path
  colliderUrl?: string;       // .glb path for physics
  props?: WorldProp[];       // Additional 3D objects
}

/**
 * Atmosphere/fog configuration
 */
export interface AtmosphereConfig {
  fog?: {
    enabled: boolean;
    color?: string;
    near?: number;
    far?: number;
  };
  particles?: {
    type: 'snow' | 'dust' | 'fireflies' | 'leaves' | 'none';
    intensity?: number;
    color?: string;
  };
}

/**
 * Complete world configuration
 * This maps to config.json files in public/worlds/{id}/
 */
export interface WorldConfig {
  id: string;
  name: string;
  description?: string;
  version?: string;

  assets: WorldAssets;
  camera: WorldCamera;
  lighting?: LightingConfig;
  atmosphere?: AtmosphereConfig;
  postProcessing?: PostProcessingConfig;

  /** Metadata for UI/selection */
  meta?: {
    thumbnail?: string;
    tags?: string[];
    author?: string;
    createdAt?: string;
  };
}

/**
 * Quality levels for adaptive rendering
 */
export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Device capability detection result
 */
export interface DeviceCapabilities {
  qualityLevel: QualityLevel;
  supportsWebGPU: boolean;
  supportsSplats: boolean;
  maxTextureSize: number;
  isMobile: boolean;
  pixelRatio: number;
}

/**
 * Scene state for the unified 3D scene
 */
export interface SceneState {
  currentWorld: WorldConfig | null;
  isLoading: boolean;
  loadProgress: number;
  error: string | null;
  quality: QualityLevel;
}

/**
 * Camera modes for different interaction states
 */
export type CameraMode = 'orbit' | 'cinematic' | 'game' | 'vr' | 'locked';

/**
 * Keyframe for cinematic camera sequences
 */
export interface CameraKeyframe {
  position: Vector3Tuple;
  target: Vector3Tuple;
  fov?: number;
  duration: number;  // seconds
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

/**
 * Default world configuration
 */
export const DEFAULT_WORLD_CONFIG: Partial<WorldConfig> = {
  camera: {
    initial: [0, 2, 10],
    target: [0, 0, 0],
    fov: 60,
    constraints: {
      minDistance: 3,
      maxDistance: 50,
      minPolarAngle: 0.1,
      maxPolarAngle: Math.PI / 2,
      enablePan: false,
    },
  },
  lighting: {
    preset: 'day',
    ambient: 0.5,
    directionalIntensity: 1,
    shadowsEnabled: false,
    envMapIntensity: 1,
  },
  atmosphere: {
    fog: { enabled: false },
    particles: { type: 'none' },
  },
};

/**
 * Lighting preset configurations
 */
export const LIGHTING_PRESETS: Record<LightingPreset, Partial<LightingConfig>> = {
  day: {
    ambient: 0.5,
    directionalIntensity: 1,
    accentColor: '#ffffff',
  },
  night: {
    ambient: 0.15,
    directionalIntensity: 0.3,
    accentColor: '#4466ff',
  },
  sunset: {
    ambient: 0.4,
    directionalIntensity: 0.8,
    accentColor: '#ff8844',
  },
  overcast: {
    ambient: 0.6,
    directionalIntensity: 0.4,
    accentColor: '#ccccdd',
  },
  studio: {
    ambient: 0.3,
    directionalIntensity: 1.2,
    accentColor: '#ffffff',
  },
  dramatic: {
    ambient: 0.2,
    directionalIntensity: 1.5,
    accentColor: '#ff4488',
  },
  neon: {
    ambient: 0.1,
    directionalIntensity: 0.5,
    accentColor: '#ff00ff',
  },
  custom: {},
};
