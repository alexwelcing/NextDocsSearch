import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface LaserBeamProps {
  targetPosition: [number, number, number];
  color?: string;
  onComplete: () => void;
  duration?: number;
  isGolden?: boolean;
}

const LaserBeam: React.FC<LaserBeamProps> = ({
  targetPosition,
  color = '#00ffff',
  onComplete,
  duration = 0.3,
  isGolden = false,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const impactRef = useRef<THREE.Mesh>(null);
  const beamContainerRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const initializedRef = useRef(false);
  const { camera } = useThree();

  // Laser colors based on orb type
  const laserColor = isGolden ? '#ffd700' : color;
  const coreColor = '#ffffff';
  const glowColor = isGolden ? '#ff8c00' : '#00bfff';

  // Calculate initial beam length (will be updated in useFrame)
  const initialBeamLength = useMemo(() => {
    const target = new THREE.Vector3(...targetPosition);
    return target.length() + 2; // Approximate length
  }, [targetPosition]);

  useFrame((state, delta) => {
    timeRef.current += delta;
    const progress = Math.min(timeRef.current / duration, 1);

    if (!groupRef.current || !camera) return;

    // Position the group at the camera
    groupRef.current.position.copy(camera.position);
    groupRef.current.quaternion.copy(camera.quaternion);

    // Calculate beam direction and length from camera to target
    const target = new THREE.Vector3(...targetPosition);
    const cameraWorldPos = camera.position.clone();
    const startOffset = new THREE.Vector3(0, 0, -2).applyQuaternion(camera.quaternion);
    const beamStart = cameraWorldPos.add(startOffset);

    const direction = target.clone().sub(beamStart);
    const beamLength = direction.length();
    direction.normalize();

    // Update beam container rotation to face target
    if (beamContainerRef.current) {
      const quaternion = new THREE.Quaternion();
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      beamContainerRef.current.quaternion.copy(quaternion);

      // Update beam geometries to correct length
      if (!initializedRef.current) {
        initializedRef.current = true;
        // Update cylinder heights
        if (coreRef.current) {
          coreRef.current.geometry.dispose();
          coreRef.current.geometry = new THREE.CylinderGeometry(0.02, 0.02, beamLength, 8);
          coreRef.current.position.set(0, beamLength / 2, 0);
        }
        if (beamRef.current) {
          beamRef.current.geometry.dispose();
          beamRef.current.geometry = new THREE.CylinderGeometry(0.08, 0.05, beamLength, 12);
          beamRef.current.position.set(0, beamLength / 2, 0);
        }
        if (glowRef.current) {
          glowRef.current.geometry.dispose();
          glowRef.current.geometry = new THREE.CylinderGeometry(0.2, 0.15, beamLength, 12);
          glowRef.current.position.set(0, beamLength / 2, 0);
        }
      }
    }

    // Update impact position (in world space, relative to group)
    if (impactRef.current) {
      const localTarget = target.clone().sub(camera.position);
      // Transform to camera local space
      const invQuaternion = camera.quaternion.clone().invert();
      localTarget.applyQuaternion(invQuaternion);
      impactRef.current.position.copy(localTarget);
    }

    // Animate beam appearance and disappearance
    const beamProgress = progress < 0.5
      ? progress * 2 // Grow in first half
      : 2 - progress * 2; // Shrink in second half

    // Core beam - thin, bright white
    if (coreRef.current) {
      const material = coreRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = beamProgress * 1.0;
      coreRef.current.scale.set(1, Math.max(0.001, beamProgress), 1);
    }

    // Main beam
    if (beamRef.current) {
      const material = beamRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = beamProgress * 0.8;
      const pulse = 1 + Math.sin(timeRef.current * 30) * 0.1;
      beamRef.current.scale.set(pulse, Math.max(0.001, beamProgress), pulse);
    }

    // Outer glow - larger, more transparent
    if (glowRef.current) {
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = beamProgress * 0.3;
      const pulse = 1 + Math.sin(timeRef.current * 50) * 0.2;
      glowRef.current.scale.set(pulse, Math.max(0.001, beamProgress), pulse);
    }

    // Impact flash at target
    if (impactRef.current) {
      const impactProgress = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;
      const impactScale = Math.max(0.001, impactProgress * 3);
      impactRef.current.scale.setScalar(impactScale);
      const impactMaterial = impactRef.current.material as THREE.MeshBasicMaterial;
      impactMaterial.opacity = impactProgress * 0.9;
    }

    // Complete when animation is done
    if (progress >= 1) {
      onComplete();
    }
  });

  return (
    <group ref={groupRef}>
      {/* Impact flash at target position - position updated in useFrame */}
      <mesh ref={impactRef} position={[0, 0, -5]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial
          color={coreColor}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Beam container - positioned and rotated toward target */}
      <group ref={beamContainerRef} position={[0, 0, -2]}>
        {/* Core beam - brightest, thinnest */}
        <mesh ref={coreRef} position={[0, initialBeamLength / 2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, initialBeamLength, 8]} />
          <meshBasicMaterial
            color={coreColor}
            transparent
            opacity={1}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Main beam */}
        <mesh ref={beamRef} position={[0, initialBeamLength / 2, 0]}>
          <cylinderGeometry args={[0.08, 0.05, initialBeamLength, 12]} />
          <meshBasicMaterial
            color={laserColor}
            transparent
            opacity={0.8}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Outer glow */}
        <mesh ref={glowRef} position={[0, initialBeamLength / 2, 0]}>
          <cylinderGeometry args={[0.2, 0.15, initialBeamLength, 12]} />
          <meshBasicMaterial
            color={glowColor}
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Muzzle flash at origin */}
      <mesh position={[0, 0, -2]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial
          color={coreColor}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

export default LaserBeam;
