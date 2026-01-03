import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ParticleExplosionProps {
  position: [number, number, number];
  color?: string;
  onComplete: () => void;
}

interface Particle {
  velocity: THREE.Vector3;
  life: number;
  initialLife: number;
}

const ParticleExplosion: React.FC<ParticleExplosionProps> = ({
  position,
  color = '#00BFFF',
  onComplete,
}) => {
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const particleCount = 30;

  // Generate particles with random velocities
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: particleCount }, () => {
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
      return {
        velocity,
        life: 1.0,
        initialLife: 1.0,
      };
    });
  }, []);

  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const tempPosition = useMemo(() => new THREE.Vector3(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!instancedMeshRef.current) return;

    const mesh = instancedMeshRef.current;
    let allDead = true;

    particles.forEach((particle, i) => {
      if (particle.life > 0) {
        allDead = false;

        // Update position based on velocity
        tempPosition.set(
          position[0] + particle.velocity.x * (particle.initialLife - particle.life),
          position[1] + particle.velocity.y * (particle.initialLife - particle.life),
          position[2] + particle.velocity.z * (particle.initialLife - particle.life)
        );

        // Scale based on remaining life
        const scale = particle.life * 0.1;
        tempScale.set(scale, scale, scale);

        matrix.compose(tempPosition, new THREE.Quaternion(), tempScale);
        mesh.setMatrixAt(i, matrix);

        // Decay life
        particle.life -= delta * 2;
      } else {
        // Hide dead particles
        tempScale.set(0, 0, 0);
        matrix.compose(tempPosition, new THREE.Quaternion(), tempScale);
        mesh.setMatrixAt(i, matrix);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;

    // Remove explosion when all particles are dead
    if (allDead) {
      onComplete();
    }
  });

  return (
    <instancedMesh ref={instancedMeshRef} args={[undefined, undefined, particleCount]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </instancedMesh>
  );
};

export default ParticleExplosion;
