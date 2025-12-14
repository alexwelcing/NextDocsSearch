/**
 * Idea Experience Types
 *
 * Type definitions for the unified idea orb and hub system.
 */

import type { Vector3Tuple } from 'three';

/**
 * Visual/interaction state of an orb
 */
export type OrbState =
  | 'dormant'    // Gray, waiting to be awakened
  | 'awakening'  // During game - glowing target
  | 'active'     // Ready to interact with
  | 'engaged'    // Currently being interacted with
  | 'explored'   // Completed, part of constellation

/**
 * Content type that an orb can hold
 */
export type OrbContentType =
  | 'article'
  | 'chat'
  | 'quiz'
  | 'creation'
  | 'mystery'
  | 'game';

/**
 * Content payload for orbs
 */
export interface OrbContent {
  type: OrbContentType;
  id: string;
  title?: string;
  preview?: string;
  data?: unknown;
  isRare?: boolean;  // Golden orb indicator
}

/**
 * Complete orb definition
 */
export interface IdeaOrbData {
  id: string;
  state: OrbState;
  content: OrbContent;
  position: Vector3Tuple;
  /** Visual customization */
  color?: string;
  size?: number;
  /** Progress tracking */
  exploredAt?: number;
  awakeningCount?: number;
}

/**
 * Hub configuration
 */
export interface IdeaHubConfig {
  /** Orbs arranged in rings around center */
  rings: {
    radius: number;
    orbCount: number;
    elevation: number;
    rotationSpeed: number;
  }[];
  /** Game activation settings */
  game: {
    duration: number;
    spawnRate: number;
    maxOrbs: number;
  };
}

/**
 * Game state for the idea awakening game
 */
export type IdeaGameState =
  | 'idle'
  | 'starting'
  | 'countdown'
  | 'playing'
  | 'ending'
  | 'results';

/**
 * Game session stats
 */
export interface IdeaGameStats {
  ideasAwakened: number;
  insightLevel: number;  // Max combo achieved
  rareDiscoveries: number;  // Golden orbs hit
  totalClicks: number;
  accuracy: number;
  duration: number;
}

/**
 * Progress constellation node
 */
export interface ConstellationNode {
  id: string;
  type: OrbContentType;
  position: Vector3Tuple;
  connectedTo: string[];
  brightness: number;
  exploredAt: number;
}

/**
 * Color scheme for orb states and types
 */
export const ORB_COLORS = {
  // States
  dormant: '#444466',
  awakening: '#88aaff',
  active: '#4488ff',
  engaged: '#66ffaa',
  explored: '#aa88ff',

  // Content types
  article: '#44ff88',
  chat: '#4488ff',
  quiz: '#aa44ff',
  creation: '#ffaa44',
  mystery: '#ff44aa',
  game: '#ff4444',

  // Special
  rare: '#ffd700',
  core: '#ffffff',
} as const;

/**
 * Default hub configuration
 */
export const DEFAULT_HUB_CONFIG: IdeaHubConfig = {
  rings: [
    { radius: 3, orbCount: 4, elevation: 0, rotationSpeed: 0.1 },
    { radius: 5, orbCount: 6, elevation: 0.5, rotationSpeed: -0.05 },
    { radius: 7, orbCount: 8, elevation: -0.5, rotationSpeed: 0.03 },
  ],
  game: {
    duration: 30,
    spawnRate: 2,
    maxOrbs: 8,
  },
};

/**
 * Easing functions for animations
 */
export const EASINGS = {
  easeOutElastic: (t: number): number => {
    const p = 0.3;
    return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
  },
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutCubic: (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },
};
