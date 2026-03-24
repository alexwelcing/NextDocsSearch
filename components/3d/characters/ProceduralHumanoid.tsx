/**
 * Procedural Humanoid Character Generator
 */

import React, { useRef, useMemo, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export interface HumanoidConfig {
  height?: number;
  build?: 'slender' | 'average' | 'muscular';
  skinColor?: string;
  outfitColors?: { primary: string; secondary: string; accent: string };
  headType?: 'standard' | 'helmet' | 'hood';
  glowIntensity?: number;
}

export interface AnimationState {
  state: 'idle' | 'walking' | 'running';
  direction: THREE.Vector3;
  speed: number;
}

export interface HumanoidRef {
  setAnimationState: (state: AnimationState) => void;
  getPosition: () => THREE.Vector3;
  setPosition: (pos: THREE.Vector3) => void;
  getRotation: () => THREE.Euler;
  setRotation: (rot: THREE.Euler) => void;
}

const SKELETON = [
  { name: 'root', parent: null, pos: [0, 0, 0] },
  { name: 'spine', parent: 'root', pos: [0, 1, 0] },
  { name: 'chest', parent: 'spine', pos: [0, 0.4, 0] },
  { name: 'neck', parent: 'chest', pos: [0, 0.35, 0] },
  { name: 'head', parent: 'neck', pos: [0, 0.15, 0] },
  { name: 'upperArmL', parent: 'chest', pos: [-0.25, 0.25, 0] },
  { name: 'lowerArmL', parent: 'upperArmL', pos: [-0.15, -0.3, 0] },
  { name: 'upperArmR', parent: 'chest', pos: [0.25, 0.25, 0] },
  { name: 'lowerArmR', parent: 'upperArmR', pos: [0.15, -0.3, 0] },
  { name: 'upperLegL', parent: 'root', pos: [-0.12, 1, 0] },
  { name: 'lowerLegL', parent: 'upperLegL', pos: [0, -0.4, 0] },
  { name: 'upperLegR', parent: 'root', pos: [0.12, 1, 0] },
  { name: 'lowerLegR', parent: 'upperLegR', pos: [0, -0.4, 0] },
];

export const ProceduralHumanoid = forwardRef<HumanoidRef, { config?: HumanoidConfig; initialPosition?: [number,number,number] }>(
  ({ config = {}, initialPosition = [0, 0, 0] }, ref) => {
    const groupRef = useRef<THREE.Group>(null);
    const bones = useRef<Map<string, THREE.Group>>(new Map());
    const animRef = useRef({ state: 'idle', time: 0 });
    
    const build = config.build ?? 'average';
    const width = build === 'slender' ? 0.85 : build === 'muscular' ? 1.2 : 1;
    
    // Create skeleton
    useEffect(() => {
      if (!groupRef.current) return;
      
      SKELETON.forEach(bone => {
        const g = new THREE.Group();
        g.name = bone.name;
        g.position.set(...bone.pos as [number,number,number]);
        bones.current.set(bone.name, g);
        
        if (bone.parent) {
          const parent = bones.current.get(bone.parent);
          if (parent) parent.add(g);
        } else {
          groupRef.current?.add(g);
        }
      });
    }, []);
    
    // Position
    useEffect(() => {
      if (groupRef.current) {
        groupRef.current.position.set(...initialPosition);
      }
    }, [initialPosition]);
    
    // API
    useImperativeHandle(ref, () => ({
      setAnimationState: (s: AnimationState) => { animRef.current.state = s.state; },
      getPosition: () => groupRef.current?.position.clone() ?? new THREE.Vector3(),
      setPosition: (p: THREE.Vector3) => { if (groupRef.current) groupRef.current.position.copy(p); },
      getRotation: () => groupRef.current?.rotation.clone() ?? new THREE.Euler(),
      setRotation: (r: THREE.Euler) => { if (groupRef.current) groupRef.current.rotation.copy(r); }
    }), []);
    
    // Animation
    useFrame((state) => {
      const t = state.clock.elapsedTime;
      animRef.current.time = t;
      
      const upperArmL = bones.current.get('upperArmL');
      const upperArmR = bones.current.get('upperArmR');
      const upperLegL = bones.current.get('upperLegL');
      const upperLegR = bones.current.get('upperLegR');
      const lowerLegL = bones.current.get('lowerLegL');
      const lowerLegR = bones.current.get('lowerLegR');
      
      if (animRef.current.state === 'idle') {
        if (upperArmL) upperArmL.rotation.z = Math.sin(t * 1.5) * 0.05 + 0.1;
        if (upperArmR) upperArmR.rotation.z = -Math.sin(t * 1.5 + 1) * 0.05 - 0.1;
      } else if (animRef.current.state === 'walking') {
        const s = Math.sin(t * 8);
        if (upperLegL) upperLegL.rotation.x = s * 0.5;
        if (upperLegR) upperLegR.rotation.x = -s * 0.5;
        if (upperArmL) upperArmL.rotation.x = -s * 0.3;
        if (upperArmR) upperArmR.rotation.x = s * 0.3;
      }
    });
    
    const primary = config.outfitColors?.primary ?? '#2c3e50';
    const accent = config.outfitColors?.accent ?? '#3498db';
    
    return (
      <group ref={groupRef}>
        {/* Head */}
        <mesh position={[0, 1.7, 0]} castShadow>
          <boxGeometry args={[0.18 * width, 0.22, 0.2]} />
          <meshStandardMaterial color={config.headType === 'helmet' ? primary : config.skinColor ?? '#e0c0a0'} />
        </mesh>
        
        {/* Torso */}
        <mesh position={[0, 1.2, 0]} castShadow>
          <boxGeometry args={[0.35 * width, 0.5, 0.2]} />
          <meshStandardMaterial color={primary} />
        </mesh>
        
        {/* Arms */}
        <mesh position={[-0.25, 1.3, 0]} castShadow>
          <capsuleGeometry args={[0.055 * width, 0.5, 4, 8]} />
          <meshStandardMaterial color={config.outfitColors?.secondary ?? '#34495e'} />
        </mesh>
        <mesh position={[0.25, 1.3, 0]} castShadow>
          <capsuleGeometry args={[0.055 * width, 0.5, 4, 8]} />
          <meshStandardMaterial color={config.outfitColors?.secondary ?? '#34495e'} />
        </mesh>
        
        {/* Legs */}
        <mesh position={[-0.12, 0.6, 0]} castShadow>
          <capsuleGeometry args={[0.07 * width, 0.7, 4, 8]} />
          <meshStandardMaterial color={primary} />
        </mesh>
        <mesh position={[0.12, 0.6, 0]} castShadow>
          <capsuleGeometry args={[0.07 * width, 0.7, 4, 8]} />
          <meshStandardMaterial color={primary} />
        </mesh>
      </group>
    );
  }
);

ProceduralHumanoid.displayName = 'ProceduralHumanoid';
export default ProceduralHumanoid;
