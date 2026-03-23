/**
 * NavCat Navigation Integration
 * Navigation mesh generation and pathfinding for 3D rooms
 * 
 * NOTE: Uses whole-store subscription for React 19 compatibility
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as NavCat from 'navcat';
import { generateSoloNavMesh, type SoloNavMeshOptions } from 'navcat/blocks';
import { useRoomStore } from '@/lib/rooms/store';
import type { NavMeshData, AnyNode } from '@/lib/rooms/types';
import type { Vec3 } from 'navcat';
import { BufferGeometry, BufferAttribute } from 'three';
import { Line } from '@react-three/drei';

// =============================================================================
// NAVIGATION CONTEXT
// =============================================================================

interface NavigationContextType {
  navMesh: NavCat.NavMesh | null;
  findPath: (start: Vec3, end: Vec3) => NavCat.Vec3[];
  findNearestPoint: (point: Vec3) => Vec3 | null;
  isPointWalkable: (point: Vec3) => boolean;
  moveAlongSurface: (start: Vec3, end: Vec3, startNodeRef: number) => NavCat.MoveAlongSurfaceResult;
}

const NavigationContext = React.createContext<NavigationContextType>({
  navMesh: null,
  findPath: () => [],
  findNearestPoint: () => null,
  isPointWalkable: () => false,
  moveAlongSurface: () => ({ success: false, position: [0, 0, 0], nodeRef: 0, visited: [] }),
});

export const useNavigation = () => React.useContext(NavigationContext);

// =============================================================================
// NAVIGATION SYSTEM PROVIDER
// =============================================================================

interface NavigationSystemProps {
  children: React.ReactNode;
  autoGenerate?: boolean;
}

export const NavigationSystem: React.FC<NavigationSystemProps> = ({
  children,
  autoGenerate = true,
}) => {
  const [navMesh, setNavMesh] = React.useState<NavCat.NavMesh | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  
  // Get whole store - React 19 compatible
  const store = useRoomStore();
  const navMeshData = store.navigationMesh;
  const nodes = store.nodes;
  
  // Generate navmesh from scene
  useEffect(() => {
    if (!autoGenerate || isGenerating) return;
    
    if (navMeshData) {
      generateNavMeshFromData(navMeshData);
      return;
    }
    
    generateNavMeshFromScene();
  }, [navMeshData, autoGenerate, isGenerating]);
  
  const generateNavMeshFromData = useCallback((data: NavMeshData) => {
    try {
      setIsGenerating(true);
      
      const options: SoloNavMeshOptions = {
        cellSize: 0.15,
        cellHeight: 0.25,
        walkableRadiusWorld: data.agentRadius,
        walkableRadiusVoxels: Math.ceil(data.agentRadius / 0.15),
        walkableClimbWorld: data.agentClimb,
        walkableClimbVoxels: Math.ceil(data.agentClimb / 0.25),
        walkableHeightWorld: data.agentHeight,
        walkableHeightVoxels: Math.ceil(data.agentHeight / 0.25),
        walkableSlopeAngleDegrees: 45,
        borderSize: 0,
        minRegionArea: 8,
        mergeRegionArea: 20,
        maxSimplificationError: 1.3,
        maxEdgeLength: 12,
        maxVerticesPerPoly: 6,
        detailSampleDistance: 0.6,
        detailSampleMaxError: 0.25,
      };
      
      const result = generateSoloNavMesh(
        { positions: data.positions, indices: data.indices },
        options
      );
      
      if (result.navMesh) {
        setNavMesh(result.navMesh);
      }
    } catch (error) {
      console.error('Failed to generate navmesh from data:', error);
    } finally {
      setIsGenerating(false);
    }
  }, []);
  
  const generateNavMeshFromScene = useCallback(() => {
    try {
      setIsGenerating(true);
      
      const positions: number[] = [];
      const indices: number[] = [];
      let vertexOffset = 0;
      
      const floorNodes = Object.values(nodes as Record<string, AnyNode>).filter((n) => n.type === 'floor');
      
      for (const floor of floorNodes) {
        const [width, depth] = (floor as any).dimensions || [4, 4];
        const [x, y, z] = floor.transform.position;
        
        const halfW = width / 2;
        const halfD = depth / 2;
        
        const floorVerts = [
          x - halfW, y, z - halfD,
          x + halfW, y, z - halfD,
          x + halfW, y, z + halfD,
          x - halfW, y, z + halfD,
        ];
        
        positions.push(...floorVerts);
        
        indices.push(
          vertexOffset, vertexOffset + 1, vertexOffset + 2,
          vertexOffset, vertexOffset + 2, vertexOffset + 3
        );
        
        vertexOffset += 4;
      }
      
      if (positions.length === 0) {
        setIsGenerating(false);
        return;
      }
      
      const options: SoloNavMeshOptions = {
        cellSize: 0.15,
        cellHeight: 0.25,
        walkableRadiusWorld: 0.3,
        walkableRadiusVoxels: 2,
        walkableClimbWorld: 0.5,
        walkableClimbVoxels: 2,
        walkableHeightWorld: 2.0,
        walkableHeightVoxels: 8,
        walkableSlopeAngleDegrees: 45,
        borderSize: 0,
        minRegionArea: 8,
        mergeRegionArea: 20,
        maxSimplificationError: 1.3,
        maxEdgeLength: 12,
        maxVerticesPerPoly: 6,
        detailSampleDistance: 0.6,
        detailSampleMaxError: 0.25,
      };
      
      const result = generateSoloNavMesh(
        { positions: new Float32Array(positions), indices: new Uint32Array(indices) },
        options
      );
      
      if (result.navMesh) {
        setNavMesh(result.navMesh);
      }
    } catch (error) {
      console.error('Failed to generate navmesh from scene:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [nodes]);
  
  const findPath = useCallback((start: Vec3, end: Vec3): Vec3[] => {
    if (!navMesh) return [];
    
    try {
      const result = NavCat.findPath(
        navMesh,
        start,
        end,
        [0.5, 0.5, 0.5],
        NavCat.DEFAULT_QUERY_FILTER
      );
      
      if (result.success) {
        return result.path.map((p) => p.position);
      }
    } catch (error) {
      console.error('Pathfinding error:', error);
    }
    
    return [];
  }, [navMesh]);
  
  const findNearestPoint = useCallback((point: Vec3): Vec3 | null => {
    if (!navMesh) return null;
    
    try {
      const result = NavCat.createFindNearestPolyResult();
      
      NavCat.findNearestPoly(
        result,
        navMesh,
        point,
        [0.5, 0.5, 0.5],
        NavCat.DEFAULT_QUERY_FILTER
      );
      
      if (result.success) {
        return result.position;
      }
    } catch (error) {
      console.error('Nearest point error:', error);
    }
    
    return null;
  }, [navMesh]);
  
  const isPointWalkable = useCallback((point: Vec3): boolean => {
    if (!navMesh) return false;
    
    try {
      const result = NavCat.createFindNearestPolyResult();
      
      NavCat.findNearestPoly(
        result,
        navMesh,
        point,
        [0.1, 0.1, 0.1],
        NavCat.DEFAULT_QUERY_FILTER
      );
      
      return result.success;
    } catch {
      return false;
    }
  }, [navMesh]);
  
  const moveAlongSurface = useCallback((
    start: Vec3,
    end: Vec3,
    startNodeRef: number
  ): NavCat.MoveAlongSurfaceResult => {
    if (!navMesh) {
      return { success: false, position: start, nodeRef: 0, visited: [] };
    }
    
    try {
      return NavCat.moveAlongSurface(
        navMesh,
        startNodeRef,
        start,
        end,
        NavCat.DEFAULT_QUERY_FILTER
      );
    } catch (error) {
      console.error('Move along surface error:', error);
      return { success: false, position: start, nodeRef: 0, visited: [] };
    }
  }, [navMesh]);
  
  return (
    <NavigationContext.Provider
      value={{
        navMesh,
        findPath,
        findNearestPoint,
        isPointWalkable,
        moveAlongSurface,
      }}
    >
      {children}
      {navMesh && <NavMeshVisualization navMesh={navMesh} />}
    </NavigationContext.Provider>
  );
};

// =============================================================================
// NAVMESH VISUALIZATION
// =============================================================================

interface NavMeshVisualizationProps {
  navMesh: NavCat.NavMesh;
}

const NavMeshVisualization: React.FC<NavMeshVisualizationProps> = ({ navMesh }) => {
  const store = useRoomStore();
  const showNavMesh = store.showNavMesh;
  
  const geometry = useMemo(() => {
    const positions: number[] = [];
    
    const bounds: NavCat.Box3 = [-50, -10, -50, 50, 10, 50];
    const polyRefs = NavCat.queryPolygons(navMesh, bounds, NavCat.DEFAULT_QUERY_FILTER);
    
    for (const nodeRef of polyRefs) {
      const result = NavCat.getTileAndPolyByRef(nodeRef, navMesh);
      if (!result.success) continue;
      
      const { tile, poly } = result;
      
      const verts: NavCat.Vec3[] = [];
      for (let i = 0; i < poly.vertices.length; i++) {
        const vertIndex = poly.vertices[i];
        const vert: NavCat.Vec3 = [
          tile.vertices[vertIndex * 3],
          tile.vertices[vertIndex * 3 + 1],
          tile.vertices[vertIndex * 3 + 2],
        ];
        verts.push(vert);
      }
      
      for (let i = 0; i < verts.length; i++) {
        const v1 = verts[i];
        const v2 = verts[(i + 1) % verts.length];
        
        positions.push(v1[0], v1[1], v1[2]);
        positions.push(v2[0], v2[1], v2[2]);
      }
    }
    
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    return geo;
  }, [navMesh]);
  
  if (!showNavMesh) return null;
  
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#00ff00" opacity={0.5} transparent />
    </lineSegments>
  );
};

// =============================================================================
// AI AGENT
// =============================================================================

interface AIAgentProps {
  id: string;
  startPosition: Vec3;
  targetPosition?: Vec3;
  speed?: number;
  onReachTarget?: () => void;
}

export const AIAgent: React.FC<AIAgentProps> = ({
  id,
  startPosition,
  targetPosition,
  speed = 2,
  onReachTarget,
}) => {
  const { findPath, isPointWalkable } = useNavigation();
  const [currentPath, setCurrentPath] = React.useState<Vec3[]>([]);
  const [currentPosition, setCurrentPosition] = React.useState<Vec3>(startPosition);
  const pathIndexRef = useRef(0);
  
  useEffect(() => {
    if (!targetPosition) return;
    
    if (!isPointWalkable(targetPosition)) {
      console.warn('Target position is not walkable');
      return;
    }
    
    const path = findPath(currentPosition, targetPosition);
    setCurrentPath(path);
    pathIndexRef.current = 0;
  }, [targetPosition, currentPosition, findPath, isPointWalkable]);
  
  useFrame((_, delta) => {
    if (currentPath.length === 0 || pathIndexRef.current >= currentPath.length) {
      if (currentPath.length > 0 && pathIndexRef.current >= currentPath.length) {
        onReachTarget?.();
        setCurrentPath([]);
      }
      return;
    }
    
    const target = currentPath[pathIndexRef.current];
    const moveDistance = speed * delta;
    
    const dx = target[0] - currentPosition[0];
    const dz = target[2] - currentPosition[2];
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance <= moveDistance) {
      setCurrentPosition(target);
      pathIndexRef.current++;
    } else {
      const ratio = moveDistance / distance;
      setCurrentPosition([
        currentPosition[0] + dx * ratio,
        target[1],
        currentPosition[2] + dz * ratio,
      ]);
    }
  });
  
  return (
    <group position={currentPosition}>
      <mesh>
        <capsuleGeometry args={[0.3, 1.6, 4, 8]} />
        <meshStandardMaterial color="#ff6600" />
      </mesh>
      {currentPath.length > 1 && (
        <Line
          points={[currentPosition, ...currentPath.slice(pathIndexRef.current)]}
          color="#ff6600"
          lineWidth={2}
        />
      )}
    </group>
  );
};

export default NavigationSystem;
