import React, { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
// XR imports removed - API changed significantly in @react-three/xr v6
import styled, { css, keyframes } from 'styled-components';
import { Physics } from '@react-three/cannon';
import { OrbitControls } from '@react-three/drei';
import PhysicsGround from './PhysicsGround';
import BouncingBall from './BouncingBall';
import BackgroundSphere from './BackgroundSphere';
import GlowingArticleDisplay, { ArticleData } from './GlowingArticleDisplay';
import RoundedRectangle from './RoundedRectangle';
import ResponseDisplay from './ResponseDisplay'

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

  return (
    <ThreeSixtyContainer>
      {/* VR support temporarily removed - @react-three/xr v6 has breaking API changes */}
      <Canvas shadows>
        <PhysicsEnvironment>
          <PhysicsGround />
            <OrbitControls />
            <BouncingBall />
            <BackgroundSphere imageUrl={currentImage} transitionDuration={0.5} />
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
          </PhysicsEnvironment>
      </Canvas>
    </ThreeSixtyContainer>
  );
};

export default ThreeSixty;