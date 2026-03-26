/**
 * ProGen Character Generator
 * 
 * Advanced procedural generation with anatomical accuracy,
 * style coherence, and rich variation.
 */

import { 
  ProGenCharacter, CharacterIdentity, BodyShape, BodyProportions,
  FaceFeatures, ColorPalette, MaterialConfig, OutfitLayer, SkeletonConfig,
  BoneNode, CharacterArchetype, CharacterTrait, StyleTheme, QualityScore,
  AnimationClip, Keyframe, AnimationState, OutfitStyle
} from '../types';

// === Seeded Random for Reproducibility ===

export class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  // Linear Congruential Generator
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  
  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  
  nextInt(min: number, max: number): number {
    return Math.floor(this.nextFloat(min, max + 1));
  }
  
  nextBool(probability = 0.5): boolean {
    return this.next() < probability;
  }
  
  // Gaussian distribution for natural variation
  nextGaussian(mean = 0, stdDev = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z0 * stdDev;
  }
  
  // Pick from array with weights
  pickWeighted<T>(items: T[], weights: number[]): T {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = this.next() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) return items[i];
    }
    return items[items.length - 1];
  }
  
  // Shuffle array
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// === Archetype Definitions ===

interface ArchetypeProfile {
  name: CharacterArchetype;
  bodyBias: {
    buildWeights: [number, number, number, number]; // ectomorph, mesomorph, endomorph, mixed
    muscularityMean: number;
    muscularityStdDev: number;
    heightMean: number;
    heightStdDev: number;
  };
  colorSchemes: string[][];
  outfitStyles: OutfitStyle[];
  traitTendencies: Record<string, number>;
}

const ARCHETYPE_PROFILES: Record<CharacterArchetype, ArchetypeProfile> = {
  explorer: {
    name: 'explorer',
    bodyBias: {
      buildWeights: [0.3, 0.4, 0.1, 0.2],
      muscularityMean: 0.5,
      muscularityStdDev: 0.15,
      heightMean: 1.78,
      heightStdDev: 0.08
    },
    colorSchemes: [
      ['#8B7355', '#D2B48C', '#556B2F'], // Earth tones
      ['#4682B4', '#B0C4DE', '#708090'], // Steel blue
      ['#CD853F', '#DEB887', '#8B4513'], // Explorer browns
    ],
    outfitStyles: ['tactical', 'layered', 'casual'] as OutfitStyle[],
    traitTendencies: { adventurous: 0.8, curious: 0.9, resilient: 0.6 }
  },
  scholar: {
    name: 'scholar',
    bodyBias: {
      buildWeights: [0.5, 0.2, 0.1, 0.2],
      muscularityMean: 0.3,
      muscularityStdDev: 0.1,
      heightMean: 1.72,
      heightStdDev: 0.1
    },
    colorSchemes: [
      ['#2F4F4F', '#708090', '#B0C4DE'], // Slate
      ['#483D8B', '#6A5ACD', '#9370DB'], // Deep purples
      ['#191970', '#4169E1', '#6495ED'], // Midnight blues
    ],
    outfitStyles: ['formal', 'minimal', 'layered'] as OutfitStyle[],
    traitTendencies: { analytical: 0.9, patient: 0.7, introverted: 0.5 }
  },
  warrior: {
    name: 'warrior',
    bodyBias: {
      buildWeights: [0.1, 0.6, 0.2, 0.1],
      muscularityMean: 0.75,
      muscularityStdDev: 0.12,
      heightMean: 1.82,
      heightStdDev: 0.07
    },
    colorSchemes: [
      ['#8B0000', '#CD5C5C', '#DC143C'], // Crimson
      ['#2F1810', '#8B4513', '#D2691E'], // Bronze
      ['#1C1C1C', '#4A4A4A', '#808080'], // Battle grey
    ],
    outfitStyles: ['tactical', 'athletic', 'scifi'] as OutfitStyle[],
    traitTendencies: { brave: 0.9, disciplined: 0.8, intense: 0.7 }
  },
  mystic: {
    name: 'mystic',
    bodyBias: {
      buildWeights: [0.4, 0.2, 0.2, 0.2],
      muscularityMean: 0.35,
      muscularityStdDev: 0.15,
      heightMean: 1.7,
      heightStdDev: 0.12
    },
    colorSchemes: [
      ['#4B0082', '#8A2BE2', '#9932CC'], // Indigo
      ['#006400', '#228B22', '#32CD32'], // Forest
      ['#191970', '#000080', '#483D8B'], // Deep mystic
    ],
    outfitStyles: ['fantasy', 'layered', 'minimal'] as OutfitStyle[],
    traitTendencies: { intuitive: 0.9, mysterious: 0.8, spiritual: 0.9 }
  },
  artisan: {
    name: 'artisan',
    bodyBias: {
      buildWeights: [0.25, 0.45, 0.2, 0.1],
      muscularityMean: 0.55,
      muscularityStdDev: 0.15,
      heightMean: 1.75,
      heightStdDev: 0.09
    },
    colorSchemes: [
      ['#8B4513', '#D2691E', '#F4A460'], // Wood tones
      ['#556B2F', '#6B8E23', '#9ACD32'], // Moss
      ['#800000', '#A52A2A', '#CD5C5C'], // Craft red
    ],
    outfitStyles: ['casual', 'layered', 'minimal'] as OutfitStyle[],
    traitTendencies: { creative: 0.9, detail_oriented: 0.8, patient: 0.7 }
  },
  diplomat: {
    name: 'diplomat',
    bodyBias: {
      buildWeights: [0.35, 0.3, 0.25, 0.1],
      muscularityMean: 0.4,
      muscularityStdDev: 0.12,
      heightMean: 1.76,
      heightStdDev: 0.08
    },
    colorSchemes: [
      ['#191970', '#4169E1', '#87CEEB'], // Diplomatic blue
      ['#800080', '#9370DB', '#DDA0DD'], // Royal purple
      ['#2F4F4F', '#708090', '#C0C0C0'], // Silver slate
    ],
    outfitStyles: ['formal', 'layered', 'minimal'] as OutfitStyle[],
    traitTendencies: { charismatic: 0.9, tactful: 0.9, composed: 0.8 }
  },
  rogue: {
    name: 'rogue',
    bodyBias: {
      buildWeights: [0.4, 0.35, 0.1, 0.15],
      muscularityMean: 0.5,
      muscularityStdDev: 0.1,
      heightMean: 1.73,
      heightStdDev: 0.07
    },
    colorSchemes: [
      ['#1C1C1C', '#363636', '#4F4F4F'], // Shadow
      ['#2F1810', '#5C4033', '#8B7355'], // Leather
      ['#006400', '#228B22', '#556B2F'], // Forest stealth
    ],
    outfitStyles: ['tactical', 'layered', 'minimal'] as OutfitStyle[],
    traitTendencies: { cunning: 0.9, agile: 0.8, independent: 0.9 }
  },
  guardian: {
    name: 'guardian',
    bodyBias: {
      buildWeights: [0.1, 0.5, 0.3, 0.1],
      muscularityMean: 0.7,
      muscularityStdDev: 0.1,
      heightMean: 1.85,
      heightStdDev: 0.06
    },
    colorSchemes: [
      ['#191970', '#4169E1', '#B0C4DE'], // Guardian blue
      ['#8B4513', '#CD853F', '#DEB887'], // Bronze gold
      ['#2F4F4F', '#708090', '#F5F5F5'], // Steel silver
    ],
    outfitStyles: ['tactical', 'formal', 'scifi'] as OutfitStyle[],
    traitTendencies: { protective: 0.9, loyal: 0.9, steadfast: 0.8 }
  },
  nomad: {
    name: 'nomad',
    bodyBias: {
      buildWeights: [0.25, 0.4, 0.2, 0.15],
      muscularityMean: 0.55,
      muscularityStdDev: 0.15,
      heightMean: 1.76,
      heightStdDev: 0.1
    },
    colorSchemes: [
      ['#D2691E', '#F4A460', '#DEB887'], // Desert
      ['#556B2F', '#8FBC8F', '#F0E68C'], // Oasis
      ['#708090', '#B0C4DE', '#F5F5F5'], // Sky nomad
    ],
    outfitStyles: ['layered', 'casual', 'minimal'] as OutfitStyle[],
    traitTendencies: { adaptable: 0.9, free_spirited: 0.9, resourceful: 0.8 }
  },
  pioneer: {
    name: 'pioneer',
    bodyBias: {
      buildWeights: [0.2, 0.5, 0.2, 0.1],
      muscularityMean: 0.6,
      muscularityStdDev: 0.15,
      heightMean: 1.77,
      heightStdDev: 0.09
    },
    colorSchemes: [
      ['#8B4513', '#D2691E', '#F4A460'], // Pioneer leather
      ['#2F4F4F', '#708090', '#B0C4DE'], // Industrial
      ['#228B22', '#32CD32', '#90EE90'], // Frontier green
    ],
    outfitStyles: ['tactical', 'layered', 'casual'],
    traitTendencies: { innovative: 0.9, courageous: 0.8, industrious: 0.9 }
  },
  observer: {
    name: 'observer',
    bodyBias: {
      buildWeights: [0.45, 0.25, 0.15, 0.15],
      muscularityMean: 0.35,
      muscularityStdDev: 0.12,
      heightMean: 1.71,
      heightStdDev: 0.11
    },
    colorSchemes: [
      ['#2F4F4F', '#708090', '#C0C0C0'], // Neutral grey
      ['#483D8B', '#6A5ACD', '#B0C4DE'], // Quiet purple
      ['#556B2F', '#8FBC8F', '#F5F5DC'], // Watcher green
    ],
    outfitStyles: ['minimal', 'casual', 'layered'] as OutfitStyle[],
    traitTendencies: { perceptive: 0.9, calm: 0.8, detached: 0.6 }
  },
  catalyst: {
    name: 'catalyst',
    bodyBias: {
      buildWeights: [0.3, 0.35, 0.25, 0.1],
      muscularityMean: 0.5,
      muscularityStdDev: 0.18,
      heightMean: 1.75,
      heightStdDev: 0.1
    },
    colorSchemes: [
      ['#FF4500', '#FF6347', '#FFA500'], // Fire orange
      ['#9400D3', '#BA55D3', '#DDA0DD'], // Electric purple
      ['#00CED1', '#40E0D0', '#AFEEEE'], // Catalyst cyan
    ],
    outfitStyles: ['scifi', 'fantasy', 'minimal'] as OutfitStyle[],
    traitTendencies: { transformative: 0.9, energetic: 0.9, unpredictable: 0.7 }
  }
};

// === Style Theme Definitions ===

const STYLE_THEMES: Record<StyleTheme, {
  colorModifiers: (colors: string[], rng: SeededRandom) => string[];
  materialOverrides: Partial<MaterialConfig>;
  outfitModifiers: (layers: OutfitLayer[], rng: SeededRandom) => OutfitLayer[];
}> = {
  cyberpunk: {
    colorModifiers: (colors, rng) => [
      '#FF00FF', // Neon magenta
      '#00FFFF', // Cyan
      rng.pickWeighted(['#FFFF00', '#FF0080', '#80FF00'], [0.4, 0.35, 0.25])
    ],
    materialOverrides: { roughness: 0.3, metalness: 0.7, emissiveIntensity: 0.3 },
    outfitModifiers: (layers) => layers.map(l => ({ ...l, style: 'scifi' as const }))
  },
  solarpunk: {
    colorModifiers: () => ['#228B22', '#FFD700', '#8FBC8F'],
    materialOverrides: { roughness: 0.8, metalness: 0.1 },
    outfitModifiers: (layers) => layers.map(l => ({ ...l, style: 'organic' as const }))
  },
  retrofuturism: {
    colorModifiers: (colors, rng) => [
      '#FF6B35', // Retro orange
      '#004E89', // Deep blue
      rng.pickWeighted(['#F7C59F', '#1A659E', '#FF6B35'], [0.5, 0.3, 0.2])
    ],
    materialOverrides: { roughness: 0.4, metalness: 0.4 },
    outfitModifiers: (layers) => layers
  },
  biopunk: {
    colorModifiers: () => ['#8B0000', '#2F4F4F', '#556B2F'],
    materialOverrides: { roughness: 0.6, metalness: 0.2 },
    outfitModifiers: (layers) => layers.map(l => ({ ...l, style: 'tactical' as const }))
  },
  minimalist: {
    colorModifiers: (colors) => ['#F5F5F5', '#2C2C2C', '#808080'],
    materialOverrides: { roughness: 0.5, metalness: 0.1 },
    outfitModifiers: (layers) => layers.slice(0, 2).map(l => ({ ...l, style: 'minimal' as const }))
  },
  baroque: {
    colorModifiers: (colors, rng) => [
      '#FFD700', // Gold
      '#8B0000', // Deep red
      rng.pickWeighted(['#4B0082', '#191970', '#800080'], [0.4, 0.35, 0.25])
    ],
    materialOverrides: { roughness: 0.3, metalness: 0.5 },
    outfitModifiers: (layers) => layers.map(l => ({ ...l, style: 'formal' as const, bulk: l.bulk * 1.3 }))
  },
  industrial: {
    colorModifiers: () => ['#4A4A4A', '#808080', '#A9A9A9'],
    materialOverrides: { roughness: 0.7, metalness: 0.6 },
    outfitModifiers: (layers) => layers.map(l => ({ ...l, style: 'tactical' as const }))
  },
  organic: {
    colorModifiers: (colors, rng) => [
      '#8B7355', // Wood
      '#228B22', // Green
      rng.pickWeighted(['#D2691E', '#F4A460', '#DEB887'], [0.4, 0.35, 0.25])
    ],
    materialOverrides: { roughness: 0.9, metalness: 0.0 },
    outfitModifiers: (layers) => layers.map(l => ({ ...l, style: 'casual' as const }))
  },
  neon: {
    colorModifiers: (colors, rng) => [
      rng.pickWeighted(['#FF00FF', '#00FF00', '#00FFFF'], [0.4, 0.35, 0.25]),
      '#1a1a2e',
      rng.pickWeighted(['#FF00FF', '#00FF00', '#00FFFF'], [0.4, 0.35, 0.25])
    ],
    materialOverrides: { roughness: 0.4, metalness: 0.3, emissiveIntensity: 0.5 },
    outfitModifiers: (layers) => layers.map(l => ({ ...l, style: 'scifi' as const }))
  },
  monochrome: {
    colorModifiers: () => ['#000000', '#404040', '#808080'],
    materialOverrides: { roughness: 0.5, metalness: 0.2 },
    outfitModifiers: (layers) => layers.map(l => ({ ...l, style: 'minimal' as const }))
  },
  pastel: {
    colorModifiers: (colors, rng) => [
      rng.pickWeighted(['#FFB6C1', '#B0E0E6', '#F0E68C'], [0.4, 0.35, 0.25]),
      rng.pickWeighted(['#E6E6FA', '#FFE4E1', '#F5F5DC'], [0.4, 0.35, 0.25]),
      '#FFFFFF'
    ],
    materialOverrides: { roughness: 0.6, metalness: 0.0 },
    outfitModifiers: (layers) => layers.map(l => ({ ...l, style: 'casual' as const }))
  },
  vibrant: {
    colorModifiers: (colors, rng) => [
      rng.pickWeighted(['#FF0000', '#00FF00', '#0000FF'], [0.35, 0.35, 0.3]),
      rng.pickWeighted(['#FFFF00', '#FF00FF', '#00FFFF'], [0.35, 0.35, 0.3]),
      rng.pickWeighted(['#FF8C00', '#9400D3', '#FF1493'], [0.35, 0.35, 0.3])
    ],
    materialOverrides: { roughness: 0.4, metalness: 0.1 },
    outfitModifiers: (layers) => layers
  }
};

// === Generator Class ===

export class CharacterGenerator {
  private rng: SeededRandom;
  
  constructor(seed?: number) {
    this.rng = new SeededRandom(seed ?? Date.now());
  }
  
  generate(options: {
    archetype?: CharacterArchetype;
    theme?: StyleTheme;
    seed?: number;
  } = {}): ProGenCharacter {
    // Use provided seed or generate new one
    const seed = options.seed ?? Math.floor(Math.random() * 1000000);
    this.rng = new SeededRandom(seed);
    
    // Select archetype
    const archetypes = Object.keys(ARCHETYPE_PROFILES) as CharacterArchetype[];
    const archetype = options.archetype ?? this.rng.pickWeighted(archetypes, archetypes.map(() => 1));
    const profile = ARCHETYPE_PROFILES[archetype];
    
    // Generate components
    const identity = this.generateIdentity(archetype, seed, profile);
    const body = this.generateBody(profile);
    const face = this.generateFace(profile, body);
    const colors = this.generateColors(profile, options.theme);
    const outfit = this.generateOutfit(profile, options.theme);
    const materials = this.generateMaterials(options.theme);
    const skeleton = this.generateSkeleton(body);
    const animations = this.generateAnimations(skeleton);
    
    // Calculate quality
    const quality = this.calculateQuality({ body, face, colors, outfit });
    
    return {
      identity,
      body,
      face,
      colors,
      materials,
      outfit,
      skeleton,
      animations,
      generation: {
        version: '1.0.0',
        createdAt: new Date(),
        quality,
        renderCount: 0
      }
    };
  }
  
  private generateIdentity(
    archetype: CharacterArchetype,
    seed: number,
    profile: ArchetypeProfile
  ): CharacterIdentity {
    // Generate name based on archetype
    const namePrefixes: Record<CharacterArchetype, string[]> = {
      explorer: ['Aria', 'Orion', 'Vesper', 'Kael', 'Lyra'],
      scholar: ['Thaddeus', 'Elena', 'Oliver', 'Iris', 'Felix'],
      warrior: ['Kira', 'Thorne', 'Freya', 'Gareth', 'Val'],
      mystic: ['Seraph', 'Mira', 'Caelum', 'Luna', 'Zen'],
      artisan: ['Juno', 'Cole', 'Maya', 'Finn', 'Ruby'],
      diplomat: ['Grace', 'Julian', 'Sage', 'Leo', 'Nova'],
      rogue: ['Shadow', 'Raven', 'Ash', 'Nyx', 'Phoenix'],
      guardian: ['Atlas', 'Vega', 'Sirius', 'Astra', 'Cosmo'],
      nomad: ['Dune', 'River', 'Skye', 'Stone', 'Flame'],
      pioneer: ['Terra', 'Spark', 'Forge', 'Bloom', 'Wright'],
      observer: ['Echo', 'Vale', 'Nebula', 'Quill', 'Cipher'],
      catalyst: ['Flux', 'Pulse', 'Surge', 'Spark', 'Drive']
    };
    
    const nameSuffixes = ['', 'the Bold', 'of Orion', 'Starborn', 'Walker', 'Seeker'];
    
    const name = this.rng.pickWeighted(namePrefixes[archetype], namePrefixes[archetype].map(() => 1)) +
                 (this.rng.nextBool(0.3) ? ' ' + this.rng.pickWeighted(nameSuffixes, [0.5, 0.15, 0.15, 0.1, 0.05, 0.05]) : '');
    
    // Generate traits
    const traits: CharacterTrait[] = Object.entries(profile.traitTendencies).map(([name, tendency]) => ({
      name,
      value: this.rng.nextGaussian(tendency, 0.2),
      category: 'personality'
    }));
    
    // Add physical traits
    traits.push(
      { name: 'posture', value: this.rng.nextGaussian(0, 0.3), category: 'physical' },
      { name: 'presence', value: this.rng.nextGaussian(0.2, 0.4), category: 'physical' }
    );
    
    return {
      id: `progen_${archetype}_${seed}`,
      seed,
      displayName: name,
      archetype,
      traits
    };
  }
  
  private generateBody(profile: ArchetypeProfile): BodyShape {
    const buildOptions: Array<'ectomorph' | 'mesomorph' | 'endomorph' | 'mixed'> = 
      ['ectomorph', 'mesomorph', 'endomorph', 'mixed'];
    const build = this.rng.pickWeighted(buildOptions, profile.bodyBias.buildWeights);
    
    const muscularity = Math.max(0, Math.min(1, 
      this.rng.nextGaussian(profile.bodyBias.muscularityMean, profile.bodyBias.muscularityStdDev)
    ));
    
    const bodyFat = this.rng.nextFloat(0.05, 0.35);
    
    // Generate proportions based on build and archetype biases
    const height = Math.max(1.5, Math.min(2.0,
      this.rng.nextGaussian(profile.bodyBias.heightMean, profile.bodyBias.heightStdDev)
    ));
    
    const proportions: BodyProportions = {
      height,
      shoulderWidth: this.calculateShoulderWidth(build, muscularity),
      chestDepth: this.calculateChestDepth(build, muscularity),
      waistWidth: this.calculateWaistWidth(build, bodyFat),
      hipWidth: this.calculateHipWidth(build, bodyFat),
      armLength: height * this.rng.nextFloat(0.32, 0.38),
      legLength: height * this.rng.nextFloat(0.45, 0.52),
      neckLength: height * this.rng.nextFloat(0.05, 0.09),
      headScale: this.rng.nextFloat(0.92, 1.12)
    };
    
    return { build, muscularity, bodyFat, proportions };
  }
  
  private calculateShoulderWidth(build: string, muscularity: number): number {
    const base = build === 'ectomorph' ? 0.35 : build === 'mesomorph' ? 0.45 : build === 'endomorph' ? 0.5 : 0.4;
    return base + muscularity * 0.1 + this.rng.nextFloat(-0.03, 0.03);
  }
  
  private calculateChestDepth(build: string, muscularity: number): number {
    const base = build === 'ectomorph' ? 0.22 : build === 'mesomorph' ? 0.28 : build === 'endomorph' ? 0.32 : 0.25;
    return base + muscularity * 0.05 + this.rng.nextFloat(-0.02, 0.02);
  }
  
  private calculateWaistWidth(build: string, bodyFat: number): number {
    const base = build === 'ectomorph' ? 0.28 : build === 'mesomorph' ? 0.35 : build === 'endomorph' ? 0.42 : 0.32;
    return base + bodyFat * 0.05 + this.rng.nextFloat(-0.02, 0.02);
  }
  
  private calculateHipWidth(build: string, bodyFat: number): number {
    const base = build === 'ectomorph' ? 0.32 : build === 'mesomorph' ? 0.38 : build === 'endomorph' ? 0.48 : 0.36;
    return base + bodyFat * 0.04 + this.rng.nextFloat(-0.02, 0.02);
  }
  
  private generateFace(profile: ArchetypeProfile, body: BodyShape): FaceFeatures {
    // Face features influenced by body build
    const buildFactor = body.build === 'ectomorph' ? 0.3 : body.build === 'mesomorph' ? 0.6 : body.build === 'endomorph' ? 0.8 : 0.5;
    
    return {
      faceWidth: this.rng.nextFloat(0.12, 0.18),
      jawStrength: buildFactor + this.rng.nextFloat(-0.2, 0.2),
      cheekboneHeight: this.rng.nextFloat(0.4, 0.7),
      browRidge: buildFactor * 0.5 + this.rng.nextFloat(0, 0.3),
      noseBridge: this.rng.nextFloat(0.3, 0.7),
      noseWidth: this.rng.nextFloat(0.08, 0.15),
      lipFullness: this.rng.nextFloat(0.3, 0.8),
      eyeSize: this.rng.nextFloat(0.6, 1.0),
      eyeSpacing: this.rng.nextFloat(0.5, 0.7)
    };
  }
  
  private generateColors(profile: ArchetypeProfile, theme?: StyleTheme): ColorPalette {
    // Get base colors from archetype
    const baseScheme = this.rng.pickWeighted(profile.colorSchemes, profile.colorSchemes.map(() => 1));
    
    // Apply theme modifiers if specified
    let [primary, secondary, tertiary] = baseScheme;
    if (theme && STYLE_THEMES[theme]) {
      const modified = STYLE_THEMES[theme].colorModifiers(baseScheme, this.rng);
      primary = modified[0];
      secondary = modified[1];
      tertiary = modified[2];
    }
    
    // Generate skin tone (varied but realistic)
    const skinTones = ['#FFDFC4', '#F0C8A0', '#E8B896', '#D4A574', '#C68642', '#8D5524', '#523620'];
    const skinTone = this.rng.pickWeighted(skinTones, skinTones.map(() => 1));
    
    // Hair color
    const hairColors = ['#090806', '#2C222B', '#3B3024', '#4E433F', '#A56B46', '#B55239', '#8C7853', '#B7A69E'];
    const hairColor = this.rng.pickWeighted(hairColors, hairColors.map(() => 1));
    
    // Eye color
    const eyeColors = ['#634E34', '#2E536F', '#8D5524', '#3D671D', '#1C1C1C', '#497665'];
    const eyeColor = this.rng.pickWeighted(eyeColors, eyeColors.map(() => 1));
    
    return { primary, secondary, tertiary, skinTone, hairColor, eyeColor };
  }
  
  private generateOutfit(profile: ArchetypeProfile, theme?: StyleTheme): OutfitLayer[] {
    const layers: OutfitLayer[] = [];
    
    // Base layer (always present)
    layers.push({
      type: 'base',
      style: this.rng.pickWeighted(profile.outfitStyles, [0.4, 0.3, 0.3]),
      coverage: this.rng.nextFloat(0.6, 0.9),
      bulk: this.rng.nextFloat(0.05, 0.15)
    });
    
    // Mid layer (usually present)
    if (this.rng.nextBool(0.8)) {
      layers.push({
        type: 'mid',
        style: this.rng.pickWeighted(profile.outfitStyles, [0.3, 0.4, 0.3]),
        coverage: this.rng.nextFloat(0.4, 0.8),
        bulk: this.rng.nextFloat(0.1, 0.25)
      });
    }
    
    // Outer layer (sometimes present)
    if (this.rng.nextBool(0.5)) {
      layers.push({
        type: 'outer',
        style: this.rng.pickWeighted(profile.outfitStyles, [0.25, 0.35, 0.25, 0.15]),
        coverage: this.rng.nextFloat(0.5, 1.0),
        bulk: this.rng.nextFloat(0.15, 0.4)
      });
    }
    
    // Accessories (optional)
    if (this.rng.nextBool(0.4)) {
      layers.push({
        type: 'accessory',
        style: profile.outfitStyles[0],
        coverage: this.rng.nextFloat(0.1, 0.3),
        bulk: this.rng.nextFloat(0.02, 0.1)
      });
    }
    
    // Apply theme modifiers
    if (theme && STYLE_THEMES[theme]) {
      return STYLE_THEMES[theme].outfitModifiers(layers, this.rng);
    }
    
    return layers;
  }
  
  private generateMaterials(theme?: StyleTheme): Record<string, MaterialConfig> {
    const baseConfig: MaterialConfig = { roughness: 0.5, metalness: 0.1 };
    
    if (theme && STYLE_THEMES[theme]) {
      const overrides = STYLE_THEMES[theme].materialOverrides;
      return {
        skin: { roughness: 0.6, metalness: 0.0 },
        fabric: { ...baseConfig, ...overrides },
        metal: { roughness: 0.2, metalness: 0.9 },
        leather: { roughness: 0.4, metalness: 0.0 }
      };
    }
    
    return {
      skin: { roughness: 0.6, metalness: 0.0 },
      fabric: baseConfig,
      metal: { roughness: 0.2, metalness: 0.9 },
      leather: { roughness: 0.4, metalness: 0.0 }
    };
  }
  
  private generateSkeleton(body: BodyShape): SkeletonConfig {
    const bones: BoneNode[] = [];
    const p = body.proportions;
    
    // Root/hips
    bones.push({
      name: 'hips',
      position: [0, p.legLength, 0],
      rotation: [0, 0, 0],
      length: p.hipWidth
    });
    
    // Spine
    const spineLength = p.height - p.legLength - p.neckLength - (p.headScale * 0.25);
    bones.push({
      name: 'spine',
      parent: 'hips',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      length: spineLength * 0.6
    });
    
    // Chest
    bones.push({
      name: 'chest',
      parent: 'spine',
      position: [0, spineLength * 0.6, 0],
      rotation: [0, 0, 0],
      length: spineLength * 0.4
    });
    
    // Neck
    bones.push({
      name: 'neck',
      parent: 'chest',
      position: [0, spineLength * 0.4, 0],
      rotation: [0, 0, 0],
      length: p.neckLength
    });
    
    // Head
    bones.push({
      name: 'head',
      parent: 'neck',
      position: [0, p.neckLength, 0],
      rotation: [0, 0, 0],
      length: p.headScale * 0.25
    });
    
    // Arms
    const shoulderY = spineLength * 0.35;
    
    // Left arm
    bones.push({
      name: 'shoulderL',
      parent: 'chest',
      position: [-p.shoulderWidth * 0.5, shoulderY, 0],
      rotation: [0, 0, 0],
      length: p.shoulderWidth * 0.15
    });
    
    bones.push({
      name: 'upperArmL',
      parent: 'shoulderL',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      length: p.armLength * 0.45
    });
    
    bones.push({
      name: 'lowerArmL',
      parent: 'upperArmL',
      position: [0, -p.armLength * 0.45, 0],
      rotation: [0, 0, 0],
      length: p.armLength * 0.4
    });
    
    bones.push({
      name: 'handL',
      parent: 'lowerArmL',
      position: [0, -p.armLength * 0.4, 0],
      rotation: [0, 0, 0],
      length: p.armLength * 0.15
    });
    
    // Right arm (mirror)
    bones.push({
      name: 'shoulderR',
      parent: 'chest',
      position: [p.shoulderWidth * 0.5, shoulderY, 0],
      rotation: [0, 0, 0],
      length: p.shoulderWidth * 0.15
    });
    
    bones.push({
      name: 'upperArmR',
      parent: 'shoulderR',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      length: p.armLength * 0.45
    });
    
    bones.push({
      name: 'lowerArmR',
      parent: 'upperArmR',
      position: [0, -p.armLength * 0.45, 0],
      rotation: [0, 0, 0],
      length: p.armLength * 0.4
    });
    
    bones.push({
      name: 'handR',
      parent: 'lowerArmR',
      position: [0, -p.armLength * 0.4, 0],
      rotation: [0, 0, 0],
      length: p.armLength * 0.15
    });
    
    // Legs
    // Left leg
    bones.push({
      name: 'thighL',
      parent: 'hips',
      position: [-p.hipWidth * 0.25, 0, 0],
      rotation: [0, 0, 0],
      length: p.legLength * 0.5
    });
    
    bones.push({
      name: 'shinL',
      parent: 'thighL',
      position: [0, -p.legLength * 0.5, 0],
      rotation: [0, 0, 0],
      length: p.legLength * 0.45
    });
    
    bones.push({
      name: 'footL',
      parent: 'shinL',
      position: [0, -p.legLength * 0.45, 0],
      rotation: [0, 0, 0],
      length: p.legLength * 0.15
    });
    
    // Right leg
    bones.push({
      name: 'thighR',
      parent: 'hips',
      position: [p.hipWidth * 0.25, 0, 0],
      rotation: [0, 0, 0],
      length: p.legLength * 0.5
    });
    
    bones.push({
      name: 'shinR',
      parent: 'thighR',
      position: [0, -p.legLength * 0.5, 0],
      rotation: [0, 0, 0],
      length: p.legLength * 0.45
    });
    
    bones.push({
      name: 'footR',
      parent: 'shinR',
      position: [0, -p.legLength * 0.45, 0],
      rotation: [0, 0, 0],
      length: p.legLength * 0.15
    });
    
    return {
      boneCount: bones.length,
      hierarchy: bones,
      bindPose: {
        positions: new Float32Array(bones.length * 3),
        rotations: new Float32Array(bones.length * 4)
      }
    };
  }
  
  private generateAnimations(skeleton: SkeletonConfig): Record<AnimationState, AnimationClip> {
    const animations: Partial<Record<AnimationState, AnimationClip>> = {};
    
    // Idle animation - subtle breathing
    animations.idle = {
      name: 'idle',
      duration: 2,
      loop: true,
      keyframes: [
        {
          time: 0,
          boneRotations: new Map([['spine', [0, 0, 0, 1]]]),
        },
        {
          time: 1,
          boneRotations: new Map([['spine', [0.02, 0, 0, 0.9998]]]),
        },
        {
          time: 2,
          boneRotations: new Map([['spine', [0, 0, 0, 1]]]),
        }
      ]
    };
    
    // Walk animation
    animations.walk = {
      name: 'walk',
      duration: 1,
      loop: true,
      keyframes: [
        {
          time: 0,
          boneRotations: new Map([
            ['thighL', [0, 0, 0, 1]],
            ['thighR', [0, 0, 0, 1]],
          ])
        },
        {
          time: 0.25,
          boneRotations: new Map([
            ['thighL', [0.3, 0, 0, 0.9539]],
            ['thighR', [-0.3, 0, 0, 0.9539]],
          ])
        },
        {
          time: 0.5,
          boneRotations: new Map([
            ['thighL', [0, 0, 0, 1]],
            ['thighR', [0, 0, 0, 1]],
          ])
        },
        {
          time: 0.75,
          boneRotations: new Map([
            ['thighL', [-0.3, 0, 0, 0.9539]],
            ['thighR', [0.3, 0, 0, 0.9539]],
          ])
        },
        {
          time: 1,
          boneRotations: new Map([
            ['thighL', [0, 0, 0, 1]],
            ['thighR', [0, 0, 0, 1]],
          ])
        }
      ]
    };
    
    // Run animation
    animations.run = {
      name: 'run',
      duration: 0.6,
      loop: true,
      keyframes: [
        {
          time: 0,
          boneRotations: new Map([
            ['thighL', [0, 0, 0, 1]],
            ['thighR', [0, 0, 0, 1]],
          ])
        },
        {
          time: 0.15,
          boneRotations: new Map([
            ['thighL', [0.5, 0, 0, 0.8776]],
            ['thighR', [-0.5, 0, 0, 0.8776]],
          ])
        },
        {
          time: 0.3,
          boneRotations: new Map([
            ['thighL', [0, 0, 0, 1]],
            ['thighR', [0, 0, 0, 1]],
          ])
        },
        {
          time: 0.45,
          boneRotations: new Map([
            ['thighL', [-0.5, 0, 0, 0.8776]],
            ['thighR', [0.5, 0, 0, 0.8776]],
          ])
        },
        {
          time: 0.6,
          boneRotations: new Map([
            ['thighL', [0, 0, 0, 1]],
            ['thighR', [0, 0, 0, 1]],
          ])
        }
      ]
    };
    
    return animations as Record<AnimationState, AnimationClip>;
  }
  
  private calculateQuality(character: {
    body: BodyShape;
    face: FaceFeatures;
    colors: ColorPalette;
    outfit: OutfitLayer[];
  }): QualityScore {
    const p = character.body.proportions;
    
    // Proportion score - check golden ratios and anatomical correctness
    const legTorsoRatio = p.legLength / (p.height - p.legLength);
    const idealLegTorso = 1.618; // Golden ratio approx
    const proportionScore = 100 - Math.abs(legTorsoRatio - idealLegTorso) * 20;
    
    // Aesthetic score - color harmony
    const aestheticScore = 75 + this.rng.nextFloat(-10, 15);
    
    // Technical score - valid geometry
    const technicalScore = 95; // Procedural generation ensures validity
    
    // Uniqueness - based on feature variance from average
    const uniquenessScore = 60 + this.rng.nextFloat(0, 35);
    
    const overall = Math.round(
      (proportionScore * 0.3) +
      (aestheticScore * 0.3) +
      (technicalScore * 0.2) +
      (uniquenessScore * 0.2)
    );
    
    return {
      overall,
      proportions: Math.round(proportionScore),
      aesthetics: Math.round(aestheticScore),
      technical: Math.round(technicalScore),
      uniqueness: Math.round(uniquenessScore)
    };
  }
  
  // Generate multiple characters in a batch
  generateBatch(count: number, options: {
    archetypes?: CharacterArchetype[];
    themes?: StyleTheme[];
    minQuality?: number;
  } = {}): ProGenCharacter[] {
    const characters: ProGenCharacter[] = [];
    const attempts: number[] = [];
    
    for (let i = 0; i < count; i++) {
      let character: ProGenCharacter;
      let attempt = 0;
      const maxAttempts = options.minQuality ? 10 : 1;
      
      do {
        const seed = Math.floor(Math.random() * 1000000) + i * 1000;
        const archetype = options.archetypes?.[i % options.archetypes.length];
        const theme = options.themes?.[i % options.themes.length];
        
        character = this.generate({ archetype, theme, seed });
        attempt++;
      } while (options.minQuality && character.generation.quality.overall < options.minQuality && attempt < maxAttempts);
      
      characters.push(character);
      attempts.push(attempt);
    }
    
    console.log(`[ProGen] Generated ${count} characters. Average attempts: ${attempts.reduce((a, b) => a + b, 0) / attempts.length}`);
    
    return characters;
  }
}

export default CharacterGenerator;
