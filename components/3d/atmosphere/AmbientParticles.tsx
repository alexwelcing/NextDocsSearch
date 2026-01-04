/**
 * AmbientParticles - Floating "wisdom dust" particles
 *
 * Creates an ethereal atmosphere of gently drifting particles that
 * give the space depth and a sense of being in an infinite library.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ExperienceTheme } from '@/lib/3d/vision';

interface AmbientParticlesProps {
  count?: number;
  radius?: number;
  theme?: ExperienceTheme;
  intensity?: number;
}

export default function AmbientParticles({
  count = 500,
  radius = 50,
  theme,
  intensity = 1,
}: AmbientParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);

  // Generate particle positions and velocities
  const { positions, velocities, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Distribute in a sphere with higher density in center
      const r = Math.pow(Math.random(), 0.5) * radius;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);

      // Slow, gentle drift
      const speed = theme?.atmosphere.particleSpeed ?? 0.02;
      velocities[i3] = (Math.random() - 0.5) * speed;
      velocities[i3 + 1] = (Math.random() - 0.5) * speed * 0.5 + speed * 0.3; // Slight upward bias
      velocities[i3 + 2] = (Math.random() - 0.5) * speed;

      // Random phase for twinkling
      phases[i] = Math.random() * Math.PI * 2;
    }

    return { positions, velocities, phases };
  }, [count, radius, theme?.atmosphere.particleSpeed]);

  // Create geometry with positions
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  // Animate particles
  useFrame((state) => {
    if (!pointsRef.current || !materialRef.current) return;

    const time = state.clock.elapsedTime;
    const positionAttribute = pointsRef.current.geometry.getAttribute('position');
    const posArray = positionAttribute.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Update positions with velocity
      posArray[i3] += velocities[i3];
      posArray[i3 + 1] += velocities[i3 + 1];
      posArray[i3 + 2] += velocities[i3 + 2];

      // Wrap around bounds
      const distFromCenter = Math.sqrt(
        posArray[i3] ** 2 + posArray[i3 + 1] ** 2 + posArray[i3 + 2] ** 2
      );

      if (distFromCenter > radius) {
        // Respawn on opposite side
        posArray[i3] *= -0.9;
        posArray[i3 + 1] *= -0.9;
        posArray[i3 + 2] *= -0.9;
      }
    }

    positionAttribute.needsUpdate = true;

    // Gentle opacity pulsing
    const baseOpacity = 0.4 * intensity;
    materialRef.current.opacity = baseOpacity + Math.sin(time * 0.5) * 0.1;
  });

  const particleColor = theme?.atmosphere.particleColor ?? '#ffffff';

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        ref={materialRef}
        color={particleColor}
        size={0.15}
        transparent
        opacity={0.4}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
