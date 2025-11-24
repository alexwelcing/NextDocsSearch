// Animation Generator - Creates animation clips for characters

import {
  CharacterAnimationClip,
  CharacterAnimationPreset,
  AnimationKeyframe,
  SkeletonConfig,
  CharacterType,
} from './characterTypes';

interface AnimationGeneratorOptions {
  preset: CharacterAnimationPreset;
  skeleton: SkeletonConfig;
  duration?: number;
  intensity?: number;
}

export function generateAnimation(options: AnimationGeneratorOptions): CharacterAnimationClip {
  const { preset, skeleton, duration, intensity = 1.0 } = options;

  let keyframes: AnimationKeyframe[] = [];
  let clipDuration = duration || 2.0;

  switch (preset) {
    case 'idle':
      keyframes = generateIdleAnimation(skeleton, intensity);
      clipDuration = duration || 3.0;
      break;
    case 'walk':
      keyframes = generateWalkAnimation(skeleton, intensity);
      clipDuration = duration || 1.2;
      break;
    case 'run':
      keyframes = generateRunAnimation(skeleton, intensity);
      clipDuration = duration || 0.8;
      break;
    case 'jump':
      keyframes = generateJumpAnimation(skeleton, intensity);
      clipDuration = duration || 1.0;
      break;
    case 'wave':
      keyframes = generateWaveAnimation(skeleton, intensity);
      clipDuration = duration || 2.0;
      break;
    case 'dance':
      keyframes = generateDanceAnimation(skeleton, intensity);
      clipDuration = duration || 4.0;
      break;
    case 'attack':
      keyframes = generateAttackAnimation(skeleton, intensity);
      clipDuration = duration || 0.6;
      break;
    default:
      keyframes = generateIdleAnimation(skeleton, intensity);
  }

  return {
    name: preset,
    preset,
    duration: clipDuration,
    loop: preset !== 'jump' && preset !== 'wave' && preset !== 'attack',
    keyframes,
    blendMode: 'override',
    weight: 1.0,
  };
}

function generateIdleAnimation(skeleton: SkeletonConfig, intensity: number): AnimationKeyframe[] {
  const keyframes: AnimationKeyframe[] = [];
  const breatheAmount = 0.03 * intensity;

  // Breathing motion for spine/chest
  if (skeleton.bones.find(b => b.name === 'spine')) {
    keyframes.push(
      {
        time: 0,
        boneName: 'spine',
        scale: [1, 1 - breatheAmount, 1],
      },
      {
        time: 1.5,
        boneName: 'spine',
        scale: [1, 1 + breatheAmount, 1],
      },
      {
        time: 3.0,
        boneName: 'spine',
        scale: [1, 1 - breatheAmount, 1],
      }
    );
  }

  // Slight head bob
  if (skeleton.bones.find(b => b.name === 'head')) {
    keyframes.push(
      {
        time: 0,
        boneName: 'head',
        rotation: [0.05 * intensity, 0, 0],
      },
      {
        time: 2.0,
        boneName: 'head',
        rotation: [-0.05 * intensity, 0, 0],
      },
      {
        time: 3.0,
        boneName: 'head',
        rotation: [0.05 * intensity, 0, 0],
      }
    );
  }

  // Tail sway if present
  if (skeleton.bones.find(b => b.name === 'tail_base')) {
    keyframes.push(
      {
        time: 0,
        boneName: 'tail_base',
        rotation: [0, 0, 0.2 * intensity],
      },
      {
        time: 1.5,
        boneName: 'tail_base',
        rotation: [0, 0, -0.2 * intensity],
      },
      {
        time: 3.0,
        boneName: 'tail_base',
        rotation: [0, 0, 0.2 * intensity],
      }
    );

    keyframes.push(
      {
        time: 0,
        boneName: 'tail_mid',
        rotation: [0, 0, 0.3 * intensity],
      },
      {
        time: 1.5,
        boneName: 'tail_mid',
        rotation: [0, 0, -0.3 * intensity],
      },
      {
        time: 3.0,
        boneName: 'tail_mid',
        rotation: [0, 0, 0.3 * intensity],
      }
    );
  }

  return keyframes;
}

function generateWalkAnimation(skeleton: SkeletonConfig, intensity: number): AnimationKeyframe[] {
  const keyframes: AnimationKeyframe[] = [];
  const stepHeight = 0.3 * intensity;
  const legSwing = 0.6 * intensity;

  if (skeleton.characterType === 'humanoid') {
    // Left leg forward, right leg back
    keyframes.push(
      // Frame 0: Left leg forward
      {
        time: 0,
        boneName: 'leg_upper_l',
        rotation: [legSwing, 0, 0],
      },
      {
        time: 0,
        boneName: 'leg_upper_r',
        rotation: [-legSwing, 0, 0],
      },
      // Frame 0.6: Right leg forward
      {
        time: 0.6,
        boneName: 'leg_upper_l',
        rotation: [-legSwing, 0, 0],
      },
      {
        time: 0.6,
        boneName: 'leg_upper_r',
        rotation: [legSwing, 0, 0],
      },
      // Frame 1.2: Back to start
      {
        time: 1.2,
        boneName: 'leg_upper_l',
        rotation: [legSwing, 0, 0],
      },
      {
        time: 1.2,
        boneName: 'leg_upper_r',
        rotation: [-legSwing, 0, 0],
      }
    );

    // Arm swing (opposite to legs)
    keyframes.push(
      {
        time: 0,
        boneName: 'arm_upper_l',
        rotation: [-legSwing * 0.5, 0, 0],
      },
      {
        time: 0,
        boneName: 'arm_upper_r',
        rotation: [legSwing * 0.5, 0, 0],
      },
      {
        time: 0.6,
        boneName: 'arm_upper_l',
        rotation: [legSwing * 0.5, 0, 0],
      },
      {
        time: 0.6,
        boneName: 'arm_upper_r',
        rotation: [-legSwing * 0.5, 0, 0],
      },
      {
        time: 1.2,
        boneName: 'arm_upper_l',
        rotation: [-legSwing * 0.5, 0, 0],
      },
      {
        time: 1.2,
        boneName: 'arm_upper_r',
        rotation: [legSwing * 0.5, 0, 0],
      }
    );

    // Body bob
    keyframes.push(
      {
        time: 0,
        boneName: 'root',
        position: [0, 0.05 * intensity, 0],
      },
      {
        time: 0.3,
        boneName: 'root',
        position: [0, -0.05 * intensity, 0],
      },
      {
        time: 0.6,
        boneName: 'root',
        position: [0, 0.05 * intensity, 0],
      },
      {
        time: 0.9,
        boneName: 'root',
        position: [0, -0.05 * intensity, 0],
      },
      {
        time: 1.2,
        boneName: 'root',
        position: [0, 0.05 * intensity, 0],
      }
    );
  } else if (skeleton.characterType === 'creature') {
    // Quadruped walk
    // Front legs
    keyframes.push(
      {
        time: 0,
        boneName: 'leg_front_upper_l',
        rotation: [legSwing, 0, 0],
      },
      {
        time: 0,
        boneName: 'leg_front_upper_r',
        rotation: [-legSwing, 0, 0],
      },
      {
        time: 0.6,
        boneName: 'leg_front_upper_l',
        rotation: [-legSwing, 0, 0],
      },
      {
        time: 0.6,
        boneName: 'leg_front_upper_r',
        rotation: [legSwing, 0, 0],
      },
      {
        time: 1.2,
        boneName: 'leg_front_upper_l',
        rotation: [legSwing, 0, 0],
      },
      {
        time: 1.2,
        boneName: 'leg_front_upper_r',
        rotation: [-legSwing, 0, 0],
      }
    );

    // Back legs (offset)
    keyframes.push(
      {
        time: 0,
        boneName: 'leg_back_upper_l',
        rotation: [-legSwing, 0, 0],
      },
      {
        time: 0,
        boneName: 'leg_back_upper_r',
        rotation: [legSwing, 0, 0],
      },
      {
        time: 0.6,
        boneName: 'leg_back_upper_l',
        rotation: [legSwing, 0, 0],
      },
      {
        time: 0.6,
        boneName: 'leg_back_upper_r',
        rotation: [-legSwing, 0, 0],
      },
      {
        time: 1.2,
        boneName: 'leg_back_upper_l',
        rotation: [-legSwing, 0, 0],
      },
      {
        time: 1.2,
        boneName: 'leg_back_upper_r',
        rotation: [legSwing, 0, 0],
      }
    );

    // Tail sway during walk
    if (skeleton.bones.find(b => b.name === 'tail_base')) {
      keyframes.push(
        {
          time: 0,
          boneName: 'tail_base',
          rotation: [0, 0.3 * intensity, 0],
        },
        {
          time: 0.6,
          boneName: 'tail_base',
          rotation: [0, -0.3 * intensity, 0],
        },
        {
          time: 1.2,
          boneName: 'tail_base',
          rotation: [0, 0.3 * intensity, 0],
        }
      );
    }
  }

  return keyframes;
}

function generateRunAnimation(skeleton: SkeletonConfig, intensity: number): AnimationKeyframe[] {
  // Similar to walk but faster and more exaggerated
  const walkKeyframes = generateWalkAnimation(skeleton, intensity * 1.5);

  // Adjust timing to be faster
  return walkKeyframes.map(kf => ({
    ...kf,
    time: kf.time * 0.6,
  }));
}

function generateJumpAnimation(skeleton: SkeletonConfig, intensity: number): AnimationKeyframe[] {
  const keyframes: AnimationKeyframe[] = [];
  const jumpHeight = 2.0 * intensity;

  // Crouch
  keyframes.push({
    time: 0,
    boneName: 'root',
    position: [0, -0.3 * intensity, 0],
  });

  // Jump up
  keyframes.push({
    time: 0.3,
    boneName: 'root',
    position: [0, jumpHeight, 0],
  });

  // Peak
  keyframes.push({
    time: 0.5,
    boneName: 'root',
    position: [0, jumpHeight, 0],
  });

  // Land
  keyframes.push({
    time: 0.8,
    boneName: 'root',
    position: [0, 0, 0],
  });

  // Legs during jump
  if (skeleton.bones.find(b => b.name === 'leg_upper_l')) {
    keyframes.push(
      {
        time: 0,
        boneName: 'leg_upper_l',
        rotation: [0.8, 0, 0],
      },
      {
        time: 0,
        boneName: 'leg_upper_r',
        rotation: [0.8, 0, 0],
      },
      {
        time: 0.3,
        boneName: 'leg_upper_l',
        rotation: [-0.3, 0, 0],
      },
      {
        time: 0.3,
        boneName: 'leg_upper_r',
        rotation: [-0.3, 0, 0],
      },
      {
        time: 0.8,
        boneName: 'leg_upper_l',
        rotation: [0.5, 0, 0],
      },
      {
        time: 0.8,
        boneName: 'leg_upper_r',
        rotation: [0.5, 0, 0],
      }
    );
  }

  return keyframes;
}

function generateWaveAnimation(skeleton: SkeletonConfig, intensity: number): AnimationKeyframe[] {
  const keyframes: AnimationKeyframe[] = [];

  if (skeleton.bones.find(b => b.name === 'arm_upper_r')) {
    // Raise arm
    keyframes.push(
      {
        time: 0,
        boneName: 'arm_upper_r',
        rotation: [0, 0, 0],
      },
      {
        time: 0.3,
        boneName: 'arm_upper_r',
        rotation: [-1.5, 0, 0.5],
      },
      {
        time: 0.5,
        boneName: 'hand_r',
        rotation: [0, 0, 0.3],
      },
      {
        time: 0.8,
        boneName: 'hand_r',
        rotation: [0, 0, -0.3],
      },
      {
        time: 1.1,
        boneName: 'hand_r',
        rotation: [0, 0, 0.3],
      },
      {
        time: 1.4,
        boneName: 'hand_r',
        rotation: [0, 0, 0],
      },
      {
        time: 1.8,
        boneName: 'arm_upper_r',
        rotation: [0, 0, 0],
      }
    );
  }

  return keyframes;
}

function generateDanceAnimation(skeleton: SkeletonConfig, intensity: number): AnimationKeyframe[] {
  const keyframes: AnimationKeyframe[] = [];

  // Body sway
  keyframes.push(
    {
      time: 0,
      boneName: 'spine',
      rotation: [0, 0.3, 0],
    },
    {
      time: 1,
      boneName: 'spine',
      rotation: [0, -0.3, 0],
    },
    {
      time: 2,
      boneName: 'spine',
      rotation: [0, 0.3, 0],
    },
    {
      time: 3,
      boneName: 'spine',
      rotation: [0, -0.3, 0],
    },
    {
      time: 4,
      boneName: 'spine',
      rotation: [0, 0.3, 0],
    }
  );

  // Arms
  if (skeleton.bones.find(b => b.name === 'arm_upper_l')) {
    keyframes.push(
      {
        time: 0,
        boneName: 'arm_upper_l',
        rotation: [-0.5, 0, -0.5],
      },
      {
        time: 1,
        boneName: 'arm_upper_l',
        rotation: [-1.0, 0, -0.8],
      },
      {
        time: 2,
        boneName: 'arm_upper_l',
        rotation: [-0.5, 0, -0.5],
      }
    );
  }

  return keyframes;
}

function generateAttackAnimation(skeleton: SkeletonConfig, intensity: number): AnimationKeyframe[] {
  const keyframes: AnimationKeyframe[] = [];

  // Wind up
  keyframes.push({
    time: 0,
    boneName: 'arm_upper_r',
    rotation: [-1.2, 0, 0.5],
  });

  // Strike
  keyframes.push({
    time: 0.2,
    boneName: 'arm_upper_r',
    rotation: [0.8, 0, -0.3],
  });

  // Recovery
  keyframes.push({
    time: 0.5,
    boneName: 'arm_upper_r',
    rotation: [0, 0, 0],
  });

  return keyframes;
}

export function generateMultipleAnimations(
  skeleton: SkeletonConfig,
  presets: CharacterAnimationPreset[]
): CharacterAnimationClip[] {
  return presets.map(preset => generateAnimation({ preset, skeleton }));
}
