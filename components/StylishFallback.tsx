import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box, Text, OrbitControls, Stars } from '@react-three/drei';
import styled from 'styled-components';

const SpinningCube: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    meshRef.current.rotation.x = Math.sin(clock.getElapsedTime());
    meshRef.current.rotation.y = Math.sin(clock.getElapsedTime());
  });

  return (
    <Box args={[1, 1, 1]} castShadow ref={meshRef}>
      <meshStandardMaterial color={'hotpink'} emissive={'#8214a0'} emissiveIntensity={0.5} />
    </Box>
  );
};

const LoadingText = styled(Text)`
  color: white;
  fontSize: 2;
  maxWidth: 200;
  lineHeight: 1;
  letterSpacing: 0.01;
  textAlign: 'center';
`;

const StylishFallback: React.FC = () => {
  return (
    <div className="fallback-container">
      <Canvas style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.3} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
        <OrbitControls />
        <SpinningCube />
      </Canvas>
      <style jsx>{`
        .fallback-container {
          position: relative;
          width: 100vw;
          height: 100vh;
          background-color: #000;
        }
      `}</style>
    </div>
  );
};

export default StylishFallback;
