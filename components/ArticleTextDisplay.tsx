import React, { useState, useEffect } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface ArticleData {
  filename: string;
  title: string;
  date: string;
  author: string[];
}

const ArticleTextDisplay: React.FC = () => {
  const [article, setArticle] = useState<ArticleData | null>(null);

  useEffect(() => {
    // Fetching the most recent article from the API
    async function fetchArticle() {
      try {
        const response = await fetch('/api/articles');
        const data: ArticleData[] = await response.json();
        setArticle(data[0]);
      } catch (error) {
        console.error("Failed to fetch articles:", error);
      }
    }

    fetchArticle();
  }, []);

  // You might want to add loading or error states here
  if (!article) return null;

  return (
    <group>
      {/* Background */}
      <mesh>
        <planeGeometry args={[4, 1]} />
        <meshBasicMaterial color={'#f3f3f3'} side={THREE.DoubleSide} />
      </mesh>

      {/* Text */}
      <Text
        fontSize={0.5}
        color="#000"
        maxWidth={4}  // Set max width for text
        lineHeight={1}
        position={[0, 0, 0.2]}  // Small offset to avoid z-fighting

        rotation={[0, 1, 0]}  // Rotate the text 45 degrees
      >
        {`Title: ${article.title}`}
      </Text>
    </group>
  )
};

export default ArticleTextDisplay;