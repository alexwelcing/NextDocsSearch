import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import styled from 'styled-components';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import * as THREE from 'three';

const shimmer = (w: number, h: number) => `
<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#333" offset="20%" />
      <stop stop-color="#222" offset="50%" />
      <stop stop-color="#333" offset="70%" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#333" />
  <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
  <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite"  />
</svg>`

const toBase64 = (str: string) =>
  typeof window === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str)

const PanelContainer = styled.div`
  width: 800px;
  height: 600px;
  background: rgba(10, 10, 16, 0.95);
  border: 1px solid rgba(100, 200, 255, 0.3);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  color: #e0e0ff;
  font-family: 'Courier New', monospace;
  box-shadow: 0 0 30px rgba(0, 100, 255, 0.2);
  backdrop-filter: blur(10px);
  overflow: hidden;
  pointer-events: auto;

  @keyframes shimmerAnimation {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(100, 200, 255, 0.2);
  padding-bottom: 10px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 24px;
  color: #00ffff;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #ff4444;
  cursor: pointer;
  font-size: 24px;
  &:hover {
    color: #ff8888;
  }
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  gap: 20px;
  overflow: hidden;
`;

const ImageContainer = styled.div`
  flex: 1;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const InfoContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
`;

const Description = styled.p`
  font-size: 16px;
  line-height: 1.5;
  color: #cccccc;
`;

const MetaData = styled.div`
  font-size: 12px;
  color: #8888aa;
  margin-top: auto;
`;

const Controls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding-top: 10px;
  border-top: 1px solid rgba(100, 200, 255, 0.2);
`;

const NavButton = styled.button`
  background: rgba(0, 50, 100, 0.5);
  border: 1px solid rgba(0, 200, 255, 0.5);
  color: #00ffff;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 100, 200, 0.5);
    box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PageIndicator = styled.span`
  font-size: 14px;
  color: #8888aa;
`;

interface ArticleDisplayPanelProps {
  articles: EnhancedArticleData[];
  isOpen: boolean;
  onClose: () => void;
}

export default function ArticleDisplayPanel({ articles, isOpen, onClose }: ArticleDisplayPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const groupRef = useRef<THREE.Group>(null);

  // Track when panel opens to prevent flicker
  const [panelReady, setPanelReady] = useState(false);

  // Floating animation parameters
  const floatParams = useMemo(() => ({
    baseX: 0,
    baseY: 4,
    baseZ: -6,
    floatAmplitudeX: 0.3,
    floatAmplitudeY: 0.15,
    floatSpeedX: 0.4,
    floatSpeedY: 0.6,
    rotationAmplitude: 0.02,
    rotationSpeed: 0.3,
  }), []);

  // Reset image loaded state when changing articles
  useEffect(() => {
    setImageLoaded(false);
  }, [currentIndex]);

  // Handle panel visibility with delay to prevent flicker
  useEffect(() => {
    if (isOpen && articles.length > 0) {
      // Small delay before showing to ensure state is ready
      const timer = setTimeout(() => {
        setPanelReady(true);
        setIsVisible(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      setPanelReady(false);
    }
  }, [isOpen, articles.length]);

  // Floating animation
  useFrame(({ clock }) => {
    if (!groupRef.current || !isVisible) return;

    const time = clock.getElapsedTime();

    // Smooth floating motion
    const floatX = Math.sin(time * floatParams.floatSpeedX) * floatParams.floatAmplitudeX;
    const floatY = Math.sin(time * floatParams.floatSpeedY) * floatParams.floatAmplitudeY;

    // Apply floating position
    groupRef.current.position.x = floatParams.baseX + floatX;
    groupRef.current.position.y = floatParams.baseY + floatY;
    groupRef.current.position.z = floatParams.baseZ;

    // Subtle rotation
    groupRef.current.rotation.y = Math.sin(time * floatParams.rotationSpeed) * floatParams.rotationAmplitude;
    groupRef.current.rotation.x = Math.cos(time * floatParams.rotationSpeed * 0.7) * (floatParams.rotationAmplitude * 0.5);
  });

  // Don't render until panel is ready to prevent flicker
  if (!panelReady || !isVisible || articles.length === 0) return null;

  const article = articles[currentIndex];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % articles.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + articles.length) % articles.length);
  };

  return (
    <group ref={groupRef} position={[floatParams.baseX, floatParams.baseY, floatParams.baseZ]}>
      <Html transform occlude position={[0, 0, 0]} style={{ width: '800px', height: '600px' }}>
        <PanelContainer>
          <Header>
            <Title>ARCHIVE_DISPLAY_MODE</Title>
            <CloseButton onClick={onClose}>
              <X size={24} />
            </CloseButton>
          </Header>

          <Content>
            <ImageContainer>
              {article.ogImage ? (
                <>
                  {/* Always show placeholder shimmer first */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(90deg, #333 0%, #444 50%, #333 100%)`,
                    backgroundSize: '200% 100%',
                    animation: imageLoaded ? 'none' : 'shimmerAnimation 1.5s infinite linear',
                    opacity: imageLoaded ? 0 : 1,
                    transition: 'opacity 0.3s ease-in-out',
                  }} />
                  <Image
                    src={article.ogImage}
                    alt={article.title}
                    fill
                    style={{
                      objectFit: 'cover',
                      opacity: imageLoaded ? 1 : 0,
                      transition: 'opacity 0.4s ease-in-out'
                    }}
                    onLoad={() => setImageLoaded(true)}
                  />
                </>
              ) : (
                <div style={{ color: '#666', fontFamily: 'monospace' }}>NO VISUAL DATA</div>
              )}
            </ImageContainer>
            <InfoContainer>
              <h3 style={{ margin: '0 0 10px 0', color: '#fff' }}>{article.title}</h3>
              <Description>{article.description}</Description>
              <MetaData>
                <div>DATE: {article.date}</div>
                <div>TYPE: {article.articleType?.toUpperCase()}</div>
                <div>HORIZON: {article.horizon}</div>
                <div>POLARITY: {article.polarity}</div>
              </MetaData>
            </InfoContainer>
          </Content>

          <Controls>
            <NavButton onClick={handlePrev}>
              <ArrowLeft size={16} /> PREV
            </NavButton>
            <PageIndicator>
              {currentIndex + 1} / {articles.length}
            </PageIndicator>
            <NavButton onClick={handleNext}>
              NEXT <ArrowRight size={16} />
            </NavButton>
          </Controls>
        </PanelContainer>
      </Html>
    </group>
  );
}
