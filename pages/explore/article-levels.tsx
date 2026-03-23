/**
 * Article-Based Level Showcase
 * Three unique levels generated from library articles
 */

import React, { useState, useCallback } from 'react';
import Head from 'next/head';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Stars, Stats } from '@react-three/drei';
import styled, { keyframes } from 'styled-components';
import Link from 'next/link';
import { useRoomStore } from '@/lib/rooms/store';
import { RoomSceneRenderer, StaticLevelRenderer } from '@/components/3d/rooms/RoomRenderer';
import { PhysicsWorld } from '@/components/3d/physics/PhysicsWorld';
import { NavigationSystem } from '@/components/3d/navigation/NavigationSystem';
import { 
  generateCartographerLevel, 
  generateMyceliumLevel, 
  generateTemporalPrisonLevel,
  levelDescriptions,
  type LevelId
} from '@/lib/rooms/article-levels';
import { GeneratedLevel } from '@/lib/rooms/types';
import { MapPin, Leaf, Clock, ArrowLeft, Play, RefreshCw, BookOpen } from 'lucide-react';

// =============================================================================
// ANIMATIONS
// =============================================================================

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const PageContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #030308 0%, #0a0a1a 50%, #030308 100%);
  color: white;
`;

const Hero = styled.section`
  padding: 60px 24px 40px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  font-size: 0.875rem;
  margin-bottom: 24px;
  transition: color 0.2s;
  
  &:hover {
    color: #00d4ff;
  }
`;

const Title = styled.h1`
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 800;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #00d4ff, #ffd700, #ff6b35);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const Subtitle = styled.p`
  font-size: 1.125rem;
  color: rgba(255, 255, 255, 0.6);
  max-width: 600px;
  margin: 0 auto;
`;

const LevelGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 24px;
  padding: 40px 24px;
  max-width: 1400px;
  margin: 0 auto;
`;

const LevelCard = styled.div<{ $theme?: 'blue' | 'green' | 'red' }>`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s;
  animation: ${fadeIn} 0.6s ease-out;
  
  ${props => props.$theme === 'blue' && `
    border-color: rgba(0, 212, 255, 0.3);
    &:hover { border-color: rgba(0, 212, 255, 0.6); box-shadow: 0 0 30px rgba(0, 212, 255, 0.2); }
  `}
  
  ${props => props.$theme === 'green' && `
    border-color: rgba(144, 238, 144, 0.3);
    &:hover { border-color: rgba(144, 238, 144, 0.6); box-shadow: 0 0 30px rgba(144, 238, 144, 0.2); }
  `}
  
  ${props => props.$theme === 'red' && `
    border-color: rgba(255, 0, 0, 0.3);
    &:hover { border-color: rgba(255, 0, 0, 0.6); box-shadow: 0 0 30px rgba(255, 0, 0, 0.2); }
  `}
`;

const CardHeader = styled.div<{ $theme?: 'blue' | 'green' | 'red' }>`
  padding: 24px;
  background: linear-gradient(135deg, 
    ${props => props.$theme === 'blue' ? 'rgba(0, 212, 255, 0.1)' : 
      props.$theme === 'green' ? 'rgba(144, 238, 144, 0.1)' : 
      'rgba(255, 0, 0, 0.1)'} 0%, 
    transparent 100%
  );
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
`;

const CardTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const CardTagline = styled.p`
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
`;

const CardBody = styled.div`
  padding: 24px;
`;

const CardDescription = styled.p`
  font-size: 0.9375rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 20px;
`;

const MetaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
`;

const MetaItem = styled.div`
  text-align: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
`;

const MetaValue = styled.div`
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
`;

const MetaLabel = styled.div`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const SourceArticle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  
  a {
    color: #00d4ff;
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
`;

const ActionButton = styled.button<{ $theme?: 'blue' | 'green' | 'red' }>`
  width: 100%;
  padding: 14px;
  background: ${props => props.$theme === 'blue' ? 'linear-gradient(135deg, #00d4ff, #0099cc)' : 
    props.$theme === 'green' ? 'linear-gradient(135deg, #90ee90, #228b22)' : 
    'linear-gradient(135deg, #ff0000, #cc0000)'};
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }
`;

const FeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 20px 0;
`;

const FeatureItem = styled.li`
  padding: 6px 0;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  
  &:before {
    content: '◆';
    color: rgba(255, 255, 255, 0.3);
    margin-right: 8px;
  }
`;

// =============================================================================
// 3D PREVIEW COMPONENT
// =============================================================================

const PreviewContainer = styled.div`
  height: 200px;
  background: #000;
  position: relative;
  overflow: hidden;
`;

// Preview scene for cards (uses StaticLevelRenderer - no store dependency)
const PreviewScene3D: React.FC<{ level: GeneratedLevel | null }> = ({ level }) => {
  if (!level) return null;
  
  return (
    <PhysicsWorld enabled={false}>
      <NavigationSystem autoGenerate={false}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <StaticLevelRenderer nodes={level.nodes} />
        <OrbitControls 
          enableZoom={false} 
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </NavigationSystem>
    </PhysicsWorld>
  );
};

// Full scene for active level (uses RoomSceneRenderer - reads from store)
const FullScene3D: React.FC = () => {
  return (
    <PhysicsWorld enabled={true}>
      <NavigationSystem autoGenerate={true}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
        <RoomSceneRenderer />
        <OrbitControls 
          enableZoom={true} 
          enablePan={true}
          autoRotate={false}
        />
      </NavigationSystem>
    </PhysicsWorld>
  );
};

// =============================================================================
// LEVEL CARD COMPONENT
// =============================================================================

interface LevelCardProps {
  levelId: LevelId;
  onLoad: (level: GeneratedLevel) => void;
}

const LevelCardComponent: React.FC<LevelCardProps> = ({ levelId, onLoad }) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [previewLevel, setPreviewLevel] = React.useState<GeneratedLevel | null>(null);
  
  const desc = levelDescriptions[levelId];
  const theme = levelId === 'cartographer' ? 'blue' : levelId === 'mycelium' ? 'green' : 'red';
  const Icon = levelId === 'cartographer' ? MapPin : levelId === 'mycelium' ? Leaf : Clock;
  
  const handleLoad = useCallback(() => {
    setIsLoading(true);
    
    setTimeout(() => {
      let level: GeneratedLevel;
      
      switch (levelId) {
        case 'cartographer':
          level = generateCartographerLevel();
          break;
        case 'mycelium':
          level = generateMyceliumLevel();
          break;
        case 'temporalPrison':
          level = generateTemporalPrisonLevel();
          break;
      }
      
      onLoad(level);
      setIsLoading(false);
    }, 500);
  }, [levelId, onLoad]);
  
  React.useEffect(() => {
    // Generate a preview level
    let level: GeneratedLevel;
    switch (levelId) {
      case 'cartographer':
        level = generateCartographerLevel();
        break;
      case 'mycelium':
        level = generateMyceliumLevel();
        break;
      case 'temporalPrison':
        level = generateTemporalPrisonLevel();
        break;
    }
    setPreviewLevel(level);
  }, [levelId]);
  
  return (
    <LevelCard $theme={theme}>
      <PreviewContainer>
        <Canvas camera={{ position: [10, 8, 10], fov: 50 }}>
          <color attach="background" args={['#050508']} />
          <PreviewScene3D level={previewLevel} />
        </Canvas>
      </PreviewContainer>
      
      <CardHeader $theme={theme}>
        <CardTitle>
          <Icon size={24} />
          {desc.name}
        </CardTitle>
        <CardTagline>&ldquo;{desc.tagline}&rdquo;</CardTagline>
      </CardHeader>
      
      <CardBody>
        <CardDescription>{desc.description}</CardDescription>
        
        <MetaGrid>
          <MetaItem>
            <MetaValue>{desc.difficulty}</MetaValue>
            <MetaLabel>Difficulty</MetaLabel>
          </MetaItem>
          <MetaItem>
            <MetaValue>{desc.roomCount}</MetaValue>
            <MetaLabel>Rooms</MetaLabel>
          </MetaItem>
          <MetaItem>
            <MetaValue>3D</MetaValue>
            <MetaLabel>Physics</MetaLabel>
          </MetaItem>
        </MetaGrid>
        
        <FeatureList>
          {desc.id === 'cartographer' && (
            <>
              <FeatureItem>Glass observation decks</FeatureItem>
              <FeatureItem>Neural pathway corridors</FeatureItem>
              <FeatureItem>Cognitive void spaces</FeatureItem>
            </>
          )}
          {desc.id === 'mycelium' && (
            <>
              <FeatureItem>Bioluminescent chambers</FeatureItem>
              <FeatureItem>Root-woven corridors</FeatureItem>
              <FeatureItem>Planetary consciousness nodes</FeatureItem>
            </>
          )}
          {desc.id === 'temporal' && (
            <>
              <FeatureItem>Time fracture zones</FeatureItem>
              <FeatureItem>Holographic barriers</FeatureItem>
              <FeatureItem>Reality distortion chambers</FeatureItem>
            </>
          )}
        </FeatureList>
        
        <SourceArticle>
          <BookOpen size={16} />
          Based on:{" "}
          <Link href={`/articles/${desc.articleSlug}`}>
            {desc.articleSlug.split('-').slice(0, 4).join('-')}...
          </Link>
        </SourceArticle>
        
        <ActionButton $theme={theme} onClick={handleLoad} disabled={isLoading}>
          {isLoading ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Play size={18} />
              Explore Level
            </>
          )}
        </ActionButton>
      </CardBody>
    </LevelCard>
  );
};

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function ArticleLevelsPage() {
  const [activeLevel, setActiveLevel] = useState<GeneratedLevel | null>(null);
  const loadLevel = useRoomStore((state) => state.loadLevel);
  
  const handleLoadLevel = useCallback((level: GeneratedLevel) => {
    loadLevel(level);
    setActiveLevel(level);
  }, [loadLevel]);
  
  return (
    <PageContainer>
      <Head>
        <title>Article-Based Levels | NextDocsSearch</title>
        <meta name="description" content="Explore 3D levels generated from articles in the library" />
      </Head>
      
      <Hero>
        <BackLink href="/explore/rooms">
          <ArrowLeft size={18} />
          Back to Room Explorer
        </BackLink>
        
        <Title>Literary Levels</Title>
        <Subtitle>
          Three unique 3D environments procedurally generated from articles in the library. 
          Each level captures the essence, atmosphere, and themes of its source material.
        </Subtitle>
      </Hero>
      
      {activeLevel ? (
        <div style={{ padding: '24px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '24px',
            padding: '0 24px'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{activeLevel.name}</h2>
              <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.5)' }}>
                Based on: {activeLevel.metadata?.articleTitle}
              </p>
            </div>
            <button
              onClick={() => setActiveLevel(null)}
              style={{
                padding: '10px 20px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Choose Another Level
            </button>
          </div>
          
          <div style={{ height: '70vh', borderRadius: '12px', overflow: 'hidden' }}>
            <Canvas camera={{ position: [15, 12, 15], fov: 60 }}>
              <color attach="background" args={['#030308']} />
              <fog attach="fog" args={['#030308', 10, 50]} />
              <FullScene3D />
              <Grid
                args={[50, 50]}
                cellSize={1}
                cellColor="#444466"
                sectionColor="#666688"
                fadeDistance={25}
                infiniteGrid
              />
            </Canvas>
          </div>
        </div>
      ) : (
        <LevelGrid>
          <LevelCardComponent 
            levelId="cartographer" 
            onLoad={handleLoadLevel} 
          />
          <LevelCardComponent 
            levelId="mycelium" 
            onLoad={handleLoadLevel} 
          />
          <LevelCardComponent 
            levelId="temporalPrison" 
            onLoad={handleLoadLevel} 
          />
        </LevelGrid>
      )}
    </PageContainer>
  );
}
