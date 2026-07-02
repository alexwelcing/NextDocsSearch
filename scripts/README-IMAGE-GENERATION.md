# Article Image Generation

Scripts for generating hero images for NextDocsSearch articles using ComfyUI + Flux Dev.

## Status

- **Total Articles**: 257
- **With JPG Images**: 201 ✓
- **SVG Only**: 31 ○
- **No Images**: 25 ✗
- **Need Generation**: 56

## Quick Start

### 1. Start ComfyUI

```bash
cd C:\Users\alexw\Downloads\USE_THIS_COMFY\ComfyUI_windows_portable
run_nvidia_gpu.bat
```

Wait for ComfyUI to fully load (you'll see "ComfyUI finished loading" in the console).

### 2. Check Status

```bash
cd C:\Users\alexw\Downloads\USE_THIS_COMFY\ComfyUI_windows_portable\NextDocsSearch
npx tsx scripts/check-image-status.ts
```

### 3. Preview Generation

See what images would be generated without actually running:

```bash
npx tsx scripts/batch-generate-article-images.ts --preview
```

### 4. Generate Images (Test Run)

Generate first 5 images:

```bash
npx tsx scripts/batch-generate-article-images.ts --limit 5
```

### 5. Generate All Images

Generate all missing images:

```bash
npx tsx scripts/batch-generate-article-images.ts
```

Or generate only SVG-only articles:

```bash
npx tsx scripts/batch-generate-article-images.ts --svg-only
```

## Scripts

### `check-image-status.ts`

Shows current status of article images.

```bash
npx tsx scripts/check-image-status.ts
```

### `batch-generate-article-images.ts`

Main generation script.

**Options:**
- `--preview` - Show what would be generated without running
- `--limit N` - Only process N articles
- `--force` - Regenerate even if image exists
- `--svg-only` - Only process articles with SVG images

**Examples:**

```bash
# Preview mode
npx tsx scripts/batch-generate-article-images.ts --preview

# Generate 10 images
npx tsx scripts/batch-generate-article-images.ts --limit 10

# Regenerate all SVG articles
npx tsx scripts/batch-generate-article-images.ts --svg-only --force
```

## Workflow

The script uses Flux Dev with:
- **Model**: `realDream_fluxDevV4GGUFQ4KM.gguf`
- **Resolution**: 1024x768
- **Steps**: 25
- **CFG**: 7.5
- **Sampler**: dpmpp_2m (karras scheduler)

## Prompt Templates

### Fiction Articles
```
Cinematic science fiction scene: {title}. {keywords}. 
Dramatic lighting, photorealistic concept art, 8k resolution, 
moody atmosphere, futuristic setting, professional digital art, 
trending on ArtStation
```

### Research Articles
```
Technical research visualization: {title}. 
Clean modern design, data visualization aesthetic, 
blue gradient background, professional tech illustration, 
abstract conceptual art, minimalist composition
```

### Default
```
Abstract conceptual illustration: {title}. {description}. 
Modern digital art style, professional quality, 
clean composition, visual metaphor
```

## Output

- Images saved to: `ComfyUI/output/`
- Manifest updated: `lib/generated/image-manifest.json`
- Hero images path: `/images/articles/{slug}.jpg`

## Articles Needing Images

### Fiction Series

**Cartography** (5 parts)
- cartography-01-the-unnamed-continent
- cartography-02-the-isthmus-of-intent
- cartography-03-the-depth-soundings
- cartography-04-the-tidal-zone
- cartography-05-the-atlas-of-disappearances

**Residue** (5 parts)
- residue-01-the-last-prompt-engineer
- residue-02-the-training-data-ghosts
- residue-03-the-deprecated-caretaker
- residue-04-the-analog-holdouts
- residue-05-the-compatibility-museum

**Threshold** (5 parts)
- threshold-01-the-last-diagnosis
- threshold-02-the-closing-window
- threshold-03-the-weight-of-the-hammer
- threshold-04-the-student-who-stopped-asking
- threshold-05-the-beautiful-redundancy

**Interface** (24 parts - no images)
- interface-01-the-first-translator
- interface-02-haptic-vernacular
- interface-03-the-ceramicist-and-the-kiln
- ... (see check-image-status.ts output)

### Research Articles
- medical-nanobot-protocol-failure-2054
- crispr-gene-drive-cascade-2052
- thoughtcrime-enforcement-system-2041
- biometric-lockin-syndrome-2033
- synthetic-blood-contamination-2032
- nanomedicine-grey-goo-2031
- neural-implant-rejection-2030
- lab-ai-refused-to-stop-2034
- leveraging-ai-empowering-people-through-advanced-technology
- nih-brain-initiative-data-standard
- benchmark-to-business-metric
- safe-llm-launch-runbook
- speculative-incarceration

## Troubleshooting

### ComfyUI not responding
- Ensure `run_nvidia_gpu.bat` is running
- Check http://localhost:8188 in browser
- Look for errors in ComfyUI console

### Out of memory
- Reduce `--limit` to process fewer images at once
- Wait between batches for GPU to cool down

### Missing models
The script uses:
- `models/unet/realDream_fluxDevV4GGUFQ4KM.gguf`
- `models/text_encoders/fluxTextencoderT5XxlFp8_v10.safetensors`
- `models/vae/ae.safetensors`

If missing, download via ComfyUI Manager or manually.
