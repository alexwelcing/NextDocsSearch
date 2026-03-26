/**
 * ProGen - Procedural Character Generation System
 * 
 * Pre-generates high-quality rigged characters with rich variation,
 * validates quality, and serves instantly to users.
 */

import { Vector3 } from 'three';

// === Character Anatomy & Structure ===

export interface BodyProportions {
  height: number;           // 1.5 - 2.0 (meters)
  shoulderWidth: number;    // 0.3 - 0.6
  chestDepth: number;       // 0.2 - 0.35
  waistWidth: number;       // 0.25 - 0.45
  hipWidth: number;         // 0.3 - 0.5
  armLength: number;        // 0.6 - 0.9
  legLength: number;        // 0.7 - 1.1
  neckLength: number;       // 0.08 - 0.15
  headScale: number;        // 0.9 - 1.15
}

export interface BodyShape {
  build: 'ectomorph' | 'mesomorph' | 'endomorph' | 'mixed';
  muscularity: number;      // 0 - 1
  bodyFat: number;          // 0 - 1
  proportions: BodyProportions;
}

export interface FaceFeatures {
  faceWidth: number;
  jawStrength: number;
  cheekboneHeight: number;
  browRidge: number;
  noseBridge: number;
  noseWidth: number;
  lipFullness: number;
  eyeSize: number;
  eyeSpacing: number;
}

// === Visual Style ===

export interface ColorPalette {
  primary: string;          // Main outfit color
  secondary: string;        // Accent color
  tertiary: string;         // Detail color
  skinTone: string;
  hairColor: string;
  eyeColor: string;
}

export interface MaterialConfig {
  roughness: number;
  metalness: number;
  emissive?: string;
  emissiveIntensity?: number;
}

export type OutfitStyle = 
  | 'casual' | 'formal' | 'athletic' | 'tactical'
  | 'scifi' | 'fantasy' | 'minimal' | 'layered' | 'organic';

export type OutfitLayer = {
  type: 'base' | 'mid' | 'outer' | 'accessory';
  style: OutfitStyle;
  coverage: number;         // How much of body it covers
  bulk: number;             // Visual thickness
};

// === Character Identity ===

export interface CharacterIdentity {
  id: string;
  seed: number;
  displayName: string;
  archetype: CharacterArchetype;
  traits: CharacterTrait[];
  backstory?: string;
}

export type CharacterArchetype =
  | 'explorer' | 'scholar' | 'warrior' | 'mystic'
  | 'artisan' | 'diplomat' | 'rogue' | 'guardian'
  | 'nomad' | 'pioneer' | 'observer' | 'catalyst';

export interface CharacterTrait {
  name: string;
  value: number;            // -1 to 1
  category: 'personality' | 'physical' | 'style';
}

// === Animation & Skeleton ===

export interface SkeletonConfig {
  boneCount: number;
  hierarchy: BoneNode[];
  bindPose: PoseData;
}

export interface BoneNode {
  name: string;
  parent?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
}

export interface PoseData {
  positions: Float32Array;
  rotations: Float32Array;
}

export type AnimationState = 
  | 'idle' | 'walk' | 'run' | 'jump' 
  | 'interact' | 'emote' | 'custom';

// === Full Character Definition ===

export interface ProGenCharacter {
  identity: CharacterIdentity;
  body: BodyShape;
  face: FaceFeatures;
  colors: ColorPalette;
  materials: Record<string, MaterialConfig>;
  outfit: OutfitLayer[];
  skeleton: SkeletonConfig;
  animations: Record<AnimationState, AnimationClip>;
  
  // Generation metadata
  generation: {
    version: string;
    createdAt: Date;
    quality: QualityScore;
    renderCount: number;
  };
}

export interface AnimationClip {
  name: string;
  duration: number;
  keyframes: Keyframe[];
  loop: boolean;
}

export interface Keyframe {
  time: number;
  boneRotations: Map<string, [number, number, number, number]>; // quaternion
  bonePositions?: Map<string, [number, number, number]>;
}

// === Quality System ===

export interface QualityScore {
  overall: number;          // 0 - 100
  proportions: number;
  aesthetics: number;
  technical: number;
  uniqueness: number;
}

export interface QualityReport {
  characterId: string;
  scores: QualityScore;
  issues: QualityIssue[];
  passed: boolean;
  reviewedAt: Date;
}

export interface QualityIssue {
  type: 'proportion' | 'aesthetic' | 'technical' | 'duplicate';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  component?: string;
}

// === Generation Configuration ===

export interface GenerationBatch {
  id: string;
  name: string;
  config: GenerationConfig;
  status: 'pending' | 'generating' | 'validating' | 'complete' | 'failed';
  progress: {
    total: number;
    generated: number;
    validated: number;
    approved: number;
    currentStage: 'generating' | 'validating' | 'complete';
  };
  createdAt: Date;
  completedAt?: Date;
}

export interface GenerationConfig {
  count: number;
  archetypes?: CharacterArchetype[];  // Specific archetypes or random
  styleThemes?: StyleTheme[];
  qualityThreshold: number;
  variationStrategy: 'random' | 'evolutionary' | 'clustered';
  allowDuplicates: boolean;
  maxAttempts: number;
}

export type StyleTheme =
  | 'cyberpunk' | 'solarpunk' | 'retrofuturism' | 'biopunk'
  | 'minimalist' | 'baroque' | 'industrial' | 'organic'
  | 'neon' | 'monochrome' | 'pastel' | 'vibrant';

// === Storage & Retrieval ===

export interface CharacterIndex {
  characters: CharacterSummary[];
  filters: FilterOptions;
  sort: SortOptions;
}

export interface CharacterSummary {
  id: string;
  name: string;
  archetype: CharacterArchetype;
  thumbnailUrl: string;
  quality: QualityScore;
  tags: string[];
  usageCount: number;
}

export interface FilterOptions {
  archetypes?: CharacterArchetype[];
  qualityMin?: number;
  themes?: StyleTheme[];
  traits?: string[];
  tags?: string[];
}

export interface SortOptions {
  by: 'quality' | 'newest' | 'popular' | 'name';
  direction: 'asc' | 'desc';
}

// === Runtime API ===

export interface CharacterRequest {
  archetype?: CharacterArchetype;
  theme?: StyleTheme;
  traitPreferences?: Record<string, number>;
  excludeIds?: string[];
  randomize?: boolean;
}

export interface CharacterResponse {
  character: ProGenCharacter;
  loadTime: number;
  cached: boolean;
}

// === Procedural Generation Functions ===

export type BodyPart = 
  | 'head' | 'neck' | 'torso' | 'pelvis'
  | 'shoulderL' | 'shoulderR' | 'upperArmL' | 'upperArmR'
  | 'lowerArmL' | 'lowerArmR' | 'handL' | 'handR'
  | 'thighL' | 'thighR' | 'shinL' | 'shinR' | 'footL' | 'footR';

export interface BodyPartGeometry {
  part: BodyPart;
  vertices: Float32Array;
  indices: Uint16Array;
  normals: Float32Array;
  uvs: Float32Array;
  boneWeights?: Float32Array;
  boneIndices?: Uint8Array;
}

// === Export Formats ===

export interface ExportOptions {
  format: 'json' | 'gltf' | 'fbx-binary';
  includeAnimations: boolean;
  compress: boolean;
  lodLevels?: number[];
}

// === Performance Tracking ===

export interface GenerationMetrics {
  totalGenerated: number;
  totalApproved: number;
  averageQuality: number;
  averageGenerationTime: number;
  cacheHitRate: number;
  popularArchetypes: Record<CharacterArchetype, number>;
}
