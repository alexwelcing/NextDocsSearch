/**
 * Advanced Room Renderer
 * 
 * Features:
 * - Texture support with proper UV mapping
 * - Camera collision meshes (prevents clipping through walls)
 * - Player spawn system with camera positioning
 * - Enhanced lighting with shadows
 * - Interactive object highlighting
 */

import React, { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { 
  Mesh, 
  MeshStandardMaterial, 
  TextureLoader, 
  RepeatWrapping,
  Vector3,
  Euler,
  Quaternion,
  Box3,
  Sphere,
  CanvasTexture
} from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useRoomStore, type RoomStore } from '@/lib/rooms/store';
import { 
  AnyNode, 
  RoomNode, 
  WallNode, 
  FloorNode, 
  ZoneNode, 
  LightNode,
  ItemNode,
  MaterialRef 
} from '@/lib/rooms/types';
import { PointerLockControls } from '@react-three/drei';

// =============================================================================
// TEXTURE MANAGEMENT
// =============================================================================

const textureLoader = new TextureLoader();
const textureCache = new Map<string, THREE.Texture>();
const proceduralTextureCache = new Map<string, THREE.CanvasTexture>();

function loadTexture(url: string): THREE.Texture | null {
  if (textureCache.has(url)) {
    return textureCache.get(url)!;
  }
  
  try {
    const texture = textureLoader.load(url);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    textureCache.set(url, texture);
    return texture;
  } catch (e) {
    console.warn('Failed to load texture:', url);
    return null;
  }
}

// Procedural textures as fallbacks
function createProceduralTexture(type: 'concrete' | 'metal' | 'wood' | 'fabric' | 'holographic'): THREE.CanvasTexture {
  if (proceduralTextureCache.has(type)) {
    return proceduralTextureCache.get(type)!;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  switch (type) {
    case 'concrete':
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 1000; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
      break;
    case 'metal':
      const grad = ctx.createLinearGradient(0, 0, 512, 512);
      grad.addColorStop(0, '#888');
      grad.addColorStop(0.5, '#aaa');
      grad.addColorStop(1, '#666');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);
      break;
    case 'wood':
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 50; i++) {
        ctx.strokeStyle = `rgba(60,30,10,${0.3 + Math.random() * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, i * 10 + Math.random() * 5);
        ctx.bezierCurveTo(170, i * 10 + Math.random() * 20, 340, i * 10 - Math.random() * 20, 512, i * 10 + Math.random() * 5);
        ctx.stroke();
      }
      break;
    case 'holographic':
      const holoGrad = ctx.createLinearGradient(0, 0, 512, 512);
      holoGrad.addColorStop(0, 'rgba(0,255,255,0.2)');
      holoGrad.addColorStop(0.5, 'rgba(255,0,255,0.2)');
      holoGrad.addColorStop(1, 'rgba(0,255,255,0.2)');
      ctx.fillStyle = holoGrad;
      ctx.fillRect(0, 0, 512, 512);
      break;
    default:
      ctx.fillStyle = '#888';
      ctx.fillRect(0, 0, 512, 512);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  proceduralTextureCache.set(type, texture);
  return texture;
}

// =============================================================================
// MATERIAL FACTORY
// =============================================================================

function createMaterial(materialRef: MaterialRef): MeshStandardMaterial {
  const props = materialRef.properties;
  
  // Determine texture type based on material ID or properties
  let map: THREE.Texture | undefined;
  let normalMap: THREE.Texture | undefined;
  
  if (props.texture) {
    map = loadTexture(props.texture) || undefined;
  } else {
    // Use procedural textures based on material name
    if (materialRef.id.includes('concrete') || materialRef.id.includes('cell')) {
      map = createProceduralTexture('concrete');
    } else if (materialRef.id.includes('metal') || materialRef.id.includes('obsidian')) {
      map = createProceduralTexture('metal');
    } else if (materialRef.id.includes('wood') || materialRef.id.includes('root')) {
      map = createProceduralTexture('wood');
    } else if (materialRef.id.includes('holographic') || materialRef.id.includes('ai')) {
      map = createProceduralTexture('holographic');
    }
  }
  
  if (props.normalMap) {
    normalMap = loadTexture(props.normalMap) || undefined;
  }
  
  return new MeshStandardMaterial({
    color: props.color || '#808080',
    map,
    normalMap,
    roughness: props.roughness ?? 0.5,
    metalness: props.metalness ?? 0,
    emissive: props.emissive || '#000000',
    emissiveIntensity: props.emissiveIntensity ?? 0,
    transparent: props.transparent || false,
    opacity: props.opacity ?? 1,
    side: THREE.FrontSide,
  });
}

// =============================================================================
// CAMERA COLLISION SYSTEM
// =============================================================================

interface CameraColliderProps {
  bounds: Box3;
}

const CameraCollider: React.FC<CameraColliderProps> = ({ bounds }) => {
  const { camera } = useThree();
  const lastValidPosition = useRef(new Vector3());
  
  useFrame(() => {
    const camPos = camera.position;
    
    // Check if camera is outside bounds
    if (!bounds.containsPoint(camPos)) {
      // Clamp position to bounds
      camPos.x = Math.max(bounds.min.x, Math.min(bounds.max.x, camPos.x));
      camPos.y = Math.max(bounds.min.y, Math.min(bounds.max.y, camPos.y));
      camPos.z = Math.max(bounds.min.z, Math.min(bounds.max.z, camPos.z));
    }
    
    lastValidPosition.current.copy(camPos);
  });
  
  return null;
};

// Wall collider that pushes camera back
const WallCameraCollider: React.FC<{ wallPosition: Vector3; normal: Vector3; thickness?: number }> = 
({ wallPosition, normal, thickness = 0.5 }) => {
  const { camera } = useThree();
  
  useFrame(() => {
    const camPos = camera.position;
    const toWall = new Vector3().subVectors(wallPosition, camPos);
    const distance = toWall.dot(normal);
    
    // If camera is too close to wall (on the wrong side), push it back
    if (distance < thickness && distance > -thickness) {
      const pushBack = normal.clone().multiplyScalar(thickness - distance);
      camPos.sub(pushBack);
    }
  });
  
  return null;
};

// =============================================================================
// PLAYER CONTROLLER WITH SPAWN
// =============================================================================

interface PlayerControllerProps {
  spawnPoint?: [number, number, number];
  enabled?: boolean;
}

export const PlayerController: React.FC<PlayerControllerProps> = ({ 
  spawnPoint = [0, 1.6, 0],
  enabled = true 
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const [isLocked, setIsLocked] = useState(false);
  
  // Set initial spawn position
  useEffect(() => {
    if (enabled && spawnPoint) {
      camera.position.set(...spawnPoint);
      camera.rotation.set(0, 0, 0);
    }
  }, [camera, spawnPoint, enabled]);
  
  // Click to lock controls
  useEffect(() => {
    if (!enabled) return;
    
    const handleClick = () => {
      if (controlsRef.current && !isLocked) {
        controlsRef.current.lock();
      }
    };
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [enabled, isLocked]);
  
  if (!enabled) return null;
  
  return (
    <PointerLockControls
      ref={controlsRef}
      onLock={() => setIsLocked(true)}
      onUnlock={() => setIsLocked(false)}
    />
  );
};

// =============================================================================
// ENHANCED ROOM NODE RENDERER
// =============================================================================

interface EnhancedRoomNodeRendererProps {
  node: RoomNode;
  store: RoomStore;
}

const EnhancedRoomNodeRenderer: React.FC<EnhancedRoomNodeRendererProps> = ({ node, store }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [bounds, setBounds] = useState<Box3 | null>(null);
  
  // Calculate room bounds for camera collision
  useEffect(() => {
    const [w, h, d] = node.dimensions;
    const box = new Box3(
      new Vector3(node.transform.position[0] - w/2 + 0.5, node.transform.position[1] - h/2 + 1.6, node.transform.position[2] - d/2 + 0.5),
      new Vector3(node.transform.position[0] + w/2 - 0.5, node.transform.position[1] + h/2 - 0.2, node.transform.position[2] + d/2 - 0.5)
    );
    setBounds(box);
  }, [node]);
  
  // Get child nodes
  const childIds = useMemo(() => 
    Object.values(store.nodes)
      .filter((n) => n.parentId === node.id)
      .map((n) => n.id),
    [store.nodes, node.id]
  );
  
  return (
    <group
      ref={groupRef}
      position={node.transform.position}
      quaternion={node.transform.rotation}
      scale={node.transform.scale}
    >
      {/* Render children */}
      {childIds.map((childId) => {
        const child = store.nodes[childId];
        if (!child || !child.visible) return null;
        return <EnhancedNodeRenderer key={childId} node={child} store={store} />;
      })}
      
      {/* Debug bounds visualization */}
      {store.showGizmos && bounds && (
        <mesh>
          <boxGeometry args={[
            bounds.max.x - bounds.min.x,
            bounds.max.y - bounds.min.y,
            bounds.max.z - bounds.min.z
          ]} />
          <meshBasicMaterial color="#00ff00" wireframe transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
};

// =============================================================================
// ENHANCED WALL RENDERER WITH TEXTURES
// =============================================================================

const EnhancedWallNodeRenderer: React.FC<{ node: WallNode; isSelected: boolean }> = ({ 
  node, 
  isSelected 
}) => {
  const meshRef = useRef<Mesh>(null);
  const { camera } = useThree();
  
  const material = useMemo(() => {
    return createMaterial(node.material);
  }, [node.material]);
  
  // Wall collision check
  useFrame(() => {
    if (!meshRef.current) return;
    
    const wallPos = new Vector3(...node.transform.position);
    const camPos = camera.position;
    const distance = wallPos.distanceTo(camPos);
    
    // Push camera back if too close to wall
    if (distance < 1.0) {
      const direction = new Vector3().subVectors(camPos, wallPos).normalize();
      camera.position.add(direction.multiplyScalar(1.0 - distance));
    }
  });
  
  return (
    <group position={node.transform.position} quaternion={node.transform.rotation}>
      <mesh ref={meshRef} material={material} castShadow receiveShadow>
        <boxGeometry args={node.dimensions} />
      </mesh>
      
      {/* Selection highlight */}
      {isSelected && (
        <mesh>
          <boxGeometry args={[
            node.dimensions[0] + 0.05,
            node.dimensions[1] + 0.05,
            node.dimensions[2] + 0.05
          ]} />
          <meshBasicMaterial color="#00d4ff" wireframe />
        </mesh>
      )}
    </group>
  );
};

// =============================================================================
// ENHANCED FLOOR RENDERER WITH TEXTURES
// =============================================================================

const EnhancedFloorNodeRenderer: React.FC<{ node: FloorNode; isSelected: boolean }> = ({ 
  node, 
  isSelected 
}) => {
  const material = useMemo(() => {
    const mat = createMaterial(node.material);
    // Repeat texture for large floors
    if (mat.map) {
      mat.map.repeat.set(node.dimensions[0] / 2, node.dimensions[1] / 2);
    }
    return mat;
  }, [node.material, node.dimensions]);
  
  return (
    <group position={node.transform.position}>
      <mesh material={material} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={node.dimensions} />
      </mesh>
      
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[
            node.dimensions[0] + 0.05,
            node.dimensions[1] + 0.05
          ]} />
          <meshBasicMaterial color="#00d4ff" wireframe />
        </mesh>
      )}
    </group>
  );
};

// =============================================================================
// ENHANCED LIGHT RENDERER WITH SHADOWS
// =============================================================================

const EnhancedLightNodeRenderer: React.FC<{ node: LightNode; showGizmos: boolean }> = ({ 
  node, 
  showGizmos 
}) => {
  const lightColor = useMemo(() => {
    const [r, g, b] = node.color;
    return `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`;
  }, [node.color]);
  
  return (
    <group position={node.transform.position}>
      {node.lightType === 'point' && (
        <pointLight
          color={lightColor}
          intensity={node.intensity}
          distance={node.range || 10}
          castShadow={node.castShadows}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.1}
          shadow-camera-far={50}
        />
      )}
      {node.lightType === 'spot' && (
        <spotLight
          color={lightColor}
          intensity={node.intensity}
          distance={node.range || 10}
          angle={Math.PI / 6}
          penumbra={0.5}
          castShadow={node.castShadows}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
      )}
      {node.lightType === 'directional' && (
        <directionalLight
          color={lightColor}
          intensity={node.intensity}
          castShadow={node.castShadows}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
      )}
      
      {showGizmos && (
        <mesh>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color={lightColor} />
        </mesh>
      )}
    </group>
  );
};

// =============================================================================
// ENHANCED ITEM RENDERER
// =============================================================================

const EnhancedItemNodeRenderer: React.FC<{ node: ItemNode; isHovered: boolean }> = ({ 
  node, 
  isHovered 
}) => {
  const [hovered, setHovered] = useState(false);
  
  const glowIntensity = isHovered || hovered ? 0.8 : 0.3;
  
  return (
    <group 
      position={node.transform.position}
      quaternion={node.transform.rotation}
      scale={node.transform.scale}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Item geometry based on type */}
      {node.itemType === 'terminal' && (
        <>
          <mesh castShadow>
            <boxGeometry args={[0.8, 1.2, 0.4]} />
            <meshStandardMaterial 
              color="#1a1a2e" 
              emissive="#00d4ff" 
              emissiveIntensity={glowIntensity}
              roughness={0.3}
            />
          </mesh>
          {/* Screen glow */}
          <mesh position={[0, 0.1, 0.21]}>
            <planeGeometry args={[0.6, 0.8]} />
            <meshBasicMaterial color="#00d4ff" transparent opacity={0.5 + glowIntensity * 0.3} />
          </mesh>
        </>
      )}
      
      {node.itemType === 'display' && (
        <>
          <mesh castShadow>
            <cylinderGeometry args={[0.3, 0.3, 1.5, 16]} />
            <meshStandardMaterial 
              color="#0a0a12" 
              emissive="#ff6b35" 
              emissiveIntensity={glowIntensity}
            />
          </mesh>
          {/* Hologram */}
          <mesh position={[0, 1, 0]}>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshBasicMaterial color="#ff6b35" transparent opacity={0.3 + glowIntensity * 0.3} wireframe />
          </mesh>
        </>
      )}
      
      {node.itemType === 'artifact' && (
        <mesh castShadow>
          <octahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial 
            color="#ffd700" 
            metalness={1} 
            roughness={0.1}
            emissive="#ffd700"
            emissiveIntensity={glowIntensity * 0.5}
          />
        </mesh>
      )}
      
      {node.itemType === 'portal' && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.8, 1, 32]} />
            <meshBasicMaterial color="#9b59b6" transparent opacity={0.8} />
          </mesh>
          {/* Portal swirl */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
            <circleGeometry args={[0.8, 32]} />
            <meshBasicMaterial color="#4a0080" transparent opacity={0.6} />
          </mesh>
        </>
      )}
      
      {/* Hover highlight */}
      {(hovered || isHovered) && node.interactable && (
        <mesh>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.2} wireframe />
        </mesh>
      )}
    </group>
  );
};

// =============================================================================
// MAIN ENHANCED NODE RENDERER
// =============================================================================

interface EnhancedNodeRendererProps {
  node: AnyNode;
  store: RoomStore;
}

const EnhancedNodeRenderer: React.FC<EnhancedNodeRendererProps> = ({ node, store }) => {
  switch (node.type) {
    case 'room':
      return <EnhancedRoomNodeRenderer node={node as RoomNode} store={store} />;
    case 'wall':
      return <EnhancedWallNodeRenderer node={node as WallNode} isSelected={store.selectedNodeId === node.id} />;
    case 'floor':
      return <EnhancedFloorNodeRenderer node={node as FloorNode} isSelected={store.selectedNodeId === node.id} />;
    case 'light':
      return <EnhancedLightNodeRenderer node={node as LightNode} showGizmos={store.showGizmos} />;
    case 'item':
      return <EnhancedItemNodeRenderer node={node as ItemNode} isHovered={false} />;
    default:
      return null;
  }
};

// =============================================================================
// ENHANCED SCENE RENDERER WITH CAMERA SPAWN
// =============================================================================

interface EnhancedRoomSceneRendererProps {
  spawnPoint?: [number, number, number];
  enablePlayerControls?: boolean;
}

export const EnhancedRoomSceneRenderer: React.FC<EnhancedRoomSceneRendererProps> = ({ 
  spawnPoint,
  enablePlayerControls = true 
}) => {
  const store = useRoomStore();
  const { rootNodeIds, nodes } = store;
  
  // Find spawn point from level data if not provided
  const actualSpawnPoint = useMemo(() => {
    if (spawnPoint) return spawnPoint;
    
    // Look for a spawn zone
    const spawnZone = Object.values(nodes).find(
      (n) => n.type === 'zone' && (n as any).zoneType === 'spawn'
    );
    
    if (spawnZone) {
      return [
        spawnZone.transform.position[0],
        spawnZone.transform.position[1] + 1.6, // Eye level
        spawnZone.transform.position[2]
      ] as [number, number, number];
    }
    
    // Default spawn
    return [0, 1.6, 0] as [number, number, number];
  }, [spawnPoint, nodes]);
  
  // Guard: don't render if empty
  if (rootNodeIds.length === 0 || Object.keys(nodes).length === 0) {
    return null;
  }
  
  return (
    <>
      {/* Player controller with spawn */}
      <PlayerController 
        spawnPoint={actualSpawnPoint} 
        enabled={enablePlayerControls} 
      />
      
      {/* Render all root nodes */}
      {rootNodeIds.map((nodeId: string) => {
        const node = nodes[nodeId];
        if (!node || !node.visible) return null;
        return <EnhancedNodeRenderer key={nodeId} node={node} store={store} />;
      })}
    </>
  );
};

export default EnhancedRoomSceneRenderer;
