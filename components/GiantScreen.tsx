import React, { useRef, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, Text, Html } from '@react-three/drei';
import { useBox } from '@react-three/cannon';
import * as THREE from 'three';

interface GiantScreenProps {
  isVisible: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  title?: string;
  canShatter?: boolean;
}

export default function GiantScreen({
  isVisible,
  onClose,
  children,
  title = 'DISPLAY',
  canShatter = true,
}: GiantScreenProps) {
  const [isShattered, setIsShattered] = useState(false);
  const [scale, setScale] = useState(0);
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  // Physics for shattering
  const [screenRef] = useBox<THREE.Mesh>(() => ({
    mass: isShattered ? 10 : 0,
    position: [0, 5, 0],
    args: [12, 8, 0.2],
    material: {
      friction: 0.5,
      restitution: 0.3
    }
  }));

  // Animate screen appearance/disappearance
  useFrame((state) => {
    if (!groupRef.current) return;

    // Billboard effect - always face camera
    const cameraWorldPos = new THREE.Vector3();
    camera.getWorldPosition(cameraWorldPos);
    groupRef.current.lookAt(cameraWorldPos);

    // Scale animation
    const targetScale = isVisible && !isShattered ? 1 : 0;
    setScale(prev => THREE.MathUtils.lerp(prev, targetScale, 0.1));
    groupRef.current.scale.set(scale, scale, scale);

    // If shattered, apply physics
    if (isShattered && screenRef.current) {
      // Let it fall and disappear
      const pos = screenRef.current.position;
      if (pos.y < -10) {
        setIsShattered(false);
        onClose?.();
      }
    }
  });

  const handleShatter = useCallback((e: any) => {
    if (!canShatter) return;
    e.stopPropagation();

    // Check if thrown with force (velocity from click)
    const force = e.delta || 0;
    if (force > 5) {
      setIsShattered(true);
    }
  }, [canShatter]);

  const handleCollapse = useCallback((e: any) => {
    e.stopPropagation();
    onClose?.();
  }, [onClose]);

  if (!isVisible || scale < 0.01) return null;

  return (
    <group ref={groupRef} position={[0, 5, 0]}>
      {/* Main screen frame - thick industrial metal */}
      <RoundedBox
        args={[12.4, 8.4, 0.3]}
        radius={0.1}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#1a1a1a"
          metalness={0.9}
          roughness={0.4}
        />
      </RoundedBox>

      {/* Screen glass panel */}
      <mesh
        ref={isShattered ? screenRef : undefined}
        position={[0, 0, 0.15]}
        onClick={handleShatter}
      >
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial
          color="#0a0a0f"
          emissive="#1a2a3a"
          emissiveIntensity={0.3}
          metalness={0.1}
          roughness={0.9}
          transparent={true}
          opacity={0.95}
        />
      </mesh>

      {/* Glowing edge lights */}
      {[
        [-6, 0, 0.15],
        [6, 0, 0.15],
        [0, 4, 0.15],
        [0, -4, 0.15],
      ].map((pos, i) => (
        <pointLight
          key={i}
          position={pos as [number, number, number]}
          color="#4488ff"
          intensity={0.5}
          distance={3}
        />
      ))}

      {/* Title bar */}
      <mesh position={[0, 3.8, 0.16]}>
        <planeGeometry args={[11.8, 0.6]} />
        <meshStandardMaterial
          color="#0a0a0a"
          metalness={0.8}
          roughness={0.5}
        />
      </mesh>

      <Text
        position={[-5.7, 3.8, 0.17]}
        fontSize={0.3}
        color="#00ff88"
        anchorX="left"
        anchorY="middle"
        font="/fonts/RobotoMono-Bold.ttf"
      >
        {title}
      </Text>

      {/* Close button */}
      <mesh position={[5.7, 3.8, 0.17]} onClick={handleCollapse}>
        <circleGeometry args={[0.2, 16]} />
        <meshStandardMaterial
          color="#ff4444"
          emissive="#ff4444"
          emissiveIntensity={0.5}
        />
      </mesh>

      <Text
        position={[5.7, 3.8, 0.18]}
        fontSize={0.25}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        ✕
      </Text>

      {/* Content area - HTML overlay */}
      <Html
        position={[0, 0, 0.17]}
        transform
        occlude
        style={{
          width: '1100px',
          height: '700px',
          pointerEvents: 'auto',
        }}
      >
        <div style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
          color: '#00ff88',
          fontFamily: 'monospace',
          fontSize: '14px',
          padding: '20px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>
          {children}
        </div>
      </Html>

      {/* Corner screws */}
      {[
        [-5.9, 3.9],
        [5.9, 3.9],
        [-5.9, -3.9],
        [5.9, -3.9],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.31]}>
          <cylinderGeometry args={[0.08, 0.08, 0.05, 6]} />
          <meshStandardMaterial
            color="#0a0a0a"
            metalness={0.9}
            roughness={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}
