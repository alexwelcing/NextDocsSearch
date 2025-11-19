// Character Collision - Physics-based collision detection for rigged characters

import React, { useRef, useEffect } from 'react';
import { useBox, useSphere } from '@react-three/cannon';
import * as THREE from 'three';
import { CollisionBox } from '@/lib/generators/characterTypes';

interface CharacterCollisionProps {
  collisionBoxes: CollisionBox[];
  position: [number, number, number];
  onCollision?: (otherObject: any) => void;
  showDebug?: boolean;
}

export default function CharacterCollision({
  collisionBoxes,
  position,
  onCollision,
  showDebug = false,
}: CharacterCollisionProps) {
  return (
    <group position={position}>
      {collisionBoxes.map((box, index) => (
        <CollisionBoxComponent
          key={index}
          box={box}
          onCollision={onCollision}
          showDebug={showDebug}
        />
      ))}
    </group>
  );
}

function CollisionBoxComponent({
  box,
  onCollision,
  showDebug,
}: {
  box: CollisionBox;
  onCollision?: (otherObject: any) => void;
  showDebug: boolean;
}) {
  const [ref, api] = useBox(() => ({
    type: box.type === 'trigger' ? 'Kinematic' : 'Dynamic',
    args: box.size,
    position: box.position,
    rotation: box.rotation || [0, 0, 0],
    mass: box.type === 'trigger' ? 0 : 1,
    isTrigger: box.type === 'trigger',
    onCollide: onCollision
      ? e => {
          if (box.enabled) {
            onCollision(e.body);
          }
        }
      : undefined,
  }));

  return (
    <>
      {showDebug && (
        <mesh ref={ref} position={box.position}>
          <boxGeometry args={box.size} />
          <meshBasicMaterial
            color={
              box.type === 'hitbox'
                ? '#ff0000'
                : box.type === 'hurtbox'
                ? '#00ff00'
                : '#0000ff'
            }
            wireframe
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
    </>
  );
}

// Helper hook for character collision detection
export function useCharacterCollision(onHit: (target: string) => void) {
  const collisionsRef = useRef<Set<string>>(new Set());

  const handleCollision = (otherBody: any) => {
    if (otherBody?.userData?.type === 'character') {
      const characterId = otherBody.userData.id;
      if (!collisionsRef.current.has(characterId)) {
        collisionsRef.current.add(characterId);
        onHit(characterId);

        // Remove after a delay to allow re-collision
        setTimeout(() => {
          collisionsRef.current.delete(characterId);
        }, 500);
      }
    }
  };

  return handleCollision;
}
