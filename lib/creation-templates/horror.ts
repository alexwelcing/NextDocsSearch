import { CreationTemplate } from '../generators/types';

export const horrorTemplates: CreationTemplate[] = [
  {
    id: 'spectral-orb',
    name: 'Spectral Orb',
    description: 'A ghostly glowing sphere with ethereal particles',
    category: 'horror',
    keywords: ['ghost', 'spectral', 'ethereal', 'spirit', 'orb', 'glow'],
    baseConfig: {
      baseShape: 'sphere',
      scale: [1.5, 1.5, 1.5],
      materials: {
        color: '#00ffaa',
        roughness: 0.1,
        metalness: 0,
        emissive: '#00ffaa',
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.7,
      },
      atmosphere: {
        particles: {
          count: 50,
          color: '#00ffaa',
          size: 0.05,
          opacity: 0.6,
          speed: 0.3,
          spread: 3,
          emissive: true,
        },
        postProcessing: {
          bloom: true,
          vignette: false,
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
          intensity: 0.2,
          loop: true,
        },
      ],
      theme: 'horror',
      horrorLevel: 4,
      complexity: 5,
      tags: ['spectral', 'glowing', 'floating'],
    },
    suggestedPrompts: [
      'A glowing spectral orb floating in darkness',
      'An ethereal green sphere with ghostly particles',
    ],
  },

  {
    id: 'twisted-tree',
    name: 'Twisted Dead Tree',
    description: 'A gnarled, corrupted tree with decaying bark',
    category: 'horror',
    keywords: ['tree', 'twisted', 'dead', 'gnarled', 'decay', 'forest'],
    baseConfig: {
      baseShape: 'organic',
      scale: [1, 2.5, 1],
      materials: {
        color: '#2a1a0f',
        roughness: 0.95,
        metalness: 0,
      },
      modifiers: {
        twisted: true,
        decayed: true,
        distortion: {
          type: 'noise',
          intensity: 0.4,
          frequency: 1.5,
        },
      },
      atmosphere: {
        fog: {
          color: '#1a1a1a',
          near: 2,
          far: 15,
          density: 0.06,
        },
        lighting: [
          {
            type: 'point',
            color: '#ff6600',
            intensity: 2,
            position: [0, 3, 2],
            castShadow: true,
          },
        ],
      },
      theme: 'horror',
      horrorLevel: 7,
      complexity: 7,
      tags: ['organic', 'twisted', 'decay', 'tree'],
    },
    suggestedPrompts: [
      'A twisted dead tree in haunted fog',
      'A gnarled tree with decaying bark',
    ],
  },

  {
    id: 'cursed-cube',
    name: 'Cursed Monolith',
    description: 'A dark metallic cube with pulsing red veins',
    category: 'horror',
    keywords: ['cube', 'monolith', 'cursed', 'metal', 'dark', 'ominous'],
    baseConfig: {
      baseShape: 'box',
      scale: [1.5, 2, 1.5],
      materials: {
        color: '#0a0a0a',
        roughness: 0.2,
        metalness: 0.95,
        emissive: '#330000',
        emissiveIntensity: 1.5,
      },
      modifiers: {
        sharp: true,
        distortion: {
          type: 'noise',
          intensity: 0.1,
          frequency: 2,
        },
      },
      atmosphere: {
        fog: {
          color: '#0d0000',
          near: 1,
          far: 20,
        },
        lighting: [
          {
            type: 'spot',
            color: '#ff0033',
            intensity: 4,
            position: [0, 5, 0],
            castShadow: true,
          },
        ],
        postProcessing: {
          bloom: true,
          vignette: true,
        },
      },
      animations: [
        {
          type: 'pulse',
          speed: 1.5,
          intensity: 0.3,
          loop: true,
        },
        {
          type: 'rotate',
          speed: 0.2,
          intensity: 1,
          loop: true,
        },
      ],
      theme: 'horror',
      horrorLevel: 8,
      complexity: 6,
      tags: ['cursed', 'monolith', 'metallic', 'glowing'],
    },
    suggestedPrompts: [
      'A dark cursed monolith with glowing red cracks',
      'An ominous metallic cube pulsing with dark energy',
    ],
  },

  {
    id: 'blood-sphere',
    name: 'Blood Moon',
    description: 'A deep red sphere with dripping texture',
    category: 'horror',
    keywords: ['blood', 'red', 'moon', 'drip', 'crimson'],
    baseConfig: {
      baseShape: 'sphere',
      scale: [2, 2, 2],
      materials: {
        color: '#8b0000',
        roughness: 0.4,
        metalness: 0.3,
        emissive: '#ff0000',
        emissiveIntensity: 0.8,
      },
      modifiers: {
        distortion: {
          type: 'melt',
          intensity: 0.5,
          frequency: 1,
        },
      },
      atmosphere: {
        fog: {
          color: '#2a0000',
          near: 3,
          far: 25,
        },
        lighting: [
          {
            type: 'point',
            color: '#ff0000',
            intensity: 3,
            position: [0, 0, 0],
          },
        ],
        postProcessing: {
          bloom: true,
          vignette: true,
        },
      },
      animations: [
        {
          type: 'pulse',
          speed: 0.8,
          intensity: 0.2,
          loop: true,
        },
      ],
      theme: 'horror',
      horrorLevel: 9,
      complexity: 5,
      tags: ['blood', 'red', 'glowing', 'dripping'],
    },
    suggestedPrompts: [
      'A blood moon with dripping texture',
      'A crimson sphere glowing ominously',
    ],
  },

  {
    id: 'gothic-arch',
    name: 'Gothic Cathedral Arch',
    description: 'A towering gothic archway shrouded in darkness',
    category: 'horror',
    keywords: ['gothic', 'cathedral', 'arch', 'architecture', 'church'],
    baseConfig: {
      baseShape: 'extrusion',
      scale: [2, 3, 1],
      materials: {
        color: '#1a1a1a',
        roughness: 0.8,
        metalness: 0.1,
      },
      modifiers: {
        decayed: true,
        sharp: true,
      },
      atmosphere: {
        fog: {
          color: '#0a0a0a',
          near: 2,
          far: 20,
          density: 0.08,
        },
        lighting: [
          {
            type: 'spot',
            color: '#6666ff',
            intensity: 2,
            position: [0, 8, 5],
            castShadow: true,
          },
        ],
        postProcessing: {
          vignette: true,
        },
      },
      theme: 'horror',
      horrorLevel: 6,
      complexity: 7,
      tags: ['gothic', 'architecture', 'dark'],
    },
    suggestedPrompts: [
      'A gothic cathedral arch in darkness',
      'A towering stone archway with eerie lighting',
    ],
  },

  {
    id: 'fractal-nightmare',
    name: 'Fractal Nightmare',
    description: 'An impossible recursive structure that defies geometry',
    category: 'horror',
    keywords: ['fractal', 'impossible', 'recursive', 'cosmic', 'eldritch'],
    baseConfig: {
      baseShape: 'fractal',
      scale: [1.5, 1.5, 1.5],
      materials: {
        color: '#660066',
        roughness: 0.3,
        metalness: 0.7,
        emissive: '#ff00ff',
        emissiveIntensity: 1,
      },
      atmosphere: {
        postProcessing: {
          bloom: true,
          chromaticAberration: true,
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
          type: 'rotate',
          speed: 0.3,
          intensity: 1,
          loop: true,
        },
        {
          type: 'phase-shift',
          speed: 2,
          intensity: 1,
          loop: true,
        },
      ],
      theme: 'horror',
      horrorLevel: 10,
      complexity: 9,
      tags: ['fractal', 'cosmic', 'impossible', 'eldritch'],
    },
    suggestedPrompts: [
      'An impossible fractal structure from another dimension',
      'A recursive nightmare that shouldn\'t exist',
    ],
  },

  {
    id: 'shadow-hands',
    name: 'Grasping Shadows',
    description: 'Ethereal shadow hands reaching from darkness',
    category: 'horror',
    keywords: ['shadow', 'hands', 'reach', 'grasp', 'dark'],
    baseConfig: {
      baseShape: 'organic',
      scale: [1, 2, 0.3],
      materials: {
        color: '#000000',
        roughness: 0.9,
        metalness: 0,
        transparent: true,
        opacity: 0.6,
      },
      modifiers: {
        organic: true,
        twisted: true,
      },
      atmosphere: {
        fog: {
          color: '#000000',
          near: 1,
          far: 10,
          density: 0.1,
        },
        particles: {
          count: 100,
          color: '#000000',
          size: 0.03,
          opacity: 0.4,
          speed: 0.2,
          spread: 5,
        },
      },
      animations: [
        {
          type: 'drift',
          speed: 0.3,
          intensity: 0.5,
          loop: true,
        },
      ],
      theme: 'horror',
      horrorLevel: 7,
      complexity: 6,
      tags: ['shadow', 'organic', 'ethereal'],
    },
    suggestedPrompts: [
      'Shadow hands reaching from the darkness',
      'Grasping ethereal shadows',
    ],
  },
];

export default horrorTemplates;
