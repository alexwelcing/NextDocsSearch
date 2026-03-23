/**
 * 3D Room Exploration Page
 * Procedural room generation with physics and navigation
 */

import React, { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Stats } from '@react-three/drei';
import styled from 'styled-components';
import { useRoomStore } from '@/lib/rooms/store';
import { RoomSceneRenderer } from '@/components/3d/rooms/RoomRenderer';
import { PhysicsWorld } from '@/components/3d/physics/PhysicsWorld';
import { NavigationSystem } from '@/components/3d/navigation/NavigationSystem';
import { generatePresetLevel, generateLevel } from '@/lib/rooms/generator';
import { LevelConfig, GeneratedLevel } from '@/lib/rooms/types';
import { ArrowLeft, RefreshCw, Play, Pause, Eye, Box } from 'lucide-react';
import Link from 'next/link';

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const PageContainer = styled.div`
  min-height: 100vh;
  background: #030308;
  color: white;
`;

const Header = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(3, 3, 8, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h1`
  font-size: 1.25rem;
  font-weight: 600;
  background: linear-gradient(135deg, #00d4ff, #ffd700);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Controls = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'ghost' }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  
  ${(props) => {
    switch (props.$variant) {
      case 'primary':
        return `
          background: linear-gradient(135deg, #00d4ff, #0099cc);
          color: white;
          &:hover { opacity: 0.9; }
        `;
      case 'ghost':
        return `
          background: transparent;
          color: rgba(255, 255, 255, 0.7);
          &:hover { background: rgba(255, 255, 255, 0.1); color: white; }
        `;
      default:
        return `
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
          &:hover { background: rgba(255, 255, 255, 0.15); }
        `;
    }
  }}
`;

const Sidebar = styled.aside`
  position: fixed;
  top: 72px;
  left: 0;
  bottom: 0;
  width: 280px;
  background: rgba(3, 3, 8, 0.95);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  padding: 24px;
  overflow-y: auto;
  z-index: 50;
`;

const Section = styled.div`
  margin-bottom: 24px;
`;

const SectionTitle = styled.h3`
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 12px;
`;

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`;

const PresetButton = styled.button<{ $active?: boolean }>`
  padding: 12px;
  background: ${(props) => props.$active ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
  border: 1px solid ${(props) => props.$active ? 'rgba(0, 212, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'};
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  
  &:hover {
    background: rgba(0, 212, 255, 0.1);
    border-color: rgba(0, 212, 255, 0.3);
  }
`;

const ToggleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
`;

const Toggle = styled.button<{ $active?: boolean }>`
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: ${(props) => props.$active ? 'rgba(0, 212, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)'};
  border: none;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  
  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: ${(props) => props.$active ? '22px' : '2px'};
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    transition: all 0.2s;
  }
`;

const CanvasContainer = styled.div`
  position: fixed;
  top: 72px;
  left: 280px;
  right: 0;
  bottom: 0;
  
  canvas {
    display: block;
  }
`;

const InfoPanel = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: rgba(3, 3, 8, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  min-width: 200px;
  z-index: 50;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  margin-bottom: 4px;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  span:first-child {
    color: rgba(255, 255, 255, 0.5);
  }
`;

// =============================================================================
// SCENE COMPONENT
// =============================================================================

interface SceneProps {
  level: GeneratedLevel | null;
}

const Scene: React.FC<SceneProps> = ({ level }) => {
  const showGizmos = useRoomStore((state) => state.showGizmos);
  const showNavMesh = useRoomStore((state) => state.showNavMesh);
  const showColliders = useRoomStore((state) => state.showColliders);
  
  return (
    <PhysicsWorld enabled={true}>
      <NavigationSystem autoGenerate={true}>
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        
        {/* Grid */}
        <Grid
          args={[50, 50]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#444466"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#666688"
          fadeDistance={25}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid={true}
        />
        
        {/* Room Scene */}
        <RoomSceneRenderer />
        
        {/* Camera Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={50}
          target={[0, 2, 0]}
        />
        
        {/* Stats */}
        <Stats />
      </NavigationSystem>
    </PhysicsWorld>
  );
};

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function RoomExplorerPage() {
  const [level, setLevel] = useState<GeneratedLevel | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('simple');
  
  // Editor state from store
  const showGizmos = useRoomStore((state) => state.showGizmos);
  const showNavMesh = useRoomStore((state) => state.showNavMesh);
  const showColliders = useRoomStore((state) => state.showColliders);
  const toggleGizmos = useRoomStore((state) => state.toggleGizmos);
  const toggleNavMesh = useRoomStore((state) => state.toggleNavMesh);
  const toggleColliders = useRoomStore((state) => state.toggleColliders);
  const loadLevel = useRoomStore((state) => state.loadLevel);
  const nodes = useRoomStore((state) => state.nodes);
  
  // Generate level
  const generateNewLevel = useCallback((preset: string) => {
    setIsGenerating(true);
    setActivePreset(preset);
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const newLevel = generatePresetLevel(preset as any);
      setLevel(newLevel);
      loadLevel(newLevel);
      setIsGenerating(false);
    }, 100);
  }, [loadLevel]);
  
  // Initial generation
  useEffect(() => {
    if (!level && !isGenerating) {
      generateNewLevel('simple');
    }
  }, [level, isGenerating, generateNewLevel]);
  
  // Calculate stats
  const nodeCount = Object.keys(nodes).length;
  const roomCount = Object.values(nodes).filter((n) => n.type === 'room').length;
  
  return (
    <PageContainer>
      <Head>
        <title>3D Room Explorer | NextDocsSearch</title>
        <meta name="description" content="Procedural 3D room generation with physics and navigation" />
      </Head>
      
      <Header>
        <Title>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            <ArrowLeft size={20} />
          </Link>
          3D Room Explorer
        </Title>
        
        <Controls>
          <Button 
            $variant="secondary" 
            onClick={() => generateNewLevel(activePreset)}
            disabled={isGenerating}
          >
            <RefreshCw size={16} className={isGenerating ? 'animate-spin' : ''} />
            Regenerate
          </Button>
        </Controls>
      </Header>
      
      <Sidebar>
        <Section>
          <SectionTitle>Level Presets</SectionTitle>
          <PresetGrid>
            <PresetButton
              $active={activePreset === 'simple'}
              onClick={() => generateNewLevel('simple')}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Simple</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>3 rooms</div>
            </PresetButton>
            <PresetButton
              $active={activePreset === 'complex'}
              onClick={() => generateNewLevel('complex')}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Complex</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>8 rooms</div>
            </PresetButton>
            <PresetButton
              $active={activePreset === 'maze'}
              onClick={() => generateNewLevel('maze')}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Maze</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>15 rooms</div>
            </PresetButton>
          </PresetGrid>
        </Section>
        
        <Section>
          <SectionTitle>Visualization</SectionTitle>
          <ToggleRow>
            <span>Show Gizmos</span>
            <Toggle $active={showGizmos} onClick={toggleGizmos} />
          </ToggleRow>
          <ToggleRow>
            <span>Show NavMesh</span>
            <Toggle $active={showNavMesh} onClick={toggleNavMesh} />
          </ToggleRow>
          <ToggleRow>
            <span>Show Colliders</span>
            <Toggle $active={showColliders} onClick={toggleColliders} />
          </ToggleRow>
        </Section>
        
        <Section>
          <SectionTitle>Features</SectionTitle>
          <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: 8 }}>
              <strong style={{ color: '#00d4ff' }}>CrashCat Physics:</strong>
              <br />Real-time rigid body simulation with collision detection.
            </p>
            <p style={{ marginBottom: 8 }}>
              <strong style={{ color: '#00d4ff' }}>NavCat Navigation:</strong>
              <br />AI pathfinding with navmesh generation.
            </p>
            <p>
              <strong style={{ color: '#00d4ff' }}>Procedural Generation:</strong>
              <br />Dynamic room layouts with configurable complexity.
            </p>
          </div>
        </Section>
        
        <Section>
          <SectionTitle>Literary Levels</SectionTitle>
          <Link 
            href="/explore/article-levels"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(255, 215, 0, 0.05))',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              borderRadius: '8px',
              color: 'white',
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>📚</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Explore Literary Levels</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                3 unique levels based on articles
              </div>
            </div>
          </Link>
        </Section>
      </Sidebar>
      
      <CanvasContainer>
        <Canvas
          shadows
          camera={{ position: [15, 10, 15], fov: 60 }}
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={['#030308']} />
          <fog attach="fog" args={['#030308', 10, 50]} />
          <Scene level={level} />
        </Canvas>
      </CanvasContainer>
      
      <InfoPanel>
        <InfoRow>
          <span>Nodes:</span>
          <span>{nodeCount}</span>
        </InfoRow>
        <InfoRow>
          <span>Rooms:</span>
          <span>{roomCount}</span>
        </InfoRow>
        <InfoRow>
          <span>Seed:</span>
          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {level?.metadata.seed?.slice(0, 16) || 'N/A'}
          </span>
        </InfoRow>
      </InfoPanel>
    </PageContainer>
  );
}
