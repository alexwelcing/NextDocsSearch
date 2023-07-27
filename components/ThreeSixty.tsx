import React, { useState } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';


// Define the props for BackgroundSphere with types
interface BackgroundSphereProps {
    imageUrl: string;
  }

  function BackgroundSphere({ imageUrl }: BackgroundSphereProps) {
    const texture = useLoader(TextureLoader, imageUrl);
    const geometry = new THREE.SphereGeometry( 15, 32, 16 );


    // Ensure the loaded texture is of type Texture before assigning it to the material
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

  function ThreeSixty() {
    // Start with a default image, but this can be swapped
    const [currentImage, setCurrentImage] = useState("./scifi1.jpg");

    return (
        <Canvas>
        <BackgroundSphere imageUrl={currentImage} />
        <OrbitControls enableZoom={false} />
      </Canvas>
    );
  }

  export default ThreeSixty;