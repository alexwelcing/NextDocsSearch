# React Three Fiber Web Performance & WebGPU Testing Skill

Use this skill when working on React Three Fiber (R3F) performance optimization, WebGPU renderer testing, or 3D graphics profiling tasks.

## Project Context

This project uses:
- `@react-three/fiber` v9.x with Three.js v0.182.0
- `@react-three/drei` for helpers and abstractions
- `@react-three/postprocessing` for visual effects
- `@react-three/cannon` for physics
- Gaussian splats via `@mkkellogg/gaussian-splats-3d`
- Existing performance utilities in `lib/3d/performanceUtils.ts`

## Performance Utilities Available

The project has built-in performance utilities at `lib/3d/performanceUtils.ts`:

### Caching Systems
- `geometryCache` - Global geometry cache with ref counting
- `materialCache` - Global material cache with ref counting
- `textureCache` - LRU texture cache with automatic eviction

### LOD (Level of Detail)
- `LOD_PRESETS` - Pre-configured LOD levels (low, medium, high, ultra)
- `createLOD()` - Create THREE.LOD objects with predefined levels
- `calculateLODLevel()` - Calculate appropriate LOD based on camera distance

### Frustum Culling
- `updateFrustum()` - Update frustum from camera (call once per frame)
- `isInFrustum()` - Check bounding sphere visibility
- `isBoxInFrustum()` - Check bounding box visibility

### Instancing
- `createInstancedMesh()` - Create optimized instanced meshes
- `InstancePool` - Pool for reusing instanced mesh slots
- `batchMatrixUpdates()` - Batch matrix updates for instanced meshes

### Performance Monitoring
- `FrameTimeTracker` - Track frame times and FPS
- `getPerformanceMetrics()` - Collect renderer metrics (draw calls, triangles, etc.)

### Resource Disposal
- `disposeObject()` - Recursively dispose Three.js objects
- `disposeMaterial()` - Dispose materials and their textures
- `disposeAllCaches()` - Clear all global caches

## WebGPU Testing

### Enabling WebGPU Renderer

Three.js v0.182.0 supports WebGPU. To test WebGPU rendering:

```tsx
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'

// Check WebGPU support
const isWebGPUSupported = async () => {
  if (!navigator.gpu) return false
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return !!adapter
  } catch {
    return false
  }
}

// Create WebGPU renderer
const createWebGPURenderer = async (canvas: HTMLCanvasElement) => {
  const { WebGPURenderer } = await import('three/webgpu')
  const renderer = new WebGPURenderer({ canvas, antialias: true })
  await renderer.init()
  return renderer
}

// Canvas with WebGPU fallback
function WebGPUCanvas({ children }) {
  const [renderer, setRenderer] = useState(null)

  useEffect(() => {
    isWebGPUSupported().then(supported => {
      if (supported) {
        // Use WebGPU
      } else {
        // Fallback to WebGL
      }
    })
  }, [])

  return <Canvas gl={renderer}>{children}</Canvas>
}
```

### WebGPU Performance Considerations

1. **Compute Shaders**: WebGPU enables compute shaders for GPU-based calculations
2. **Better Batching**: Improved draw call batching
3. **Memory Management**: More explicit memory control
4. **Pipeline Caching**: Shader pipeline compilation caching

## Performance Optimization Checklist

### Geometry Optimization
- [ ] Use `geometryCache` for shared geometries
- [ ] Implement LOD for complex meshes
- [ ] Use BufferGeometry over Geometry
- [ ] Merge static geometries with `BufferGeometryUtils.mergeGeometries()`
- [ ] Use indexed geometries to reduce vertex count

### Material Optimization
- [ ] Use `materialCache` for shared materials
- [ ] Prefer `MeshBasicMaterial` when lighting not needed
- [ ] Use `flatShading` to reduce normal calculations
- [ ] Batch materials to reduce shader switches
- [ ] Use texture atlases to reduce texture bindings

### Rendering Optimization
- [ ] Enable frustum culling (default in Three.js)
- [ ] Use `InstancedMesh` for repeated objects (100+ instances)
- [ ] Implement occlusion culling for complex scenes
- [ ] Reduce shadow map resolution when possible
- [ ] Use `powerPreference: 'high-performance'` in renderer

### React Three Fiber Specific
- [ ] Use `useFrame` with conditional updates
- [ ] Avoid creating objects in render functions
- [ ] Use `useMemo` for geometries and materials
- [ ] Implement `React.memo` for static scene components
- [ ] Use `invalidateFrameloop` for on-demand rendering

### Post-Processing
- [ ] Limit post-processing passes
- [ ] Use half-resolution for expensive effects
- [ ] Disable effects on mobile/low-end devices
- [ ] Profile effect cost individually

## Performance Profiling

### Using Chrome DevTools
```javascript
// In useFrame hook
useFrame(({ gl }) => {
  // Start performance mark
  performance.mark('frame-start')

  // ... render logic ...

  // End performance mark
  performance.mark('frame-end')
  performance.measure('frame', 'frame-start', 'frame-end')
})
```

### Using FrameTimeTracker
```tsx
import { FrameTimeTracker, getPerformanceMetrics } from '@/lib/3d/performanceUtils'

const tracker = new FrameTimeTracker(60)

function PerformanceMonitor() {
  const { gl } = useThree()

  useFrame(() => {
    tracker.record()
    const metrics = getPerformanceMetrics(gl, tracker.getFrameTimes())
    console.log(`FPS: ${metrics.fps}, Draw Calls: ${metrics.drawCalls}`)
  })

  return null
}
```

### Stats.js Integration
```tsx
import Stats from 'three/examples/jsm/libs/stats.module'

function StatsPanel() {
  const stats = useMemo(() => new Stats(), [])

  useEffect(() => {
    document.body.appendChild(stats.dom)
    return () => document.body.removeChild(stats.dom)
  }, [])

  useFrame(() => stats.update())

  return null
}
```

## Testing Performance

### Automated Performance Tests
```typescript
// vitest performance test example
import { describe, it, expect } from 'vitest'

describe('R3F Performance', () => {
  it('should render at 60fps with 1000 instances', async () => {
    const tracker = new FrameTimeTracker(100)

    // Simulate 100 frames
    for (let i = 0; i < 100; i++) {
      tracker.record()
      await new Promise(r => setTimeout(r, 16))
    }

    expect(tracker.getFPS()).toBeGreaterThanOrEqual(55)
  })

  it('should stay under draw call budget', () => {
    // Test draw calls remain under threshold
    const metrics = getPerformanceMetrics(renderer, [])
    expect(metrics.drawCalls).toBeLessThan(100)
  })
})
```

### Memory Leak Detection
```typescript
function detectMemoryLeaks(renderer: THREE.WebGLRenderer) {
  const before = { ...renderer.info.memory }

  // ... run test scenario ...

  const after = renderer.info.memory

  return {
    geometryLeak: after.geometries - before.geometries,
    textureLeak: after.textures - before.textures
  }
}
```

## Common Performance Issues

### Issue: High Draw Calls
**Solution**: Use instancing or merge geometries
```tsx
// Instead of multiple meshes
{items.map(item => <mesh key={item.id} />)}

// Use InstancedMesh
<instancedMesh args={[geometry, material, items.length]}>
  {/* Update matrices in useFrame */}
</instancedMesh>
```

### Issue: Memory Leaks
**Solution**: Always dispose resources on unmount
```tsx
useEffect(() => {
  return () => {
    disposeObject(sceneRef.current)
    disposeAllCaches()
  }
}, [])
```

### Issue: Slow Initial Load
**Solution**: Implement progressive loading with Suspense
```tsx
<Suspense fallback={<LoadingIndicator />}>
  <Model />
</Suspense>
```

### Issue: Jank on Mobile
**Solution**: Reduce quality on low-end devices
```tsx
const isMobile = /Android|iPhone/i.test(navigator.userAgent)
const dpr = isMobile ? [1, 1.5] : [1, 2]
const shadows = !isMobile

<Canvas dpr={dpr} shadows={shadows} />
```

## File Locations

Key files for performance work:
- `lib/3d/performanceUtils.ts` - Core performance utilities
- `components/3d/camera/CameraController.tsx` - Camera management
- `components/3d/atmosphere/PostProcessingEffects.tsx` - Post-processing
- `components/scene/SceneCanvas.tsx` - Main canvas setup
