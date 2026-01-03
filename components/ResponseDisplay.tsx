import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Text, RoundedBox, Plane } from '@react-three/drei';
import { useSupabaseData } from './contexts/SupabaseDataContext';
import * as THREE from 'three';

const ResponseDisplay: React.FC = () => {
  const { chatData } = useSupabaseData();
  const groupRef = useRef<THREE.Group | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [backHovered, setBackHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);

  // Define the dimensions of the RoundedBox
  const boxWidth = 10;
  const boxHeight = 8;
  const boxDepth = 0.5;

  // Maximum number of lines per page
  const maxLinesPerPage = 10;

  // Break the response into lines
  const lines = useMemo(() => chatData.response.match(/.{1,50}(\s|$)/g) || [], [chatData.response]);

  // Calculate the number of pages
  const pageCount = Math.ceil(lines.length / maxLinesPerPage);

  // Reset the current page to 0 when the response changes
  useEffect(() => {
    setCurrentPage(0);
  }, [chatData.response]);

  // Get the lines for the current page
  const linesForCurrentPage = lines.slice(currentPage * maxLinesPerPage, (currentPage + 1) * maxLinesPerPage);

  // Function to handle page changes
  const nextPage = () => {
    if (currentPage < pageCount - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const isNextAvailable = currentPage < pageCount - 1;
  const isBackAvailable = currentPage > 0;

  return (
    <group ref={groupRef} position={[10, 3, 1]} rotation={[Math.PI / -2, Math.PI / -2, Math.PI / -2]}>
      <RoundedBox args={[boxWidth, boxHeight, boxDepth]} radius={0.2} smoothness={4}>
        <meshStandardMaterial color="gray" />
      </RoundedBox>
      <group position={[-(boxWidth / 2) + 0.5, 0, 0.7]}>
        <Text
          fontSize={0.4}
          color="black"
          anchorX="left"
          textAlign='left'
          anchorY="middle"
          maxWidth={boxWidth - 1}
        >
          {linesForCurrentPage.join('')}
        </Text>
      </group>

      {/* Pagination controls */}
      <group position={[0, -(boxHeight / 2 - 0.5), 0.7]}>
        {/* "Back" Button */}
        <Plane
          args={[1, 0.5]}
          position={[-2, 0, .2]}
          onClick={prevPage}
          onPointerOver={() => setBackHovered(true)}
          onPointerOut={() => setBackHovered(false)}
        >
          <meshStandardMaterial color={backHovered && isBackAvailable ? "#de7ea2" : (!isBackAvailable ? '#212820' : '#1E88E5')} />
          <Text fontSize={0.3} color="white" anchorX="center" textAlign='center' anchorY="middle">
            Prev
          </Text>
        </Plane>
        {/* "Next" Button */}
        <Plane
          args={[1, 0.5]}
          position={[2, 0, .2]}
          onClick={nextPage}
          onPointerOver={() => setNextHovered(true)}
          onPointerOut={() => setNextHovered(false)}
        >
          <meshStandardMaterial color={nextHovered && isNextAvailable ? "#de7ea2" : (!isNextAvailable ? '#212820' : '#1E88E5')} />
          <Text fontSize={0.3} color="white" anchorX="center" textAlign='center' anchorY="middle">
            Next
          </Text>
        </Plane>
      </group>
    </group>
  );
};

export default ResponseDisplay;
