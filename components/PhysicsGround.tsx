import React from 'react';
import { Plane } from '@react-three/drei';
import { usePlane } from '@react-three/cannon';

const PhysicsGround: React.FC = () => {

  // Ground Plane
  usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -12.5, 0],
    material: { restitution: 0.9 }
  }));

  // Ceiling Plane
  usePlane(() => ({
    rotation: [Math.PI / 2, 0, 0],
    position: [0, 12.5, 0],
    material: { restitution: 0.9 }
  }));


  return (
    <>
      <Plane args={[30, 30]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -5.5, 0]} visible={false} />
      <Plane args={[30, 30]} rotation={[Math.PI / 2, 0, 0]} position={[0, 14.5, 0]} visible={false} />
      </>
  );
};

export default PhysicsGround;
