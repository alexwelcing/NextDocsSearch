/**
 * AmbientParticles - Floating "wisdom dust" particles
 *
 * Creates an ethereal atmosphere of gently drifting particles that
 * give the space depth and a sense of being in an infinite library.
 *
 * Performance optimizations:
 * - Adaptive particle count based on device capabilities
 * - Squared distance comparisons to avoid sqrt operations
 * - Frame throttling for position updates
 */

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ExperienceTheme } from '@/lib/3d/vision';

interface AmbientParticlesProps {
  count?: number;
  radius?: number;
  theme?: ExperienceTheme;
  intensity?: number;
}

/**
 * Detect device capabilities for adaptive particle count
 */
function getAdaptiveParticleCount(requestedCount: number): number {
  if (typeof window === 'undefined') return requestedCount;

  const isMobile = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const maxTextureSize = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 4096;

  // Scale particle count based on device capability
  if (isMobile) {
    return Math.floor(requestedCount * 0.3); // 30% on mobile
  } else if (maxTextureSize < 4096) {
    return Math.floor(requestedCount * 0.5); // 50% on low-end desktop
  } else if (maxTextureSize >= 8192) {
    return requestedCount; // Full count on high-end
  }
  return Math.floor(requestedCount * 0.7); // 70% on mid-range
}

export default function AmbientParticles({
  count = 500,
  radius = 50,
  theme,
  intensity = 1,
}: AmbientParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const frameCountRef = useRef(0);

  // Adaptive particle count based on device
  const [adaptiveCount, setAdaptiveCount] = useState(count);

  useEffect(() => {
    setAdaptiveCount(getAdaptiveParticleCount(count));
  }, [count]);

  // Generate particle positions and velocities
  const { positions, velocities, phases, radiusSquared } = useMemo(() => {
    const positions = new Float32Array(adaptiveCount * 3);
    const velocities = new Float32Array(adaptiveCount * 3);
    const phases = new Float32Array(adaptiveCount);
    const radiusSquared = radius * radius; // Pre-compute for performance

    for (let i = 0; i < adaptiveCount; i++) {
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

    return { positions, velocities, phases, radiusSquared };
  }, [adaptiveCount, radius, theme?.atmosphere.particleSpeed]);

  // Create geometry with positions
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  // Animate particles - optimized with frame throttling and squared distance
  useFrame((state) => {
    if (!pointsRef.current || !materialRef.current) return;

    const time = state.clock.elapsedTime;
    frameCountRef.current++;

    // Update particle positions every other frame for better performance
    // On high-end devices this is 30 updates/sec instead of 60, which is sufficient
    // for slow-drifting particles
    if (frameCountRef.current % 2 === 0) {
      const positionAttribute = pointsRef.current.geometry.getAttribute('position');
      const posArray = positionAttribute.array as Float32Array;

      for (let i = 0; i < adaptiveCount; i++) {
        const i3 = i * 3;

        // Update positions with velocity
        posArray[i3] += velocities[i3];
        posArray[i3 + 1] += velocities[i3 + 1];
        posArray[i3 + 2] += velocities[i3 + 2];

        // Wrap around bounds using squared distance (avoids expensive sqrt)
        const distSquaredFromCenter =
          posArray[i3] * posArray[i3] +
          posArray[i3 + 1] * posArray[i3 + 1] +
          posArray[i3 + 2] * posArray[i3 + 2];

        if (distSquaredFromCenter > radiusSquared) {
          // Respawn on opposite side
          posArray[i3] *= -0.9;
          posArray[i3 + 1] *= -0.9;
          posArray[i3 + 2] *= -0.9;
        }
      }

      positionAttribute.needsUpdate = true;
    }

    // Gentle opacity pulsing (update every frame for smooth animation)
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
