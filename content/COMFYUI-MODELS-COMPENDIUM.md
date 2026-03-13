# COMFYUI & AI MODELS COMPENDIUM

## A Production Reference for *THE REACHING*

> **Last updated**: March 2026
> **Purpose**: Actionable reference for the creative team — what models to use, where to find them, how to configure them, and what's actually working right now in the community.

---

## I. COMFYUI — CURRENT STATE OF THE ART

### The Platform (March 2026)

ComfyUI has become the universal interface for AI image and video generation. Version **0.17.0** (released March 13, 2026; Desktop v0.8.18 bundles core v0.16.4). It is a node-based visual programming environment for diffusion models — every operation is a node, every pipeline is a graph, everything is composable.

**v0.17.0 highlights:** Flux 2 Klein KV cache support, modular asset architecture with async scanner, enhanced VRAM handling, LTX-2.3 day-0 support, ElevenLabs integration, Kling 3.0 Motion Control. Recommended PyTorch: torch 2.9.1+cu130.

**Why ComfyUI over alternatives:**
- **Forge UI** is simpler but less flexible — good for one-off generations, not for production pipelines
- **A1111** (Automatic1111) is legacy — still works, but the ecosystem has moved on
- **ComfyUI** wins for: reproducible workflows, complex multi-model pipelines, video generation, batch processing, and the ability to chain LoRAs + ControlNet + IPAdapter + upscaling in a single graph

### ComfyUI-Manager V2

The package manager for ComfyUI. Allows you to search and install custom nodes and models directly from the interface with automatic dependency resolution. No more manual file juggling.

**Install it first. Everything else depends on it.**

### Where to Find Workflows

| Source | URL | What's There |
|--------|-----|-------------|
| **CivitAI** | civitai.com | Largest repository of models, LoRAs, and workflows. Filter by model type, base model, and use case. |
| **ComfyUI Workflow Library** | Built into ComfyUI | Template Library → Search. Official and community workflows. |
| **OpenArt** | openart.ai/workflows | Community workflow sharing with previews. |
| **HuggingFace** | huggingface.co | Official model weights, especially for video models. |
| **GitHub** | Various repos | Custom node repositories with example workflows. |

---

## II. IMAGE GENERATION MODELS — THE LANDSCAPE

### Base Model Architectures (Ranked by Current Relevance)

#### 1. FLUX.2 (Black Forest Labs) — THE NEW STANDARD

Released November 2025 by the original creators of Stable Diffusion. This is now the frontier.

**Architecture:** 32-billion parameter latent flow matching transformer coupled with a Mistral-3 24B vision-language model. Uses flow matching (straight-line paths between noise and clean images) rather than iterative denoising.

**Variants:**

| Variant | Parameters | Access | Use Case |
|---------|-----------|--------|----------|
| **FLUX.2 [Pro]** | 32B | API only | Best quality. Commercial production. |
| **FLUX.2 [Flex]** | 32B | API | Tunable speed/quality trade-off. Preview → render pipeline. |
| **FLUX.2 [Dev]** | 32B | Open weights | Our primary model. Full pipeline control in ComfyUI. |
| **FLUX.2 [Klein]** | 9B | Open weights | Real-time generation. Under 1 second. Good for iteration. |

**Key capabilities for THE REACHING:**
- **Multi-reference support**: Up to 10 reference images simultaneously — ideal for character consistency across ages
- **Text rendering**: Legible typography in generated images — useful for title cards and in-world text
- **Image editing**: Edit existing images at up to 4 megapixels while preserving detail
- **Hex color precision**: Specify exact brand colors — useful for our era-specific palettes
- **Natural language prompting**: Describe what you want in plain English, not tag soup

**Hardware:** 90GB VRAM unquantized. With FP8 quantization + NVIDIA RTX optimizations: ~54GB VRAM, 40% faster. **Realistic minimum: 24GB VRAM with FP8 + offloading.**

**ComfyUI integration:** Native support. Use the Flux loader nodes built into ComfyUI core.

#### 2. FLUX.1 Kontext — CHARACTER CONSISTENCY POWERHOUSE

A 12-billion parameter model specifically designed for in-context image generation. This is our secret weapon for character consistency.

**What Kontext does differently:**
- Takes a reference image + text prompt → generates a new image that preserves the identity from the reference
- Works without LoRA training — zero-shot character consistency
- Excellent for: aging a character (reference at age 34 → generate at age 63), changing outfits, changing environments while keeping identity

**Key CivitAI resources for Kontext:**
- **Kontext Character Creator workflow** — maintains full consistency in facial features, hair, clothes, accessories. Creates character turnaround sheets (front, 3/4, side, back) for LoRA training datasets.
- **RefControl Flux Kontext LoRA** — reference pose preservation. Weight 0.8–1.0. Preserves identity across poses.
- **Flux-Kontext + Wan 2.2 Character LoRA Training workflow** — automates dataset creation for LoRA training while maintaining visual consistency. Updated February 2026.

**Pipeline for THE REACHING:** Use Kontext to generate the initial character reference sheets (all angles, all ages) → use those as training data for dedicated character LoRAs → use the LoRAs for bulk generation.

#### 3. SDXL — STILL THE WORKHORSE

Stable Diffusion XL. Native 1024×1024. The largest ecosystem of community models and LoRAs. Not the best at anything anymore, but the most reliable and well-understood.

**Still use SDXL for:**
- Era-specific style LoRAs (the community has more SDXL LoRAs than any other architecture)
- Situations where VRAM is limited (8GB minimum)
- Workflows that rely on ControlNet (SDXL ControlNet models are the most mature)

**Top SDXL checkpoints on CivitAI:**
- **Juggernaut XL** — photorealistic all-rounder, most recommended for general use
- **RealVisXL** — hyperrealistic faces and environments
- **DreamShaper XL** — artistic/painterly, good for the Understory and Interregnum eras

#### 4. SD 3.5 (Stability AI)

Uses MMDiT (Multi-Modal Diffusion Transformer) architecture. Better text rendering and prompt adherence than SDXL. But the community ecosystem is thin — fewer LoRAs, fewer fine-tunes.

**Use for:** Text-heavy compositions, infographics, in-world documents. Skip for character work.

### Top Photorealistic Flux Checkpoints on CivitAI (March 2026)

These are fine-tuned Flux checkpoints — start with these before training custom LoRAs:

| Model | Strengths | Notes |
|-------|-----------|-------|
| **UltraReal Fine-Tune v4** | Sweet spot between amateur and professional aesthetics. Exceptional shadows and lighting. | Best starting point for our character reference images. |
| **Vision Realistic v2** | 100k+ training steps. No trigger words needed. Hyperrealistic. | Good for environment shots. |
| **DNA v1.0** | 128/128 config, zero-noise dataset. Photorealistic convergence in 6 steps. | Fast iteration. |
| **Colossus Project v12** | Flagship community model. Versatile. | Good all-rounder. |
| **Fluxmania** | Portraits and photography focus. | Good for character close-ups. |
| **Pandora FLUX** | 75% photographic, 25% artistic. 3.9★ across 161 reviews. | Good for our blended aesthetic. |

### Top SDXL Photorealistic Checkpoints

| Model | Strengths | Notes |
|-------|-----------|-------|
| **Juggernaut XL v10** | Gold standard. Best all-around for skin texture, lighting, anatomy. | Also excels at environments. Most recommended by Reddit. |
| **epiCRealism XL (Last FAME)** | Unmatched texture depth, micro-expressions, editorial/beauty photography. | Best for close-up character portraits. |
| **RealVisXL V5** | Strong skin detail, hair texture. | "Mirrorless vs DSLR" compared to Juggernaut. |
| **Realism Engine SDXL** | Best specifically for faces. | Face-focused work. |
| **DreamShaper XL** | Artistic/painterly. | Good for Understory and Interregnum eras. |

### Anime / Stylized Models (if needed for territory visualization)

| Model | Base | Notes |
|-------|------|-------|
| **NoobAI-XL VPred 1.0** | Illustrious/SDXL | V-Prediction tech. Vibrant color. Trained on ~13M images. Use Euler A, 28 steps, CFG 3.5. |
| **Pony Diffusion V6** | SDXL | Top-tier anime with large LoRA ecosystem. |
| **Illustrious XL v2.0** | SDXL | Strong anime foundation. |

> These may be useful for the cognitive territory sequences, where "colors that don't exist in nature" and the FFX Farplane aesthetic push beyond photorealism.

### Recommended Samplers

| Sampler | Best For | Notes |
|---------|----------|-------|
| **DPM++ 2M Karras** | SDXL, general use | Reliable all-rounder. |
| **UniPC** | Fast convergence | Emerging favorite in 2026. |
| **Euler** | Flux models | Simple, effective with Flux's flow matching. |

---

## III. CHARACTER CONSISTENCY — THE TRIPLE-THREAT STACK

This is the most critical technical challenge for THE REACHING: keeping characters recognizable across 40 years of aging and 10 series of visual development.

### The 2026 Best-Practice Stack

**Layer 1: Character LoRA (weight 0.6)**
→ Captures general body shape, hair, overall vibe

**Layer 2: PuLID Adapter (weight 0.8)**
→ Locks in precise facial features, bone structure

**Layer 3: ControlNet OpenPose**
→ Forces consistent posture and gesture

This triple-threat approach allows studios to produce content where the character looks identical in every frame.

### PuLID — Pure and Lightning ID Customization

**What it does:** Embeds a specific person's face identity into the generation without training. Zero-shot. Feed in a reference photo, get that person in any style, any pose, any environment.

**PuLID Flux II** (latest version):
- Solves model pollution — preserves artistic integrity while injecting character features
- Compatible with TeaCache and WaveSpeed for faster processing
- Three modes: "fidelity" (maximum likeness), "style" (preserves model creativity), "neutral" (balanced)

**For THE REACHING:**
- Use "fidelity" mode for hero shots and close-ups
- Use "style" mode for artistic/impressionistic scenes (the cognitive territory)
- Weight parameter: 0.7–0.9 for faces, lower (0.4–0.6) for full-body shots where pose matters more

**Flux Kontext + PuLID workflow:** Generates high-fidelity character images from a single face reference. Maintains identity consistency across styles, poses, and scenes. This is the workflow for producing our aging sequences.

### IPAdapter Plus FaceID — The Alternative

**What it does:** Similar to PuLID but uses a different approach. Combines IPAdapter (overall face structure) with FaceID (identity embedding). Requires InsightFace.

**FaceID Plus V2** — latest variant. Enhanced face conditioning via ViT-H image encoder.

**Key differences from PuLID:**
- IPAdapter + FaceID is more resource-intensive but delivers better results in direct comparison
- InstantID (from Tencent) delivers the best face-swap results overall, but is the most demanding
- PuLID is lighter but lower fidelity
- **Recommendation:** Use IPAdapter FaceID for final hero shots, PuLID for rapid iteration

**Reference image requirements:**
- Clear face visibility — no sunglasses, no heavy shadows, no hair covering face
- Minimum 512×512 in the face region
- Even, soft lighting
- Square images, subject centered
- Don't describe facial features in the text prompt — let the FaceID handle identity, use the prompt for environment/style/mood

### Chroma Model (New Contender)

ComfyUI-PuLID-Flux-Chroma fork adds Chroma model support. Chroma provides enhanced detail and artistic capabilities. PuLID preserves facial features and bone structure while Chroma handles styling.

**Worth testing for:** The Far Shore era (where artistic transcendence meets character identity).

---

## IV. LORA TRAINING — CURRENT BEST PRACTICES

### Tools

| Tool | Best For | Notes |
|------|----------|-------|
| **Kohya-ss/sd-scripts v0.9.1** | Industry standard. SDXL + Flux. Most flexible. | Command-line mastery gives maximum control. |
| **SimpleTuner** | Production Flux LoRAs. Most stable/reliable. | Gold standard for stability. Extensive config. Most predictable results. |
| **AI-Toolkit (Ostris)** | Fast Flux prototyping. 20–30% faster training. | Streamlined config. Good for iteration. |
| **OneTrainer** | GUI-based training | Good for iteration without CLI expertise. |
| **FluxGym** | Quick Flux experiments | Graphical interface, simplified settings. |
| **CivitAI Training** | Cloud training | 2000 buzz (~$2). Upload dataset, configure, train. No local GPU needed. |

**Recommendation:** Prototype with AI-Toolkit for speed, then use SimpleTuner for final production LoRAs.

### Settings — SDXL LoRAs

```
Optimizer:         Adafactor
Fused backward:    true (drops VRAM from 24GB → 10GB)
Network dimension: 128 (linear)
Network alpha:     64
LoRA+ ratio:       16
Learning rate:     1e-4
Epochs:            10
Precision:         bf16
Regularization:    Use classification images (1 repeat)
Save method:       Every N steps
```

### Settings — Flux LoRAs

```
Optimizer:         AdamW8bit
Quantize model:    true
Network dimension: 128 (linear + alpha equal)
Train steps:       ~2000
Precision:         bf16 mixed
Resolution:        512×512
VRAM required:     24GB (or 21.6GB with FP8_Scaled)
```

**New in 2026: FP8_Scaled** — reduces VRAM from 29.3GB to 21.6GB with almost no quality loss. Enable this.

### The Three Rules (2026 Consensus)

1. **Stop doing manual gradient accumulation hacks.** The tools handle this now.
2. **Use LoRA+ with a 16x ratio as your baseline.** Different learning rates for LoRA-A and LoRA-B components. This is the new standard.
3. **Turn on fused passes for SDXL.** Cuts VRAM in half.

### Dataset Quality — The Most Important Variable

> "A sloppy captioning job will ruin even the best training parameters."

**Image requirements:**
- Excellent focus, sharpness, and lighting
- No nighttime images (poor detail reproduction)
- Varied angles, expressions, lighting conditions
- 20–30 images minimum for character LoRAs, 50+ for style LoRAs

**Captioning:**
- Use **WD14 Tagger v3** for automated captioning (new standard)
- Natural language captions give better flexibility than tag-based captions
- For character LoRAs: caption what changes (outfit, environment, pose) and use a consistent trigger word for the character identity

**Versioning:**
- Version EVERYTHING — config file, output folder, dataset
- Any change (even a single file or tiny learning rate adjustment) = new version number

### LoRA Training Pipeline for THE REACHING Characters

**Phase 1: Generate Base References (Flux Kontext)**
1. Write a detailed character description (age, ethnicity, bone structure, hair, eyes)
2. Use Flux.2 Dev + UltraReal checkpoint to generate 50 candidate portraits
3. Use Kontext Character Creator workflow to generate turnaround sheets (front, 3/4, side, back)
4. Curate 30 best images across all angles and expressions

**Phase 2: Train Character LoRA**
1. Caption with WD14 Tagger v3 + manual refinement
2. Train Flux LoRA: rank 128, 2000 steps, AdamW8bit, bf16
3. Validate: generate test images at different ages, outfits, lighting

**Phase 3: Age Variants (IPAdapter + PuLID)**
1. Use IPAdapter with age-34 reference (weight 0.5) + age-appropriate prompt modifiers
2. Use PuLID (fidelity mode, weight 0.8) to lock identity
3. Use ControlNet depth to preserve pose/composition
4. Generate 10 images per age milestone
5. Add best images to the training dataset
6. **Retrain** the LoRA with age variants included

**Phase 4: Era Integration**
1. Stack: Character LoRA (0.7–0.8) + Era LoRA (0.4–0.5)
2. Generate hero shots per series
3. Validate cross-era consistency

---

## V. VIDEO GENERATION MODELS — THE LANDSCAPE

### The Big Four (March 2026)

#### 1. LTX-2.3 (Lightricks) — OUR PRIMARY VIDEO MODEL

Released March 2026. Day-0 ComfyUI support.

**Key capabilities:**
- Cinematic-grade video with synchronized audio at true 4K / 50fps
- Improved fine details: sharper textures, cleaner edges
- 9:16 portrait support (greatly improved)
- Better audio: cleaner dialogue, music, and ambient
- Improved image-to-video: more consistent motion, fewer glitches

**Required models:**
- LTX-2.3 Model Checkpoint → `models/checkpoints/`
- Spatial Upscaler → `models/latent_upscale_models/`
- Temporal Upscaler → `models/latent_upscale_models/`
- Distilled LoRA → `models/loras/`
- Gemma Text Encoder (gemma-3-12b-it-qat-q4_0) → `models/text_encoders/`

**Workflow:** Prompt → Prompt Enhancer → Sampling Stage 1 → Sampling Stage 2 → 2× Latent Upscaler → MP4 with audio in one pass.

**GGUF option:** Quantized models for lower VRAM. Makes local generation accessible on 16GB+ GPUs.

**Critical note:** Custom LoRAs trained on LTX-2.x need to be **retrained** for the 2.3 latent space.

**Hardware:** 32GB+ VRAM recommended. GGUF reduces this significantly.

#### 2. WAN 2.6 (Alibaba) — REFERENCE-TO-VIDEO

Released January 2026. The newest and most exciting for our use case.

**The killer feature: Reference-to-Video.**
- Provide 1–2 reference video clips + text prompt
- Model reproduces motion, framing, and style to create new shots
- Up to 1080p output, portrait or landscape

**WAN 2.2 (underlying model):**
- Mixture-of-Experts (MoE) architecture — separates denoising across timesteps
- 5B parameters with advanced VAE (16×16×4 compression)
- 720P/24fps on consumer GPUs (4090)
- Trained on 65.6% more images and 83.2% more videos than WAN 2.1

**ComfyUI integration:**
- WAN 2.1 is natively supported in ComfyUI core
- WAN 2.2/2.6 via **ComfyUI-WanVideoWrapper** (Kijai)
- Quality ranking: fp16 > bf16 > fp8_scaled > fp8_e4m3fn

**Key workflow — First-and-Last-Frame-to-Video (FLF2V):** Generate video between two keyframes. This is ideal for aging timeline transitions — generate Adaeze at 34 as frame 1 and at 63 as frame N, and WAN interpolates the transformation.

**For THE REACHING:** WAN 2.6 reference-to-video is ideal for creating visual echoes between eras — film a gesture in one era, use it as a reference to generate the same gesture in a different era with different characters. FLF2V is ideal for aging transition sequences.

#### 3. HunyuanVideo 1.5 (Tencent) — BEST FACES

**Key stats:**
- 8.3B parameters (trimmed from original 13B)
- Cinema-quality realism with exceptional temporal consistency
- Best face generation of any open video model
- Runs on 14GB+ VRAM with offloading
- 8–15 minutes per clip on RTX 4090 (1.7x faster with ComfyUI-MagCache)
- Full OSS toolchain: xDiT parallelism, FP8 weights, Diffusers/ComfyUI support
- **500+ LoRAs on CivitAI** — the largest video LoRA ecosystem. Critical for character consistency.
- ComfyUI-HunyuanVideoMultiLora — load multiple LoRAs without blur/artifacts

**For THE REACHING:** Best for close-up character shots (Adaeze's face, Ciarán's tea-making, the handshake). When face quality matters more than speed. The LoRA ecosystem means we can train character-specific video LoRAs.

#### 4. CogVideoX-5B (Tsinghua/Zhipu AI) — BEST IMAGE-TO-VIDEO

**Key stats:**
- 5B parameters with 3D Causal VAE
- 6-second clips at 720×480, 8fps
- Exceptional detail and semantic accuracy
- Best image-to-video quality (rated #1 for I2V)
- 6–12 minutes on RTX 4090
- LoRA training supported (50–200 training clips)

**Pipeline for THE REACHING:** Generate hero image with Flux → animate with CogVideoX I2V. This is the most reliable way to bring still character portraits to life.

#### 5. Kling 2.6 / 3.0 (Kuaishou) — AUDIO + VIDEO

- Native synchronized voiceover, dialogue, and sound effects
- Kling 3.0: Motion Control support (integrated into ComfyUI March 2026)
- Kling 3.5: Currently ranked #1 for I2V by Artificial Analysis
- Best for rapid iteration and audio-synced content

**For THE REACHING:** Consider Kling for dialogue-heavy sequences (exit interviews, Ciarán's radio show, Nana Rose's stories) where synced speech matters.

### Model Comparison at a Glance

| Model | Speed | Face Quality | Motion | Resolution | I2V | Audio | VRAM |
|-------|-------|-------------|--------|-----------|-----|-------|------|
| **LTX-2.3** | Fastest | Good | Good | 4K/50fps | Yes | Yes (synced) | 32GB+ |
| **WAN 2.6** | Medium | Good | Best (reference) | 1080p | Yes | No | 16GB+ |
| **HunyuanVideo 1.5** | Slow | Best | Best physics | 1080p | Yes | No | 14GB+ |
| **CogVideoX-5B** | Slow | Good | Good | 720p | Best I2V | No | 16GB+ |
| **Kling 3.0** | Fast | Good | Good | 1080p+ | Excellent | Yes (dialogue) | Cloud |

### Recommended Video Pipeline for THE REACHING

**Hero sequences (Tier 1):**
1. Generate first frame with Character LoRA + Era LoRA via Flux.2 Dev
2. Use HunyuanVideo 1.5 for face-critical shots (Adaeze, Solène close-ups)
3. Use LTX-2.3 for environment-heavy sequences (the territory, the hospital blackout)
4. Use CogVideoX I2V for still-to-motion transitions (photographs coming to life)

**Transition sequences:**
1. Generate bridge images using IPAdapter (outgoing era → incoming era)
2. Animate with LTX-2.3 (fastest, includes audio)
3. For Cross-era echoes: WAN 2.6 reference-to-video (film gesture in Era A, regenerate in Era B)

**Character aging in video:**
1. Generate reference frames at each age point via the LoRA aging pipeline
2. Use each reference frame as the first frame for era-specific video sequences
3. The aging is in the reference frame, not in the video generation
4. Color-grade in post for seamless intercutting

---

## VI. KEY COMFYUI CUSTOM NODES

### Essential Installs

| Node Pack | Purpose | Status |
|-----------|---------|--------|
| **ComfyUI-Manager V2** | Package manager. Install first. | Active, core |
| **ComfyUI_IPAdapter_plus** | Style transfer, face conditioning | Maintenance mode (cubiq). Fork at comfyorg/comfyui-ipadapter. |
| **ComfyUI-PuLID-Flux-Chroma** | Face identity preservation for Flux + Chroma | Active (PaoloC68) |
| **ComfyUI-nunchaku** | 4-bit quantized Flux + PuLID | Active (MIT HAN Lab). Reduces VRAM dramatically. |
| **ComfyUI-LTXVideo** | LTX-2.x video generation nodes | Active (Lightricks). LTX-2 is built into ComfyUI core. |
| **ComfyUI-WanVideoWrapper** | WAN 2.1/2.2/2.6 video generation | Active (Kijai) |
| **comfyui-reactor-node** | Face swap (ReActor) | Active |
| **ComfyUI-Impact-Pack** | FaceDetailer, SAM-based masks, batch processing | Active. Essential for face refinement. |
| **ComfyUI-AnimateDiff-Evolved** | AnimateDiff for motion generation | Active |
| **ControlNet Preprocessors** | OpenPose, depth, canny, etc. | Built into ComfyUI ecosystem |
| **ComfyUI-Tiled-Diffusion** | High-resolution upscaling | Active. For hero shots. |
| **ComfyUI-SAM3** | Segment Anything with natural language | Active. Zero-shot masking. Game-changer for inpainting. |
| **SuperScaler** | All-in-one multi-pass upscaling | Active (Nov 2025). Replaces 10+ node chains. |
| **ComfyUI-LayerForge** | Photoshop-like layered canvas, compositing | Active. Useful for double-exposure/palimpsest effects. |
| **StrawberryFist VRAM Optimizer** | Auto-cleanup, GPU monitoring | Active. Essential for multi-model pipelines. |
| **ZenID FaceSwap** | Age transformation, face swap | Active. Generates different ages from single reference — no LoRA needed. |

### ControlNet Models to Download

**Important:** ControlNet models are NOT cross-compatible between architectures. Download the right ones for your base model.

**For Flux (primary):**

| Model | Purpose | For THE REACHING |
|-------|---------|-----------------|
| **Shakker Labs Union Pro 2.0** | All-in-one: canny, soft edge, depth, pose, gray | The most comprehensive Flux ControlNet. Start here. |
| **BFL Official Canny** | Edge detection | Architectural consistency across eras |
| **BFL Official Depth** | Depth map conditioning | Preserving composition during aging pipeline |
| **XLabs HED/Canny/Depth** | Additional preprocessors | Backup options |
| **TheMisto Lineart** | Line art conditioning | Title card generation |

**For SDXL (secondary):**

| Model | Purpose | For THE REACHING |
|-------|---------|-----------------|
| **Xinsir OpenPose** | Pose matching | Cross-era gesture echoes (Cloud Atlas style) |
| **Xinsir Canny** | Edge detection | Best SDXL canny model |
| **ControlNet Union** | All-in-one (all control types in one file) | Simplifies SDXL workflows |
| **SoftEdge** | Soft edge detection | Dreamy/impressionistic territory scenes |

---

## VII. COMMUNITY RESOURCES & LEADERBOARDS

### Where to Track Model Quality

| Resource | What It Tracks | How to Use |
|----------|---------------|-----------|
| **CivitAI** (civitai.com) | Models, LoRAs, workflows. User ratings, download counts, reviews. | Sort by "Most Downloaded" or "Highest Rated" per model type. Check the "Buzz" economy for cloud training. |
| **HuggingFace** (huggingface.co) | Official model weights. Papers. Spaces for demos. | Primary source for video model weights (HunyuanVideo, WAN). |
| **Reddit r/StableDiffusion** | Community benchmarks, workflow sharing, troubleshooting. | Search for model comparison posts. The community actively tests new releases. |
| **Reddit r/comfyui** | ComfyUI-specific workflows, node discoveries, debugging. | Check weekly "What's New" threads. |
| **Artificial Analysis** (artificialanalysis.ai) | Image model benchmarks, speed/quality comparisons. | Objective benchmarks for comparing models. |

### Key Discord Servers

| Server | Focus |
|--------|-------|
| **ComfyUI Official** | Node development, workflow help, bug reports |
| **CivitAI** | Model releases, training help, community challenges |
| **Black Forest Labs** | Flux announcements, Flux-specific workflows |
| **Lightricks** | LTX Video support, workflow sharing |

### Workflow Repositories Worth Bookmarking

| Repository | What's There |
|-----------|-------------|
| **Murphy's 50+ Workflows** (CivitAI) | Updated Jan 2026. SDXL, Flux, Nunchaku, Kolors, WAN 2.2, F5TTS. Specialized packages. |
| **FLUX.1-DEV & Kontext Workflows Megapack** (CivitAI) | Comprehensive Flux workflow collection including img2img, character consistency. |
| **RuneXX/LTX-2.3-Workflows** (HuggingFace) | Extracted LTX-2.3 workflows optimized for separate file loading. |
| **ComfyUI Examples** (comfyanonymous.github.io) | Official example workflows for all natively supported models. |

---

## VIII. HARDWARE RECOMMENDATIONS

### Minimum Viable Setup

| Component | Minimum | Recommended | Ideal |
|-----------|---------|-------------|-------|
| **GPU** | RTX 4070 Ti (12GB) | RTX 4090 (24GB) | RTX 5090 (32GB) or A6000 (48GB) |
| **RAM** | 32GB | 64GB | 128GB |
| **Storage** | 500GB NVMe | 2TB NVMe | 4TB+ NVMe |
| **CPU** | Modern 8-core | 12+ cores | 16+ cores |

> **RTX 5090 note:** With NVFP4 quantization, the RTX 5090 delivers 2.5x speedup and 60% VRAM reduction compared to RTX 4090. This makes Flux.2 Dev comfortable and video generation fast.

### What Runs Where

| Task | 12GB VRAM | 24GB VRAM | 48GB+ VRAM |
|------|-----------|-----------|------------|
| SDXL generation | Full speed | Full speed | Full speed |
| Flux.1 Dev | FP8 quantized | FP8 full speed | Native BF16 |
| Flux.2 Dev | Too large | FP8 + offloading | FP8 full speed |
| Flux.2 Klein (9B) | FP8 quantized | Full speed | Full speed |
| LoRA training (SDXL) | With fused passes | Comfortable | Fast |
| LoRA training (Flux) | Not recommended | With FP8_Scaled | Full speed |
| LTX-2.3 video | GGUF only | Possible | Recommended |
| HunyuanVideo 1.5 | With offloading | Good | Full speed |
| WAN 2.2 video | Possible (1.3B) | Good (5B) | Full speed |
| CogVideoX | Not practical | Good | Full speed |

---

## IX. SPECIFIC RECOMMENDATIONS FOR THE REACHING

### Model Selection by Series

| Series | Image Model | Video Model | LoRA Stack | Notes |
|--------|------------|------------|------------|-------|
| **Backstory Shadows** | Flux.2 Dev + Pandora | CogVideoX I2V | Character + Film Grain LoRA | Documentary aesthetic. Photograph-based. |
| **Threshold** | Flux.2 Dev + UltraReal | HunyuanVideo 1.5 | Character + Medical/Clinical LoRA | Scan aesthetic. Monitor glow. Precise. |
| **Fracture Line** | SDXL + Juggernaut XL | LTX-2.3 | Character + Desaturated Era LoRA | Split-screen compositions. Cracked aesthetic. |
| **Interregnum** | Flux.2 Dev + Pandora | LTX-2.3 (with audio) | Character + Warm/Garden LoRA | Quiet. Intimate. Audio matters (kettle, rain). |
| **Inheritance** | Flux.2 Dev + UltraReal | WAN 2.6 Reference-to-Video | Character (multiple ages) + Double Exposure LoRA | Layered. Palimpsest. Cross-era echoes. |
| **Understory** | SDXL + DreamShaper XL | HunyuanVideo 1.5 | Character + Candlelight LoRA | Close-ups. Low ceilings. Warm light. |
| **Long Passage** | Flux.2 Dev + Vision Realistic | LTX-2.3 | Character + Transitional LoRA | Journey aesthetic. Long tracking shots. |
| **First Cartographers** | Flux.2 Dev + Territory LoRA | LTX-2.3 (4K) | Character + Territory LoRA (heavy) | The spectacle series. FFX Farplane. Pull out every stop. |
| **Echo Chamber** | Flux.2 Dev + Custom Prismatic LoRA | WAN 2.6 | Character + Resonance LoRA | Colors that don't exist in nature. Vibrating surfaces. |
| **Far Shore** | Flux.2 Dev + all era LoRAs blended | HunyuanVideo 1.5 | Character (103-year-old Adaeze) + Golden Light LoRA | Every palette merged. Transcendent. The final shot. |

### Priority LoRAs to Train

**Train first (blocking everything else):**
1. **Adaeze Nwosu** — ages 34, 43, 63, 98, 101, 103. This is the spine.
2. **Territory LoRA** — trained on aurora borealis, bioluminescent water, Turner paintings, fog, ice caves. This is the spectacle.

**Train second:**
3. **Solène Diarra** — ages 35, 42, 55, 65
4. **Era LoRAs** — one per series, trained on 50+ reference images matching each palette

**Train third:**
5. **Constance Okafor + Esme Okafor-Laurent** — family resemblance pair
6. **Petra Voss** — the precision anchor
7. **Supporting cast reference sheets** — Tomáš, Ciarán, Rose, Grace, etc.

### The Aging Pipeline (Step by Step)

```
1. GENERATE BASE (Flux.2 Dev + UltraReal)
   → 50 candidate images of character at primary age
   → Use Kontext Character Creator for turnaround sheets

2. TRAIN BASE LORA (Kohya-ss)
   → 30 curated images, WD14 Tagger v3 captions
   → Flux LoRA: rank 128, 2000 steps, AdamW8bit, bf16

3. AGE FORWARD (IPAdapter + PuLID + ControlNet Depth)
   → Source: base age reference
   → IPAdapter weight: 0.5 (decrease by 0.1 per decade)
   → PuLID: fidelity mode, weight 0.8
   → ControlNet depth: preserve composition
   → Add age-specific prompt modifiers (grey temples, deeper lines, etc.)
   → Key: EYES INTENSIFY as face ages

4. RETRAIN LORA
   → Add 10 best age-variant images per milestone
   → Retrain with expanded dataset
   → The LoRA now encodes the full aging arc

5. ERA INTEGRATION
   → Stack: Character LoRA (0.7) + Era LoRA (0.5)
   → Generate hero shots per series
   → Validate cross-era consistency

6. VIDEO REFERENCE FRAMES
   → Generate high-quality first frames at each age
   → Use as I2V input for HunyuanVideo / LTX-2.3
   → The aging is in the reference frame, not the video model
```

---

## X. QUICK-START CHECKLIST

For the team member setting up the pipeline from scratch:

- [ ] Install ComfyUI 0.16.1+
- [ ] Install ComfyUI-Manager V2
- [ ] Download Flux.2 Dev (FP8 quantized) → `models/checkpoints/`
- [ ] Download Flux Kontext → `models/checkpoints/`
- [ ] Download SDXL Juggernaut XL → `models/checkpoints/`
- [ ] Download UltraReal Fine-Tune v4 → `models/checkpoints/`
- [ ] Install ComfyUI_IPAdapter_plus (comfyorg fork)
- [ ] Install ComfyUI-PuLID-Flux-Chroma
- [ ] Install ComfyUI-Impact-Pack
- [ ] Install ComfyUI-nunchaku (for quantized Flux + PuLID)
- [ ] Download ControlNet models (OpenPose, Depth, Canny)
- [ ] Install InsightFace (required for FaceID/PuLID)
- [ ] Download LTX-2.3 checkpoint + upscalers + Gemma encoder → `models/`
- [ ] Install ComfyUI-LTXVideo nodes
- [ ] Install ComfyUI-WanVideoWrapper
- [ ] Download WAN 2.2 5B fp16 → `models/`
- [ ] Install Kohya-ss/sd-scripts v0.9.1 for LoRA training
- [ ] Download WD14 Tagger v3 for captioning
- [ ] Begin: Generate Adaeze Nwosu base references

---

*This compendium is a living document. The AI image/video generation landscape moves fast — check CivitAI, r/StableDiffusion, and r/comfyui weekly for new models and techniques. The fundamentals here (Flux.2, LoRA stacking, PuLID, LTX-2.3, WAN 2.6) are the March 2026 state of the art and will carry the production through its initial phases.*

*The reaching extends to the tools, too.*
