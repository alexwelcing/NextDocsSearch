import { ParsedPrompt, GenerationResult } from './types';
import { parsePrompt } from './promptParser';
import { buildGeometry } from './geometryBuilder';
import { buildMaterial } from './materialComposer';
import { findBestTemplate } from '../creation-templates';

/**
 * Main function to generate a 3D creation from a prompt
 */
export async function generateFromPrompt(
  prompt: string,
  useAI: boolean = false
): Promise<GenerationResult> {
  const startTime = Date.now();

  try {
    // Optionally enhance prompt with AI
    let enhancedPrompt = prompt;
    if (useAI) {
      // This would call the API endpoint
      // For now, we'll use the basic enhancer
      enhancedPrompt = prompt;
    }

    // Try to find a matching template first
    const template = findBestTemplate(enhancedPrompt);
    let config: ParsedPrompt;

    if (template) {
      // Use template as base and merge with parsed customizations
      const customizations = parsePrompt(enhancedPrompt);
      config = mergeConfigs(template.baseConfig as ParsedPrompt, customizations);
    } else {
      // Parse from scratch
      config = parsePrompt(enhancedPrompt);
    }

    // Generate geometry and material (validation)
    try {
      const geometry = buildGeometry(config);
      const material = buildMaterial(config.materials);

      // Both succeeded, return success
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        config,
        processingTime,
        componentCode: generateComponentCode(config, prompt),
      };
    } catch (error) {
      return {
        success: false,
        config,
        error: `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime: Date.now() - startTime,
      };
    }
  } catch (error) {
    return {
      success: false,
      config: parsePrompt(prompt),
      error: `Parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Merge template config with custom parsed config
 */
function mergeConfigs(template: ParsedPrompt, custom: ParsedPrompt): ParsedPrompt {
  return {
    ...template,
    ...custom,
    materials: {
      ...template.materials,
      ...custom.materials,
    },
    modifiers: {
      ...template.modifiers,
      ...custom.modifiers,
    },
    atmosphere: {
      ...template.atmosphere,
      ...custom.atmosphere,
      fog: custom.atmosphere.fog || template.atmosphere.fog,
      lighting: custom.atmosphere.lighting || template.atmosphere.lighting,
      particles: custom.atmosphere.particles || template.atmosphere.particles,
    },
    animations: custom.animations || template.animations,
    tags: Array.from(new Set((template.tags || []).concat(custom.tags || []))),
  };
}

/**
 * Generate React component code for a creation
 */
function generateComponentCode(config: ParsedPrompt, originalPrompt: string): string {
  const componentName = 'Generated3DCreation';

  return `
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Generated from prompt: "${originalPrompt}"
 * Created: ${new Date().toISOString()}
 */
export default function ${componentName}() {
  const meshRef = useRef<THREE.Mesh>(null);

  // Animation
  useFrame((state) => {
    if (!meshRef.current) return;

    ${generateAnimationCode(config.animations)}
  });

  return (
    <group>
      <mesh ref={meshRef} position={[${config.position?.join(', ') || '0, 0, 0'}]}>
        ${generateGeometryCode(config)}
        ${generateMaterialCode(config.materials)}
      </mesh>

      ${generateAtmosphereCode(config.atmosphere)}
    </group>
  );
}
`.trim();
}

function generateAnimationCode(
  animations?: NonNullable<ParsedPrompt['animations']>
): string {
  if (!animations || animations.length === 0) {
    return '// No animations';
  }

  const code: string[] = [];

  for (const anim of animations) {
    switch (anim.type) {
      case 'rotate':
        code.push(
          `meshRef.current.rotation.y += ${anim.speed * 0.01} * ${anim.intensity};`
        );
        break;
      case 'float':
        code.push(
          `meshRef.current.position.y = Math.sin(state.clock.elapsedTime * ${anim.speed}) * ${anim.intensity};`
        );
        break;
      case 'pulse':
        code.push(
          `const scale = 1 + Math.sin(state.clock.elapsedTime * ${anim.speed}) * ${anim.intensity * 0.1};`,
          `meshRef.current.scale.setScalar(scale);`
        );
        break;
    }
  }

  return code.join('\n    ');
}

function generateGeometryCode(config: ParsedPrompt): string {
  const [sx, sy, sz] = config.scale;

  switch (config.baseShape) {
    case 'box':
      return `<boxGeometry args={[${sx}, ${sy}, ${sz}]} />`;
    case 'sphere':
      return `<sphereGeometry args={[${sx}, 32, 32]} />`;
    case 'cylinder':
      return `<cylinderGeometry args={[${sx}, ${sx}, ${sy * 2}, 32]} />`;
    case 'torus':
      return `<torusGeometry args={[${sx}, ${sx * 0.3}, 16, 100]} />`;
    case 'cone':
      return `<coneGeometry args={[${sx}, ${sy * 2}, 32]} />`;
    default:
      return `<sphereGeometry args={[${sx}, 32, 32]} />`;
  }
}

function generateMaterialCode(material: ParsedPrompt['materials']): string {
  const props: string[] = [];

  props.push(`color="${material.color}"`);
  props.push(`roughness={${material.roughness}}`);
  props.push(`metalness={${material.metalness}}`);

  if (material.emissive) {
    props.push(`emissive="${material.emissive}"`);
    props.push(`emissiveIntensity={${material.emissiveIntensity || 1}}`);
  }

  if (material.transparent) {
    props.push(`transparent`);
    props.push(`opacity={${material.opacity || 1}}`);
  }

  return `<meshStandardMaterial ${props.join(' ')} />`;
}

function generateAtmosphereCode(atmosphere: ParsedPrompt['atmosphere']): string {
  const code: string[] = [];

  if (atmosphere.lighting && atmosphere.lighting.length > 0) {
    for (const light of atmosphere.lighting) {
      const pos = light.position || [0, 5, 5];
      code.push(
        `<${light.type}Light color="${light.color}" intensity={${light.intensity}} position={[${pos.join(', ')}]} ${light.castShadow ? 'castShadow' : ''} />`
      );
    }
  }

  if (atmosphere.fog) {
    code.push(
      `<fog attach="fog" args={['${atmosphere.fog.color}', ${atmosphere.fog.near}, ${atmosphere.fog.far}]} />`
    );
  }

  return code.join('\n      ');
}

/**
 * Validate a creation configuration
 */
export function validateConfig(config: ParsedPrompt): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!config.baseShape) {
    errors.push('Missing base shape');
  }

  if (!config.scale || config.scale.length !== 3) {
    errors.push('Invalid scale');
  }

  if (!config.materials) {
    errors.push('Missing materials configuration');
  }

  // Validate complexity isn't too high
  if (config.complexity > 10) {
    errors.push('Complexity too high (max: 10)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
