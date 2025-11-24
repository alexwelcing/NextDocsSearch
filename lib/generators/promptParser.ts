import {
  ParsedPrompt,
  BaseShape,
  ThemeCategory,
  MaterialConfig,
  GeometryModifiers,
  AtmosphereConfig,
  AnimationConfig,
  AnimationType,
  HORROR_LEVELS,
  COMPLEXITY_LEVELS,
} from './types';

// Keyword mappings for intelligent parsing
const SHAPE_KEYWORDS: Record<string, BaseShape> = {
  box: 'box',
  cube: 'box',
  square: 'box',
  sphere: 'sphere',
  ball: 'sphere',
  orb: 'sphere',
  globe: 'sphere',
  cylinder: 'cylinder',
  tube: 'cylinder',
  pillar: 'cylinder',
  column: 'cylinder',
  torus: 'torus',
  ring: 'torus',
  donut: 'torus',
  cone: 'cone',
  pyramid: 'cone',
  spike: 'cone',
  tree: 'organic',
  forest: 'organic',
  branch: 'organic',
  root: 'organic',
  tentacle: 'organic',
  vine: 'organic',
  cathedral: 'extrusion',
  building: 'extrusion',
  architecture: 'extrusion',
  structure: 'extrusion',
  letter: 'text3d',
  text: 'text3d',
  word: 'text3d',
  typewriter: 'text3d',
  typography: 'text3d',
  twisted: 'twisted',
  spiral: 'twisted',
  helix: 'twisted',
  fractal: 'fractal',
  recursive: 'fractal',
};

const HORROR_KEYWORDS: Record<string, number> = {
  // Subtle (1-3)
  eerie: 2,
  mysterious: 2,
  strange: 2,
  uncanny: 3,
  odd: 2,

  // Atmospheric (4-5)
  haunted: 4,
  ghostly: 4,
  spectral: 4,
  shadowy: 4,
  foggy: 3,
  misty: 3,
  dark: 4,
  gloomy: 4,

  // Unsettling (6-7)
  disturbing: 6,
  unsettling: 6,
  creepy: 6,
  sinister: 6,
  ominous: 6,
  dread: 7,
  nightmare: 7,
  cursed: 7,

  // Intense (8-9)
  terrifying: 8,
  horrifying: 8,
  macabre: 8,
  grotesque: 8,
  twisted: 8,
  warped: 8,
  corrupted: 8,
  diseased: 8,

  // Visceral (10)
  gore: 10,
  visceral: 10,
  flesh: 9,
  bone: 8,
  blood: 9,
  decay: 8,
  rot: 9,
  decompose: 9,
};

const COLOR_KEYWORDS: Record<string, string> = {
  red: '#ff0000',
  crimson: '#dc143c',
  blood: '#8b0000',
  scarlet: '#ff2400',
  blue: '#0000ff',
  azure: '#007fff',
  navy: '#000080',
  cyan: '#00ffff',
  green: '#00ff00',
  emerald: '#50c878',
  forest: '#228b22',
  lime: '#00ff00',
  yellow: '#ffff00',
  gold: '#ffd700',
  amber: '#ffbf00',
  purple: '#800080',
  violet: '#8f00ff',
  magenta: '#ff00ff',
  pink: '#ffc0cb',
  orange: '#ffa500',
  white: '#ffffff',
  black: '#000000',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  brown: '#a52a2a',
};

const MODIFIER_KEYWORDS: Record<string, Partial<GeometryModifiers>> = {
  twisted: { twisted: true },
  spiral: { twisted: true },
  decayed: { decayed: true },
  rotting: { decayed: true },
  eroded: { decayed: true },
  weathered: { decayed: true },
  fractured: { fractured: true },
  shattered: { fractured: true },
  broken: { fractured: true },
  organic: { organic: true },
  natural: { organic: true },
  living: { organic: true },
  hollow: { hollow: true },
  empty: { hollow: true },
  sharp: { sharp: true },
  jagged: { sharp: true },
  smooth: { smooth: true },
  polished: { smooth: true },
};

const ANIMATION_KEYWORDS: Record<string, AnimationType> = {
  rotating: 'rotate',
  spinning: 'rotate',
  floating: 'float',
  hovering: 'float',
  pulsing: 'pulse',
  beating: 'pulse',
  glitching: 'glitch',
  flickering: 'flicker',
  breathing: 'breathe',
  drifting: 'drift',
  phasing: 'phase-shift',
};

const ATMOSPHERE_KEYWORDS = {
  fog: { color: '#888888', near: 1, far: 20, density: 0.05 },
  mist: { color: '#cccccc', near: 5, far: 30, density: 0.03 },
  haze: { color: '#aaaaaa', near: 3, far: 25, density: 0.04 },
  smoke: { color: '#333333', near: 2, far: 15, density: 0.07 },
};

/**
 * Parse a user prompt into a structured configuration
 */
export function parsePrompt(prompt: string): ParsedPrompt {
  const lowerPrompt = prompt.toLowerCase();
  const words = lowerPrompt.split(/\s+/);

  // Detect base shape
  const baseShape = detectShape(lowerPrompt, words);

  // Detect theme and horror level
  const { theme, horrorLevel } = detectTheme(lowerPrompt, words);

  // Detect colors
  const colors = detectColors(lowerPrompt, words);

  // Detect modifiers
  const modifiers = detectModifiers(lowerPrompt, words);

  // Detect materials
  const materials = buildMaterialConfig(colors, modifiers, horrorLevel, lowerPrompt);

  // Detect animations
  const animations = detectAnimations(lowerPrompt, words);

  // Detect atmosphere
  const atmosphere = detectAtmosphere(lowerPrompt, words, horrorLevel);

  // Detect scale hints
  const scale = detectScale(lowerPrompt, words);

  // Extract text content for text3d
  const text = baseShape === 'text3d' ? extractTextContent(prompt) : undefined;

  // Calculate complexity
  const complexity = calculateComplexity(modifiers, animations, atmosphere);

  // Generate tags
  const tags = generateTags(prompt, theme, baseShape, modifiers);

  return {
    baseShape,
    scale,
    materials,
    modifiers,
    atmosphere,
    animations: animations.length > 0 ? animations : undefined,
    theme,
    horrorLevel,
    complexity,
    tags,
    text,
  };
}

function detectShape(prompt: string, words: string[]): BaseShape {
  for (const word of words) {
    if (SHAPE_KEYWORDS[word]) {
      return SHAPE_KEYWORDS[word];
    }
  }

  // Contextual detection
  if (prompt.includes('letter') || prompt.includes('word') || prompt.includes('text')) {
    return 'text3d';
  }
  if (prompt.includes('tree') || prompt.includes('vine') || prompt.includes('tentacle')) {
    return 'organic';
  }
  if (prompt.includes('building') || prompt.includes('cathedral') || prompt.includes('tower')) {
    return 'extrusion';
  }

  // Default to sphere for abstract concepts
  return 'sphere';
}

function detectTheme(prompt: string, words: string[]): { theme: ThemeCategory; horrorLevel: number } {
  let horrorLevel = 0;
  let horrorWordCount = 0;

  // Calculate average horror level from keywords
  for (const word of words) {
    if (HORROR_KEYWORDS[word] !== undefined) {
      horrorLevel += HORROR_KEYWORDS[word];
      horrorWordCount++;
    }
  }

  if (horrorWordCount > 0) {
    horrorLevel = Math.round(horrorLevel / horrorWordCount);
  }

  // Boost horror level based on context
  if (prompt.includes('nightmare') || prompt.includes('terror')) horrorLevel += 2;
  if (prompt.includes('blood') || prompt.includes('gore')) horrorLevel += 3;
  if (prompt.includes('death') || prompt.includes('corpse')) horrorLevel += 2;

  horrorLevel = Math.min(10, Math.max(0, horrorLevel));

  // Determine theme
  const hasEditorial = /article|newspaper|text|typography|editorial|quote|headline/.test(prompt);
  const hasCinematic = /cinematic|dramatic|scene|film|movie/.test(prompt);
  const hasHorror = horrorLevel > 3;

  let theme: ThemeCategory;
  if (hasEditorial && hasHorror) {
    theme = 'hybrid';
  } else if (hasEditorial) {
    theme = 'editorial';
  } else if (hasCinematic) {
    theme = 'cinematic';
  } else if (hasHorror) {
    theme = 'horror';
  } else {
    theme = 'abstract';
  }

  return { theme, horrorLevel };
}

function detectColors(prompt: string, words: string[]): string[] {
  const colors: string[] = [];

  for (const word of words) {
    if (COLOR_KEYWORDS[word]) {
      colors.push(COLOR_KEYWORDS[word]);
    }
  }

  // Detect compound colors
  if (prompt.includes('dark red') || prompt.includes('deep red')) {
    colors.push('#8b0000');
  }
  if (prompt.includes('pale blue') || prompt.includes('light blue')) {
    colors.push('#add8e6');
  }

  return colors;
}

function detectModifiers(prompt: string, words: string[]): GeometryModifiers {
  const modifiers: GeometryModifiers = {};

  for (const word of words) {
    if (MODIFIER_KEYWORDS[word]) {
      Object.assign(modifiers, MODIFIER_KEYWORDS[word]);
    }
  }

  // Add distortion if certain keywords present
  if (modifiers.twisted || modifiers.decayed || modifiers.fractured) {
    modifiers.distortion = {
      type: modifiers.twisted ? 'twist' : modifiers.decayed ? 'decay' : 'shatter',
      intensity: 0.5,
      frequency: 1,
      seed: Math.random(),
    };
  }

  return modifiers;
}

function buildMaterialConfig(
  colors: string[],
  modifiers: GeometryModifiers,
  horrorLevel: number,
  prompt: string
): MaterialConfig {
  const baseColor = colors[0] || '#ffffff';

  // Detect material properties from keywords
  const isGlowing = /glow|luminous|emit|radiant|shining/.test(prompt);
  const isTransparent = /transparent|translucent|ghost|spectral|ethereal|see-through/.test(prompt);
  const isMetal = /metal|metallic|chrome|steel|iron/.test(prompt);
  const isGlass = /glass|crystal|ice/.test(prompt);
  const isRough = /rough|coarse|textured|rusty/.test(prompt);

  const material: MaterialConfig = {
    color: baseColor,
    roughness: isRough ? 0.9 : isMetal ? 0.2 : isGlass ? 0.1 : 0.5,
    metalness: isMetal ? 0.9 : 0.1,
  };

  if (isGlowing) {
    material.emissive = colors[1] || baseColor;
    material.emissiveIntensity = horrorLevel > 5 ? 2 : 1;
  }

  if (isTransparent) {
    material.transparent = true;
    material.opacity = 0.7;
  }

  if (isGlass) {
    material.transparent = true;
    material.opacity = 0.3;
    material.transmission = 1;
    material.ior = 1.5;
    material.thickness = 0.5;
  }

  return material;
}

function detectAnimations(prompt: string, words: string[]): AnimationConfig[] {
  const animations: AnimationConfig[] = [];

  for (const word of words) {
    if (ANIMATION_KEYWORDS[word]) {
      animations.push({
        type: ANIMATION_KEYWORDS[word],
        speed: 1,
        intensity: 1,
        loop: true,
      });
    }
  }

  // Add default float animation for certain shapes
  if (prompt.includes('float') || prompt.includes('hover') || prompt.includes('levitate')) {
    if (!animations.some((a) => a.type === 'float')) {
      animations.push({
        type: 'float',
        speed: 0.5,
        intensity: 0.3,
        loop: true,
      });
    }
  }

  return animations;
}

function detectAtmosphere(prompt: string, words: string[], horrorLevel: number): AtmosphereConfig {
  const atmosphere: AtmosphereConfig = {};

  // Detect fog
  for (const [keyword, fogConfig] of Object.entries(ATMOSPHERE_KEYWORDS)) {
    if (prompt.includes(keyword)) {
      atmosphere.fog = { ...fogConfig };
      break;
    }
  }

  // Adjust fog based on horror level
  if (atmosphere.fog && horrorLevel > 5) {
    atmosphere.fog.color = '#111111';
    atmosphere.fog.density = 0.08;
  }

  // Detect lighting needs
  const needsDramaticLighting = horrorLevel > 4 || /dramatic|cinematic|spotlight/.test(prompt);
  if (needsDramaticLighting) {
    atmosphere.lighting = [
      {
        type: 'spot',
        color: horrorLevel > 6 ? '#ff0033' : '#ffffff',
        intensity: 3,
        position: [5, 10, 5],
        castShadow: true,
      },
    ];
  }

  // Detect particles
  if (/particle|dust|sparkle|firefly|ember/.test(prompt)) {
    atmosphere.particles = {
      count: 100,
      color: '#ffffff',
      size: 0.05,
      opacity: 0.6,
      speed: 0.5,
      spread: 10,
    };
  }

  // Post-processing effects
  if (horrorLevel > 5 || /glow|bloom/.test(prompt)) {
    atmosphere.postProcessing = {
      bloom: true,
      vignette: horrorLevel > 6,
      chromaticAberration: horrorLevel > 7,
      glitch: prompt.includes('glitch'),
    };
  }

  return atmosphere;
}

function detectScale(prompt: string, words: string[]): [number, number, number] {
  const sizeWords = ['tiny', 'small', 'large', 'huge', 'massive', 'giant', 'enormous'];

  const size = words.find((w) => sizeWords.includes(w));

  switch (size) {
    case 'tiny':
      return [0.5, 0.5, 0.5];
    case 'small':
      return [1, 1, 1];
    case 'large':
      return [2, 2, 2];
    case 'huge':
    case 'massive':
      return [3, 3, 3];
    case 'giant':
    case 'enormous':
      return [5, 5, 5];
    default:
      return [1.5, 1.5, 1.5];
  }
}

function extractTextContent(prompt: string): string {
  // Extract quoted text
  const quoted = prompt.match(/"([^"]+)"|'([^']+)'/);
  if (quoted) {
    return quoted[1] || quoted[2];
  }

  // Extract text after "letter" or "word"
  const letterMatch = prompt.match(/letter\s+["']?(\w)["']?/i);
  if (letterMatch) {
    return letterMatch[1];
  }

  const wordMatch = prompt.match(/word\s+["']?(\w+)["']?/i);
  if (wordMatch) {
    return wordMatch[1];
  }

  // Default
  return 'A';
}

function calculateComplexity(
  modifiers: GeometryModifiers,
  animations: AnimationConfig[] | undefined,
  atmosphere: AtmosphereConfig
): number {
  let complexity = 2; // Base

  // Add complexity for modifiers
  if (modifiers.twisted) complexity += 1;
  if (modifiers.decayed) complexity += 1;
  if (modifiers.fractured) complexity += 2;
  if (modifiers.organic) complexity += 2;
  if (modifiers.distortion) complexity += 2;

  // Add complexity for animations
  if (animations && animations.length > 0) {
    complexity += animations.length;
  }

  // Add complexity for atmosphere
  if (atmosphere.fog) complexity += 1;
  if (atmosphere.particles) complexity += 2;
  if (atmosphere.lighting && atmosphere.lighting.length > 0) complexity += 1;
  if (atmosphere.postProcessing) {
    complexity += Object.values(atmosphere.postProcessing).filter(Boolean).length;
  }

  return Math.min(10, complexity);
}

function generateTags(
  prompt: string,
  theme: ThemeCategory,
  shape: BaseShape,
  modifiers: GeometryModifiers
): string[] {
  const tags: string[] = [theme, shape];

  // Add modifier tags
  if (modifiers.twisted) tags.push('twisted');
  if (modifiers.decayed) tags.push('decay');
  if (modifiers.fractured) tags.push('fractured');
  if (modifiers.organic) tags.push('organic');

  // Add contextual tags
  if (prompt.includes('dark')) tags.push('dark');
  if (prompt.includes('light')) tags.push('light');
  if (prompt.includes('glow')) tags.push('glowing');
  if (prompt.includes('float')) tags.push('floating');

  return Array.from(new Set(tags));
}

/**
 * Enhance a simple prompt with more details
 */
export function enhancePrompt(simplePrompt: string): string {
  const enhancements = [
    ' with dramatic lighting',
    ' surrounded by ethereal fog',
    ' with a haunting glow',
    ' floating in darkness',
    ' with spectral particles',
  ];

  const random = enhancements[Math.floor(Math.random() * enhancements.length)];
  return simplePrompt + random;
}
