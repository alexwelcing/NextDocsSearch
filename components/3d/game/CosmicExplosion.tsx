import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CosmicExplosionProps {
  position: [number, number, number];
  color?: string;
  onComplete: () => void;
  isGolden?: boolean;
}

interface CosmicParticle {
  velocity: THREE.Vector3;
  life: number;
  initialLife: number;
  rotationSpeed: number;
  type: 'spark' | 'ring' | 'core';
}

const CosmicExplosion: React.FC<CosmicExplosionProps> = ({
  position,
  color = '#00BFFF',
  onComplete,
  isGolden = false,
}) => {
  const sparkMeshRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const secondaryRingRef = useRef<THREE.Mesh>(null);
  const shockwaveRef = useRef<THREE.Mesh>(null);
  const lifeRef = useRef(0);

  const particleCount = 60; // More particles for cosmic effect
  const duration = 0.8;

  // Colors based on orb type
  const primaryColor = isGolden ? '#ffd700' : color;
  const secondaryColor = isGolden ? '#ff8c00' : '#00ffff';
  const coreColor = '#ffffff';

  // Generate particles with various properties
  const particles = useMemo<CosmicParticle[]>(() => {
    return Array.from({ length: particleCount }, (_, i) => {
      // Different velocity patterns for variety
      const speed = 8 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const velocity = new THREE.Vector3(
        speed * Math.sin(phi) * Math.cos(theta),
        speed * Math.sin(phi) * Math.sin(theta),
        speed * Math.cos(phi)
      );

      return {
        velocity,
        life: 1.0,
        initialLife: 0.6 + Math.random() * 0.4,
        rotationSpeed: (Math.random() - 0.5) * 10,
        type: i < 10 ? 'core' : 'spark',
      };
    });
  }, []);

  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const tempPosition = useMemo(() => new THREE.Vector3(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);
  const tempQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);

  useFrame((state, delta) => {
    lifeRef.current += delta;
    const progress = Math.min(lifeRef.current / duration, 1);

    // Animate spark particles
    if (sparkMeshRef.current) {
      const mesh = sparkMeshRef.current;
      let allDead = true;

      particles.forEach((particle, i) => {
        const particleProgress = Math.min(lifeRef.current / particle.initialLife, 1);

        if (particleProgress < 1) {
          allDead = false;

          // Position with some gravity (local coordinates - group handles world position)
          tempPosition.set(
            particle.velocity.x * particleProgress * 0.5,
            particle.velocity.y * particleProgress * 0.5 - particleProgress * particleProgress * 2,
            particle.velocity.z * particleProgress * 0.5
          );

          // Scale based on remaining life with trail effect
          const lifeRemaining = 1 - particleProgress;
          const scale = lifeRemaining * (particle.type === 'core' ? 0.2 : 0.12);
          tempScale.set(scale, scale * 2, scale); // Elongated for motion blur effect

          // Rotation toward movement direction
          euler.set(
            particle.velocity.y * 0.1,
            particle.velocity.x * 0.1,
            lifeRef.current * particle.rotationSpeed
          );
          tempQuaternion.setFromEuler(euler);

          matrix.compose(tempPosition, tempQuaternion, tempScale);
          mesh.setMatrixAt(i, matrix);
        } else {
          tempScale.set(0, 0, 0);
          matrix.compose(tempPosition, tempQuaternion, tempScale);
          mesh.setMatrixAt(i, matrix);
        }
      });

      mesh.instanceMatrix.needsUpdate = true;
    }

    // Animate expanding ring
    if (ringRef.current?.material) {
      const ringProgress = Math.min(progress * 2, 1);
      const ringScale = ringProgress * 4;
      ringRef.current.scale.set(ringScale, ringScale, ringScale);
      const ringMaterial = ringRef.current.material as THREE.MeshBasicMaterial;
      ringMaterial.opacity = (1 - ringProgress) * 0.6;
      ringRef.current.rotation.x = Math.PI / 2;
      ringRef.current.rotation.z = lifeRef.current * 2;
    }

    // Animate secondary ring (perpendicular)
    if (secondaryRingRef.current?.material) {
      const ringProgress = Math.min(progress * 1.5, 1);
      const ringScale = ringProgress * 3;
      secondaryRingRef.current.scale.set(ringScale, ringScale, ringScale);
      const ringMaterial = secondaryRingRef.current.material as THREE.MeshBasicMaterial;
      ringMaterial.opacity = (1 - ringProgress) * 0.4;
      secondaryRingRef.current.rotation.y = Math.PI / 2;
      secondaryRingRef.current.rotation.x = lifeRef.current * -3;
    }

    // Animate shockwave (flat expanding ring)
    if (shockwaveRef.current?.material) {
      const swProgress = Math.min(progress * 1.2, 1);
      const swScale = swProgress * 6;
      shockwaveRef.current.scale.set(swScale, swScale, 0.1);
      const swMaterial = shockwaveRef.current.material as THREE.MeshBasicMaterial;
      swMaterial.opacity = (1 - swProgress) * 0.3;
    }

    // Animate core flash
    if (coreRef.current?.material) {
      const coreProgress = progress < 0.2 ? progress * 5 : 1 - (progress - 0.2) / 0.8;
      const coreScale = coreProgress * 1.5;
      coreRef.current.scale.setScalar(coreScale);
      const coreMaterial = coreRef.current.material as THREE.MeshBasicMaterial;
      coreMaterial.opacity = coreProgress;
    }

    // Complete when animation is done
    if (progress >= 1) {
      onComplete();
    }
  });

  return (
    <group position={position}>
      {/* Core flash - bright white center */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial
          color={coreColor}
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Primary expanding ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[1, 0.08, 8, 32]} />
        <meshBasicMaterial
          color={primaryColor}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Secondary ring (perpendicular) */}
      <mesh ref={secondaryRingRef}>
        <torusGeometry args={[1, 0.06, 8, 32]} />
        <meshBasicMaterial
          color={secondaryColor}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Flat shockwave ring */}
      <mesh ref={shockwaveRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1, 32]} />
        <meshBasicMaterial
          color={primaryColor}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Spark particles */}
      <instancedMesh ref={sparkMeshRef} args={[undefined, undefined, particleCount]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={primaryColor}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
};

export default CosmicExplosion;
