# Video Generation System

A comprehensive video generation pipeline integrating:
- **HF-Mount**: Lazy-loaded access to HuggingFace models
- **daVinci-MagiHuman**: 15B parameter single-stream Transformer for human-centric video
- **OpenStory-Inspired Composer**: Narrative-driven video composition with style consistency

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  HF-Mount       │────▶│  daVinci/LTX    │────▶│  Narrative      │
│  Model Access   │     │  Video Gen      │     │  Composer       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       │                       │                       │
       ▼                       ▼                       ▼
  Lazy-loaded              Character            Script-to-Video
  model files             -focused             with continuity
  (no download)           video               and style guides
```

## Quick Start

### 1. Install HF-Mount

```bash
# Install hf-mount binaries
curl -fsSL https://raw.githubusercontent.com/huggingface/hf-mount/main/install.sh | sh

# Verify installation
hf-mount --help
```

### 2. Set Environment Variables

```bash
# Required for private repos and Spaces
export HF_TOKEN=your_huggingface_token

# Optional: Configure mount backend
export HF_MOUNT_BACKEND=nfs  # or 'fuse'
```

### 3. Run Tests

```bash
# Test HF-Mount
pnpm tsx scripts/test-hf-mount.ts

# Test daVinci-MagiHuman (dry run)
pnpm tsx scripts/test-davinci-magihuman.ts --dry-run

# Test Narrative Composer (dry run)
pnpm tsx scripts/test-narrative-video.ts --dry-run
```

## HF-Mount Integration

Mount HuggingFace repositories as local filesystems without downloading.

```typescript
import { mountRepo, HfModelLoader } from '@/lib/hf-mount'

// Quick mount
const model = await mountRepo('openai-community/gpt2', '/tmp/gpt2')
const config = JSON.parse(model.readFile('config.json').toString())
await model.unmount()

// Or use the loader class
const loader = new HfModelLoader('SII-GAIR/daVinci-MagiHuman')
await loader.mount()
const config = loader.readConfig('config.json')
const checkpoints = loader.findFiles('.bin')
await loader.unmount()
```

### Mount Buckets (Mutable Storage)

```typescript
import { mountBucket } from '@/lib/hf-mount'

const bucket = await mountBucket('myuser/my-bucket', '/tmp/mydata', {
  hfToken: process.env.HF_TOKEN,
})

// Read checkpoint
const checkpoint = bucket.readFile('checkpoints/model-v2.pt')

// Write log
fs.writeFileSync(path.join(bucket.localPath, 'logs/run.txt'), 'epoch 1')

await bucket.unmount()
```

## daVinci-MagiHuman Video Generation

daVinci-MagiHuman is a 15B parameter single-stream Transformer for joint text-video-audio generation.

### Features
- **Human-centric quality**: Expressive facial performance, natural speech-expression coordination
- **Multilingual**: Chinese (Mandarin & Cantonese), English, Japanese, Korean, German, French
- **Fast inference**: 5-second 256p video in 2 seconds (H100)
- **Single-stream architecture**: Unified processing of text, video, and audio

### Basic Usage

```typescript
import { DaVinciClient, buildEnhancedPrompt } from '@/lib/video-generation/davinci'

const client = new DaVinciClient(process.env.HF_TOKEN)

const result = await client.generate({
  prompt: buildEnhancedPrompt({
    character: 'A young woman with expressive eyes and dark hair',
    action: 'speaking with conviction about the future',
    mood: 'earnest and hopeful',
    camera: 'medium shot, stationary framing',
  }),
  dialogue: [{
    characterDescription: 'Young woman, English',
    language: 'en',
    text: 'This is the moment we choose our path forward.',
  }],
  resolution: '540p',
  duration: 5,
  useDistilled: true,  // 8 steps, faster
}, './output.mp4')

if (result.success) {
  console.log(`Generated: ${result.videoPath}`)
  console.log(`Seed: ${result.metadata.seed}`)
}
```

### Enhanced Prompt Format

daVinci-MagiHuman expects prompts with three parts:

```
{Character description} {Action}. The disposition is {Mood}. {Performance notes}

The cinematography is {Camera style}, maintaining consistent framing throughout the shot.

Dialogue:
<{Character}, {Language}>: "{Spoken line}"

Background Sound:
<{Sound description}>
```

### Scene Analysis

```typescript
const client = new DaVinciClient()

const analysis = client.analyzeScript(`
The office is quiet in the early morning. Dr. Chen sits at her desk.

CLOSE-UP: Her face as she processes the results.

She stands and walks to the window.
`)

console.log(analysis.scenes)
// [
//   { id: 'scene-1', shotType: 'medium', mood: 'calm', ... },
//   { id: 'scene-2', shotType: 'close-up', mood: 'neutral', ... },
//   { id: 'scene-3', shotType: 'medium', mood: 'neutral', ... }
// ]
```

## Narrative Video Composer

OpenStory-inspired system for transforming scripts into styled video productions.

### Features
- **Scene-by-scene breakdown**: Automatic camera angles and mood treatments
- **Style consistency**: Characters, locations, color palettes across scenes
- **Era-aware**: Leverages the narrative engine's temporal eras and motifs
- **Hybrid generation**: daVinci for characters, LTX for environments

### Create from Article

```typescript
import { NarrativeVideoComposer } from '@/lib/narrative-video'

const composer = new NarrativeVideoComposer('./output', process.env.HF_TOKEN)

const project = await composer.createProjectFromArticle(
  'threshold-01-the-last-diagnosis',
  {
    durationPerScene: 5,
    focusScenes: ['opening', 'diagnosis', 'reflection'],
  }
)

console.log(project.segments)
// 5 segments: opening, establishing, midpoint, transition, closing
```

### Compose Video

```typescript
const video = await composer.compose(project)

console.log(video.metadata)
// {
//   totalDuration: 25,
//   totalGenerationTimeMs: 125000,
//   segmentCount: 5,
//   successfulSegments: 5
// }

console.log(video.finalVideoPath)
// ./output/nv-threshold-...-final.mp4
```

### Quick Compose

```typescript
import { composeArticleVideo } from '@/lib/narrative-video'

const video = await composeArticleVideo(
  'threshold-01-the-last-diagnosis',
  './output',
  {
    hfToken: process.env.HF_TOKEN,
    durationPerScene: 5,
  }
)
```

## Era-Based Style Guides

The composer automatically generates style guides from narrative eras:

| Era | Palette | Lighting | Scale |
|-----|---------|----------|-------|
| **Threshold** (2027-28) | Warm amber `#D4A574` | Golden hour, documentary | Intimate |
| **Residue** (2032-34) | Cool slate `#6B7B8D` | Diffused, overcast | Medium |
| **Cartography** (2045-50) | Deep violet `#6B46C1` | Volumetric, bioluminescent | Vast |

### Motif Enrichment

Era-specific visual motifs are automatically woven into prompts:

```typescript
import { getMotifPromptEnrichment } from '@/lib/narrative-video'

const enrichment = getMotifPromptEnrichment('threshold')
// "amber lighting: warm amber sunlight filtering through blinds..."
// "hand imagery: close-up of practiced hands mid-craft..."
// "threshold imagery: framed doorways, split screens..."
```

## Project Structure

```
lib/
├── hf-mount/              # HF-Mount integration
│   ├── mount.ts           # Core mount operations
│   └── index.ts           # Public API
├── video-generation/
│   ├── davinci/           # daVinci-MagiHuman client
│   │   ├── client.ts      # Generation client
│   │   └── index.ts       # Public API
│   ├── hf-client.ts       # Existing LTX client
│   └── ...
├── narrative-video/       # OpenStory-inspired composer
│   ├── composer.ts        # Main composer logic
│   └── index.ts           # Public API
├── narrative-engine.ts    # Existing narrative system
└── narrative-arc.ts       # Temporal eras and motifs

scripts/
├── test-hf-mount.ts       # HF-Mount tests
├── test-davinci-magihuman.ts  # daVinci tests
└── test-narrative-video.ts    # Composer tests
```

## CLI Commands

Add to `package.json`:

```json
{
  "scripts": {
    "test:hf-mount": "tsx scripts/test-hf-mount.ts",
    "test:davinci": "tsx scripts/test-davinci-magihuman.ts",
    "test:narrative": "tsx scripts/test-narrative-video.ts",
    "test:video:all": "npm run test:hf-mount && npm run test:davinci -- --dry-run && npm run test:narrative -- --dry-run"
  }
}
```

## API Reference

### HF-Mount

| Function | Description |
|----------|-------------|
| `mountRepo(repoId, mountPath, config)` | Mount a model/dataset repo |
| `mountBucket(bucketPath, mountPath, config)` | Mount a mutable bucket |
| `unmount(mountPath)` | Unmount a path |
| `HfModelLoader` | Class-based model loader |
| `cleanup()` | Clean all mounts and cache |

### daVinci-MagiHuman

| Function | Description |
|----------|-------------|
| `new DaVinciClient(token)` | Create client |
| `client.generate(request, outputPath)` | Generate video |
| `client.analyzeScript(script)` | Break script into scenes |
| `buildEnhancedPrompt(components)` | Build formatted prompt |

### Narrative Composer

| Function | Description |
|----------|-------------|
| `new NarrativeVideoComposer(outputDir, token)` | Create composer |
| `composer.createProjectFromArticle(slug, options)` | Create project |
| `composer.compose(project)` | Generate final video |
| `composeArticleVideo(slug, outputDir, options)` | Quick compose |
| `eraToStyleGuide(era)` | Convert era to style |
| `getMotifPromptEnrichment(eraKey)` | Get motif prompts |

## Troubleshooting

### HF-Mount Issues

```bash
# Binary not found
export PATH="$HOME/.local/bin:$PATH"

# FUSE not available (use NFS)
mountRepo('gpt2', '/tmp/gpt2', { backend: 'nfs' })

# Permission denied
# Ensure you have a valid HF_TOKEN for private repos
```

### Video Generation Issues

```bash
# Space not accessible
# Ensure your HF_TOKEN has access to SII-GAIR/daVinci-MagiHuman

# Timeout errors
# Increase timeout in client config or use lower resolution

# Out of memory
# Use 256p resolution or distilled model
```

## References

- [HF-Mount](https://github.com/huggingface/hf-mount) - HuggingFace filesystem mounting
- [daVinci-MagiHuman](https://huggingface.co/spaces/SII-GAIR/daVinci-MagiHuman) - Video generation Space
- [daVinci-MagiHuman GitHub](https://github.com/GAIR-NLP/daVinci-MagiHuman) - Model documentation
- [OpenStory](https://github.com/openstory-so/openstory) - Inspiration for narrative composition
