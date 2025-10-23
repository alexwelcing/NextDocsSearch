# Gaussian Splat Files Directory

Place your Gaussian Splat files here to use them as 3D backgrounds in the application.

## Supported Formats

- `.splat` - Gaussian Splat format
- `.ply` - Point cloud format (often used for splats)
- `.ksplat` - Compressed splat format

## How to Get Splat Files

### Using Mobile Apps
1. **Luma AI** (iOS) - https://lumalabs.ai/
   - Capture scenes with your iPhone
   - Export as .splat or .ply

2. **Polycam** (iOS/Android) - https://poly.cam/
   - Scan environments with your phone
   - Export in various 3D formats

3. **Scaniverse** (iOS) - https://scaniverse.com/
   - LiDAR scanning for iPhone Pro models
   - Export as point clouds

### Desktop Tools
1. **Nerfstudio** - https://docs.nerf.studio/
   - Train Gaussian Splat models from videos
   - Requires Python/CUDA setup

2. **COLMAP** - https://colmap.github.io/
   - Structure from Motion
   - Create splats from photo collections

3. **Gaussian Splatting Playground** - https://github.com/antimatter15/splat
   - Web-based converter and viewer

## Usage

1. Place your .splat files in this directory
2. Refresh the application
3. A "Background Controls" panel will appear in the top-right corner
4. Toggle between "Image" and "Splat" modes
5. Select which splat file to use from the dropdown

## File Size Recommendations

- **Recommended**: Under 50MB for smooth performance
- **Maximum**: 200MB (may cause loading delays)
- **Optimal**: 10-30MB for best balance

## Tips

- Name files descriptively (e.g., `office-scene.splat`, `garden-view.splat`)
- Test files on target devices for performance
- Compress large files using available tools
- Keep backups of original high-quality captures

## Example

```
public/splats/
├── README.md (this file)
├── office-interior.splat (25MB)
├── outdoor-scene.ply (42MB)
└── conference-room.ksplat (18MB)
```

The application will automatically detect these files and make them available for selection.
