// Types for Character Generation with Rigging and Animation

export type CharacterType = 'humanoid' | 'creature' | 'object' | 'custom';

export type BoneType =
  | 'root'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'shoulder_l'
  | 'shoulder_r'
  | 'arm_upper_l'
  | 'arm_upper_r'
  | 'arm_lower_l'
  | 'arm_lower_r'
  | 'hand_l'
  | 'hand_r'
  | 'hip_l'
  | 'hip_r'
  | 'leg_upper_l'
  | 'leg_upper_r'
  | 'leg_lower_l'
  | 'leg_lower_r'
  | 'foot_l'
  | 'foot_r'
  | 'tail_base'
  | 'tail_mid'
  | 'tail_tip'
  | 'wing_l'
  | 'wing_r'
  | 'jaw'
  | 'custom';

export type CharacterAnimationPreset =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'wave'
  | 'dance'
  | 'attack'
  | 'interact'
  | 'emote'
  | 'custom';

export interface BoneConfig {
  name: string;
  type: BoneType;
  position: [number, number, number];
  rotation?: [number, number, number];
  parent?: string;
  length: number;
  weight: number; // Influence weight 0-1
}

export interface SkeletonConfig {
  bones: BoneConfig[];
  characterType: CharacterType;
  autoRig: boolean; // Auto-generate bone weights
  symmetrical: boolean; // Mirror left/right bones
}

export interface AnimationKeyframe {
  time: number; // Time in seconds
  boneName: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

export interface CharacterAnimationClip {
  name: string;
  preset?: CharacterAnimationPreset;
  duration: number; // In seconds
  loop: boolean;
  keyframes: AnimationKeyframe[];
  blendMode?: 'override' | 'additive';
  weight?: number; // For blending multiple animations
}

export interface CollisionBox {
  name: string;
  boneName?: string; // Attach to bone
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  type: 'hitbox' | 'hurtbox' | 'trigger';
  enabled: boolean;
}

export interface MeshExtractionConfig {
  gaussianSplatSource?: string; // Path to .splat file or Gaussian data
  meshQuality: 'low' | 'medium' | 'high' | 'ultra';
  vertexCount: number; // Target vertex count
  smoothness: number; // 0-1
  preserveDetails: boolean;
  generateUVs: boolean;
  bakeTextures: boolean;
  textureSize: number; // 512, 1024, 2048, 4096
}

export interface CharacterMaterialConfig {
  baseColor: string;
  roughness: number;
  metalness: number;
  skinShading?: boolean; // Special skin shader
  subsurfaceScattering?: {
    enabled: boolean;
    color: string;
    thickness: number;
  };
  normalMap?: string;
  roughnessMap?: string;
  emissive?: string;
  emissiveIntensity?: number;
}

export interface CharacterConfig {
  // Identity
  id: string;
  name: string;
  description: string;

  // Type
  characterType: CharacterType;

  // Mesh generation
  meshExtraction: MeshExtractionConfig;

  // Materials
  materials: CharacterMaterialConfig;

  // Rigging
  skeleton: SkeletonConfig;

  // Animation
  animations: CharacterAnimationClip[];
  defaultAnimation?: string; // Name of default animation

  // Physics & Collision
  collisionBoxes: CollisionBox[];
  mass: number;
  friction: number;
  restitution: number;

  // Interaction
  interactive: boolean;
  interactionRadius: number;

  // Transform
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];

  // Metadata
  tags: string[];
  createdAt?: Date;
}

export interface CharacterPromptParsed {
  description: string;
  characterType: CharacterType;
  features: {
    hasTail: boolean;
    hasWings: boolean;
    limbCount: number;
    specialFeatures: string[];
  };
  suggestedAnimations: CharacterAnimationPreset[];
  materialHints: {
    colors: string[];
    texture: 'smooth' | 'rough' | 'scaly' | 'furry' | 'metallic';
  };
  scale: [number, number, number];
  tags: string[];
}

// Animation Presets Library
export const ANIMATION_PRESETS: Record<CharacterAnimationPreset, Partial<CharacterAnimationClip>> = {
  idle: {
    duration: 2,
    loop: true,
  },
  walk: {
    duration: 1,
    loop: true,
  },
  run: {
    duration: 0.6,
    loop: true,
  },
  jump: {
    duration: 0.8,
    loop: false,
  },
  wave: {
    duration: 1.5,
    loop: false,
  },
  dance: {
    duration: 4,
    loop: true,
  },
  attack: {
    duration: 0.5,
    loop: false,
  },
  interact: {
    duration: 1,
    loop: false,
  },
  emote: {
    duration: 1.2,
    loop: false,
  },
  custom: {
    duration: 1,
    loop: true,
  },
};

// Skeleton Templates
export const SKELETON_TEMPLATES: Record<CharacterType, Partial<SkeletonConfig>> = {
  humanoid: {
    characterType: 'humanoid',
    autoRig: true,
    symmetrical: true,
  },
  creature: {
    characterType: 'creature',
    autoRig: true,
    symmetrical: true,
  },
  object: {
    characterType: 'object',
    autoRig: false,
    symmetrical: false,
  },
  custom: {
    characterType: 'custom',
    autoRig: false,
    symmetrical: false,
  },
};
