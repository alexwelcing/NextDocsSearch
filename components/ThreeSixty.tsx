'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { VRButton, XR, Controllers, Hands } from '@react-three/xr';
import styled, { css, keyframes } from 'styled-components';
import { Physics } from '@react-three/cannon';
import { OrbitControls } from '@react-three/drei';
import PhysicsGround from './PhysicsGround';
import BouncingBall from './BouncingBall';
import BackgroundSphere from './BackgroundSphere';
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
  const [currentIndex, setCurrentIndex] = useState(0); // Index for the current article

  return (
    <ThreeSixtyContainer>
      <VRButton enterOnly={false} exitOnly={false} />
      <Canvas shadows>
        <XR>
          <PhysicsEnvironment>
            <Controllers />
            <Hands />
            <PhysicsGround />
            <OrbitControls />
            <BouncingBall />
            <GlowingArticleDisplay
              currentIndex={currentIndex}  // Pass the current index state
              setCurrentIndex={setCurrentIndex}  // Pass the function to change the index
              showArticles={true}
              title="Article Title Placeholder"
              totalArticles={5} // Placeholder for the total number of articles
            />
            <BackgroundSphere
              imageUrl={currentImage}
              transitionDuration={0.5}
            />
            <ambientLight intensity={0.2} position={[-2, 10, 2]} />
          </PhysicsEnvironment>
        </XR>
      </Canvas>
    </ThreeSixtyContainer>
  );
};

export default ThreeSixty;