# LTX Video Generation via HuggingFace Gradio Space

Use this skill when generating videos for articles using the LTX-Video model on HuggingFace, troubleshooting video generation failures, or extending the video pipeline.

## Overview

The project has a complete I2V (image-to-video) pipeline that generates cinematic videos from article images using HuggingFace Gradio Spaces (Lightricks LTX-Video). Supports two Space backends: `ltx-2-distilled` (preferred, simpler 8-param API) and the original `ltx-video-distilled` (13-param API). Videos are stored locally and optionally uploaded to Supabase.

## Key Files

| File | Purpose |
|------|---------|
| `lib/video-generation/hf-client.ts` | Core HF Gradio client with proxy support, upload/register, retry logic |
| `lib/video-generation/parameters.ts` | LTX parameter building and validation |
| `lib/video-generation/types.ts` | TypeScript types (`LtxParameters`, `LtxMode`, etc.) |
| `lib/video-generation/prompt-templates.ts` | Prompt templates per clip role with text-free constraints |
| `lib/video-generation/scene-planner.ts` | Scene planning, hook/close scoring, clip pattern mapping |
| `scripts/generate-interface-videos-hf.ts` | Batch generation script for Interface series |
| `public/images/multi-art/{slug}/` | Source images (I2V anchors) |
| `public/images/article-videos/` | Generated video output directory |
| `public/images/concepts/interface-series-prompts.json` | Motion prompts per article |

## Running the Generator

### Unified Series Video Generator (all series)

```bash
# Generate videos for a specific series
pnpm generate:series-videos -- --series threshold
pnpm generate:series-videos -- --series residue
pnpm generate:series-videos -- --series cartography

# Generate for all series
pnpm generate:series-videos -- --all

# Dry run (preview without generating)
pnpm generate:series-videos:dry-run

# Text-to-video only (no source images needed)
pnpm generate:series-videos:t2v

# Single article
pnpm generate:series-videos -- --article threshold-01-the-last-diagnosis

# Limit + force
pnpm generate:series-videos -- --all --limit 3 --force
```

### Series Image Generator (FAL Flux — creates I2V source images)

```bash
# Generate source images for a series (required before I2V video generation)
pnpm generate:series-images -- --series threshold
pnpm generate:series-images -- --all --option 2  # quality images only
pnpm generate:series-images:missing               # only generate missing images
pnpm generate:series-images:dry-run                # preview
```

### Legacy Interface-only Generator

```bash
# Generate all Interface series videos (original script)
pnpm tsx scripts/generate-interface-videos-hf.ts

# Dry run (no actual generation)
pnpm tsx scripts/generate-interface-videos-hf.ts --dry-run

# Single article
pnpm tsx scripts/generate-interface-videos-hf.ts --article interface-01-the-first-translator

# Limit count
pnpm tsx scripts/generate-interface-videos-hf.ts --limit 5

# Force regeneration (skip existing check)
pnpm tsx scripts/generate-interface-videos-hf.ts --force
```

### Full Pipeline (images → videos)

```bash
# Step 1: Generate source images (option 2 = quality, for I2V anchors)
pnpm generate:series-images -- --series threshold --option 2

# Step 2: Generate videos from those images
pnpm generate:series-videos -- --series threshold

# Or skip images and go straight to T2V
pnpm generate:series-videos -- --series threshold --t2v-only
```

## Required Environment Variables

- `HF_TOKEN` — HuggingFace API token (required unless `--dry-run`)
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — For Supabase upload (optional)
- `HTTP_PROXY` / `HTTPS_PROXY` — Proxy URL if behind a proxy (auto-detected)
- `DEBUG_HF=1` — Enable debug logging of Gradio payloads and SSE responses
- `HF_SPACE_BACKEND=ltx2|original` — Which HF Space to use (default: `ltx2`)
- `FAL_KEY` — FAL AI API key (for image generation via `generate-series-images.ts`)

Must be set in `.env.local` (loaded via `dotenv.config({ path: '.env.local' })`).

## Generation Parameters

- **Resolution**: 768x512 (3:2, fast iteration) or 1024x576 (16:9 widescreen)
- **Duration**: 6 seconds default (145 frames at 24fps), max 10 seconds (257 frames)
- **Mode**: I2V (image-to-video) preferred, T2V fallback
- **Style suffix**: `cinematic slow camera drift, shallow depth of field, volumetric haze, subtle particle movement, 35mm film grain`
- **improve_texture**: `true` (Space default; was `false` in earlier builds but the Space now defaults to `true`)
- **CFG**: 1.0 (Space default for distilled model; use 3.0–3.5 for non-distilled)
- **Steps**: 30–40 recommended (20 is fast but lacks texture)
- **FPS**: 24fps (aligns with model's native training)

## Prompting Best Practices

LTX-2.3 behaves like a virtual camera crew, not a keyword blender. The model's 4x-larger gated attention text connector means prompts are followed more faithfully than earlier versions — complex spatial relationships, timing, and stylistic instructions now resolve accurately.

### Core Principle

> If a real camera operator could execute your description without asking follow-up questions, LTX-2.3 usually behaves. If the shot would be impossible, contradictory, or vague, the model compensates by inventing motion, morphing objects, or drifting identity.

### Prompt Structure

Write each prompt as a **single cohesive paragraph** in **present tense** with 4–8 sentences. Follow this ordering:

1. **Subject + action** — who/what is doing something, using concrete verbs (not vibes)
2. **Environment** — location, time of day, weather, atmosphere
3. **Camera + lens** — one primary movement per shot, with focal length and aperture
4. **Lighting + style** — key light direction, contrast, color science (e.g., Kodak Portra, chiaroscuro)
5. **Motion + time cues** — speed, shutter feel, gradual changes
6. **Text exclusion** — always end with explicit no-text instruction

### Avoiding Text in Generated Video (CRITICAL)

Readable text generation is unreliable in LTX-2.3. Text artifacts degrade video quality and look unprofessional. Apply ALL of the following layers:

1. **Positive prompt**: Always include `"No readable text, no titles, no captions, no logos, no watermarks, no signs, no labels"` at the end of every prompt
2. **Negative prompt**: Always include `text, watermark, logo, title, caption, subtitle, label, sign, lettering, typography, words, numbers, writing` in the negative prompt
3. **Scene composition**: Avoid prompting for scenes that naturally contain text (screens with UI, book covers, street signs, billboards, storefronts, newspapers, whiteboards). Instead, describe the scene at an angle or distance where text would not be legible, or replace text-bearing objects with abstract equivalents
4. **I2V source images**: If the source image contains text, crop or blur the text regions before using as an I2V anchor. Text in the source image will persist and distort in the generated video
5. **Abstract over literal**: Prefer abstract visual metaphors over literal depictions. Instead of "a dashboard showing metrics," use "glowing data streams converging into a luminous nexus"

### Camera Language That Works

Use explicit cinematography terms — one primary movement per shot:

| Movement | When to Use |
|----------|-------------|
| `slow dolly in/out` | Reveals, intimacy, escalation |
| `slow orbit` | Examining a subject from all sides |
| `truck left/right` | Following lateral motion |
| `crane up/down` | Scale reveals, establishing shots |
| `tripod-locked static` | Stability, contemplation |
| `handheld micro-shake` | Tension, urgency, documentary feel |
| `rack focus` | Shifting attention between planes |
| `slow pan` | Surveying an environment |

Pair with lens language: `35mm` (neutral), `50mm f/1.4` (intimate), `85mm` (portraits, compression), `macro` (detail shots).

### Stability Anchors

Include at least one stability phrase per prompt to prevent temporal jitter:

- `"180-degree shutter, natural motion blur"` — reduces shimmer ~18%
- `"tripod-locked"` or `"stabilized footage"` — explicit stability cue
- `"slow smooth motion"` — prevents erratic movement
- `"live action, raw footage, high fidelity"` — realism anchoring
- Explicit lens + aperture reduces edge shimmer ~18% on average

### What to Avoid in Prompts

- **Tag lists / keyword salad** — LTX-2.3 resists this; use flowing sentences instead
- **Abstract emotional labels** — say `"tears well in her eyes, jaw tightens"` not `"she looks sad"`
- **Complex physics** — chaotic multi-body motion causes artifacts
- **Multiple camera movements** — one primary movement per shot
- **Conflicting lighting** — don't combine incompatible light sources
- **High-frequency patterns** — moiré and shimmer; use `"no high-frequency patterns"` in negative prompt for architecture
- **CFG above 4.0** — causes contrast burn and temporal flicker

### Negative Prompt Standard

Use this as the baseline negative prompt for all generations:

```
worst quality, inconsistent motion, blurry, jittery, distorted, morphing, warping, flicker, stutter, temporal artifacts, frame blending, text, watermark, logo, title, caption, subtitle, label, sign, lettering, words, numbers
```

Extend sparingly for specific needs (e.g., add `deformed hands, extra fingers` for human subjects). Precision beats paranoia — massive negative lists can conflict.

## Building Longer Videos: Multi-Clip Narrative Strategy

LTX-2.3 generates individual clips of up to 10 seconds. Longer narratives require planning at the scene level and stitching clips together with consistent visual identity.

### Clip Duration Strategy

| Clip Role | Duration | Rationale |
|-----------|----------|-----------|
| Hook | 4–6s | Grab attention fast, single dramatic moment |
| Body clips | 6–8s | Room for camera movement + action to develop |
| Transitions | 3–4s | Quick bridge between sections |
| Closing/CTA | 6–8s | Lingering, reflective, room for overlay captions |

### Narrative Continuity Across Clips

To maintain visual coherence when stringing clips into a long-form video:

1. **Lock the visual vocabulary** — choose a color palette, lighting style, and environment family before generating. Reuse the same style phrases across all clips (e.g., `"cool blue ambient light, Kodak Portra color science, volumetric haze"`)
2. **Anchor to I2V** — use I2V mode wherever possible. A shared source image (or images from the same visual series) acts as a visual identity anchor across clips
3. **Consistent camera philosophy** — pick 2–3 camera movements for the entire video and rotate between them. Mixing too many styles breaks cohesion
4. **Seed continuity** — when a clip looks good, note the seed and reuse it (or nearby seeds) for related clips to maintain similar visual treatment
5. **Transitional overlap** — end each clip with a relatively static moment (slow pull-back, settling motion) so the cut to the next clip feels natural rather than jarring
6. **Progressive intensity** — structure the narrative arc through camera and motion choices: start slow/wide, build to tighter/faster in the middle, resolve back to slow/wide

### Long-Form Narrative Arc Template

For a 60–90 second narrative video spanning near and far futures:

```
PHASE 1 — PRESENT GROUND (clips 1–2, ~12s)
  Establish the current state. Slow, grounded camera. Warm lighting.
  Hook the viewer with a concrete, recognizable scenario.

PHASE 2 — NEAR FUTURE TENSION (clips 3–5, ~20s)
  Escalate. Introduce change, risk, or opportunity.
  Camera tightens, pace increases slightly.
  Shift color temperature toward cooler tones.

PHASE 3 — TRANSFORMATION (clips 6–7, ~14s)
  The pivot point. Dramatic lighting shift.
  Fastest camera movement, tightest framing.
  Visual metaphor for the core insight.

PHASE 4 — FAR FUTURE VISION (clips 8–10, ~24s)
  Expansive, speculative, aspirational.
  Wide shots, slow orbits, luminous environments.
  Cool-to-warm color gradient as hope emerges.

PHASE 5 — RESOLUTION (clips 11–12, ~16s)
  Return to grounded framing. Calm, reflective.
  Minimal motion. Space for overlay text/captions.
  Echo the opening visual to create narrative closure.
```

### Stringing Clips Together

When building the final video from generated clips:

1. **Cut on motion** — transition between clips during camera movement, not during static holds
2. **Match action** — if clip A ends with a push-in, clip B can start with a complementary pull-back
3. **Color grade consistently** — apply a unified color grade in post to smooth differences between clips
4. **Audio continuity** — a continuous ambient soundtrack or voiceover bridges visual cuts
5. **Caption layer** — add text overlays in post-production, never in the generated video itself

### Guiding Both Text and Video Direction

When an article spans near-to-far futures, use the article structure to drive both the written narrative and the video direction simultaneously:

| Article Section | Video Treatment | Camera/Motion |
|----------------|-----------------|---------------|
| Current state / problem | Documentary realism, warm tones | Handheld or tripod, eye-level |
| Near-future implications | Heightened reality, contrast increases | Slow dolly, tighter framing |
| Turning point / insight | Dramatic metaphor, lighting shift | Rack focus, crane reveal |
| Far-future speculation | Abstract/aspirational, luminous | Slow orbit, wide/overhead |
| Conclusion / call to action | Calm return, open composition | Slow pull-back, static hold |

## Architecture: How the Gradio Client Works

### Proxy-Aware Fetch

Node.js native `fetch` (undici) does NOT respect `HTTP_PROXY`/`HTTPS_PROXY` env vars. The client creates a `proxyFetch` using `undici.ProxyAgent` when proxy env vars are set. **Always use `proxyFetch`** for all HTTP calls to HF.

### Two-Step Image Upload (Critical for I2V)

Multi-replica HF Spaces route requests to different replicas. A file uploaded to replica A may not be visible to replica B. The fix is a two-step process:

1. **Upload** via `POST /gradio_api/upload` — returns a remote file path
2. **Register** via `POST /gradio_api/call/handle_image_upload_for_dims` — "pins" the file so it's accessible to the processing replica, and returns recommended dimensions

Both steps are implemented in `uploadAndRegisterImage()`.

### MIME Type Detection

Source images in `public/images/multi-art/` are often JPEG files with `.png` extensions. The client uses magic byte detection (not file extension) to determine the correct MIME type for upload:
- `0xFF 0xD8` = JPEG
- `0x89 0x50` = PNG

### Gradio API Flow

1. **Submit**: `POST /gradio_api/call/{endpoint}` with `{data: [...params]}` — returns `{event_id}`
2. **Poll**: `GET /gradio_api/call/{endpoint}/{event_id}` — returns SSE stream
3. **Parse**: Extract `event: complete` + `data: [video_file_data, seed]`
4. **Download**: Fetch video from returned URL with auth header

**Important**: Do NOT include `session_hash` in the payload — it causes Gradio to route the SSE result poll to a different replica than where the job ran.

### Retry Logic

- 3 retries with exponential backoff (5s, 10s, 20s)
- Retryable errors: network failures, 502/503/504, queue full, 404 (replica routing), null errors
- After I2V exhausts retries with 404/null errors, automatically falls back to T2V mode

## Common Issues and Fixes

### "fetch failed" / Network Errors
**Cause**: Behind a proxy and Node.js native fetch doesn't use it.
**Fix**: Ensure `HTTP_PROXY`/`HTTPS_PROXY` is set. The client auto-detects and uses `undici.ProxyAgent`.

### "Gradio error: null" / Base64 Encoding Failures
**Cause**: Source image is JPEG with `.png` extension; Gradio tries to decode as PNG and fails.
**Fix**: Already handled by `detectMimeType()` which reads magic bytes, not extension.

### "404: Not Found" on Generation
**Cause**: Multi-replica routing — uploaded file on replica A, processing on replica B.
**Fix**: Already handled by the two-step `uploadAndRegisterImage()`. If it persists, re-run the script (it skips already-completed videos).

### "Invalid parameters: Image URL is required"
**Cause**: Using `imagePath` but validation only checked `imageUrl`.
**Fix**: `validateLtxParameters` accepts both `imageUrl` and `imagePath` for I2V mode.

### Downloads Fail but Generation Succeeds
**Cause**: Video URL points to a replica that no longer has the file.
**Fix**: Re-run the script — it detects missing/small local files and retries. The `--force` flag regenerates everything.

### Text/Logos Appearing in Generated Video
**Cause**: Source image contains text, prompt describes text-bearing objects, or negative prompt is missing text suppression.
**Fix**: (1) Add text suppression to both positive and negative prompts (see Prompting Best Practices above). (2) Crop/blur text from I2V source images. (3) Replace literal text-bearing scene descriptions with abstract visual metaphors.

## Extending to New Article Collections

To generate videos for a new article collection:

1. Create a `{series-name}-series-prompts.json` in `public/images/concepts/` with the standard schema (see existing files for reference)
2. Register the series in `ARTICLE_COLLECTIONS` in `lib/featured-articles.ts`
3. Add a `SeriesRegistration` entry in `scripts/generate-series-videos.ts` `SERIES_REGISTRY`
4. Add the series prompts file to `SERIES_FILES` in `scripts/generate-series-images.ts`
5. Run `pnpm generate:series-images:dry-run` to verify prompts load correctly
6. Generate source images: `pnpm generate:series-images -- --series <name> --option 2`
7. Generate videos: `pnpm generate:series-videos -- --series <name>`

### Narrative Architecture

Cross-series connections are defined in `lib/narrative-arc.ts`:
- `TEMPORAL_ERAS` — era definitions with visual identity, emotional arc, year range
- `THEMATIC_BRIDGES` — specific article-to-article connections across eras
- `RECURRING_MOTIFS` — visual/thematic threads that transform across all three eras
- `READING_PATHS` — curated paths through the 15 articles (chronological, thematic, etc.)
- Utility functions for cross-series recommendations and visual transitions

## Using the Client Programmatically

```typescript
import { generateVideoViaHf } from '@/lib/video-generation/hf-client'

const result = await generateVideoViaHf(
  {
    prompt:
      'A luminous data stream flows through a crystalline corridor, particles of light converging into a pulsing nexus at the center. Camera: slow dolly in, 50mm f/1.4, shallow depth of field. Cool blue ambient light with warm amber highlights. 180-degree shutter, natural motion blur. No readable text, no logos, no signs, no labels.',
    mode: 'I2V',
    imagePath: '/path/to/source-image.png',
    negativePrompt:
      'worst quality, inconsistent motion, blurry, jittery, distorted, morphing, warping, flicker, text, watermark, logo, title, caption, sign, lettering, words, numbers',
    durationS: 6,
    width: 768,
    height: 512,
  },
  process.env.HF_TOKEN!,
  '/path/to/output.mp4'
)

if (result.success) {
  console.log(`Video: ${result.videoUrl}, ${result.frames} frames in ${result.generationTimeMs}ms`)
}
```
