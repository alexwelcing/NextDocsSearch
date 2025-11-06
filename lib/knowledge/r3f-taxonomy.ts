/**
 * R3F Knowledge Index Taxonomy
 * Comprehensive categorization of React Three Fiber topics
 */

export interface R3FTopic {
  id: string;
  category: string;
  subcategory: string;
  title: string;
  keywords: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  seoValue: number; // 1-10 rating
}

export const R3F_CATEGORIES = {
  CORE: 'Core Concepts',
  HOOKS: 'Hooks & APIs',
  COMPONENTS: 'Components & Primitives',
  PERFORMANCE: 'Performance & Optimization',
  PHYSICS: 'Physics & Simulation',
  SHADERS: 'Shaders & Materials',
  ANIMATION: 'Animation & Motion',
  INTERACTION: 'User Interaction',
  XR: 'XR & Immersive',
  POSTPROCESSING: 'Post-Processing',
  ECOSYSTEM: 'Ecosystem & Libraries',
  PATTERNS: 'Patterns & Architecture',
} as const;

export const R3F_KNOWLEDGE_INDEX: R3FTopic[] = [
  // CORE CONCEPTS
  {
    id: 'r3f-canvas-fundamentals',
    category: R3F_CATEGORIES.CORE,
    subcategory: 'Scene Setup',
    title: 'Canvas Configuration and Scene Initialization',
    keywords: ['Canvas', 'WebGL', 'scene setup', 'renderer', 'camera'],
    difficulty: 'beginner',
    seoValue: 9,
  },
  {
    id: 'r3f-component-tree',
    category: R3F_CATEGORIES.CORE,
    subcategory: 'Component Architecture',
    title: 'React Component Tree vs. Three.js Scene Graph',
    keywords: ['component tree', 'scene graph', 'hierarchy', 'JSX'],
    difficulty: 'beginner',
    seoValue: 8,
  },
  {
    id: 'r3f-declarative-rendering',
    category: R3F_CATEGORIES.CORE,
    subcategory: 'Rendering Model',
    title: 'Declarative 3D Rendering Paradigm',
    keywords: ['declarative', 'rendering', 'reconciler', 'fiber'],
    difficulty: 'intermediate',
    seoValue: 7,
  },

  // HOOKS & APIs
  {
    id: 'r3f-useframe-hook',
    category: R3F_CATEGORIES.HOOKS,
    subcategory: 'Animation Hooks',
    title: 'useFrame: Animation Loop Integration',
    keywords: ['useFrame', 'animation loop', 'delta time', 'render loop'],
    difficulty: 'beginner',
    seoValue: 10,
  },
  {
    id: 'r3f-usethree-hook',
    category: R3F_CATEGORIES.HOOKS,
    subcategory: 'Context Hooks',
    title: 'useThree: Accessing Three.js Context',
    keywords: ['useThree', 'context', 'camera', 'renderer', 'scene'],
    difficulty: 'beginner',
    seoValue: 9,
  },
  {
    id: 'r3f-useloader-hook',
    category: R3F_CATEGORIES.HOOKS,
    subcategory: 'Asset Loading',
    title: 'useLoader: Async Asset Management',
    keywords: ['useLoader', 'assets', 'GLTF', 'textures', 'suspense'],
    difficulty: 'intermediate',
    seoValue: 8,
  },
  {
    id: 'r3f-usegltf-hook',
    category: R3F_CATEGORIES.HOOKS,
    subcategory: 'Asset Loading',
    title: 'useGLTF: 3D Model Loading Patterns',
    keywords: ['useGLTF', '3D models', 'GLTF', 'GLB', 'drei'],
    difficulty: 'beginner',
    seoValue: 9,
  },
  {
    id: 'r3f-usetexture-hook',
    category: R3F_CATEGORIES.HOOKS,
    subcategory: 'Asset Loading',
    title: 'useTexture: Image Loading and Caching',
    keywords: ['useTexture', 'textures', 'images', 'materials'],
    difficulty: 'beginner',
    seoValue: 7,
  },

  // COMPONENTS & PRIMITIVES
  {
    id: 'r3f-primitive-components',
    category: R3F_CATEGORIES.COMPONENTS,
    subcategory: 'Primitives',
    title: 'Primitive Components: Wrapping Three.js Objects',
    keywords: ['primitive', 'mesh', 'geometry', 'material'],
    difficulty: 'beginner',
    seoValue: 8,
  },
  {
    id: 'r3f-drei-helpers',
    category: R3F_CATEGORIES.COMPONENTS,
    subcategory: 'Drei Library',
    title: 'Drei Helper Components Ecosystem',
    keywords: ['drei', 'helpers', 'controls', 'abstractions'],
    difficulty: 'intermediate',
    seoValue: 9,
  },
  {
    id: 'r3f-orbit-controls',
    category: R3F_CATEGORIES.COMPONENTS,
    subcategory: 'Controls',
    title: 'OrbitControls: Camera Control Patterns',
    keywords: ['OrbitControls', 'camera', 'controls', 'interaction'],
    difficulty: 'beginner',
    seoValue: 8,
  },
  {
    id: 'r3f-environment-lighting',
    category: R3F_CATEGORIES.COMPONENTS,
    subcategory: 'Lighting',
    title: 'Environment and HDRI Lighting Systems',
    keywords: ['Environment', 'HDRI', 'lighting', 'IBL', 'PBR'],
    difficulty: 'intermediate',
    seoValue: 7,
  },

  // PERFORMANCE & OPTIMIZATION
  {
    id: 'r3f-instance-rendering',
    category: R3F_CATEGORIES.PERFORMANCE,
    subcategory: 'Instancing',
    title: 'Instanced Rendering for Massive Scale',
    keywords: ['instancing', 'InstancedMesh', 'performance', 'GPU'],
    difficulty: 'advanced',
    seoValue: 9,
  },
  {
    id: 'r3f-frustum-culling',
    category: R3F_CATEGORIES.PERFORMANCE,
    subcategory: 'Culling',
    title: 'Frustum Culling and LOD Strategies',
    keywords: ['frustum culling', 'LOD', 'optimization', 'rendering'],
    difficulty: 'advanced',
    seoValue: 7,
  },
  {
    id: 'r3f-texture-optimization',
    category: R3F_CATEGORIES.PERFORMANCE,
    subcategory: 'Memory',
    title: 'Texture Memory Management and Compression',
    keywords: ['textures', 'memory', 'compression', 'KTX2', 'basis'],
    difficulty: 'intermediate',
    seoValue: 8,
  },
  {
    id: 'r3f-dispose-patterns',
    category: R3F_CATEGORIES.PERFORMANCE,
    subcategory: 'Memory Management',
    title: 'Proper Disposal and Memory Leak Prevention',
    keywords: ['dispose', 'memory leaks', 'cleanup', 'useEffect'],
    difficulty: 'intermediate',
    seoValue: 8,
  },
  {
    id: 'r3f-demand-rendering',
    category: R3F_CATEGORIES.PERFORMANCE,
    subcategory: 'Render Optimization',
    title: 'On-Demand Rendering and Frame Loop Control',
    keywords: ['frameloop', 'demand', 'performance', 'battery'],
    difficulty: 'advanced',
    seoValue: 7,
  },

  // PHYSICS & SIMULATION
  {
    id: 'r3f-cannon-physics',
    category: R3F_CATEGORIES.PHYSICS,
    subcategory: 'Physics Engines',
    title: 'Cannon.js Integration with use-cannon',
    keywords: ['cannon', 'physics', 'collision', 'rigid body'],
    difficulty: 'intermediate',
    seoValue: 8,
  },
  {
    id: 'r3f-rapier-physics',
    category: R3F_CATEGORIES.PHYSICS,
    subcategory: 'Physics Engines',
    title: 'Rapier Physics: Modern Rust-Based Simulation',
    keywords: ['rapier', 'physics', 'WASM', 'performance'],
    difficulty: 'advanced',
    seoValue: 8,
  },
  {
    id: 'r3f-particle-systems',
    category: R3F_CATEGORIES.PHYSICS,
    subcategory: 'Particles',
    title: 'Particle System Architectures and GPU Particles',
    keywords: ['particles', 'GPU', 'instancing', 'shaders'],
    difficulty: 'advanced',
    seoValue: 7,
  },

  // SHADERS & MATERIALS
  {
    id: 'r3f-custom-shaders',
    category: R3F_CATEGORIES.SHADERS,
    subcategory: 'Shader Development',
    title: 'Custom Shader Materials with ShaderMaterial',
    keywords: ['shaders', 'GLSL', 'ShaderMaterial', 'custom materials'],
    difficulty: 'advanced',
    seoValue: 9,
  },
  {
    id: 'r3f-shader-uniforms',
    category: R3F_CATEGORIES.SHADERS,
    subcategory: 'Shader Development',
    title: 'Uniform Management and React State Integration',
    keywords: ['uniforms', 'shaders', 'state', 'reactivity'],
    difficulty: 'advanced',
    seoValue: 7,
  },
  {
    id: 'r3f-shader-chunks',
    category: R3F_CATEGORIES.SHADERS,
    subcategory: 'Material Extension',
    title: 'Material Shader Chunk Modification Patterns',
    keywords: ['shader chunks', 'onBeforeCompile', 'material extension'],
    difficulty: 'expert',
    seoValue: 6,
  },
  {
    id: 'r3f-pbr-materials',
    category: R3F_CATEGORIES.SHADERS,
    subcategory: 'Materials',
    title: 'PBR Material Workflows and Best Practices',
    keywords: ['PBR', 'materials', 'metalness', 'roughness'],
    difficulty: 'intermediate',
    seoValue: 8,
  },

  // ANIMATION & MOTION
  {
    id: 'r3f-spring-animations',
    category: R3F_CATEGORIES.ANIMATION,
    subcategory: 'Physics-Based',
    title: 'Spring Physics with react-spring/three',
    keywords: ['react-spring', 'animations', 'physics', 'transitions'],
    difficulty: 'intermediate',
    seoValue: 8,
  },
  {
    id: 'r3f-animation-mixer',
    category: R3F_CATEGORIES.ANIMATION,
    subcategory: 'Skeletal Animation',
    title: 'AnimationMixer and GLTF Animation Control',
    keywords: ['AnimationMixer', 'GLTF', 'skeletal', 'animations'],
    difficulty: 'intermediate',
    seoValue: 7,
  },
  {
    id: 'r3f-lerp-patterns',
    category: R3F_CATEGORIES.ANIMATION,
    subcategory: 'Interpolation',
    title: 'Linear Interpolation and Smooth Transitions',
    keywords: ['lerp', 'interpolation', 'smooth', 'easing'],
    difficulty: 'beginner',
    seoValue: 7,
  },
  {
    id: 'r3f-camera-animations',
    category: R3F_CATEGORIES.ANIMATION,
    subcategory: 'Camera Movement',
    title: 'Cinematic Camera Animation Techniques',
    keywords: ['camera', 'cinematics', 'animation', 'transitions'],
    difficulty: 'advanced',
    seoValue: 7,
  },

  // USER INTERACTION
  {
    id: 'r3f-pointer-events',
    category: R3F_CATEGORIES.INTERACTION,
    subcategory: 'Events',
    title: 'Pointer Events and Raycasting',
    keywords: ['pointer events', 'onClick', 'raycasting', 'interaction'],
    difficulty: 'beginner',
    seoValue: 9,
  },
  {
    id: 'r3f-drag-controls',
    category: R3F_CATEGORIES.INTERACTION,
    subcategory: 'Manipulation',
    title: 'Drag and Transform Controls Implementation',
    keywords: ['drag', 'transform', 'controls', 'manipulation'],
    difficulty: 'intermediate',
    seoValue: 7,
  },
  {
    id: 'r3f-hover-states',
    category: R3F_CATEGORIES.INTERACTION,
    subcategory: 'Events',
    title: 'Hover States and Visual Feedback Patterns',
    keywords: ['hover', 'onPointerOver', 'feedback', 'UX'],
    difficulty: 'beginner',
    seoValue: 6,
  },

  // XR & IMMERSIVE
  {
    id: 'r3f-vr-setup',
    category: R3F_CATEGORIES.XR,
    subcategory: 'VR',
    title: 'WebXR VR Session Setup with @react-three/xr',
    keywords: ['VR', 'WebXR', 'immersive', 'headset'],
    difficulty: 'advanced',
    seoValue: 9,
  },
  {
    id: 'r3f-ar-experiences',
    category: R3F_CATEGORIES.XR,
    subcategory: 'AR',
    title: 'AR Experiences and World Tracking',
    keywords: ['AR', 'WebXR', 'world tracking', 'augmented reality'],
    difficulty: 'advanced',
    seoValue: 9,
  },
  {
    id: 'r3f-xr-controllers',
    category: R3F_CATEGORIES.XR,
    subcategory: 'Input',
    title: 'XR Controller and Hand Tracking Integration',
    keywords: ['controllers', 'hand tracking', 'input', 'XR'],
    difficulty: 'advanced',
    seoValue: 7,
  },

  // POST-PROCESSING
  {
    id: 'r3f-effectcomposer',
    category: R3F_CATEGORIES.POSTPROCESSING,
    subcategory: 'Setup',
    title: 'EffectComposer and Post-Processing Pipeline',
    keywords: ['EffectComposer', 'post-processing', 'effects', 'postprocessing'],
    difficulty: 'intermediate',
    seoValue: 8,
  },
  {
    id: 'r3f-bloom-effects',
    category: R3F_CATEGORIES.POSTPROCESSING,
    subcategory: 'Effects',
    title: 'Bloom and Glow Effect Implementation',
    keywords: ['bloom', 'glow', 'effects', 'lighting'],
    difficulty: 'intermediate',
    seoValue: 7,
  },
  {
    id: 'r3f-custom-effects',
    category: R3F_CATEGORIES.POSTPROCESSING,
    subcategory: 'Custom Effects',
    title: 'Custom Post-Processing Effect Development',
    keywords: ['custom effects', 'shaders', 'post-processing'],
    difficulty: 'expert',
    seoValue: 6,
  },

  // ECOSYSTEM & LIBRARIES
  {
    id: 'r3f-leva-controls',
    category: R3F_CATEGORIES.ECOSYSTEM,
    subcategory: 'Dev Tools',
    title: 'Leva GUI Controls for Development',
    keywords: ['leva', 'GUI', 'controls', 'debugging'],
    difficulty: 'beginner',
    seoValue: 6,
  },
  {
    id: 'r3f-r3f-perf',
    category: R3F_CATEGORIES.ECOSYSTEM,
    subcategory: 'Dev Tools',
    title: 'r3f-perf: Performance Monitoring',
    keywords: ['performance', 'monitoring', 'profiling', 'FPS'],
    difficulty: 'intermediate',
    seoValue: 7,
  },
  {
    id: 'r3f-pmndrs-ecosystem',
    category: R3F_CATEGORIES.ECOSYSTEM,
    subcategory: 'Libraries',
    title: 'Poimandres Ecosystem Libraries Overview',
    keywords: ['pmndrs', 'ecosystem', 'libraries', 'drei', 'zustand'],
    difficulty: 'intermediate',
    seoValue: 8,
  },

  // PATTERNS & ARCHITECTURE
  {
    id: 'r3f-component-patterns',
    category: R3F_CATEGORIES.PATTERNS,
    subcategory: 'Component Design',
    title: 'Reusable 3D Component Architecture',
    keywords: ['components', 'patterns', 'architecture', 'reusability'],
    difficulty: 'intermediate',
    seoValue: 7,
  },
  {
    id: 'r3f-state-management',
    category: R3F_CATEGORIES.PATTERNS,
    subcategory: 'State',
    title: 'State Management Patterns with Zustand',
    keywords: ['state', 'zustand', 'management', 'stores'],
    difficulty: 'intermediate',
    seoValue: 8,
  },
  {
    id: 'r3f-scene-transitions',
    category: R3F_CATEGORIES.PATTERNS,
    subcategory: 'Scene Management',
    title: 'Multi-Scene Applications and Transitions',
    keywords: ['scenes', 'transitions', 'routing', 'multi-scene'],
    difficulty: 'advanced',
    seoValue: 7,
  },
  {
    id: 'r3f-ssr-nextjs',
    category: R3F_CATEGORIES.PATTERNS,
    subcategory: 'Server Rendering',
    title: 'Server-Side Rendering with Next.js',
    keywords: ['SSR', 'Next.js', 'server rendering', 'dynamic imports'],
    difficulty: 'advanced',
    seoValue: 9,
  },
];

/**
 * Get topics by category
 */
export function getTopicsByCategory(category: string): R3FTopic[] {
  return R3F_KNOWLEDGE_INDEX.filter(topic => topic.category === category);
}

/**
 * Get topics by difficulty
 */
export function getTopicsByDifficulty(difficulty: R3FTopic['difficulty']): R3FTopic[] {
  return R3F_KNOWLEDGE_INDEX.filter(topic => topic.difficulty === difficulty);
}

/**
 * Get high SEO value topics
 */
export function getHighSEOTopics(minValue: number = 8): R3FTopic[] {
  return R3F_KNOWLEDGE_INDEX.filter(topic => topic.seoValue >= minValue).sort(
    (a, b) => b.seoValue - a.seoValue
  );
}

/**
 * Search topics by keyword
 */
export function searchTopics(query: string): R3FTopic[] {
  const lowerQuery = query.toLowerCase();
  return R3F_KNOWLEDGE_INDEX.filter(topic =>
    topic.title.toLowerCase().includes(lowerQuery) ||
    topic.keywords.some(kw => kw.toLowerCase().includes(lowerQuery))
  );
}
