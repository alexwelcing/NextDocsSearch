import React, { useMemo, useState, useEffect } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { TextureLoader, AmbientLight, PointLight } from 'three';
import * as THREE from 'three';
import { OrbitControls, Html, Sphere } from '@react-three/drei';
import { VRButton, XR, Controllers, Hands } from '@react-three/xr';
import styled from '../node_modules/styled-components';
import ArticleControls from './ArticleControls';
import { Physics } from '@react-three/cannon';
import PhysicsGround from './PhysicsGround';
import BouncingBall from './BouncingBall';
import BackgroundSphere from './BackgroundSphere';
import { ArticleData } from './ArticleTextDisplay';
import GlowingArticleDisplay from './GlowingArticleDisplay';


const PhysicsEnvironment: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <Physics gravity={[0, -9.81, 0]}>{children}</Physics>;
};

const StyledButton = styled.button`
  padding: 8px 8px;
  background: #de7ea2;
  border: 3px solid #6a6699;
  opacity: 80%;
  color: white;
  cursor: pointer;
  font-size: 24px;
  border-radius: 10px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    transform: scale(1.05);
    background: #941947;
    opacity: 80%;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.6);
  }

  &:active {
    transform: scale(0.95);
  }
`

interface ThreeSixtyProps {
  currentImage: string
  isDialogOpen: boolean
  onChangeImage: () => void
}

function ThreeSixty({ currentImage, isDialogOpen, onChangeImage }: ThreeSixtyProps) {
  const [showArticles, setShowArticles] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const toggleArticlesDisplay = () => {
    setShowArticles((prev) => !prev);
  };

  const [articles, setArticles] = useState<ArticleData[]>([]);

  useEffect(() => {
    async function fetchArticles() {
      const response = await fetch('/api/articles');
      const data: ArticleData[] = await response.json();
      setArticles(data);
    }
    fetchArticles();
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
            <BouncingBall />
            <BackgroundSphere imageUrl={currentImage} transitionDuration={.5} />
            <primitive object={new AmbientLight(0xffffff, 0.5)} />
            <primitive object={new PointLight(0xffffff, 1, 100)} position={[0, 5, 10]} castShadow />
            <OrbitControls enableZoom={false} />
            {showArticles && articles.length > 0 && (
              <GlowingArticleDisplay article={articles[currentIndex]} currentIndex={0} setCurrentIndex={function (index: number): void {
                throw new Error('Function not implemented.');
              } } />
        )}
            <Html position={[28, -4, -9]} center>
              <StyledButton onClick={onChangeImage}>Next destination?</StyledButton>
            </Html>
            <Html position={[8, -3, 3]} center>
              <StyledButton onClick={toggleArticlesDisplay}>
                {showArticles ? 'Hide Articles' : 'Show Articles'}
              </StyledButton>
            </Html>
          </PhysicsEnvironment>
        </XR>
      </Canvas>
    </>
  );
}

export default ThreeSixty;