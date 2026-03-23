/**
 * Procedural Room/Level Generator
 * Generates 3D room layouts with navigation mesh support
 */

import { 
  LevelConfig, 
  GeneratedLevel, 
  AnyNode, 
  RoomNode, 
  WallNode, 
  FloorNode,
  ZoneNode,
  RoomTheme,
  NavMeshData,
  Transform
} from './types';

// =============================================================================
// SEEDED RANDOM
// =============================================================================

class SeededRandom {
  private seed: number;

  constructor(seed: string) {
    this.seed = this.hashString(seed);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

// =============================================================================
// THEMES
// =============================================================================

const themes: Record<string, RoomTheme> = {
  sciFi: {
    primaryColor: '#1a1a2e',
    secondaryColor: '#16213e',
    accentColor: '#00d4ff',
    materials: [
      { id: 'metal', type: 'standard', properties: { color: '#4a5568', metalness: 0.8, roughness: 0.2 } },
      { id: 'glow', type: 'standard', properties: { color: '#00d4ff', emissive: '#00d4ff', emissiveIntensity: 0.5 } },
    ],
    lighting: 'cool',
  },
  natural: {
    primaryColor: '#2d3748',
    secondaryColor: '#4a5568',
    accentColor: '#68d391',
    materials: [
      { id: 'wood', type: 'standard', properties: { color: '#8b4513', roughness: 0.8 } },
      { id: 'stone', type: 'standard', properties: { color: '#718096', roughness: 0.9 } },
    ],
    lighting: 'warm',
  },
  cyberpunk: {
    primaryColor: '#0a0a0f',
    secondaryColor: '#1a1a2e',
    accentColor: '#ff00ff',
    materials: [
      { id: 'darkMetal', type: 'standard', properties: { color: '#1a202c', metalness: 0.9, roughness: 0.1 } },
      { id: 'neon', type: 'standard', properties: { color: '#ff00ff', emissive: '#ff00ff', emissiveIntensity: 1 } },
    ],
    lighting: 'dramatic',
  },
  minimal: {
    primaryColor: '#f7fafc',
    secondaryColor: '#e2e8f0',
    accentColor: '#3182ce',
    materials: [
      { id: 'white', type: 'standard', properties: { color: '#ffffff', roughness: 0.5 } },
      { id: 'accent', type: 'standard', properties: { color: '#3182ce' } },
    ],
    lighting: 'neutral',
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function createTransform(
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number, number] = [0, 0, 0, 1],
  scale: [number, number, number] = [1, 1, 1]
): Transform {
  return { position, rotation, scale };
}

function generateId(type: string, index: number): string {
  return `${type}_${index}_${Date.now().toString(36)}`;
}

// =============================================================================
// ROOM GENERATION
// =============================================================================

interface RoomDef {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  connections: string[];
}

function generateRoomLayout(
  config: LevelConfig,
  rng: SeededRandom
): RoomDef[] {
  const rooms: RoomDef[] = [];
  const { roomCount, complexity, constraints } = config;
  
  const [minW, minH, minD] = constraints.minRoomSize;
  const [maxW, maxH, maxD] = constraints.maxRoomSize;
  
  // Start with a main room
  const mainRoom: RoomDef = {
    id: generateId('room', 0),
    position: [0, 0, 0],
    size: [
      rng.range(minW, maxW),
      rng.range(minH, maxH),
      rng.range(minD, maxD),
    ],
    connections: [],
  };
  rooms.push(mainRoom);
  
  // Generate additional rooms
  let attempts = 0;
  const maxAttempts = roomCount * 10;
  
  while (rooms.length < roomCount && attempts < maxAttempts) {
    attempts++;
    
    // Pick a random existing room to connect from
    const parentRoom = rng.pick(rooms);
    
    // Generate new room size
    const newSize: [number, number, number] = [
      rng.range(minW, maxW),
      rng.range(minH, maxH),
      rng.range(minD, maxD),
    ];
    
    // Pick a random side to connect
    const side = rng.rangeInt(0, 3); // 0: +x, 1: -x, 2: +z, 3: -z
    
    let newPos: [number, number, number];
    const gap = 0.5; // Gap for corridor
    
    switch (side) {
      case 0: // +x
        newPos = [
          parentRoom.position[0] + parentRoom.size[0]/2 + newSize[0]/2 + gap,
          0,
          parentRoom.position[2] + rng.range(-parentRoom.size[2]/4, parentRoom.size[2]/4),
        ];
        break;
      case 1: // -x
        newPos = [
          parentRoom.position[0] - parentRoom.size[0]/2 - newSize[0]/2 - gap,
          0,
          parentRoom.position[2] + rng.range(-parentRoom.size[2]/4, parentRoom.size[2]/4),
        ];
        break;
      case 2: // +z
        newPos = [
          parentRoom.position[0] + rng.range(-parentRoom.size[0]/4, parentRoom.size[0]/4),
          0,
          parentRoom.position[2] + parentRoom.size[2]/2 + newSize[2]/2 + gap,
        ];
        break;
      default: // -z
        newPos = [
          parentRoom.position[0] + rng.range(-parentRoom.size[0]/4, parentRoom.size[0]/4),
          0,
          parentRoom.position[2] - parentRoom.size[2]/2 - newSize[2]/2 - gap,
        ];
    }
    
    // Check for overlap with existing rooms
    const overlaps = rooms.some((room) => {
      const dx = Math.abs(room.position[0] - newPos[0]);
      const dz = Math.abs(room.position[2] - newPos[2]);
      const minDx = (room.size[0] + newSize[0]) / 2 + 0.5;
      const minDz = (room.size[2] + newSize[2]) / 2 + 0.5;
      return dx < minDx && dz < minDz;
    });
    
    if (!overlaps) {
      const newRoom: RoomDef = {
        id: generateId('room', rooms.length),
        position: newPos,
        size: newSize,
        connections: [parentRoom.id],
      };
      parentRoom.connections.push(newRoom.id);
      rooms.push(newRoom);
    }
  }
  
  // Add extra connections for loops if requested
  if (complexity === 'complex' || complexity === 'maze') {
    for (const room of rooms) {
      const potentialConnections = rooms.filter(
        (r) => r.id !== room.id && !room.connections.includes(r.id)
      );
      
      for (const other of potentialConnections) {
        if (rng.chance(0.2)) { // 20% chance for extra connection
          const dx = Math.abs(room.position[0] - other.position[0]);
          const dz = Math.abs(room.position[2] - other.position[2]);
          const maxDist = Math.max(room.size[0], room.size[2]) * 2;
          
          if (dx < maxDist && dz < maxDist) {
            room.connections.push(other.id);
            other.connections.push(room.id);
          }
        }
      }
    }
  }
  
  return rooms;
}

function generateRoomNodes(
  roomDefs: RoomDef[],
  theme: RoomTheme,
  rng: SeededRandom
): AnyNode[] {
  const nodes: AnyNode[] = [];
  
  for (const roomDef of roomDefs) {
    // Create room node
    const roomNode: RoomNode = {
      id: roomDef.id,
      type: 'room',
      parentId: null,
      visible: true,
      name: `Room ${roomDef.id}`,
      transform: createTransform(roomDef.position),
      dimensions: roomDef.size,
      style: rng.pick(['modern', 'sci-fi', 'industrial', 'natural']),
      theme,
    };
    nodes.push(roomNode);
    
    // Create floor
    const floorNode: FloorNode = {
      id: generateId('floor', nodes.length),
      type: 'floor',
      parentId: roomDef.id,
      visible: true,
      name: 'Floor',
      transform: createTransform([
        roomDef.position[0],
        roomDef.position[1] - roomDef.size[1] / 2,
        roomDef.position[2],
      ]),
      dimensions: [roomDef.size[0], roomDef.size[2]],
      material: theme.materials[0],
      walkable: true,
    };
    nodes.push(floorNode);
    
    // Create walls
    const wallThickness = 0.2;
    const halfWidth = roomDef.size[0] / 2;
    const halfDepth = roomDef.size[2] / 2;
    const height = roomDef.size[1];
    
    // North wall (+z)
    const northWall: WallNode = {
      id: generateId('wall', nodes.length),
      type: 'wall',
      parentId: roomDef.id,
      visible: true,
      name: 'North Wall',
      transform: createTransform(
        [roomDef.position[0], roomDef.position[1], roomDef.position[2] + halfDepth],
        [0, 0, 0, 1]
      ),
      dimensions: [roomDef.size[0], height, wallThickness],
      material: theme.materials[0],
      hasOpening: false,
      openings: [],
    };
    nodes.push(northWall);
    
    // South wall (-z)
    const southWall: WallNode = {
      id: generateId('wall', nodes.length),
      type: 'wall',
      parentId: roomDef.id,
      visible: true,
      name: 'South Wall',
      transform: createTransform(
        [roomDef.position[0], roomDef.position[1], roomDef.position[2] - halfDepth],
        [0, 0, 0, 1]
      ),
      dimensions: [roomDef.size[0], height, wallThickness],
      material: theme.materials[0],
      hasOpening: false,
      openings: [],
    };
    nodes.push(southWall);
    
    // East wall (+x)
    const eastWall: WallNode = {
      id: generateId('wall', nodes.length),
      type: 'wall',
      parentId: roomDef.id,
      visible: true,
      name: 'East Wall',
      transform: createTransform(
        [roomDef.position[0] + halfWidth, roomDef.position[1], roomDef.position[2]],
        [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)]
      ),
      dimensions: [roomDef.size[2], height, wallThickness],
      material: theme.materials[0],
      hasOpening: false,
      openings: [],
    };
    nodes.push(eastWall);
    
    // West wall (-x)
    const westWall: WallNode = {
      id: generateId('wall', nodes.length),
      type: 'wall',
      parentId: roomDef.id,
      visible: true,
      name: 'West Wall',
      transform: createTransform(
        [roomDef.position[0] - halfWidth, roomDef.position[1], roomDef.position[2]],
        [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)]
      ),
      dimensions: [roomDef.size[2], height, wallThickness],
      material: theme.materials[0],
      hasOpening: false,
      openings: [],
    };
    nodes.push(westWall);
    
    // Create spawn point zone in center of room
    const spawnZone: ZoneNode = {
      id: generateId('zone', nodes.length),
      type: 'zone',
      parentId: roomDef.id,
      visible: false,
      name: 'Spawn Zone',
      transform: createTransform(roomDef.position),
      zoneType: 'spawn',
      shape: { type: 'sphere', radius: 1 },
      properties: { spawnPoint: true, spawnType: 'player' },
    };
    nodes.push(spawnZone);
  }
  
  return nodes;
}

// =============================================================================
// NAVMESH GENERATION
// =============================================================================

function generateNavMesh(
  roomDefs: RoomDef[],
  agentRadius: number = 0.3,
  agentHeight: number = 2.0,
  agentClimb: number = 0.5
): NavMeshData {
  // Collect floor geometry from all rooms
  const positions: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;
  
  for (const room of roomDefs) {
    const halfW = room.size[0] / 2;
    const halfD = room.size[2] / 2;
    const y = room.position[1] - room.size[1] / 2;
    
    // Floor quad vertices (counter-clockwise)
    const roomVerts = [
      // Top-left
      room.position[0] - halfW, y, room.position[2] - halfD,
      // Top-right
      room.position[0] + halfW, y, room.position[2] - halfD,
      // Bottom-right
      room.position[0] + halfW, y, room.position[2] + halfD,
      // Bottom-left
      room.position[0] - halfW, y, room.position[2] + halfD,
    ];
    
    positions.push(...roomVerts);
    
    // Two triangles for the quad
    indices.push(
      vertexOffset, vertexOffset + 1, vertexOffset + 2,
      vertexOffset, vertexOffset + 2, vertexOffset + 3
    );
    
    vertexOffset += 4;
  }
  
  // Calculate bounds
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    minZ = Math.min(minZ, positions[i + 2]);
    maxX = Math.max(maxX, positions[i]);
    maxY = Math.max(maxY, positions[i + 1]);
    maxZ = Math.max(maxZ, positions[i + 2]);
  }
  
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    bounds: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    },
    agentRadius,
    agentHeight,
    agentClimb,
  };
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

export function generateLevel(config: LevelConfig): GeneratedLevel {
  const rng = new SeededRandom(config.seed);
  const theme = config.theme || themes.sciFi;
  
  // Generate room layout
  const roomDefs = generateRoomLayout(config, rng);
  
  // Generate nodes
  const nodes = generateRoomNodes(roomDefs, theme, rng);
  
  // Generate navigation mesh
  const navMesh = generateNavMesh(roomDefs);
  
  // Collect spawn points
  const spawnPoints: [number, number, number][] = roomDefs.map(
    (r) => [r.position[0], r.position[1], r.position[2]]
  );
  
  return {
    id: generateId('level', 0),
    name: `Generated Level ${config.seed}`,
    nodes,
    navMesh,
    spawnPoints,
    metadata: {
      generatedAt: new Date().toISOString(),
      seed: config.seed,
      version: '1.0',
    },
  };
}

// =============================================================================
// PRESET LEVELS
// =============================================================================

export const levelPresets = {
  simple: (seed?: string): LevelConfig => ({
    seed: seed || `simple_${Date.now()}`,
    complexity: 'simple',
    roomCount: 3,
    theme: themes.minimal,
    constraints: {
      minRoomSize: [4, 3, 4],
      maxRoomSize: [8, 4, 8],
      connectAllRooms: true,
      requireLoops: false,
      maxDepth: 2,
    },
  }),
  
  complex: (seed?: string): LevelConfig => ({
    seed: seed || `complex_${Date.now()}`,
    complexity: 'complex',
    roomCount: 8,
    theme: themes.sciFi,
    constraints: {
      minRoomSize: [5, 3, 5],
      maxRoomSize: [12, 5, 12],
      connectAllRooms: true,
      requireLoops: true,
      maxDepth: 4,
    },
  }),
  
  maze: (seed?: string): LevelConfig => ({
    seed: seed || `maze_${Date.now()}`,
    complexity: 'maze',
    roomCount: 15,
    theme: themes.cyberpunk,
    constraints: {
      minRoomSize: [3, 3, 3],
      maxRoomSize: [6, 4, 6],
      connectAllRooms: true,
      requireLoops: true,
      maxDepth: 6,
    },
  }),
};

export function generatePresetLevel(
  preset: keyof typeof levelPresets,
  seed?: string
): GeneratedLevel {
  const config = levelPresets[preset](seed);
  return generateLevel(config);
}
