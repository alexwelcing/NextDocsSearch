/**
 * Film Bridge Types
 * Core type definitions for the ComfyUI-NextDocsSearch integration
 */

// ═══════════════════════════════════════════════════════════════
// ARTIFACT SYSTEM
// ═══════════════════════════════════════════════════════════════

export interface ArtifactRegistration {
  id: string;
  slug: string;
  name: string;
  description: string;
  storySignature: {
    series: string;
    episode: number;
    narrativeWeight: number;  // 0.0-1.0
  };
  physical: {
    category: 'weapon' | 'jewelry' | 'tool' | 'document' | 'technology' | 'natural' | 'container';
    materials: string[];
    dimensions: {
      length: number;  // cm
      width: number;
      height: number;
      weight?: number; // grams
    };
    colorPalette: string[];  // Hex colors
    distinguishingFeatures: string[];
    condition: 'pristine' | 'worn' | 'damaged' | 'ancient';
  };
  generation: {
    canonicalSeed: number;
    stylePrompt: string;
    negativePrompt: string;
    priorityViews: Array<'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'held' | 'detail'>;
    detailLevel: 'low' | 'medium' | 'high' | 'hero';  // Hero = extreme closeup detail
  };
  assets: {
    canonicalImages: Record<string, string>;  // angle -> path
    detailMaps?: {
      normal?: string;
      roughness?: string;
      metallic?: string;
      ao?: string;
    };
    threeD?: {
      glb?: string;
      usdz?: string;
      fbx?: string;
      obj?: string;
      sourceBlend?: string;
    };
    videoReferences: string[];
  };
  appearances: ArtifactAppearance[];
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactAppearance {
  sceneId: string;
  shotId: string;
  shotType: 'extreme_closeup' | 'closeup' | 'medium' | 'wide' | 'background';
  injectionMethod: 'ipadapter' | 'controlnet' | 'depth' | 'composite' | 'seamless';
  quality: number;  // 0-100
  driftScore?: number;  // 0-1, lower is better
  verified: boolean;
}

// ═══════════════════════════════════════════════════════════════
// COMFYUI BRIDGE
// ═══════════════════════════════════════════════════════════════

export interface ComfyUIConfig {
  baseUrl: string;  // e.g., "http://127.0.0.1:8188"
  apiPath: string;  // e.g., "/api"
  wsPath: string;   // e.g., "/ws"
  timeout: number;  // ms
}

export interface ComfyWorkflow {
  [nodeId: string]: {
    inputs: Record<string, unknown>;
    class_type: string;
    _meta?: {
      title?: string;
    };
  };
}

export interface QueuedPromptResponse {
  prompt_id: string;
  number: number;
  node_errors: Record<string, unknown>;
}

export interface ExecutionStatus {
  status: 'pending' | 'running' | 'completed' | 'error';
  prompt_id: string;
  progress?: number;
  outputs?: Record<string, ComfyOutput>;
  error?: string;
}

export interface ComfyOutput {
  images?: Array<{
    filename: string;
    subfolder: string;
    type: 'output' | 'temp';
  }>;
  gifs?: Array<{
    filename: string;
    subfolder: string;
    type: 'output' | 'temp';
  }>;
  audio?: Array<{
    filename: string;
    subfolder: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// VIDEO GENERATION TYPES
// ═══════════════════════════════════════════════════════════════

export interface VideoGenerationJob {
  id: string;
  sceneId: string;
  shotId: string;
  type: 'character' | 'environment' | 'action' | 'transition';
  
  // Input specification
  input: {
    type: 'text' | 'image' | 'video';
    prompt?: string;
    imagePath?: string;
    videoPath?: string;
  };
  
  // Artifact injection
  artifacts?: Array<{
    artifactId: string;
    importance: 'hero' | 'supporting' | 'background';
    injectionMethod: 'ipadapter' | 'controlnet' | 'depth' | 'composite';
    position?: 'center' | 'left' | 'right' | 'custom';
  }>;
  
  // Technical params
  params: {
    model: 'wan21-i2v-480p' | 'wan21-i2v-720p' | 'wan22-14b';
    width: number;
    height: number;
    fps: number;
    duration: number;  // seconds
    steps: number;
    cfg: number;
    seed?: number;
  };
  
  // Output
  output: {
    path: string;
    format: 'mp4' | 'webm';
  };
  
  // ACC integration
  accTaskId?: string;
  status: 'queued' | 'generating' | 'post-processing' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// ═══════════════════════════════════════════════════════════════
// 3D GENERATION TYPES
// ═══════════════════════════════════════════════════════════════

export interface MeshGenerationJob {
  id: string;
  artifactId: string;
  source: 'canonical_images' | 'video_extraction' | 'text_description';
  
  config: {
    method: 'hunyuan3d' | 'instantmesh' | 'manual';
    targetPolyCount: number;
    textureResolution: 1024 | 2048 | 4096;
    generatePBR: boolean;
    lodVariants: boolean;
  };
  
  outputs: {
    glb?: string;
    usdz?: string;
    fbx?: string;
    obj?: string;
    textures?: {
      albedo: string;
      normal?: string;
      roughness?: string;
      metallic?: string;
      ao?: string;
    };
  };
  
  status: 'queued' | 'generating' | 'optimizing' | 'completed' | 'failed';
  accTaskId?: string;
}

// ═══════════════════════════════════════════════════════════════
// ACC INTEGRATION TYPES
// ═══════════════════════════════════════════════════════════════

export interface ACCTaskMetadata {
  category: 
    | 'artifact-canonical'    // Generate 8-angle reference images
    | 'artifact-3d'          // Generate mesh + textures
    | 'artifact-inject'      // Inject into video generation
    | 'video-generate'       // WAN 2.1 video generation
    | 'video-postprocess'    // Frame interpolation, etc.
    | 'drift-verify'         // Check artifact consistency
    | 'extract-texture';     // Pull textures from video
  
  filmJobId: string;         // Reference back to our job
  priority: number;          // 0-10
  dependencies: string[];    // Other task IDs that must complete first
  
  // Resource estimation
  estimatedDuration: number; // minutes
  estimatedVRAM: number;     // GB
  estimatedComfyLoad: 'light' | 'medium' | 'heavy';  // For queue management
}

// ═══════════════════════════════════════════════════════════════
// DIRECTOR DASHBOARD TYPES
// ═══════════════════════════════════════════════════════════════

export interface ProductionStatus {
  productionId: string;
  name: string;
  
  stats: {
    totalScenes: number;
    totalShots: number;
    completedShots: number;
    
    totalArtifacts: number;
    canonicalGenerated: number;
    threeDGenerated: number;
    
    queueDepth: number;
    activeGenerations: number;
    failedJobs: number;
  };
  
  recentActivity: Array<{
    timestamp: string;
    type: 'artifact_created' | 'video_started' | 'video_completed' | 'drift_detected';
    description: string;
  }>;
}

export interface DriftReport {
  passed: boolean;
  artifactId: string;
  sceneId: string;
  shotId: string;
  
  scores: {
    overall: number;
    ssim: number;           // Structural similarity
    featureMatch: number;   // SIFT/ORB feature correspondence
    clipSimilarity: number; // Semantic similarity
    colorMatch: number;     // Color histogram
  };
  
  details: {
    canonicalReference: string;
    generatedFrame: string;
    diffVisualization?: string;  // Heatmap of differences
  };
  
  recommendations: string[];
}

// ═══════════════════════════════════════════════════════════════
// WORKFLOW TEMPLATES
// ═══════════════════════════════════════════════════════════════

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  
  // Base workflow (JSON)
  baseWorkflow: ComfyWorkflow;
  
  // Parameters that can be injected
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'image' | 'artifact_ref';
    required: boolean;
    default?: unknown;
    description: string;
  }>;
  
  // Artifact injection points
  injectionPoints: Array<{
    nodeId: string;
    inputName: string;
    method: 'ipadapter' | 'controlnet' | 'direct';
  }>;
}
