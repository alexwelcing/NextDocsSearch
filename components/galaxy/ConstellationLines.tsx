/**
 * ConstellationLines - Renders connection lines between worlds
 * 
 * Shows relationships between worlds as glowing lines.
 * Lines fade in when either connected world is hovered.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { World } from '@/lib/galaxy/world-registry';

interface ConstellationLinesProps {
  worlds: World[];
  hoveredWorldId?: string | null;
  selectedWorldId?: string | null;
}

export function ConstellationLines({ worlds, hoveredWorldId, selectedWorldId }: ConstellationLinesProps) {
  const lines = useMemo(() => {
    const lineData: Array<{
      start: THREE.Vector3;
      end: THREE.Vector3;
      active: boolean;
    }> = [];

    const activeIds = new Set([hoveredWorldId, selectedWorldId].filter(Boolean));

    worlds.forEach(world => {
      world.connections.forEach(targetId => {
        // Only show line if both worlds exist
        const target = worlds.find(w => w.id === targetId);
        if (!target) return;

        // Avoid duplicate lines (only draw from lower ID to higher ID)
        if (world.id > targetId) return;

        const isActive = activeIds.has(world.id) || activeIds.has(targetId);

        lineData.push({
          start: new THREE.Vector3(...world.position),
          end: new THREE.Vector3(...target.position),
          active: isActive,
        });
      });
    });

    return lineData;
  }, [worlds, hoveredWorldId, selectedWorldId]);

  // Create geometry for all lines
  const { geometry, activeIndices } = useMemo(() => {
    const points: number[] = [];
    const activeIdx: number[] = [];

    lines.forEach((line, index) => {
      points.push(
        line.start.x, line.start.y, line.start.z,
        line.end.x, line.end.y, line.end.z
      );
      if (line.active) {
        activeIdx.push(index);
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    
    return { geometry: geo, activeIndices: activeIdx };
  }, [lines]);

  // If no lines, don't render
  if (lines.length === 0) return null;

  return (
    <>
      {/* Base lines (dim) */}
      <lineSegments geometry={geometry}>
        <lineBasicMaterial 
          color="#ffffff" 
          transparent 
          opacity={0.05} 
        />
      </lineSegments>
      
      {/* Active lines (glowing) */}
      {activeIndices.length > 0 && (
        <ActiveLines geometry={geometry} activeIndices={activeIndices} />
      )}
    </>
  );
}

// Separate component for active lines to handle animation
function ActiveLines({ geometry, activeIndices }: { 
  geometry: THREE.BufferGeometry; 
  activeIndices: number[];
}) {
  const lineRef = React.useRef<THREE.LineSegments>(null);
  
  // Create geometry with only active lines
  const activeGeometry = useMemo(() => {
    const positions = geometry.attributes.position.array as Float32Array;
    const points: number[] = [];
    
    activeIndices.forEach(index => {
      const i = index * 6; // 2 points * 3 coordinates
      points.push(
        positions[i], positions[i + 1], positions[i + 2],
        positions[i + 3], positions[i + 4], positions[i + 5]
      );
    });
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geo;
  }, [geometry, activeIndices]);

  // Pulse animation
  React.useEffect(() => {
    if (!lineRef.current) return;
    
    let frame: number;
    const animate = () => {
      if (lineRef.current) {
        const material = lineRef.current.material as THREE.LineBasicMaterial;
        const time = Date.now() * 0.001;
        material.opacity = 0.4 + Math.sin(time * 2) * 0.2;
      }
      frame = requestAnimationFrame(animate);
    };
    animate();
    
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <lineSegments ref={lineRef} geometry={activeGeometry}>
      <lineBasicMaterial 
        color="#00d4ff" 
        transparent 
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

export default ConstellationLines;
