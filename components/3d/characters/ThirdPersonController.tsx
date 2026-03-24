/**
 * Third Person Controller
 * WASD movement with orbit camera following a character
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ProceduralHumanoid, HumanoidRef, AnimationState } from './ProceduralHumanoid';

interface ThirdPersonControllerProps {
  spawnPoint?: [number, number, number];
  onMove?: (position: THREE.Vector3) => void;
}

// Input state
const keys = { w: false, a: false, s: false, d: false, shift: false };

export const ThirdPersonController: React.FC<ThirdPersonControllerProps> = ({
  spawnPoint = [0, 0, 0],
  onMove
}) => {
  const characterRef = useRef<HumanoidRef>(null);
  const { camera } = useThree();
  
  // Camera orbit state
  const cameraAngle = useRef({ theta: 0, phi: Math.PI / 3 });
  const cameraDistance = useRef(5);
  const targetDistance = useRef(5);
  
  // Character movement state
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const isMoving = useRef(false);
  const [isLocked, setIsLocked] = useState(false);
  
  // Setup keyboard input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keys.w = true;
      if (key === 'a' || key === 'arrowleft') keys.a = true;
      if (key === 's' || key === 'arrowdown') keys.s = true;
      if (key === 'd' || key === 'arrowright') keys.d = true;
      if (key === 'shift') keys.shift = true;
    };
    
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keys.w = false;
      if (key === 'a' || key === 'arrowleft') keys.a = false;
      if (key === 's' || key === 'arrowdown') keys.s = false;
      if (key === 'd' || key === 'arrowright') keys.d = false;
      if (key === 'shift') keys.shift = false;
    };
    
    const onMouseDown = () => setIsLocked(true);
    const onMouseUp = () => setIsLocked(false);
    const onMouseMove = (e: MouseEvent) => {
      if (!isLocked) return;
      cameraAngle.current.theta -= e.movementX * 0.005;
      cameraAngle.current.phi = Math.max(
        0.1,
        Math.min(Math.PI / 2 - 0.1, cameraAngle.current.phi - e.movementY * 0.005)
      );
    };
    
    const onWheel = (e: WheelEvent) => {
      targetDistance.current = Math.max(2, Math.min(10, targetDistance.current + e.deltaY * 0.01));
    };
    
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel);
    
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
    };
  }, [isLocked]);
  
  // Movement loop
  useFrame((state, delta) => {
    if (!characterRef.current) return;
    
    const charPos = characterRef.current.getPosition();
    
    // Calculate movement direction from camera angle
    const forward = new THREE.Vector3(
      Math.sin(cameraAngle.current.theta),
      0,
      Math.cos(cameraAngle.current.theta)
    );
    const right = new THREE.Vector3(
      Math.sin(cameraAngle.current.theta + Math.PI / 2),
      0,
      Math.cos(cameraAngle.current.theta + Math.PI / 2)
    );
    
    // Build direction vector
    direction.current.set(0, 0, 0);
    if (keys.w) direction.current.add(forward);
    if (keys.s) direction.current.sub(forward);
    if (keys.d) direction.current.add(right);
    if (keys.a) direction.current.sub(right);
    
    // Normalize and apply speed
    const isWalking = direction.current.length() > 0;
    if (isWalking) {
      direction.current.normalize();
      const speed = keys.shift ? 8 : 4; // Run or walk
      velocity.current.copy(direction.current).multiplyScalar(speed * delta);
      
      // Update position
      charPos.add(velocity.current);
      characterRef.current.setPosition(charPos);
      
      // Rotate character to face movement direction
      const targetRotation = Math.atan2(direction.current.x, direction.current.z);
      const currentRot = characterRef.current.getRotation();
      currentRot.y = THREE.MathUtils.lerp(currentRot.y, targetRotation, 10 * delta);
      characterRef.current.setRotation(currentRot);
      
      // Update animation
      characterRef.current.setAnimationState({
        state: keys.shift ? 'running' : 'walking',
        direction: direction.current,
        speed: keys.shift ? 8 : 4
      });
    } else {
      characterRef.current.setAnimationState({
        state: 'idle',
        direction: new THREE.Vector3(),
        speed: 0
      });
    }
    
    // Smooth camera distance
    cameraDistance.current = THREE.MathUtils.lerp(cameraDistance.current, targetDistance.current, 5 * delta);
    
    // Calculate camera position (orbit around character)
    const camOffset = new THREE.Vector3(
      Math.sin(cameraAngle.current.theta) * Math.sin(cameraAngle.current.phi) * cameraDistance.current,
      Math.cos(cameraAngle.current.phi) * cameraDistance.current + 1.5, // +1.5 for eye level offset
      Math.cos(cameraAngle.current.theta) * Math.sin(cameraAngle.current.phi) * cameraDistance.current
    );
    
    // Update camera
    const targetCamPos = charPos.clone().add(camOffset);
    camera.position.lerp(targetCamPos, 10 * delta);
    camera.lookAt(charPos.x, charPos.y + 1.5, charPos.z);
    
    // Notify parent
    if (isWalking) {
      onMove?.(charPos);
    }
  });
  
  return (
    <>
      <ProceduralHumanoid
        ref={characterRef}
        initialPosition={spawnPoint}
        config={{
          build: 'average',
          headType: 'helmet',
          outfitColors: {
            primary: '#2c3e50',
            secondary: '#34495e',
            accent: '#00d4ff'
          },
          glowIntensity: 0.8
        }}
      />
      
      {/* UI Hint */}
      <Html position={[spawnPoint[0], spawnPoint[1] + 3, spawnPoint[2]]} center>
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '4px',
          fontSize: '12px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap'
        }}>
          {isLocked ? 'WASD to move, Mouse to look' : 'Click to control'}
        </div>
      </Html>
    </>
  );
};

// Simple HTML component for labels
const Html: React.FC<{ position: [number,number,number]; center?: boolean; children: React.ReactNode }> = 
({ position, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { camera, size } = useThree();
  const [style, setStyle] = useState({ display: 'none' } as React.CSSProperties);
  
  useFrame(() => {
    if (!ref.current) return;
    const vec = new THREE.Vector3(...position);
    vec.project(camera);
    const x = (vec.x * 0.5 + 0.5) * size.width;
    const y = (-vec.y * 0.5 + 0.5) * size.height;
    const visible = vec.z < 1;
    setStyle({
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%, -50%)',
      display: visible ? 'block' : 'none',
      pointerEvents: 'none'
    });
  });
  
  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
};

export default ThirdPersonController;
