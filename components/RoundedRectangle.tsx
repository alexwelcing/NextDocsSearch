import React, { useRef, useState, useEffect } from 'react';
import { Html, RoundedBox, Text } from '@react-three/drei';
import { useSupabaseData } from './contexts/SupabaseDataContext';
import styles from '../styles/RetroComputerStyles.module.css';
import { useCompletion } from 'ai/react';
import * as THREE from 'three';

const RoundedRectangle: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const { setChatData } = useSupabaseData();
  const [query, setQuery] = useState<string>('');
  const { complete, completion, isLoading, error } = useCompletion({
    api: '/api/vector-search',
  });

  // State to keep track of the dimensions of the rounded box
  const [roundedBoxSize, setRoundedBoxSize] = useState<{ width: number; height: number }>({
    width: 2,
    height: 1.5,
  });

  const tiltRadians = THREE.MathUtils.degToRad(-70);

  useEffect(() => {
    if (completion && !error) {
      setChatData((prevData) => ({ ...prevData, response: completion }));
    }
  }, [completion, error, setChatData]);

  useEffect(() => {
    if (textAreaRef.current) {
      // Reset height and width to shrink if text is deleted or to grow otherwise
      textAreaRef.current.style.height = '100px';
      textAreaRef.current.style.width = '400px';
      const newHeight = textAreaRef.current.scrollHeight;
      const newWidth = textAreaRef.current.scrollWidth;
      textAreaRef.current.style.height = `${newHeight}px`;
      textAreaRef.current.style.width = `${newWidth}px`;
      // Update the state for the rounded box size
      setRoundedBoxSize({
        width: Math.max(2, newWidth / 100), // Convert px to "world" units, adjust scale as needed
        height: Math.max(1.5, newHeight / 100), // Convert px to "world" units, adjust scale as needed
      });
    }
  }, [query]);

  const handleSubmit = () => {
    if (query.trim()) {
      complete(query);
      setChatData({ question: query, response: '' });
    }
  };

  const handleKeyPress: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent the default action to avoid line breaks on Enter key
      handleSubmit();
    }
  };

  // Adjust the position of the button relative to the HTML content
  const buttonPosition = {
    x: 2.5, // Right of the HTML content
    y: 2.5, // Bottom of the HTML content
    z: 1.5, // Slightly in front of the HTML plane
  };

  return (
    <group ref={groupRef} position={[12, -6, 5]} rotation={[Math.PI / -2, tiltRadians, Math.PI / -2]}>
      <Html position={[-4.5, 2.2, 0.26]} transform occlude>
        <div className={styles.container}>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className={styles.searchForm}>
            <textarea
              ref={textAreaRef}
              placeholder="Ask a question..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className={`${styles.input} ${styles.searchInput}`}
              style={{ width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}
            />
          </form>
        </div>
      </Html>
      {/* 3D Send Button */}
      <RoundedBox
        args={[3, 2, 0.1]} // Use dynamic size
        radius={0.1}
        rotation={[0, 0, 0]}
        smoothness={4}
        position={[buttonPosition.x, buttonPosition.y, buttonPosition.z]}
        onClick={handleSubmit}
      >
        <meshStandardMaterial attach="material" color="black" />
        <Text
          fontSize={0.4}
          color="lime"
          anchorX="center"
          anchorY="middle"
          position={[0, 0, 0.2]}
        >
          Send
        </Text>
      </RoundedBox>
    </group>
  );
};

export default RoundedRectangle;