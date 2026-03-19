/**
 * GalaxyScene - Main 3D scene for galaxy view
 * 
 * Composes:
 * - StarField background
 * - WorldNodes for each world
 * - ConstellationLines for connections
 * - GalaxyCamera for navigation
 * - Lighting
 */

import React, { useState, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import styled from 'styled-components';
import type { World } from '@/lib/galaxy/world-registry';
import { worldRegistry } from '@/lib/galaxy/world-registry';

import StarField from './StarField';
import WorldNode from './WorldNode';
import ConstellationLines from './ConstellationLines';
import GalaxyCamera, { useGalaxyCamera } from './GalaxyCamera';

// =============================================================================
// STYLES
// =============================================================================

const CanvasContainer = styled.div`
  position: fixed;
  inset: 0;
  background: #030308;
  z-index: 0;
`;

const UIOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  
  > * {
    pointer-events: auto;
  }
`;

const Header = styled.header`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 24px 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(to bottom, rgba(3, 3, 8, 0.9) 0%, transparent 100%);
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #fff;
  margin: 0;
  font-family: var(--font-mono, monospace);
  
  span {
    color: #00d4ff;
  }
`;

const Controls = styled.div`
  display: flex;
  gap: 12px;
`;

const Button = styled.button<{ $primary?: boolean }>`
  padding: 10px 20px;
  background: ${p => p.$primary ? 'linear-gradient(135deg, #00d4ff, #3b82f6)' : 'rgba(255, 255, 255, 0.1)'};
  border: 1px solid ${p => p.$primary ? 'transparent' : 'rgba(255, 255, 255, 0.2)'};
  color: #fff;
  font-family: var(--font-mono, monospace);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: ${p => p.$primary ? 'linear-gradient(135deg, #00d4ff, #3b82f6)' : 'rgba(255, 255, 255, 0.2)'};
    transform: translateY(-2px);
  }
`;

const InfoPanel = styled.div`
  position: absolute;
  bottom: 32px;
  left: 32px;
  max-width: 400px;
  padding: 24px;
  background: rgba(3, 3, 8, 0.9);
  border: 1px solid rgba(0, 212, 255, 0.2);
  backdrop-filter: blur(10px);
`;

const WorldTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 8px;
  text-transform: uppercase;
`;

const WorldDescription = styled.p`
  font-size: 0.95rem;
  color: #aaa;
  margin: 0 0 16px;
  line-height: 1.5;
`;

const WorldMeta = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  
  span {
    font-size: 0.75rem;
    font-family: var(--font-mono, monospace);
    text-transform: uppercase;
    color: #00d4ff;
    letter-spacing: 0.05em;
  }
`;

const Legend = styled.div`
  position: absolute;
  bottom: 32px;
  right: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: rgba(3, 3, 8, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.8rem;
  color: #aaa;
  font-family: var(--font-mono, monospace);
  text-transform: uppercase;
  
  &::before {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${p => p.color};
    box-shadow: 0 0 10px ${p => p.color};
  }
`;

// =============================================================================
// SCENE COMPONENT
// =============================================================================

function Scene() {
  const [hoveredWorld, setHoveredWorld] = useState<World | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<World | null>(null);
  
  const { mode, focusOnWorld, resetToOrbit } = useGalaxyCamera();
  
  // Get all worlds
  const worlds = useMemo(() => worldRegistry.getAll(), []);
  const bounds = useMemo(() => worldRegistry.getBounds(), []);

  const handleWorldClick = (world: World) => {
    if (selectedWorld?.id === world.id) {
      // Second click - enter the world
      window.location.href = world.entryPoint.url;
    } else {
      setSelectedWorld(world);
      focusOnWorld(world);
    }
  };

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 10]} intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={0.8} color="#00d4ff" distance={100} />
      
      {/* Background stars */}
      <StarField count={5000} bounds={bounds} />
      
      {/* Fallback stars for depth */}
      <Stars radius={300} depth={50} count={5000} factor={4} saturation={0.5} fade speed={1} />
      
      {/* Connection lines */}
      <ConstellationLines 
        worlds={worlds} 
        hoveredWorldId={hoveredWorld?.id}
        selectedWorldId={selectedWorld?.id}
      />
      
      {/* World nodes */}
      {worlds.map(world => (
        <WorldNode
          key={world.id}
          world={world}
          isSelected={selectedWorld?.id === world.id}
          isHovered={hoveredWorld?.id === world.id}
          onClick={handleWorldClick}
          onHover={setHoveredWorld}
        />
      ))}
      
      {/* Camera */}
      <GalaxyCamera 
        mode={mode} 
        targetWorld={selectedWorld}
      />
    </>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function GalaxyView() {
  const [hoveredWorld, setHoveredWorld] = useState<World | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<World | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const displayWorld = selectedWorld || hoveredWorld;

  return (
    <>
      <CanvasContainer>
        <Canvas
          camera={{ position: [80, 40, 80], fov: 60 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
        >
          <Suspense fallback={null}>
            <SceneContent 
              onWorldHover={setHoveredWorld}
              onWorldSelect={setSelectedWorld}
              selectedWorld={selectedWorld}
              hoveredWorld={hoveredWorld}
            />
          </Suspense>
        </Canvas>
      </CanvasContainer>

      <UIOverlay>
        <Header>
          <Title>
            Galaxy <span>View</span>
          </Title>
          <Controls>
            <Button onClick={() => setFilter(null)}>All</Button>
            <Button onClick={() => setFilter('fiction')}>Fiction</Button>
            <Button onClick={() => setFilter('research')}>Research</Button>
            <Button $primary onClick={() => window.location.href = '/'}>
              Return Home
            </Button>
          </Controls>
        </Header>

        {displayWorld && (
          <InfoPanel>
            <WorldTitle>{displayWorld.title}</WorldTitle>
            <WorldMeta>
              <span>{displayWorld.type}</span>
              <span>{displayWorld.theme}</span>
            </WorldMeta>
            <WorldDescription>{displayWorld.description}</WorldDescription>
            <Button 
              $primary 
              onClick={() => window.location.href = displayWorld.entryPoint.url}
            >
              Enter World →
            </Button>
          </InfoPanel>
        )}

        <Legend>
          <LegendItem color="#00d4ff">Immersive Scenes</LegendItem>
          <LegendItem color="#ffd700">Articles</LegendItem>
          <LegendItem color="#ff4757">Games</LegendItem>
          <LegendItem color="#a55eea">Memories</LegendItem>
        </Legend>
      </UIOverlay>
    </>
  );
}

// Scene content wrapper to share state
interface SceneContentProps {
  onWorldHover: (world: World | null) => void;
  onWorldSelect: (world: World | null) => void;
  selectedWorld: World | null;
  hoveredWorld: World | null;
}

function SceneContent({ onWorldHover, onWorldSelect, selectedWorld, hoveredWorld }: SceneContentProps) {
  const { mode, focusOnWorld, resetToOrbit } = useGalaxyCamera();
  const worlds = useMemo(() => worldRegistry.getAll(), []);
  const bounds = useMemo(() => worldRegistry.getBounds(), []);

  const handleWorldClick = (world: World) => {
    if (selectedWorld?.id === world.id) {
      window.location.href = world.entryPoint.url;
    } else {
      onWorldSelect(world);
      focusOnWorld(world);
    }
  };

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 10]} intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={0.8} color="#00d4ff" distance={100} />
      
      <StarField count={5000} bounds={bounds} />
      <Stars radius={300} depth={50} count={5000} factor={4} saturation={0.5} fade speed={1} />
      
      <ConstellationLines 
        worlds={worlds} 
        hoveredWorldId={hoveredWorld?.id}
        selectedWorldId={selectedWorld?.id}
      />
      
      {worlds.map(world => (
        <WorldNode
          key={world.id}
          world={world}
          isSelected={selectedWorld?.id === world.id}
          isHovered={hoveredWorld?.id === world.id}
          onClick={handleWorldClick}
          onHover={onWorldHover}
        />
      ))}
      
      <GalaxyCamera mode={mode} targetWorld={selectedWorld} />
    </>
  );
}

export default GalaxyView;
