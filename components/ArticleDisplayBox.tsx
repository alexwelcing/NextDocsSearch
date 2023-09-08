import React, { useState } from 'react';
import { Box, Text, Cone } from '@react-three/drei';
import { ArticleData } from './ArticleTextDisplay';

interface ArticleDisplayBoxProps {
  article: ArticleData;
  handleNext: () => void;
  handlePrev: () => void;
}

const ArticleDisplayBox: React.FC<ArticleDisplayBoxProps> = ({ article, handleNext, handlePrev }) => {
  const boxWidth = 4;
  const boxHeight = 6;
  const boxDepth = 0.1;

  const [hoveredNext, setHoveredNext] = useState(false);
  const [hoveredPrev, setHoveredPrev] = useState(false);

  const titlePosition: [number, number, number] = [0, boxHeight / 4, boxDepth / 2 + 0.05];
  const datePosition: [number, number, number] = [0, -boxHeight / 4, boxDepth / 2 + 0.05];
  const linkPosition: [number, number, number] = [0, -boxHeight / 3, boxDepth / 2 + 0.1];

  const nextConePosition: [number, number, number] = [boxWidth / 2 + 0.3, 0, 0];
  const prevConePosition: [number, number, number] = [-boxWidth / 2 - 0.3, 0, 0];

  return (
    <group>
      <Box args={[boxWidth, boxHeight, boxDepth]}>
        <meshStandardMaterial attach="material" color="white" />
        <Text fontSize={0.2} color="black" position={titlePosition} anchorX="center" anchorY="middle">
          {article.title}
        </Text>
        <Text fontSize={0.15} color="black" position={datePosition} anchorX="center" anchorY="middle">
          Date: {article.date}
        </Text>
        <Text
          fontSize={0.15}
          color="blue"
          position={linkPosition}
          anchorX="center"
          anchorY="middle"
          onClick={() => window.open(`/articles/${article.filename.replace('.mdx', '')}`, '_blank')}
        >
          View Article
        </Text>
      </Box>
      <group onClick={handleNext} onPointerOver={() => setHoveredNext(true)} onPointerOut={() => setHoveredNext(false)} position={nextConePosition}>
        <Cone args={[.5, 2, 32]} rotation={[0, 0, 0]}>
          <meshStandardMaterial attach="material" color={hoveredNext ? '#ffff00' : 'green'} />
        </Cone>
      </group>
      <group onClick={handlePrev} onPointerOver={() => setHoveredPrev(true)} onPointerOut={() => setHoveredPrev(false)} position={prevConePosition}>
        <Cone args={[.5, 2, 32]} rotation={[0, Math.PI, 0]}>
          <meshStandardMaterial attach="material" color={hoveredPrev ? '#ffff00' : 'red'} />
        </Cone>
      </group>
    </group>
  );
};

export default ArticleDisplayBox;
