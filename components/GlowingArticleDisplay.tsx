import React, { useRef } from 'react';
import { Text, RoundedBox, Html, Cylinder, Plane } from '@react-three/drei';
import { useSpring, animated, config } from '@react-spring/three';
import { ArticleData } from './ArticleTextDisplay';
import PowerButton from './PowerButton';
import ArticleNavigationButton from './ArticleNavigationButton';

interface GlowingArticleDisplayProps {
  article: ArticleData;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  showArticles: boolean;
  title: string;
  totalArticles: number;
}

const GlowingArticleDisplay: React.FC<GlowingArticleDisplayProps> = ({
  article,
  currentIndex,
  setCurrentIndex,
  showArticles,
  title,
  totalArticles,
}) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const lightRef = useRef<THREE.PointLight | null>(null);

  const toggleArticlesDisplay = () => {
  };

  const { scale } = useSpring({
    scale: showArticles ? [1, 1, 1] : [0.8, 0.8, 0.8],
    config: config.wobbly,
  });

  return (
    <group ref={groupRef} position={[0, 1, -5]}>
      <RoundedBox args={[8, 5, 0.5]} radius={0.2} smoothness={4}>
        <meshStandardMaterial color={showArticles ? 'white' : 'gray'} />
      </RoundedBox>

      {showArticles && (
        <pointLight ref={lightRef} position={[0, 0, 0.6]} intensity={1} />
      )}

      {showArticles && article && (
        <>
          <Text fontSize={0.3} color="black" anchorX="center" textAlign="center" anchorY="middle" position={[0, 0, 0.6]} maxWidth={4}>
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

      <PowerButton toggleDisplay={toggleArticlesDisplay} />
    </group>
  );
};

export default GlowingArticleDisplay;