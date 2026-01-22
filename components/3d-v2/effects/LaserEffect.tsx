/**
 * LaserEffect - Fast, simple laser beam
 *
 * Minimal overhead laser that shoots from camera to target.
 * Uses basic materials for performance.
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface LaserEffectProps {
  target: [number, number, number];
  color?: string;
  duration?: number;
  onComplete?: () => void;
}

const LaserEffect: React.FC<LaserEffectProps> = ({
  target,
  color = '#00ffff',
  duration = 0.15,
  onComplete,
}) => {
  const { camera } = useThree();
  const lineRef = useRef<THREE.Line | null>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const [visible, setVisible] = useState(true);

  // Create line object with geometry and material
  const { lineObject, geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(6); // 2 points * 3 coords
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1,
      linewidth: 2,
    });

    const line = new THREE.Line(geo, mat);
    return { lineObject: line, geometry: geo, material: mat };
  }, [color]);

  // Add line to scene on mount
  useEffect(() => {
    lineRef.current = lineObject;
  }, [lineObject]);

  useFrame((_, delta) => {
    if (!visible || !lineRef.current) return;

    timeRef.current += delta;

    // Update line positions
    const positions = geometry.attributes.position.array as Float32Array;
    positions[0] = camera.position.x;
    positions[1] = camera.position.y;
    positions[2] = camera.position.z;
    positions[3] = target[0];
    positions[4] = target[1];
    positions[5] = target[2];
    geometry.attributes.position.needsUpdate = true;

    // Fade out
    const progress = timeRef.current / duration;
    const opacity = 1 - progress;

    material.opacity = opacity;

    if (flashRef.current?.material) {
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.8;
      flashRef.current.scale.setScalar(1 + progress * 2);
    }

    // Complete
    if (timeRef.current >= duration) {
      setVisible(false);
      onComplete?.();
    }
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  if (!visible) return null;

  return (
    <group>
      {/* Laser line using primitive */}
      <primitive object={lineObject} />

      {/* Impact flash */}
      <mesh ref={flashRef} position={target}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
    </group>
  );
};

export default LaserEffect;
