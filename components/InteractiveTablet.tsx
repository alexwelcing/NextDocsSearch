import React, { useState, useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import { useBox } from '@react-three/cannon';
import * as THREE from 'three';
import TerminalInterface from './TerminalInterface';

interface ArticleData {
  title: string;
  date: string;
  author: string[];
  filename?: string;
  length?: number;
}

interface SceneryOption {
  id: string;
  name: string;
  type: 'image' | 'splat';
  path: string;
}

interface InteractiveTabletProps {
  initialPosition?: [number, number, number];
  isGamePlaying?: boolean;
  articles?: ArticleData[];
  onStartGame?: () => void;
  cinematicRevealProgress?: number;
  onChangeScenery?: (scenery: SceneryOption) => void;
  availableScenery?: SceneryOption[];
  currentScenery?: string;
}

export default function InteractiveTablet({
  initialPosition = [0, 2.5, 4],
  isGamePlaying = false,
  articles = [],
  onStartGame,
  cinematicRevealProgress = 1,
  onChangeScenery,
  availableScenery = [],
  currentScenery,
}: InteractiveTabletProps) {
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  const tabletWidth = 3.2;
  const tabletHeight = 2.4;
  const tabletDepth = 0.12;

  const [ref, api] = useBox(() => ({
    mass: 0,
    position: initialPosition,
    args: [tabletWidth, tabletHeight, tabletDepth],
  }));

  const handleClick = useCallback(() => {
    setTerminalOpen(true);
  }, []);

  useFrame((state) => {
    if (groupRef.current && ref.current) {
      const time = state.clock.elapsedTime;

      // Face camera
      const cameraPos = new THREE.Vector3();
      camera.getWorldPosition(cameraPos);
      groupRef.current.lookAt(cameraPos);
      ref.current.rotation.copy(groupRef.current.rotation);

      // Float
      const floatY = Math.sin(time * 0.5) * 0.08;
      api.position.set(initialPosition[0], initialPosition[1] + floatY, initialPosition[2]);
      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 0, 0);

      // Scale reveal
      const scale = Math.min(cinematicRevealProgress, 1);
      groupRef.current.scale.setScalar(scale);
    }
  });

  if (isGamePlaying) return null;

  return (
    <>
      <group ref={groupRef}>
        {/* Tablet frame - dark */}
        <RoundedBox
          ref={ref as unknown as React.RefObject<THREE.Mesh>}
          args={[tabletWidth, tabletHeight, tabletDepth]}
          radius={0.08}
          smoothness={4}
          onClick={handleClick}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <meshStandardMaterial
            color="#1a1a1a"
            metalness={0.7}
            roughness={0.3}
          />
        </RoundedBox>

        {/* Screen - dark with subtle border glow */}
        <mesh position={[0, 0, tabletDepth / 2 + 0.002]}>
          <planeGeometry args={[tabletWidth - 0.25, tabletHeight - 0.25]} />
          <meshBasicMaterial color="#0a0a0a" />
        </mesh>

        {/* Screen border glow */}
        <mesh position={[0, 0, tabletDepth / 2 + 0.001]}>
          <planeGeometry args={[tabletWidth - 0.2, tabletHeight - 0.2]} />
          <meshBasicMaterial
            color={hovered ? "#00ff00" : "#003300"}
            transparent
            opacity={0.3}
          />
        </mesh>

        {/* HTML content on screen */}
        <Html
          position={[0, 0, tabletDepth / 2 + 0.01]}
          transform
          occlude
          style={{
            width: '280px',
            height: '200px',
            pointerEvents: 'auto',
          }}
        >
          <div
            onClick={handleClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              width: '100%',
              height: '100%',
              background: '#0d0d0d',
              border: `1px solid ${hovered ? '#00ff00' : '#333'}`,
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontFamily: 'monospace',
              transition: 'border-color 0.2s',
              padding: '16px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{
              color: '#00ff00',
              fontSize: '32px',
              marginBottom: '8px',
            }}>
              {'>_'}
            </div>
            <div style={{
              color: '#00ff00',
              fontSize: '14px',
              fontWeight: 'bold',
              letterSpacing: '2px',
              marginBottom: '16px',
            }}>
              TERMINAL
            </div>
            <div style={{
              color: hovered ? '#00ff00' : '#555',
              fontSize: '11px',
              transition: 'color 0.2s',
            }}>
              {hovered ? '[ CLICK TO OPEN ]' : 'click to open'}
            </div>
            <div style={{
              display: 'flex',
              gap: '16px',
              marginTop: '20px',
              fontSize: '10px',
              color: '#444',
            }}>
              <span>chat</span>
              <span>game</span>
              <span>scene</span>
            </div>
          </div>
        </Html>

        {/* Subtle glow light */}
        {hovered && (
          <pointLight
            position={[0, 0, 0.5]}
            color="#00ff00"
            intensity={0.5}
            distance={3}
            decay={2}
          />
        )}
      </group>

      <TerminalInterface
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        articles={articles}
        onStartGame={onStartGame}
        onChangeScenery={onChangeScenery}
        availableScenery={availableScenery}
        currentScenery={currentScenery}
      />
    </>
  );
}
