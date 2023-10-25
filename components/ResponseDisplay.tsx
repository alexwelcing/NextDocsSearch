import React, { useRef } from 'react';
import { Text, RoundedBox } from '@react-three/drei';
import { useSupabaseData } from './SupabaseDataContext';
import * as THREE from 'three';

const ResponseDisplay: React.FC = () => {
  const { chatData } = useSupabaseData();
  const groupRef = useRef<THREE.Group | null>(null);

  return (
    <group ref={groupRef} position={[-10, 1, 3]} rotation={[0, Math.PI / 2, 0]}>
      <RoundedBox args={[10, 5, 0.5]} radius={0.2} smoothness={4}>
        <meshStandardMaterial color="gray" />
      </RoundedBox>
      <group position={[0, 1, 0.7]}>
        <Text fontSize={0.3} color="black" anchorX="center" textAlign='center' anchorY="middle" maxWidth={8}>
          {chatData.question}
        </Text>
      </group>
      <group position={[0, -1, 0.7]}>
        <Text fontSize={0.2} color="black" anchorX="center" textAlign='center' anchorY="middle" maxWidth={8}>
          {chatData.response}
        </Text>
      </group>
    </group>
  );
};

export default ResponseDisplay;
