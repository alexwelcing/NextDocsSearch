# Film Bridge Quick Start

Production-ready integration between NextDocsSearch and ComfyUI with monitoring dashboard.

## 🎬 What's New

### 1. **Monitoring Dashboard** (Port 3007)
```
http://127.0.0.1:3007/film-bridge
```

**Features:**
- Real-time VRAM monitoring (18GB limit with 2GB headroom)
- ComfyUI start/stop/restart controls
- Artifact registry browser
- Queue status (pending, in-progress, completed, failed)
- Live logs from ComfyUI process
- Loaded models display

### 2. **ComfyUI Service Manager**
100% control with:
- **Automatic startup/shutdown**
- **VRAM monitoring** every 2 seconds
- **Emergency unload** at 90% VRAM
- **Auto-restart** on crash (3 retries)
- **Model lifecycle management** (aggressive unloading between jobs)
- **Health checks** every 5 seconds

### 3. **Prompt Validator**
Safe prompt handling:
- Removes redundant quality terms
- Normalizes style aliases
- Detects conflicting directions
- Validates parentheses matching
- Token estimation
- Complexity scoring

### 4. **Artifact Persistence**
Your differentiator:
- 8 canonical views per artifact
- IP-Adapter injection into WAN 2.1
- Drift detection (SSIM + CLIP)
- Automatic 3D mesh generation
- Cross-shot consistency guarantee

---

## 🚀 Quick Start

### Start Everything (One Command)

```bash
cd ComfyUI_windows_portable/NextDocsSearch

# Start ComfyUI + Dashboard
pnpm film-bridge:start

# Or separately:
pnpm dev:film-bridge  # Dashboard only (port 3007)
```

**What happens:**
1. ComfyUI starts on port 8188
2. Dashboard starts on port 3007
3. VRAM monitoring begins
4. Logs stream to dashboard

### Open Dashboard

```
http://127.0.0.1:3007/film-bridge
```

**Tabs:**
- **Overview** - VRAM, queue, models, logs
- **Artifacts** - Registry management
- **Queue** - Production queue status
- **Logs** - Full ComfyUI logs
- **Settings** - Service configuration

### Stop Everything

```bash
pnpm film-bridge:stop
```

### Check Status

```bash
pnpm film-bridge:status
```

---

## 📊 Dashboard Features

### VRAM Monitor
- Real-time usage bar
- Color-coded warnings (green/yellow/red)
- Auto-unload at 90%
- Free/Used/Limit display

### ComfyUI Controls
- **Start** - Launch ComfyUI with monitoring
- **Stop** - Graceful shutdown
- **Restart** - Auto-retry on failure
- Status indicator with uptime

### Artifact Registry
- View all registered artifacts
- Canonical image status
- 3D model availability
- Appearance count
- Drift score tracking

### Queue Management
- Pending jobs
- In-progress generations
- Completion/failure counts
- By-category breakdown

---

## 🛡️ Safety Features

### VRAM Protection
```typescript
// Automatic at 90% usage
if (vramUsed > 18GB) {
  await emergencyUnload();
  // Frees all non-essential models
}
```

### Model Lifecycle
```typescript
// Between jobs
await unloadNonEssentialModels();
// Keeps only: z_image_bf16, wan2.1_i2v
```

### Prompt Sanitization
```typescript
const result = sanitizePrompt(rawPrompt, {
  maxLength: 500,
  maxTokenEstimate: 150,
});

if (!result.valid) {
  console.error(result.errors);
}
// Removes: "very very high quality"
// Normalizes: "photo realistic" → "photorealistic"
```

### Crash Recovery
```typescript
// Auto-restart with backoff
if (crash && retryCount < 3) {
  await restartComfyUI();
  retryCount++;
}
```

---

## 🔧 Configuration

### Environment Variables
```bash
# .env.local
COMFY_DIR=C:/Users/alexw/Downloads/USE_THIS_COMFY/ComfyUI_windows_portable/ComfyUI
COMFY_PYTHON=C:/Users/alexw/Downloads/USE_THIS_COMFY/ComfyUI_windows_portable/python_embeded/python.exe
ACC_SERVER_URL=http://localhost:8000
```

### Service Config
```typescript
const service = getComfyService({
  vramLimitGB: 18,        // Leave 2GB headroom
  aggressiveUnload: true,  // Free VRAM between jobs
  maxRetries: 3,          // Auto-restart attempts
  keepModelsInMemory: ['z_image_bf16'],  // Always keep loaded
});
```

---

## 🎨 Register Your First Artifact

```typescript
import { getArtifactRegistry, getFilmOrchestrator } from './lib/film-bridge';

const registry = await getArtifactRegistry();
const orchestrator = getFilmOrchestrator();

// 1. Register
const katana = await registry.register({
  slug: 'neon-katana-kael',
  name: "Kael's Neon Katana",
  storySignature: {
    series: 'cyberpunk-samurai',
    episode: 1,
    narrativeWeight: 0.9,
  },
  physical: {
    category: 'weapon',
    materials: ['carbon fiber', 'neon tubing', 'obsidian'],
    dimensions: { length: 90, width: 5, height: 2 },
    distinguishingFeatures: [
      'crack in the obsidian blade',
      'pulsing blue neon edge',
      'worn carbon fiber handle'
    ],
  },
  generation: {
    canonicalSeed: 42,
    stylePrompt: 'cyberpunk weapon, neon glow, weathered, dramatic lighting',
  },
});

// 2. Generate canonical views (8 angles)
const views = await orchestrator.generateArtifactCanonical(katana, {
  onProgress: (p, msg) => console.log(msg),
});

// 3. Generate 3D mesh
const mesh = await orchestrator.generateArtifact3D(katana);

// 4. Use in video with IP-Adapter injection
const video = await orchestrator.generateVideo({
  input: { imagePath: '/scenes/kael-pose.png' },
  artifacts: [{
    artifactId: katana.id,
    importance: 'hero',
    injectionMethod: 'ipadapter',
  }],
});

// 5. Verify consistency
const drift = await orchestrator.verifyArtifactDrift(
  katana.id, 'scene-1', 'shot-1', video.frames[0]
);
console.log(`Drift score: ${drift.scores.overall}/100`);
```

---

## 📁 File Structure

```
lib/film-bridge/
├── index.ts                      # Public exports
├── types.ts                      # Type definitions
├── comfy-client.ts               # ComfyUI API client
├── artifact-registry.ts          # Artifact database
├── acc-integration.ts            # ACC queue bridge
├── orchestrator.ts               # Main coordinator
├── service/
│   ├── comfy-service.ts          # Process manager + VRAM monitor
│   └── prompt-validator.ts       # Safe prompt handling
├── workflows/
│   ├── artifact-canonical.ts     # 8-view generation
│   └── wan-video-with-artifact.ts  # IP-Adapter injection
└── README.md                     # Full docs

pages/
├── film-bridge/
│   └── index.tsx                 # Dashboard UI (port 3007)
└── api/film-bridge/
    ├── status.ts                 # GET /api/film-bridge/status
    ├── start.ts                  # POST /api/film-bridge/start
    ├── stop.ts                   # POST /api/film-bridge/stop
    ├── restart.ts                # POST /api/film-bridge/restart
    ├── queue.ts                  # GET /api/film-bridge/queue
    └── artifacts.ts              # GET/POST /api/film-bridge/artifacts

scripts/
└── film-bridge-manager.ts        # One-command startup
```

---

## 🎯 Key Workflows

### Generate Canonical Views
```bash
# Via API
curl -X POST http://localhost:3007/api/film-bridge/artifacts \
  -H "Content-Type: application/json" \
  -d '{"slug":"test-artifact","name":"Test"}'
```

### Start Video Generation
```typescript
const job = await orchestrator.generateVideo({
  sceneId: 'scene-3',
  shotId: 'shot-7',
  input: { imagePath: '/input/frame.png' },
  artifacts: [{ artifactId: '...', importance: 'hero' }],
  params: { model: 'wan21-i2v-480p', steps: 25 },
});
```

### Monitor via Dashboard
1. Open `http://127.0.0.1:3007/film-bridge`
2. Watch VRAM bar during generation
3. Check "Loaded Models" for current state
4. View logs in real-time
5. Check drift scores in Artifacts tab

---

## 🔒 Safety Checklist

✅ **VRAM Protection**
- [x] 18GB limit (2GB headroom)
- [x] Auto-unload at 90%
- [x] Model lifecycle management
- [x] Emergency free on error

✅ **Prompt Safety**
- [x] Redundancy removal
- [x] Style normalization
- [x] Token estimation
- [x] Syntax validation

✅ **Service Reliability**
- [x] Health checks every 5s
- [x] Auto-restart on crash
- [x] Graceful shutdown
- [x] Process cleanup

✅ **Artifact Consistency**
- [x] 8 canonical views
- [x] IP-Adapter injection
- [x] Drift detection
- [x] Quality scoring

---

## 🐛 Troubleshooting

### ComfyUI won't start
```bash
# Check if port 8188 is free
netstat -ano | findstr :8188

# Kill existing process
taskkill /PID <PID> /F
```

### VRAM at 100%
- Dashboard shows red bar
- Auto-unload triggers
- Check "Loaded Models" for leaks
- Manual unload: `POST /api/film-bridge/unload`

### High Drift Scores
- Re-generate canonical views
- Increase IP-Adapter weight
- Verify artifact reference quality

### Dashboard not loading
```bash
# Check port 3007
netstat -ano | findstr :3007

# Restart dashboard only
pnpm dev:film-bridge
```

---

## 📊 Performance Expectations

| Operation | Time | VRAM |
|-----------|------|------|
| ComfyUI Startup | 30-60s | ~2GB |
| 8 Canonical Views | ~15min | ~8GB |
| 3D Mesh Generation | ~10min | ~6GB |
| WAN 2.1 Video (4s) | ~8min | ~12GB |
| IP-Adapter Injection | +20% time | +2GB |

**20GB RTX A4500 Usage:**
- Idle: ~2GB
- Single video job: ~14GB
- Headroom for batch: ~4GB

---

## 🚀 Next Steps

1. **Start the bridge:**
   ```bash
   pnpm film-bridge:start
   ```

2. **Open dashboard:**
   ```
   http://127.0.0.1:3007/film-bridge
   ```

3. **Register first artifact** in Artifacts tab

4. **Generate canonical views**

5. **Create video with injection**

6. **Monitor VRAM** during generation

---

*Film Bridge v1.0 - Production Ready*
