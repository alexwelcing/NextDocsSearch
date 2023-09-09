import React, { useState } from 'react';
import { Cone } from '@react-three/drei';

interface ArrowButtonProps {
  direction: 'next' | 'prev';
  onClick: () => void;
  position?: [number, number, number];
}

const ArrowButton: React.FC<ArrowButtonProps> = ({ direction, onClick, position }) => {
  const [hovered, setHovered] = useState(false);

  const handlePointerOver = () => setHovered(true);
  const handlePointerOut = () => setHovered(false);

  return (
    <group
      onClick={onClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      position={position}
    >
      <Cone args={[0.2, 0.5, 32]} rotation={[0, direction === 'next' ? 0 : Math.PI, 0]}>
        <meshStandardMaterial
          attach="material"
          color={hovered ? '#ffff00' : (direction === 'next' ? 'green' : 'red')}
        />
      </Cone>
    </group>
  );
};

export default ArrowButton;
