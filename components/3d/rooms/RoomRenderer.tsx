/**
 * Room Renderer Component
 * Renders room nodes in React Three Fiber
 * 
 * NOTE: React 19 + Zustand v5 compatibility requires careful handling.
 * We use whole-store subscription to avoid selector instability issues.
 */

import React, { useRef, useMemo } from 'react';
import { Mesh, MeshStandardMaterial } from 'three';
import { useRoomStore, type RoomStore } from '@/lib/rooms/store';
import { AnyNode, RoomNode, WallNode, FloorNode, ZoneNode, LightNode } from '@/lib/rooms/types';

// =============================================================================
// SCENE RENDERER - Main entry point
// =============================================================================

export const RoomSceneRenderer: React.FC = () => {
  // Subscribe to entire store - avoids selector churn in React 19
  const store = useRoomStore();
  
  const { rootNodeIds, nodes } = store;
  
  // Guard: don't render if empty
  if (rootNodeIds.length === 0 || Object.keys(nodes).length === 0) {
    return null;
  }
  
  return (
    <>
      {rootNodeIds.map((nodeId: string) => {
        const node = nodes[nodeId];
        if (!node || !node.visible) return null;
        return <NodeRenderer key={nodeId} node={node} store={store} />;
      })}
    </>
  );
};

// =============================================================================
// NODE RENDERER DISPATCH
// =============================================================================

interface NodeRendererProps {
  node: AnyNode;
  store: RoomStore;
}

const NodeRenderer: React.FC<NodeRendererProps> = ({ node, store }) => {
  switch (node.type) {
    case 'room':
      return <RoomNodeRenderer node={node as RoomNode} store={store} />;
    case 'wall':
      return <WallNodeRenderer node={node as WallNode} isSelected={store.selectedNodeId === node.id} />;
    case 'floor':
      return <FloorNodeRenderer node={node as FloorNode} isSelected={store.selectedNodeId === node.id} />;
    case 'zone':
      return <ZoneNodeRenderer node={node as ZoneNode} showGizmos={store.showGizmos} />;
    case 'light':
      return <LightNodeRenderer node={node as LightNode} showGizmos={store.showGizmos} />;
    default:
      return <GenericNodeRenderer node={node} />;
  }
};

// =============================================================================
// ROOM NODE
// =============================================================================

const RoomNodeRenderer: React.FC<{ node: RoomNode; store: RoomStore }> = ({ node, store }) => {
  // Compute children from store nodes
  const childIds = useMemo(() => 
    Object.values(store.nodes)
      .filter((n) => n.parentId === node.id)
      .map((n) => n.id),
    [store.nodes, node.id]
  );
  
  return (
    <group
      position={node.transform.position}
      quaternion={node.transform.rotation}
      scale={node.transform.scale}
    >
      {childIds.map((childId) => {
        const child = store.nodes[childId];
        if (!child || !child.visible) return null;
        return <NodeRenderer key={childId} node={child} store={store} />;
      })}
      
      {store.showGizmos && (
        <mesh>
          <boxGeometry args={node.dimensions} />
          <meshBasicMaterial 
            color={node.theme.accentColor} 
            wireframe 
            transparent 
            opacity={0.3} 
          />
        </mesh>
      )}
    </group>
  );
};

// =============================================================================
// WALL NODE
// =============================================================================

const WallNodeRenderer: React.FC<{ node: WallNode; isSelected: boolean }> = ({ node, isSelected }) => {
  const meshRef = useRef<Mesh>(null);
  
  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: node.material.properties.color || '#808080',
      roughness: node.material.properties.roughness ?? 0.5,
      metalness: node.material.properties.metalness ?? 0,
    });
  }, [node.material]);
  
  return (
    <group
      position={node.transform.position}
      quaternion={node.transform.rotation}
    >
      <mesh ref={meshRef} material={material} castShadow receiveShadow>
        <boxGeometry args={node.dimensions} />
      </mesh>
      
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
// FLOOR NODE
// =============================================================================

const FloorNodeRenderer: React.FC<{ node: FloorNode; isSelected: boolean }> = ({ node, isSelected }) => {
  const meshRef = useRef<Mesh>(null);
  
  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: node.material.properties.color || '#404040',
      roughness: node.material.properties.roughness ?? 0.8,
      metalness: node.material.properties.metalness ?? 0,
    });
  }, [node.material]);
  
  return (
    <group position={node.transform.position}>
      <mesh 
        ref={meshRef} 
        material={material} 
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
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
// ZONE NODE
// =============================================================================

const ZoneNodeRenderer: React.FC<{ node: ZoneNode; showGizmos: boolean }> = ({ node, showGizmos }) => {
  if (!showGizmos) return null;
  
  const color = node.zoneType === 'spawn' ? '#00ff00' : 
                node.zoneType === 'trigger' ? '#ffff00' : 
                node.zoneType === 'restricted' ? '#ff0000' : '#0088ff';
  
  const renderShape = () => {
    switch (node.shape.type) {
      case 'box':
        return (
          <mesh>
            <boxGeometry args={node.shape.size} />
            <meshBasicMaterial color={color} transparent opacity={0.2} wireframe />
          </mesh>
        );
      case 'sphere':
        return (
          <mesh>
            <sphereGeometry args={[node.shape.radius, 16, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.2} wireframe />
          </mesh>
        );
      case 'cylinder':
        return (
          <mesh>
            <cylinderGeometry args={[node.shape.radius, node.shape.radius, node.shape.height, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.2} wireframe />
          </mesh>
        );
    }
  };
  
  return (
    <group
      position={node.transform.position}
      quaternion={node.transform.rotation}
      scale={node.transform.scale}
    >
      {renderShape()}
    </group>
  );
};

// =============================================================================
// LIGHT NODE
// =============================================================================

const LightNodeRenderer: React.FC<{ node: LightNode; showGizmos: boolean }> = ({ node, showGizmos }) => {
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
        />
      )}
      {node.lightType === 'directional' && (
        <directionalLight
          color={lightColor}
          intensity={node.intensity}
          castShadow={node.castShadows}
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
// GENERIC NODE (fallback)
// =============================================================================

const GenericNodeRenderer: React.FC<{ node: AnyNode }> = ({ node }) => {
  return (
    <group
      position={node.transform.position}
      quaternion={node.transform.rotation}
      scale={node.transform.scale}
    >
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#808080" />
      </mesh>
    </group>
  );
};

// =============================================================================
// STATIC NODE RENDERER (for previews - no store dependency)
// =============================================================================

interface StaticNodeRendererProps {
  node: AnyNode;
  allNodes: Record<string, AnyNode>;
}

const StaticNodeRenderer: React.FC<StaticNodeRendererProps> = ({ node, allNodes }) => {
  if (!node || !node.visible) return null;
  
  switch (node.type) {
    case 'room':
      return <StaticRoomNodeRenderer node={node as RoomNode} allNodes={allNodes} />;
    case 'wall':
      return <StaticWallNodeRenderer node={node as WallNode} />;
    case 'floor':
      return <StaticFloorNodeRenderer node={node as FloorNode} />;
    case 'zone':
      return null; // Skip zones in preview
    case 'light':
      return <StaticLightNodeRenderer node={node as LightNode} />;
    default:
      return <StaticGenericNodeRenderer node={node} />;
  }
};

const StaticRoomNodeRenderer: React.FC<{ node: RoomNode; allNodes: Record<string, AnyNode> }> = ({ 
  node, 
  allNodes 
}) => {
  const childIds = useMemo(() =>
    Object.values(allNodes)
      .filter((n) => n.parentId === node.id)
      .map((n) => n.id),
    [allNodes, node.id]
  );
  
  return (
    <group
      position={node.transform.position}
      quaternion={node.transform.rotation}
      scale={node.transform.scale}
    >
      {childIds.map((childId) => (
        <StaticNodeRenderer key={childId} node={allNodes[childId]} allNodes={allNodes} />
      ))}
      
      <mesh>
        <boxGeometry args={node.dimensions} />
        <meshBasicMaterial 
          color={node.theme.accentColor} 
          wireframe 
          transparent 
          opacity={0.3} 
        />
      </mesh>
    </group>
  );
};

const StaticWallNodeRenderer: React.FC<{ node: WallNode }> = ({ node }) => {
  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: node.material.properties.color || '#808080',
      roughness: node.material.properties.roughness ?? 0.5,
      metalness: node.material.properties.metalness ?? 0,
    });
  }, [node.material]);
  
  return (
    <group
      position={node.transform.position}
      quaternion={node.transform.rotation}
    >
      <mesh material={material} castShadow receiveShadow>
        <boxGeometry args={node.dimensions} />
      </mesh>
    </group>
  );
};

const StaticFloorNodeRenderer: React.FC<{ node: FloorNode }> = ({ node }) => {
  const material = useMemo(() => {
    return new MeshStandardMaterial({
      color: node.material.properties.color || '#404040',
      roughness: node.material.properties.roughness ?? 0.8,
      metalness: node.material.properties.metalness ?? 0,
    });
  }, [node.material]);
  
  return (
    <group position={node.transform.position}>
      <mesh material={material} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={node.dimensions} />
      </mesh>
    </group>
  );
};

const StaticLightNodeRenderer: React.FC<{ node: LightNode }> = ({ node }) => {
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
        />
      )}
      {node.lightType === 'directional' && (
        <directionalLight
          color={lightColor}
          intensity={node.intensity}
          castShadow={node.castShadows}
        />
      )}
    </group>
  );
};

const StaticGenericNodeRenderer: React.FC<{ node: AnyNode }> = ({ node }) => {
  return (
    <group
      position={node.transform.position}
      quaternion={node.transform.rotation}
      scale={node.transform.scale}
    >
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#808080" />
      </mesh>
    </group>
  );
};

// =============================================================================
// STATIC LEVEL RENDERER (for card previews - no store dependency)
// =============================================================================

export interface StaticLevelRendererProps {
  nodes: AnyNode[];
}

export const StaticLevelRenderer: React.FC<StaticLevelRendererProps> = ({ nodes }) => {
  const nodesMap = useMemo(() => {
    const map: Record<string, AnyNode> = {};
    for (const node of nodes) {
      map[node.id] = node;
    }
    return map;
  }, [nodes]);
  
  const rootNodes = useMemo(() => 
    nodes.filter((n) => n.parentId === null),
    [nodes]
  );
  
  return (
    <>
      {rootNodes.map((node) => (
        <StaticNodeRenderer key={node.id} node={node} allNodes={nodesMap} />
      ))}
    </>
  );
};

export default RoomSceneRenderer;
