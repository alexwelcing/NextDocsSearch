import React, { useMemo, useState, useEffect } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as THREE from 'three';
import { OrbitControls, Html } from '@react-three/drei';
import { VRButton, XR, Controllers, Hands, useXR } from '@react-three/xr';


interface BackgroundSphereProps {
  imageUrl: string;
}

function BackgroundSphere({ imageUrl }: BackgroundSphereProps) {
  const texture = useLoader(TextureLoader, imageUrl);
  const geometry = useMemo(() => new THREE.SphereGeometry(15, 32, 16), []);



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
  isDialogOpen: boolean;
  onChangeImage: () => void;  // New prop to handle image change
}

function ThreeSixty({ currentImage, isDialogOpen, onChangeImage }: ThreeSixtyProps) {

  return (
    <>

      <Canvas>
      <VRButton   enterOnly={false}   exitOnly={false}

/>
        <XR>
          <Controllers />
          <Hands />
          <BackgroundSphere key={isDialogOpen ? "dialogOpen" : currentImage} imageUrl={currentImage} />
          <OrbitControls enableZoom={false} />

          <Html position={[0, 2, -5]} center>
  <button onClick={onChangeImage} style={{ padding: '8px 16px', background: 'white', borderRadius: '5px' }}>
    Change Scenery
  </button>
</Html>
        </XR>
      </Canvas>
    </>
  );
}

export default ThreeSixty