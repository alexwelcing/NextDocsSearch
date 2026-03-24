/**
 * Article-Themed Level Generation
 * Three unique levels based on articles from the library
 * 
 * Uses Semantic Generator - rooms represent concepts, not just boxes
 */

import { generateSemanticLevel, cartographerBlueprint, myceliumBlueprint } from './semantic-generator';
import { LevelConfig, GeneratedLevel, RoomTheme, RoomStyle } from './types';
import { generateLevel } from './generator';

// =============================================================================
// LEVEL 1: THE CARTOGRAPHER'S OBSERVATORY
// Based on: "The Unnamed Continent: Mapping the Space Between Minds"
// Theme: Cognitive cartography, exploration, hybrid intelligence
// =============================================================================

const cartographerTheme: RoomTheme = {
  primaryColor: '#1a1a2e',
  secondaryColor: '#16213e',
  accentColor: '#00d4ff',
  materials: [
    { 
      id: 'obsidian-glass', 
      type: 'standard', 
      properties: { 
        color: '#0a0a12', 
        metalness: 0.9, 
        roughness: 0.1,
        emissive: '#001133',
        emissiveIntensity: 0.2
      } 
    },
    { 
      id: 'warm-neural', 
      type: 'standard', 
      properties: { 
        color: '#ff6b35', 
        emissive: '#ff4500',
        emissiveIntensity: 0.4,
        roughness: 0.6
      } 
    },
    { 
      id: 'cool-ai', 
      type: 'standard', 
      properties: { 
        color: '#00d4ff', 
        emissive: '#00d4ff',
        emissiveIntensity: 0.5,
        roughness: 0.3
      } 
    },
    {
      id: 'cognitive-void',
      type: 'standard',
      properties: {
        color: '#1a0a2e',
        emissive: '#4a0080',
        emissiveIntensity: 0.3,
        metalness: 0.5
      }
    }
  ],
  lighting: 'dramatic'
};

export const cartographerLevelConfig: LevelConfig = {
  seed: 'cartographer-observatory-2045',
  complexity: 'moderate',
  roomCount: 6,
  theme: cartographerTheme,
  constraints: {
    minRoomSize: [6, 4, 6],
    maxRoomSize: [12, 6, 12],
    connectAllRooms: true,
    requireLoops: true,
    maxDepth: 4
  }
};

// =============================================================================
// LEVEL 2: THE MYCELIUM HIVE
// Based on: "When Earth's Fungal Network Woke Up"
// Theme: Underground, organic, interconnected, biological computing
// =============================================================================

const myceliumTheme: RoomTheme = {
  primaryColor: '#2d1810',
  secondaryColor: '#3d2817',
  accentColor: '#90ee90',
  materials: [
    { 
      id: 'root-wall', 
      type: 'standard', 
      properties: { 
        color: '#4a3728', 
        roughness: 0.9,
        normalMap: 'organic-bump'
      } 
    },
    { 
      id: 'bioluminescent-fungus', 
      type: 'standard', 
      properties: { 
        color: '#98fb98', 
        emissive: '#90ee90',
        emissiveIntensity: 0.6,
        roughness: 0.4
      } 
    },
    { 
      id: 'spore-cloud', 
      type: 'standard', 
      properties: { 
        color: '#f5f5dc', 
        transparent: true,
        opacity: 0.7,
        roughness: 0.8
      } 
    },
    {
      id: 'neural-root',
      type: 'standard',
      properties: {
        color: '#8b4513',
        emissive: '#ff6347',
        emissiveIntensity: 0.2,
        roughness: 0.7
      }
    }
  ],
  lighting: 'warm'
};

export const myceliumLevelConfig: LevelConfig = {
  seed: 'mycelium-hive-2038',
  complexity: 'complex',
  roomCount: 10,
  theme: myceliumTheme,
  constraints: {
    minRoomSize: [4, 3, 4],
    maxRoomSize: [10, 5, 10],
    connectAllRooms: true,
    requireLoops: true,
    maxDepth: 6
  }
};

// =============================================================================
// LEVEL 3: THE TEMPORAL DUNGEON
// Based on: "Holographic Prison System"
// Theme: Confinement, time loops, sterile, layered reality
// =============================================================================

const temporalPrisonTheme: RoomTheme = {
  primaryColor: '#0a0a0a',
  secondaryColor: '#1a1a1a',
  accentColor: '#ff0000',
  materials: [
    { 
      id: 'sterile-cell', 
      type: 'standard', 
      properties: { 
        color: '#e0e0e0', 
        metalness: 0.3,
        roughness: 0.2
      } 
    },
    { 
      id: 'time-fracture', 
      type: 'standard', 
      properties: { 
        color: '#000000', 
        emissive: '#ff0000',
        emissiveIntensity: 0.8,
        roughness: 0.1
      } 
    },
    { 
      id: 'holographic-barrier', 
      type: 'standard', 
      properties: { 
        color: '#00ffff', 
        emissive: '#00ffff',
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.3
      } 
    },
    {
      id: 'isolation-white',
      type: 'standard',
      properties: {
        color: '#ffffff',
        emissive: '#ffffff',
        emissiveIntensity: 0.1,
        roughness: 0.1
      }
    }
  ],
  lighting: 'cool'
};

export const temporalPrisonConfig: LevelConfig = {
  seed: 'temporal-dungeon-2038',
  complexity: 'maze',
  roomCount: 12,
  theme: temporalPrisonTheme,
  constraints: {
    minRoomSize: [3, 3, 3],
    maxRoomSize: [6, 4, 6],
    connectAllRooms: true,
    requireLoops: false,
    maxDepth: 8
  }
};

// =============================================================================
// LEVEL GENERATION FUNCTIONS
// =============================================================================

export function generateCartographerLevel(): GeneratedLevel {
  console.log('🗺️  Generating Cartographer\'s Observatory (Semantic)...');
  console.log('   Based on: "The Unnamed Continent: Mapping the Space Between Minds"');
  console.log('   Rooms: Foyer → Threshold → Neural Room → AI Chamber → Observatory → Exit');
  
  const level = generateSemanticLevel(cartographerBlueprint);
  return level;
}

export function generateMyceliumLevel(): GeneratedLevel {
  console.log('🍄 Generating The Mycelium Hive (Semantic)...');
  console.log('   Based on: "When Earth\'s Fungal Network Woke Up"');
  console.log('   Rooms: Surface → Root Library → Spore Tunnel → Trading Floor → Cortex → Exit');
  
  const level = generateSemanticLevel(myceliumBlueprint);
  return level;
}

export function generateTemporalPrisonLevel(): GeneratedLevel {
  console.log('⏱️  Generating The Temporal Dungeon...');
  console.log('   Based on: "Holographic Prison System"');
  console.log('   Theme: Time dilation, confinement, layered reality, isolation');
  
  const level = generateLevel(temporalPrisonConfig);
  level.name = 'The Temporal Dungeon';
  level.metadata = {
    ...level.metadata,
    basedOn: 'holographic-prison-system-2038',
    articleTitle: 'When Prisons Moved Into Your Mind',
    description: 'A disorienting maze of sterile cells and holographic barriers where time flows differently in each chamber.',
    atmosphere: 'sterile',
    keyFeatures: ['Isolation cells', 'Time fracture zones', 'Holographic barriers', 'Reality distortion chambers', 'Temporal loops']
  };
  return level;
}

// =============================================================================
// GENERATE ALL THREE LEVELS
// =============================================================================

export interface ArticleLevels {
  cartographer: GeneratedLevel;
  mycelium: GeneratedLevel;
  temporalPrison: GeneratedLevel;
}

export function generateAllArticleLevels(): ArticleLevels {
  return {
    cartographer: generateCartographerLevel(),
    mycelium: generateMyceliumLevel(),
    temporalPrison: generateTemporalPrisonLevel()
  };
}

// =============================================================================
// LEVEL SELECTION UTILITIES
// =============================================================================

export const levelDescriptions = {
  cartographer: {
    id: 'cartographer',
    name: 'The Cartographer\'s Observatory',
    emoji: '🗺️',
    articleSlug: 'cartography-01-the-unnamed-continent',
    tagline: 'Map the space between minds',
    difficulty: 'Moderate',
    roomCount: 6,
    description: 'Explore a glass tower where human and AI cognition intertwine. Warm neural pathways meet cool computational chambers.'
  },
  mycelium: {
    id: 'mycelium',
    name: 'The Mycelium Hive',
    emoji: '🍄',
    articleSlug: 'mycelium-network-consciousness-2038',
    tagline: 'Connect to planetary consciousness',
    difficulty: 'Complex',
    roomCount: 10,
    description: 'Descend into an underground fungal network. Bioluminescent spores guide you through root-woven corridors of living earth.'
  },
  temporalPrison: {
    id: 'temporal',
    name: 'The Temporal Dungeon',
    emoji: '⏱️',
    articleSlug: 'holographic-prison-system-2038',
    tagline: 'Escape before time breaks',
    difficulty: 'Hard',
    roomCount: 12,
    description: 'Navigate a disorienting prison where time flows differently in each cell. Holographic barriers shift reality itself.'
  }
};

export type LevelId = keyof typeof levelDescriptions;

export function generateLevelById(id: LevelId): GeneratedLevel {
  switch (id) {
    case 'cartographer':
      return generateCartographerLevel();
    case 'mycelium':
      return generateMyceliumLevel();
    case 'temporalPrison':
      return generateTemporalPrisonLevel();
    default:
      return generateCartographerLevel();
  }
}

export function getRandomLevelId(): LevelId {
  const ids: LevelId[] = ['cartographer', 'mycelium', 'temporalPrison'];
  return ids[Math.floor(Math.random() * ids.length)];
}
