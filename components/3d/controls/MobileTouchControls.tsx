/**
 * MobileTouchControls - Enhanced touch controls for 3D scenes on mobile
 *
 * Provides:
 * - Swipe gestures for camera rotation
 * - Pinch-to-zoom
 * - Tap to select objects
 * - Double-tap to reset view
 * - Visual feedback overlays
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import styled from 'styled-components';

interface TouchState {
  isActive: boolean;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startDistance: number;
  startTime: number;
  touchCount: number;
}

interface MobileTouchControlsProps {
  enabled?: boolean;
  rotationSpeed?: number;
  zoomSpeed?: number;
  dampingFactor?: number;
  minDistance?: number;
  maxDistance?: number;
  onTap?: (position: { x: number; y: number }) => void;
  onDoubleTap?: () => void;
}

// Gesture feedback overlay (rendered outside R3F)
const GestureOverlay = styled.div<{ $visible: boolean; $type: string }>`
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  border-radius: 24px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  opacity: ${props => props.$visible ? 1 : 0};
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;

  svg {
    width: 20px;
    height: 20px;
  }
`;

// Helper to get distance between two touch points
function getTouchDistance(touch1: Touch, touch2: Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// Helper to get center point between two touches
function getTouchCenter(touch1: Touch, touch2: Touch): { x: number; y: number } {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}

export function MobileTouchControls({
  enabled = true,
  rotationSpeed = 0.005,
  zoomSpeed = 0.01,
  dampingFactor = 0.92,
  minDistance = 5,
  maxDistance = 50,
  onTap,
  onDoubleTap,
}: MobileTouchControlsProps) {
  const { camera, gl } = useThree();
  const domElement = gl.domElement;

  // Touch state
  const touchState = useRef<TouchState>({
    isActive: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startDistance: 0,
    startTime: 0,
    touchCount: 0,
  });

  // Velocity for smooth damping
  const velocity = useRef({ x: 0, y: 0, zoom: 0 });

  // Spherical coordinates for camera orbit
  const spherical = useRef(new THREE.Spherical());
  const target = useRef(new THREE.Vector3(0, 0, 0));

  // Double tap detection
  const lastTapTime = useRef(0);

  // Initialize spherical from camera
  useEffect(() => {
    if (!enabled) return;

    const offset = camera.position.clone().sub(target.current);
    spherical.current.setFromVector3(offset);
  }, [camera, enabled]);

  // Touch start handler
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    e.preventDefault();

    const touches = e.touches;
    const state = touchState.current;

    state.isActive = true;
    state.touchCount = touches.length;
    state.startTime = Date.now();

    if (touches.length === 1) {
      state.startX = touches[0].clientX;
      state.startY = touches[0].clientY;
      state.lastX = touches[0].clientX;
      state.lastY = touches[0].clientY;
    } else if (touches.length === 2) {
      state.startDistance = getTouchDistance(touches[0], touches[1]);
      const center = getTouchCenter(touches[0], touches[1]);
      state.startX = center.x;
      state.startY = center.y;
      state.lastX = center.x;
      state.lastY = center.y;
    }
  }, [enabled]);

  // Touch move handler
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || !touchState.current.isActive) return;
    e.preventDefault();

    const touches = e.touches;
    const state = touchState.current;

    if (touches.length === 1) {
      // Single finger: rotate camera
      const deltaX = touches[0].clientX - state.lastX;
      const deltaY = touches[0].clientY - state.lastY;

      velocity.current.x = deltaX * rotationSpeed;
      velocity.current.y = deltaY * rotationSpeed;

      state.lastX = touches[0].clientX;
      state.lastY = touches[0].clientY;
    } else if (touches.length === 2) {
      // Two fingers: pinch to zoom
      const currentDistance = getTouchDistance(touches[0], touches[1]);
      const deltaDistance = currentDistance - state.startDistance;

      velocity.current.zoom = deltaDistance * zoomSpeed;
      state.startDistance = currentDistance;

      // Also handle rotation with two fingers
      const center = getTouchCenter(touches[0], touches[1]);
      const deltaX = center.x - state.lastX;
      const deltaY = center.y - state.lastY;

      velocity.current.x = deltaX * rotationSpeed * 0.5;
      velocity.current.y = deltaY * rotationSpeed * 0.5;

      state.lastX = center.x;
      state.lastY = center.y;
    }
  }, [enabled, rotationSpeed, zoomSpeed]);

  // Touch end handler
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    const state = touchState.current;
    const duration = Date.now() - state.startTime;
    const distance = Math.sqrt(
      Math.pow(state.lastX - state.startX, 2) +
      Math.pow(state.lastY - state.startY, 2)
    );

    // Detect taps
    if (duration < 300 && distance < 10 && state.touchCount === 1) {
      const now = Date.now();

      // Double tap detection
      if (now - lastTapTime.current < 300) {
        onDoubleTap?.();
        lastTapTime.current = 0;
      } else {
        lastTapTime.current = now;
        onTap?.({ x: state.lastX, y: state.lastY });
      }
    }

    if (e.touches.length === 0) {
      state.isActive = false;
      state.touchCount = 0;
    } else {
      state.touchCount = e.touches.length;
    }
  }, [enabled, onTap, onDoubleTap]);

  // Attach event listeners
  useEffect(() => {
    if (!enabled) return;

    domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    domElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    domElement.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      domElement.removeEventListener('touchstart', handleTouchStart);
      domElement.removeEventListener('touchmove', handleTouchMove);
      domElement.removeEventListener('touchend', handleTouchEnd);
      domElement.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [domElement, enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Apply velocities and damping each frame
  useFrame(() => {
    if (!enabled) return;

    const vel = velocity.current;
    const sph = spherical.current;

    // Apply rotation
    sph.theta -= vel.x;
    sph.phi -= vel.y;

    // Clamp phi to avoid flipping
    sph.phi = Math.max(0.1, Math.min(Math.PI - 0.1, sph.phi));

    // Apply zoom
    sph.radius -= vel.zoom;
    sph.radius = Math.max(minDistance, Math.min(maxDistance, sph.radius));

    // Apply damping
    vel.x *= dampingFactor;
    vel.y *= dampingFactor;
    vel.zoom *= dampingFactor;

    // Update camera position
    const offset = new THREE.Vector3();
    offset.setFromSpherical(sph);
    camera.position.copy(target.current).add(offset);
    camera.lookAt(target.current);
  });

  return null;
}

// Visual hint component for touch gestures (render in DOM, not canvas)
export function TouchGestureHint({ gesture }: { gesture: 'rotate' | 'zoom' | 'tap' | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (gesture) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [gesture]);

  const icons: Record<string, React.ReactNode> = {
    rotate: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a10 10 0 0 1 10 10h-4l5 5 5-5h-4a12 12 0 0 0-12-12v4z" />
      </svg>
    ),
    zoom: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
    tap: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="8" strokeDasharray="4 4" />
      </svg>
    ),
  };

  const labels: Record<string, string> = {
    rotate: 'Drag to rotate',
    zoom: 'Pinch to zoom',
    tap: 'Tap to select',
  };

  return (
    <GestureOverlay $visible={visible} $type={gesture || ''}>
      {gesture && icons[gesture]}
      {gesture && labels[gesture]}
    </GestureOverlay>
  );
}

export default MobileTouchControls;
