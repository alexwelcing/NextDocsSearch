# Artifact Persistence System
## Technical Design for Key Object Consistency

**Status:** Draft | **Priority:** P0 | **Owner:** Creative Vision Team

---

## The Challenge

Generative video models (WAN 2.1, LTX, etc.) suffer from **object drift**:
- A "crystal dagger" changes shape between shots
- A "family locket" has different engravings in each scene
- A "medieval compass" points different directions arbitrarily

**Our Differentiator:** Guaranteed artifact consistency across the entire production.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ARTIFACT REGISTRY                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Artifact   │  │   Canonical  │  │   Multi-View │  │   3D Asset   │    │
│  │   Metadata   │  │   Image Set  │  │   Dataset    │  │   (Mesh+Tex) │    │
│  │              │  │              │  │              │  │              │    │
│  │ - Unique ID  │  │ - 8 angles   │  │ - 24+ views  │  │ - GLB/USDZ   │    │
│  │ - Story sig  │  │ - Neutral bg │  │ - Detail map │  │ - PBR mats   │    │
│  │ - Importance │  │ - Consistent │  │ - Ambient    │  │ - LOD levels │    │
│  │   weight     │  │   lighting   │  │   occlusion  │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                      INJECTION STRATEGIES                                    │
│                                                                              │
│  1. IP-ADAPTER REFERENCE    2. CONTROLNET POSE      3. DEPTH-BASED MASK     │
│     ┌─────────────┐            ┌─────────────┐         ┌─────────────┐     │
│     │ Artifact    │            │ Character   │         │ Scene depth │     │
│     │ reference   │            │ pose ref    │         │ map         │     │
│     │ image       │            │             │         │             │     │
│     └──────┬──────┘            └──────┬──────┘         └──────┬──────┘     │
│            ↓                          ↓                       ↓            │
│     ┌─────────────┐            ┌─────────────┐         ┌─────────────┐     │
│     │ CLIP vision │            │ OpenPose/   │         │ Depth       │     │
│     │ encoding    │            │ DWPose      │         │ ControlNet  │     │
│     └──────┬──────┘            └──────┬──────┘         └──────┬──────┘     │
│            ↓                          ↓                       ↓            │
│     ┌─────────────┐            ┌─────────────┐         ┌─────────────┐     │
│     │ Cross-attn  │            │ Structure   │         │ Occlusion   │     │
│     │ injection   │            │ guidance    │         │ handling    │     │
│     └─────────────┘            └─────────────┘         └─────────────┘     │
│                                                                              │
│  4. SEAMLESS TILE (background)  5. INPAINTING MASK    6. CROMA KEY        │
│     For environmental artifacts    For hand-held props   For compositing   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Artifact Registration Pipeline

### Stage 1: Artifact Definition

```typescript
interface ArtifactRegistration {
  id: string;                    // UUID v4
  slug: string;                  // URL-friendly name
  name: string;                  // Display name
  storySignature: {
    series: string;              // e.g., "the-interface"
    episode: number;             // Episode where introduced
    narrativeWeight: number;     // 0-1 (plot device vs background dressing)
  };
  
  // Physical characteristics (for generation guidance)
  physical: {
    category: 'weapon' | 'jewelry' | 'tool' | 'document' | 'technology' | 'natural';
    material: string[];          // e.g., ["brass", "ivory", "crystal"]
    dimensions: {                // Approximate real-world size
      length: number;            // cm
      width: number;
      height: number;
    };
    colorPalette: string[];      // e.g., ["#8B4513", "#DAA520"]
    distinguishingFeatures: string[];  // e.g., ["three scratches on handle"]
  };
  
  // Generation constraints
  generation: {
    canonicalSeed: number;       // Fixed seed for canonical views
    stylePrompt: string;         // e.g., "weathered Victorian, soft lighting"
    negativePrompt: string;      // What to avoid
    priorityViews: string[];     // ["top", "front", "held-in-hand"]
  };
  
  // Cross-media assets
  assets: {
    canonicalImages: string[];   // Paths to 8-angle renders
    detailMaps: {
      normal: string;            // Normal map for surface detail
      roughness: string;         // Roughness map
      metallic: string;          // Metallic map
    };
    threeD?: {
      glb: string;               // Web/runtime format
      usdz: string;              // iOS AR format
      fbx: string;               // Production format
      sourceBlend: string;       // Editable source
    };
    videoReferences: string[];   // Existing clips featuring this artifact
  };
  
  // Tracking state
  appearances: Array<{
    sceneId: string;
    shotType: 'closeup' | 'medium' | 'wide' | 'background';
    injectionMethod: 'ipadapter' | 'controlnet' | 'depth' | 'composite';
    quality: number;             // 0-100, for drift detection
  }>;
}
```

### Stage 2: Canonical Image Generation

Generate 8 standard views with consistent lighting:

```typescript
const CANONICAL_ANGLES = [
  { name: 'front', azimuth: 0, elevation: 0 },
  { name: 'front-left', azimuth: 45, elevation: 0 },
  { name: 'left', azimuth: 90, elevation: 0 },
  { name: 'back-left', azimuth: 135, elevation: 0 },
  { name: 'back', azimuth: 180, elevation: 0 },
  { name: 'back-right', azimuth: 225, elevation: 0 },
  { name: 'right', azimuth: 270, elevation: 0 },
  { name: 'front-right', azimuth: 315, elevation: 0 },
  // Plus top and bottom for 3D reconstruction
  { name: 'top', azimuth: 0, elevation: 90 },
  { name: 'bottom', azimuth: 0, elevation: -90 },
];
```

---

## Video Injection Strategies

### Strategy A: IP-Adapter Reference (Primary)

Best for: Medium shots where artifact is clearly visible

```typescript
// Simplified workflow concept
async function injectWithIPAdapter(
  artifact: Artifact,
  shot: Shot,
  baseWorkflow: ComfyWorkflow
): Promise<ComfyWorkflow> {
  
  // Select best canonical view based on shot angle
  const referenceView = selectBestView(
    artifact.assets.canonicalImages,
    shot.cameraAngle
  );
  
  // Inject IP-Adapter node into workflow
  return {
    ...baseWorkflow,
    ipadapter: {
      model: "ip-adapter-plus_sd15",
      image: referenceView,
      weight: 0.8,
      weight_type: "original",
      start_at: 0.0,
      end_at: 1.0
    }
  };
}
```

### Strategy B: ControlNet Pose + Depth (Secondary)

Best for: Complex interactions (hand holding artifact)

### Strategy C: Compositing Pipeline (Fallback)

Best for: Post-generation correction

---

## 3D Asset Generation Pipeline

Using your existing Hunyuan3D:

```typescript
interface MeshGenerationConfig {
  method: 'hunyuan3d' | 'instantmesh' | 'tripo';
  targetPolyCount: number;
  textureResolution: 1024 | 2048 | 4096;
  outputs: {
    glb: boolean;
    usdz: boolean;
    fbx: boolean;
    blend: boolean;
  };
}

class Artifact3DGenerator {
  async generateFromViews(artifact: Artifact): Promise<Generated3DAsset> {
    // Step 1: Generate base mesh with Hunyuan3D
    // Step 2: Detail enhancement with normal maps
    // Step 3: Retopology for clean topology
    // Step 4: Export to all formats
  }
}
```

---

## ACC Integration

```typescript
interface ArtifactTask extends Task {
  artifactId: string;
  taskType: 
    | 'generate_canonical'
    | 'generate_3d'
    | 'inject_video'
    | 'verify_consistency';
  
  injectionParams?: {
    sceneId: string;
    shotType: 'closeup' | 'medium' | 'wide';
    method: 'ipadapter' | 'controlnet' | 'composite';
  };
}

// ACC routing
const ARTIFACT_CATEGORIES = {
  'artifact-canonical': 'multimodal-looker',
  'artifact-3d': 'atlas',
  'artifact-inject': 'sisyphus',
  'artifact-verify': 'momus',
};
```

---

## Competitive Differentiation

| Feature | Standard Gen Video | Our System |
|---------|-------------------|------------|
| Object consistency | ❌ Random drift | ✅ Guaranteed |
| Cross-shot identity | ❌ No tracking | ✅ Artifact registry |
| 3D asset export | ❌ Not available | ✅ Automatic mesh |
| Detail preservation | ❌ Loses details | ✅ Detail maps |
| Quality verification | ❌ Manual review | ✅ Auto drift detection |

---

*Design by Claude Code CLI | March 2026*
