import React, { useState, useEffect, useRef } from 'react';
import { Text, Plane } from '@react-three/drei';
import * as THREE from 'three';

export interface ArticleData {
  length: number;
  filename: string;
  title: string;
  date: string;
  author: string[];
}

interface ArticleTextDisplayProps {
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  showArticles: boolean;
}

const ArticleTextDisplay: React.FC<ArticleTextDisplayProps> = ({ currentIndex, setCurrentIndex, showArticles }) => {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const groupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch('/api/articles');
        const data: ArticleData[] = await response.json();
        setArticles(data);
      } catch (error) {
        console.error("Failed to fetch articles:", error);
      }
    };

    fetchArticles();
  }, []);

  const navigateTo = (index: number) => {
    if (index >= 0 && index < articles.length) {
      setCurrentIndex(index);
    }
  };

  if (!showArticles || articles.length === 0) return null;
  const article = articles[currentIndex];

  return (
    <group ref={groupRef} position={[0, 1, -5]}>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[5, 3]} />
        <meshBasicMaterial color={'#f3f3f3'} side={THREE.DoubleSide} />
      </mesh>
      <Text fontSize={0.2} color="#000" maxWidth={4.5} lineHeight={1.1} anchorX="center" anchorY="middle" position={[0, 1, 0.1]}>
        {`Title: ${article.title}`}
      </Text>
      <Text fontSize={0.15} color="#000" maxWidth={4.5} lineHeight={1.1} anchorX="center" anchorY="middle" position={[0, 0.2, 0.1]}>
        {`Date: ${article.date}`}
      </Text>
      <Text fontSize={0.15} color="#000" maxWidth={4.5} lineHeight={1.1} anchorX="center" anchorY="middle" position={[0, -0.5, 0.1]}>
        {`Author: ${article.author.join(', ')}`}
      </Text>
      <Text fontSize={0.15} color="#000" anchorX="center" anchorY="middle" position={[-2.5, -1, 0.1]} onClick={() => navigateTo(currentIndex - 1)}>
        Prev
      </Text>
      <Text fontSize={0.15} color="#000" anchorX="center" anchorY="middle" position={[2.5, -1, 0.1]} onClick={() => navigateTo(currentIndex + 1)}>
        Next
      </Text>
    </group>
  );
};

export default ArticleTextDisplay;