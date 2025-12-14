/**
 * World Configuration Loader
 *
 * Handles loading world configurations from public/worlds/{id}/config.json
 * and provides default configurations.
 */

import type { WorldConfig } from './types';

/**
 * Default world configuration
 * Used when no world is specified or as fallback
 */
export const DEFAULT_WORLD: WorldConfig = {
  id: 'default',
  name: 'Default Environment',
  description: 'The default 360 scene environment',
  assets: {
    // No splat by default - will use panorama fallback
    fallbackPanorama: '/backgrounds/default.jpg',
  },
  camera: {
    initial: [0, 2, 10],
    target: [0, 0, 0],
    fov: 60,
    constraints: {
      minDistance: 5,
      maxDistance: 50,
      minPolarAngle: 0.1,
      maxPolarAngle: Math.PI / 2,
      enablePan: false,
    },
  },
  lighting: {
    preset: 'day',
    ambient: 0.5,
    directionalIntensity: 0.9,
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
