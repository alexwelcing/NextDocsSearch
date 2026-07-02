---
name: authorial-voice-system
description: >
  Build, test, and package repeatable authorial voice frameworks for fiction projects.
  Use when the user wants to create a new authorial persona, define a voice profile for a
  story, construct diction register and sentence architecture rules, engineer humor or
  tragedy mechanics, or set up a repeatable voice template for future projects. Triggers:
  "authorial voice," "voice construction," "persona profile," "diction register," "sentence
  architecture," "humor mechanics," "tone intent," "satirical voice," "build a voice," "voice
  bible," "style persona," or when the user is starting a new fiction project and wants to
  lock voice before writing prose.
---

# Authorial Voice System

Build, test, and package repeatable authorial voice frameworks for fiction projects.

## When to Use

- Starting a new fiction project and want to lock voice before prose
- Rewriting existing work in a different tone (e.g., satirical YA, literary sci-fi, noir)
- Creating a repeatable authorial persona for a series or pen name
- Engineering specific emotional mechanics (comedy, tragedy, ironic distance)
- The user has uploaded source material and wants to extract a voice profile from it

## Out of Scope
- General fiction writing (use `general-writing` → `fiction`)
- Project-specific novel orchestration (use `the-reaching-novel` for that project)
- Screenplay formatting (use `general-writing` → `screenplay`)

## Workflow

### Stage 1: Intake & Analysis

**Goal**: Understand the target voice from user description + any uploaded source material.

**Step 1 — Requirement extraction**

Deploy a subagent (`subagent_type="plan"`) to analyze:
- Source material (if provided): read uploaded excerpts, identify recurring patterns
- User description: parse the persona adjectives into concrete craft dimensions
- Target demographic and market positioning

The analyst returns a structured intake document covering:
- Genre & subgenre
- Tone intent (satirical, elegiac, propulsive, contemplative, etc.)
- Target demographic
- Prose density (sparse ←→ lush)
- Sentence rhythm preference (short punchy ←→ long flowing ←→ mixed)
- Emotional valence (comic ←→ tragic ←→ ironic ←→ warm)
- Diction register (slangy ←→ literary ←→ technical ←→ poetic)
- Visual sensibility (cinematic ←→ tactile ←→ abstract)

**Step 2 — Source pattern extraction (if source material provided)**

Deploy a `subagent_type="explore"` to:
- Read 3–5 representative excerpts from the source
- Identify: sentence length distribution, diction patterns, metaphor frequency, dialogue style, humor mode, emotional beats
- Report findings as a pattern summary

Save both outputs to `{workspace}/voice_intake.md`.

### Stage 2: Voice Architecture

**Goal**: Convert analysis into a concrete, repeatable voice blueprint.

Read `references/voice-blueprint-template.md` for the full template structure.

Build the blueprint file: `{workspace}/{project_name}.voice.md`

Sections (see template for full detail):
1. **Persona Profile** — who is writing this, what do they believe, what do they love
2. **Diction Register** — allowed words, forbidden words, preferred metaphors, register shifts
3. **Sentence Architecture** — length rules, rhythm patterns, punctuation voice, clause structure
4. **Humor Mechanics** — irony mode, juxtaposition rules, comic timing, satirical targets
5. **Tragedy Mechanics** — loss architecture, emotional beats, restraint rules, payoff design
6. **Visual Sensibility** — how the prose sees (camera distance, light, texture, motion)
7. **Anti-Patterns** — what this voice must never do (AI tells, inflated significance, etc.)
8. **Sample Passages** — 3–5 short exemplars demonstrating the voice in action

**Quality gate**: The blueprint must be specific enough that a writer subagent could follow it and produce prose recognizably in this voice. Vague adjectives ("lyrical," "punchy") are not enough — translate to mechanics.

### Stage 3: Voice Validation

**Goal**: Prove the voice works by writing test passages and comparing against the blueprint.

**Step 1 — Test passage generation**

Deploy a `subagent_type="coder"` writer with the blueprint as its system prompt.
- Write 3 short scenes (200–400 words each) in the voice:
  a. Dialogue-heavy scene
  b. Action/description scene
  c. Interiority/reflection scene

**Step 2 — Voice audit**

Deploy a `subagent_type="plan"` auditor:
- Read the blueprint + the 3 test passages
- Score each passage against each blueprint section (1–5)
- Flag deviations: where did the writer drift from the blueprint?
- Recommend blueprint adjustments or writer prompt fixes

**Step 3 — Iterate**

- If audit scores < 4 on any dimension: revise the blueprint, regenerate the failing passage, re-audit
- Max 2 iteration cycles
- If still failing after 2 cycles: flag the dimension as "manual oversight required" and proceed

Save validated test passages to `{workspace}/{project_name}.voice_tests.md`.

### Stage 4: Packaging & Repeatability

**Goal**: Convert the project-specific voice into a reusable template.

**Step 1 — Template extraction**

Strip project-specific content from the blueprint, leaving only:
- The structural template (sections 1–8)
- The rule patterns (e.g., "Sentence length: 60% short, 30% medium, 10% long")
- The anti-patterns list
- The scoring rubric from the audit

Save as `{workspace}/{project_name}.voice_template.md`.

**Step 2 — Template validation**

Deploy a `subagent_type="coder"` writer with ONLY the template (no persona content):
- Give the writer a new, arbitrary persona brief (e.g., "noir detective novelist, cynical, loves rain, hates authority")
- Writer produces a new voice blueprint from the template
- Auditor scores it: does the template produce a coherent blueprint?

If the template fails, revise and re-test.

**Step 3 — Archive**

- Store the template in `{workspace}/voice_templates/` for future project instantiation
- Store the validated blueprint in `{workspace}/voices/` for the current project
- Update a master index: `{workspace}/voice_index.md` listing all voices and templates

## Output Conventions

| Artifact | Path | Purpose |
|----------|------|---------|
| Voice intake | `{workspace}/voice_intake.md` | Raw analysis of source + requirements |
| Voice blueprint | `{workspace}/{project_name}.voice.md` | The authoritative voice spec for this project |
| Voice tests | `{workspace}/{project_name}.voice_tests.md` | Validated exemplar passages |
| Voice template | `{workspace}/voice_templates/{template_name}.md` | Reusable template for future projects |
| Voice index | `{workspace}/voice_index.md` | Registry of all voices and templates |

## Integration with Writing Pipeline

When the user proceeds to write prose using `general-writing` → `fiction` (or any sub-skill):
- Pass the voice blueprint file path to the writer subagent in the `Agent.prompt`
- The writer reads the blueprint and applies its rules as part of their persistent-rules block
- The auditor in the review pipeline checks against the blueprint as an additional quality dimension

## Core Principles

1. **Voice before prose.** Lock the voice before writing scenes. Voice drift is expensive to fix later.
2. **Mechanics over adjectives.** "Punchy" is not a rule. "60% sentences under 12 words, 20% over 25, never two long in a row" is a rule.
3. **Test before trust.** A voice blueprint that hasn't been validated with test passages is a hypothesis, not a spec.
4. **Templates are assets.** Every voice built is a template for the next project. Archive systematically.
5. **Markdown-first.** All outputs are `.md` files. No proprietary formats. The user owns the voice library.

## Reference Files

| File | When to Read | Purpose |
|------|-------------|---------|
| `references/voice-blueprint-template.md` | Before Stage 2 | Full template structure for building the voice blueprint |
| `references/diction-register-guide.md` | During Stage 2, Section 2 | Concrete rules for constructing diction registers |
| `references/humor-mechanics-guide.md` | During Stage 2, Section 4 | Patterns for irony, satire, comic timing, juxtaposition |
| `references/tragedy-mechanics-guide.md` | During Stage 2, Section 5 | Patterns for loss, restraint, emotional beats, catharsis |
| `references/visual-sensibility-guide.md` | During Stage 2, Section 6 | How to encode visual mindset into prose craft rules |
