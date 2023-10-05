import React, { useRef, useState } from 'react';
import { useSpring, animated, config, SpringValue } from '@react-spring/three';
import { Cylinder, Ring, Plane } from '@react-three/drei';
import { Html } from '@react-three/drei';
import { Vector3 } from 'three';

interface PowerButtonProps {
  toggleDisplay: () => void;
}

const PowerButton: React.FC<PowerButtonProps> = ({ toggleDisplay }) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const { scale } = useSpring({
    scale: pressed ? [0.8, 0.8, 0.8] : [1, 1, 1],
    config: config.wobbly,
  });

  const handlePointerOver = () => setHovered(true);
  const handlePointerOut = () => setHovered(false);
  const handlePointerDown = () => setPressed(true);
  const handlePointerUp = () => {
    setPressed(false);
    toggleDisplay();
  };

  return (
    <animated.group scale={scale as any}>
      <Cylinder args={[.5, 0.5, 0.2, 32]} position={[5, 0, 0.1]} rotation={[-Math.PI / 2, 0, 0]} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
        <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
      </Cylinder>
      <Ring args={[0.45, 0.5, 32]} position={[5, 0, 0.1]} >
        <meshStandardMaterial color="white" />
      </Ring>
      <Plane args={[0.4, 0.4]} position={[5, 0, 0.15]}>
        <Html center>
          <span className="material-icons-outlined" style={{ fontSize: '24px', color: 'white' }}>
            power_settings_new
          </span>
        </Html>
      </Plane>
    </animated.group>
  );
};

export default PowerButton;
