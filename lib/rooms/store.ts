/**
 * Room Scene Store
 * Zustand-based state management inspired by Pascal Editor
 * 
 * NOTE: Simplified for React 19 + Next.js 16 compatibility
 * - No immer middleware (causes Turbopack issues)
 * - No subscribeWithSelector (causes infinite loops)
 */

import { create } from 'zustand';
import { 
  SceneState, 
  AnyNode, 
  Transform,
  RoomNode,
  GeneratedLevel,
  EditorState,
  NavMeshData 
} from './types';

// =============================================================================
// INITIAL STATE
// =============================================================================

const defaultTransform: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

const initialSceneState: SceneState = {
  nodes: {},
  rootNodeIds: [],
  selectedNodeId: null,
  navigationMesh: undefined,
};

const initialEditorState: EditorState = {
  tool: 'select',
  snapToGrid: true,
  gridSize: 0.5,
  showGizmos: false,
  showNavMesh: false,
  showColliders: false,
  previewMode: false,
};

// =============================================================================
// STORE ACTIONS
// =============================================================================

interface SceneActions {
  // Node CRUD
  createNode: (node: Omit<AnyNode, 'id'>, parentId?: string | null) => string;
  updateNode: (id: string, updates: Partial<AnyNode>) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => string;
  
  // Transform
  setNodeTransform: (id: string, transform: Partial<Transform>) => void;
  setNodePosition: (id: string, position: [number, number, number]) => void;
  setNodeRotation: (id: string, rotation: [number, number, number, number]) => void;
  setNodeScale: (id: string, scale: [number, number, number]) => void;
  
  // Selection
  selectNode: (id: string | null) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  
  // Scene operations
  loadLevel: (level: GeneratedLevel) => void;
  clearScene: () => void;
  setNavMesh: (navMesh: NavMeshData | undefined) => void;
  
  // Serialization
  exportScene: () => string;
  importScene: (json: string) => void;
}

interface EditorActions {
  setTool: (tool: EditorState['tool']) => void;
  setSnapToGrid: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  toggleGizmos: () => void;
  toggleNavMesh: () => void;
  toggleColliders: () => void;
  setPreviewMode: (enabled: boolean) => void;
}

// =============================================================================
// ID GENERATION
// =============================================================================

function generateNodeId(type: string): string {
  const prefix = type.toLowerCase();
  const random = Math.random().toString(36).substring(2, 9);
  const timestamp = Date.now().toString(36).slice(-4);
  return `${prefix}_${random}${timestamp}`;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// =============================================================================
// STORE CREATION - Simple, no middleware
// =============================================================================

export type RoomStore = SceneState & EditorState & SceneActions & EditorActions;

export const useRoomStore = create<RoomStore>((set, get) => ({
  // Initial state
  ...initialSceneState,
  ...initialEditorState,

  // ===================================================================
  // NODE CRUD
  // ===================================================================
  
  createNode: (nodeData, parentId = null) => {
    const id = generateNodeId(nodeData.type);
    
    set((state) => {
      const node: AnyNode = {
        ...nodeData,
        id,
        parentId: parentId ?? null,
        transform: nodeData.transform ?? deepClone(defaultTransform),
      } as AnyNode;

      return {
        nodes: { ...state.nodes, [id]: node },
        rootNodeIds: parentId === null 
          ? [...state.rootNodeIds, id] 
          : state.rootNodeIds,
      };
    });

    return id;
  },

  updateNode: (id, updates) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node) return state;
      
      return {
        nodes: {
          ...state.nodes,
          [id]: { ...node, ...updates } as AnyNode,
        },
      };
    });
  },

  deleteNode: (id) => {
    set((state) => {
      // Find all children recursively
      const idsToDelete = new Set<string>([id]);
      const findChildren = (parentId: string) => {
        Object.values(state.nodes).forEach((n) => {
          if (n.parentId === parentId) {
            idsToDelete.add(n.id);
            findChildren(n.id);
          }
        });
      };
      findChildren(id);

      // Create new nodes object without deleted IDs
      const newNodes: Record<string, AnyNode> = {};
      Object.entries(state.nodes).forEach(([key, node]) => {
        if (!idsToDelete.has(key)) {
          newNodes[key] = node;
        }
      });

      return {
        nodes: newNodes,
        rootNodeIds: state.rootNodeIds.filter((rid) => !idsToDelete.has(rid)),
        selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      };
    });
  },

  duplicateNode: (id) => {
    const state = get();
    const original = state.nodes[id];
    if (!original) return '';

    const newId = get().createNode(
      deepClone({ ...original, parentId: original.parentId }),
      original.parentId
    );

    // Offset position slightly
    set((s) => {
      const node = s.nodes[newId];
      if (!node) return s;
      
      return {
        nodes: {
          ...s.nodes,
          [newId]: {
            ...node,
            transform: {
              ...node.transform,
              position: [
                node.transform.position[0] + 0.5,
                node.transform.position[1],
                node.transform.position[2] + 0.5,
              ],
            },
          } as AnyNode,
        },
      };
    });

    return newId;
  },

  // ===================================================================
  // TRANSFORM
  // ===================================================================

  setNodeTransform: (id, transform) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node) return state;
      
      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...node,
            transform: { ...node.transform, ...transform },
          } as AnyNode,
        },
      };
    });
  },

  setNodePosition: (id, position) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node) return state;
      
      // Apply grid snapping
      const finalPosition = state.snapToGrid
        ? position.map((v) => Math.round(v / state.gridSize) * state.gridSize) as [number, number, number]
        : position;

      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...node,
            transform: { ...node.transform, position: finalPosition },
          } as AnyNode,
        },
      };
    });
  },

  setNodeRotation: (id, rotation) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node) return state;
      
      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...node,
            transform: { ...node.transform, rotation },
          } as AnyNode,
        },
      };
    });
  },

  setNodeScale: (id, scale) => {
    set((state) => {
      const node = state.nodes[id];
      if (!node) return state;
      
      return {
        nodes: {
          ...state.nodes,
          [id]: {
            ...node,
            transform: { ...node.transform, scale },
          } as AnyNode,
        },
      };
    });
  },

  // ===================================================================
  // SELECTION
  // ===================================================================

  selectNode: (id) => {
    set({ selectedNodeId: id });
  },

  selectNext: () => {
    set((state) => {
      const ids = Object.keys(state.nodes);
      if (ids.length === 0) return state;

      const currentIndex = state.selectedNodeId 
        ? ids.indexOf(state.selectedNodeId)
        : -1;
      const nextIndex = (currentIndex + 1) % ids.length;
      return { selectedNodeId: ids[nextIndex] };
    });
  },

  selectPrevious: () => {
    set((state) => {
      const ids = Object.keys(state.nodes);
      if (ids.length === 0) return state;

      const currentIndex = state.selectedNodeId 
        ? ids.indexOf(state.selectedNodeId)
        : 0;
      const prevIndex = currentIndex <= 0 ? ids.length - 1 : currentIndex - 1;
      return { selectedNodeId: ids[prevIndex] };
    });
  },

  // ===================================================================
  // SCENE OPERATIONS
  // ===================================================================

  loadLevel: (level) => {
    const nodesMap: Record<string, AnyNode> = {};
    const rootIds: string[] = [];
    
    for (const node of level.nodes) {
      nodesMap[node.id] = node;
      if (node.parentId === null) {
        rootIds.push(node.id);
      }
    }
    
    set({
      nodes: nodesMap,
      rootNodeIds: rootIds,
      navigationMesh: level.navMesh,
      selectedNodeId: null,
    });
  },

  clearScene: () => {
    set({
      nodes: {},
      rootNodeIds: [],
      selectedNodeId: null,
      navigationMesh: undefined,
    });
  },

  setNavMesh: (navMesh) => {
    set({ navigationMesh: navMesh });
  },

  // ===================================================================
  // SERIALIZATION
  // ===================================================================

  exportScene: () => {
    const state = get();
    return JSON.stringify({
      nodes: state.nodes,
      rootNodeIds: state.rootNodeIds,
      navigationMesh: state.navigationMesh,
      version: '1.0',
      exportedAt: new Date().toISOString(),
    }, null, 2);
  },

  importScene: (json) => {
    try {
      const data = JSON.parse(json);
      set({
        nodes: data.nodes || {},
        rootNodeIds: data.rootNodeIds || [],
        navigationMesh: data.navigationMesh,
        selectedNodeId: null,
      });
    } catch (e) {
      console.error('Failed to import scene:', e);
    }
  },

  // ===================================================================
  // EDITOR ACTIONS
  // ===================================================================

  setTool: (tool) => {
    set({ tool });
  },

  setSnapToGrid: (enabled) => {
    set({ snapToGrid: enabled });
  },

  setGridSize: (size) => {
    set({ gridSize: size });
  },

  toggleGizmos: () => {
    set((state) => ({ showGizmos: !state.showGizmos }));
  },

  toggleNavMesh: () => {
    set((state) => ({ showNavMesh: !state.showNavMesh }));
  },

  toggleColliders: () => {
    set((state) => ({ showColliders: !state.showColliders }));
  },

  setPreviewMode: (enabled) => {
    set({ previewMode: enabled });
  },
}));

// =============================================================================
// SELECTORS - Helper hooks for common selections
// =============================================================================

export function useSelectedNode(): AnyNode | null {
  const store = useRoomStore();
  return store.selectedNodeId ? store.nodes[store.selectedNodeId] : null;
}

export function useRoomNodes(): RoomNode[] {
  const store = useRoomStore();
  return Object.values(store.nodes).filter((n) => n.type === 'room') as RoomNode[];
}

export function useChildNodes(parentId: string): AnyNode[] {
  const store = useRoomStore();
  return Object.values(store.nodes).filter((n) => n.parentId === parentId);
}

export function useRootNodes(): AnyNode[] {
  const store = useRoomStore();
  return store.rootNodeIds.map((id) => store.nodes[id]).filter(Boolean);
}
