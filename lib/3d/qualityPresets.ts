/**
 * Quality Presets - Adaptive quality settings for 3D experiences
 *
 * Automatically adjusts rendering quality based on device capabilities
 * and user preferences to ensure smooth performance across all devices.
 */

import type { QualityLevel } from '@/lib/worlds/types';

export interface QualityPreset {
  // Rendering
  pixelRatio: [number, number];
  antialias: boolean;
  shadows: boolean;

  // Particles
  maxParticles: number;
  particleSize: number;

  // Post-processing
  bloomEnabled: boolean;
  bloomIntensity: number;
  vignetteEnabled: boolean;

  // Atmosphere
  auroraEnabled: boolean;
  auroraSegments: number;
  ambientParticles: number;

  // Geometry
  orbGeometryDetail: number;
  connectionLineSegments: number;

  // Animation
  animationFrameSkip: number; // Skip frames for animations (1 = every frame)
  cameraFloatAmount: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  ultra: {
    pixelRatio: [1.5, 2],
    antialias: true,
    shadows: true,
    maxParticles: 2000,
    particleSize: 1.0,
    bloomEnabled: true,
    bloomIntensity: 0.8,
    vignetteEnabled: true,
    auroraEnabled: true,
    auroraSegments: 128,
    ambientParticles: 500,
    orbGeometryDetail: 64,
    connectionLineSegments: 64,
    animationFrameSkip: 1,
    cameraFloatAmount: 0.3,
  },

  high: {
    pixelRatio: [1, 1.5],
    antialias: true,
    shadows: true,
    maxParticles: 1000,
    particleSize: 1.0,
    bloomEnabled: true,
    bloomIntensity: 0.6,
    vignetteEnabled: true,
    auroraEnabled: true,
    auroraSegments: 64,
    ambientParticles: 300,
    orbGeometryDetail: 32,
    connectionLineSegments: 48,
    animationFrameSkip: 1,
    cameraFloatAmount: 0.25,
  },

  medium: {
    pixelRatio: [0.75, 1],
    antialias: true,
    shadows: false,
    maxParticles: 500,
    particleSize: 1.2,
    bloomEnabled: true,
    bloomIntensity: 0.4,
    vignetteEnabled: true,
    auroraEnabled: true,
    auroraSegments: 32,
    ambientParticles: 150,
    orbGeometryDetail: 24,
    connectionLineSegments: 32,
    animationFrameSkip: 1,
    cameraFloatAmount: 0.2,
  },

  low: {
    pixelRatio: [0.5, 0.75],
    antialias: false,
    shadows: false,
    maxParticles: 200,
    particleSize: 1.5,
    bloomEnabled: false,
    bloomIntensity: 0,
    vignetteEnabled: false,
    auroraEnabled: false,
    auroraSegments: 0,
    ambientParticles: 50,
    orbGeometryDetail: 16,
    connectionLineSegments: 16,
    animationFrameSkip: 2,
    cameraFloatAmount: 0.1,
  },
};

/**
 * Detect optimal quality level based on device capabilities
 */
export function detectOptimalQuality(): QualityLevel {
  if (typeof window === 'undefined') return 'high';

  const nav = navigator as Navigator & { deviceMemory?: number };

  // Device capability checks
  const memory = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  const pixelRatio = window.devicePixelRatio ?? 1;

  // WebGL capability check
  let maxTextureSize = 4096;
  let webglVersion = 1;
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    if (gl2) {
      webglVersion = 2;
      maxTextureSize = gl2.getParameter(gl2.MAX_TEXTURE_SIZE);
    } else {
      const gl = canvas.getContext('webgl');
      if (gl) {
        maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      }
    }
  } catch (e) {
    // WebGL not available
  }

  // Calculate score
  let score = 0;

  // Memory score (max 3)
  if (memory >= 8) score += 3;
  else if (memory >= 4) score += 2;
  else score += 1;

  // CPU score (max 3)
  if (cores >= 8) score += 3;
  else if (cores >= 4) score += 2;
  else score += 1;

  // GPU score (max 3)
  if (maxTextureSize >= 16384 && webglVersion === 2) score += 3;
  else if (maxTextureSize >= 8192) score += 2;
  else score += 1;

  // Mobile penalty
  if (isMobile) score -= 2;

  // High DPI screens need more power
  if (pixelRatio > 2) score -= 1;

  // Determine quality level
  if (score >= 8) return 'ultra';
  if (score >= 6) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

/**
 * Get quality preset with optional overrides
 */
export function getQualityPreset(
  level: QualityLevel,
  overrides?: Partial<QualityPreset>
): QualityPreset {
  return {
    ...QUALITY_PRESETS[level],
    ...overrides,
  };
}

/**
 * Adapt quality based on frame rate
 * Call this periodically to dynamically adjust quality
 */
export function adaptQuality(currentFPS: number, currentQuality: QualityLevel): QualityLevel {
  const qualityOrder: QualityLevel[] = ['low', 'medium', 'high', 'ultra'];
  const currentIndex = qualityOrder.indexOf(currentQuality);

  // If FPS is too low, decrease quality
  if (currentFPS < 30 && currentIndex > 0) {
    return qualityOrder[currentIndex - 1];
  }

  // If FPS is very high and we're not at max, consider increasing
  if (currentFPS > 55 && currentIndex < qualityOrder.length - 1) {
    return qualityOrder[currentIndex + 1];
  }

  return currentQuality;
}

/**
 * Performance budget checker
 * Returns recommendations based on current scene complexity
 */
export function checkPerformanceBudget(
  objectCount: number,
  particleCount: number,
  qualityLevel: QualityLevel
): {
  withinBudget: boolean;
  recommendations: string[];
} {
  const preset = QUALITY_PRESETS[qualityLevel];
  const recommendations: string[] = [];

  // Check object count
  const maxObjects = qualityLevel === 'ultra' ? 500 : qualityLevel === 'high' ? 300 : 150;
  if (objectCount > maxObjects) {
    recommendations.push(`Consider reducing objects from ${objectCount} to ${maxObjects}`);
  }

  // Check particle count
  if (particleCount > preset.maxParticles) {
    recommendations.push(`Reduce particles from ${particleCount} to ${preset.maxParticles}`);
  }

  return {
    withinBudget: recommendations.length === 0,
    recommendations,
  };
}

export default QUALITY_PRESETS;
