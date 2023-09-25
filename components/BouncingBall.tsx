import React from 'react';
import { useSphere } from '@react-three/cannon';
import { useThree } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';

const BouncingBall: React.FC = () => {
  const { viewport } = useThree();
  const [ref, api] = useSphere(() => ({
    mass: 1,
    position: [10, 5, 0],
    args: [1],
    material: { restitution: 0.9 }
  }));

  const handleClick = () => {
    api.applyForce([0, viewport.height * 100, 0], [0, 0, 0]);
  };

  return (
    <Sphere
      ref={ref as any}
      args={[1, 32, 32]}
      onClick={handleClick}
      castShadow // This sphere will cast shadows
      receiveShadow // This sphere will also receive shadows
    >
      <meshStandardMaterial attach="material" color="hotpink" />
    </Sphere>
  );
};

export default BouncingBall;
