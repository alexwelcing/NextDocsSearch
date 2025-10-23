# VR Support and Gaussian Splat Backgrounds

This document describes the VR and Gaussian Splat features implemented in the application.

## VR Support (@react-three/xr v6)

The application now includes full VR support using the latest @react-three/xr v6 API.

### Features

- **VR Button**: A styled button at the bottom center of the screen allows users to enter VR mode
- **XR Store**: Uses the new `createXRStore()` API for managing VR state
- **XR Origin**: Proper origin setup for tracking user position in VR
- **Automatic Controller Support**: Controllers are automatically rendered when in VR mode

### Usage

1. Open the application on a VR-capable device or browser
2. Click the "Enter VR" button at the bottom of the screen
3. Put on your VR headset and interact with the 3D environment
4. Controllers will appear automatically when detected

### Technical Details

- **Store Creation**: `const store = useMemo(() => createXRStore(), [])`
- **XR Wrapping**: Scene is wrapped with `<XR store={store}>` component
- **Origin**: Uses `<XROrigin>` to establish the coordinate system
- **Physics**: VR works seamlessly with the existing Physics environment

## Gaussian Splat Backgrounds

Support for Gaussian Splat (.splat) files as navigable 3D backgrounds using @mkkellogg/gaussian-splats-3d.

### Features

- **3D Gaussian Splat Rendering**: Load and render .splat files as immersive backgrounds
- **Toggle Support**: Switch between traditional sphere backgrounds and Gaussian Splats
- **Full Navigation**: Move through the Gaussian Splat scene naturally
- **VR Compatible**: Works in both standard and VR modes

### How to Use Gaussian Splats

1. **Add Splat Files**: Place your .splat, .ply, or .ksplat files in `/public/splats/`
2. **Auto-Detection**: The application automatically detects available splat files
3. **UI Controls**: When splats are detected, a "Background Controls" panel appears in the top-right corner
4. **Toggle Mode**: Click "Image" or "Splat" buttons to switch background modes
5. **Select Splat**: Use the dropdown to choose which splat file to display

No code changes needed - it's all automatic!

### Creating Gaussian Splats

Gaussian Splats can be created from:
- Multi-view images using tools like [COLMAP](https://colmap.github.io/)
- Videos using [Nerfstudio](https://docs.nerf.studio/)
- 3D scans using photogrammetry software

Popular tools for creating .splat files:
- [Luma AI](https://lumalabs.ai/) - iPhone app for capturing 3D scenes
- [Polycam](https://poly.cam/) - Cross-platform 3D scanning
- [Gaussian Splatting Playground](https://github.com/antimatter15/splat) - Web-based viewer/converter

### Component API

```tsx
<GaussianSplatBackground
  splatUrl="/splats/background.splat"  // Path to .splat file
  position={[0, 0, 0]}                 // Position in 3D space
  rotation={[0, 0, 0]}                 // Rotation (euler angles)
  scale={1}                            // Scale factor
/>
```

## Compatibility

### Browser Support
- **WebXR VR**: Chrome, Edge, Firefox with WebXR support
- **Gaussian Splats**: All modern browsers with WebGL 2.0 support

### VR Devices
- Meta Quest 2/3/Pro
- HTC Vive
- Valve Index
- Windows Mixed Reality headsets

## Performance Tips

1. **Gaussian Splats**:
   - Keep .splat files under 50MB for best performance
   - Use compressed formats when available
   - Test on target devices for optimal quality/performance balance

2. **VR Mode**:
   - Maintain 90fps for comfortable VR experience
   - Reduce physics complexity if frame rate drops
   - Test on actual VR hardware, not just browser emulation

## Development Notes

- TypeScript definitions for @mkkellogg/gaussian-splats-3d are in `/types/gaussian-splats-3d.d.ts`
- XR store is created once and memoized for performance
- Physics system works seamlessly in both VR and non-VR modes

## UI Features

### Auto-Detection
The application automatically scans `/public/splats/` for compatible files on startup. When splat files are detected:
- A "Background Controls" panel appears in the top-right corner
- Toggle buttons allow switching between Image and Splat backgrounds
- A dropdown menu lists all available splat files with file sizes

### Background Controls Panel
Located in the top-right corner (only visible when splats are detected):
- **Background Mode**: Toggle between "Image" (sphere) and "Splat" (3D scene)
- **Select Splat**: Dropdown showing all available splat files with their sizes

## API Endpoints

### GET /api/getSplats
Returns list of available splat files in the public directory.

**Response:**
```json
{
  "hasSplats": true,
  "splats": [
    {
      "filename": "office-scene.splat",
      "path": "/splats/office-scene.splat",
      "size": 26214400
    }
  ]
}
```

## Future Enhancements

Potential improvements:
- [ ] Hand tracking visualization
- [ ] Controller ray pointers for UI interaction
- [ ] Multiple Gaussian Splat scenes with transitions
- [ ] Teleportation movement in VR
- [ ] Grab/throw physics interactions in VR
- [ ] Splat preview thumbnails
- [ ] Automatic quality adjustment based on device performance
