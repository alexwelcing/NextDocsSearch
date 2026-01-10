/**
 * 3D Library - Core utilities and vision
 *
 * This module provides the foundation for immersive 3D article experiences:
 * - Vision and theme definitions
 * - Performance utilities (caching, LOD, disposal)
 * - Layout algorithms
 */

// Vision and themes
export {
  COSMIC_LIBRARY,
  DIGITAL_GARDEN,
  NOIR_ARCHIVE,
  DAWN_HORIZON,
  EXPERIENCE_THEMES,
  getThemeForQuality,
  calculateOrbVisuals,
  DEFAULT_LAYOUT,
  type ExperienceTheme,
  type OrbVisualConfig,
  type LayoutPattern,
  type LayoutConfig,
} from './vision';

// Performance utilities
export {
  // Caching
  geometryCache,
  materialCache,
  textureCache,

  // LOD
  LOD_PRESETS,
  createLOD,
  calculateLODLevel,

  // Frustum culling
  updateFrustum,
  isInFrustum,
  isBoxInFrustum,
  isPointInFrustum,

  // Batched updates
  batchMatrixUpdates,
  smoothStep,
  smoothVector3,

  // Disposal
  disposeObject,
  disposeMaterial,
  disposeAllCaches,

  // Performance monitoring
  getPerformanceMetrics,
  FrameTimeTracker,

  // Instancing
  createInstancedMesh,
  InstancePool,

  type LODLevel,
  type PerformanceMetrics,
} from './performanceUtils';
