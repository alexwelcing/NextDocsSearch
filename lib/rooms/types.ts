/**
 * 3D Room System Types
 * Inspired by Pascal Editor architecture
 * Node-based scene graph for procedural room generation
 */

import { Vec3 } from 'navcat';

// =============================================================================
// NODE TYPES
// =============================================================================

export type NodeType = 
  | 'site'
  | 'building' 
  | 'room'
  | 'wall'
  | 'floor'
  | 'ceiling'
  | 'door'
  | 'window'
  | 'item'
  | 'zone'
  | 'light'
  | 'spawn';

export interface BaseNode {
  id: string;
  type: NodeType;
  parentId: string | null;
  visible: boolean;
  name: string;
  transform: Transform;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface Transform {
  position: [number, number, number];
  rotation: [number, number, number, number]; // quaternion
  scale: [number, number, number];
}

// =============================================================================
// ROOM NODES
// =============================================================================

export interface RoomNode extends BaseNode {
  type: 'room';
  dimensions: [number, number, number]; // width, height, depth
  style: RoomStyle;
  theme: RoomTheme;
}

export interface WallNode extends BaseNode {
  type: 'wall';
  dimensions: [number, number, number]; // width, height, thickness
  material: MaterialRef;
  hasOpening: boolean;
  openings: Opening[];
}

export interface FloorNode extends BaseNode {
  type: 'floor';
  dimensions: [number, number]; // width, depth
  material: MaterialRef;
  walkable: boolean;
}

export interface Opening {
  id: string;
  type: 'door' | 'window' | 'arch';
  position: [number, number]; // relative to wall center
  dimensions: [number, number];
  connectsTo?: string; // room ID
}

// =============================================================================
// ITEM NODES
// =============================================================================

export interface ItemNode extends BaseNode {
  type: 'item';
  itemType: string;
  category: 'furniture' | 'decoration' | 'interactive' | 'light';
  interactable: boolean;
  physics?: PhysicsProperties;
}

export interface PhysicsProperties {
  mass: number;
  restitution: number;
  friction: number;
  collider: 'box' | 'sphere' | 'mesh';
  motionType: 'static' | 'dynamic' | 'kinematic';
}

// =============================================================================
// ZONE NODES
// =============================================================================

export interface ZoneNode extends BaseNode {
  type: 'zone';
  zoneType: 'walkable' | 'trigger' | 'spawn' | 'restricted';
  shape: ZoneShape;
  properties: ZoneProperties;
}

export type ZoneShape = 
  | { type: 'box'; size: [number, number, number] }
  | { type: 'sphere'; radius: number }
  | { type: 'cylinder'; radius: number; height: number };

export interface ZoneProperties {
  walkable?: boolean;
  spawnPoint?: boolean;
  spawnType?: 'player' | 'npc' | 'item';
  triggerAction?: string;
}

// =============================================================================
// LIGHT NODES
// =============================================================================

export interface LightNode extends BaseNode {
  type: 'light';
  lightType: 'ambient' | 'directional' | 'point' | 'spot';
  color: [number, number, number];
  intensity: number;
  range?: number;
  castShadows: boolean;
}

// =============================================================================
// SCENE STATE
// =============================================================================

export interface SceneState {
  nodes: Record<string, AnyNode>;
  rootNodeIds: string[];
  selectedNodeId: string | null;
  cameraTransform?: Transform;
  navigationMesh?: NavMeshData;
}

export type AnyNode = 
  | RoomNode 
  | WallNode 
  | FloorNode 
  | ItemNode 
  | ZoneNode 
  | LightNode 
  | BaseNode;

// =============================================================================
// ROOM STYLES & THEMES
// =============================================================================

export type RoomStyle = 
  | 'modern'
  | 'industrial'
  | 'sci-fi'
  | 'natural'
  | 'minimal'
  | 'cyberpunk'
  | 'ancient';

export interface RoomTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  materials: MaterialRef[];
  lighting: 'warm' | 'cool' | 'neutral' | 'dramatic';
}

export interface MaterialRef {
  id: string;
  type: 'standard' | 'physical' | 'shader';
  properties: MaterialProperties;
}

export interface MaterialProperties {
  color?: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  texture?: string;
  normalMap?: string;
  transparent?: boolean;
  opacity?: number;
}

// =============================================================================
// NAVIGATION MESH DATA
// =============================================================================

export interface NavMeshData {
  positions: Float32Array;
  indices: Uint32Array;
  tileData?: Uint8Array;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  agentRadius: number;
  agentHeight: number;
  agentClimb: number;
}

// =============================================================================
// LEVEL GENERATION
// =============================================================================

export interface LevelConfig {
  seed: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'maze';
  roomCount: number;
  theme: RoomTheme;
  constraints: LevelConstraints;
}

export interface LevelConstraints {
  minRoomSize: [number, number, number];
  maxRoomSize: [number, number, number];
  connectAllRooms: boolean;
  requireLoops: boolean;
  maxDepth: number;
}

export interface GeneratedLevel {
  id: string;
  name: string;
  nodes: AnyNode[];
  navMesh: NavMeshData;
  spawnPoints: [number, number, number][];
  metadata: {
    generatedAt: string;
    seed: string;
    version: string;
    [key: string]: any;
  };
}

// =============================================================================
// EDITOR STATE
// =============================================================================

export interface EditorState {
  tool: EditorTool;
  snapToGrid: boolean;
  gridSize: number;
  showGizmos: boolean;
  showNavMesh: boolean;
  showColliders: boolean;
  previewMode: boolean;
}

export type EditorTool = 
  | 'select'
  | 'move'
  | 'rotate'
  | 'scale'
  | 'wall'
  | 'floor'
  | 'item'
  | 'zone'
  | 'erase';

// =============================================================================
// PHYSICS STATE
// =============================================================================

export interface PhysicsState {
  world: PhysicsWorldRef | null;
  bodies: Record<string, PhysicsBodyRef>;
  enabled: boolean;
  gravity: [number, number, number];
  timeStep: number;
}

export interface PhysicsWorldRef {
  id: string;
  step: (deltaTime: number) => void;
  addBody: (body: PhysicsBodyDef) => PhysicsBodyRef;
  removeBody: (id: string) => void;
  raycast: (from: Vec3, to: Vec3) => RaycastHit | null;
}

export interface PhysicsBodyRef {
  id: string;
  position: Vec3;
  rotation: [number, number, number, number];
  setPosition: (pos: Vec3) => void;
  applyForce: (force: Vec3) => void;
}

export interface PhysicsBodyDef {
  id: string;
  shape: 'box' | 'sphere' | 'capsule' | 'mesh';
  position: Vec3;
  rotation?: [number, number, number, number];
  motionType: 'static' | 'dynamic' | 'kinematic';
  mass?: number;
  size?: [number, number, number];
  radius?: number;
}

export interface RaycastHit {
  point: Vec3;
  normal: Vec3;
  distance: number;
  bodyId: string;
}
