import React, { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { VRButton, XR, Controllers, Hands } from '@react-three/xr';
import styled, { css, keyframes } from 'styled-components';
import { Physics } from '@react-three/cannon';
import { OrbitControls, Html } from '@react-three/drei';
import PhysicsGround from './PhysicsGround';
import BouncingBall from './BouncingBall';
import BackgroundSphere from './BackgroundSphere';
import { ArticleData } from './ArticleTextDisplay';
import GlowingArticleDisplay from './GlowingArticleDisplay';
import StylishFallback from './StylishFallback';


const PhysicsEnvironment: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <Physics gravity={[0, -9.81, 0]}>{children}</Physics>;
};

const StyledButton = styled.button`
  background: #de7ea2;
  border: 3px solid #6a6699;
  opacity: 80%;
  color: white;
  cursor: pointer;
  font-size: 24px;
  border-radius: 10px;
  align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    transform: scale(1.05);
    background: #941947;
    opacity: 80%;
  }
`
const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const ThreeSixtyContainer = styled.div<{ isLoaded: boolean }>`
position: fixed;
z-index: 4;
bottom: 0;
left: 0;
  width: 100vw;
  height: 100vh;
  opacity: 0;
  transition: opacity 1s ease-in-out;

  ${(props) =>
    props.isLoaded &&
    css`
      animation: ${fadeIn} 1s ease-in-out forwards;
    `}
`;

interface ThreeSixtyProps {
  currentImage: string;
  isDialogOpen: boolean;
  onChangeImage: () => void;
}

const ThreeSixty: React.FC<ThreeSixtyProps> = ({ currentImage, isDialogOpen, onChangeImage }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showArticles, setShowArticles] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [articles, setArticles] = useState<ArticleData[]>([]);

  const fetchArticles = useCallback(async () => {
    try {
      const response = await fetch('/api/articles');
      const data: ArticleData[] = await response.json();
      setArticles(data);
      setIsLoaded(true);
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const toggleArticlesDisplay = useCallback(() => {
    setShowArticles((prev) => !prev);
  }, []);

  return (
    <ThreeSixtyContainer isLoaded={isLoaded}>
      <VRButton enterOnly={false} exitOnly={false} />
      <Canvas shadows>
        <XR>
          <PhysicsEnvironment>
            <Controllers />
            <Hands />
            <PhysicsGround />
            <OrbitControls />
            <BouncingBall />
            <BackgroundSphere imageUrl={currentImage} transitionDuration={0.5} />
            <ambientLight intensity={0.2} position={[-2, 10, 2]} />
            <GlowingArticleDisplay article={articles[currentIndex]} currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} showArticles={showArticles} title={''} totalArticles={articles.length} />
          </PhysicsEnvironment>
        </XR>
      </Canvas>
    </ThreeSixtyContainer>
  );
}

export default ThreeSixty;