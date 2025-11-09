# Character Studio - Gaussian Splat + Rigging + Animation System

A comprehensive character generation and animation system that combines Gaussian splatting, procedural mesh generation, automatic rigging, and physics-based animation.

## Features

### 🎭 Character Generation
- **Text-to-Character**: Describe your character in natural language
- **Automatic Type Detection**: Humanoid, creature, or object detection
- **Feature Recognition**: Automatically detects tails, wings, special features
- **Mesh Extraction**: Procedural mesh generation with quality settings (low to ultra)
- **Material System**: Smart material generation based on texture hints

### 🦴 Rigging System
- **Auto-Rigging**: Automatic skeleton generation based on character type
- **Skeleton Types**:
  - **Humanoid**: 20+ bones (spine, limbs, head, hands, feet)
  - **Creature**: 24+ bones (quadruped with tail, wings optional)
  - **Object**: Simple root bone
- **Bone Weighting**: Automatic vertex weight assignment
- **Symmetrical Rigging**: Mirror bones for left/right limbs

### 🎬 Animation System
- **Built-in Animations**:
  - **Idle**: Breathing and subtle movements
  - **Walk**: Bipedal or quadrupedal locomotion
  - **Run**: Fast movement animation
  - **Jump**: Launch, air, and landing
  - **Wave**: Friendly greeting
  - **Dance**: Rhythmic body movement
  - **Attack**: Combat motion
- **Animation Blending**: Smooth transitions between animations
- **Speed Control**: Adjustable playback speed (0.1x - 3x)
- **Keyframe System**: Custom animation creation support

### 💥 Physics & Collision
- **Collision Boxes**: Hitboxes, hurtboxes, and trigger volumes
- **Physics Integration**: React Three Cannon integration
- **Mass Simulation**: Realistic mass based on character size
- **Interaction System**: Character-to-character and character-to-object interactions

### 🌐 360° Story Space
- **Immersive Environment**: Full 360-degree scenes
- **Multi-Character Support**: Multiple animated characters per scene
- **Camera Control**: Orbital camera with zoom and pan
- **Interactive Props**: Clickable objects in the scene
- **Scene Management**: Multi-scene storytelling
- **Dialogue System**: Speech bubbles for character dialogue

## Usage

### Basic Character Creation

```typescript
import { generateCharacter } from '@/lib/generators/characterGenerator';

const result = await generateCharacter({
  prompt: 'a toad with a tail',
  meshQuality: 'medium',
  enablePhysics: true,
  interactionRadius: 2.0,
});

if (result.success) {
  const character = result.config;
  console.log(`Generated ${character.name} in ${result.processingTime}ms`);
}
```

### Rendering a Character

```tsx
import RiggedCharacter from '@/components/RiggedCharacter';

function MyScene() {
  return (
    <Canvas>
      <RiggedCharacter
        config={characterConfig}
        currentAnimation="walk"
        animationSpeed={1.0}
        showSkeleton={false}
      />
    </Canvas>
  );
}
```

### Creating Custom Animations

```typescript
import { generateAnimation } from '@/lib/generators/animationGenerator';

const customAnimation = generateAnimation({
  preset: 'dance',
  skeleton: character.skeleton,
  duration: 4.0,
  intensity: 1.5,
});
```

### Adding Collision Detection

```tsx
import CharacterCollision from '@/components/CharacterCollision';

<CharacterCollision
  collisionBoxes={character.collisionBoxes}
  position={[0, 0, 0]}
  onCollision={(otherBody) => {
    console.log('Character collided with:', otherBody);
  }}
  showDebug={true}
/>
```

## Example Prompts

| Prompt | Result |
|--------|--------|
| `a toad with a tail` | Creature-type character with quadrupedal skeleton and tail bones |
| `a dragon with wings` | Creature with wings, tail, and enhanced scale |
| `a robot with four arms` | Humanoid with 6 limbs instead of 4 |
| `a small furry cat creature` | Small-scale creature with furry material texture |
| `a dancing humanoid` | Humanoid with dance animation emphasized |
| `a metallic shiny sphere` | Object-type with metallic materials |

## Architecture

### File Structure

```
lib/generators/
├── characterTypes.ts          # Type definitions
├── characterPromptParser.ts   # NLP prompt parsing
├── skeletonGenerator.ts       # Bone structure generation
├── animationGenerator.ts      # Animation clip creation
└── characterGenerator.ts      # Main generation pipeline

components/
├── RiggedCharacter.tsx        # Character renderer
├── CharacterCollision.tsx     # Collision detection
├── CharacterStudio.tsx        # Creation UI
└── Character360Story.tsx      # Story space
```

### Generation Pipeline

```
User Prompt
    ↓
[Prompt Parser] → Detect type, features, materials
    ↓
[Skeleton Generator] → Create bone structure
    ↓
[Animation Generator] → Generate animation clips
    ↓
[Mesh Extractor] → Create geometry (future: from Gaussian splat)
    ↓
[Material Composer] → Apply materials
    ↓
[Collision Generator] → Add physics boxes
    ↓
Character Config (Ready to render)
```

## Configuration Options

### Mesh Quality Settings

| Quality | Vertices | Texture Size | Use Case |
|---------|----------|--------------|----------|
| Low     | 5,000    | 512px       | Mobile, background characters |
| Medium  | 15,000   | 1024px      | Default, good balance |
| High    | 40,000   | 2048px      | Hero characters, close-ups |
| Ultra   | 100,000  | 4096px      | Cinematic, high-end only |

### Character Types

- **Humanoid**: Bipedal with arms, legs, head (humans, robots, androids)
- **Creature**: Quadrupedal or custom (animals, monsters, fantasy)
- **Object**: Simple animated objects (props, furniture)

## Future Enhancements

### Planned Features
- [ ] Real Gaussian splat mesh extraction
- [ ] IK (Inverse Kinematics) for hands/feet
- [ ] Facial rigging and expressions
- [ ] Cloth simulation
- [ ] Hair/fur physics
- [ ] Motion capture import
- [ ] Character morph targets
- [ ] Advanced skinning (dual quaternion)
- [ ] LOD (Level of Detail) system
- [ ] Character voice integration
- [ ] AI-driven animation

### Gaussian Splatting Integration
Currently using procedural mesh generation. Future versions will:
1. Generate Gaussian splat from text prompt
2. Extract mesh from splat using Poisson reconstruction
3. Simplify mesh to target vertex count
4. Bake splat appearance to textures
5. Auto-rig extracted mesh
6. Apply animations

## Performance Tips

1. **Use appropriate mesh quality** for your use case
2. **Limit active animations** to visible characters
3. **Enable LOD** for distant characters (coming soon)
4. **Reduce particle effects** on lower-end devices
5. **Use instancing** for multiple identical characters
6. **Optimize collision boxes** - fewer is better

## Keyboard Shortcuts

- `Ctrl + Enter`: Generate character (in prompt field)
- `Mouse Drag`: Rotate camera
- `Mouse Scroll`: Zoom camera
- `Right Click + Drag`: Pan camera
- `Space`: Play/pause animation (coming soon)

## API Reference

See detailed API documentation in the type definition files:
- `/lib/generators/characterTypes.ts` - Complete type system
- `/lib/generators/characterGenerator.ts` - Main API

## Credits

Built with:
- **Three.js** - 3D rendering
- **React Three Fiber** - React renderer for Three.js
- **React Three Cannon** - Physics engine
- **@mkkellogg/gaussian-splats-3d** - Gaussian splatting support

## License

Part of the NextDocsSearch project.
