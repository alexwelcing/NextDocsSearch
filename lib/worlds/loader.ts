/**
 * World Configuration Loader
 *
 * Handles loading world configurations from public/worlds/{id}/config.json
 * and provides default configurations.
 */

import type { WorldConfig } from './types';
import { MARBLE_WORLD } from './marbleWorld';

/**
 * The marble world configuration — unlocked as a reward after visiting all worlds.
 * Exported so WorldGallery can reference it as the secret end-game scene.
 */
export const MARBLE_WORLD_CONFIG: WorldConfig = {
  id: MARBLE_WORLD.id,
  name: MARBLE_WORLD.name,
  description: 'The immersive marble world from Supabase',
  assets: {
    environment: MARBLE_WORLD.splatUrl,
    fallbackPanorama: MARBLE_WORLD.panoUrl,
    colliderUrl: MARBLE_WORLD.colliderUrl,
  },
  camera: {
    initial: [0, 2, 8],
    target: [0, 1.5, 0],
    fov: 72,
    constraints: {
      minDistance: 3,
      maxDistance: 25,
      minPolarAngle: Math.PI * 0.25,
      maxPolarAngle: Math.PI * 0.75,
      enablePan: false,
    },
  },
  lighting: {
    preset: 'day',
    ambient: 0.5,
    directionalIntensity: 0.8,
    shadowsEnabled: true,
    envMapIntensity: 1,
  },
  atmosphere: {
    fog: { enabled: true, color: '#a0a0b0', near: 10, far: 50 },
    particles: { type: 'none' },
  },
};

/**
 * The panorama image keys matching the 14 image backgrounds in WORLD_METADATA.
 * Used to pick a random starting background.
 */
const PANORAMA_KEYS = [
  'bg1', 'bg2', 'bg3', 'bg4', 'bg5', 'bg6', 'bg7', 'bg8', 'bg9',
  'cave', 'scifi1', 'space', 'start', 'train',
];

/** Pick a random panorama path from the available 14 image backgrounds */
function getRandomPanorama(): string {
  const key = PANORAMA_KEYS[Math.floor(Math.random() * PANORAMA_KEYS.length)];
  return `/background/${key}.jpg`;
}

/**
 * Default world configuration
 * Starts with a random panorama background. The marble world splat
 * is reserved as the reward for exploring all other worlds.
 */
export const DEFAULT_WORLD: WorldConfig = {
  id: 'default-panorama',
  name: 'Random Panorama',
  description: 'A random 360° panorama from the gallery',
  assets: {
    // No environment splat — uses fallbackPanorama directly
    fallbackPanorama: getRandomPanorama(),
  },
  camera: {
    initial: [0, 2, 10],
    target: [0, 0, 0],
    fov: 60,
    constraints: {
      minDistance: 5,
      maxDistance: 50,
      minPolarAngle: Math.PI * 0.25,
      maxPolarAngle: Math.PI * 0.75,
      enablePan: false,
    },
  },
  lighting: {
    preset: 'day',
    ambient: 0.5,
    directionalIntensity: 0.8,
    shadowsEnabled: false,
    envMapIntensity: 1,
  },
  atmosphere: {
    fog: { enabled: false },
    particles: { type: 'none' },
  },
};

/**
 * World configuration cache
 */
const worldCache = new Map<string, WorldConfig>();

/**
 * Load a world configuration by ID
 *
 * @param worldId - The world ID (matches folder name in public/worlds/)
 * @returns The world configuration
 */
export async function loadWorld(worldId: string): Promise<WorldConfig> {
  // Check cache first
  if (worldCache.has(worldId)) {
    return worldCache.get(worldId)!;
  }

  // Return default for 'default' ID
  if (worldId === 'default') {
    worldCache.set(worldId, DEFAULT_WORLD);
    return DEFAULT_WORLD;
  }

  try {
    // Fetch config.json from public folder
    const response = await fetch(`/worlds/${worldId}/config.json`);

    if (!response.ok) {
      console.warn(`World config not found for "${worldId}", using default`);
      return DEFAULT_WORLD;
    }

    const config: Partial<WorldConfig> = await response.json();

    // Merge with defaults
    const fullConfig: WorldConfig = {
      ...DEFAULT_WORLD,
      ...config,
      id: worldId,
      assets: {
        ...DEFAULT_WORLD.assets,
        ...config.assets,
      },
      camera: {
        ...DEFAULT_WORLD.camera,
        ...config.camera,
        constraints: {
          ...DEFAULT_WORLD.camera.constraints,
          ...config.camera?.constraints,
        },
      },
      lighting: {
        ...DEFAULT_WORLD.lighting,
        ...config.lighting,
      },
      atmosphere: {
        ...DEFAULT_WORLD.atmosphere,
        ...config.atmosphere,
      },
    };

    // Resolve relative asset paths
    fullConfig.assets = resolveAssetPaths(fullConfig.assets, worldId);

    // Cache the result
    worldCache.set(worldId, fullConfig);

    return fullConfig;
  } catch (error) {
    console.error(`Failed to load world "${worldId}":`, error);
    return DEFAULT_WORLD;
  }
}

/**
 * Resolve relative asset paths to full paths
 */
function resolveAssetPaths(
  assets: WorldConfig['assets'],
  worldId: string
): WorldConfig['assets'] {
  const basePath = `/worlds/${worldId}`;

  const resolved = { ...assets };

  // Resolve environment path
  if (resolved.environment && !resolved.environment.startsWith('/')) {
    resolved.environment = `${basePath}/${resolved.environment}`;
  }

  // Resolve skybox path
  if (resolved.skybox && !resolved.skybox.startsWith('/')) {
    resolved.skybox = `${basePath}/${resolved.skybox}`;
  }

  // Resolve fallback panorama path
  if (resolved.fallbackPanorama && !resolved.fallbackPanorama.startsWith('/')) {
    resolved.fallbackPanorama = `${basePath}/${resolved.fallbackPanorama}`;
  }

  // Resolve prop paths
  if (resolved.props) {
    resolved.props = resolved.props.map((prop) => ({
      ...prop,
      path: prop.path.startsWith('/') ? prop.path : `${basePath}/${prop.path}`,
    }));
  }

  return resolved;
}

/**
 * List available worlds
 * Note: This requires an API endpoint to list directories
 */
export async function listWorlds(): Promise<string[]> {
  try {
    const response = await fetch('/api/worlds');
    if (!response.ok) return ['default'];
    const data = await response.json();
    return data.worlds || ['default'];
  } catch {
    return ['default'];
  }
}

/**
 * Preload a world's assets
 */
export async function preloadWorld(worldId: string): Promise<void> {
  const config = await loadWorld(worldId);

  const preloadPromises: Promise<void>[] = [];

  // Preload environment splat
  if (config.assets.environment) {
    preloadPromises.push(
      fetch(config.assets.environment)
        .then(() => undefined)
        .catch(() => undefined)
    );
  }

  // Preload skybox
  if (config.assets.skybox) {
    preloadPromises.push(
      fetch(config.assets.skybox)
        .then(() => undefined)
        .catch(() => undefined)
    );
  }

  // Preload fallback panorama
  if (config.assets.fallbackPanorama) {
    preloadPromises.push(
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = config.assets.fallbackPanorama!;
      })
    );
  }

  await Promise.all(preloadPromises);
}

/**
 * Clear world cache
 */
export function clearWorldCache(): void {
  worldCache.clear();
}
