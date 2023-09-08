import React, { useState, useEffect, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as THREE from 'three';

interface BackgroundSphereProps {
  imageUrl: string;
  transitionDuration: number; // in seconds
}

export const BackgroundSphere: React.FC<BackgroundSphereProps> = ({ imageUrl, transitionDuration }) => {
  const [currentTexture, setCurrentTexture] = useState<THREE.Texture | null>(null);
  const [newTexture, setNewTexture] = useState<THREE.Texture | null>(null);
  const [opacity, setOpacity] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const loadedTexture = useLoader(TextureLoader, imageUrl);

  useEffect(() => {
    if (loadedTexture) {
      setIsTransitioning(true);
      setNewTexture(loadedTexture);
    }
  }, [loadedTexture]);

  useEffect(() => {
    let animationFrame: number;
    if (isTransitioning) {
      const step = 1 / (60 * transitionDuration); // assuming 60 FPS
      let progress = 0;

      const animate = () => {
        if (progress < 0.5) {
          setOpacity(1 - 2 * progress);
        } else {
          setCurrentTexture(newTexture);
          setOpacity(2 * progress - 1);
        }

        progress += step;

        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate);
        } else {
          setOpacity(1);
          setIsTransitioning(false);
        }
      };

      animate();
    }

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [isTransitioning, newTexture, transitionDuration]);

  const geometry = useMemo(() => new THREE.SphereGeometry(15, 32, 16), []);

  if (!currentTexture) {
    return null;
  }

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        attach="material"
        map={currentTexture}
        side={THREE.BackSide}
        opacity={opacity}
        transparent={true}
      />
    </mesh>
  );
};

export default BackgroundSphere;
