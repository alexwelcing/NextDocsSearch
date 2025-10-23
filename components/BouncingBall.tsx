import React, { useCallback } from 'react';
import { useSphere } from '@react-three/cannon';
import { useThree } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';

const BouncingBall: React.FC = () => {
  const { viewport } = useThree();
  const [ref, api] = useSphere(() => ({
    mass: 1,
    position: [-10, 5, 0],
    args: [1],
    material: { restitution: 0.9 },
    linearDamping: 0.1,
    angularDamping: 0.1,
  }));

  const handleClick = useCallback(() => {
    api.applyForce([0, viewport.height * 100, 0], [0, 0, 0]);
  }, [api, viewport.height]);

  return (
    <Sphere
      ref={ref as any}
      args={[1, 16, 16]} // Reduced from 32x32 to 16x16 for better performance
      onClick={handleClick}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        attach="material"
        color="hotpink"
        roughness={0.5}
        metalness={0.5}
      />
    </Sphere>
  );
};

export default BouncingBall;
