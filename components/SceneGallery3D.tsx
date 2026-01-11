import React, { useState, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard, useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface SceneOption {
  id: string;
  name: string;
  type: 'image' | 'splat' | 'world';
  path: string;
  description?: string;
}

interface ScenePreviewProps {
  scene: SceneOption;
  position: [number, number, number];
  onSelect: (scene: SceneOption) => void;
  isSelected: boolean;
  index: number;
}

// Component for image-type scenes that use texture loading
function ScenePreviewImage({ scene, position, onSelect, isSelected, index }: ScenePreviewProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const frameRef = useRef<THREE.Mesh>(null);
  const texture = useTexture(scene.path);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.4 + index * 0.7) * 0.08;
      if (!hovered && !isSelected) {
        meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2 + index) * 0.1;
      }
    }
    if (frameRef.current && isSelected) {
      const intensity = 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
      (frameRef.current.material as THREE.MeshBasicMaterial).opacity = intensity;
    }
  });

  return (
    <group position={position}>
      <mesh ref={frameRef} position={[0, 0, -0.05]}>
        <planeGeometry args={[2.2, 1.4]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={isSelected ? 0.5 : hovered ? 0.3 : 0.1} />
      </mesh>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => { e.stopPropagation(); onSelect(scene); }}
      >
        <planeGeometry args={[2, 1.2]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      <Billboard position={[0, -0.85, 0]}>
        <Text fontSize={0.12} color={isSelected ? '#fff' : '#aaa'} anchorX="center" maxWidth={2}>
          {scene.name}
        </Text>
      </Billboard>
      {isSelected && (
        <mesh position={[0, -0.7, 0.1]}>
          <circleGeometry args={[0.05, 16]} />
          <meshBasicMaterial color="#0f0" />
        </mesh>
      )}
    </group>
  );
}

// Component for splat-type scenes (no texture, just placeholder)
function ScenePreviewSplat({ scene, position, onSelect, isSelected, index }: ScenePreviewProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const frameRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.4 + index * 0.7) * 0.08;
      if (!hovered && !isSelected) {
        meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2 + index) * 0.1;
      }
    }
    if (frameRef.current && isSelected) {
      const intensity = 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
      (frameRef.current.material as THREE.MeshBasicMaterial).opacity = intensity;
    }
  });

  return (
    <group position={position}>
      <mesh ref={frameRef} position={[0, 0, -0.05]}>
        <planeGeometry args={[2.2, 1.4]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={isSelected ? 0.5 : hovered ? 0.3 : 0.1} />
      </mesh>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => { e.stopPropagation(); onSelect(scene); }}
      >
        <planeGeometry args={[2, 1.2]} />
        <meshStandardMaterial color="#0a0a1a" emissive="#ffd700" emissiveIntensity={0.1} />
      </mesh>
      <Billboard position={[-0.8, 0.45, 0.1]}>
        <Text fontSize={0.12} color="#ffd700" anchorX="left">
          3D SPLAT
        </Text>
      </Billboard>
      <Billboard position={[0, -0.85, 0]}>
        <Text fontSize={0.12} color={isSelected ? '#fff' : '#aaa'} anchorX="center" maxWidth={2}>
          {scene.name}
        </Text>
      </Billboard>
      {isSelected && (
        <mesh position={[0, -0.7, 0.1]}>
          <circleGeometry args={[0.05, 16]} />
          <meshBasicMaterial color="#0f0" />
        </mesh>
      )}
    </group>
  );
}

// Wrapper component that renders the appropriate preview based on scene type
function ScenePreview(props: ScenePreviewProps) {
  if (props.scene.type === 'splat') {
    return <ScenePreviewSplat {...props} />;
  }
  if (props.scene.type === 'image' || props.scene.type === 'world') {
    return <ScenePreviewImage {...props} />;
  }
  return <ScenePreviewImage {...props} />;
}

interface SceneGallery3DProps {
  scenes: SceneOption[];
  currentScene: string;
  onSelectScene: (scene: SceneOption) => void;
  layout?: 'arc' | 'grid' | 'carousel';
}

export default function SceneGallery3D({
  scenes,
  currentScene,
  onSelectScene,
  layout = 'arc',
}: SceneGallery3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  const positions = useMemo(() => {
    const count = scenes.length;
    const result: [number, number, number][] = [];

    if (layout === 'arc') {
      const arcAngle = Math.PI * 0.6;
      const radius = 6;

      for (let i = 0; i < count; i++) {
        const angle = -arcAngle / 2 + (arcAngle / (count - 1 || 1)) * i;
        result.push([
          Math.sin(angle) * radius,
          2,
          -Math.cos(angle) * radius + 4,
        ]);
      }
    } else if (layout === 'grid') {
      const cols = Math.ceil(Math.sqrt(count));
      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        result.push([
          (col - (cols - 1) / 2) * 2.5,
          3 - row * 1.6,
          0,
        ]);
      }
    } else {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        result.push([
          Math.sin(angle) * 5,
          2,
          Math.cos(angle) * 5,
        ]);
      }
    }

    return result;
  }, [scenes.length, layout]);

  useFrame((state) => {
    if (groupRef.current && layout === 'carousel') {
      groupRef.current.rotation.y = -state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {scenes.map((scene, index) => (
        <ScenePreview
          key={scene.id}
          scene={scene}
          position={positions[index] || [0, 2, 0]}
          onSelect={onSelectScene}
          isSelected={currentScene === scene.path}
          index={index}
        />
      ))}
    </group>
  );
}
