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
}

interface LinkButtonProps {
  filename: string;
  position: [number, number, number];
}

const LinkButton: React.FC<LinkButtonProps> = ({ filename, position }) => {
  const [hovered, setHover] = useState(false);

  return (
    <group
      position={position}
      onClick={() => window.open(`/articles/${filename.replace('.mdx', '')}`, '_blank')}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <mesh>
        <planeGeometry args={[1.2, 0.6]} />
        <meshBasicMaterial color={hovered ? '#0074d9' : '#4a90e2'} side={THREE.DoubleSide} />
      </mesh>
      <Text fontSize={0.2} color={hovered ? '#f3f3f3' : "#fff"} anchorX="center" anchorY="middle">
        View Article
      </Text>
    </group>
  );
};

const CircleButton: React.FC<any> = ({ label, position, onClick }) => {
  const [hovered, setHover] = useState(false); // Add this state

  return (
    <group
      position={position}
      onClick={onClick}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <mesh>
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial color={hovered ? '#ff69b4' : '#de7ea2'} side={THREE.DoubleSide} />
      </mesh>
      <Text fontSize={0.25} color={hovered ? "#fff" : "#000"} anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
};

const ArticleTextDisplay: React.FC<ArticleTextDisplayProps> = ({ currentIndex, setCurrentIndex }) => {
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

      <LinkButton filename={article.filename} position={[0, 0.6, 0.1]} />

      <Text fontSize={0.15} color="#000" maxWidth={4.5} lineHeight={1.1} anchorX="center" anchorY="middle" position={[0, 0.2, 0.1]}>
        {`Date: ${article.date}`}
      </Text>

      <Text fontSize={0.15} color="#000" maxWidth={4.5} lineHeight={1.1} anchorX="center" anchorY="middle" position={[0, -0.5, 0.1]}>
        {`Author: ${article.author.join(', ')}`}
      </Text>

      <CircleButton
        label="Prev"
        position={[-3.5, 0, 0.1]}
        onClick={() => navigateTo(currentIndex - 1)}
      />
      <CircleButton
        label="Next"
        position={[3.5, 0, 0.1]}
        onClick={() => navigateTo(currentIndex + 1)}
      />
    </group>
  );
};

export default ArticleTextDisplay;
