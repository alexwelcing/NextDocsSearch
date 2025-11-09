import * as THREE from 'three';
import { MaterialConfig } from './types';

/**
 * Build Three.js material from configuration
 */
export function buildMaterial(config: MaterialConfig): THREE.Material {
  const material = new THREE.MeshStandardMaterial({
    color: config.color,
    roughness: config.roughness,
    metalness: config.metalness,
    transparent: config.transparent || false,
    opacity: config.opacity !== undefined ? config.opacity : 1,
    wireframe: config.wireframe || false,
  });

  // Add emissive properties
  if (config.emissive) {
    material.emissive = new THREE.Color(config.emissive);
    material.emissiveIntensity = config.emissiveIntensity || 1;
  }

  // Add physical properties for glass/transmission
  if (config.transmission !== undefined) {
    (material as any).transmission = config.transmission;
  }

  if (config.ior !== undefined) {
    material.ior = config.ior;
  }

  if (config.thickness !== undefined) {
    (material as any).thickness = config.thickness;
  }

  if (config.clearcoat !== undefined) {
    material.clearcoat = config.clearcoat;
  }

  return material;
}

/**
 * Create material with texture (for future enhancement)
 */
export function buildMaterialWithTexture(
  config: MaterialConfig,
  texturePath?: string
): THREE.Material {
  const material = buildMaterial(config);

  if (texturePath && material instanceof THREE.MeshStandardMaterial) {
    const textureLoader = new THREE.TextureLoader();
    material.map = textureLoader.load(texturePath);
  }

  return material;
}

/**
 * Create animated material (shader-based)
 */
export function buildAnimatedMaterial(
  config: MaterialConfig,
  animationType: 'glow' | 'pulse' | 'glitch' | 'phase'
): THREE.ShaderMaterial {
  const uniforms = {
    time: { value: 0 },
    color: { value: new THREE.Color(config.color) },
    emissive: { value: new THREE.Color(config.emissive || config.color) },
    opacity: { value: config.opacity || 1 },
  };

  let vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float time;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;

      vec3 pos = position;
      ${animationType === 'pulse' ? 'pos *= 1.0 + sin(time * 2.0) * 0.1;' : ''}
      ${animationType === 'glitch' ? 'pos.x += sin(pos.y * 10.0 + time * 10.0) * 0.1 * step(0.95, sin(time * 20.0));' : ''}

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  let fragmentShader = `
    uniform float time;
    uniform vec3 color;
    uniform vec3 emissive;
    uniform float opacity;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
      vec3 finalColor = color;

      ${
        animationType === 'glow'
          ? `
        float glow = pow(1.0 - abs(dot(vNormal, vec3(0, 0, 1))), 2.0);
        finalColor = mix(color, emissive, glow);
      `
          : ''
      }

      ${
        animationType === 'pulse'
          ? `
        float pulse = sin(time * 3.0) * 0.5 + 0.5;
        finalColor = mix(color, emissive, pulse);
      `
          : ''
      }

      ${
        animationType === 'phase'
          ? `
        float phase = sin(vPosition.y * 5.0 + time * 2.0) * 0.5 + 0.5;
        finalColor = mix(color, emissive, phase);
      `
          : ''
      }

      ${
        animationType === 'glitch'
          ? `
        float glitch = step(0.98, sin(time * 50.0));
        if (glitch > 0.5) {
          finalColor = vec3(1.0 - finalColor.r, 1.0 - finalColor.g, 1.0 - finalColor.b);
        }
      `
          : ''
      }

      gl_FragColor = vec4(finalColor, opacity);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: config.transparent || false,
  });
}

/**
 * Material presets for common horror themes
 */
export const HORROR_MATERIAL_PRESETS = {
  spectral: {
    color: '#00ffaa',
    roughness: 0.1,
    metalness: 0,
    emissive: '#00ffaa',
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.7,
  },
  decayed: {
    color: '#3a2f2f',
    roughness: 0.95,
    metalness: 0.1,
    emissive: '#1a0a00',
    emissiveIntensity: 0.2,
  },
  blood: {
    color: '#8b0000',
    roughness: 0.6,
    metalness: 0.2,
    emissive: '#ff0000',
    emissiveIntensity: 0.5,
  },
  bone: {
    color: '#f5f5dc',
    roughness: 0.7,
    metalness: 0,
  },
  shadow: {
    color: '#000000',
    roughness: 0.9,
    metalness: 0,
    transparent: true,
    opacity: 0.8,
  },
  cursedMetal: {
    color: '#1a1a1a',
    roughness: 0.3,
    metalness: 0.9,
    emissive: '#330000',
    emissiveIntensity: 1,
  },
  ethereal: {
    color: '#ffffff',
    roughness: 0,
    metalness: 0,
    transparent: true,
    opacity: 0.3,
    transmission: 1,
    ior: 1.5,
  },
} as const;

/**
 * Material presets for editorial themes
 */
export const EDITORIAL_MATERIAL_PRESETS = {
  newsprint: {
    color: '#f5f5f0',
    roughness: 0.9,
    metalness: 0,
  },
  ink: {
    color: '#000000',
    roughness: 0.4,
    metalness: 0.1,
  },
  highlighter: {
    color: '#ffff00',
    roughness: 0.2,
    metalness: 0,
    transparent: true,
    opacity: 0.6,
  },
  paper: {
    color: '#ffffff',
    roughness: 0.8,
    metalness: 0,
  },
  glossyMagazine: {
    color: '#ffffff',
    roughness: 0.1,
    metalness: 0,
    clearcoat: 1,
  },
} as const;

/**
 * Get material preset by name
 */
export function getMaterialPreset(
  presetName: keyof typeof HORROR_MATERIAL_PRESETS | keyof typeof EDITORIAL_MATERIAL_PRESETS
): MaterialConfig {
  return (
    HORROR_MATERIAL_PRESETS[presetName as keyof typeof HORROR_MATERIAL_PRESETS] ||
    EDITORIAL_MATERIAL_PRESETS[presetName as keyof typeof EDITORIAL_MATERIAL_PRESETS] || {
      color: '#ffffff',
      roughness: 0.5,
      metalness: 0.5,
    }
  );
}
