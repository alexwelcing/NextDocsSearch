# Film Bridge

Integration layer between NextDocsSearch narrative platform and ComfyUI for AI-generated visual assets.

## Overview

The Film Bridge connects NextDocsSearch's narrative content system with ComfyUI's generation capabilities through the Agent Command Center (ACC) Elixir bridge. It provides:

- **Artifact Management**: Register, track, and generate consistent visual assets
- **Video Generation**: Create video clips with artifact injection using WAN 2.1
- **3D Asset Pipeline**: Generate meshes from images using Hunyuan3D
- **Quality Control**: Drift detection to ensure visual consistency

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEXTDOCSSEARCH                                │
│                    (Next.js App)                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Film      │  │  Artifact   │  │    ACC Film Client      │  │
│  │ Orchestrator│  │  Registry   │  │    (Task Queue)         │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
│         └────────────────┼──────────────────────┘               │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              ComfyClient (Direct API)                    │  │
│  └────────────────────────┬─────────────────────────────────┘  │
└───────────────────────────┼────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│           AGENT COMMAND CENTER (Elixir/Phoenix)                  │
│              http://localhost:4000                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  QueueManager → ComfyUI WebSocket → ComfyUI API         │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                         COMFYUI                                  │
│              http://localhost:8188                               │
│  - WAN 2.1 I2V (Image-to-Video)                                  │
│  - Flux Dev (Image Generation)                                   │
│  - Hunyuan3D (Mesh Generation)                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start ComfyUI

```bash
cd ComfyUI_windows_portable
.\run_nvidia_gpu.bat
```

### 2. Start ACC (Agent Command Center)

```bash
cd agent-command-center-ex
mix phx.server
```

### 3. Use in Your Code

```typescript
import { getComfyClient, getArtifactRegistry } from '@/lib/film-bridge';

// Get orchestrator instance
const orchestrator = getFilmOrchestrator();
const registry = await getArtifactRegistry();

// Register an artifact
await registry.register({
  id: 'amulet-001',
  slug: 'ancient-amulet',
  name: 'Ancient Amulet',
  // ... see types.ts for full structure
});

// Generate canonical images
const results = await orchestrator.generateArtifactCanonical(artifact, {
  waitForCompletion: true,
  onProgress: (progress, message) => console.log(`${progress}%: ${message}`),
});

// Generate video with artifact injection
const videoResult = await orchestrator.generateVideo(videoJob, {
  waitForCompletion: true,
});
```

## API Reference

### FilmBridgeOrchestrator

Main coordinator for all generation tasks.

```typescript
class FilmBridgeOrchestrator {
  // Artifact pipeline
  generateArtifactCanonical(artifact, options): Promise<CanonicalResult[]>
  generateArtifact3D(artifact, options): Promise<MeshResult[]>
  
  // Video pipeline
  generateVideo(job, options): Promise<VideoResult>
  
  // Quality pipeline
  verifyArtifactDrift(artifactId, sceneId, shotId, framePath): Promise<DriftReport>
  
  // Batch operations
  queueProduction(jobs, options): Promise<{ accTaskIds: string[] }>
  
  // Status
  getStatus(): Promise<ProductionStatus>
}
```

### ArtifactRegistry

Manages artifact registration and asset tracking.

```typescript
class ArtifactRegistry {
  register(artifact: ArtifactRegistration): Promise<void>
  get(id: string): ArtifactRegistration | undefined
  setCanonicalImage(artifactId, angle, path): Promise<void>
  getBestCanonicalView(artifactId, angle): string | null
  recordAppearance(artifactId, appearance): Promise<void>
  checkDrift(artifactId, generatedPath, expectedAngle): Promise<DriftReport>
}
```

### ACCFilmClient

Interface with the Agent Command Center task queue.

```typescript
class ACCFilmClient {
  createTask(content, metadata): Promise<Task>
  getTask(taskId): Promise<Task | null>
  updateTaskStatus(taskId, status, updates): Promise<Task>
  
  // Film-specific helpers
  queueArtifactCanonical(artifact, angles): Promise<Task>
  queueArtifact3D(artifact): Promise<Task>
  queueVideoGeneration(job): Promise<Task>
  queueDriftVerification(artifactId, sceneId, shotId, framePath): Promise<Task>
  
  // Queue management
  waitForTask(taskId, options): Promise<Task>
  queueProductionBatch(jobs): Promise<Task[]>
  getFilmQueueStatus(): Promise<QueueStatus>
}
```

### ComfyClient

Direct ComfyUI API client.

```typescript
class ComfyClient {
  // HTTP API
  queueWorkflow(workflow, clientId): Promise<QueuedPromptResponse>
  getQueue(): Promise<QueueStatus>
  getHistory(promptId?): Promise<History>
  getOutputUrl(filename, subfolder, type): string
  downloadOutput(filename, subfolder, type): Promise<Buffer>
  uploadImage(buffer, filename, overwrite): Promise<UploadResult>
  
  // WebSocket
  connectWebSocket(clientId): Promise<void>
  waitForCompletion(promptId, timeout): Promise<ExecutionStatus>
  disconnect(): void
  
  // High-level
  executeWorkflow(workflow, options): Promise<ExecutionStatus>
  getSystemStats(): Promise<SystemStats>
}
```

## Workflow Templates

### Artifact Canonical Generation

Generates 8-angle reference images for an artifact:
- Front, Back, Left, Right, Top, Bottom, Held, Detail

Uses Flux Dev with LoRA for consistent style.

### WAN 2.1 Video with Artifact Injection

Creates video from an input image with:
- IP-Adapter for artifact consistency
- ControlNet for pose/depth
- Configurable motion prompts

### Hunyuan3D Mesh Generation

Converts canonical images to 3D mesh:
- Multi-view reconstruction
- PBR texture generation
- LOD variants

## Configuration

### Environment Variables

```bash
# ACC Server URL (default: http://localhost:4000)
ACC_SERVER_URL=http://localhost:4000

# ComfyUI URL (default: http://127.0.0.1:8188)
COMFYUI_URL=http://127.0.0.1:8188
```

### Category Routing

Film-specific tasks are routed to specific agents:

| Category | Agent | Purpose |
|----------|-------|---------|
| artifact-canonical | oracle | Image generation |
| artifact-3d | atlas | 3D mesh generation |
| artifact-inject | sisyphus | Artifact injection |
| artifact-verify | momus | Quality control |
| video-generate | oracle | Video generation |
| video-postprocess | atlas | Frame interpolation |
| drift-verify | momus | Consistency checking |

## Examples

See `examples/asset-generation-example.ts` for complete usage examples.

Run an example:

```bash
cd NextDocsSearch
npx tsx examples/asset-generation-example.ts
```

## Development

### Adding New Workflow Templates

1. Create workflow JSON in `workflows/`
2. Add template function that parameterizes the workflow
3. Export from `index.ts`
4. Add integration test

### Extending the Orchestrator

The orchestrator follows a pipeline pattern. To add a new pipeline:

1. Add method to `FilmBridgeOrchestrator`
2. Create ACC task type in `types.ts`
3. Add queue method to `ACCFilmClient`
4. Update category routing in ACC config

## Troubleshooting

### ComfyUI Connection Failed

- Verify ComfyUI is running: `http://localhost:8188`
- Check firewall settings
- Verify WebSocket support

### ACC Connection Failed

- Verify ACC is running: `http://localhost:4000/api/health`
- Check port 4000 is not in use
- Verify Elixir/Mix installation

### Workflow Execution Failed

- Check ComfyUI has required models installed
- Verify node names match installed custom nodes
- Check ComfyUI console for error messages

### Task Queue Stuck

- Check ACC QueueManager status: `http://localhost:4000/api/comfy/status`
- Verify ComfyUI is not paused
- Check for pending jobs in ComfyUI queue

## License

MIT - Same as NextDocsSearch
