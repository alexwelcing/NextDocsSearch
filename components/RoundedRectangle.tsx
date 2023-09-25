import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface RoundedRectangleProps {
  width: number;
  height: number;
  radius: number;
  color: string;
}

const RoundedRectangle: React.FC<RoundedRectangleProps> = ({ width, height, radius, color }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Create the rounded rectangle shape
  const roundedRectShape = new THREE.Shape();
  roundedRectShape.moveTo(-width / 2 + radius, -height / 2);
  roundedRectShape.lineTo(width / 2 - radius, -height / 2);
  roundedRectShape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
  roundedRectShape.lineTo(width / 2, height / 2 - radius);
  roundedRectShape.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
  roundedRectShape.lineTo(-width / 2 + radius, height / 2);
  roundedRectShape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
  roundedRectShape.lineTo(-width / 2, -height / 2 + radius);
  roundedRectShape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);

  // Create geometry and material
  const geometry = new THREE.ShapeGeometry(roundedRectShape);
  const material = new THREE.MeshBasicMaterial({ color });

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} />
  );
};

export default RoundedRectangle;
