/**
 * ParticleField - GPU-accelerated particle system
 *
 * Uses instanced geometry and custom shaders for high-performance
 * particle rendering. Supports thousands of particles at 60fps.
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { particleVertexShader, particleFragmentShader } from '../shaders/particles';

interface ParticleFieldProps {
  count?: number;
  radius?: number;
  color?: string;
  color2?: string;
  size?: number;
  speed?: number;
  spread?: number;
}

const ParticleField: React.FC<ParticleFieldProps> = ({
  count = 500,
  radius = 15,
  color = '#00d4ff',
  color2 = '#ff00ff',
  size = 3,
  speed = 0.5,
  spread = 1,
}) => {
  const meshRef = useRef<THREE.Points>(null);

  // Create geometry with attributes
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Spherical distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.3 + Math.random() * 0.7);

      const i3 = i * 3;
      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);

      scales[i] = 0.5 + Math.random() * 1.5;
      phases[i] = Math.random();

      velocities[i3] = (Math.random() - 0.5) * 0.1;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.1;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));

    return geo;
  }, [count, radius]);

  // Shader uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: size },
      uSpeed: { value: speed },
      uSpread: { value: spread },
      uColor: { value: new THREE.Color(color) },
      uColor2: { value: new THREE.Color(color2) },
    }),
    [size, speed, spread, color, color2]
  );

  // Material
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  // Animation loop
  useFrame((state) => {
    if (meshRef.current) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  return <points ref={meshRef} geometry={geometry} material={material} />;
};

export default ParticleField;
