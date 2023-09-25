import React, { useRef } from 'react';
import { Text, RoundedBox, useHelper, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ArticleData } from './ArticleTextDisplay';

interface GlowingArticleDisplayProps {
  article: ArticleData;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  showArticles: boolean;
  title: string;
  totalArticles: number;
}

const GlowingArticleDisplay: React.FC<GlowingArticleDisplayProps> = ({ article, currentIndex, setCurrentIndex, title, showArticles, totalArticles }) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const lightRef = useRef<THREE.PointLight | null>(null);

  return (
    <group ref={groupRef} position={[0, 1, -5]}>
      <RoundedBox args={[8, 5, 0.5]} radius={0.2} smoothness={4}>
        <meshStandardMaterial color={showArticles ? "white" : "gray"} />
      </RoundedBox>

      {showArticles && (
        <pointLight ref={lightRef} position={[0, 0, 0.6]} intensity={1} />
      )}

      {showArticles && article && (
        <>
          <Text fontSize={0.3} color="black" anchorX="center" textAlign='center' anchorY="middle" position={[0, 0, 0.6]} maxWidth={4}>
            {`${article.title}`}
          </Text>

          <Text
            fontSize={0.3}
            color="black"
            position={[0, -0.8, 0.6]}
            anchorX="center"
            anchorY="middle"
            onClick={() => window.open(`/articles/${article.filename.replace('.mdx', '')}`, '_blank')}
          >
            View Article
          </Text>
        </>
      )}

      {showArticles && (
        <>
          <Html position={[-3.5, -1.4, 0.6]}>
            <button className={currentIndex === 0 ? "text-slate-600 text-2xl" : "text-sky-600 text-2xl"} disabled={currentIndex === 0} onClick={() => setCurrentIndex(currentIndex - 1)}>&#60;</button>
          </Html>

          <Html position={[2.8, -1.4, 0.6]}>
            <button className={currentIndex === 4 ? "text-slate-600 text-2xl" : "text-sky-600 text-2xl"} disabled={currentIndex === 4 } onClick={() => setCurrentIndex(currentIndex + 1)}>&#62;</button>
          </Html>
        </>
      )}
    </group>
  );
};

export default GlowingArticleDisplay;
