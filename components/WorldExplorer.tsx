/**
 * World Explorer - Main component orchestrating 2D/3D navigation
 *
 * Manages transition between:
 * - 2D Space Navigator (arcade view)
 * - 3D 360 World View (immersive view with fog reveal)
 *
 * Smooth camera interpolation for zoom in/out
 */

import React, { useState, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import SpaceNavigator from './SpaceNavigator';
import FogRevealSphere from './FogRevealSphere';
import { WORLDS, getWorldById } from '../config/worlds';
import { useTrophy } from './TrophyContext';

type ViewMode = 'space' | 'world' | 'transitioning';

interface WorldExplorerProps {
  isMobile?: boolean;
  onArticleSelect?: (slug: string, worldId: number) => void;
  initialWorldId?: number | null; // For returning from article view
}

export const WorldExplorer: React.FC<WorldExplorerProps> = ({
  isMobile = false,
  onArticleSelect,
  initialWorldId = null,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(initialWorldId ? 'world' : 'space');
  const [selectedWorldId, setSelectedWorldId] = useState<number | null>(initialWorldId);
  const [transitionProgress, setTransitionProgress] = useState(initialWorldId ? 1 : 0);
  const { getWorldProgress } = useTrophy();

  // Handle world selection from 2D space view
  const handleWorldSelect = useCallback((worldId: number) => {
    try {
      console.log('World selected:', worldId);
      const world = getWorldById(worldId);
      if (!world) {
        console.error('World not found:', worldId);
        return;
      }

      console.log('Loading world:', world.name);
      setSelectedWorldId(worldId);
      setViewMode('transitioning');

      // Animate transition
      let progress = 0;
      const startTime = Date.now();
      const duration = 1000; // 1 second transition

      const animate = () => {
        const elapsed = Date.now() - startTime;
        progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-in-out)
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        setTransitionProgress(eased);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          console.log('Transition complete, switching to world view');
          setViewMode('world');
        }
      };

      requestAnimationFrame(animate);
    } catch (error) {
      console.error('Error selecting world:', error);
    }
  }, []);

  // Handle exit from world view back to space
  const handleExitWorld = useCallback(() => {
    setViewMode('transitioning');

    let progress = 1;
    const startTime = Date.now();
    const duration = 1200;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.max(1 - elapsed / duration, 0);

      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      setTransitionProgress(eased);

      if (progress > 0) {
        requestAnimationFrame(animate);
      } else {
        setViewMode('space');
        setSelectedWorldId(null);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  const selectedWorld = selectedWorldId ? getWorldById(selectedWorldId) : null;

  // Debug logging
  console.log('WorldExplorer render:', {
    viewMode,
    selectedWorldId,
    selectedWorld: selectedWorld?.name,
    transitionProgress,
  });

  return (
    <Container>
      {/* 2D Space Navigator */}
      <SpaceView $visible={viewMode === 'space'} $opacity={1 - transitionProgress}>
        <SpaceNavigator onWorldSelect={handleWorldSelect} isMobile={isMobile} />
      </SpaceView>

      {/* 3D World View */}
      {selectedWorld && (
        <WorldView $visible={viewMode !== 'space'} $opacity={transitionProgress}>
          <Canvas
            camera={{ position: [0, 0, 0.1], fov: isMobile ? 70 : 60 }}
            dpr={isMobile ? [0.5, 1] : [1, 2]}
            onCreated={() => console.log('Canvas created successfully')}
            onError={(error) => {
              console.error('Canvas error:', error);
            }}
          >
            <React.Suspense fallback={<LoadingIndicator />}>
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} />

              {/* Article markers in 3D space - render before sphere */}
              {selectedWorld.articles.map((article) => (
                <ArticleMarker
                  key={article.slug}
                  article={article}
                  worldColor={selectedWorld.color}
                  onClick={() => {
                    console.log('Article clicked:', article.slug);
                    onArticleSelect?.(article.slug, selectedWorld.id);
                  }}
                />
              ))}

              <FogRevealSphere world={selectedWorld} />

              <OrbitControls
                enableZoom={false}
                enablePan={false}
                enableDamping={true}
                dampingFactor={0.05}
                rotateSpeed={isMobile ? 0.3 : 0.5}
                minPolarAngle={0}
                maxPolarAngle={Math.PI}
                makeDefault
              />
            </React.Suspense>
          </Canvas>

          {/* UI Overlay for world view */}
          <WorldOverlay>
            <BackButton onClick={handleExitWorld}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Back</span>
            </BackButton>

            {viewMode === 'transitioning' && (
              <LoadingText>Entering {selectedWorld.name}...</LoadingText>
            )}

            {viewMode === 'world' && (
              <>
                <WorldInfo>
                  <WorldName>{selectedWorld.name}</WorldName>
                  <WorldDescription>{selectedWorld.description}</WorldDescription>
                  <ProgressBar>
                    <ProgressFill
                      $percentage={getWorldProgress(selectedWorld.id).percentage}
                      $color={selectedWorld.color}
                    />
                    <ProgressText>
                      {getWorldProgress(selectedWorld.id).read} / {getWorldProgress(selectedWorld.id).total} articles
                    </ProgressText>
                  </ProgressBar>
                </WorldInfo>
                <ArticleHint>Tap the glowing orbs to read articles</ArticleHint>
              </>
            )}
          </WorldOverlay>
        </WorldView>
      )}
    </Container>
  );
};

// Loading Indicator for Suspense
const LoadingIndicator: React.FC = () => {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffffff" />
    </mesh>
  );
};

// Article Marker Component (3D floating orbs at article positions)
interface ArticleMarkerProps {
  article: {
    slug: string;
    phi: number;
    theta: number;
    radius: number;
  };
  worldColor: string;
  onClick: () => void;
  articleTitle?: string;
}

const ArticleMarker: React.FC<ArticleMarkerProps> = ({ article, worldColor, onClick, articleTitle }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { progress } = useTrophy();

  // Check if this article has been read
  const isRead = progress.articlesRead.includes(article.slug);

  // Convert spherical to Cartesian coordinates (positioned closer to camera)
  const radius = 8; // Closer than the sphere (sphere is at 15)
  const x = radius * Math.sin(article.phi) * Math.cos(article.theta);
  const y = radius * Math.cos(article.phi);
  const z = radius * Math.sin(article.phi) * Math.sin(article.theta);

  // Generate a short title for display
  const displayTitle = articleTitle
    ? articleTitle.length > 40
      ? articleTitle.substring(0, 37) + '...'
      : articleTitle
    : article.slug.replace(/-/g, ' ');

  return (
    <group position={[x, y, z]}>
      {/* Main orb */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial
          color={isRead ? '#00ff00' : worldColor}
          transparent
          opacity={isRead ? 1.0 : 0.8}
          emissive={isRead ? '#00ff00' : worldColor}
          emissiveIntensity={isRead ? 0.8 : 0.5}
        />
      </mesh>

      {/* Ring indicator for unread */}
      {!isRead && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.6, 0.05, 8, 32]} />
          <meshStandardMaterial
            color={worldColor}
            emissive={worldColor}
            emissiveIntensity={0.3}
          />
        </mesh>
      )}

      {/* Checkmark for read articles */}
      {isRead && (
        <mesh position={[0, 0, 0.6]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={1.0}
          />
        </mesh>
      )}

      {/* Article title label */}
      <Html
        position={[0, -1, 0]}
        center
        distanceFactor={10}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <ArticleLabel $isRead={isRead}>
          {displayTitle}
        </ArticleLabel>
      </Html>
    </group>
  );
};

// Styled Components

const Container = styled.div`
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: #000308;
`;

const SpaceView = styled.div<{ $visible: boolean; $opacity: number }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: ${(props) => props.$opacity};
  pointer-events: ${(props) => (props.$visible ? 'auto' : 'none')};
  transition: opacity 0.3s ease;
`;

const WorldView = styled.div<{ $visible: boolean; $opacity: number }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: ${(props) => (props.$visible ? Math.max(props.$opacity, 0.01) : 0)};
  pointer-events: ${(props) => (props.$visible ? 'auto' : 'none')};
  display: ${(props) => (props.$visible ? 'block' : 'none')};
`;

const WorldOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
`;

const LoadingText = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 24px;
  font-weight: bold;
  text-align: center;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);

  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

const BackButton = styled.button`
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 14px;
  font-family: Arial, sans-serif;
  cursor: pointer;
  pointer-events: auto;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.9);
    border-color: rgba(255, 255, 255, 0.4);
  }

  svg {
    width: 20px;
    height: 20px;
  }

  @media (max-width: 768px) {
    top: 10px;
    left: 10px;
    padding: 10px 16px;
    font-size: 12px;

    span {
      display: none;
    }
  }
`;

const WorldInfo = styled.div`
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  color: white;
  pointer-events: none;
  max-width: 600px;
  padding: 0 20px;

  @media (max-width: 768px) {
    bottom: 60px;
    max-width: 90%;
  }
`;

const ArticleHint = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  text-align: center;
  pointer-events: none;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);

  @media (max-width: 768px) {
    font-size: 12px;
    bottom: 10px;
  }
`;

const ArticleLabel = styled.div<{ $isRead: boolean }>`
  background: ${props => props.$isRead
    ? 'rgba(0, 255, 0, 0.9)'
    : 'rgba(0, 0, 0, 0.8)'};
  color: ${props => props.$isRead ? '#000' : '#fff'};
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: ${props => props.$isRead ? 'bold' : 'normal'};
  white-space: nowrap;
  text-align: center;
  border: 2px solid ${props => props.$isRead ? '#00ff00' : 'rgba(255, 255, 255, 0.3)'};
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
`;

const WorldName = styled.h2`
  font-size: 32px;
  font-weight: bold;
  margin: 0 0 8px 0;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);

  @media (max-width: 768px) {
    font-size: 24px;
  }
`;

const WorldDescription = styled.p`
  font-size: 14px;
  margin: 0 0 16px 0;
  opacity: 0.8;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);

  @media (max-width: 768px) {
    font-size: 12px;
    margin: 0 0 12px 0;
  }
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
`;

const ProgressFill = styled.div<{ $percentage: number; $color: string }>`
  width: ${(props) => props.$percentage}%;
  height: 100%;
  background: ${(props) => props.$color};
  border-radius: 3px;
  transition: width 0.5s ease;
  box-shadow: 0 0 10px ${(props) => props.$color};
`;

const ProgressText = styled.div`
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
`;

export default WorldExplorer;
