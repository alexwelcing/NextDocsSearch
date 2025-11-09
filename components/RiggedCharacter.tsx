// Rigged Character Component - Renders animated characters with skeletons

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  CharacterConfig,
  AnimationKeyframe,
  CharacterAnimationClip,
  BoneConfig,
} from '@/lib/generators/characterTypes';

interface RiggedCharacterProps {
  config: CharacterConfig;
  currentAnimation?: string;
  animationSpeed?: number;
  showSkeleton?: boolean;
}

export default function RiggedCharacter({
  config,
  currentAnimation = 'idle',
  animationSpeed = 1.0,
  showSkeleton = false,
}: RiggedCharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const skinnedMeshRef = useRef<THREE.SkinnedMesh | null>(null);
  const bonesRef = useRef<Map<string, THREE.Bone>>(new Map());

  // Create skeleton and mesh
  const { skeleton, mesh } = useMemo(() => {
    const bones = createBones(config.skeleton.bones);
    const rootBone = bones.get('root');

    if (!rootBone) {
      console.error('No root bone found');
      return { skeleton: null, mesh: null };
    }

    // Create skeleton
    const boneArray = Array.from(bones.values());
    const skeleton = new THREE.Skeleton(boneArray);

    // Create mesh geometry (simple for now - in production this would be from Gaussian splat extraction)
    const geometry = createCharacterGeometry(config);

    // Add skinning data
    addSkinning(geometry, bones, config.skeleton.bones);

    // Create material
    const material = new THREE.MeshStandardMaterial({
      color: config.materials.baseColor,
      roughness: config.materials.roughness,
      metalness: config.materials.metalness,
      skinning: true, // Enable skinning
    });

    // Create skinned mesh
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.add(rootBone);
    mesh.bind(skeleton);

    // Store bones reference
    bonesRef.current = bones;

    return { skeleton, mesh };
  }, [config]);

  // Create animation mixer and clips
  useEffect(() => {
    if (!mesh) return;

    const mixer = new THREE.AnimationMixer(mesh);
    mixerRef.current = mixer;

    // Convert our animation configs to Three.js animation clips
    config.animations.forEach(animConfig => {
      const clip = createAnimationClip(animConfig, bonesRef.current);
      mixer.clipAction(clip);
    });

    return () => {
      mixer.stopAllAction();
    };
  }, [mesh, config.animations]);

  // Play current animation
  useEffect(() => {
    if (!mixerRef.current) return;

    const mixer = mixerRef.current;
    mixer.stopAllAction();

    const animConfig = config.animations.find(a => a.name === currentAnimation);
    if (animConfig) {
      const clip = createAnimationClip(animConfig, bonesRef.current);
      const action = mixer.clipAction(clip);
      action.timeScale = animationSpeed;
      action.play();
    }
  }, [currentAnimation, animationSpeed, config.animations]);

  // Update animation
  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });

  if (!mesh) return null;

  return (
    <group
      ref={groupRef}
      position={config.position}
      rotation={config.rotation}
      scale={config.scale}
    >
      <primitive object={mesh} />
      {showSkeleton && <SkeletonHelper bones={bonesRef.current} />}
    </group>
  );
}

// Helper component to visualize skeleton
function SkeletonHelper({ bones }: { bones: Map<string, THREE.Bone> }) {
  const linesRef = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];

    bones.forEach(bone => {
      const bonePos = new THREE.Vector3();
      bone.getWorldPosition(bonePos);

      if (bone.parent && bone.parent instanceof THREE.Bone) {
        const parentPos = new THREE.Vector3();
        bone.parent.getWorldPosition(parentPos);

        points.push(parentPos, bonePos);
      }
    });

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [bones]);

  return (
    <lineSegments ref={linesRef} geometry={geometry}>
      <lineBasicMaterial color="#00ff00" linewidth={2} />
    </lineSegments>
  );
}

// Create Three.js bones from our bone configs
function createBones(boneConfigs: BoneConfig[]): Map<string, THREE.Bone> {
  const bones = new Map<string, THREE.Bone>();

  // First pass: create all bones
  boneConfigs.forEach(config => {
    const bone = new THREE.Bone();
    bone.name = config.name;
    bone.position.fromArray(config.position);
    if (config.rotation) {
      bone.rotation.fromArray(config.rotation);
    }
    bones.set(config.name, bone);
  });

  // Second pass: setup hierarchy
  boneConfigs.forEach(config => {
    if (config.parent) {
      const parent = bones.get(config.parent);
      const bone = bones.get(config.name);
      if (parent && bone) {
        parent.add(bone);
      }
    }
  });

  return bones;
}

// Create character geometry based on character type
function createCharacterGeometry(config: CharacterConfig): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;

  // For now, create simple placeholder geometry based on character type
  // In production, this would extract mesh from Gaussian splat data
  if (config.characterType === 'humanoid') {
    geometry = createHumanoidGeometry();
  } else if (config.characterType === 'creature') {
    geometry = createCreatureGeometry(config.features?.hasTail || false);
  } else {
    geometry = new THREE.BoxGeometry(1, 2, 0.5);
  }

  return geometry;
}

function createHumanoidGeometry(): THREE.BufferGeometry {
  // Create a simple humanoid shape using merged geometries
  const geometries: THREE.BufferGeometry[] = [];

  // Torso
  const torso = new THREE.BoxGeometry(0.8, 1.2, 0.4);
  torso.translate(0, 0.6, 0);
  geometries.push(torso);

  // Head
  const head = new THREE.SphereGeometry(0.3, 16, 16);
  head.translate(0, 1.4, 0);
  geometries.push(head);

  // Arms
  const armLeft = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
  armLeft.translate(-0.5, 0.6, 0);
  armLeft.rotateZ(Math.PI / 6);
  geometries.push(armLeft);

  const armRight = armLeft.clone();
  armRight.translate(1, 0, 0);
  geometries.push(armRight);

  // Legs
  const legLeft = new THREE.CylinderGeometry(0.15, 0.12, 1.0, 8);
  legLeft.translate(-0.2, -0.5, 0);
  geometries.push(legLeft);

  const legRight = legLeft.clone();
  legRight.translate(0.4, 0, 0);
  geometries.push(legRight);

  // Merge all geometries
  const mergedGeometry = mergeGeometries(geometries);
  return mergedGeometry;
}

function createCreatureGeometry(hasTail: boolean): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Body (elongated)
  const body = new THREE.BoxGeometry(0.6, 0.5, 1.2);
  body.translate(0, 0.3, 0);
  geometries.push(body);

  // Head
  const head = new THREE.SphereGeometry(0.4, 16, 16);
  head.scale(1, 0.8, 1.2);
  head.translate(0, 0.5, 0.8);
  geometries.push(head);

  // Legs (4 legs)
  const legFrontLeft = new THREE.CylinderGeometry(0.08, 0.06, 0.5, 8);
  legFrontLeft.translate(-0.25, 0, 0.4);
  geometries.push(legFrontLeft);

  const legFrontRight = legFrontLeft.clone();
  legFrontRight.translate(0.5, 0, 0);
  geometries.push(legFrontRight);

  const legBackLeft = legFrontLeft.clone();
  legBackLeft.translate(0, 0, -0.6);
  geometries.push(legBackLeft);

  const legBackRight = legFrontLeft.clone();
  legBackRight.translate(0.5, 0, -0.6);
  geometries.push(legBackRight);

  // Tail if requested
  if (hasTail) {
    const tail = new THREE.CylinderGeometry(0.12, 0.04, 0.8, 8);
    tail.rotateX(Math.PI / 3);
    tail.translate(0, 0.2, -0.8);
    geometries.push(tail);
  }

  const mergedGeometry = mergeGeometries(geometries);
  return mergedGeometry;
}

// Simple geometry merger
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  geometries.forEach(geom => {
    geom.computeVertexNormals();

    const pos = geom.attributes.position;
    const norm = geom.attributes.normal;

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      // Simple UV mapping
      uvs.push(0, 0);
    }
  });

  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  return merged;
}

// Add skinning indices and weights
function addSkinning(
  geometry: THREE.BufferGeometry,
  bones: Map<string, THREE.Bone>,
  boneConfigs: BoneConfig[]
) {
  const positionAttribute = geometry.attributes.position;
  const vertexCount = positionAttribute.count;

  const skinIndices: number[] = [];
  const skinWeights: number[] = [];

  const boneArray = Array.from(bones.values());

  for (let i = 0; i < vertexCount; i++) {
    const vertex = new THREE.Vector3(
      positionAttribute.getX(i),
      positionAttribute.getY(i),
      positionAttribute.getZ(i)
    );

    // Find closest bones and calculate weights
    const influences = calculateBoneInfluences(vertex, bones, boneConfigs);

    // Each vertex influenced by up to 4 bones
    for (let j = 0; j < 4; j++) {
      if (j < influences.length) {
        const boneIndex = boneArray.findIndex(b => b.name === influences[j].boneName);
        skinIndices.push(boneIndex >= 0 ? boneIndex : 0);
        skinWeights.push(influences[j].weight);
      } else {
        skinIndices.push(0);
        skinWeights.push(0);
      }
    }
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
}

function calculateBoneInfluences(
  vertex: THREE.Vector3,
  bones: Map<string, THREE.Bone>,
  boneConfigs: BoneConfig[]
): { boneName: string; weight: number }[] {
  const influences: { boneName: string; weight: number; distance: number }[] = [];

  boneConfigs.forEach(config => {
    const bone = bones.get(config.name);
    if (!bone) return;

    const bonePos = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
    const distance = vertex.distanceTo(new THREE.Vector3(...config.position));

    // Weight based on distance and bone weight
    const weight = config.weight / (1 + distance);
    influences.push({ boneName: config.name, weight, distance });
  });

  // Sort by weight and take top 4
  influences.sort((a, b) => b.weight - a.weight);
  const top4 = influences.slice(0, 4);

  // Normalize weights to sum to 1
  const totalWeight = top4.reduce((sum, inf) => sum + inf.weight, 0);
  return top4.map(inf => ({
    boneName: inf.boneName,
    weight: inf.weight / totalWeight,
  }));
}

// Create Three.js AnimationClip from our animation config
function createAnimationClip(
  animConfig: CharacterAnimationClip,
  bones: Map<string, THREE.Bone>
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];

  // Group keyframes by bone
  const keyframesByBone = new Map<string, AnimationKeyframe[]>();

  animConfig.keyframes.forEach(kf => {
    if (!keyframesByBone.has(kf.boneName)) {
      keyframesByBone.set(kf.boneName, []);
    }
    keyframesByBone.get(kf.boneName)!.push(kf);
  });

  // Create tracks for each bone
  keyframesByBone.forEach((keyframes, boneName) => {
    const bone = bones.get(boneName);
    if (!bone) return;

    // Sort by time
    keyframes.sort((a, b) => a.time - b.time);

    // Position track
    const positionKeyframes = keyframes.filter(kf => kf.position);
    if (positionKeyframes.length > 0) {
      const times = positionKeyframes.map(kf => kf.time);
      const values = positionKeyframes.flatMap(kf => kf.position!);
      const track = new THREE.VectorKeyframeTrack(
        `${boneName}.position`,
        times,
        values
      );
      tracks.push(track);
    }

    // Rotation track (quaternion)
    const rotationKeyframes = keyframes.filter(kf => kf.rotation);
    if (rotationKeyframes.length > 0) {
      const times = rotationKeyframes.map(kf => kf.time);
      const values = rotationKeyframes.flatMap(kf => {
        const euler = new THREE.Euler(...kf.rotation!);
        const quat = new THREE.Quaternion().setFromEuler(euler);
        return [quat.x, quat.y, quat.z, quat.w];
      });
      const track = new THREE.QuaternionKeyframeTrack(
        `${boneName}.quaternion`,
        times,
        values
      );
      tracks.push(track);
    }

    // Scale track
    const scaleKeyframes = keyframes.filter(kf => kf.scale);
    if (scaleKeyframes.length > 0) {
      const times = scaleKeyframes.map(kf => kf.time);
      const values = scaleKeyframes.flatMap(kf => kf.scale!);
      const track = new THREE.VectorKeyframeTrack(`${boneName}.scale`, times, values);
      tracks.push(track);
    }
  });

  return new THREE.AnimationClip(animConfig.name, animConfig.duration, tracks);
}
