import * as THREE from 'three';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { ParsedPrompt, BaseShape, GeometryModifiers } from './types';

/**
 * Build geometry from parsed prompt configuration
 */
export function buildGeometry(config: ParsedPrompt): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;

  // Create base geometry
  switch (config.baseShape) {
    case 'box':
      geometry = new THREE.BoxGeometry(
        config.scale[0],
        config.scale[1],
        config.scale[2],
        8,
        8,
        8
      );
      break;

    case 'sphere':
      geometry = new THREE.SphereGeometry(config.scale[0], 32, 32);
      break;

    case 'cylinder':
      geometry = new THREE.CylinderGeometry(
        config.scale[0],
        config.scale[0],
        config.scale[1] * 2,
        32
      );
      break;

    case 'torus':
      geometry = new THREE.TorusGeometry(config.scale[0], config.scale[0] * 0.3, 16, 100);
      break;

    case 'cone':
      geometry = new THREE.ConeGeometry(config.scale[0], config.scale[1] * 2, 32);
      break;

    case 'twisted':
      geometry = createTwistedGeometry(config.scale, 5);
      break;

    case 'organic':
      geometry = createOrganicGeometry(config.scale);
      break;

    case 'extrusion':
      geometry = createExtrusionGeometry(config.scale);
      break;

    case 'fractal':
      geometry = createFractalGeometry(config.scale);
      break;

    default:
      geometry = new THREE.SphereGeometry(config.scale[0], 32, 32);
  }

  // Apply modifiers
  if (config.modifiers) {
    geometry = applyModifiers(geometry, config.modifiers, config.horrorLevel);
  }

  // Compute vertex normals for proper lighting
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Apply geometric modifiers (distortion, decay, etc.)
 */
function applyModifiers(
  geometry: THREE.BufferGeometry,
  modifiers: GeometryModifiers,
  horrorLevel: number
): THREE.BufferGeometry {
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);

    // Apply twisted modifier
    if (modifiers.twisted) {
      const angle = vertex.y * 0.5;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = vertex.x * cos - vertex.z * sin;
      const z = vertex.x * sin + vertex.z * cos;
      vertex.x = x;
      vertex.z = z;
    }

    // Apply decay modifier
    if (modifiers.decayed) {
      const noise = simplex3D(vertex.x * 2, vertex.y * 2, vertex.z * 2);
      const erosion = noise * 0.2 * (horrorLevel / 10);
      vertex.multiplyScalar(1 - Math.abs(erosion));
    }

    // Apply fractured modifier
    if (modifiers.fractured) {
      const noise = simplex3D(vertex.x * 3, vertex.y * 3, vertex.z * 3);
      if (noise > 0.3) {
        vertex.multiplyScalar(1 + noise * 0.3);
      }
    }

    // Apply organic modifier
    if (modifiers.organic) {
      const noise1 = simplex3D(vertex.x, vertex.y, vertex.z);
      const noise2 = simplex3D(vertex.x * 2, vertex.y * 2, vertex.z * 2);
      vertex.x += noise1 * 0.2;
      vertex.y += noise2 * 0.2;
      vertex.z += noise1 * 0.15;
    }

    // Apply sharp modifier
    if (modifiers.sharp) {
      const length = vertex.length();
      if (length > 0) {
        vertex.normalize().multiplyScalar(Math.pow(length, 1.2));
      }
    }

    // Apply smooth modifier
    if (modifiers.smooth) {
      const length = vertex.length();
      if (length > 0) {
        vertex.normalize().multiplyScalar(Math.pow(length, 0.8));
      }
    }

    // Apply distortion if configured
    if (modifiers.distortion) {
      vertex.add(applyDistortion(vertex, modifiers.distortion));
    }

    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  position.needsUpdate = true;
  return geometry;
}

/**
 * Apply specific distortion types
 */
function applyDistortion(
  vertex: THREE.Vector3,
  distortion: NonNullable<GeometryModifiers['distortion']>
): THREE.Vector3 {
  const offset = new THREE.Vector3();
  const { type, intensity, frequency = 1, seed = 0 } = distortion;

  switch (type) {
    case 'noise':
      const noise = simplex3D(
        vertex.x * frequency + seed,
        vertex.y * frequency + seed,
        vertex.z * frequency + seed
      );
      offset.copy(vertex).normalize().multiplyScalar(noise * intensity);
      break;

    case 'twist':
      // Already handled in modifiers.twisted
      break;

    case 'decay':
      const decayNoise = simplex3D(vertex.x * 2, vertex.y * 2, vertex.z * 2);
      if (decayNoise > 0) {
        offset.copy(vertex).multiplyScalar(-decayNoise * intensity * 0.3);
      }
      break;

    case 'melt':
      if (vertex.y > 0) {
        offset.y = -Math.abs(simplex3D(vertex.x, 0, vertex.z)) * intensity * vertex.y * 0.5;
      }
      break;

    case 'pulse':
      const pulseFactor = Math.sin(Date.now() * 0.001 * frequency) * 0.5 + 0.5;
      offset.copy(vertex).normalize().multiplyScalar(pulseFactor * intensity * 0.1);
      break;

    case 'erosion':
      const erosionNoise = simplex3D(vertex.x * 3, vertex.y * 3, vertex.z * 3);
      if (Math.abs(erosionNoise) > 0.5) {
        offset.copy(vertex).multiplyScalar(-erosionNoise * intensity * 0.2);
      }
      break;

    case 'stretch':
      offset.y = simplex3D(vertex.x, vertex.y, vertex.z) * intensity * 0.5;
      break;

    case 'shatter':
      const shatterNoise = simplex3D(vertex.x * 4, vertex.y * 4, vertex.z * 4);
      if (shatterNoise > 0.3) {
        offset.copy(vertex).normalize().multiplyScalar(shatterNoise * intensity * 0.4);
      }
      break;

    case 'glitch':
      const glitchFactor = Math.random() > 0.95 ? Math.random() : 0;
      offset.x = (Math.random() - 0.5) * glitchFactor * intensity;
      offset.y = (Math.random() - 0.5) * glitchFactor * intensity;
      offset.z = (Math.random() - 0.5) * glitchFactor * intensity;
      break;
  }

  return offset;
}

/**
 * Create twisted geometry (spiral/helix)
 */
function createTwistedGeometry(scale: [number, number, number], twists: number): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(scale[0], scale[0], scale[1] * 2, 32, 20);
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const angle = (vertex.y / (scale[1] * 2)) * Math.PI * twists;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = vertex.x * cos - vertex.z * sin;
    const z = vertex.x * sin + vertex.z * cos;
    position.setXYZ(i, x, vertex.y, z);
  }

  position.needsUpdate = true;
  return geometry;
}

/**
 * Create organic tree-like geometry
 */
function createOrganicGeometry(scale: [number, number, number]): THREE.BufferGeometry {
  const group = new THREE.Group();

  // Create trunk
  const trunkGeometry = new THREE.CylinderGeometry(
    scale[0] * 0.3,
    scale[0] * 0.4,
    scale[1] * 2,
    8
  );
  const trunk = new THREE.Mesh(trunkGeometry);
  group.add(trunk);

  // Create branches recursively
  function createBranch(
    parent: THREE.Object3D,
    depth: number,
    length: number,
    thickness: number
  ) {
    if (depth === 0) return;

    const branchCount = 2 + Math.floor(Math.random() * 2);

    for (let i = 0; i < branchCount; i++) {
      const branchGeometry = new THREE.CylinderGeometry(
        thickness * 0.6,
        thickness,
        length,
        6
      );

      const branch = new THREE.Mesh(branchGeometry);
      branch.position.y = length / 2;
      branch.rotation.z = (Math.random() - 0.5) * Math.PI * 0.4;
      branch.rotation.x = (Math.random() - 0.5) * Math.PI * 0.4;

      const branchGroup = new THREE.Group();
      branchGroup.add(branch);
      branchGroup.position.y = length * 0.7;
      branchGroup.rotation.y = (i / branchCount) * Math.PI * 2;

      parent.add(branchGroup);

      createBranch(branch, depth - 1, length * 0.7, thickness * 0.7);
    }
  }

  createBranch(trunk, 3, scale[1] * 0.8, scale[0] * 0.2);

  // Merge all geometries
  const mergedGeometry = new THREE.BufferGeometry();
  const geometries: THREE.BufferGeometry[] = [];

  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geo = child.geometry.clone();
      geo.applyMatrix4(child.matrixWorld);
      geometries.push(geo);
    }
  });

  return mergeBufferGeometries(geometries) || mergedGeometry;
}

/**
 * Create architectural extrusion geometry
 */
function createExtrusionGeometry(scale: [number, number, number]): THREE.BufferGeometry {
  // Create a gothic arch shape
  const shape = new THREE.Shape();

  const width = scale[0];
  const height = scale[1] * 2;

  // Gothic arch outline
  shape.moveTo(-width, 0);
  shape.lineTo(-width, height * 0.6);
  shape.quadraticCurveTo(-width * 0.5, height, 0, height);
  shape.quadraticCurveTo(width * 0.5, height, width, height * 0.6);
  shape.lineTo(width, 0);
  shape.lineTo(-width, 0);

  const extrudeSettings = {
    depth: scale[2],
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 3,
  };

  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

/**
 * Create fractal-based geometry
 */
function createFractalGeometry(scale: [number, number, number]): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  function addCube(x: number, y: number, z: number, size: number, depth: number) {
    if (depth === 0 || size < 0.1) return;

    const geo = new THREE.BoxGeometry(size, size, size);
    geo.translate(x, y, z);
    geometries.push(geo);

    const newSize = size * 0.4;
    const offset = size * 0.5;

    // Sierpinski-like pattern
    addCube(x + offset, y + offset, z + offset, newSize, depth - 1);
    addCube(x - offset, y + offset, z + offset, newSize, depth - 1);
    addCube(x + offset, y - offset, z + offset, newSize, depth - 1);
    addCube(x + offset, y + offset, z - offset, newSize, depth - 1);
  }

  addCube(0, 0, 0, scale[0], 3);

  return mergeBufferGeometries(geometries) || new THREE.BufferGeometry();
}

/**
 * Simple 3D Simplex noise implementation
 */
function simplex3D(x: number, y: number, z: number): number {
  // Simplified noise - in production, use a library like simplex-noise
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

/**
 * Export for use in components
 */
export { applyModifiers, createTwistedGeometry, createOrganicGeometry };
