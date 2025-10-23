import React, { useMemo } from 'react';
import { usePlane } from '@react-three/cannon';

const PhysicsGround: React.FC = () => {
  // Ground Plane - optimized with refs
  const [groundRef] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -12.5, 0],
    material: { restitution: 0.9, friction: 0.1 },
  }));

  // Ceiling Plane
  const [ceilingRef] = usePlane(() => ({
    rotation: [Math.PI / 2, 0, 0],
    position: [0, 12.5, 0],
    material: { restitution: 0.9, friction: 0.1 },
  }));

  // Create plane geometry once
  const planeGeometry = useMemo(() => {
    return <planeGeometry args={[30, 30]} />;
  }, []);

  return (
    <>
      {/* Ground plane - invisible but has physics */}
      <mesh ref={groundRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -5.5, 0]} visible={false}>
        {planeGeometry}
        <meshBasicMaterial />
      </mesh>

      {/* Ceiling plane - invisible but has physics */}
      <mesh ref={ceilingRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 14.5, 0]} visible={false}>
        {planeGeometry}
        <meshBasicMaterial />
      </mesh>
    </>
  );
};

export default PhysicsGround;
