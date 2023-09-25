import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { VRButton, XR, Controllers, Hands } from '@react-three/xr';
import styled from 'styled-components';
import { Physics } from '@react-three/cannon';
import { OrbitControls, Html } from '@react-three/drei';
import PhysicsGround from './PhysicsGround';
import BouncingBall from './BouncingBall';
import BackgroundSphere from './BackgroundSphere';
import { ArticleData } from './ArticleTextDisplay';
import GlowingArticleDisplay from './GlowingArticleDisplay';

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
interface ThreeSixtyProps {
  currentImage: string;
  isDialogOpen: boolean;
  onChangeImage: () => void;
}

function ThreeSixty({ currentImage, isDialogOpen, onChangeImage }: ThreeSixtyProps) {
  const [showArticles, setShowArticles] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [articles, setArticles] = useState<ArticleData[]>([]);

  const fetchArticles = useCallback(async () => {
    const response = await fetch('/api/articles');
    const data: ArticleData[] = await response.json();
    setArticles(data);
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const toggleArticlesDisplay = useCallback(() => {
    setShowArticles((prev) => !prev);
  }, []);

  return (
    <>
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
            <Html position={[0, -1.8, -3]} center>
              <StyledButton onClick={toggleArticlesDisplay}>
                <span className="material-icons-outlined">
                  power_settings_new
                </span>
              </StyledButton>
            </Html>
          </PhysicsEnvironment>
        </XR>
      </Canvas>
    </>
  );
}

export default ThreeSixty;