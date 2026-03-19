/**
 * StarField - Background particle system for galaxy view
 * 
 * Uses instanced mesh for performance with thousands of stars.
 * Stars have subtle twinkle animation and depth-based coloring.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StarFieldProps {
  count?: number;
  bounds?: { min: [number, number, number]; max: [number, number, number] };
}

export function StarField({ count = 3000, bounds }: StarFieldProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const twinkleRef = useRef<Float32Array>(new Float32Array(count));

  // Generate star positions and properties
  const { positions, colors, sizes, twinklePhase } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const twinklePhase = new Float32Array(count);

    // Expand bounds or use default
    const minX = bounds ? bounds.min[0] - 50 : -100;
    const maxX = bounds ? bounds.max[0] + 50 : 100;
    const minY = bounds ? bounds.min[1] - 50 : -100;
    const maxY = bounds ? bounds.max[1] + 50 : 100;
    const minZ = bounds ? bounds.min[2] - 50 : -100;
    const maxZ = bounds ? bounds.max[2] + 50 : 100;

    const color1 = new THREE.Color(0x00d4ff); // Cyan
    const color2 = new THREE.Color(0xffffff); // White
    const color3 = new THREE.Color(0xffd700); // Gold

    for (let i = 0; i < count; i++) {
      // Position
      positions[i * 3] = minX + Math.random() * (maxX - minX);
      positions[i * 3 + 1] = minY + Math.random() * (maxY - minY);
      positions[i * 3 + 2] = minZ + Math.random() * (maxZ - minZ);

      // Color based on position (gradient effect)
      const colorChoice = Math.random();
      let color: THREE.Color;
      if (colorChoice < 0.7) {
        color = color2; // Mostly white
      } else if (colorChoice < 0.85) {
        color = color1; // Some cyan
      } else {
        color = color3; // Some gold
      }
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Size variation
      sizes[i] = 0.5 + Math.random() * 1.5;

      // Twinkle phase
      twinklePhase[i] = Math.random() * Math.PI * 2;
    }

    return { positions, colors, sizes, twinklePhase };
  }, [count, bounds]);

  // Twinkle animation
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    
    const time = clock.getElapsedTime();
    const scales = meshRef.current.instanceMatrix.array;
    
    for (let i = 0; i < count; i++) {
      const twinkle = Math.sin(time * 2 + twinklePhase[i]) * 0.3 + 0.7;
      const baseScale = sizes[i];
      const finalScale = baseScale * twinkle;
      
      // Update scale in matrix (simplified - full matrix update would be expensive)
      // For performance, we'll use a custom shader approach or accept uniform scaling
    }
  });

  // Star geometry - simple point
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [positions, colors, sizes]);

  // Custom shader material for twinkling points
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1 },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float uTime;
        uniform float uPixelRatio;
        
        void main() {
          vColor = color;
          
          // Twinkle effect
          float twinkle = sin(uTime * 2.0 + position.x * 0.1 + position.y * 0.1) * 0.3 + 0.7;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = size * uPixelRatio * twinkle * (300.0 / -mvPosition.z);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        
        void main() {
          // Circular point
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          if (dist > 0.5) discard;
          
          // Soft edge
          float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
          
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // Update time uniform
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <points geometry={geometry} material={material} />
  );
}

export default StarField;
