import React, { useRef, useState, useEffect } from 'react';
import { Html, RoundedBox, Plane, Text } from '@react-three/drei';
import { useSupabaseData } from './SupabaseDataContext';
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

  // This rotation will make the RoundedRectangle face upwards towards the user
  const tiltRadians = THREE.MathUtils.degToRad(-70);
  const groupRotation: [number, number, number] = [Math.PI, tiltRadians, Math.PI]; // 90 degrees rotation around Z-axis

  useEffect(() => {
    if (completion && !error) {
      setChatData((prevData) => ({ ...prevData, response: completion }));
    }
  }, [completion, error, setChatData]);

  useEffect(() => {
    if (textAreaRef.current) {
      // Update the textarea and box size based on its contents
      textAreaRef.current.style.height = '100px';
      textAreaRef.current.style.width = '400px';
      const newHeight = textAreaRef.current.scrollHeight;
      const newWidth = textAreaRef.current.scrollWidth;
      textAreaRef.current.style.height = `${newHeight}px`;
      textAreaRef.current.style.width = `${newWidth}px`;
      setRoundedBoxSize({
        width: Math.max(2, newWidth / 100), // Adjust scale as needed
        height: Math.max(1.5, newHeight / 100), // Adjust scale as needed
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
      e.preventDefault(); // Prevent default action to avoid line breaks on Enter
      handleSubmit();
    }
  };

  // The position should be adjusted to position the RoundedRectangle below the ResponseDisplay
  const groupPosition: [number, number, number] = [10, -4, 1]; // Example coordinates

  return (
    <group ref={groupRef} position={groupPosition} rotation={groupRotation}>
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
            />
          </form>
        </div>
      </Html>
      {/* 3D Send Button */}
      <RoundedBox
        args={[roundedBoxSize.width, roundedBoxSize.height, 0.1]} // Dynamic size based on the state
        radius={0.1}
        smoothness={4}
        position={[0, 0, 0.1]} // Adjust this position so the Send button is properly placed
        onClick={handleSubmit}
      >
        <meshStandardMaterial attach="material" color="black" />
        <Text
          fontSize={0.4}
          color="lime"
          anchorX="center"
          anchorY="middle"
          position={[0, 0, 0.05]} // Adjust this position so the text is properly placed
        >
          Send
        </Text>
      </RoundedBox>
    </group>
  );
};

export default RoundedRectangle;
