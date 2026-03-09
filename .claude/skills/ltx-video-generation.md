# LTX Video Generation via HuggingFace Gradio Space

Use this skill when generating videos for articles using the LTX-Video model on HuggingFace, troubleshooting video generation failures, or extending the video pipeline.

## Overview

The project has a complete I2V (image-to-video) pipeline that generates cinematic videos from article images using the Lightricks/ltx-video-distilled HuggingFace Space. Videos are stored locally and optionally uploaded to Supabase.

## Key Files

| File | Purpose |
|------|---------|
| `lib/video-generation/hf-client.ts` | Core HF Gradio client with proxy support, upload/register, retry logic |
| `lib/video-generation/parameters.ts` | LTX parameter building and validation |
| `lib/video-generation/types.ts` | TypeScript types (`LtxParameters`, `LtxMode`, etc.) |
| `scripts/generate-interface-videos-hf.ts` | Batch generation script for Interface series |
| `public/images/multi-art/{slug}/` | Source images (I2V anchors) |
| `public/images/article-videos/` | Generated video output directory |
| `public/images/concepts/interface-series-prompts.json` | Motion prompts per article |

## Running the Generator

```bash
# Generate all Interface series videos
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

## Required Environment Variables

- `HF_TOKEN` — HuggingFace API token (required unless `--dry-run`)
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — For Supabase upload (optional)
- `HTTP_PROXY` / `HTTPS_PROXY` — Proxy URL if behind a proxy (auto-detected)
- `DEBUG_HF=1` — Enable debug logging of Gradio payloads and SSE responses

Must be set in `.env.local` (loaded via `dotenv.config({ path: '.env.local' })`).

## Generation Parameters

- **Resolution**: 768x448 (16:9, matches source images)
- **Duration**: 4 seconds (97 frames at 24fps)
- **Mode**: I2V (image-to-video) preferred, T2V fallback
- **Style suffix**: `cinematic slow camera drift, shallow depth of field, volumetric haze, subtle particle movement, 35mm film grain, no text overlays`
- **improve_texture**: `false` (more reliable on ZeroGPU)

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

## Extending to New Article Collections

To generate videos for a different article collection:

1. Add source images to `public/images/multi-art/{slug}/` (option-2-dev.png preferred)
2. Add prompts to `interface-series-prompts.json` or create a new prompts file
3. Update the script to read from the new collection in `ARTICLE_COLLECTIONS`
4. Run with `--dry-run` first to verify source images and prompts are found

## Using the Client Programmatically

```typescript
import { generateVideoViaHf } from '@/lib/video-generation/hf-client'

const result = await generateVideoViaHf(
  {
    prompt: 'A cinematic scene with slow camera drift...',
    mode: 'I2V',
    imagePath: '/path/to/source-image.png',
    durationS: 4,
    width: 768,
    height: 448,
    negativePrompt: 'worst quality, blurry, jittery, distorted',
  },
  process.env.HF_TOKEN!,
  '/path/to/output.mp4'
)

if (result.success) {
  console.log(`Video: ${result.videoUrl}, ${result.frames} frames in ${result.generationTimeMs}ms`)
}
```
