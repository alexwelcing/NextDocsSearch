import React, { useRef } from 'react';
import { Text, RoundedBox } from '@react-three/drei';
import { useSupabaseData } from './SupabaseDataContext';
import * as THREE from 'three';

const ResponseDisplay: React.FC = () => {
  const { chatData } = useSupabaseData();
  const groupRef = useRef<THREE.Group | null>(null);
  const lightRef = useRef<THREE.PointLight | null>(null);

  return (
    <group ref={groupRef} position={[-8, 1, 3]} rotation={[0, Math.PI / 2, 0]}>
      <RoundedBox args={[8, 5, 0.5]} radius={0.2} smoothness={4}>
        <meshStandardMaterial color="gray" />
       {/** <pointLight ref={lightRef} position={[-8, 1, 3]} intensity={0.5} /> */}
      </RoundedBox>
      <Text fontSize={0.3} color="black" anchorX="center" textAlign='center' anchorY="middle" position={[0, 0, 0.7]} maxWidth={4}>
        {`${chatData.question}`}
      </Text>
      <Text fontSize={0.3} color="black" anchorX="center" textAlign='center' anchorY="middle" position={[0, -1, 0.7]} maxWidth={4}>
        {`${chatData.response}`}
      </Text>
    </group>
  );
};

export default ResponseDisplay;
