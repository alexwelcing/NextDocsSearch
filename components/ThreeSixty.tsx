import React from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';

interface BackgroundSphereProps {
  imageUrl: string;
}

function BackgroundSphere({ imageUrl }: BackgroundSphereProps) {
  const texture = useLoader(TextureLoader, imageUrl);
  const geometry = new THREE.SphereGeometry(15, 32, 16);

  if (Array.isArray(texture)) {
    console.error("Loaded multiple textures, but expected a single one.");
    return null;
  }

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        attach="material"
        map={texture}
        side={THREE.BackSide}  // Important: Render the inside of the sphere
      />
    </mesh>
  );
}

interface ThreeSixtyProps {
  currentImage: string;
}

function ThreeSixty({ currentImage }: ThreeSixtyProps) {
  return (
    <Canvas>
      <BackgroundSphere imageUrl={currentImage} />
      <OrbitControls enableZoom={false} />
    </Canvas>
  );
}

export default ThreeSixty;
