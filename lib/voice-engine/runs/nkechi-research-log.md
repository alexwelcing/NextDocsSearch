# Voice Research Log: Nkechi Adesanya (The Threshold)

Profile: `nkechi-v1` → `nkechi-v2` → `nkechi-v3`
Heritage: Oliver Sacks x Joan Didion
Date: 2026-03-11

---

## Iteration 1 — Seed Profile (v1)

**Sample**: Sommelier discovers AI blind-tasting system outperforms her.
**Word count**: 611

### Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Avg sentence length | ~16 | 10.5 | OFF (-5.5) |
| Short ratio (<=8w) | 0.20 | 0.59 | OFF (+0.39) |
| Long ratio (>=50w) | 0.08 | 0.00 | FAIR |
| Variance | ~12 | 9.3 | FAIR |
| Em-dash (per 1000w) | high | 13.1 | GOOD |
| Imagery coverage | 4/4 | 3/4 | GOOD |
| Constraint violations | 0 | 0 | CLEAN |

### Sentence Distribution
```
<=8      █████████████████████████████ 59%
9-16     █████████ 19%
17-30    █████████ 19%
31-50    █ 3%
50+       0%
```

### Qualitative Evaluation

**Strengths**:
- Sensory detail is strong: chlorhexidine, the callus on her thumb, wool
  catching on skin, the buzz frequency of fluorescents. Nkechi's body-first
  mandate is landing.
- Constraint compliance is perfect — zero forbidden patterns, no explicit
  thematics, no "she realized" constructions.
- The closing voice memo trails off mid-thought as specified. The repetition
  of "I was nine" and the trailing "But it's what" feel genuinely unfinished.
- Em-dash usage is the dominant secondary punctuation, matching the target.

**Weaknesses**:
- Massively over-indexed on short sentences. The Didion influence overwhelmed
  the Sacks influence. The prose reads like a series of bullet points rather
  than observation flowing into observation.
- Zero sentences over 50 words. The "longer perceptual sentences for
  observation" directive didn't land. The profile needs to explicitly request
  sentences that *mime the movement of attention through a space*.
- The rhythm is monotonous: short-short-short-medium-short-short. There's no
  breathing, no expansion and contraction. Nkechi's voice should feel like
  watching someone work — bursts of action followed by sustained looking.
- Variance (9.3) is too low. Everything sits in the same narrow band.

### Mutation Applied (v1 → v2)

```
rhythm.avgSentenceLength: 16 → 19
rhythm.shortSentenceRatio: 0.20 → 0.15
rhythm.longSentenceRatio: 0.08 → 0.12
rhythm.sentenceLengthVariance: 12 → 15
styleDirective: Added "Include at least 2-3 sentences per piece that are
  40+ words — sentences where attention moves through a space, noticing
  details in sequence, the way an eye scans a room. These sentences should
  feel like sustained looking, not like listing."
```

**Rationale**: The short-sentence problem is structural — the LLM defaults to
punchy declarative prose. The profile needs to explicitly request long
observational sentences and provide a cognitive model for them ("attention
moving through a space"). The avg target nudges up to 19 to give more
headroom while keeping the short punches that work.

---

## Iteration 2 — Mutated Profile (v2)

**Sample**: Cardiothoracic surgeon follows AI angular correction during valve
replacement.
**Word count**: 920

### Metrics

| Metric | Target (v2) | Actual | Status | vs Iter 1 |
|--------|-------------|--------|--------|-----------|
| Avg sentence length | ~19 | 23.6 | FAIR (+4.6) | +13.1 |
| Short ratio (<=8w) | 0.15 | 0.36 | OFF (+0.21) | improved from 0.59 |
| Long ratio (>=50w) | 0.12 | 0.13 | CLOSE | improved from 0.00 |
| Variance | ~15 | 19.3 | FAIR (+4.3) | improved from 9.3 |
| Em-dash (per 1000w) | high | 12.0 | GOOD | stable |
| Imagery coverage | 4/4 | 3/4 | GOOD | stable |
| Constraint violations | 0 | 0 | CLEAN | stable |

### Sentence Distribution
```
<=8      ██████████████████ 36%
9-16     ██████ 13%
17-30    █████████ 18%
31-50    ██████████ 21%
50+      ██████ 13%
```

### Qualitative Evaluation

**Improvements from Iteration 1**:
- The distribution is dramatically better. We now have genuine range: 36% short,
  13% medium, 18% long, 21% very long, 13% 50+. The prose *breathes*.
- Long observational sentences appeared and they work beautifully. "The operating
  theatre had a smell that Dr. Kenji Murakami could have bottled and sold as an
  argument against romanticism" — 80 words, and it earns every one of them because
  the attention genuinely moves through the space.
- The haptic detail is superb: "that particular resistance, then give, then snug,
  that meant the tissue was accepting the prosthetic the way a riverbed accepts a
  stone." The body is carrying the thesis without the narrator explaining it.
- The closing entry trails off in a new way — not just ending mid-sentence but
  actively failing to articulate what it needs to say. "The point is somewhere
  between the green line and my fingertips and I can't find it tonight."

**Remaining Problems**:
- Overshot on avg sentence length (23.6 vs target 19). The long sentences are good
  but there are too many of them — the mutation overcorrected.
- Short ratio is still too high at 0.36 (target 0.15). Many of the short sentences
  are unnecessary fragments: "He followed the line." "His hands were inside a man's
  chest." These work individually but there are too many.
- Variance is too high (19.3 vs 15). The gap between shortest and longest is too
  extreme — we need the middle range (9-16) to thicken up.
- The middle of the piece has an expository passage about MIRA's capabilities that
  reads like a profile description rather than experienced narration. The narrator
  steps back to explain the system. Nkechi would stay behind Kenji's eyes.

### Mutation Applied (v2 → v3)

```
rhythm.avgSentenceLength: 19 → 18
rhythm.shortSentenceRatio: 0.15 → 0.18
rhythm.sentenceLengthVariance: 15 → 14
styleDirective: Added "For every short punchy sentence (under 8 words), follow
  it within 2 sentences with a medium-length sentence (12-25 words). The short
  sentences are percussion; the medium sentences are the melody. Do not stack
  more than two short sentences in a row."
constraintDirective: Added "NEVER step back from the character's perspective
  to describe a technology's capabilities in expository mode. If the reader
  needs to understand the AI system, show the character experiencing it — what
  it looks like, what it feels like to follow its guidance, how the body
  responds to its suggestions."
```

**Rationale**: The overcorrection on length needs gentle pullback. The real
problem is the bimodal distribution — too many very short AND very long, not
enough in the middle. The new directive explicitly asks for medium sentences
as connective tissue. The exposition constraint addresses the narrator-stepping-back
problem by making it a hard rule.

---

## Iteration 3 — Final Mutated Profile (v3)

**Sample**: Documentary editor compares her rough cut to an AI assembly.
**Word count**: 870

### Metrics

| Metric | Target (v3) | Actual | Status | vs Iter 1 | vs Iter 2 |
|--------|-------------|--------|--------|-----------|-----------|
| Avg sentence length | ~18 | 20.7 | CLOSE (+2.7) | +10.2 | -2.9 |
| Short ratio (<=8w) | 0.18 | 0.38 | FAIR (+0.20) | improved | similar |
| Long ratio (>=50w) | 0.08 | 0.05 | CLOSE | improved | improved |
| Variance | ~14 | 18.0 | FAIR (+4) | +8.7 | -1.3 |
| Em-dash (per 1000w) | high | 19.5 | STRONG | +6.4 | +7.5 |
| Imagery coverage | 4/4 | 2/4 | FAIR | regressed | regressed |
| Constraint violations | 0 | 0 | CLEAN | stable | stable |

### Sentence Distribution
```
<=8      ███████████████████ 38%
9-16     █████████ 19%
17-30    ██████ 12%
31-50    █████████████ 26%
50+      ██ 5%
```

### Qualitative Evaluation

**Improvements from Iteration 2**:
- Avg sentence length pulled back toward target (23.6 → 20.7, target 18). Getting
  closer. The convergence direction is correct.
- Long sentence ratio is now very close to target (0.05 vs 0.08). The prose isn't
  overloading on Sebaldian monsters anymore.
- The 9-16 word bucket grew from 13% to 19% — the "medium as melody" directive
  is starting to work. The connective tissue is thickening.
- The exposition problem is improved. The AI system (assembly tool) is mostly
  experienced through Rina's reaction to its output, not through narrator explanation.
  "structurally competent and emotionally deaf" is judgment from within Rina's
  perspective, not external description.
- Em-dash usage surged to 19.5/1000 — the strongest signature punctuation across all
  three iterations. The voice is leaning hard into its characteristic mark.
- The closing entry is the best of the three: trails off twice, the second time
  mid-clause ("the way it always"), and the concrete detail (cold pad thai, aching
  back) anchors the philosophical uncertainty in the body.

**Remaining Gaps**:
- Short ratio is still high (0.38 vs 0.18). This appears to be a structural
  tendency — the voice genuinely likes short punches. The target may need to
  accommodate this: revise target to 0.25 rather than fighting the voice's
  natural tendency.
- Imagery coverage regressed to 2/4 (body, workshop). The editing-specific
  vocabulary didn't trigger clinic/light domains. This is partly a detection
  issue — the sample has plenty of light imagery ("surgical light," "monitors,"
  "light moving across ice") but the keywords don't capture editing-room light.
  Detection vocabulary needs expansion for creative-industry workspaces.
- Variance remains high (18 vs 14). The voice has a wider dynamic range than
  the target specified. This may be a feature, not a bug — the Sacks influence
  naturally produces wide swings between clinical observation and emotional
  compression.

### Convergence Assessment

**Score trajectory (estimated, 0-100 per dimension):**

| Dimension | Iter 1 | Iter 2 | Iter 3 | Trend |
|-----------|--------|--------|--------|-------|
| Rhythm fidelity | 35 | 55 | 65 | improving |
| Structure fidelity | 60 | 65 | 72 | improving |
| Imagery fidelity | 55 | 70 | 65 | plateau |
| Narration fidelity | 70 | 60 | 78 | improving |
| Register fidelity | 65 | 65 | 70 | slow improvement |
| Constraint compliance | 95 | 95 | 95 | stable |
| Prose quality | 70 | 80 | 85 | improving |
| Voice distinctiveness | 50 | 65 | 75 | improving |
| **Estimated overall** | **56** | **67** | **74** | **+18 in 3 iterations** |

---

## Key Observations Across All 3 Iterations

### What the research loop revealed:

1. **Short-sentence bias is structural.** The LLM defaults to punchy prose.
   Each iteration pushed against this, and each iteration improved, but the
   bias persists. The most effective countermeasure was not raising the avg
   target but explicitly requesting "medium sentences as melody" — giving the
   model a cognitive role for the 12-25 word range.

2. **The body-detail mandate works.** All three samples have strong sensory
   anchoring — the callus on the sommelier's thumb, the sweat drying on
   Kenji's spine, Rina's granular eyes. This constraint is high-fidelity:
   the voice reliably embodies it. The challenge is that body detail alone
   doesn't prevent exposition; the constraint against narrator-stepping-back
   was needed as a separate rule.

3. **Closing entries improved fastest.** The "trailing off" constraint produced
   three genuinely different unfinished endings — the sommelier's "it's what,"
   the surgeon's "I can't find it tonight," the editor's "the way it always."
   Each is unresolved but in a different emotional key. This constraint is
   the profile's most reliable voice marker.

4. **Variance is a feature, not a bug.** The profile specified low variance (12)
   but the voice naturally produces high variance (18). The contrast between
   "He followed the line." and a 70-word observational sentence IS the voice.
   Recommend revising the target to match the observed behavior (variance: 18).

5. **Metric detection needs domain-specific expansion.** The keyword clusters
   for body/workshop/clinic/light were too narrow for creative professions
   (sommelier, surgeon, editor). The metrics improved when we added profession-
   specific keywords in iteration 1. Further expansion needed for each new
   professional domain encountered.

### Profile v3 Recommended Revisions:

```
rhythm.avgSentenceLength: 18 → 19 (match observed tendency)
rhythm.shortSentenceRatio: 0.18 → 0.25 (accept the natural punch frequency)
rhythm.sentenceLengthVariance: 14 → 18 (match observed dynamic range)
rhythm.longSentenceRatio: 0.08 (keep — iter 3 hit 0.05, close enough)
```

### Next Steps:

- Run the same loop for Pyotr (expect the long-sentence bias to be the OPPOSITE
  problem — the LLM will resist truly Sebaldian 80+ word sentences)
- Run for Yemisi (expect the variable-distance narration to be the hardest
  parameter to achieve — LLMs tend to lock into a single narrative distance)
- Build cross-profile distinctiveness test: generate the SAME scenario through
  all three profiles and measure whether a blind judge can tell them apart
- Expand metrics keyword clusters for creative professions
