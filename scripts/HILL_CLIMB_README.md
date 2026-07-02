# Hill Climbing Image Generation System

A self-improving, workflow-parameter-optimization system for ComfyUI image generation.

## Overview

This system implements a **hill climbing algorithm** to iteratively improve image generation quality by adjusting **all workflow parameters** (not just prompts):

- **5 iterations** × **10 images** = **50 total images**
- Each iteration learns from the previous
- Adjusts: sampler settings, model selection, VAE, dimensions, seed strategies
- Produces an optimal configuration for production use

## Key Features

### Full Workflow Control
Unlike simple prompt optimizers, this system controls:
- **Model settings**: UNET model, weight dtype, VAE, CLIP
- **Sampler parameters**: Steps, CFG, sampler type, scheduler, denoise
- **Image dimensions**: Width/height variations
- **Seed strategies**: Random, incremental, fixed

### Self-Improving Loop
1. **Iteration 1**: Random parameter exploration (baseline)
2. **Iteration 2**: Mutation from best of iteration 1
3. **Iteration 3**: Further refinement based on learnings
4. **Iteration 4**: Convergence toward optimal settings
5. **Iteration 5**: Final validation of best configuration

### Quality Evaluation
Each image is evaluated on:
- Perceived quality score (1-10)
- Text detection (ensuring no text in images)
- Artifact detection
- Composition score
- Color harmony

### Article-Specific Prompts
The system uses tailored prompts for each article in "THE REACHING" anthology:
- Backstory Shadows series
- Threshold series
- Fracture Line series
- Interregnum series
- First Cartographers series
- Far Shore series

## Files Created

### Main Scripts

| Script | Purpose |
|--------|---------|
| `hill-climb-image-generation.ts` | Main hill climbing loop (5 iterations × 10 images) |
| `hill-climb-advanced-workflows.ts` | Advanced workflow configurations with ControlNet, upscaling, LoRA |
| `analyze-hill-climb-results.ts` | Analyzes results and generates optimal config |
| `preview-hill-climb.ts` | Preview mode (shows what would be generated) |
| `run-hill-climb-batch.bat` | Windows batch runner |

### Output Files

| File | Location | Description |
|------|----------|-------------|
| Generated images | `ComfyUI/output/hillclimb_*.png` | 50 images from hill climbing |
| State file | `hill-climb-output/hill-climb-state.json` | Full state for resuming |
| Log file | `hill-climb-output/hill-climb.log` | Detailed generation log |
| Analysis report | `hill-climb-output/analysis-report.md` | Parameter correlation analysis |
| Optimal config | `hill-climb-output/optimal-config.json` | Production-ready settings |

## Usage

### Prerequisites

1. ComfyUI running on `http://127.0.0.1:8188`
2. Required models installed:
   - `z_image_bf16.safetensors` (UNET)
   - `zImage_vae.safetensors` (VAE)
   - `qwen_3_4b.safetensors` (CLIP)

### Running

#### Option 1: Preview Mode (No Generation)
```bash
npx tsx scripts/preview-hill-climb.ts
```
Shows what parameters and articles will be used.

#### Option 2: Run Hill Climbing
```bash
npx tsx scripts/hill-climb-image-generation.ts
```
Runs the full 5-iteration, 50-image hill climbing process.

#### Option 3: Windows Batch File
```bash
scripts\run-hill-climb-batch.bat
```
Complete solution with connection checking and analysis.

#### Option 4: Resume From Iteration
```bash
npx tsx scripts/hill-climb-image-generation.ts --start-from 3
```
Resumes from iteration 3 (if previous state exists).

### Analysis

After generation completes, run analysis:
```bash
npx tsx scripts/analyze-hill-climb-results.ts
```

This generates:
- Parameter correlation analysis
- Quality distribution report
- Optimal configuration export
- Markdown report with recommendations

## Parameter Space Explored

### Model Settings
| Parameter | Values Tested |
|-----------|---------------|
| UNET | `z_image_bf16.safetensors` |
| Weight dtype | `default`, `fp8_e4m3fn`, `bf16` |
| VAE | `zImage_vae.safetensors` |
| CLIP | `qwen_3_4b.safetensors` |

### Sampler Settings
| Parameter | Values Tested |
|-----------|---------------|
| Steps | 20, 25, 30, 35, 40 |
| CFG | 3.5, 4.0, 4.5, 5.0, 5.5, 6.0 |
| Sampler | `euler`, `euler_ancestral`, `dpmpp_2m`, `uni_pc` |
| Scheduler | `simple`, `karras`, `exponential`, `normal` |
| Denoise | 0.9, 0.95, 1.0 |

### Image Dimensions
| Width | Height |
|-------|--------|
| 896 | 768, 1024, 1152 |
| 1024 | 768, 1024, 1152, 1216 |
| 1152 | 896, 1024, 1152 |
| 1216 | 832, 1024 |

## Expected Runtime

Each image takes approximately 30-90 seconds depending on:
- Step count (higher = slower)
- GPU VRAM and speed
- Model quantization (fp8 is faster)

**Estimated total time: 45-120 minutes** for all 50 images.

## Output Structure

### Images
```
ComfyUI/output/
├── hillclimb_iter1_img1_backstory-shadows-01-the-test-subjects-garden.png
├── hillclimb_iter1_img2_backstory-shadows-02-the-coders-confession.png
├── hillclimb_iter2_img1_threshold-01-the-last-diagnosis.png
├── ... (50 total images)
```

### State File
The `hill-climb-state.json` tracks:
- Current iteration
- All generation results with quality scores
- Best variant per iteration
- Cumulative learnings

### Analysis Report
The `analysis-report.md` includes:
- Summary statistics
- Quality distribution
- Parameter correlation analysis
- Recommendations for optimal settings
- Exportable configuration

## Extending the System

### Adding Advanced Workflows
Edit `hill-climb-advanced-workflows.ts` to add:
- ControlNet (depth, canny, openpose)
- Upscaling workflows
- LoRA stacking
- IPAdapter for style transfer

### Custom Evaluation
Modify `evaluateImage()` in `hill-climb-image-generation.ts` to add:
- CLIP-based aesthetic scoring
- OCR for text detection
- Custom quality metrics
- Human-in-the-loop feedback

### Different Model Support
Add to `PARAMETER_SPACE`:
```typescript
unetName: [
  'z_image_bf16.safetensors',
  'flux1-dev.safetensors',
  'sdxl-base.safetensors'
]
```

## Troubleshooting

### ComfyUI Not Connected
```
✗ ComfyUI not available. Please start with: .\..\run_nvidia_gpu.bat
```
**Solution**: Start ComfyUI before running the script.

### Model Not Found
```
Failed to queue workflow: Model not found
```
**Solution**: Ensure models are in the correct ComfyUI directories.

### Out of Memory
```
CUDA out of memory
```
**Solution**: Reduce batch size or use fp8 quantization.

### Resuming After Crash
```bash
npx tsx scripts/hill-climb-image-generation.ts --start-from N
```
Where `N` is the iteration to resume from.

## Integration with Production

After hill climbing completes, use the optimal config:

```typescript
import optimalConfig from './hill-climb-output/optimal-config.json';

// Use optimal settings for production generation
const workflow = buildWorkflow({
  ...optimalConfig.parameters,
  prompt: 'Your production prompt'
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Hill Climbing System                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Iteration  │───▶│   Generate   │───▶│   Evaluate   │  │
│  │   Manager    │    │    Batch     │    │   Quality    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                   │          │
│         │                   ▼                   │          │
│         │            ┌──────────────┐          │          │
│         │            │   ComfyUI    │          │          │
│         │            │   Workflow   │          │          │
│         │            └──────────────┘          │          │
│         │                                      │          │
│         ▼                                      ▼          │
│  ┌──────────────┐                       ┌──────────────┐  │
│  │   Mutation   │◀──────────────────────│   Select     │  │
│  │   Engine     │                       │   Best       │  │
│  └──────────────┘                       └──────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## License

Part of the NextDocsSearch project.
