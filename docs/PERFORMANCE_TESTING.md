# Performance Testing Guide

## Quick Start

1. **Start the development server:**
   ```bash
   pnpm run dev
   ```

2. **Open your browser to:**
   - Desktop: http://localhost:3000
   - Mobile: Use your computer's local IP (e.g., http://192.168.1.100:3000)

## Built-in Performance Monitors

### 1. Visual Performance Monitor (Top Right)
- **FPS Display**: Shows current frames per second
  - 🟢 Green (55+): Excellent performance
  - 🟡 Yellow (30-45): Acceptable performance
  - 🔴 Red (<30): Poor performance, needs optimization
- **Frame Time**: Time to render each frame in milliseconds
- **Click to expand**: Shows detailed render statistics
  - Draw Calls: Number of draw operations (lower is better)
  - Triangles: Total polygon count
  - Geometries/Textures/Programs: Memory usage indicators

### 2. Stats.js Panel (Top Left)
- Shows real-time FPS graph
- Displays frame time (MS)
- Memory usage (if available)

## Browser DevTools Performance Testing

### Chrome DevTools
1. Open DevTools (F12)
2. Go to **Performance** tab
3. Click Record (⚫)
4. Interact with the 3D scene (rotate, click game elements)
5. Stop recording
6. Analyze:
   - Look for FPS drops in the frame chart
   - Check "Main" thread for long tasks (>50ms)
   - Inspect "GPU" activity

### Performance Profiler (Advanced)
```javascript
// In browser console:

// Enable detailed logging
perfLogger.enable()

// Test for 30 seconds, then get stats
setTimeout(() => perfLogger.getStats(), 30000)

// Export performance data
perfLogger.exportCSV()

// Clear logs
perfLogger.clear()

// Disable logging
perfLogger.disable()
```

## Test Scenarios

### Scenario 1: Idle Scene Performance
1. Load the page
2. Don't click the bouncing ball
3. **Target**: 60 FPS on desktop, 30+ FPS on mobile
4. Observe for 30 seconds

### Scenario 2: Game Performance
1. Click the bouncing ball to start game
2. Play for full 30-second duration
3. **Target**: 45+ FPS on desktop, 25+ FPS on mobile
4. Note: Performance may dip during many orbs/explosions

### Scenario 3: Scene Rotation Performance
1. Click and drag to rotate view
2. Continuously rotate for 30 seconds
3. **Target**: Smooth 60 FPS, no stuttering

### Scenario 4: Mobile Performance
1. Test on actual mobile device (not just browser DevTools)
2. Enable performance monitor
3. **Target**: Consistent 30+ FPS
4. Test both portrait and landscape

### Scenario 5: Background Switching
1. Change between Image and Gaussian Splat backgrounds
2. Rotate scene after each change
3. **Target**: No significant FPS drop

## Performance Expectations

### Desktop (Good GPU)
- **Idle**: 60 FPS
- **Gaming**: 50-60 FPS
- **Heavy Action**: 45+ FPS

### Desktop (Integrated GPU)
- **Idle**: 45-60 FPS
- **Gaming**: 35-45 FPS
- **Heavy Action**: 30+ FPS

### Mobile (Modern)
- **Idle**: 30-60 FPS
- **Gaming**: 25-40 FPS
- **Heavy Action**: 20-30 FPS

### Mobile (Older Devices)
- **Idle**: 25-30 FPS
- **Gaming**: 20-25 FPS
- **Heavy Action**: 15-20 FPS

## What to Look For

### Good Signs ✅
- Consistent FPS (no wild fluctuations)
- Smooth animations
- Responsive controls
- Draw calls < 100
- Triangles < 50,000

### Warning Signs ⚠️
- FPS drops below 30 for extended periods
- Stuttering during rotation
- Delayed click responses
- Draw calls > 150
- Memory continuously increasing

### Critical Issues 🔴
- FPS below 15
- Browser freezing
- "Page Unresponsive" warnings
- Device getting hot quickly
- Battery draining rapidly (mobile)

## Optimization Checklist

If performance is poor, verify these optimizations are active:

- [ ] Shadows disabled (`shadows={false}`)
- [ ] DPR reduced for mobile (`dpr={[0.3, 0.8]}`)
- [ ] Gaussian splats disabled on mobile
- [ ] Max 3-6 concurrent orbs
- [ ] Physics iterations reduced to 5
- [ ] Antialiasing disabled
- [ ] Geometry LOD (low poly counts)

## Debugging Performance Issues

### High Draw Calls
- Check for too many individual meshes
- Consider merging geometries
- Review particle system count

### High Triangle Count
- Reduce sphere segments (currently 12x12)
- Check background geometry complexity
- Disable unused 3D objects

### Memory Leaks
- Monitor texture disposal
- Check for orphaned event listeners
- Verify cleanup in useEffect hooks

### GPU Bottleneck
- Reduce DPR further
- Disable post-processing effects
- Simplify shaders/materials

## Console Commands Reference

```javascript
// Performance logging
perfLogger.enable()           // Start logging
perfLogger.getStats()         // View statistics
perfLogger.exportCSV()        // Export data
perfLogger.markEvent('name')  // Mark specific moment
perfLogger.clear()            // Clear logs
perfLogger.disable()          // Stop logging

// Browser performance
performance.memory            // Check memory usage
performance.now()             // High-resolution timestamp
```

## Reporting Performance Issues

When reporting issues, include:
1. Device/Browser info
2. FPS readings (min/avg/max)
3. Frame time (ms)
4. Draw call count
5. What scenario was being tested
6. Screenshot of performance monitor
7. Export from perfLogger.exportCSV()

## Tips for Best Results

1. **Close other browser tabs** - Free up GPU/CPU
2. **Disable browser extensions** - Reduce interference
3. **Test in incognito mode** - Clean environment
4. **Use actual devices** - Don't rely only on emulation
5. **Test multiple times** - Account for variance
6. **Monitor temperature** - Especially on mobile
7. **Test different scenes** - Image vs Gaussian Splat backgrounds
