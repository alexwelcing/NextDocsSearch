// Core types for the 3D Creation Generator System

export type BaseShape =
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'torus'
  | 'cone'
  | 'text3d'
  | 'extrusion'
  | 'twisted'
  | 'fractal'
  | 'organic';

export type DistortionType =
  | 'noise'
  | 'twist'
  | 'decay'
  | 'erosion'
  | 'stretch'
  | 'melt'
  | 'shatter'
  | 'pulse';

export type AnimationType =
  | 'rotate'
  | 'float'
  | 'pulse'
  | 'glitch'
  | 'phase-shift'
  | 'breathe'
  | 'drift'
  | 'flicker';

export type ThemeCategory = 'horror' | 'editorial' | 'cinematic' | 'abstract' | 'hybrid';

export interface MaterialConfig {
  color: string;
  roughness: number;
  metalness: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  transparent?: boolean;
  transmission?: number;
  ior?: number;
  thickness?: number;
  clearcoat?: number;
  wireframe?: boolean;
}

export interface DistortionConfig {
  type: DistortionType;
  intensity: number;
  frequency?: number;
  seed?: number;
  animate?: boolean;
}

export interface ParticleConfig {
  count: number;
  color: string;
  size: number;
  opacity: number;
  speed: number;
  spread: number;
  emissive?: boolean;
  shape?: 'sphere' | 'box' | 'point';
}

export interface LightingConfig {
  type: 'point' | 'spot' | 'directional' | 'ambient';
  color: string;
  intensity: number;
  position?: [number, number, number];
  castShadow?: boolean;
  distance?: number;
  decay?: number;
}

export interface AtmosphereConfig {
  fog?: {
    color: string;
    near: number;
    far: number;
    density?: number;
  };
  particles?: ParticleConfig;
  lighting?: LightingConfig[];
  postProcessing?: {
    bloom?: boolean;
    vignette?: boolean;
    chromaticAberration?: boolean;
    glitch?: boolean;
  };
}

export interface GeometryModifiers {
  twisted?: boolean;
  decayed?: boolean;
  fractured?: boolean;
  organic?: boolean;
  hollow?: boolean;
  sharp?: boolean;
  smooth?: boolean;
  distortion?: DistortionConfig;
}

export interface AnimationConfig {
  type: AnimationType;
  speed: number;
  intensity: number;
  loop: boolean;
  delay?: number;
  easing?: string;
}

export interface ParsedPrompt {
  // Core properties
  baseShape: BaseShape;
  scale: [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];

  // Visual properties
  materials: MaterialConfig;
  modifiers: GeometryModifiers;

  // Environmental properties
  atmosphere: AtmosphereConfig;

  // Animation
  animations?: AnimationConfig[];

  // Metadata
  theme: ThemeCategory;
  horrorLevel: number; // 0-10
  complexity: number; // 0-10
  tags: string[];

  // Text content (for text3d shapes)
  text?: string;
  font?: string;

  // Custom properties
  custom?: Record<string, any>;
}

export interface CreationTemplate {
  id: string;
  name: string;
  description: string;
  category: ThemeCategory;
  thumbnail?: string;

  // Template configuration
  baseConfig: Partial<ParsedPrompt>;

  // Variations
  variations?: {
    name: string;
    modifications: Partial<ParsedPrompt>;
  }[];

  // Prompt suggestions
  suggestedPrompts?: string[];

  // Keywords that trigger this template
  keywords: string[];
}

export interface SavedCreation {
  id: string;
  userId?: string;
  name: string;
  prompt: string;
  config: ParsedPrompt;
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
  likes?: number;
  public: boolean;
  articleId?: string;
  tags: string[];
}

export interface GenerationResult {
  success: boolean;
  config: ParsedPrompt;
  componentCode?: string;
  error?: string;
  warnings?: string[];
  processingTime?: number;
}

// Preset collections
export interface StylePreset {
  name: string;
  description: string;
  category: ThemeCategory;
  materialOverrides: Partial<MaterialConfig>;
  atmosphereOverrides: Partial<AtmosphereConfig>;
  modifierOverrides: Partial<GeometryModifiers>;
  icon?: string;
}

export const HORROR_LEVELS = {
  SUBTLE: 2,
  ATMOSPHERIC: 4,
  UNSETTLING: 6,
  INTENSE: 8,
  VISCERAL: 10
} as const;

export const COMPLEXITY_LEVELS = {
  SIMPLE: 2,
  MODERATE: 4,
  DETAILED: 6,
  COMPLEX: 8,
  EXTREME: 10
} as const;
