'use client'

import React from 'react';
import { useSpring, animated, config } from '@react-spring/three';
import { Cylinder } from '@react-three/drei';

interface ArticleNavigationButtonProps {
  direction: 'next' | 'prev';
  disabled: boolean;
  onClick: () => void;
}

const ArticleNavigationButton: React.FC<ArticleNavigationButtonProps> = ({ direction, disabled, onClick }) => {
  const { scale } = useSpring({
    scale: disabled ? [0.8, 0.8, 0.8] : [1, 1, 1],
    config: config.wobbly,
  });

  return (
    <animated.group scale={scale as any} onPointerUp={onClick}>
      <Cylinder args={[0.5, 0.5, 0.2, 32]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={disabled ? 'gray' : 'blue'} />
      </Cylinder>
      <text fontSize={0.2}>
        {direction === 'next' ? '>' : '<'}
      </text>
    </animated.group>
  );
};

export default ArticleNavigationButton;
