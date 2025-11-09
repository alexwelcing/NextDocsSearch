import { CreationTemplate } from '../generators/types';

export const hybridTemplates: CreationTemplate[] = [
  {
    id: 'bleeding-text',
    name: 'Bleeding Typography',
    description: 'Text that appears to bleed ink into darkness',
    category: 'hybrid',
    keywords: ['text', 'blood', 'ink', 'bleed', 'typography', 'horror'],
    baseConfig: {
      baseShape: 'text3d',
      scale: [1.2, 1.2, 0.4],
      text: 'HORROR',
      font: 'helvetiker_bold',
      materials: {
        color: '#8b0000',
        roughness: 0.5,
        metalness: 0.2,
        emissive: '#ff0000',
        emissiveIntensity: 0.8,
      },
      modifiers: {
        distortion: {
          type: 'melt',
          intensity: 0.4,
          frequency: 1,
        },
      },
      atmosphere: {
        fog: {
          color: '#0a0000',
          near: 2,
          far: 15,
        },
        particles: {
          count: 80,
          color: '#8b0000',
          size: 0.04,
          opacity: 0.7,
          speed: 0.2,
          spread: 4,
        },
        lighting: [
          {
            type: 'spot',
            color: '#ff0000',
            intensity: 2.5,
            position: [0, 5, 3],
            castShadow: true,
          },
        ],
        postProcessing: {
          bloom: true,
          vignette: true,
        },
      },
      theme: 'hybrid',
      horrorLevel: 8,
      complexity: 7,
      tags: ['text', 'horror', 'bleeding', 'typography'],
    },
    suggestedPrompts: [
      'Typography that bleeds ink',
      'Horror text dripping with blood',
      'Melting letters in crimson',
    ],
  },

  {
    id: 'haunted-newspaper',
    name: 'Haunted Newspaper',
    description: 'An old newspaper page with spectral text',
    category: 'hybrid',
    keywords: ['newspaper', 'haunted', 'paper', 'old', 'spectral'],
    baseConfig: {
      baseShape: 'box',
      scale: [2, 2.8, 0.1],
      materials: {
        color: '#d4c4a8',
        roughness: 0.9,
        metalness: 0,
      },
      modifiers: {
        decayed: true,
        distortion: {
          type: 'noise',
          intensity: 0.2,
          frequency: 3,
        },
      },
      atmosphere: {
        fog: {
          color: '#3a3a3a',
          near: 3,
          far: 20,
        },
        particles: {
          count: 60,
          color: '#00ff88',
          size: 0.03,
          opacity: 0.4,
          speed: 0.15,
          spread: 3,
          emissive: true,
        },
        lighting: [
          {
            type: 'spot',
            color: '#88ff88',
            intensity: 1.5,
            position: [0, 3, 2],
          },
        ],
      },
      animations: [
        {
          type: 'float',
          speed: 0.3,
          intensity: 0.25,
          loop: true,
        },
        {
          type: 'flicker',
          speed: 3,
          intensity: 0.3,
          loop: true,
        },
      ],
      theme: 'hybrid',
      horrorLevel: 5,
      complexity: 6,
      tags: ['newspaper', 'haunted', 'spectral', 'editorial'],
    },
    suggestedPrompts: [
      'A haunted newspaper from the past',
      'An old article page with ghostly text',
    ],
  },

  {
    id: 'data-corruption',
    name: 'Corrupted Data Visualization',
    description: 'An infographic twisted by digital corruption',
    category: 'hybrid',
    keywords: ['data', 'corruption', 'glitch', 'infographic', 'digital'],
    baseConfig: {
      baseShape: 'cylinder',
      scale: [0.6, 2.5, 0.6],
      materials: {
        color: '#00ffff',
        roughness: 0.2,
        metalness: 0.8,
        emissive: '#ff00ff',
        emissiveIntensity: 1.2,
      },
      modifiers: {
        fractured: true,
        distortion: {
          type: 'glitch',
          intensity: 0.6,
          frequency: 2,
          animate: true,
        },
      },
      atmosphere: {
        postProcessing: {
          bloom: true,
          chromaticAberration: true,
          glitch: true,
        },
        lighting: [
          {
            type: 'point',
            color: '#ff00ff',
            intensity: 3,
            position: [0, 0, 0],
          },
        ],
      },
      animations: [
        {
          type: 'glitch',
          speed: 5,
          intensity: 0.8,
          loop: true,
        },
        {
          type: 'rotate',
          speed: 1,
          intensity: 1,
          loop: true,
        },
      ],
      theme: 'hybrid',
      horrorLevel: 7,
      complexity: 8,
      tags: ['data', 'glitch', 'corruption', 'digital'],
    },
    suggestedPrompts: [
      'A glitching data visualization',
      'Corrupted infographic column',
      'Digital horror chart',
    ],
  },

  {
    id: 'shadow-quote',
    name: 'Shadow-Cast Quote',
    description: 'A quote block that casts ominous shadows',
    category: 'hybrid',
    keywords: ['quote', 'shadow', 'dark', 'ominous', 'text'],
    baseConfig: {
      baseShape: 'box',
      scale: [2.8, 1.8, 0.4],
      materials: {
        color: '#1a1a1a',
        roughness: 0.6,
        metalness: 0.3,
      },
      atmosphere: {
        fog: {
          color: '#0a0a0a',
          near: 2,
          far: 18,
        },
        lighting: [
          {
            type: 'spot',
            color: '#ffffff',
            intensity: 5,
            position: [-4, 6, 4],
            castShadow: true,
          },
        ],
        postProcessing: {
          vignette: true,
        },
      },
      animations: [
        {
          type: 'float',
          speed: 0.4,
          intensity: 0.2,
          loop: true,
        },
      ],
      theme: 'hybrid',
      horrorLevel: 4,
      complexity: 5,
      tags: ['quote', 'shadow', 'dark', 'atmospheric'],
    },
    suggestedPrompts: [
      'A dark quote block with dramatic shadows',
      'An ominous pullquote in darkness',
    ],
  },

  {
    id: 'fractal-infographic',
    name: 'Impossible Data Structure',
    description: 'An infographic that defies Euclidean geometry',
    category: 'hybrid',
    keywords: ['fractal', 'data', 'impossible', 'infographic', 'complex'],
    baseConfig: {
      baseShape: 'fractal',
      scale: [1.3, 1.3, 1.3],
      materials: {
        color: '#3366cc',
        roughness: 0.4,
        metalness: 0.6,
        emissive: '#6699ff',
        emissiveIntensity: 0.8,
      },
      atmosphere: {
        fog: {
          color: '#0a0a1a',
          near: 3,
          far: 25,
        },
        lighting: [
          {
            type: 'point',
            color: '#6699ff',
            intensity: 2.5,
            position: [0, 0, 0],
          },
        ],
        postProcessing: {
          bloom: true,
          chromaticAberration: false,
        },
      },
      animations: [
        {
          type: 'rotate',
          speed: 0.25,
          intensity: 1,
          loop: true,
        },
      ],
      theme: 'hybrid',
      horrorLevel: 6,
      complexity: 9,
      tags: ['fractal', 'data', 'complex', 'impossible'],
    },
    suggestedPrompts: [
      'An impossible fractal data structure',
      'A recursive infographic from another dimension',
    ],
  },

  {
    id: 'decaying-headline',
    name: 'Eroding Headline',
    description: 'A headline slowly crumbling into dust',
    category: 'hybrid',
    keywords: ['headline', 'decay', 'erode', 'crumble', 'text'],
    baseConfig: {
      baseShape: 'text3d',
      scale: [1.5, 1.5, 0.5],
      text: 'DECAY',
      font: 'helvetiker_bold',
      materials: {
        color: '#4a4a4a',
        roughness: 0.95,
        metalness: 0,
      },
      modifiers: {
        decayed: true,
        fractured: true,
        distortion: {
          type: 'erosion',
          intensity: 0.5,
          frequency: 2,
        },
      },
      atmosphere: {
        particles: {
          count: 150,
          color: '#888888',
          size: 0.02,
          opacity: 0.5,
          speed: 0.3,
          spread: 5,
        },
        fog: {
          color: '#2a2a2a',
          near: 2,
          far: 15,
        },
        lighting: [
          {
            type: 'directional',
            color: '#aaaaaa',
            intensity: 1.5,
            position: [5, 5, 5],
          },
        ],
      },
      theme: 'hybrid',
      horrorLevel: 6,
      complexity: 7,
      tags: ['text', 'decay', 'erosion', 'particles'],
    },
    suggestedPrompts: [
      'A headline crumbling into dust',
      'Eroding typography with particles',
    ],
  },

  {
    id: 'ethereal-timeline',
    name: 'Spectral Timeline',
    description: 'A ghostly timeline with floating milestones',
    category: 'hybrid',
    keywords: ['timeline', 'spectral', 'ghost', 'ethereal', 'chronology'],
    baseConfig: {
      baseShape: 'sphere',
      scale: [0.7, 0.7, 0.7],
      materials: {
        color: '#88ffff',
        roughness: 0.1,
        metalness: 0,
        emissive: '#88ffff',
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.6,
      },
      atmosphere: {
        particles: {
          count: 100,
          color: '#88ffff',
          size: 0.04,
          opacity: 0.5,
          speed: 0.25,
          spread: 4,
          emissive: true,
        },
        lighting: [
          {
            type: 'point',
            color: '#88ffff',
            intensity: 2,
            position: [0, 0, 0],
          },
        ],
        postProcessing: {
          bloom: true,
        },
      },
      animations: [
        {
          type: 'float',
          speed: 0.5,
          intensity: 0.3,
          loop: true,
        },
        {
          type: 'pulse',
          speed: 2,
          intensity: 0.3,
          loop: true,
        },
      ],
      theme: 'hybrid',
      horrorLevel: 3,
      complexity: 6,
      tags: ['timeline', 'spectral', 'floating', 'node'],
    },
    suggestedPrompts: [
      'A ghostly timeline milestone',
      'An ethereal chronology node',
    ],
  },
];

export default hybridTemplates;
