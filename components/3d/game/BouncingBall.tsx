import React, { useCallback } from 'react';
import { useSphere } from '@react-three/cannon';
import { useThree } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';

interface BouncingBallProps {
  onActivate?: () => void;
}

const BouncingBall: React.FC<BouncingBallProps> = ({ onActivate }) => {
  const { viewport } = useThree();
  const [ref, api] = useSphere(() => ({
    mass: 1,
    position: [0, 5, 0],
    args: [1],
    material: { restitution: 0.9 },
    linearDamping: 0.1,
    angularDamping: 0.1,
  }));

  const handleClick = useCallback(() => {
    // Apply force for visual feedback
    api.applyForce([0, viewport.height * 100, 0], [0, 0, 0]);
    // Trigger game activation
    if (onActivate) {
      onActivate();
    }
  }, [api, viewport.height, onActivate]);

  return (
    <Sphere
      ref={ref as any}
      args={[1, 12, 12]}
      onClick={handleClick}
    >
      <meshStandardMaterial
        attach="material"
        color="hotpink"
        roughness={0.3}
        metalness={0.7}
        emissive="hotpink"
        emissiveIntensity={0.5}
      />
    </Sphere>
  );
};

export default BouncingBall;
