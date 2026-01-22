/**
 * 3D-V2 - Clean, performant 3D components
 *
 * A streamlined 3D rendering system with:
 * - SparkJS Gaussian Splatting support
 * - GPU-accelerated particle effects
 * - Clean game mechanics
 * - High performance focus
 */

// Core
export { default as SparkScene } from './core/SparkScene';
export { default as SplatLoader } from './core/SplatLoader';

// Effects
export { default as ParticleField } from './effects/ParticleField';
export { default as CosmicOrb } from './effects/CosmicOrb';
export { default as LaserEffect } from './effects/LaserEffect';

// Game
export { default as TargetOrb } from './game/TargetOrb';
export { default as SphereHunter } from './game/SphereHunter';
export type { GameState, GameStats } from './game/SphereHunter';

// Main component
export { default as ThreeSixtyV2 } from './ThreeSixtyV2';

// Shaders (for advanced customization)
export * from './shaders/particles';
