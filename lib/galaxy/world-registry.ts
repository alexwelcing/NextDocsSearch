/**
 * World Registry - Catalog of all navigable worlds in the galaxy
 * 
 * This is the single source of truth for all immersive destinations.
 * Each world has a position in galaxy space, connections to other worlds,
 * and metadata for rendering and navigation.
 */

import { discoverArticleImages } from '../article-images';

export type WorldType = 'immersive' | 'article' | 'game' | 'memory';

export interface World {
  id: string;
  type: WorldType;
  title: string;
  description: string;
  thumbnail: string;
  /** Position in galaxy space (arbitrary units) */
  position: [number, number, number];
  /** IDs of connected worlds (for constellation lines) */
  connections: string[];
  /** Theme/category for filtering */
  theme: 'fiction' | 'research' | 'system' | 'memory';
  /** For sorting/time-based layouts */
  date?: string;
  /** Type-specific data */
  metadata: {
    /** For articles: the slug */
    articleSlug?: string;
    /** For immersive scenes: background type */
    sceneType?: 'gaussian' | 'image' | 'mixed';
    /** For filtering by topic */
    tags?: string[];
    /** Season if applicable */
    season?: 'spring' | 'summer' | 'autumn' | 'winter' | 'halloween';
  };
  /** How to enter this world */
  entryPoint: {
    url: string;
    /** Camera position when entering */
    camera?: {
      position: [number, number, number];
      target: [number, number, number];
    };
  };
}

// =============================================================================
// STATIC WORLDS - System locations that always exist
// =============================================================================

const staticWorlds: World[] = [
  {
    id: 'home',
    type: 'immersive',
    title: 'The Nexus',
    description: 'Central hub. Your starting point for all exploration.',
    thumbnail: '/background/default.png',
    position: [0, 0, 0],
    connections: ['speculative-ai', 'agent-futures', 'emergent-intelligence'],
    theme: 'system',
    metadata: { sceneType: 'mixed', tags: ['hub', 'main'] },
    entryPoint: { url: '/' },
  },
  {
    id: 'sphere-hunter',
    type: 'game',
    title: 'Sphere Hunter Arena',
    description: 'Test your reflexes in the 3D shooting gallery.',
    thumbnail: '/images/game-preview.png',
    position: [15, 5, -10],
    connections: ['home'],
    theme: 'system',
    metadata: { sceneType: 'mixed', tags: ['game', 'interactive'] },
    entryPoint: { url: '/?game=active' },
  },
  {
    id: 'speculative-ai',
    type: 'immersive',
    title: 'Speculative AI Hub',
    description: 'Explore scenarios and futures of artificial intelligence.',
    thumbnail: '/background/speculative-ai.png',
    position: [-20, 8, 15],
    connections: ['home', 'agent-futures'],
    theme: 'research',
    metadata: { sceneType: 'image', tags: ['hub', 'research', 'ai'] },
    entryPoint: { url: '/speculative-ai' },
  },
  {
    id: 'agent-futures',
    type: 'immersive',
    title: 'Agent Futures',
    description: 'Where autonomous agents evolve and intersect.',
    thumbnail: '/background/agent-futures.png',
    position: [25, -5, 20],
    connections: ['speculative-ai', 'emergent-intelligence'],
    theme: 'research',
    metadata: { sceneType: 'image', tags: ['hub', 'research', 'agents'] },
    entryPoint: { url: '/agent-futures' },
  },
  {
    id: 'emergent-intelligence',
    type: 'immersive',
    title: 'Emergent Intelligence',
    description: 'Witness intelligence emerging from simple rules.',
    thumbnail: '/background/emergent-intelligence.png',
    position: [-15, -10, 25],
    connections: ['agent-futures', 'the-interface'],
    theme: 'research',
    metadata: { sceneType: 'image', tags: ['hub', 'research', 'emergence'] },
    entryPoint: { url: '/emergent-intelligence' },
  },
  {
    id: 'the-interface',
    type: 'immersive',
    title: 'The Interface',
    description: 'Where human and machine perception merge.',
    thumbnail: '/background/the-interface.png',
    position: [10, 12, -20],
    connections: ['emergent-intelligence', 'memory-fragments'],
    theme: 'system',
    metadata: { sceneType: 'mixed', tags: ['hub', 'interface'] },
    entryPoint: { url: '/the-interface' },
  },
];

// =============================================================================
// MEMORY FRAGMENTS - Gaussian splat captures
// =============================================================================

const memoryWorlds: World[] = [
  {
    id: 'memory-splat4s',
    type: 'memory',
    title: 'Marble Memory',
    description: 'A captured moment in volumetric detail.',
    thumbnail: '/splats/splat4s.spz',
    position: [30, 15, 5],
    connections: ['the-interface'],
    theme: 'memory',
    metadata: { sceneType: 'gaussian', tags: ['splat', 'volumetric'] },
    entryPoint: { url: '/?splat=splat4s' },
  },
];

// =============================================================================
// SEASONAL WORLDS - Time-based locations
// =============================================================================

const seasonalWorlds: World[] = [
  {
    id: 'season-autumn',
    type: 'immersive',
    title: 'Autumn Realm',
    description: 'Falling leaves and golden light.',
    thumbnail: '/background/autumn.png',
    position: [-30, 20, -15],
    connections: ['home'],
    theme: 'system',
    metadata: { sceneType: 'image', season: 'autumn', tags: ['seasonal'] },
    entryPoint: { url: '/?season=autumn' },
  },
  {
    id: 'season-winter',
    type: 'immersive',
    title: 'Winter Expanse',
    description: 'Snow falls through infinite space.',
    thumbnail: '/background/winter.png',
    position: [20, -20, -30],
    connections: ['home'],
    theme: 'system',
    metadata: { sceneType: 'image', season: 'winter', tags: ['seasonal'] },
    entryPoint: { url: '/?season=winter' },
  },
];

// =============================================================================
// ARTICLE WORLDS - Generated from content
// =============================================================================

interface ArticleManifest {
  articles?: Array<{
    slug: string;
    title: string;
    description?: string;
    date?: string;
    articleType?: string;
    keywords?: string[];
  }>;
}

function generateArticleWorlds(): World[] {
  // Import dynamically to avoid build issues
  const manifest: ArticleManifest = require('../generated/article-manifest.json');
  const articles = manifest.articles || [];
  
  // Create a spiral distribution for articles
  return articles.map((article, index: number) => {
    const images = discoverArticleImages(article.slug);
    const angle = (index / Math.max(articles.length, 1)) * Math.PI * 4;
    const radius = 40 + (index % 3) * 15;
    const y = Math.sin(index * 0.5) * 20;
    
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    const theme = article.articleType === 'fiction' ? 'fiction' : 'research';
    
    const connections: string[] = [];
    if (theme === 'fiction') {
      connections.push('speculative-ai');
    } else {
      connections.push('agent-futures');
    }
    
    return {
      id: `article-${article.slug}`,
      type: 'article',
      title: article.title,
      description: article.description || `Read ${article.title}`,
      thumbnail: images.heroImage || images.thumbnail || '/og-default.png',
      position: [x, y, z],
      connections,
      theme,
      date: article.date,
      metadata: {
        articleSlug: article.slug,
        sceneType: 'image',
        tags: article.keywords || [],
      },
      entryPoint: {
        url: `/articles/${article.slug}`,
      },
    };
  });
}

// =============================================================================
// REGISTRY API
// =============================================================================

class WorldRegistry {
  private worlds: Map<string, World> = new Map();
  private initialized = false;

  initialize() {
    if (this.initialized) return;

    [...staticWorlds, ...memoryWorlds, ...seasonalWorlds, ...generateArticleWorlds()].forEach(world => {
      this.worlds.set(world.id, world);
    });

    this.initialized = true;
  }

  getAll(): World[] {
    this.initialize();
    return Array.from(this.worlds.values());
  }

  getById(id: string): World | undefined {
    this.initialize();
    return this.worlds.get(id);
  }

  getByType(type: WorldType): World[] {
    return this.getAll().filter(w => w.type === type);
  }

  getByTheme(theme: World['theme']): World[] {
    return this.getAll().filter(w => w.theme === theme);
  }

  getConnected(worldId: string): World[] {
    const world = this.getById(worldId);
    if (!world) return [];
    return world.connections.map(id => this.getById(id)).filter(Boolean) as World[];
  }

  search(query: string): World[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(w =>
      w.title.toLowerCase().includes(lower) ||
      w.description.toLowerCase().includes(lower) ||
      w.metadata.tags?.some(t => t.toLowerCase().includes(lower))
    );
  }

  getNearby(position: [number, number, number], radius: number): World[] {
    return this.getAll().filter(w => {
      const dx = w.position[0] - position[0];
      const dy = w.position[1] - position[1];
      const dz = w.position[2] - position[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return dist <= radius;
    });
  }

  getBounds(): { min: [number, number, number]; max: [number, number, number] } {
    const worlds = this.getAll();
    if (worlds.length === 0) {
      return { min: [0, 0, 0], max: [0, 0, 0] };
    }

    const min: [number, number, number] = [
      Math.min(...worlds.map(w => w.position[0])),
      Math.min(...worlds.map(w => w.position[1])),
      Math.min(...worlds.map(w => w.position[2])),
    ];
    const max: [number, number, number] = [
      Math.max(...worlds.map(w => w.position[0])),
      Math.max(...worlds.map(w => w.position[1])),
      Math.max(...worlds.map(w => w.position[2])),
    ];

    return { min, max };
  }
}

export const worldRegistry = new WorldRegistry();
export default worldRegistry;
