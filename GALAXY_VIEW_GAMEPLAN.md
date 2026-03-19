# Galaxy View Gameplan

## Vision
A cosmic navigation layer that presents all worlds/scenes as destinations in a galaxy. Users zoom out to see the big picture, then navigate into any world seamlessly.

## Core Concepts

### 1. World Types
- **Immersive Scenes** - Full 3D environments (ThreeSixty scenes)
- **Article Realms** - Story worlds represented by their hero imagery
- **Game Arenas** - The Sphere Hunter game and future mini-games
- **Memory Fragments** - Gaussian splat photogrammetry captures

### 2. Galaxy Visualization
- Nodes representing each world, positioned in 3D space
- Connections between related content (articles → themes → scenes)
- Particle/starfield background for depth
- Interactive - hover to preview, click to enter

### 3. Navigation Modes
- **Galaxy View** - Overview of all worlds, free camera movement
- **Constellation View** - Filtered view (e.g., just fiction, just research)
- **Orbit View** - Focused on one world, can rotate around it
- **Entry Sequence** - Warp/zoom transition into selected world

## Architecture

```
components/galaxy/
├── GalaxyView.tsx          # Main galaxy container
├── StarField.tsx           # Background particle system
├── WorldNode.tsx           # Individual world representation
├── ConstellationLines.tsx  # Connections between worlds
├── GalaxyCamera.tsx        # Camera controller for galaxy mode
├── GalaxyUI.tsx            # Overlays (filters, info panels)
└── WarpTransition.tsx      # Entry/exit animations

lib/galaxy/
├── world-registry.ts       # All worlds and their metadata
├── galaxy-layout.ts        # Positioning algorithms
├── navigation-state.ts     # State management
└── transitions.ts          # Animation orchestration

pages/
├── galaxy.tsx              # Galaxy view entry point
└── scenes/
    └── [sceneId].tsx       # Individual scene loader
```

## Implementation Phases

### Phase 1: Foundation (Current)
- [x] Create branch
- [ ] World registry system
- [ ] Basic galaxy scene with starfield
- [ ] Node rendering for worlds
- [ ] Camera controller

### Phase 2: Navigation
- [ ] Click to focus on world
- [ ] Smooth camera transitions
- [ ] World preview cards on hover
- [ ] Filter system (by type, theme, date)

### Phase 3: Polish
- [ ] Entry/exit warp animations
- [ ] Constellation line connections
- [ ] Audio ambience
- [ ] Mobile touch controls

### Phase 4: Integration
- [ ] Link from main site
- [ ] Save exploration progress
- [ ] Achievements for discovery

## Technical Decisions

### Rendering
- Use **@react-three/fiber** for consistency with existing 3D
- **InstancedMesh** for starfield (performance)
- **Html** overlays from @react-three/drei for world labels

### State
- **Zustand** store for galaxy navigation state
- URL params for selected world/filter
- LocalStorage for exploration progress

### Transitions
- Camera animation with **@react-spring/three** or **framer-motion-3d**
- Post-processing effects for warp (optional)
- Scene preloading for instant entry

## World Registry Schema

```typescript
interface World {
  id: string;
  type: 'immersive' | 'article' | 'game' | 'memory';
  title: string;
  description: string;
  thumbnail: string;
  position: [number, number, number]; // In galaxy space
  connections: string[]; // IDs of connected worlds
  metadata: {
    articleSlug?: string;
    sceneType?: 'gaussian' | 'image' | 'mixed';
    theme?: string;
    date?: string;
  };
  entryPoint: {
    camera: { position: [number, number, number]; target: [number, number, number] };
    environment: any;
  };
}
```

## First Steps (This Session)

1. **Create world registry** - Index all existing content
2. **Build GalaxyScene** - Starfield + basic node rendering
3. **GalaxyCamera** - Orbit-style controls for galaxy view
4. **WorldNode component** - Visual representation of each world
5. **Basic galaxy page** - Entry point at `/galaxy`

## Future Ideas

- **Time dimension** - Worlds arranged chronologically in one view
- **Theme clustering** - Group by AI, Fiction, Research themes
- **Visitor trails** - See where others have explored (privacy-safe)
- **Custom constellations** - Users save their own paths
- **World builder** - Create new scenes from galaxy view
