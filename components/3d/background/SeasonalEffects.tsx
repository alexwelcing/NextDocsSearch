/**
 * Seasonal Effects Component
 * Renders particle effects based on the current season
 * (snow, falling leaves, petals, fireflies, spiderwebs)
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Season, SeasonalTheme } from '@/lib/theme/seasonalTheme';

interface SeasonalEffectsProps {
  season: Season;
  theme: SeasonalTheme;
}

// Snow particles effect
function SnowParticles({ theme }: { theme: SeasonalTheme }) {
  const particlesRef = useRef<THREE.Points>(null);
  const count = Math.floor(1000 * theme.particleIntensity);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
      velocities[i] = Math.random() * 0.02 + 0.01;
    }

    return { positions, velocities };
  }, [count]);

  useFrame(() => {
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;

      for (let i = 0; i < count; i++) {
        // Fall down with slight horizontal drift
        positions[i * 3 + 1] -= particles.velocities[i];
        positions[i * 3] += Math.sin(Date.now() * 0.001 + i) * 0.001;

        // Reset to top when reaching bottom
        if (positions[i * 3 + 1] < -5) {
          positions[i * 3 + 1] = 50;
        }
      }

      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(particles.positions, 3));
    return geo;
  }, [particles.positions]);

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        size={0.15}
        color="#FFFFFF"
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// Falling leaves effect
function FallingLeaves({ theme }: { theme: SeasonalTheme }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = Math.floor(500 * theme.particleIntensity);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    const rotations = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
      velocities[i] = Math.random() * 0.015 + 0.005;
      rotations[i * 3] = Math.random() * Math.PI * 2;
      rotations[i * 3 + 1] = Math.random() * Math.PI * 2;
      rotations[i * 3 + 2] = Math.random() * Math.PI * 2;
    }

    return { positions, velocities, rotations };
  }, [count]);

  useFrame(() => {
    if (meshRef.current) {
      for (let i = 0; i < count; i++) {
        // Fall with swaying motion
        particles.positions[i * 3 + 1] -= particles.velocities[i];
        particles.positions[i * 3] += Math.sin(Date.now() * 0.001 + i) * 0.02;
        particles.positions[i * 3 + 2] += Math.cos(Date.now() * 0.001 + i) * 0.02;

        // Rotate leaves
        particles.rotations[i * 3] += 0.01;
        particles.rotations[i * 3 + 1] += 0.02;

        // Reset to top when reaching bottom
        if (particles.positions[i * 3 + 1] < -5) {
          particles.positions[i * 3 + 1] = 50;
        }

        // Update matrix
        dummy.position.set(
          particles.positions[i * 3],
          particles.positions[i * 3 + 1],
          particles.positions[i * 3 + 2]
        );
        dummy.rotation.set(
          particles.rotations[i * 3],
          particles.rotations[i * 3 + 1],
          particles.rotations[i * 3 + 2]
        );
        dummy.scale.setScalar(0.3);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }

      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial
        color="#FF6B00"
        side={THREE.DoubleSide}
        transparent
        opacity={0.8}
      />
    </instancedMesh>
  );
}

// Flower petals effect
function FlowerPetals({ theme }: { theme: SeasonalTheme }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = Math.floor(400 * theme.particleIntensity);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    const rotations = new Float32Array(count * 3);
    const colors: string[] = [];

    const petalColors = [
      '#FFB7B7',
      '#FFD4E5',
      '#FFF0F5',
    ];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
      velocities[i] = Math.random() * 0.01 + 0.005;
      rotations[i * 3] = Math.random() * Math.PI * 2;
      rotations[i * 3 + 1] = Math.random() * Math.PI * 2;
      rotations[i * 3 + 2] = Math.random() * Math.PI * 2;

      colors.push(petalColors[Math.floor(Math.random() * petalColors.length)]);
    }

    return { positions, velocities, rotations, colors };
  }, [count]);

  useEffect(() => {
    if (meshRef.current) {
      particles.colors.forEach((c, i) => {
        color.set(c);
        meshRef.current!.setColorAt(i, color);
      });
      meshRef.current.instanceColor!.needsUpdate = true;
    }
  }, [particles, count, color]);

  useFrame(() => {
    if (meshRef.current) {
      for (let i = 0; i < count; i++) {
        // Gentle fall with spiral motion
        particles.positions[i * 3 + 1] -= particles.velocities[i];
        particles.positions[i * 3] += Math.sin(Date.now() * 0.002 + i) * 0.015;
        particles.positions[i * 3 + 2] += Math.cos(Date.now() * 0.002 + i) * 0.015;

        // Rotate petals
        particles.rotations[i * 3] += 0.01;
        particles.rotations[i * 3 + 1] += 0.01;

        // Reset to top when reaching bottom
        if (particles.positions[i * 3 + 1] < -5) {
          particles.positions[i * 3 + 1] = 50;
        }

        // Update matrix
        dummy.position.set(
          particles.positions[i * 3],
          particles.positions[i * 3 + 1],
          particles.positions[i * 3 + 2]
        );
        dummy.rotation.set(
          particles.rotations[i * 3],
          particles.rotations[i * 3 + 1],
          particles.rotations[i * 3 + 2]
        );
        dummy.scale.setScalar(0.2);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        transparent
        opacity={0.75}
      />
    </instancedMesh>
  );
}

// Fireflies effect (summer)
function Fireflies({ theme }: { theme: SeasonalTheme }) {
  const particlesRef = useRef<THREE.Points>(null);
  const count = Math.floor(200 * theme.particleIntensity);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = Math.random() * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
      phases[i] = Math.random() * Math.PI * 2;
    }

    return { positions, phases };
  }, [count]);

  useFrame((state) => {
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      const time = state.clock.elapsedTime;

      for (let i = 0; i < count; i++) {
        // Floating motion
        positions[i * 3 + 1] += Math.sin(time + particles.phases[i]) * 0.005;
        positions[i * 3] += Math.cos(time * 0.5 + particles.phases[i]) * 0.003;
        positions[i * 3 + 2] += Math.sin(time * 0.3 + particles.phases[i]) * 0.003;
      }

      particlesRef.current.geometry.attributes.position.needsUpdate = true;

      // Pulse opacity
      if (particlesRef.current.material instanceof THREE.PointsMaterial) {
        particlesRef.current.material.opacity = 0.5 + Math.sin(time * 2) * 0.3;
      }
    }
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(particles.positions, 3));
    return geo;
  }, [particles.positions]);

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial
        size={0.1}
        color="#FFD700"
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Spider webs effect (Halloween)
function SpiderWebs({ theme }: { theme: SeasonalTheme }) {
  const webRef = useRef<THREE.LineSegments>(null);

  const webGeometry = useMemo(() => {
    const positions: number[] = [];
    const webCount = Math.floor(8 * theme.particleIntensity);

    for (let w = 0; w < webCount; w++) {
      const centerX = (Math.random() - 0.5) * 40;
      const centerY = Math.random() * 20 + 5;
      const centerZ = (Math.random() - 0.5) * 40;

      // Create radial web pattern
      const spokes = 8;
      const rings = 5;

      for (let i = 0; i < spokes; i++) {
        const angle = (i / spokes) * Math.PI * 2;
        for (let j = 0; j < rings - 1; j++) {
          const r1 = (j / rings) * 2;
          const r2 = ((j + 1) / rings) * 2;

          // Radial lines
          positions.push(
            centerX + Math.cos(angle) * r1,
            centerY + Math.sin(angle * 0.3) * r1 * 0.2,
            centerZ + Math.sin(angle) * r1
          );
          positions.push(
            centerX + Math.cos(angle) * r2,
            centerY + Math.sin(angle * 0.3) * r2 * 0.2,
            centerZ + Math.sin(angle) * r2
          );
        }
      }

      // Circular connections
      for (let j = 1; j < rings; j++) {
        const r = (j / rings) * 2;
        for (let i = 0; i < spokes; i++) {
          const angle1 = (i / spokes) * Math.PI * 2;
          const angle2 = ((i + 1) / spokes) * Math.PI * 2;

          positions.push(
            centerX + Math.cos(angle1) * r,
            centerY + Math.sin(angle1 * 0.3) * r * 0.2,
            centerZ + Math.sin(angle1) * r
          );
          positions.push(
            centerX + Math.cos(angle2) * r,
            centerY + Math.sin(angle2 * 0.3) * r * 0.2,
            centerZ + Math.sin(angle2) * r
          );
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [theme.particleIntensity]);

  useFrame((state) => {
    if (webRef.current && webRef.current.material instanceof THREE.LineBasicMaterial) {
      // Subtle shimmer effect
      webRef.current.material.opacity = 0.2 + Math.sin(state.clock.elapsedTime) * 0.1;
    }
  });

  return (
    <lineSegments ref={webRef} geometry={webGeometry}>
      <lineBasicMaterial
        color="#CCCCCC"
        transparent
        opacity={0.2}
        depthWrite={false}
      />
    </lineSegments>
  );
}

// Main component
export default function SeasonalEffects({ season, theme }: SeasonalEffectsProps) {
  switch (theme.effectType) {
    case 'snow':
      return <SnowParticles theme={theme} />;
    case 'leaves':
      return <FallingLeaves theme={theme} />;
    case 'petals':
      return <FlowerPetals theme={theme} />;
    case 'fireflies':
      return <Fireflies theme={theme} />;
    case 'spiderwebs':
      return <SpiderWebs theme={theme} />;
    case 'none':
    default:
      return null;
  }
}
