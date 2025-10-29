# Performance Analysis Report
**Date:** October 29, 2025
**Test Duration:** ~30 seconds
**Total Samples:** 1000+

## Executive Summary

Current performance shows **inconsistent FPS** with periodic drops that impact user experience.

### Key Metrics
- **Average FPS:** 28-31 (target: 30+ mobile, 60 desktop)
- **FPS Range:** 24-42 FPS
- **Frame Time:** 32-42ms (target: <33ms for 30 FPS)
- **Stability:** Poor - frequent drops every ~500ms

## Detailed Analysis

### FPS Distribution
```
FPS 40-42: ~15% of frames ✅ Good
FPS 30-32: ~55% of frames ⚠️  Acceptable
FPS 24-25: ~30% of frames ❌ Poor
```

### Performance Patterns

#### 1. **Periodic FPS Drops** (Critical Issue)
- **Pattern:** FPS drops from 31 → 24 every ~500-1000ms
- **Frame Time:** Spikes from 32ms → 40-42ms
- **Likely Causes:**
  - Garbage collection
  - Texture loading/swapping
  - Physics calculations
  - Orb spawning

#### 2. **Timeline Analysis**
```
Time Range        | Avg FPS | Frame Time | Status
------------------|---------|------------|--------
1761710944-945s   | 31      | 32ms       | ✅ Stable
1761710945-946s   | 25      | 40ms       | ❌ Drop
1761710946-947s   | 31      | 32ms       | ✅ Recovery
1761710947-948s   | 25      | 40ms       | ❌ Drop
1761710948-949s   | 41      | 24ms       | ✅ Peak
```

This pattern repeats consistently, indicating a **periodic system load**.

## Root Causes Identified

### 1. **Texture Management** (High Priority)
- Background spheres use high-resolution textures
- Crossfading between textures doubles memory usage
- No texture size limits or compression

**Fix Applied:** Texture resolution capping at 2048x2048

### 2. **Physics System** (Medium Priority)
- Bouncing ball physics runs constantly
- Ground plane collision detection
- Multiple concurrent orbs during gameplay

**Current Settings:**
- Iterations: 5 (optimized)
- Tolerance: 0.01 (optimized)

### 3. **Render Complexity** (Medium Priority)
- Multiple transparent materials (orbs, glow effects)
- Particle explosions (up to 5 concurrent)
- Article displays with point lights

## Optimizations Implemented

### ✅ Completed
1. Disabled shadows (`shadows={false}`)
2. Reduced DPR to [0.5, 1.5] desktop, [0.3, 0.8] mobile
3. Physics iterations reduced to 5
4. Polygon counts reduced (12x12 spheres)
5. Max concurrent orbs limited (3 mobile, 6 desktop)
6. Explosion limit (5 max)
7. Texture anisotropy reduced (2 vs 4)
8. **NEW:** Texture resolution capping (2048x2048 max)

### 🔄 Recommended Next Steps

#### High Priority
1. **Implement Object Pooling**
   - Reuse orb geometries instead of creating new ones
   - Reuse explosion particle systems
   - Estimated improvement: +5-10 FPS

2. **Lazy Load Background Textures**
   - Don't load next texture until needed
   - Unload old textures immediately after transition
   - Estimated improvement: Eliminate FPS drops

3. **Reduce Particle Complexity**
   - Simplify ParticleExplosion component
   - Use instanced meshes if possible
   - Estimated improvement: +3-5 FPS during gameplay

#### Medium Priority
4. **Optimize Article Display**
   - Hide article displays during low FPS
   - Reduce point light intensity/range
   - Use baked lighting instead

5. **Background Sphere LOD**
   - Use lower poly sphere for mobile
   - Reduce segments further (24x12 → 16x8)

6. **Conditional Rendering**
   - Skip rendering off-screen objects
   - Frustum culling for articles

#### Low Priority
7. **Web Worker for Physics**
   - Move physics calculations off main thread
   - Complex implementation

8. **Texture Compression**
   - Use KTX2/Basis Universal textures
   - Requires build pipeline changes

## Performance Goals

### Target Metrics
| Device Type | Target FPS | Current | Gap |
|-------------|-----------|---------|-----|
| Desktop     | 60        | 28-31   | -29 to -32 |
| Modern Mobile | 45      | 28-31   | -14 to -17 |
| Older Mobile | 30       | 24-31   | +0 to -6 |

### Realistic Short-term Goals (Next Iteration)
- **Desktop:** 45-50 FPS stable (currently 28-31)
- **Mobile:** 30-35 FPS stable (currently 24-31)
- **Eliminate:** FPS drops below 25

## Testing Recommendations

### What to Monitor
1. **FPS during idle** - Should stay 45+ desktop, 30+ mobile
2. **FPS during gameplay** - Monitor orb spawn impact
3. **FPS during scene rotation** - Check OrbitControls impact
4. **Memory usage** - Watch for leaks

### Test Commands
```javascript
// Enable logging
perfLogger.enable()

// Test for 30 seconds
setTimeout(() => {
  const stats = perfLogger.getStats()
  console.log('FPS p50:', stats.fps.p50)
  console.log('FPS p95:', stats.fps.p95)
  console.log('Worst frame time:', stats.frameTime.max + 'ms')
}, 30000)

// Export results
perfLogger.exportCSV()
```

### Scenarios to Test
1. ✅ **Idle Scene** - Bouncing ball only
2. ✅ **Active Game** - Full gameplay with orbs
3. ⏭️  **Scene Rotation** - Continuous camera movement
4. ⏭️  **Mobile Device** - Real device testing needed
5. ⏭️  **Background Switch** - Image → Gaussian Splat

## Conclusion

Current performance is **marginally acceptable** for modern devices but **poor for older devices**. The periodic FPS drops (31 → 24 FPS) are the biggest issue affecting user experience.

**Priority Actions:**
1. ✅ Cap texture resolution (implemented)
2. Implement object pooling for orbs
3. Optimize particle system
4. Add adaptive quality (reduce effects when FPS drops)

**Expected Improvement:**
With recommended changes, expect **35-45 FPS stable** on most devices, which would provide a much smoother experience.
