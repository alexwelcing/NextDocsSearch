/**
 * ProGen Character Mesh Renderer
 * 
 * Renders a ProGen character in React Three Fiber with
 * proper skeletal animation and material application.
 */

import React, { useRef, useMemo, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ProGenCharacter, AnimationState, BodyPart } from '@/lib/progen/types';

export interface ProGenCharacterRef {
  setAnimation: (state: AnimationState) => void;
  getBone: (name: string) => THREE.Bone | undefined;
  getSkeleton: () => THREE.Skeleton | null;
  playEmote: (emoteName: string) => void;
}

interface ProGenCharacterMeshProps {
  character: ProGenCharacter;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

// Color palette for debugging/differentiation
const DEBUG_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

export const ProGenCharacterMesh = forwardRef<ProGenCharacterRef, ProGenCharacterMeshProps>(
  ({ character, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, castShadow = true, receiveShadow = true }, ref) => {
    const groupRef = useRef<THREE.Group>(null);
    const skeletonRef = useRef<THREE.Skeleton | null>(null);
    const bonesRef = useRef<Map<string, THREE.Bone>>(new Map());
    const animationState = useRef<AnimationState>('idle');
    const animationTime = useRef(0);
    
    // Build skeleton from character data
    const { skeleton, skinnedMeshes } = useMemo(() => {
      const bones = new Map<string, THREE.Bone>();
      const boneArray: THREE.Bone[] = [];
      
      // Create bones
      for (const boneDef of character.skeleton.hierarchy) {
        const bone = new THREE.Bone();
        bone.name = boneDef.name;
        bone.position.set(...boneDef.position);
        bone.rotation.set(...boneDef.rotation);
        bone.userData.length = boneDef.length;
        
        bones.set(boneDef.name, bone);
        boneArray.push(bone);
      }
      
      // Build hierarchy
      for (const boneDef of character.skeleton.hierarchy) {
        const bone = bones.get(boneDef.name)!;
        if (boneDef.parent) {
          const parent = bones.get(boneDef.parent);
          if (parent) {
            parent.add(bone);
          }
        }
      }
      
      // Create skeleton
      const skel = new THREE.Skeleton(boneArray);
      skeletonRef.current = skel;
      bonesRef.current = bones;
      
      // Generate geometry for each body part
      const meshes: { part: BodyPart; mesh: THREE.SkinnedMesh; boneNames: string[] }[] = [];
      
      const { body, colors, materials } = character;
      const p = body.proportions;
      
      // Skin material
      const skinMat = new THREE.MeshStandardMaterial({
        color: colors.skinTone,
        roughness: materials.skin?.roughness ?? 0.6,
        metalness: materials.skin?.metalness ?? 0,
      });
      
      // Outfit materials
      const primaryMat = new THREE.MeshStandardMaterial({
        color: colors.primary,
        roughness: materials.fabric?.roughness ?? 0.5,
        metalness: materials.fabric?.metalness ?? 0.1,
      });
      
      const secondaryMat = new THREE.MeshStandardMaterial({
        color: colors.secondary,
        roughness: materials.fabric?.roughness ?? 0.5,
        metalness: materials.fabric?.metalness ?? 0.1,
      });
      
      // Torso (chest + spine area)
      const torsoGeo = new THREE.BoxGeometry(p.shoulderWidth, p.height * 0.35, p.chestDepth, 4, 4, 2);
      const torsoMesh = new THREE.SkinnedMesh(torsoGeo, [primaryMat, skinMat]);
      torsoMesh.name = 'torso';
      
      // Torso skin indices
      const torsoPos = torsoGeo.attributes.position;
      const torsoSkinIndices = new Float32Array(torsoPos.count * 4);
      const torsoSkinWeights = new Float32Array(torsoPos.count * 4);
      
      const spineIndex = boneArray.findIndex(b => b.name === 'spine');
      const chestIndex = boneArray.findIndex(b => b.name === 'chest');
      
      for (let i = 0; i < torsoPos.count; i++) {
        const y = torsoPos.getY(i);
        const weight = (y + p.height * 0.175) / (p.height * 0.35); // Normalize to 0-1
        
        torsoSkinIndices[i * 4] = spineIndex;
        torsoSkinIndices[i * 4 + 1] = chestIndex;
        torsoSkinWeights[i * 4] = 1 - weight;
        torsoSkinWeights[i * 4 + 1] = weight;
      }
      
      torsoGeo.setAttribute('skinIndex', new THREE.BufferAttribute(torsoSkinIndices, 4));
      torsoGeo.setAttribute('skinWeight', new THREE.BufferAttribute(torsoSkinWeights, 4));
      
      torsoMesh.bind(skel);
      meshes.push({ part: 'torso' as BodyPart, mesh: torsoMesh, boneNames: ['spine', 'chest'] });
      
      // Pelvis
      const pelvisGeo = new THREE.BoxGeometry(p.hipWidth, p.height * 0.12, p.hipWidth * 0.6, 3, 2, 2);
      const pelvisMesh = new THREE.SkinnedMesh(pelvisGeo, primaryMat);
      pelvisMesh.name = 'pelvis';
      
      const hipsIndex = boneArray.findIndex(b => b.name === 'hips');
      const pelvisSkinIndices = new Float32Array(pelvisGeo.attributes.position.count * 4);
      const pelvisSkinWeights = new Float32Array(pelvisGeo.attributes.position.count * 4);
      
      for (let i = 0; i < pelvisGeo.attributes.position.count; i++) {
        pelvisSkinIndices[i * 4] = hipsIndex;
        pelvisSkinWeights[i * 4] = 1;
      }
      
      pelvisGeo.setAttribute('skinIndex', new THREE.BufferAttribute(pelvisSkinIndices, 4));
      pelvisGeo.setAttribute('skinWeight', new THREE.BufferAttribute(pelvisSkinWeights, 4));
      
      pelvisMesh.bind(skel);
      meshes.push({ part: 'pelvis' as BodyPart, mesh: pelvisMesh, boneNames: ['hips'] });
      
      // Head
      const headSize = p.headScale * 0.12;
      const headGeo = new THREE.BoxGeometry(headSize, headSize * 1.2, headSize * 1.1, 3, 4, 3);
      const headMesh = new THREE.SkinnedMesh(headGeo, skinMat);
      headMesh.name = 'head';
      
      const headIndex = boneArray.findIndex(b => b.name === 'head');
      const neckIndex = boneArray.findIndex(b => b.name === 'neck');
      const headSkinIndices = new Float32Array(headGeo.attributes.position.count * 4);
      const headSkinWeights = new Float32Array(headGeo.attributes.position.count * 4);
      
      for (let i = 0; i < headGeo.attributes.position.count; i++) {
        const y = headGeo.attributes.position.getY(i);
        const weight = Math.max(0, Math.min(1, (y + headSize * 0.6) / (headSize * 0.8)));
        
        headSkinIndices[i * 4] = headIndex;
        headSkinIndices[i * 4 + 1] = neckIndex;
        headSkinWeights[i * 4] = 0.8 + weight * 0.2;
        headSkinWeights[i * 4 + 1] = 0.2 - weight * 0.2;
      }
      
      headGeo.setAttribute('skinIndex', new THREE.BufferAttribute(headSkinIndices, 4));
      headGeo.setAttribute('skinWeight', new THREE.BufferAttribute(headSkinWeights, 4));
      
      headMesh.bind(skel);
      meshes.push({ part: 'head' as BodyPart, mesh: headMesh, boneNames: ['head', 'neck'] });
      
      // Arms
      const armThickness = 0.08 + body.muscularity * 0.04;
      
      // Left upper arm
      const upperArmGeo = new THREE.BoxGeometry(armThickness, p.armLength * 0.45, armThickness, 2, 4, 2);
      const upperArmLMat = new THREE.MeshStandardMaterial({ color: colors.secondary, roughness: 0.5 });
      const upperArmL = new THREE.SkinnedMesh(upperArmGeo, upperArmLMat);
      upperArmL.name = 'upperArmL';
      
      const shoulderLIndex = boneArray.findIndex(b => b.name === 'shoulderL');
      const upperArmLIndex = boneArray.findIndex(b => b.name === 'upperArmL');
      
      const uaLSkinIndices = new Float32Array(upperArmGeo.attributes.position.count * 4);
      const uaLSkinWeights = new Float32Array(upperArmGeo.attributes.position.count * 4);
      
      for (let i = 0; i < upperArmGeo.attributes.position.count; i++) {
        uaLSkinIndices[i * 4] = upperArmLIndex;
        uaLSkinWeights[i * 4] = 1;
      }
      
      upperArmGeo.setAttribute('skinIndex', new THREE.BufferAttribute(uaLSkinIndices, 4));
      upperArmGeo.setAttribute('skinWeight', new THREE.BufferAttribute(uaLSkinWeights, 4));
      upperArmL.bind(skel);
      meshes.push({ part: 'upperArmL' as BodyPart, mesh: upperArmL, boneNames: ['upperArmL'] });
      
      // Left lower arm
      const lowerArmGeo = new THREE.BoxGeometry(armThickness * 0.85, p.armLength * 0.4, armThickness * 0.85, 2, 4, 2);
      const lowerArmLMat = new THREE.MeshStandardMaterial({ color: colors.skinTone, roughness: 0.6 });
      const lowerArmL = new THREE.SkinnedMesh(lowerArmGeo, lowerArmLMat);
      lowerArmL.name = 'lowerArmL';
      
      const lowerArmLIndex = boneArray.findIndex(b => b.name === 'lowerArmL');
      const laLSkinIndices = new Float32Array(lowerArmGeo.attributes.position.count * 4);
      const laLSkinWeights = new Float32Array(lowerArmGeo.attributes.position.count * 4);
      
      for (let i = 0; i < lowerArmGeo.attributes.position.count; i++) {
        laLSkinIndices[i * 4] = lowerArmLIndex;
        laLSkinWeights[i * 4] = 1;
      }
      
      lowerArmGeo.setAttribute('skinIndex', new THREE.BufferAttribute(laLSkinIndices, 4));
      lowerArmGeo.setAttribute('skinWeight', new THREE.BufferAttribute(laLSkinWeights, 4));
      lowerArmL.bind(skel);
      meshes.push({ part: 'lowerArmL' as BodyPart, mesh: lowerArmL, boneNames: ['lowerArmL'] });
      
      // Left hand
      const handGeo = new THREE.BoxGeometry(armThickness * 1.2, p.armLength * 0.15, armThickness * 0.5, 2, 3, 2);
      const handLMat = new THREE.MeshStandardMaterial({ color: colors.skinTone, roughness: 0.6 });
      const handL = new THREE.SkinnedMesh(handGeo, handLMat);
      handL.name = 'handL';
      
      const handLIndex = boneArray.findIndex(b => b.name === 'handL');
      const hLSkinIndices = new Float32Array(handGeo.attributes.position.count * 4);
      const hLSkinWeights = new Float32Array(handGeo.attributes.position.count * 4);
      
      for (let i = 0; i < handGeo.attributes.position.count; i++) {
        hLSkinIndices[i * 4] = handLIndex;
        hLSkinWeights[i * 4] = 1;
      }
      
      handGeo.setAttribute('skinIndex', new THREE.BufferAttribute(hLSkinIndices, 4));
      handGeo.setAttribute('skinWeight', new THREE.BufferAttribute(hLSkinWeights, 4));
      handL.bind(skel);
      meshes.push({ part: 'handL' as BodyPart, mesh: handL, boneNames: ['handL'] });
      
      // Right arm (mirror left)
      const upperArmR = upperArmL.clone();
      upperArmR.name = 'upperArmR';
      const uaRIndex = boneArray.findIndex(b => b.name === 'upperArmR');
      const uaRSkinIndices = new Float32Array(upperArmGeo.attributes.position.count * 4);
      const uaRSkinWeights = new Float32Array(upperArmGeo.attributes.position.count * 4);
      for (let i = 0; i < upperArmGeo.attributes.position.count; i++) {
        uaRSkinIndices[i * 4] = uaRIndex;
        uaRSkinWeights[i * 4] = 1;
      }
      upperArmR.geometry = upperArmGeo.clone();
      upperArmR.geometry.setAttribute('skinIndex', new THREE.BufferAttribute(uaRSkinIndices, 4));
      upperArmR.geometry.setAttribute('skinWeight', new THREE.BufferAttribute(uaRSkinWeights, 4));
      upperArmR.bind(skel);
      meshes.push({ part: 'upperArmR' as BodyPart, mesh: upperArmR, boneNames: ['upperArmR'] });
      
      const lowerArmR = lowerArmL.clone();
      lowerArmR.name = 'lowerArmR';
      const laRIndex = boneArray.findIndex(b => b.name === 'lowerArmR');
      const laRSkinIndices = new Float32Array(lowerArmGeo.attributes.position.count * 4);
      const laRSkinWeights = new Float32Array(lowerArmGeo.attributes.position.count * 4);
      for (let i = 0; i < lowerArmGeo.attributes.position.count; i++) {
        laRSkinIndices[i * 4] = laRIndex;
        laRSkinWeights[i * 4] = 1;
      }
      lowerArmR.geometry = lowerArmGeo.clone();
      lowerArmR.geometry.setAttribute('skinIndex', new THREE.BufferAttribute(laRSkinIndices, 4));
      lowerArmR.geometry.setAttribute('skinWeight', new THREE.BufferAttribute(laRSkinWeights, 4));
      lowerArmR.bind(skel);
      meshes.push({ part: 'lowerArmR' as BodyPart, mesh: lowerArmR, boneNames: ['lowerArmR'] });
      
      const handR = handL.clone();
      handR.name = 'handR';
      const handRIndex = boneArray.findIndex(b => b.name === 'handR');
      const hRSkinIndices = new Float32Array(handGeo.attributes.position.count * 4);
      const hRSkinWeights = new Float32Array(handGeo.attributes.position.count * 4);
      for (let i = 0; i < handGeo.attributes.position.count; i++) {
        hRSkinIndices[i * 4] = handRIndex;
        hRSkinWeights[i * 4] = 1;
      }
      handR.geometry = handGeo.clone();
      handR.geometry.setAttribute('skinIndex', new THREE.BufferAttribute(hRSkinIndices, 4));
      handR.geometry.setAttribute('skinWeight', new THREE.BufferAttribute(hRSkinWeights, 4));
      handR.bind(skel);
      meshes.push({ part: 'handR' as BodyPart, mesh: handR, boneNames: ['handR'] });
      
      // Legs
      const legThickness = 0.12 + body.muscularity * 0.05;
      
      // Left thigh
      const thighGeo = new THREE.BoxGeometry(legThickness, p.legLength * 0.5, legThickness * 0.8, 3, 5, 3);
      const thighLMat = new THREE.MeshStandardMaterial({ color: colors.primary, roughness: 0.5 });
      const thighL = new THREE.SkinnedMesh(thighGeo, thighLMat);
      thighL.name = 'thighL';
      
      const thighLIndex = boneArray.findIndex(b => b.name === 'thighL');
      const tLSkinIndices = new Float32Array(thighGeo.attributes.position.count * 4);
      const tLSkinWeights = new Float32Array(thighGeo.attributes.position.count * 4);
      
      for (let i = 0; i < thighGeo.attributes.position.count; i++) {
        tLSkinIndices[i * 4] = thighLIndex;
        tLSkinWeights[i * 4] = 1;
      }
      
      thighGeo.setAttribute('skinIndex', new THREE.BufferAttribute(tLSkinIndices, 4));
      thighGeo.setAttribute('skinWeight', new THREE.BufferAttribute(tLSkinWeights, 4));
      thighL.bind(skel);
      meshes.push({ part: 'thighL' as BodyPart, mesh: thighL, boneNames: ['thighL'] });
      
      // Left shin
      const shinGeo = new THREE.BoxGeometry(legThickness * 0.8, p.legLength * 0.45, legThickness * 0.7, 2, 5, 2);
      const shinLMat = new THREE.MeshStandardMaterial({ color: colors.skinTone, roughness: 0.6 });
      const shinL = new THREE.SkinnedMesh(shinGeo, shinLMat);
      shinL.name = 'shinL';
      
      const shinLIndex = boneArray.findIndex(b => b.name === 'shinL');
      const sLSkinIndices = new Float32Array(shinGeo.attributes.position.count * 4);
      const sLSkinWeights = new Float32Array(shinGeo.attributes.position.count * 4);
      
      for (let i = 0; i < shinGeo.attributes.position.count; i++) {
        sLSkinIndices[i * 4] = shinLIndex;
        sLSkinWeights[i * 4] = 1;
      }
      
      shinGeo.setAttribute('skinIndex', new THREE.BufferAttribute(sLSkinIndices, 4));
      shinGeo.setAttribute('skinWeight', new THREE.BufferAttribute(sLSkinWeights, 4));
      shinL.bind(skel);
      meshes.push({ part: 'shinL' as BodyPart, mesh: shinL, boneNames: ['shinL'] });
      
      // Left foot
      const footGeo = new THREE.BoxGeometry(legThickness * 1.3, p.legLength * 0.12, legThickness * 2, 2, 2, 3);
      const footLMat = new THREE.MeshStandardMaterial({ color: colors.tertiary, roughness: 0.5 });
      const footL = new THREE.SkinnedMesh(footGeo, footLMat);
      footL.name = 'footL';
      
      const footLIndex = boneArray.findIndex(b => b.name === 'footL');
      const fLSkinIndices = new Float32Array(footGeo.attributes.position.count * 4);
      const fLSkinWeights = new Float32Array(footGeo.attributes.position.count * 4);
      
      for (let i = 0; i < footGeo.attributes.position.count; i++) {
        fLSkinIndices[i * 4] = footLIndex;
        fLSkinWeights[i * 4] = 1;
      }
      
      footGeo.setAttribute('skinIndex', new THREE.BufferAttribute(fLSkinIndices, 4));
      footGeo.setAttribute('skinWeight', new THREE.BufferAttribute(fLSkinWeights, 4));
      footL.bind(skel);
      meshes.push({ part: 'footL' as BodyPart, mesh: footL, boneNames: ['footL'] });
      
      // Right leg (mirror left)
      const thighR = thighL.clone();
      thighR.name = 'thighR';
      const thighRIndex = boneArray.findIndex(b => b.name === 'thighR');
      const tRSkinIndices = new Float32Array(thighGeo.attributes.position.count * 4);
      const tRSkinWeights = new Float32Array(thighGeo.attributes.position.count * 4);
      for (let i = 0; i < thighGeo.attributes.position.count; i++) {
        tRSkinIndices[i * 4] = thighRIndex;
        tRSkinWeights[i * 4] = 1;
      }
      thighR.geometry = thighGeo.clone();
      thighR.geometry.setAttribute('skinIndex', new THREE.BufferAttribute(tRSkinIndices, 4));
      thighR.geometry.setAttribute('skinWeight', new THREE.BufferAttribute(tRSkinWeights, 4));
      thighR.bind(skel);
      meshes.push({ part: 'thighR' as BodyPart, mesh: thighR, boneNames: ['thighR'] });
      
      const shinR = shinL.clone();
      shinR.name = 'shinR';
      const shinRIndex = boneArray.findIndex(b => b.name === 'shinR');
      const sRSkinIndices = new Float32Array(shinGeo.attributes.position.count * 4);
      const sRSkinWeights = new Float32Array(shinGeo.attributes.position.count * 4);
      for (let i = 0; i < shinGeo.attributes.position.count; i++) {
        sRSkinIndices[i * 4] = shinRIndex;
        sRSkinWeights[i * 4] = 1;
      }
      shinR.geometry = shinGeo.clone();
      shinR.geometry.setAttribute('skinIndex', new THREE.BufferAttribute(sRSkinIndices, 4));
      shinR.geometry.setAttribute('skinWeight', new THREE.BufferAttribute(sRSkinWeights, 4));
      shinR.bind(skel);
      meshes.push({ part: 'shinR' as BodyPart, mesh: shinR, boneNames: ['shinR'] });
      
      const footR = footL.clone();
      footR.name = 'footR';
      const footRIndex = boneArray.findIndex(b => b.name === 'footR');
      const fRSkinIndices = new Float32Array(footGeo.attributes.position.count * 4);
      const fRSkinWeights = new Float32Array(footGeo.attributes.position.count * 4);
      for (let i = 0; i < footGeo.attributes.position.count; i++) {
        fRSkinIndices[i * 4] = footRIndex;
        fRSkinWeights[i * 4] = 1;
      }
      footR.geometry = footGeo.clone();
      footR.geometry.setAttribute('skinIndex', new THREE.BufferAttribute(fRSkinIndices, 4));
      footR.geometry.setAttribute('skinWeight', new THREE.BufferAttribute(fRSkinWeights, 4));
      footR.bind(skel);
      meshes.push({ part: 'footR' as BodyPart, mesh: footR, boneNames: ['footR'] });
      
      return { skeleton: skel, skinnedMeshes: meshes };
    }, [character]);
    
    // Animation loop
    useFrame((state, delta) => {
      animationTime.current += delta;
      
      // Apply idle animation - subtle breathing
      const spine = bonesRef.current.get('spine');
      const chest = bonesRef.current.get('chest');
      
      if (spine && animationState.current === 'idle') {
        const breathe = Math.sin(animationTime.current * 2) * 0.02;
        spine.rotation.x = breathe;
        
        if (chest) {
          chest.rotation.x = breathe * 0.5;
        }
      }
      
      // Update skeleton matrices
      if (skeletonRef.current) {
        skeletonRef.current.calculateInverses();
      }
    });
    
    // Expose imperative API
    useImperativeHandle(ref, () => ({
      setAnimation: (state: AnimationState) => {
        animationState.current = state;
        animationTime.current = 0;
      },
      getBone: (name: string) => bonesRef.current.get(name),
      getSkeleton: () => skeletonRef.current,
      playEmote: (emoteName: string) => {
        console.log(`[ProGen] Playing emote: ${emoteName}`);
        // TODO: Implement emote animations
      }
    }));
    
    return (
      <group
        ref={groupRef}
        position={position}
        rotation={rotation}
        scale={[scale, scale, scale]}
      >
        {/* Render all skinned meshes */}
        {skinnedMeshes.map(({ part, mesh }) => (
          <primitive
            key={part}
            object={mesh}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          />
        ))}
        
        {/* Debug bone visualization (optional) */}
        {/* <SkeletonHelper skeleton={skeleton} /> */}
      </group>
    );
  }
);

ProGenCharacterMesh.displayName = 'ProGenCharacterMesh';

export default ProGenCharacterMesh;
