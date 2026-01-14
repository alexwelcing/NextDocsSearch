/**
 * Idea Experience Components
 *
 * A unified, spatial system for content exploration that replaces
 * traditional menu-based navigation with an immersive 3D experience.
 *
 * Usage:
 * ```tsx
 * import { IdeaExperience } from '@/components/ideas';
 *
 * function MyScene() {
 *   return (
 *     <IdeaExperience
 *       articles={articleData}
 *       position={[0, 2, 0]}
 *     />
 *   );
 * }
 * ```
 */

// Main experience component
export { default as IdeaExperience } from './IdeaExperience';
export type { IdeaExperienceProps } from './IdeaExperience';
export { default as IdeaProgress } from './IdeaProgress';

// Individual components (for custom implementations)
export { default as IdeaOrb, ConstellationOrb } from './IdeaOrb';
export { default as IdeaHub } from './IdeaHub';
export type { IdeaHubProps } from './IdeaHub';
export { default as IdeaContent } from './IdeaContent';

// Types
export type {
  OrbState,
  OrbContentType,
  OrbContent,
  IdeaOrbData,
  IdeaHubConfig,
  IdeaGameState,
  IdeaGameStats,
  ConstellationNode,
} from './types';

// Constants
export { ORB_COLORS, DEFAULT_HUB_CONFIG, EASINGS } from './types';
