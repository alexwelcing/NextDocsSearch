/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARTISTIC VISION: The Infinite Library
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CONCEPT:
 * Articles exist as luminous orbs of knowledge floating in an infinite,
 * dreamlike space. The experience evokes the feeling of wandering through
 * a cosmic library where ideas have physical form and emotional weight.
 *
 * EMOTIONAL GOALS:
 * - Wonder & Discovery: Each article feels like finding a hidden treasure
 * - Serenity & Focus: The space invites deep reading and contemplation
 * - Connection: Visual threads show how ideas relate to each other
 * - Journey: Moving through the space feels like intellectual exploration
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VISUAL LANGUAGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * COLOR PALETTE:
 * - Deep Space: Rich midnight blues (#0a0a1a) to soft charcoal (#1a1a2e)
 * - Accent Glow: Warm amber (#ffd700) for selected/active states
 * - Knowledge Orbs: Gradient from cool cyan (#00d4ff) to warm coral (#ff6b6b)
 *   based on article sentiment/category
 * - Atmospheric: Subtle purple (#9d4edd) and teal (#2dd4bf) for depth
 *
 * LIGHTING:
 * - Soft ambient glow that breathes slowly (0.5Hz)
 * - Rim lighting on orbs for ethereal floating effect
 * - Volumetric light shafts for moments of discovery
 * - Subtle god rays when approaching important content
 *
 * PARTICLES:
 * - Floating dust motes (wisdom particles) that drift slowly
 * - Connection lines between related articles (constellation effect)
 * - Gentle sparkle trails when navigating
 * - Subtle aurora waves in the far background
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EXPERIENCE THEMES
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { QualityLevel } from '@/lib/worlds/types';

/**
 * Theme definitions for different moods and contexts
 */
export interface ExperienceTheme {
  id: string;
  name: string;
  description: string;

  // Color palette
  colors: {
    background: string;
    backgroundGradient: [string, string];
    ambient: string;
    accent: string;
    highlight: string;
    text: string;
  };

  // Lighting configuration
  lighting: {
    ambientIntensity: number;
    ambientColor: string;
    keyLightIntensity: number;
    keyLightColor: string;
    keyLightPosition: [number, number, number];
    rimLightIntensity: number;
    rimLightColor: string;
    breathingSpeed: number; // Hz
    breathingAmount: number; // 0-1
  };

  // Atmosphere
  atmosphere: {
    fogEnabled: boolean;
    fogColor: string;
    fogNear: number;
    fogFar: number;
    particleDensity: number; // 0-1
    particleColor: string;
    particleSpeed: number;
    auroraEnabled: boolean;
    auroraColors: [string, string, string];
  };

  // Post-processing
  postProcessing: {
    bloomIntensity: number;
    bloomThreshold: number;
    bloomRadius: number;
    vignetteIntensity: number;
    chromaticAberration: number;
    saturation: number;
    contrast: number;
  };

  // Animation
  animation: {
    cameraFloatAmount: number;
    cameraFloatSpeed: number;
    orbPulseSpeed: number;
    transitionDuration: number;
  };
}

/**
 * The Cosmic Library - Default dreamy exploration theme
 */
export const COSMIC_LIBRARY: ExperienceTheme = {
  id: 'cosmic-library',
  name: 'Cosmic Library',
  description: 'A dreamy infinite space where knowledge floats like stars',

  colors: {
    background: '#0a0a1a',
    backgroundGradient: ['#0a0a1a', '#1a1a3e'],
    ambient: '#4a4a6a',
    accent: '#ffd700',
    highlight: '#00d4ff',
    text: '#e0e0ff',
  },

  lighting: {
    ambientIntensity: 0.3,
    ambientColor: '#4a4a8a',
    keyLightIntensity: 0.8,
    keyLightColor: '#ffffff',
    keyLightPosition: [10, 15, 10],
    rimLightIntensity: 0.4,
    rimLightColor: '#9d4edd',
    breathingSpeed: 0.5,
    breathingAmount: 0.15,
  },

  atmosphere: {
    fogEnabled: true,
    fogColor: '#0a0a2a',
    fogNear: 20,
    fogFar: 100,
    particleDensity: 0.6,
    particleColor: '#ffffff',
    particleSpeed: 0.02,
    auroraEnabled: true,
    auroraColors: ['#9d4edd', '#2dd4bf', '#00d4ff'],
  },

  postProcessing: {
    bloomIntensity: 0.8,
    bloomThreshold: 0.6,
    bloomRadius: 0.4,
    vignetteIntensity: 0.3,
    chromaticAberration: 0.002,
    saturation: 1.1,
    contrast: 1.05,
  },

  animation: {
    cameraFloatAmount: 0.3,
    cameraFloatSpeed: 0.3,
    orbPulseSpeed: 2,
    transitionDuration: 1.5,
  },
};

/**
 * Digital Garden - Organic, growing, verdant
 */
export const DIGITAL_GARDEN: ExperienceTheme = {
  id: 'digital-garden',
  name: 'Digital Garden',
  description: 'A living space where ideas grow and bloom',

  colors: {
    background: '#0a1a0a',
    backgroundGradient: ['#0a1a0a', '#1a2a1a'],
    ambient: '#2a4a2a',
    accent: '#90EE90',
    highlight: '#32CD32',
    text: '#e0ffe0',
  },

  lighting: {
    ambientIntensity: 0.4,
    ambientColor: '#3a5a3a',
    keyLightIntensity: 0.9,
    keyLightColor: '#fffacd',
    keyLightPosition: [8, 20, 5],
    rimLightIntensity: 0.3,
    rimLightColor: '#90EE90',
    breathingSpeed: 0.3,
    breathingAmount: 0.2,
  },

  atmosphere: {
    fogEnabled: true,
    fogColor: '#0a2a1a',
    fogNear: 15,
    fogFar: 80,
    particleDensity: 0.8,
    particleColor: '#90EE90',
    particleSpeed: 0.03,
    auroraEnabled: false,
    auroraColors: ['#32CD32', '#90EE90', '#98FB98'],
  },

  postProcessing: {
    bloomIntensity: 0.6,
    bloomThreshold: 0.7,
    bloomRadius: 0.3,
    vignetteIntensity: 0.25,
    chromaticAberration: 0.001,
    saturation: 1.2,
    contrast: 1.0,
  },

  animation: {
    cameraFloatAmount: 0.2,
    cameraFloatSpeed: 0.2,
    orbPulseSpeed: 1.5,
    transitionDuration: 2.0,
  },
};

/**
 * Noir Archive - Dramatic, mysterious, editorial
 */
export const NOIR_ARCHIVE: ExperienceTheme = {
  id: 'noir-archive',
  name: 'Noir Archive',
  description: 'A dramatic space of shadows and revelation',

  colors: {
    background: '#0a0a0a',
    backgroundGradient: ['#0a0a0a', '#1a1a1a'],
    ambient: '#3a3a3a',
    accent: '#ff6b6b',
    highlight: '#ffffff',
    text: '#e0e0e0',
  },

  lighting: {
    ambientIntensity: 0.15,
    ambientColor: '#2a2a2a',
    keyLightIntensity: 1.2,
    keyLightColor: '#ffffff',
    keyLightPosition: [5, 10, 8],
    rimLightIntensity: 0.6,
    rimLightColor: '#ff6b6b',
    breathingSpeed: 0.4,
    breathingAmount: 0.1,
  },

  atmosphere: {
    fogEnabled: true,
    fogColor: '#0a0a0a',
    fogNear: 10,
    fogFar: 60,
    particleDensity: 0.3,
    particleColor: '#ffffff',
    particleSpeed: 0.01,
    auroraEnabled: false,
    auroraColors: ['#ff6b6b', '#ffffff', '#888888'],
  },

  postProcessing: {
    bloomIntensity: 1.0,
    bloomThreshold: 0.5,
    bloomRadius: 0.5,
    vignetteIntensity: 0.5,
    chromaticAberration: 0.003,
    saturation: 0.9,
    contrast: 1.2,
  },

  animation: {
    cameraFloatAmount: 0.1,
    cameraFloatSpeed: 0.15,
    orbPulseSpeed: 3,
    transitionDuration: 1.0,
  },
};

/**
 * Dawn Horizon - Warm, hopeful, inspiring
 */
export const DAWN_HORIZON: ExperienceTheme = {
  id: 'dawn-horizon',
  name: 'Dawn Horizon',
  description: 'A warm space of new beginnings and hope',

  colors: {
    background: '#1a0a0a',
    backgroundGradient: ['#1a0a0a', '#2a1a1a'],
    ambient: '#4a3a3a',
    accent: '#ffd700',
    highlight: '#ff8c00',
    text: '#fff0e0',
  },

  lighting: {
    ambientIntensity: 0.35,
    ambientColor: '#5a4030',
    keyLightIntensity: 1.0,
    keyLightColor: '#ffd4a0',
    keyLightPosition: [-15, 5, 10],
    rimLightIntensity: 0.5,
    rimLightColor: '#ff8c00',
    breathingSpeed: 0.25,
    breathingAmount: 0.2,
  },

  atmosphere: {
    fogEnabled: true,
    fogColor: '#2a1a1a',
    fogNear: 25,
    fogFar: 120,
    particleDensity: 0.5,
    particleColor: '#ffd700',
    particleSpeed: 0.015,
    auroraEnabled: true,
    auroraColors: ['#ff8c00', '#ffd700', '#ffb347'],
  },

  postProcessing: {
    bloomIntensity: 0.9,
    bloomThreshold: 0.55,
    bloomRadius: 0.45,
    vignetteIntensity: 0.2,
    chromaticAberration: 0.001,
    saturation: 1.15,
    contrast: 1.05,
  },

  animation: {
    cameraFloatAmount: 0.25,
    cameraFloatSpeed: 0.2,
    orbPulseSpeed: 1.8,
    transitionDuration: 2.5,
  },
};

/**
 * All available themes
 */
export const EXPERIENCE_THEMES: Record<string, ExperienceTheme> = {
  'cosmic-library': COSMIC_LIBRARY,
  'digital-garden': DIGITAL_GARDEN,
  'noir-archive': NOIR_ARCHIVE,
  'dawn-horizon': DAWN_HORIZON,
};

/**
 * Get theme adjusted for quality level
 */
export function getThemeForQuality(
  theme: ExperienceTheme,
  quality: QualityLevel
): ExperienceTheme {
  const qualityMultipliers: Record<QualityLevel, number> = {
    low: 0.3,
    medium: 0.6,
    high: 0.85,
    ultra: 1.0,
  };

  const mult = qualityMultipliers[quality];

  return {
    ...theme,
    atmosphere: {
      ...theme.atmosphere,
      particleDensity: theme.atmosphere.particleDensity * mult,
      auroraEnabled: quality !== 'low' && theme.atmosphere.auroraEnabled,
    },
    postProcessing: {
      ...theme.postProcessing,
      bloomIntensity: theme.postProcessing.bloomIntensity * mult,
      chromaticAberration:
        quality === 'low' ? 0 : theme.postProcessing.chromaticAberration,
    },
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARTICLE ORB VISUALIZATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Articles are represented as glowing orbs with visual properties that
 * communicate their nature at a glance:
 *
 * SIZE: Represents importance/reach
 * - Small (0.3): Local interest, niche topics
 * - Medium (0.5): Regional, moderate interest
 * - Large (0.8): Major stories, high engagement
 * - Giant (1.2): Breaking news, viral content
 *
 * COLOR: Represents sentiment/tone (on a spectrum)
 * - Deep Blue (#0066cc): Very negative, concerning
 * - Light Blue (#66b3ff): Slightly negative, cautionary
 * - White/Silver (#e0e0ff): Neutral, informational
 * - Light Gold (#ffd700): Slightly positive, encouraging
 * - Warm Coral (#ff6b6b): Very positive, celebratory
 *
 * GLOW INTENSITY: Represents recency
 * - Bright pulsing: Just published (< 1 hour)
 * - Steady glow: Recent (< 24 hours)
 * - Soft glow: This week
 * - Dim: Older content
 *
 * ORBIT PATTERN: Represents category
 * - Tight cluster: Related articles on same topic
 * - Orbital ring: Same category, different topics
 * - Floating free: Unique/uncategorized
 */

export interface OrbVisualConfig {
  baseSize: number;
  glowIntensity: number;
  glowColor: string;
  coreColor: string;
  pulseSpeed: number;
  orbitRadius: number;
  orbitSpeed: number;
}

/**
 * Calculate orb visual properties from article metadata
 */
export function calculateOrbVisuals(article: {
  polarity?: number; // -1 to 1
  horizon?: string; // NQ, N24, N100, etc.
  publishedAt?: Date;
  category?: string;
}): OrbVisualConfig {
  // Size based on horizon (reach/importance)
  const horizonSizes: Record<string, number> = {
    NQ: 0.3,
    N24: 0.4,
    N100: 0.5,
    N500: 0.6,
    N1000: 0.8,
    N5000: 1.0,
    N10000: 1.2,
  };
  const baseSize = horizonSizes[article.horizon || 'N24'] || 0.4;

  // Color based on polarity (sentiment)
  const polarity = article.polarity ?? 0;
  let coreColor: string;
  let glowColor: string;

  if (polarity < -0.5) {
    coreColor = '#0066cc';
    glowColor = '#0088ff';
  } else if (polarity < -0.1) {
    coreColor = '#66b3ff';
    glowColor = '#88ccff';
  } else if (polarity < 0.1) {
    coreColor = '#e0e0ff';
    glowColor = '#ffffff';
  } else if (polarity < 0.5) {
    coreColor = '#ffd700';
    glowColor = '#ffee88';
  } else {
    coreColor = '#ff6b6b';
    glowColor = '#ff9999';
  }

  // Glow intensity based on recency
  const now = new Date();
  const publishedAt = article.publishedAt || now;
  const hoursAgo = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60);

  let glowIntensity: number;
  let pulseSpeed: number;

  if (hoursAgo < 1) {
    glowIntensity = 1.0;
    pulseSpeed = 3.0;
  } else if (hoursAgo < 24) {
    glowIntensity = 0.8;
    pulseSpeed = 2.0;
  } else if (hoursAgo < 168) {
    // 1 week
    glowIntensity = 0.5;
    pulseSpeed = 1.0;
  } else {
    glowIntensity = 0.3;
    pulseSpeed = 0.5;
  }

  return {
    baseSize,
    glowIntensity,
    glowColor,
    coreColor,
    pulseSpeed,
    orbitRadius: 0,
    orbitSpeed: 0,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SPATIAL LAYOUT PATTERNS
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type LayoutPattern =
  | 'constellation' // Articles as star patterns, related ones connected
  | 'galaxy' // Spiral arrangement with categories as arms
  | 'timeline' // Linear time-based arrangement
  | 'clusters' // Topic-based clustering
  | 'sphere' // Even distribution on a sphere surface
  | 'helix' // DNA-like double helix of contrasting viewpoints;

export interface LayoutConfig {
  pattern: LayoutPattern;
  radius: number;
  density: number;
  showConnections: boolean;
  connectionStrength: number; // 0-1, affects line opacity
  animatePositions: boolean;
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  pattern: 'constellation',
  radius: 30,
  density: 0.7,
  showConnections: true,
  connectionStrength: 0.5,
  animatePositions: true,
};
