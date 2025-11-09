import { CreationTemplate } from '../generators/types';

export const editorialTemplates: CreationTemplate[] = [
  {
    id: 'floating-quote',
    name: 'Floating Quote Block',
    description: 'An elegant 3D quote block with soft lighting',
    category: 'editorial',
    keywords: ['quote', 'text', 'block', 'pullquote', 'editorial'],
    baseConfig: {
      baseShape: 'box',
      scale: [2.5, 1.5, 0.3],
      materials: {
        color: '#f5f5f0',
        roughness: 0.7,
        metalness: 0,
      },
      atmosphere: {
        lighting: [
          {
            type: 'spot',
            color: '#ffffff',
            intensity: 2,
            position: [3, 5, 3],
            castShadow: true,
          },
        ],
        postProcessing: {
          vignette: false,
        },
      },
      animations: [
        {
          type: 'float',
          speed: 0.5,
          intensity: 0.2,
          loop: true,
        },
      ],
      theme: 'editorial',
      horrorLevel: 0,
      complexity: 3,
      tags: ['editorial', 'quote', 'floating'],
    },
    suggestedPrompts: [
      'A floating quote block with elegant typography',
      'A 3D pullquote card hovering in space',
    ],
  },

  {
    id: 'data-column',
    name: 'Data Visualization Column',
    description: 'A 3D bar chart column representing data',
    category: 'editorial',
    keywords: ['data', 'chart', 'infographic', 'column', 'visualization'],
    baseConfig: {
      baseShape: 'cylinder',
      scale: [0.5, 2, 0.5],
      materials: {
        color: '#0066cc',
        roughness: 0.3,
        metalness: 0.2,
        emissive: '#0099ff',
        emissiveIntensity: 0.3,
      },
      atmosphere: {
        lighting: [
          {
            type: 'directional',
            color: '#ffffff',
            intensity: 1.5,
            position: [5, 5, 5],
          },
        ],
      },
      theme: 'editorial',
      horrorLevel: 0,
      complexity: 2,
      tags: ['data', 'infographic', 'visualization'],
    },
    suggestedPrompts: [
      'A glowing data column for infographic',
      'A 3D bar chart element in blue',
    ],
  },

  {
    id: 'headline-text',
    name: '3D Headline Text',
    description: 'Bold 3D extruded text for impactful headlines',
    category: 'editorial',
    keywords: ['headline', 'text', 'typography', '3d', 'bold'],
    baseConfig: {
      baseShape: 'text3d',
      scale: [1, 1, 0.3],
      text: 'NEWS',
      font: 'helvetiker_bold',
      materials: {
        color: '#000000',
        roughness: 0.4,
        metalness: 0.1,
      },
      atmosphere: {
        lighting: [
          {
            type: 'spot',
            color: '#ffffff',
            intensity: 3,
            position: [-2, 3, 5],
            castShadow: true,
          },
        ],
      },
      theme: 'editorial',
      horrorLevel: 0,
      complexity: 4,
      tags: ['text', 'headline', 'typography'],
    },
    suggestedPrompts: [
      'Bold 3D headline text',
      'Extruded typography for news article',
    ],
  },

  {
    id: 'paper-stack',
    name: 'Layered Paper Stack',
    description: 'Stacked paper sheets representing content layers',
    category: 'editorial',
    keywords: ['paper', 'stack', 'layers', 'document', 'sheets'],
    baseConfig: {
      baseShape: 'box',
      scale: [2, 0.1, 1.5],
      position: [0, 0, 0],
      materials: {
        color: '#ffffff',
        roughness: 0.8,
        metalness: 0,
      },
      atmosphere: {
        lighting: [
          {
            type: 'directional',
            color: '#ffffee',
            intensity: 1.2,
            position: [5, 8, 3],
            castShadow: true,
          },
        ],
      },
      theme: 'editorial',
      horrorLevel: 0,
      complexity: 3,
      tags: ['paper', 'document', 'layers'],
    },
    suggestedPrompts: [
      'A stack of paper documents',
      'Layered sheets representing content',
    ],
  },

  {
    id: 'highlight-marker',
    name: 'Highlight Marker Stroke',
    description: 'A translucent highlighter mark emphasizing content',
    category: 'editorial',
    keywords: ['highlight', 'marker', 'emphasize', 'yellow', 'accent'],
    baseConfig: {
      baseShape: 'box',
      scale: [3, 0.3, 0.1],
      materials: {
        color: '#ffff00',
        roughness: 0.2,
        metalness: 0,
        transparent: true,
        opacity: 0.5,
      },
      theme: 'editorial',
      horrorLevel: 0,
      complexity: 2,
      tags: ['highlight', 'accent', 'editorial'],
    },
    suggestedPrompts: [
      'A yellow highlighter mark',
      'Translucent highlight accent',
    ],
  },

  {
    id: 'timeline-sphere',
    name: 'Timeline Node',
    description: 'A spherical node on a content timeline',
    category: 'editorial',
    keywords: ['timeline', 'node', 'milestone', 'chronology'],
    baseConfig: {
      baseShape: 'sphere',
      scale: [0.8, 0.8, 0.8],
      materials: {
        color: '#ff6600',
        roughness: 0.3,
        metalness: 0.5,
        emissive: '#ff8800',
        emissiveIntensity: 0.5,
      },
      atmosphere: {
        lighting: [
          {
            type: 'point',
            color: '#ffffff',
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
          type: 'pulse',
          speed: 1.5,
          intensity: 0.2,
          loop: true,
        },
      ],
      theme: 'editorial',
      horrorLevel: 0,
      complexity: 4,
      tags: ['timeline', 'milestone', 'node'],
    },
    suggestedPrompts: [
      'A glowing timeline milestone',
      'A pulsing chronology node',
    ],
  },

  {
    id: 'article-card',
    name: 'Article Preview Card',
    description: 'A clean card showing article preview',
    category: 'editorial',
    keywords: ['article', 'card', 'preview', 'content'],
    baseConfig: {
      baseShape: 'box',
      scale: [2, 2.5, 0.2],
      materials: {
        color: '#ffffff',
        roughness: 0.1,
        metalness: 0,
        clearcoat: 1,
      },
      modifiers: {
        smooth: true,
      },
      atmosphere: {
        lighting: [
          {
            type: 'directional',
            color: '#ffffff',
            intensity: 1.5,
            position: [3, 5, 4],
            castShadow: true,
          },
        ],
      },
      animations: [
        {
          type: 'float',
          speed: 0.4,
          intensity: 0.15,
          loop: true,
        },
      ],
      theme: 'editorial',
      horrorLevel: 0,
      complexity: 3,
      tags: ['article', 'card', 'preview'],
    },
    suggestedPrompts: [
      'A floating article preview card',
      'A glossy content card',
    ],
  },
];

export default editorialTemplates;
