/**
 * Performance Utilities for 3D Scenes
 *
 * Provides optimized patterns for Three.js/R3F applications:
 * - LOD (Level of Detail) management
 * - Geometry and material caching/pooling
 * - Resource disposal helpers
 * - Batched update utilities
 * - Frustum culling helpers
 */

import * as THREE from 'three';

// ============================================================================
// GEOMETRY CACHE
// ============================================================================

/**
 * Global geometry cache to prevent duplicate geometry creation
 */
class GeometryCache {
  private cache = new Map<string, THREE.BufferGeometry>();
  private refCounts = new Map<string, number>();

  /**
   * Get or create a cached geometry
   */
  get(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
    if (this.cache.has(key)) {
      this.refCounts.set(key, (this.refCounts.get(key) || 0) + 1);
      return this.cache.get(key)!;
    }

    const geometry = factory();
    this.cache.set(key, geometry);
    this.refCounts.set(key, 1);
    return geometry;
  }

  /**
   * Release a geometry reference
   */
  release(key: string): void {
    const count = this.refCounts.get(key) || 0;
    if (count <= 1) {
      const geometry = this.cache.get(key);
      if (geometry) {
        geometry.dispose();
        this.cache.delete(key);
        this.refCounts.delete(key);
      }
    } else {
      this.refCounts.set(key, count - 1);
    }
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.forEach((geometry) => geometry.dispose());
    this.cache.clear();
    this.refCounts.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { entries: number; totalRefs: number } {
    let totalRefs = 0;
    this.refCounts.forEach((count) => (totalRefs += count));
    return { entries: this.cache.size, totalRefs };
  }
}

export const geometryCache = new GeometryCache();

// ============================================================================
// MATERIAL CACHE
// ============================================================================

/**
 * Global material cache to prevent duplicate material creation
 */
class MaterialCache {
  private cache = new Map<string, THREE.Material>();
  private refCounts = new Map<string, number>();

  /**
   * Get or create a cached material
   */
  get(key: string, factory: () => THREE.Material): THREE.Material {
    if (this.cache.has(key)) {
      this.refCounts.set(key, (this.refCounts.get(key) || 0) + 1);
      return this.cache.get(key)!;
    }

    const material = factory();
    this.cache.set(key, material);
    this.refCounts.set(key, 1);
    return material;
  }

  /**
   * Release a material reference
   */
  release(key: string): void {
    const count = this.refCounts.get(key) || 0;
    if (count <= 1) {
      const material = this.cache.get(key);
      if (material) {
        material.dispose();
        this.cache.delete(key);
        this.refCounts.delete(key);
      }
    } else {
      this.refCounts.set(key, count - 1);
    }
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.forEach((material) => material.dispose());
    this.cache.clear();
    this.refCounts.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { entries: number; totalRefs: number } {
    let totalRefs = 0;
    this.refCounts.forEach((count) => (totalRefs += count));
    return { entries: this.cache.size, totalRefs };
  }
}

export const materialCache = new MaterialCache();

// ============================================================================
// TEXTURE CACHE
// ============================================================================

/**
 * Global texture cache with LRU eviction
 */
class TextureCache {
  private cache = new Map<string, THREE.Texture>();
  private accessOrder: string[] = [];
  private maxSize: number;

  constructor(maxSize = 50) {
    this.maxSize = maxSize;
  }

  /**
   * Get or load a cached texture
   */
  async get(
    url: string,
    loader: THREE.TextureLoader = new THREE.TextureLoader()
  ): Promise<THREE.Texture> {
    if (this.cache.has(url)) {
      // Move to end of access order (most recently used)
      this.accessOrder = this.accessOrder.filter((u) => u !== url);
      this.accessOrder.push(url);
      return this.cache.get(url)!;
    }

    // Evict LRU if at capacity
    while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const lruUrl = this.accessOrder.shift()!;
      const texture = this.cache.get(lruUrl);
      if (texture) {
        texture.dispose();
        this.cache.delete(lruUrl);
      }
    }

    // Load new texture
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          this.cache.set(url, texture);
          this.accessOrder.push(url);
          resolve(texture);
        },
        undefined,
        reject
      );
    });
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.forEach((texture) => texture.dispose());
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics
   */
  getStats(): { entries: number; maxSize: number } {
    return { entries: this.cache.size, maxSize: this.maxSize };
  }
}

export const textureCache = new TextureCache();

// ============================================================================
// LOD (LEVEL OF DETAIL) UTILITIES
// ============================================================================

export interface LODLevel {
  distance: number;
  segments?: number;
  detail?: number;
}

/**
 * Default LOD levels for different quality settings
 */
export const LOD_PRESETS = {
  low: [
    { distance: 0, segments: 8, detail: 0 },
    { distance: 10, segments: 4, detail: 0 },
    { distance: 30, segments: 2, detail: 0 },
  ],
  medium: [
    { distance: 0, segments: 16, detail: 1 },
    { distance: 15, segments: 8, detail: 0 },
    { distance: 40, segments: 4, detail: 0 },
  ],
  high: [
    { distance: 0, segments: 32, detail: 2 },
    { distance: 20, segments: 16, detail: 1 },
    { distance: 50, segments: 8, detail: 0 },
  ],
  ultra: [
    { distance: 0, segments: 64, detail: 3 },
    { distance: 30, segments: 32, detail: 2 },
    { distance: 60, segments: 16, detail: 1 },
  ],
};

/**
 * Create a THREE.LOD object with predefined levels
 */
export function createLOD(
  createMesh: (segments: number, detail: number) => THREE.Mesh,
  levels: LODLevel[] = LOD_PRESETS.medium
): THREE.LOD {
  const lod = new THREE.LOD();

  levels.forEach(({ distance, segments = 16, detail = 1 }) => {
    const mesh = createMesh(segments, detail);
    lod.addLevel(mesh, distance);
  });

  return lod;
}

/**
 * Calculate appropriate LOD level based on camera distance
 */
export function calculateLODLevel(
  objectPosition: THREE.Vector3,
  cameraPosition: THREE.Vector3,
  levels: LODLevel[]
): number {
  const distance = objectPosition.distanceTo(cameraPosition);

  for (let i = levels.length - 1; i >= 0; i--) {
    if (distance >= levels[i].distance) {
      return i;
    }
  }

  return 0;
}

// ============================================================================
// FRUSTUM CULLING UTILITIES
// ============================================================================

/**
 * Pre-allocated frustum for culling checks
 */
const _frustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();

/**
 * Update frustum from camera (call once per frame)
 */
export function updateFrustum(camera: THREE.Camera): void {
  _projScreenMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  _frustum.setFromProjectionMatrix(_projScreenMatrix);
}

/**
 * Check if a bounding sphere is in the camera frustum
 */
export function isInFrustum(boundingSphere: THREE.Sphere): boolean {
  return _frustum.intersectsSphere(boundingSphere);
}

/**
 * Check if a bounding box is in the camera frustum
 */
export function isBoxInFrustum(boundingBox: THREE.Box3): boolean {
  return _frustum.intersectsBox(boundingBox);
}

/**
 * Check if a point is in the camera frustum
 */
export function isPointInFrustum(point: THREE.Vector3): boolean {
  return _frustum.containsPoint(point);
}

// ============================================================================
// BATCHED UPDATE UTILITIES
// ============================================================================

/**
 * Batch multiple matrix updates for instanced meshes
 */
export function batchMatrixUpdates(
  mesh: THREE.InstancedMesh,
  updates: Array<{
    index: number;
    position?: THREE.Vector3;
    rotation?: THREE.Quaternion;
    scale?: THREE.Vector3;
  }>
): void {
  const matrix = new THREE.Matrix4();
  const defaultPosition = new THREE.Vector3();
  const defaultRotation = new THREE.Quaternion();
  const defaultScale = new THREE.Vector3(1, 1, 1);

  updates.forEach(({ index, position, rotation, scale }) => {
    matrix.compose(
      position || defaultPosition,
      rotation || defaultRotation,
      scale || defaultScale
    );
    mesh.setMatrixAt(index, matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
}

/**
 * Frame-rate independent animation helper
 */
export function smoothStep(current: number, target: number, delta: number, speed: number): number {
  const diff = target - current;
  const step = diff * Math.min(1, speed * delta);
  return current + step;
}

/**
 * Smooth 3D vector interpolation
 */
export function smoothVector3(
  current: THREE.Vector3,
  target: THREE.Vector3,
  delta: number,
  speed: number
): void {
  current.x = smoothStep(current.x, target.x, delta, speed);
  current.y = smoothStep(current.y, target.y, delta, speed);
  current.z = smoothStep(current.z, target.z, delta, speed);
}

// ============================================================================
// RESOURCE DISPOSAL UTILITIES
// ============================================================================

/**
 * Recursively dispose of all resources in a Three.js object
 */
export function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Dispose geometry
      if (child.geometry) {
        child.geometry.dispose();
      }

      // Dispose material(s)
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(disposeMaterial);
        } else {
          disposeMaterial(child.material);
        }
      }
    }

    // Dispose lights with shadow maps
    if (child instanceof THREE.Light && (child as THREE.DirectionalLight).shadow) {
      const light = child as THREE.DirectionalLight;
      if (light.shadow.map) {
        light.shadow.map.dispose();
      }
    }
  });
}

/**
 * Dispose a material and its textures
 */
export function disposeMaterial(material: THREE.Material): void {
  // Dispose textures
  const mat = material as THREE.MeshStandardMaterial;

  const textures = [
    mat.map,
    mat.normalMap,
    mat.roughnessMap,
    mat.metalnessMap,
    mat.aoMap,
    mat.emissiveMap,
    mat.displacementMap,
    mat.alphaMap,
    mat.envMap,
    mat.lightMap,
    mat.bumpMap,
  ];

  textures.forEach((texture) => {
    if (texture) {
      texture.dispose();
    }
  });

  material.dispose();
}

/**
 * Dispose all global caches - call on app unmount
 */
export function disposeAllCaches(): void {
  geometryCache.clear();
  materialCache.clear();
  textureCache.clear();
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
}

/**
 * Collect performance metrics from the renderer
 */
export function getPerformanceMetrics(
  renderer: THREE.WebGLRenderer,
  frameTimes: number[]
): PerformanceMetrics {
  const info = renderer.info;

  // Calculate FPS from frame times
  const avgFrameTime =
    frameTimes.length > 0
      ? frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
      : 16.67;

  return {
    fps: Math.round(1000 / avgFrameTime),
    frameTime: Math.round(avgFrameTime * 100) / 100,
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    programs: info.programs?.length || 0,
  };
}

/**
 * Simple frame time tracker
 */
export class FrameTimeTracker {
  private times: number[] = [];
  private maxSamples: number;
  private lastTime = 0;

  constructor(maxSamples = 60) {
    this.maxSamples = maxSamples;
  }

  /**
   * Record a frame (call in useFrame or animation loop)
   */
  record(): void {
    const now = performance.now();
    if (this.lastTime > 0) {
      this.times.push(now - this.lastTime);
      if (this.times.length > this.maxSamples) {
        this.times.shift();
      }
    }
    this.lastTime = now;
  }

  /**
   * Get average frame time in milliseconds
   */
  getAverageFrameTime(): number {
    if (this.times.length === 0) return 16.67;
    return this.times.reduce((a, b) => a + b, 0) / this.times.length;
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return Math.round(1000 / this.getAverageFrameTime());
  }

  /**
   * Get all frame times
   */
  getFrameTimes(): number[] {
    return [...this.times];
  }

  /**
   * Reset the tracker
   */
  reset(): void {
    this.times = [];
    this.lastTime = 0;
  }
}

// ============================================================================
// INSTANCING UTILITIES
// ============================================================================

/**
 * Create an optimized instanced mesh with pre-allocated matrices
 */
export function createInstancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
  initialTransform?: (index: number, matrix: THREE.Matrix4) => void
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  if (initialTransform) {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      initialTransform(i, matrix);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return mesh;
}

/**
 * Pool for reusing instanced mesh slots
 */
export class InstancePool {
  private freeSlots: number[] = [];
  private activeSlots = new Set<number>();
  public readonly mesh: THREE.InstancedMesh;
  public readonly capacity: number;

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    capacity: number
  ) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.capacity = capacity;

    // Initialize all slots as free
    for (let i = 0; i < capacity; i++) {
      this.freeSlots.push(i);
      // Hide inactive instances by scaling to 0
      const matrix = new THREE.Matrix4();
      matrix.scale(new THREE.Vector3(0, 0, 0));
      this.mesh.setMatrixAt(i, matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Allocate a slot from the pool
   */
  allocate(): number | null {
    if (this.freeSlots.length === 0) return null;
    const slot = this.freeSlots.pop()!;
    this.activeSlots.add(slot);
    return slot;
  }

  /**
   * Release a slot back to the pool
   */
  release(slot: number): void {
    if (!this.activeSlots.has(slot)) return;

    this.activeSlots.delete(slot);
    this.freeSlots.push(slot);

    // Hide the instance
    const matrix = new THREE.Matrix4();
    matrix.scale(new THREE.Vector3(0, 0, 0));
    this.mesh.setMatrixAt(slot, matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Update a slot's transform
   */
  updateSlot(
    slot: number,
    position: THREE.Vector3,
    rotation: THREE.Quaternion,
    scale: THREE.Vector3
  ): void {
    const matrix = new THREE.Matrix4();
    matrix.compose(position, rotation, scale);
    this.mesh.setMatrixAt(slot, matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Get pool statistics
   */
  getStats(): { active: number; free: number; capacity: number } {
    return {
      active: this.activeSlots.size,
      free: this.freeSlots.length,
      capacity: this.capacity,
    };
  }

  /**
   * Dispose the pool
   */
  dispose(): void {
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((m) => m.dispose());
    } else {
      this.mesh.material.dispose();
    }
  }
}
