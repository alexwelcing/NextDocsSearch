# TEXT TO VIDEO: A Production Guide

## How to Turn a Script Into Moving Pictures with ComfyUI

> **Audience**: Creative team members who understand THE REACHING's stories but are new to AI video generation. This is the "how do I actually make this movie" document.

> **Prerequisite**: Read the [Models Compendium](./COMFYUI-MODELS-COMPENDIUM.md) for what to install. This guide assumes you have ComfyUI running with the models listed in Section X of that document.

---

## THE BIG PICTURE: TEXT DOES NOT GO DIRECTLY TO VIDEO

This is the most common confusion. Here's what people expect:

```
Script → [AI Magic] → Movie
```

Here's what actually works in March 2026:

```
Script
  → Shot list (you write this)
    → Prompt engineering (you write this)
      → Reference image (Flux.2 generates this)
        → Face lock (PuLID/IPAdapter refines this)
          → Video clip (LTX/HunyuanVideo/WAN animates this)
            → Post-production (you color-grade and edit this)
              → Final sequence
```

**The key insight:** AI video generation is not "type words, get movie." It is a multi-stage pipeline where each stage refines the previous one. The human creative decisions happen at the FRONT of the pipeline (shot list, prompt engineering, reference image approval). The AI does the heavy lifting in the MIDDLE (generation, animation). The human comes back at the END (editing, grading, assembly).

You are a director, not a typist. You make creative decisions. The AI is your crew.

---

## STAGE 1: FROM SCRIPT TO SHOT LIST

### What You're Doing

Taking a story (text) and breaking it into individual camera shots. Each shot will become one AI generation task.

### How to Think About It

Read the story. Close your eyes. What do you SEE? That's your first shot.

A story is not a sequence of events. A story is a sequence of IMAGES. Your job is to identify the images.

### Example: "The Radio Priest" (Fr. Ciaran makes tea on air)

**Story text:**
> *He set the phone on the kitchen table. The microphone, a modest thing, sat beside the salt cellar. He filled the kettle. He turned on the gas. He waited. Three thousand people, in kitchens of their own, listened to the click of the igniter, the rush of flame, the low whistle of water approaching the boil.*

**Shot list:**

| # | Duration | Shot Type | What We See | Camera | Audio |
|---|----------|-----------|-------------|--------|-------|
| 1 | 8s | Wide | Stone cottage kitchen. Morning light through small window. Ciaran enters frame left, sets phone on table. | Fixed. Eye level. No movement. | Footsteps on stone. Chair scrape. |
| 2 | 4s | Close-up | The phone beside the salt cellar. The microphone's red recording light. | Fixed. Overhead angle. | Faint hum of the recording. |
| 3 | 6s | Medium | Ciaran at the sink, filling the kettle. His back to camera. Dog collar visible. Wool jumper. | Fixed. Slightly below eye level. | Water filling the kettle. |
| 4 | 3s | Close-up | His hand turning the gas knob. The click. The blue flame. | Macro. Shallow depth of field. | Click. Whoosh of flame. |
| 5 | 10s | Wide | The kitchen, full frame. Ciaran standing by the stove, waiting. Nothing happens. The kettle slowly builds to a whistle. | Fixed. Same angle as shot 1. Hold. | Silence → building whistle. |
| 6 | 5s | Close-up | Steam rising from the kettle spout. The whistle. | Tight on kettle. | The whistle, full. |
| 7 | 8s | Medium | He pours. The cup. The tea bag. The milk. Each gesture deliberate. | Tracking his hands. | Pour. Clink. Stir. |

**Total: ~44 seconds, 7 shots.**

### The Rules of Shot Lists

1. **Every shot has ONE subject.** Don't try to cram multiple actions into one generation. AI video models produce 4-10 second clips. One action per clip.

2. **Describe what the CAMERA sees, not what the CHARACTER thinks.** Wrong: "Ciaran feels peaceful." Right: "Ciaran stands still by the stove. His hands are at his sides. His eyes are on the kettle."

3. **Specify the camera.** Fixed or moving? Wide or close? Eye level or overhead? This translates directly to ControlNet and prompt engineering decisions.

4. **Note the lighting.** Morning light through a small window is a prompt. Fluorescent hospital corridor is a different prompt. The lighting is not decoration — it's the emotional register.

5. **Keep clips SHORT.** 3-10 seconds per shot. The video models are best at this range. Longer sequences are assembled in editing, not generated in one pass.

---

## STAGE 2: FROM SHOT LIST TO PROMPT

### What You're Doing

Translating each shot into language the AI model understands. This is the craft. A good prompt is the difference between "generic AI slop" and "this looks like a real movie."

### The Prompt Formula

For image generation (Flux.2 Dev), use this structure:

```
[Subject] + [Action] + [Environment] + [Lighting] + [Camera] + [Style/Mood]
```

For video generation (LTX-2.3 / HunyuanVideo), use this structure:

```
[Camera movement], [Subject] [performs action] in [environment]. [Lighting description]. [Style/mood]. [Technical: resolution, fps]
```

### Example Prompts for "The Radio Priest" Shot List

**Shot 1 (Wide, kitchen, Ciaran enters):**

*Image prompt (Flux.2 Dev):*
```
An elderly Irish priest in a stone cottage kitchen, morning light through a small
window, dog collar visible under a worn wool jumper, gaunt peaceful face, aged 63,
sparse kitchen with wooden table, salt cellar, the specific warmth of Irish
countryside morning, soft natural light, wide shot, eye level, cinematic
composition, photorealistic, 35mm film grain
```

*Video prompt (LTX-2.3):*
```
Static wide shot, an elderly priest walks slowly into frame from the left side of
a stone cottage kitchen, morning light streams through a small window casting warm
rectangles on the stone floor, he places a mobile phone carefully on the wooden
kitchen table beside a salt cellar, his movements are deliberate and unhurried,
warm natural lighting, cinematic 35mm film quality
```

**Shot 4 (Close-up, hand turning gas):**

*Image prompt:*
```
Extreme close-up of an elderly man's weathered hand turning a gas stove knob,
blue flame igniting, shallow depth of field, the hand is gaunt with visible veins,
clean short fingernails, macro photography, warm kitchen light from the left,
cinematic, photorealistic
```

*Video prompt:*
```
Macro close-up, a weathered elderly hand slowly turns a gas stove knob, there is
a sharp click then a ring of blue flame ignites with a soft whoosh, shallow depth
of field with the background kitchen softly blurred, warm side lighting, cinematic
quality, slow deliberate movement
```

### Prompt Engineering Principles

**1. Lead with camera, not subject.**
Video models respond best when the first words describe what the camera is doing.
- Good: "Static wide shot, a woman stands..."
- Bad: "A woman is standing in a kitchen, wide angle..."

**2. Describe motion explicitly.**
AI doesn't infer motion from context. If nothing moves, say "static." If a hand reaches, say "slowly reaches forward."
- Good: "her right hand slowly lifts the kettle from the stove and tilts it, pouring steaming water into a ceramic mug"
- Bad: "she pours tea"

**3. Specify what does NOT move.**
If the camera is fixed, say "static camera, no movement." If the character is still, say "standing motionless." AI models love to add gratuitous camera movement and character fidgeting. Constrain them.

**4. Light is a prompt, not an afterthought.**
"Morning light through a small window" produces COMPLETELY different results than "soft diffused lighting." Be specific about the light source, direction, and quality.

**5. Use film language, not AI language.**
These models were trained on film descriptions. "35mm film grain, shallow depth of field, Kodak Portra 400 color science" works better than "photorealistic, 8k, ultra detailed."

**6. Avoid negative prompts for video.**
Unlike image generation, video models don't reliably respond to negative prompts. Instead, describe what you WANT so specifically that there's no room for what you don't want.

**7. Keep prompts under 200 words for video.**
Longer prompts confuse video models. Be precise, not exhaustive. Save the detail for the reference image (which can handle longer prompts).

### The Era-Specific Prompt Modifiers

Add these to the end of any prompt to shift the color palette to the correct era:

| Era | Add to Prompt |
|-----|--------------|
| **Backstory Shadows** (2027-29) | `warm amber tones with clinical blue accents, Kodak Portra 400 color science, documentary photography aesthetic, subtle film grain` |
| **Threshold** (2027-28) | `golden hour fading to blue hour, clinical precision, the specific light of a hospital at night, monitor glow, cool shadows` |
| **Fracture Line** (2028-31) | `desaturated earth tones and steel grey, overcast flat lighting, faded photograph aesthetic, no dramatic shadows, even illumination` |
| **Interregnum** (2031-35) | `muted sage and clay and cream, warm intimate light from small sources, candle glow, the warmth of a desk lamp, wabi-sabi` |
| **Inheritance** (2031-38) | `sepia layered with present-tense green, double exposure aesthetic, the old visible beneath the new, transitional warmth` |
| **Understory** (2033-38) | `deep greens and candlelight amber and stone grey, firelit underground spaces, cellar light, intimate low ceilings` |
| **Long Passage** (2035-46) | `shifting palette from earth tones to gentle iridescence, the light of a decade-long sunrise, subtle lens flares` |
| **First Cartographers** (2044-46) | `white and deep ocean blue and luminous fog, arctic light, Vermeer interior quality, vast luminous spaces` |
| **Echo Chamber** (2047-53) | `prismatic colors that feel slightly impossible, warm-alien, refracted light, oil-on-water iridescence, resonant` |
| **Far Shore** (2060-67) | `all color palettes softened and blended to warm gold, late afternoon light, everything gilded, transcendent warmth` |

---

## STAGE 3: FROM PROMPT TO REFERENCE IMAGE

### What You're Doing

Generating a single, perfect still image that will serve as the "first frame" for your video clip. This is the most important step. The reference image determines EVERYTHING — character identity, lighting, composition, color palette, mood.

### The Workflow

```
1. Load Flux.2 Dev + UltraReal Fine-Tune checkpoint
2. Load Character LoRA (weight 0.7)
3. Load Era LoRA (weight 0.5)
4. Enter your image prompt
5. Generate at 1024x768 (landscape) or 768x1024 (portrait)
6. Generate 4-8 candidates (batch)
7. Pick the best one
8. Run FaceDetailer (Impact Pack) to clean up the face
9. Upscale to target resolution if needed
10. Save this as your reference image
```

### Character Consistency: The Lock-Down Pipeline

If the shot includes a character we've trained a LoRA for:

```
1. Load Character LoRA (weight 0.7)
2. Load PuLID with character reference photo (fidelity mode, weight 0.8)
3. Load ControlNet Depth or OpenPose (if matching a specific pose)
4. Load Era LoRA (weight 0.5)
5. Generate
6. FaceDetailer pass
7. Approve or regenerate
```

**The order matters.** Character LoRA establishes the general identity. PuLID locks the FACE. ControlNet constrains the POSE. Era LoRA shifts the COLOR. FaceDetailer cleans up artifacts.

### Approving a Reference Image

Before sending a reference image to video generation, check:

- [ ] Is the character recognizable? Compare side-by-side with the reference sheet.
- [ ] Is the face clean? No extra fingers in frame, no warped features, no asymmetry that wasn't intended.
- [ ] Is the lighting correct for the era?
- [ ] Is the composition correct for the shot type (wide/medium/close)?
- [ ] Is there room for the action to happen? If the character needs to reach forward, is there space in front of them?
- [ ] Is the color palette correct? Compare against the era color chart.

**If any answer is "no," regenerate.** Do not send a flawed reference image to video. The video model will amplify the flaw, not fix it.

---

## STAGE 4: FROM REFERENCE IMAGE TO VIDEO CLIP

### What You're Doing

Taking your approved reference image and bringing it to life with motion. This is where the magic happens — but only if the reference image is right.

### Choosing Your Video Model

Ask yourself three questions:

**1. Is this a face shot?**
- Yes → **HunyuanVideo 1.5** (best face quality, 500+ LoRAs for character consistency)
- No → continue to question 2

**2. Does this need specific motion or a gesture echo?**
- Yes, copying motion from another clip → **WAN 2.6 reference-to-video**
- Yes, transitioning between two keyframes (aging, era shift) → **WAN 2.2 FLF2V**
- No → continue to question 3

**3. Is this environment-heavy, needs audio, or needs to be fast?**
- Needs synced audio → **LTX-2.3** (generates audio with video)
- Environment/spectacle shot → **LTX-2.3** (4K/50fps, fastest)
- Needs maximum quality, time is not a factor → **HunyuanVideo 1.5**

### The Image-to-Video Workflow (Most Common)

This is the bread-and-butter workflow. You'll use this for 80% of shots.

```
ComfyUI Workflow:

1. Load Image → your approved reference image
2. Load Video Model checkpoint (LTX-2.3 or HunyuanVideo)
3. Video Prompt node → your video prompt (describe the MOTION, not the scene —
   the scene is already in the image)
4. Sampler settings:
   - Steps: 30-50 (HunyuanVideo) or 20-30 (LTX-2.3)
   - CFG: 6-8
   - Seed: random for exploration, fixed for iteration
5. Output: 4-10 second clip
6. Review → approve or adjust prompt and regenerate
```

### Critical Concept: The Video Prompt is About MOTION

Your IMAGE prompt described the scene: the kitchen, the light, the character, the mood.

Your VIDEO prompt describes what HAPPENS: the action, the camera movement, the change.

**Image prompt:** "An elderly Irish priest in a stone cottage kitchen, morning light..."

**Video prompt:** "Static camera, the priest slowly lifts a kettle from the stove with his right hand, tilts it carefully, pours steaming water into a ceramic mug, steam rises in the warm morning light, deliberate unhurried movement"

See the difference? The image prompt builds the world. The video prompt moves through it.

### HunyuanVideo 1.5: Face-Critical Shots

**When to use:** Close-ups of Adaeze, Solene, Ciaran, any shot where the face needs to be perfect.

**Setup:**
```
1. Load HunyuanVideo 1.5 checkpoint (FP8 if VRAM < 24GB)
2. Load character video LoRA if available (HunyuanVideo has 500+ on CivitAI)
3. Load reference image as first frame
4. Prompt: describe facial expression changes and subtle motion
5. Enable MagCache for 1.7x speedup
6. Generate at 720p
7. Expect 8-15 minutes per clip on RTX 4090
```

**Tips for face shots:**
- Keep the face at LEAST 30% of the frame area
- Describe micro-expressions: "a slight tightening around her eyes," "the corner of his mouth lifts almost imperceptibly"
- HunyuanVideo excels at temporal consistency — the face stays stable across frames
- For multi-LoRA scenes (character + style), use ComfyUI-HunyuanVideoMultiLora to prevent blur

### LTX-2.3: Environment & Audio Shots

**When to use:** The territory sequences. The hospital blackout. Any shot where the SPACE matters more than the face. Any shot that needs synced audio.

**Setup:**
```
1. Load LTX-2.3 checkpoint
2. Load Spatial Upscaler + Temporal Upscaler
3. Load Distilled LoRA
4. Load Gemma text encoder
5. Prompt Enhancer → your video prompt
6. Sampling Stage 1 → Stage 2 → Latent Upscaler
7. Output: up to 4K/50fps with audio
```

**Tips for environment shots:**
- LTX-2.3's prompt enhancer is excellent — feed it your shot description and let it expand
- For audio: describe the sound design in the prompt ("the whistle of a kettle, the clink of ceramic, stone floor footsteps")
- For the territory sequences: go wild with the prompt. "Vast luminous fog, aurora borealis colors swirling slowly, bioluminescent particles drifting upward like inverted snow, a small human figure barely visible in the distance, the light responds to their presence, rippling outward"

### WAN 2.6: Gesture Echoes & Era Transitions

**When to use:** The Cloud Atlas moments. A gesture in 2031 that rhymes with a gesture in 2063.

**Reference-to-Video workflow:**
```
1. Generate (or select) a reference video clip — the "source gesture"
   Example: Constance's hand cataloguing a gesture in 2030
2. Load WAN 2.6 via ComfyUI-WanVideoWrapper
3. Input: reference clip + text prompt describing the NEW context
   Example: "A young woman's hand reaching into luminous fog, the same
   deliberate cataloguing motion, but now reaching toward something vast
   and unknown, deep ocean blue light, arctic luminosity"
4. Output: the same motion, recontextualized in a new era
```

**FLF2V workflow (aging transitions):**
```
1. Generate Frame 1: Adaeze at 34 in her radiology office, looking at a scan
2. Generate Frame N: Adaeze at 63 on a Brixton balcony, looking at the sky
3. Load WAN 2.2 FLF2V mode
4. Input: Frame 1 + Frame N + transition prompt
   Example: "A woman ages gracefully across three decades, her environment
   shifts from clinical blue to warm amber, her posture softens from
   forward-leaning alertness to upright dignity, her eyes intensify"
5. WAN interpolates the visual transformation between the two keyframes
6. Output: a continuous video of the transition
```

This is THE technique for our aging sequences. Use it.

---

## STAGE 5: POST-PRODUCTION

### What You're Doing

Taking your AI-generated clips and assembling them into coherent sequences. This is traditional film editing — the AI part is done.

### Assembly Workflow

```
1. Export all approved clips from ComfyUI (MP4)
2. Import into DaVinci Resolve / Premiere Pro / your editor
3. Arrange clips according to the shot list
4. Color grade for era consistency:
   - Apply the era LUT (create these from the color palette table)
   - Match skin tones across clips (the AI will produce slight variations)
   - Ensure the lighting direction is consistent within a scene
5. Add transitions:
   - CUTS within a scene (most transitions should be hard cuts)
   - DISSOLVES for era transitions (the FLF2V clips replace some of these)
   - FADE TO WHITE for the final shot (not black — white, warm)
6. Audio design:
   - Replace or enhance AI-generated audio with proper sound design
   - Add music per the audio direction in the production bible
   - Mix dialogue (if any) from a separate AI voice generation pass
7. Titles and typography:
   - Generate title cards via Flux.2 Dev (best text rendering)
   - Animate them minimally — the title appears, holds, breathes
```

### Color Grading Across Eras

The most important post-production task. Each era has a distinct color palette (see the production bible). Your job is to enforce that palette across all clips in that era, even though they were generated at different times with slightly different settings.

**Practical approach:**
1. Create a reference frame for each era — the "hero image" that defines the look
2. Build a DaVinci Resolve node tree (or LUT) that transforms a neutral image to that era's palette
3. Apply the same node tree to every clip in that era
4. Fine-tune per clip as needed

**Cross-era scenes** (flashbacks, the Inheritance series double-exposures):
- Grade each layer to its own era's palette
- Composite with reduced opacity
- The visual dissonance between palettes IS the point — don't harmonize them

### Continuity Checklist

Before approving a final sequence, check:

- [ ] Is the character's face consistent across all shots in the sequence?
- [ ] Does the lighting direction stay consistent? (Sun from the left in shot 1 shouldn't flip to the right in shot 3)
- [ ] Are the character's clothes the same across shots? (AI sometimes changes subtle details)
- [ ] Does the color palette match the era?
- [ ] Is the motion natural? No sudden jitter, no limbs passing through objects?
- [ ] Does the audio match the visuals? (Kettle whistle when steam appears, not before)

---

## STAGE 6: PUTTING IT ALL TOGETHER — A COMPLETE WALKTHROUGH

### Example: Producing "The Last Handshake" Final Shot (60 seconds)

This is THE REACHING's final image. Adaeze at 103. Delft. Winter. She extends her hand.

**Step 1: Shot list**

| # | Duration | Shot | Description |
|---|----------|------|-------------|
| 1 | 15s | Wide | A sparse room in the Delft Institute. White walls. Winter light. Adaeze sits in a chair near a wall. She is thin, silver-haired, wearing a wool coat. She is still. |
| 2 | 10s | Medium | Her face. The eyes — intense, alive, burning with a century of observation. She looks at the wall. |
| 3 | 5s | Close-up | Her hand resting on the arm of the chair. The veins. The slight tremor. |
| 4 | 30s | Medium-wide | She raises her hand. Slowly. The tremor is not weakness — it is the effort of reaching toward something enormous. Her hand extends toward the wall. She holds. The wall. The warmth. Thirty seconds of stillness. Hold. |

**Step 2: Reference images**

For each shot, generate a reference image using:
- Character LoRA: Adaeze at 103 (weight 0.7)
- PuLID: Adaeze reference, fidelity mode (weight 0.8)
- Era LoRA: Far Shore — all palettes blended, golden warmth (weight 0.5)
- ControlNet Depth: to preserve the composition

Prompt for Shot 4 reference:
```
An elderly woman of 103 years, Nigerian-British, silver hair, thin, luminous,
wearing a dark wool coat, seated in a simple chair, her right hand extended
forward toward a plain white wall, the hand trembles slightly, the room is
sparse and white, winter light from a high window, Delft architecture, all
color palettes merged into warm gold, late afternoon light, everything gilded,
transcendent warmth, the specific beauty of extreme age, 35mm film, shallow
depth of field on the hand
```

Generate 8 candidates. Pick the one where:
- The hand is anatomically correct (AI hands are still tricky — regenerate until right)
- The eyes have that INTENSITY described in the character bible
- The warmth of the light feels like "a memory someone is trying to hold onto"

**Step 3: FaceDetailer pass**

Run Impact Pack's FaceDetailer on the approved reference:
- CodeFormer at 0.5 strength
- Verify the face didn't change character — compare with reference sheet

**Step 4: Generate video**

Shot 4 is the hero shot. Use HunyuanVideo 1.5 (best face quality for the close-up elements):

Video prompt:
```
Static camera, medium-wide shot, an elderly woman slowly raises her right hand
from the armrest of a chair, the movement is deliberate and trembling, not from
weakness but from the effort of reaching, her hand extends toward a white wall,
she holds the position, completely still except for a slight tremor in the
fingers, warm golden winter light, silence, the camera does not move, thirty
seconds of absolute stillness after the hand reaches its full extension
```

Generate. Review. The hand must be right. If the fingers warp or extra digits appear, regenerate with a different seed.

For the other shots: use the same workflow. Shot 1 (wide, environment) can use LTX-2.3 for the audio capability (we want to hear her breathing, the building settling).

**Step 5: Assemble**

```
Shot 1 (15s) → hard cut →
Shot 2 (10s) → slow dissolve (2s) →
Shot 3 (5s) → hard cut →
Shot 4 (30s) → hold → fade to warm white (5s)
```

Total: ~65 seconds including the fade.

Audio: Her breathing. The building settling. No music. Just the human sounds.

Color grade: Far Shore palette — all eras blended to warm gold.

**Step 6: Review against the production bible**

> *"Every frame should feel like a memory someone is trying to hold onto."*

Does it? Watch it three times. First for technical quality. Second for emotional impact. Third with your eyes half-closed, feeling the rhythm.

The reaching is the point.

---

## COMMON MISTAKES AND HOW TO AVOID THEM

### 1. "I typed my whole story into the video model and got garbage"

Video models generate 4-10 second clips from SHORT prompts about MOTION. They don't understand narrative. Break your story into shots first.

### 2. "The character looks different in every shot"

You skipped the character consistency pipeline. Use Character LoRA + PuLID + ControlNet for EVERY shot that contains a recurring character. No exceptions.

### 3. "The hands are wrong"

AI hands are still the hardest problem. Solutions:
- Generate 8+ candidates and pick the best hands
- Use FaceDetailer's "hand repair" mode (Impact Pack)
- Frame shots to minimize hand visibility when hands aren't the subject
- When hands ARE the subject (they often are in THE REACHING — "hands are the visual through-line"), budget extra generation time and be prepared to regenerate many times
- Use ControlNet OpenPose with specific hand poses

### 4. "The video has weird jitter / morphing"

- Lower the motion intensity in the video prompt (use words like "slowly," "gently," "minimal movement")
- For static shots, explicitly say "static camera, no camera movement, the figure is still"
- Use longer step counts (more denoising steps = smoother motion)

### 5. "Everything looks like AI"

The "AI look" comes from:
- Over-saturated colors → fix with era-specific color grading in post
- Too-smooth skin → add film grain in post, or use prompts like "35mm film grain, Kodak Portra 400"
- Perfect symmetry → avoid front-facing symmetrical compositions
- Generic environments → add SPECIFIC details in prompts ("salt cellar," "worn wool jumper," "stone floor with visible mortar")
- Over-prompting → don't describe every pixel. Leave room for the model to fill in natural detail.

### 6. "I can't get the color palette right"

Don't rely on the AI model for color accuracy. Generate with reasonable colors, then color-grade in post-production. This is how real films work — the cinematographer shoots, the colorist grades. Separate the concerns.

### 7. "The transition between eras looks jarring"

Use WAN 2.2's FLF2V (First-and-Last-Frame-to-Video) for era transitions. Generate the final frame of the outgoing era and the first frame of the incoming era as keyframes, then let WAN interpolate the visual shift. This produces smooth, meaningful transitions.

---

## QUICK REFERENCE: WHICH MODEL FOR WHICH SHOT

| Shot Type | Model | Why |
|-----------|-------|-----|
| Character close-up | HunyuanVideo 1.5 | Best faces. Load character video LoRA if trained. |
| Environment / spectacle | LTX-2.3 | 4K, fastest, includes audio. |
| Dialogue / audio-critical | LTX-2.3 or Kling 3.0 | Synced audio generation. |
| Gesture echo (same motion, different era) | WAN 2.6 reference-to-video | Reproduces motion from reference clip. |
| Aging transition | WAN 2.2 FLF2V | Interpolates between two keyframe ages. |
| Era transition | WAN 2.2 FLF2V | Interpolates between two era color palettes. |
| Photograph coming to life | CogVideoX-5B I2V | Best image-to-video fidelity. |
| Quick iteration / storyboard | LTX-2.3 (GGUF) | Fastest generation. Good enough to evaluate composition. |

---

## THE DAILY WORKFLOW

For the team member sitting down at ComfyUI each morning:

```
MORNING: Plan
  1. Review the shot list for today's sequence
  2. Identify which characters appear (load their LoRAs)
  3. Identify which era (load the era LoRA)
  4. Prepare reference photos for PuLID

MIDDAY: Generate Reference Images
  5. Generate 4-8 candidate reference images per shot
  6. Review against character sheets and era color charts
  7. Run FaceDetailer on approved images
  8. Save approved references to the project's reference folder

AFTERNOON: Generate Video Clips
  9. Feed approved reference images to the appropriate video model
  10. Write motion-focused video prompts
  11. Generate, review, regenerate as needed
  12. Export approved clips as MP4

END OF DAY: Document
  13. Log which shots were completed
  14. Note any character consistency issues for the next session
  15. Update the sequence edit with new clips
```

---

## GLOSSARY FOR THE NON-TECHNICAL

| Term | What It Means |
|------|--------------|
| **LoRA** | A small file that teaches the AI model a specific concept (a face, a style, a color palette). Like a lens filter, but for identity or style. |
| **PuLID** | A tool that locks a specific person's face into the generation. Feed it a photo, and every image it generates will have that person's face. |
| **IPAdapter** | Similar to PuLID but works on overall style/composition, not just faces. Like showing the AI a mood board. |
| **ControlNet** | Constrains the AI's output to match a specific structure (a pose, a depth map, an edge map). Like giving the AI a sketch to paint over. |
| **FaceDetailer** | A cleanup tool that detects faces in generated images and refines them. Like a touch-up artist. |
| **I2V (Image to Video)** | Taking a still image and animating it into a video clip. The reference image becomes the first frame. |
| **FLF2V** | First-and-Last-Frame-to-Video. You give the AI two images (start and end) and it generates the video that transitions between them. |
| **CFG (Classifier-Free Guidance)** | How strictly the AI follows your prompt. Higher = more literal. Lower = more creative. Usually 6-8 for video. |
| **Seed** | A random number that determines the specific output. Same seed + same prompt = same result. Use this to iterate: keep the seed, adjust the prompt. |
| **Checkpoint** | The base AI model. Like the camera body. LoRAs are the lenses. |
| **ComfyUI node** | One step in the pipeline. Nodes connect to each other in a graph. Each node does one thing: load a model, apply a LoRA, generate an image, upscale, etc. |
| **VRAM** | Video memory on your GPU. Determines which models you can run. More VRAM = bigger models = better quality. |
| **Quantization (FP8, GGUF)** | Compressing a model to use less VRAM. Like JPEG compression for AI models. Some quality loss, big memory savings. |
| **Batch** | Generating multiple candidates at once. Always generate in batches of 4-8 and pick the best. |
| **Color grading / LUT** | Adjusting the colors of the final video to match a specific look. Done in post-production (DaVinci Resolve, etc.), not in the AI. |

---

*This guide is a living document. As the team gets comfortable with the pipeline, we'll add specific workflow screenshots and .json files for each shot type. For now: read the shot list, write the prompt, generate the image, approve the image, generate the video, assemble in the editor.*

*The process is: words → image → motion → film.*

*The reaching is the point.*
