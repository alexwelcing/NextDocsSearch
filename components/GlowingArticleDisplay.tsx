import React, { useState, useEffect, useRef } from 'react';
import { Text, Plane, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { ArticleData } from './ArticleTextDisplay';

interface GlowingArticleDisplayProps {
  article: ArticleData;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
}

const GlowingArticleDisplay: React.FC<GlowingArticleDisplayProps> = ({ article, currentIndex, setCurrentIndex }) => {
  const groupRef = useRef<THREE.Group | null>(null);

  const navigateTo = (index: number) => {
    if (index >= 0 && index < article.length) {
      setCurrentIndex(index);
    }
  };

  return (
    <group ref={groupRef} position={[0, 1, -5]}>
      {/* Main rounded rectangle for the article display */}
      <RoundedBox args={[5, 3, 0.5]} radius={0.2} smoothness={4}>
        <meshStandardMaterial color="white" />
      </RoundedBox>

      {/* Article Title */}

      <Text
        fontSize={0.5} // Increased font size for better visibility
        color="black" // Changed to black for contrast
        anchorX="center"
        anchorY="middle"
        position={[0, 0, 0.6]} // Moved slightly forward in the Z-axis to avoid Z-fighting
      >
        {`Title: ${article.title}`}
      </Text>

      {/* View Article Button */}
      <Text fontSize={0.15} color="#000" anchorX="center" anchorY="middle" position={[0, 0.5, 0.1]}>
        View Article
      </Text>

      {/* Article Date */}
      <Text fontSize={0.15} color="#000" maxWidth={4.5} lineHeight={1.1} anchorX="center" anchorY="middle" position={[0, 0, 0.1]}>
        {`Date: ${article.date}`}
      </Text>

      {/* Article Author */}
      <Text fontSize={0.15} color="#000" maxWidth={4.5} lineHeight={1.1} anchorX="center" anchorY="middle" position={[0, -0.5, 0.1]}>
        {`Author: ${article.author.join(', ')}`}
      </Text>

      {/* Previous Button */}
      <Text fontSize={0.15} color="#000" anchorX="center" anchorY="middle" position={[-2, -1.5, 0.1]} onClick={() => navigateTo(currentIndex - 1)}>
        Prev
      </Text>

      {/* Next Button */}
      <Text fontSize={0.15} color="#000" anchorX="center" anchorY="middle" position={[2, -1.5, 0.1]} onClick={() => navigateTo(currentIndex + 1)}>
        Next
      </Text>
    </group>
  );
};

export default GlowingArticleDisplay;
