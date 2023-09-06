import React, { useState, useEffect, useRef } from 'react';
import { Text, Plane } from '@react-three/drei';
import * as THREE from 'three';

export interface ArticleData {
  filename: string;
  title: string;
  date: string;
  author: string[];
}

interface ArticleTextDisplayProps {
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
}

const CircleButton: React.FC<any> = ({ label, position, onClick }) => (
  <group position={position} onClick={onClick}>
    <mesh>
      <circleGeometry args={[0.75, 32]} />
      <meshBasicMaterial color={'#de7ea2'} side={THREE.DoubleSide} />
    </mesh>
    <Text fontSize={0.15} color="#fff" anchorX="center" anchorY="middle">
      {label}
    </Text>
  </group>
);

const ArticleTextDisplay: React.FC<ArticleTextDisplayProps> = ({ currentIndex, setCurrentIndex }) => {
  const [articles, setArticles] = useState<ArticleData[]>([]);

  const groupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    async function fetchArticles() {
      try {
        const response = await fetch('/api/articles');
        const data: ArticleData[] = await response.json();
        setArticles(data);
      } catch (error) {
        console.error("Failed to fetch articles:", error);
      }
    }

    fetchArticles();
    if (groupRef.current) {
      groupRef.current.lookAt(new THREE.Vector3(0, 0, 0));
    }
  }, []);

  const navigateTo = (index: number) => {
    if (index >= 0 && index < articles.length) {
      setCurrentIndex(index);
    }
  }

  if (articles.length === 0) return null;
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

      <Text fontSize={0.15} color="#555" maxWidth={4.5} lineHeight={1.1} anchorX="center" anchorY="middle" position={[0, 0.2, 0.1]}>
        {`Date: ${article.date}`}
      </Text>

      <Text fontSize={0.15} color="#555" maxWidth={4.5} lineHeight={1.1} anchorX="center" anchorY="middle" position={[0, -0.5, 0.1]}>
        {`Author: ${article.author.join(', ')}`}
      </Text>

      <CircleButton
        label="Prev"
        position={[-3.5, 0, 0.1]}
        onClick={() => navigateTo(currentIndex - 1)}
      />
      <CircleButton
        label="Next"
        fontSize={1}
        position={[3.5, 0, 0.1]}
        onClick={() => navigateTo(currentIndex + 1)}
      />
    </group>
  );
};

export default ArticleTextDisplay;