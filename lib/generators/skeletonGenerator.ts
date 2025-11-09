// Skeleton Generator - Creates bone structures for characters

import {
  BoneConfig,
  SkeletonConfig,
  CharacterType,
  BoneType,
} from './characterTypes';

interface SkeletonGeneratorOptions {
  characterType: CharacterType;
  hasTail?: boolean;
  hasWings?: boolean;
  limbCount?: number;
  height?: number;
}

export function generateSkeleton(options: SkeletonGeneratorOptions): SkeletonConfig {
  const { characterType, hasTail = false, hasWings = false, limbCount = 4, height = 2 } = options;

  const bones: BoneConfig[] = [];

  if (characterType === 'humanoid') {
    bones.push(...generateHumanoidSkeleton(height, hasWings));
  } else if (characterType === 'creature') {
    bones.push(...generateCreatureSkeleton(height, hasTail, hasWings, limbCount));
  } else if (characterType === 'object') {
    bones.push(...generateObjectSkeleton(height));
  }

  return {
    bones,
    characterType,
    autoRig: true,
    symmetrical: characterType === 'humanoid' || characterType === 'creature',
  };
}

function generateHumanoidSkeleton(height: number, hasWings: boolean): BoneConfig[] {
  const bones: BoneConfig[] = [];
  const scale = height / 2; // Normalize to 2 units

  // Root
  bones.push({
    name: 'root',
    type: 'root',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    length: 0.1 * scale,
    weight: 1,
  });

  // Spine chain
  bones.push({
    name: 'spine',
    type: 'spine',
    position: [0, 0.3 * scale, 0],
    parent: 'root',
    length: 0.3 * scale,
    weight: 1,
  });

  bones.push({
    name: 'chest',
    type: 'chest',
    position: [0, 0.6 * scale, 0],
    parent: 'spine',
    length: 0.3 * scale,
    weight: 1,
  });

  bones.push({
    name: 'neck',
    type: 'neck',
    position: [0, 0.9 * scale, 0],
    parent: 'chest',
    length: 0.15 * scale,
    weight: 1,
  });

  bones.push({
    name: 'head',
    type: 'head',
    position: [0, 1.05 * scale, 0],
    parent: 'neck',
    length: 0.25 * scale,
    weight: 1,
  });

  // Left arm chain
  bones.push({
    name: 'shoulder_l',
    type: 'shoulder_l',
    position: [-0.2 * scale, 0.85 * scale, 0],
    parent: 'chest',
    length: 0.1 * scale,
    weight: 1,
  });

  bones.push({
    name: 'arm_upper_l',
    type: 'arm_upper_l',
    position: [-0.4 * scale, 0.85 * scale, 0],
    parent: 'shoulder_l',
    length: 0.3 * scale,
    weight: 1,
  });

  bones.push({
    name: 'arm_lower_l',
    type: 'arm_lower_l',
    position: [-0.7 * scale, 0.85 * scale, 0],
    parent: 'arm_upper_l',
    length: 0.25 * scale,
    weight: 1,
  });

  bones.push({
    name: 'hand_l',
    type: 'hand_l',
    position: [-0.95 * scale, 0.85 * scale, 0],
    parent: 'arm_lower_l',
    length: 0.15 * scale,
    weight: 1,
  });

  // Right arm chain (mirrored)
  bones.push({
    name: 'shoulder_r',
    type: 'shoulder_r',
    position: [0.2 * scale, 0.85 * scale, 0],
    parent: 'chest',
    length: 0.1 * scale,
    weight: 1,
  });

  bones.push({
    name: 'arm_upper_r',
    type: 'arm_upper_r',
    position: [0.4 * scale, 0.85 * scale, 0],
    parent: 'shoulder_r',
    length: 0.3 * scale,
    weight: 1,
  });

  bones.push({
    name: 'arm_lower_r',
    type: 'arm_lower_r',
    position: [0.7 * scale, 0.85 * scale, 0],
    parent: 'arm_upper_r',
    length: 0.25 * scale,
    weight: 1,
  });

  bones.push({
    name: 'hand_r',
    type: 'hand_r',
    position: [0.95 * scale, 0.85 * scale, 0],
    parent: 'arm_lower_r',
    length: 0.15 * scale,
    weight: 1,
  });

  // Left leg chain
  bones.push({
    name: 'hip_l',
    type: 'hip_l',
    position: [-0.15 * scale, 0, 0],
    parent: 'root',
    length: 0.1 * scale,
    weight: 1,
  });

  bones.push({
    name: 'leg_upper_l',
    type: 'leg_upper_l',
    position: [-0.15 * scale, -0.4 * scale, 0],
    parent: 'hip_l',
    length: 0.4 * scale,
    weight: 1,
  });

  bones.push({
    name: 'leg_lower_l',
    type: 'leg_lower_l',
    position: [-0.15 * scale, -0.8 * scale, 0],
    parent: 'leg_upper_l',
    length: 0.4 * scale,
    weight: 1,
  });

  bones.push({
    name: 'foot_l',
    type: 'foot_l',
    position: [-0.15 * scale, -1.1 * scale, 0],
    parent: 'leg_lower_l',
    length: 0.2 * scale,
    weight: 1,
  });

  // Right leg chain (mirrored)
  bones.push({
    name: 'hip_r',
    type: 'hip_r',
    position: [0.15 * scale, 0, 0],
    parent: 'root',
    length: 0.1 * scale,
    weight: 1,
  });

  bones.push({
    name: 'leg_upper_r',
    type: 'leg_upper_r',
    position: [0.15 * scale, -0.4 * scale, 0],
    parent: 'hip_r',
    length: 0.4 * scale,
    weight: 1,
  });

  bones.push({
    name: 'leg_lower_r',
    type: 'leg_lower_r',
    position: [0.15 * scale, -0.8 * scale, 0],
    parent: 'leg_upper_r',
    length: 0.4 * scale,
    weight: 1,
  });

  bones.push({
    name: 'foot_r',
    type: 'foot_r',
    position: [0.15 * scale, -1.1 * scale, 0],
    parent: 'leg_lower_r',
    length: 0.2 * scale,
    weight: 1,
  });

  // Wings if requested
  if (hasWings) {
    bones.push({
      name: 'wing_l',
      type: 'wing_l',
      position: [-0.3 * scale, 0.7 * scale, -0.2 * scale],
      parent: 'chest',
      length: 0.8 * scale,
      weight: 0.8,
    });

    bones.push({
      name: 'wing_r',
      type: 'wing_r',
      position: [0.3 * scale, 0.7 * scale, -0.2 * scale],
      parent: 'chest',
      length: 0.8 * scale,
      weight: 0.8,
    });
  }

  return bones;
}

function generateCreatureSkeleton(
  height: number,
  hasTail: boolean,
  hasWings: boolean,
  limbCount: number
): BoneConfig[] {
  const bones: BoneConfig[] = [];
  const scale = height / 2;

  // Root
  bones.push({
    name: 'root',
    type: 'root',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    length: 0.1 * scale,
    weight: 1,
  });

  // Spine chain (horizontal for quadrupeds)
  bones.push({
    name: 'spine',
    type: 'spine',
    position: [0, 0.3 * scale, 0],
    parent: 'root',
    length: 0.4 * scale,
    weight: 1,
  });

  bones.push({
    name: 'chest',
    type: 'chest',
    position: [0, 0.3 * scale, 0.4 * scale],
    parent: 'spine',
    length: 0.3 * scale,
    weight: 1,
  });

  bones.push({
    name: 'neck',
    type: 'neck',
    position: [0, 0.4 * scale, 0.7 * scale],
    parent: 'chest',
    length: 0.2 * scale,
    weight: 1,
  });

  bones.push({
    name: 'head',
    type: 'head',
    position: [0, 0.5 * scale, 0.9 * scale],
    parent: 'neck',
    length: 0.3 * scale,
    weight: 1,
  });

  // Jaw
  bones.push({
    name: 'jaw',
    type: 'jaw',
    position: [0, 0.4 * scale, 1.0 * scale],
    parent: 'head',
    length: 0.15 * scale,
    weight: 0.5,
  });

  // Front legs
  bones.push({
    name: 'leg_front_upper_l',
    type: 'leg_upper_l',
    position: [-0.2 * scale, 0.3 * scale, 0.5 * scale],
    parent: 'chest',
    length: 0.3 * scale,
    weight: 1,
  });

  bones.push({
    name: 'leg_front_lower_l',
    type: 'leg_lower_l',
    position: [-0.2 * scale, 0, 0.5 * scale],
    parent: 'leg_front_upper_l',
    length: 0.3 * scale,
    weight: 1,
  });

  bones.push({
    name: 'foot_front_l',
    type: 'foot_l',
    position: [-0.2 * scale, -0.2 * scale, 0.5 * scale],
    parent: 'leg_front_lower_l',
    length: 0.15 * scale,
    weight: 1,
  });

  bones.push({
    name: 'leg_front_upper_r',
    type: 'leg_upper_r',
    position: [0.2 * scale, 0.3 * scale, 0.5 * scale],
    parent: 'chest',
    length: 0.3 * scale,
    weight: 1,
  });

  bones.push({
    name: 'leg_front_lower_r',
    type: 'leg_lower_r',
    position: [0.2 * scale, 0, 0.5 * scale],
    parent: 'leg_front_upper_r',
    length: 0.3 * scale,
    weight: 1,
  });

  bones.push({
    name: 'foot_front_r',
    type: 'foot_r',
    position: [0.2 * scale, -0.2 * scale, 0.5 * scale],
    parent: 'leg_front_lower_r',
    length: 0.15 * scale,
    weight: 1,
  });

  // Back legs
  bones.push({
    name: 'leg_back_upper_l',
    type: 'leg_upper_l',
    position: [-0.2 * scale, 0.3 * scale, -0.2 * scale],
    parent: 'root',
    length: 0.35 * scale,
    weight: 1,
  });

  bones.push({
    name: 'leg_back_lower_l',
    type: 'leg_lower_l',
    position: [-0.2 * scale, 0, -0.2 * scale],
    parent: 'leg_back_upper_l',
    length: 0.3 * scale,
    weight: 1,
  });

  bones.push({
    name: 'foot_back_l',
    type: 'foot_l',
    position: [-0.2 * scale, -0.2 * scale, -0.2 * scale],
    parent: 'leg_back_lower_l',
    length: 0.15 * scale,
    weight: 1,
  });

  bones.push({
    name: 'leg_back_upper_r',
    type: 'leg_upper_r',
    position: [0.2 * scale, 0.3 * scale, -0.2 * scale],
    parent: 'root',
    length: 0.35 * scale,
    weight: 1,
  });

  bones.push({
    name: 'leg_back_lower_r',
    type: 'leg_lower_r',
    position: [0.2 * scale, 0, -0.2 * scale],
    parent: 'leg_back_upper_r',
    length: 0.3 * scale,
    weight: 1,
  });

  bones.push({
    name: 'foot_back_r',
    type: 'foot_r',
    position: [0.2 * scale, -0.2 * scale, -0.2 * scale],
    parent: 'leg_back_lower_r',
    length: 0.15 * scale,
    weight: 1,
  });

  // Tail if requested
  if (hasTail) {
    bones.push({
      name: 'tail_base',
      type: 'tail_base',
      position: [0, 0.2 * scale, -0.3 * scale],
      parent: 'root',
      length: 0.3 * scale,
      weight: 0.7,
    });

    bones.push({
      name: 'tail_mid',
      type: 'tail_mid',
      position: [0, 0.15 * scale, -0.6 * scale],
      parent: 'tail_base',
      length: 0.3 * scale,
      weight: 0.5,
    });

    bones.push({
      name: 'tail_tip',
      type: 'tail_tip',
      position: [0, 0.1 * scale, -0.9 * scale],
      parent: 'tail_mid',
      length: 0.25 * scale,
      weight: 0.3,
    });
  }

  // Wings if requested
  if (hasWings) {
    bones.push({
      name: 'wing_l',
      type: 'wing_l',
      position: [-0.3 * scale, 0.5 * scale, 0.2 * scale],
      parent: 'chest',
      length: 0.8 * scale,
      weight: 0.8,
    });

    bones.push({
      name: 'wing_r',
      type: 'wing_r',
      position: [0.3 * scale, 0.5 * scale, 0.2 * scale],
      parent: 'chest',
      length: 0.8 * scale,
      weight: 0.8,
    });
  }

  return bones;
}

function generateObjectSkeleton(height: number): BoneConfig[] {
  const bones: BoneConfig[] = [];
  const scale = height / 2;

  // Simple root bone for objects
  bones.push({
    name: 'root',
    type: 'root',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    length: scale,
    weight: 1,
  });

  return bones;
}
