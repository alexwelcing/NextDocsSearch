# 360 Scene Overhaul Roadmap
## Ship of Theseus: Three.js r182 Modernization

**Goal:** Completely rebuild the 360 scene using modern Three.js r182 patterns, Gaussian splats as primary rendering, and Marble Labs generated worlds - while keeping the app functional at every step.

---

## Phase 1: Foundation (COMPLETE)
- [x] Upgrade Three.js to r182
- [x] Fix breaking type changes
- [x] All PRs merged to main
- [x] Build passing

---

## Phase 2: Modern Scene Architecture

### 2.1 Create New Scene Core
Replace the monolithic ThreeSixty.tsx with a modular architecture:

```
components/
├── scene/
│   ├── Scene3D.tsx           # New orchestrator (replaces ThreeSixty)
│   ├── SceneCanvas.tsx       # R3F Canvas with r182 optimizations
│   ├── SceneEnvironment.tsx  # Lighting, fog, tone mapping
│   ├── SceneBackground.tsx   # Unified background (splat-first)
│   └── SceneCamera.tsx       # Modern camera rig
├── worlds/
│   ├── MarbleWorld.tsx       # Marble Labs world loader
│   ├── WorldAssetLoader.tsx  # Asset management
│   └── types.ts              # World configuration types
└── effects/
    ├── PostProcessing.tsx    # r182 post-processing
    └── Atmosphere.tsx        # Fog, particles, ambient
```

### 2.2 Key Modernizations
- **WebGPU-Ready:** Structure for future WebGPU renderer
- **TSL Shaders:** Use Three.js Shading Language where beneficial
- **Improved Materials:** MeshPhysicalMaterial with r182 energy conservation
- **Modern Shadows:** Vogel disk PCF sampling (r182 feature)

---

## Phase 3: Marble Labs Integration

### 3.1 Asset Types to Support
Marble Labs exports several formats. We'll integrate:

| Format | Use Case | Integration |
|--------|----------|-------------|
| `.glb/.gltf` | 3D models/scenes | GLTFLoader + DRACOLoader |
| `.splat/.ply` | Gaussian splats | @mkkellogg/gaussian-splats-3d or native |
| `.hdr/.exr` | Environment maps | RGBELoader / EXRLoader |
| Textures | PBR materials | TextureLoader with compression |

### 3.2 World Configuration System
```typescript
// lib/worlds/types.ts
interface MarbleWorld {
  id: string;
  name: string;
  assets: {
    environment?: string;      // .splat or .glb path
    skybox?: string;           // .hdr path
    props?: WorldProp[];       // Additional 3D objects
  };
  camera: {
    initial: [number, number, number];
    target: [number, number, number];
    constraints?: CameraConstraints;
  };
  lighting?: LightingPreset;
  postProcessing?: PostProcessingConfig;
}
```

### 3.3 Asset Directory Structure
```
public/
├── worlds/
│   ├── default/
│   │   ├── environment.splat
│   │   ├── skybox.hdr
│   │   └── config.json
│   ├── cyberpunk/
│   │   ├── environment.splat
│   │   ├── props/
│   │   │   ├── neon-signs.glb
│   │   │   └── vehicles.glb
│   │   └── config.json
│   └── nature/
│       ├── environment.splat
│       └── config.json
└── splats/              # (existing - migrate to worlds/)
```

---

## Phase 4: Background System Overhaul

### 4.1 Current State
- `BackgroundSphere.tsx` - Textured sphere (2D panorama)
- `GaussianSplatBackground.tsx` - 3D splat environment
- Toggle switch between them

### 4.2 Target State
**Splat-First Architecture:**
```typescript
// Priority order for backgrounds:
1. Gaussian Splat (if available and capable device)
2. 3D Environment (GLB scene)
3. HDR Skybox (fallback)
4. Textured Sphere (legacy fallback)
```

### 4.3 New Background Component
```typescript
// components/scene/SceneBackground.tsx
interface SceneBackgroundProps {
  world: MarbleWorld;
  quality: 'low' | 'medium' | 'high' | 'ultra';
  fallbackImage?: string;
}
```

Features:
- Automatic quality detection based on device
- Smooth transitions between worlds
- Memory-efficient asset loading/unloading
- Progressive enhancement

---

## Phase 5: Camera System Modernization

### 5.1 Current Issues
- Three separate camera systems (Cinematic, Controller, OrbitControls)
- State scattered across components
- Manual position interpolation

### 5.2 New Unified Camera
```typescript
// components/scene/SceneCamera.tsx
type CameraMode = 'orbit' | 'cinematic' | 'game' | 'vr';

interface CameraConfig {
  mode: CameraMode;
  target: Vector3;
  constraints: {
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
  };
  cinematicPath?: CameraKeyframe[];
}
```

Features:
- Single source of truth for camera state
- GSAP-powered smooth transitions
- VR-aware positioning
- Constraint system for gameplay

---

## Phase 6: Game Integration

### 6.1 Keep What Works
The clicking game is solid. Keep:
- ClickingGame.tsx logic
- GameOrb.tsx visuals
- Scoring/combo system
- Leaderboard integration

### 6.2 Modernize Integration
- Game components receive world context
- Orb positions adapt to world bounds
- Visual effects use world lighting
- Particle system leverages r182 features

---

## Phase 7: Effects & Polish

### 7.1 Post-Processing Pipeline
Using r182's improved post-processing:
```typescript
// Potential effects stack
- Bloom (for emissive elements)
- SSAO (ambient occlusion)
- Color grading (per-world LUTs)
- Depth of field (cinematic moments)
- Motion blur (optional, performance hit)
```

### 7.2 Atmosphere System
- Volumetric fog (r182 improvements)
- Particle systems (snow, dust, fireflies)
- Dynamic time-of-day (optional per world)

---

## Phase 8: Performance & Optimization

### 8.1 Targets
| Device | Target FPS | Quality Level |
|--------|------------|---------------|
| Mobile | 30+ | Low |
| Tablet | 45+ | Medium |
| Desktop | 60 | High |
| High-end | 60+ | Ultra |

### 8.2 Techniques
- Level of Detail (LOD) for splats
- Frustum culling optimization
- Texture compression (Basis Universal)
- Instanced rendering for repeated elements
- Web Workers for asset loading

---

## Migration Path (Ship of Theseus)

### Step-by-Step Replacement

```
Week 1: Scene Architecture
├── Create scene/ directory structure
├── Build SceneCanvas.tsx (parallel to ThreeSixty)
├── Add feature flag to switch between old/new
└── Verify build passes

Week 2: Background System
├── Create SceneBackground.tsx
├── Implement splat-first loading
├── Add world config system
└── Test with existing splat files

Week 3: Camera & Lighting
├── Build SceneCamera.tsx
├── Migrate cinematic sequence
├── Unify camera state management
└── Modern lighting with SceneEnvironment

Week 4: Integration & Polish
├── Connect game components to new scene
├── Add post-processing pipeline
├── Performance optimization pass
└── Remove old ThreeSixty.tsx

Ongoing: Marble Labs Worlds
├── You export worlds from Marble Labs
├── I integrate assets into world config
├── Test and tune each world
└── Build world selection UI
```

---

## File Changes Summary

### New Files
```
components/scene/Scene3D.tsx
components/scene/SceneCanvas.tsx
components/scene/SceneEnvironment.tsx
components/scene/SceneBackground.tsx
components/scene/SceneCamera.tsx
components/worlds/MarbleWorld.tsx
components/worlds/WorldAssetLoader.tsx
components/worlds/types.ts
lib/worlds/config.ts
lib/worlds/loader.ts
public/worlds/default/config.json
```

### Modified Files
```
pages/index.tsx          # Switch to Scene3D
components/ClickingGame.tsx  # World-aware positioning
components/InteractiveTablet.tsx  # World context
```

### Deprecated (Remove after migration)
```
components/ThreeSixty.tsx
components/BackgroundSphere.tsx  # Absorbed into SceneBackground
components/CinematicCamera.tsx   # Absorbed into SceneCamera
components/CameraController.tsx  # Absorbed into SceneCamera
```

---

## Marble Labs Workflow

### Your Part (Manual)
1. Create/export worlds in Marble Labs
2. Export as `.splat` or `.glb`
3. Export environment HDR if available
4. Place files in `public/worlds/{world-name}/`

### My Part (Integration)
1. Create `config.json` for each world
2. Wire up asset loading
3. Configure camera bounds for the space
4. Set lighting to match the world mood
5. Test and optimize

### Example World Config
```json
{
  "id": "cyberpunk-alley",
  "name": "Cyberpunk Alley",
  "assets": {
    "environment": "environment.splat",
    "skybox": "night-city.hdr"
  },
  "camera": {
    "initial": [0, 2, 8],
    "target": [0, 1.5, 0],
    "constraints": {
      "minDistance": 3,
      "maxDistance": 15,
      "minPolarAngle": 0.5,
      "maxPolarAngle": 1.5
    }
  },
  "lighting": {
    "preset": "night",
    "ambient": 0.2,
    "accentColor": "#ff00ff"
  }
}
```

---

## Success Criteria

### Technical
- [ ] Build passes at every step
- [ ] No regression in existing features
- [ ] 60 FPS on desktop, 30 FPS on mobile
- [ ] VR mode functional
- [ ] Splats load in < 3 seconds

### User Experience
- [ ] Smooth world transitions
- [ ] Game playable in any world
- [ ] Cinematic intro adapts to world
- [ ] Mobile experience maintained

### Developer Experience
- [ ] Clean component boundaries
- [ ] Easy to add new worlds
- [ ] Type-safe world configs
- [ ] Clear documentation

---

## Next Action

**Starting now:** Create the new `components/scene/` directory structure and build `SceneCanvas.tsx` as the modern foundation.
