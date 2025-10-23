import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XROrigin, XRSpace } from '@react-three/xr';
import styled, { css, keyframes } from 'styled-components';
import { Physics } from '@react-three/cannon';
import { OrbitControls } from '@react-three/drei';
import PhysicsGround from './PhysicsGround';
import BouncingBall from './BouncingBall';
import BackgroundSphere from './BackgroundSphere';
import GlowingArticleDisplay, { ArticleData } from './GlowingArticleDisplay';
import RoundedRectangle from './RoundedRectangle';
import ResponseDisplay from './ResponseDisplay';
import GaussianSplatBackground from './GaussianSplatBackground';

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

const VRButtonStyled = styled.button`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #8214a0;
  border: 3px solid #de7ea2;
  color: white;
  padding: 15px 30px;
  font-size: 18px;
  border-radius: 10px;
  cursor: pointer;
  z-index: 1000;
  transition: transform 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    transform: translateX(-50%) scale(1.05);
    background: #941947;
    box-shadow: 0 0 20px rgba(222, 126, 162, 0.5);
  }

  &:disabled {
    background: #666;
    cursor: not-allowed;
    opacity: 0.5;
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

const ThreeSixtyContainer = styled.div`
  position: fixed;
  z-index: 4;
  bottom: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  opacity: 1;
`;

interface ThreeSixtyProps {
  currentImage: string;
  isDialogOpen: boolean;
  onChangeImage: (newImage: string) => void;
}

const ThreeSixty: React.FC<ThreeSixtyProps> = ({ currentImage, isDialogOpen, onChangeImage }) => {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [useGaussianSplat, setUseGaussianSplat] = useState(false);

  // Create XR store for VR support
  const store = useMemo(() => createXRStore(), []);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch('/api/articles');
        const data: ArticleData[] = await response.json();
        setArticles(data);
      } catch (error) {
        console.error("Failed fetching articles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  const article = articles[currentIndex];

  const handleEnterVR = async () => {
    try {
      await store.enterVR();
    } catch (error) {
      console.error('Failed to enter VR:', error);
    }
  };

  return (
    <ThreeSixtyContainer>
      <VRButtonStyled onClick={handleEnterVR}>
        Enter VR
      </VRButtonStyled>
      <Canvas shadows>
        <XR store={store}>
          <XROrigin position={[0, 0, 0]}>
            <PhysicsEnvironment>
              <PhysicsGround />
              <OrbitControls />
              <BouncingBall />

              {/* Background: Use Gaussian Splat if enabled, otherwise use sphere */}
              {useGaussianSplat ? (
                <GaussianSplatBackground
                  splatUrl="/splats/background.splat"
                  position={[0, 0, 0]}
                  scale={1}
                />
              ) : (
                <BackgroundSphere imageUrl={currentImage} transitionDuration={0.5} />
              )}

              <ambientLight intensity={0.2} position={[-2, 10, 2]} />
              {!loading && (
                <GlowingArticleDisplay
                  articles={articles}
                  article={article}
                  currentIndex={currentIndex}
                  setCurrentIndex={setCurrentIndex}
                  showArticles={true}
                  title="Article Title Placeholder"
                  totalArticles={articles.length}
                />
              )}
              <RoundedRectangle />
              <ResponseDisplay />

              {/* XR Controllers - controller models will be automatically rendered by XR component */}
            </PhysicsEnvironment>
          </XROrigin>
        </XR>
      </Canvas>
    </ThreeSixtyContainer>
  );
};

export default ThreeSixty;