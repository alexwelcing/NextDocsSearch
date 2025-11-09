// Character Generator - Main pipeline for creating rigged characters

import {
  CharacterConfig,
  CharacterPromptParsed,
  CharacterType,
  MeshExtractionConfig,
  CharacterMaterialConfig,
  CollisionBox,
} from './characterTypes';
import { parseCharacterPrompt, extractCharacterName } from './characterPromptParser';
import { generateSkeleton } from './skeletonGenerator';
import { generateMultipleAnimations } from './animationGenerator';

export interface CharacterGenerationOptions {
  prompt: string;
  meshQuality?: 'low' | 'medium' | 'high' | 'ultra';
  enablePhysics?: boolean;
  interactionRadius?: number;
}

export interface CharacterGenerationResult {
  success: boolean;
  config: CharacterConfig;
  parsed: CharacterPromptParsed;
  error?: string;
  warnings?: string[];
  processingTime?: number;
}

export async function generateCharacter(
  options: CharacterGenerationOptions
): Promise<CharacterGenerationResult> {
  const startTime = performance.now();
  const warnings: string[] = [];

  try {
    const { prompt, meshQuality = 'medium', enablePhysics = true, interactionRadius = 2.0 } = options;

    // Step 1: Parse the prompt
    const parsed = parseCharacterPrompt(prompt);
    const characterName = extractCharacterName(prompt);

    // Step 2: Generate skeleton
    const skeleton = generateSkeleton({
      characterType: parsed.characterType,
      hasTail: parsed.features.hasTail,
      hasWings: parsed.features.hasWings,
      limbCount: parsed.features.limbCount,
      height: parsed.scale[1] * 2,
    });

    // Step 3: Generate animations
    const animations = generateMultipleAnimations(skeleton, parsed.suggestedAnimations);

    // Step 4: Configure mesh extraction
    const meshExtraction: MeshExtractionConfig = {
      meshQuality,
      vertexCount: getMeshVertexCount(meshQuality),
      smoothness: 0.7,
      preserveDetails: true,
      generateUVs: true,
      bakeTextures: true,
      textureSize: getTextureSize(meshQuality),
    };

    // Step 5: Configure materials
    const materials: CharacterMaterialConfig = {
      baseColor: parsed.materialHints.colors[0] || '#8b7355',
      roughness: getRoughnessForTexture(parsed.materialHints.texture),
      metalness: parsed.materialHints.texture === 'metallic' ? 0.8 : 0.1,
      skinShading: parsed.characterType === 'humanoid' || parsed.characterType === 'creature',
      subsurfaceScattering: {
        enabled: parsed.characterType === 'humanoid',
        color: '#ffccaa',
        thickness: 0.5,
      },
    };

    // Step 6: Generate collision boxes
    const collisionBoxes: CollisionBox[] = generateCollisionBoxes(parsed.characterType, skeleton);

    // Step 7: Assemble final config
    const config: CharacterConfig = {
      id: generateId(),
      name: characterName,
      description: prompt,
      characterType: parsed.characterType,
      meshExtraction,
      materials,
      skeleton,
      animations,
      defaultAnimation: 'idle',
      collisionBoxes,
      mass: getCharacterMass(parsed.characterType, parsed.scale),
      friction: 0.5,
      restitution: 0.1,
      interactive: true,
      interactionRadius,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: parsed.scale,
      tags: parsed.tags,
      createdAt: new Date(),
    };

    // Warnings
    if (parsed.features.specialFeatures.length > 3) {
      warnings.push(
        'Character has many special features - this may affect performance'
      );
    }

    const processingTime = performance.now() - startTime;

    return {
      success: true,
      config,
      parsed,
      warnings,
      processingTime,
    };
  } catch (error) {
    return {
      success: false,
      config: {} as CharacterConfig,
      parsed: {} as CharacterPromptParsed,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: performance.now() - startTime,
    };
  }
}

function getMeshVertexCount(quality: string): number {
  switch (quality) {
    case 'low':
      return 5000;
    case 'medium':
      return 15000;
    case 'high':
      return 40000;
    case 'ultra':
      return 100000;
    default:
      return 15000;
  }
}

function getTextureSize(quality: string): number {
  switch (quality) {
    case 'low':
      return 512;
    case 'medium':
      return 1024;
    case 'high':
      return 2048;
    case 'ultra':
      return 4096;
    default:
      return 1024;
  }
}

function getRoughnessForTexture(texture: string): number {
  switch (texture) {
    case 'smooth':
      return 0.2;
    case 'rough':
      return 0.8;
    case 'scaly':
      return 0.6;
    case 'furry':
      return 0.9;
    case 'metallic':
      return 0.3;
    default:
      return 0.5;
  }
}

function getCharacterMass(characterType: CharacterType, scale: [number, number, number]): number {
  const volume = scale[0] * scale[1] * scale[2];
  const baseMass = characterType === 'humanoid' ? 70 : characterType === 'creature' ? 50 : 20;
  return baseMass * volume;
}

function generateCollisionBoxes(
  characterType: CharacterType,
  skeleton: any
): CollisionBox[] {
  const boxes: CollisionBox[] = [];

  // Main body collision
  boxes.push({
    name: 'body',
    boneName: 'spine',
    position: [0, 0, 0],
    size: [0.8, 1.2, 0.6],
    type: 'hitbox',
    enabled: true,
  });

  // Head collision
  if (skeleton.bones.find((b: any) => b.name === 'head')) {
    boxes.push({
      name: 'head',
      boneName: 'head',
      position: [0, 0.15, 0],
      size: [0.4, 0.4, 0.4],
      type: 'hitbox',
      enabled: true,
    });
  }

  // Interaction trigger
  boxes.push({
    name: 'interaction_trigger',
    boneName: 'root',
    position: [0, 0, 0],
    size: [2, 2, 2],
    type: 'trigger',
    enabled: true,
  });

  return boxes;
}

function generateId(): string {
  return `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Utility function to validate character config
export function validateCharacterConfig(config: CharacterConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.id) errors.push('Missing character ID');
  if (!config.name) errors.push('Missing character name');
  if (!config.skeleton || !config.skeleton.bones || config.skeleton.bones.length === 0) {
    errors.push('Invalid skeleton configuration');
  }
  if (!config.animations || config.animations.length === 0) {
    errors.push('No animations configured');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
