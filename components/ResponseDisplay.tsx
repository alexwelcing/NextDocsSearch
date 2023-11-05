import React, { useRef } from 'react';
import { Html, RoundedBox } from '@react-three/drei';
import { useSupabaseData } from './SupabaseDataContext';
import * as THREE from 'three';
import styles from '../styles/RetroComputerStyles.module.css'; // Ensure the path is correct

const ResponseDisplay: React.FC = () => {
  const { chatData } = useSupabaseData();
  const groupRef = useRef<THREE.Group | null>(null);

  // Convert 15 degrees to radians for the tilt
  const tiltRadians = THREE.MathUtils.degToRad(-70); // Negative for tilting backwards

  return (
    <group ref={groupRef} position={[12, -4, 0]} rotation={[Math.PI / -2, tiltRadians, Math.PI / -2]}>
      <RoundedBox args={[8, 4, 0.5]} radius={0.2} smoothness={4}>
        <meshStandardMaterial color="gray" />
      </RoundedBox>
      <Html position={[0, 0, 0.75]} transform occlude>
        <div className={styles.container}>
          <div className={styles.text}>
            {chatData.question}
          </div>
          <div className={styles.text}>
            {chatData.response}
          </div>
        </div>
      </Html>
    </group>
  );
};

export default ResponseDisplay;
