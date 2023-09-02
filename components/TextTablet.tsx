import { Text, Plane, RoundedBox } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';

interface TextTabletProps {
  text: string;
  isVisible: boolean;
  onClose: () => void;
}

const TextTablet: React.FC<TextTabletProps> = ({ text, isVisible, onClose }) => {
    const ref = useRef<THREE.Group>(null);
    const { scene, camera, gl } = useThree();
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const [scrollOffset, setScrollOffset] = useState(0);

    useEffect(() => {
      const handleClick = (event: MouseEvent) => {
        if (!isVisible) return;

        mouse.x = (event.clientX / gl.domElement.clientWidth) * 2 - 1;
        mouse.y = - (event.clientY / gl.domElement.clientHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects.length === 0 || !intersects.some(intersect => intersect.object === ref.current)) {
          onClose();
        }
      };

      window.addEventListener('click', handleClick);

      return () => {
        window.removeEventListener('click', handleClick);
      };
    }, [isVisible, onClose, camera, gl.domElement.clientHeight, gl.domElement.clientWidth, scene.children]);

    useFrame(() => {
      if (ref.current) {
        ref.current.rotation.y += 0.005;
      }
    });

  return (
    <group visible={isVisible} ref={ref} position={[0, 1, -5]}>
      {/* Enhanced rectangle for the tablet with a subtle shadow */}
      <RoundedBox args={[2, 3, 0.05]} radius={0.1} smoothness={4} position={[0, 0, 0]}>
        <meshBasicMaterial color="#333" />
        <meshStandardMaterial attach="material" color="white" />
      </RoundedBox>

      {/* 3D Text from `drei` */}
      <Text
        position={[0, 1.5 - scrollOffset, 0.1]} // Adjusting position based on scroll offset
        anchorX="center"
        anchorY="top"
        fontSize={0.1}
        maxWidth={1.8}
        lineHeight={1}
        letterSpacing={0.02}
        whiteSpace="normal"
        onSync={(actualHeight) => {
          if (actualHeight > 3) {
            setScrollOffset((actualHeight - 3) * 0.5);  // Adjusting the text scroll offset if the text height is greater than the tablet's height
          }
        }}
      >
        {text}
      </Text>

      {/* Exit Icon */}
      <Text
        fontSize={0.2}
        position={[0.9, 1.4, 0.1]}
        color="#FF4B4B"
        anchorX="right"
        anchorY="top"
        onClick={onClose}
      >
        ✖️
      </Text>
    </group>
  );
};

export default TextTablet;
