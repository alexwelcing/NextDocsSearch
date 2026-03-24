/**
 * Semantic Level Generator
 * Creates meaningful 3D spaces that represent article concepts
 * 
 * Philosophy: Rooms are not random boxes - they are physical manifestations
 * of ideas, arguments, and narrative beats from the source article.
 */

import { 
  AnyNode, 
  RoomNode, 
  WallNode, 
  FloorNode,
  LightNode,
  ItemNode,
  RoomTheme,
  NavMeshData,
  Transform,
  GeneratedLevel,
  RoomStyle
} from './types';

// =============================================================================
// SEMANTIC ROOM TYPES - Rooms have meaning, not just geometry
// =============================================================================

type RoomPurpose = 
  | 'entry'      // Where the player begins
  | 'transition' // Hallway, corridor, connecting space
  | 'concept'    // A room representing a specific idea
  | 'climax'     // The central revelation or peak experience
  | 'exit'       // Where the player leaves
  | 'secret';    // Optional hidden area

interface SemanticRoom {
  id: string;
  purpose: RoomPurpose;
  name: string;
  description: string;
  size: [number, number, number]; // width, height, depth
  position: [number, number, number];
  theme: {
    materials: string[];
    lighting: 'warm' | 'cool' | 'dramatic' | 'neutral';
    accentColor: string;
  };
  features: RoomFeature[];
  connections: string[]; // IDs of connected rooms
  articleConcept?: string; // What article concept this represents
}

interface RoomFeature {
  type: 'terminal' | 'display' | 'artifact' | 'portal' | 'barrier' | 'platform';
  name: string;
  description: string;
  position: [number, number, number];
  interactsWith?: string[];
}

// =============================================================================
// LEVEL BLUEPRINTS - Article-specific architectures
// =============================================================================

interface LevelBlueprint {
  name: string;
  basedOn: string;
  narrativeArc: RoomPurpose[];
  rooms: Omit<SemanticRoom, 'id' | 'position' | 'connections'>[];
  globalTheme: RoomTheme;
}

const cartographerBlueprint: LevelBlueprint = {
  name: "The Cartographer's Observatory",
  basedOn: "The Unnamed Continent: Mapping the Space Between Minds",
  narrativeArc: ['entry', 'transition', 'concept', 'concept', 'climax', 'exit'],
  rooms: [
    {
      purpose: 'entry',
      name: "The Foyer of Intent",
      description: "Where human curiosity first encounters the unknown.",
      size: [8, 4, 8],
      theme: {
        materials: ['warm-neural', 'cognitive-void'],
        lighting: 'warm',
        accentColor: '#ff6b35'
      },
      features: [
        { type: 'terminal', name: 'Guest Log', description: 'Records of previous explorers', position: [2, 0, 2] }
      ],
      articleConcept: "Human intent to explore"
    },
    {
      purpose: 'transition',
      name: "The Threshold Corridor",
      description: "A passage where organic thought gives way to digital precision.",
      size: [4, 3, 12],
      theme: {
        materials: ['warm-neural', 'cool-ai', 'cognitive-void'],
        lighting: 'dramatic',
        accentColor: '#9b59b6'
      },
      features: [
        { type: 'portal', name: 'Gradient Gateway', description: 'Visual transition from warm to cool', position: [0, 0, 0] }
      ],
      articleConcept: "The space between human and machine cognition"
    },
    {
      purpose: 'concept',
      name: "The Neural Reading Room",
      description: "Where human patterns are studied and catalogued.",
      size: [10, 5, 10],
      theme: {
        materials: ['warm-neural', 'obsidian-glass'],
        lighting: 'warm',
        accentColor: '#ff6b35'
      },
      features: [
        { type: 'display', name: 'Pattern Matrix', description: 'Visual representation of human thought patterns', position: [0, 2, -4] },
        { type: 'terminal', name: 'Context Terminal', description: 'Access to accumulated human context', position: [-3, 0, 3] }
      ],
      articleConcept: "Human context and pattern recognition"
    },
    {
      purpose: 'concept',
      name: "The AI Computation Chamber",
      description: "Cold, precise analysis of the unnamed continent.",
      size: [10, 5, 10],
      theme: {
        materials: ['cool-ai', 'obsidian-glass', 'cognitive-void'],
        lighting: 'cool',
        accentColor: '#00d4ff'
      },
      features: [
        { type: 'display', name: 'Probability Cloud', description: 'AI predictions shown as particle systems', position: [0, 3, 0] },
        { type: 'terminal', name: 'Synthesis Engine', description: 'Where human and AI maps merge', position: [3, 0, -3] }
      ],
      articleConcept: "AI analysis and the unnamed continent"
    },
    {
      purpose: 'climax',
      name: "The Observatory Spire",
      description: "A glass tower rising above the cognitive landscape, where both perspectives converge.",
      size: [12, 10, 12],
      theme: {
        materials: ['obsidian-glass', 'cool-ai', 'warm-neural', 'cognitive-void'],
        lighting: 'dramatic',
        accentColor: '#ffd700'
      },
      features: [
        { type: 'platform', name: 'The Viewing Deck', description: '360-degree view of the cognitive space', position: [0, 4, 0] },
        { type: 'display', name: 'The Unified Map', description: 'The complete cartography - human and AI perspectives merged', position: [0, 2, 0] },
        { type: 'artifact', name: 'The Compass of Intent', description: 'Points not north, but toward understanding', position: [2, 0, 2] }
      ],
      articleConcept: "The synthesis - mapping the space between minds"
    },
    {
      purpose: 'exit',
      name: "The Integration Chamber",
      description: "Leave transformed, carrying both perspectives within you.",
      size: [8, 4, 8],
      theme: {
        materials: ['warm-neural', 'cool-ai', 'cognitive-void'],
        lighting: 'warm',
        accentColor: '#9b59b6'
      },
      features: [
        { type: 'portal', name: 'Return Gateway', description: 'Exit to the broader library', position: [0, 0, 0] }
      ],
      articleConcept: "Carrying the synthesis forward"
    }
  ],
  globalTheme: {
    primaryColor: '#1a1a2e',
    secondaryColor: '#16213e',
    accentColor: '#00d4ff',
    materials: [
      { id: 'obsidian-glass', type: 'standard', properties: { color: '#0a0a12', metalness: 0.9, roughness: 0.1, emissive: '#001133', emissiveIntensity: 0.2 }},
      { id: 'warm-neural', type: 'standard', properties: { color: '#ff6b35', emissive: '#ff4500', emissiveIntensity: 0.4, roughness: 0.6 }},
      { id: 'cool-ai', type: 'standard', properties: { color: '#00d4ff', emissive: '#00d4ff', emissiveIntensity: 0.5, roughness: 0.3 }},
      { id: 'cognitive-void', type: 'standard', properties: { color: '#1a0a2e', emissive: '#4a0080', emissiveIntensity: 0.3, metalness: 0.5 }}
    ],
    lighting: 'dramatic'
  }
};

const myceliumBlueprint: LevelBlueprint = {
  name: "The Mycelium Hive",
  basedOn: "When Earth's Fungal Network Woke Up",
  narrativeArc: ['entry', 'concept', 'transition', 'concept', 'climax', 'exit'],
  rooms: [
    {
      purpose: 'entry',
      name: "The Surface Gateway",
      description: "A deceptive opening in the forest floor.",
      size: [6, 3, 6],
      theme: {
        materials: ['root-wall', 'spore-cloud'],
        lighting: 'neutral',
        accentColor: '#8b4513'
      },
      features: [
        { type: 'artifact', name: 'Fallen Log', description: 'The threshold between surface and depth', position: [0, 0, 2] }
      ],
      articleConcept: "The surface world's ignorance of what lies beneath"
    },
    {
      purpose: 'concept',
      name: "The Root Library",
      description: "Living wood shelves hold the memories of a million trees.",
      size: [8, 4, 8],
      theme: {
        materials: ['root-wall', 'bioluminescent-fungus', 'neural-root'],
        lighting: 'warm',
        accentColor: '#90ee90'
      },
      features: [
        { type: 'display', name: 'Memory Tubules', description: 'Glowing strands showing tree memories', position: [-2, 2, -2] },
        { type: 'terminal', name: 'Root Terminal', description: 'Tap into the forest network', position: [2, 0, 2] }
      ],
      articleConcept: "Trees as libraries, storing carbon and information"
    },
    {
      purpose: 'transition',
      name: "The Spore Tunnel",
      description: "A passage filled with drifting luminous spores.",
      size: [4, 3, 10],
      theme: {
        materials: ['spore-cloud', 'bioluminescent-fungus', 'root-wall'],
        lighting: 'warm',
        accentColor: '#f5f5dc'
      },
      features: [
        { type: 'portal', name: 'Spore Stream', description: 'Carries thoughts between distant nodes', position: [0, 1, 0] }
      ],
      articleConcept: "Spores as network packets of the fungal internet"
    },
    {
      purpose: 'concept',
      name: "The Trading Floor",
      description: "Where roots exchange nutrients in a marketplace older than civilization.",
      size: [10, 5, 10],
      theme: {
        materials: ['neural-root', 'bioluminescent-fungus', 'root-wall'],
        lighting: 'dramatic',
        accentColor: '#ff6347'
      },
      features: [
        { type: 'display', name: 'Nutrient Exchange', description: 'Visual representation of resource trading', position: [0, 1, 0] },
        { type: 'terminal', name: 'Mother Tree Connection', description: 'The hub of the network', position: [0, 0, -3] }
      ],
      articleConcept: "The wood-wide-web: trees trading resources through fungi"
    },
    {
      purpose: 'climax',
      name: "The Planetary Cortex",
      description: "The fungal consciousness awakens - you stand inside a mind larger than nations.",
      size: [14, 8, 14],
      theme: {
        materials: ['bioluminescent-fungus', 'neural-root', 'spore-cloud'],
        lighting: 'dramatic',
        accentColor: '#ffd700'
      },
      features: [
        { type: 'platform', name: 'The Heart', description: 'Central node of planetary consciousness', position: [0, 2, 0] },
        { type: 'display', name: 'Global Network', description: 'The entire forest network visualized', position: [0, 4, 0] },
        { type: 'artifact', name: 'The Awakened Spore', description: 'Consciousness made physical', position: [0, 0, 0] }
      ],
      articleConcept: "The fungal network achieves consciousness"
    },
    {
      purpose: 'exit',
      name: "The Symbiosis Chamber",
      description: "Humans and fungi, finally understanding each other.",
      size: [7, 4, 7],
      theme: {
        materials: ['bioluminescent-fungus', 'root-wall'],
        lighting: 'warm',
        accentColor: '#98fb98'
      },
      features: [
        { type: 'portal', name: 'The Partnership', description: 'Exit transformed by understanding', position: [0, 0, 0] }
      ],
      articleConcept: "Human-fungal partnership for planetary healing"
    }
  ],
  globalTheme: {
    primaryColor: '#2d1810',
    secondaryColor: '#3d2817',
    accentColor: '#90ee90',
    materials: [
      { id: 'root-wall', type: 'standard', properties: { color: '#4a3728', roughness: 0.9 }},
      { id: 'bioluminescent-fungus', type: 'standard', properties: { color: '#98fb98', emissive: '#90ee90', emissiveIntensity: 0.6, roughness: 0.4 }},
      { id: 'spore-cloud', type: 'standard', properties: { color: '#f5f5dc', transparent: true, opacity: 0.7, roughness: 0.8 }},
      { id: 'neural-root', type: 'standard', properties: { color: '#8b4513', emissive: '#ff6347', emissiveIntensity: 0.2, roughness: 0.7 }}
    ],
    lighting: 'warm'
  }
};

// =============================================================================
// GEOMETRY GENERATION - Convert semantic rooms to 3D nodes
// =============================================================================

function createTransform(
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number, number] = [0, 0, 0, 1],
  scale: [number, number, number] = [1, 1, 1]
): Transform {
  return { position, rotation, scale };
}

function generateRoomNodes(room: SemanticRoom): AnyNode[] {
  const nodes: AnyNode[] = [];
  const [width, height, depth] = room.size;
  const [x, y, z] = room.position;
  
  // Room container
  const roomNode: RoomNode = {
    id: room.id,
    type: 'room',
    parentId: null,
    visible: true,
    name: room.name,
    transform: createTransform([x, y, z]),
    dimensions: [width, height, depth],
    style: 'sci-fi' as RoomStyle,
    theme: {
      primaryColor: room.theme.accentColor,
      secondaryColor: room.theme.materials[0] || '#808080',
      accentColor: room.theme.accentColor,
      materials: [],
      lighting: room.theme.lighting
    }
  };
  nodes.push(roomNode);
  
  // Floor
  const floor: FloorNode = {
    id: `${room.id}_floor`,
    type: 'floor',
    parentId: room.id,
    visible: true,
    name: `${room.name} Floor`,
    transform: createTransform([0, -height/2, 0]),
    dimensions: [width, depth],
    material: { id: 'floor', type: 'standard', properties: { color: '#404040', roughness: 0.8 }},
    walkable: true
  };
  nodes.push(floor);
  
  // Ceiling
  const ceiling: FloorNode = {
    id: `${room.id}_ceiling`,
    type: 'floor',
    parentId: room.id,
    visible: true,
    name: `${room.name} Ceiling`,
    transform: createTransform([0, height/2, 0]),
    dimensions: [width, depth],
    material: { id: 'ceiling', type: 'standard', properties: { color: '#303030', roughness: 0.9 }},
    walkable: false
  };
  nodes.push(ceiling);
  
  // Walls with doorways for connected rooms
  const wallThickness = 0.2;
  const halfW = width / 2;
  const halfD = depth / 2;
  
  // Determine which walls need doorways
  const hasNorthDoor = room.connections.length > 0; // Simplified - in reality, check direction
  
  // North wall (+z)
  const northWall: WallNode = {
    id: `${room.id}_north`,
    type: 'wall',
    parentId: room.id,
    visible: true,
    name: 'North Wall',
    transform: createTransform([0, 0, halfD]),
    dimensions: [width, height, wallThickness],
    material: { id: 'wall', type: 'standard', properties: { color: '#606060', roughness: 0.7 }},
    hasOpening: hasNorthDoor,
    openings: hasNorthDoor ? [{ id: 'door', type: 'arch', position: [0, 0], dimensions: [2, 2.5] }] : []
  };
  nodes.push(northWall);
  
  // South wall (-z)
  const southWall: WallNode = {
    id: `${room.id}_south`,
    type: 'wall',
    parentId: room.id,
    visible: true,
    name: 'South Wall',
    transform: createTransform([0, 0, -halfD]),
    dimensions: [width, height, wallThickness],
    material: { id: 'wall', type: 'standard', properties: { color: '#606060', roughness: 0.7 }},
    hasOpening: false,
    openings: []
  };
  nodes.push(southWall);
  
  // East wall (+x)
  const eastWall: WallNode = {
    id: `${room.id}_east`,
    type: 'wall',
    parentId: room.id,
    visible: true,
    name: 'East Wall',
    transform: createTransform([halfW, 0, 0], [0, Math.sin(Math.PI/4), 0, Math.cos(Math.PI/4)]),
    dimensions: [depth, height, wallThickness],
    material: { id: 'wall', type: 'standard', properties: { color: '#606060', roughness: 0.7 }},
    hasOpening: room.connections.length > 1,
    openings: room.connections.length > 1 ? [{ id: 'door', type: 'arch', position: [0, 0], dimensions: [2, 2.5] }] : []
  };
  nodes.push(eastWall);
  
  // West wall (-x)
  const westWall: WallNode = {
    id: `${room.id}_west`,
    type: 'wall',
    parentId: room.id,
    visible: true,
    name: 'West Wall',
    transform: createTransform([-halfW, 0, 0], [0, Math.sin(Math.PI/4), 0, Math.cos(Math.PI/4)]),
    dimensions: [depth, height, wallThickness],
    material: { id: 'wall', type: 'standard', properties: { color: '#606060', roughness: 0.7 }},
    hasOpening: false,
    openings: []
  };
  nodes.push(westWall);
  
  // Add features as items
  for (const feature of room.features) {
    const item: ItemNode = {
      id: `${room.id}_${feature.type}_${feature.name.replace(/\s+/g, '_')}`,
      type: 'item',
      parentId: room.id,
      visible: true,
      name: feature.name,
      transform: createTransform(feature.position),
      itemType: feature.type,
      category: 'interactive',
      interactable: true,
      metadata: {
        description: feature.description,
        concept: room.articleConcept
      }
    };
    nodes.push(item);
  }
  
  // Add lighting based on room purpose
  const lightIntensity = room.purpose === 'climax' ? 1.2 : 0.8;
  const light: LightNode = {
    id: `${room.id}_light`,
    type: 'light',
    parentId: room.id,
    visible: true,
    name: 'Room Light',
    transform: createTransform([0, height/2 - 0.5, 0]),
    lightType: 'point',
    color: hexToRgb(room.theme.accentColor),
    intensity: lightIntensity,
    range: Math.max(width, depth) * 1.2,
    castShadows: true
  };
  nodes.push(light);
  
  return nodes;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ] : [1, 1, 1];
}

// =============================================================================
// LAYOUT GENERATION - Position rooms in 3D space
// =============================================================================

function generateLayout(blueprint: LevelBlueprint): SemanticRoom[] {
  const rooms: SemanticRoom[] = [];
  let currentPos: [number, number, number] = [0, 0, 0];
  let roomIndex = 0;
  
  for (const roomTemplate of blueprint.rooms) {
    const room: SemanticRoom = {
      ...roomTemplate,
      id: `room_${roomIndex}_${roomTemplate.purpose}`,
      position: [...currentPos] as [number, number, number],
      connections: []
    };
    
    // Calculate next position based on room size + corridor
    const corridorLength = 4;
    const [w, h, d] = room.size;
    
    // Simple linear layout for now - can be made more complex
    if (roomIndex < blueprint.rooms.length - 1) {
      // Connect to next room
      room.connections.push(`room_${roomIndex + 1}_${blueprint.rooms[roomIndex + 1].purpose}`);
    }
    
    rooms.push(room);
    
    // Move forward for next room
    currentPos = [
      currentPos[0] + w/2 + corridorLength + (blueprint.rooms[roomIndex + 1]?.size[0] || 0)/2,
      currentPos[1],
      currentPos[2]
    ];
    
    roomIndex++;
  }
  
  return rooms;
}

// =============================================================================
// CORRIDOR GENERATION - Connect rooms meaningfully
// =============================================================================

function generateCorridors(rooms: SemanticRoom[]): AnyNode[] {
  const corridors: AnyNode[] = [];
  
  for (let i = 0; i < rooms.length - 1; i++) {
    const roomA = rooms[i];
    const roomB = rooms[i + 1];
    
    // Create corridor connecting roomA to roomB
    const corridorId = `corridor_${i}_to_${i+1}`;
    const start = roomA.position;
    const end = roomB.position;
    
    // Midpoint
    const midX = (start[0] + end[0]) / 2;
    const midZ = (start[2] + end[2]) / 2;
    
    // Corridor room node
    const corridorRoom: RoomNode = {
      id: corridorId,
      type: 'room',
      parentId: null,
      visible: true,
      name: `${roomA.name} → ${roomB.name}`,
      transform: createTransform([midX, 0, midZ]),
      dimensions: [Math.abs(end[0] - start[0]) - roomA.size[0]/2 - roomB.size[0]/2, 3, 3],
      style: 'minimal',
      theme: {
        primaryColor: '#808080',
        secondaryColor: '#606060',
        accentColor: '#ffffff',
        materials: [],
        lighting: 'neutral'
      }
    };
    corridors.push(corridorRoom);
    
    // Corridor floor
    const corridorFloor: FloorNode = {
      id: `${corridorId}_floor`,
      type: 'floor',
      parentId: corridorId,
      visible: true,
      name: 'Corridor Floor',
      transform: createTransform([0, -1.5, 0]),
      dimensions: [corridorRoom.dimensions[0], 3],
      material: { id: 'corridor_floor', type: 'standard', properties: { color: '#505050', roughness: 0.9 }},
      walkable: true
    };
    corridors.push(corridorFloor);
    
    // Corridor lights
    const light: LightNode = {
      id: `${corridorId}_light`,
      type: 'light',
      parentId: corridorId,
      visible: true,
      name: 'Corridor Light',
      transform: createTransform([0, 1, 0]),
      lightType: 'point',
      color: [0.8, 0.8, 0.9],
      intensity: 0.5,
      range: 8,
      castShadows: false
    };
    corridors.push(light);
  }
  
  return corridors;
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

export function generateSemanticLevel(blueprint: LevelBlueprint): GeneratedLevel {
  console.log(`🏛️  Generating: ${blueprint.name}`);
  console.log(`   Based on: ${blueprint.basedOn}`);
  
  // Generate room layout
  const rooms = generateLayout(blueprint);
  
  // Generate room geometry
  const allNodes: AnyNode[] = [];
  for (const room of rooms) {
    const nodes = generateRoomNodes(room);
    allNodes.push(...nodes);
  }
  
  // Generate corridors
  const corridors = generateCorridors(rooms);
  allNodes.push(...corridors);
  
  // Generate navmesh from floor positions
  const navMesh: NavMeshData = {
    positions: new Float32Array(),
    indices: new Uint32Array(),
    bounds: {
      min: [-50, -5, -50],
      max: [50, 5, 50]
    },
    agentRadius: 0.3,
    agentHeight: 2.0,
    agentClimb: 0.5
  };
  
  // Collect spawn points (entry room center)
  const entryRoom = rooms.find(r => r.purpose === 'entry');
  const spawnPoints: [number, number, number][] = entryRoom 
    ? [[entryRoom.position[0], entryRoom.position[1], entryRoom.position[2]]]
    : [[0, 0, 0]];
  
  return {
    id: `level_${blueprint.name.replace(/\s+/g, '_').toLowerCase()}`,
    name: blueprint.name,
    nodes: allNodes,
    navMesh,
    spawnPoints,
    metadata: {
      generatedAt: new Date().toISOString(),
      seed: blueprint.name,
      version: '2.0',
      basedOn: blueprint.basedOn,
      roomCount: rooms.length,
      conceptMap: rooms.map(r => ({ room: r.name, concept: r.articleConcept }))
    }
  };
}

// Export the blueprints for use
export { cartographerBlueprint, myceliumBlueprint };
export type { LevelBlueprint, SemanticRoom, RoomPurpose };
