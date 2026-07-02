# Image Generation Review Checklist

## What We Generated

### Batch 1: Production Hill Climb (50 images)
- **Model**: Juggernaut XL
- **Purpose**: Parameter optimization
- **Status**: ✅ All 50 successful
- **Parameters tested**: 20-41 steps, CFG 6.0-8.4

### Batch 2: Exploration (50 images)
- **Model**: Juggernaut XL  
- **Purpose**: Shot variety discovery
- **Status**: ✅ All 50 successful
- **Tags used**: extreme angles (23x), single source lighting (8x), etc.

### Total: 100 successful generations

---

## What to Review

### 1. Image Quality Check
For each batch, open random samples and check:

- [ ] **Artifacts**: Any weird distortions, extra limbs, bad anatomy?
- [ ] **Noise**: Grainy or smooth at different step counts?
- [ ] **Sharpness**: Are details crisp or blurry?
- [ ] **Color**: Natural or oversaturated?
- [ ] **Composition**: Do the prompts match the output?

### 2. Safety Verification
- [ ] **NO children** in any images (hard rule)
- [ ] **NO text/watermarks** (check negative prompt worked)
- [ ] **Appropriate content** throughout

### 3. Parameter Correlation
Look for patterns:
- Which **step counts** produced best quality?
- Which **CFG values** gave best color/saturation?
- Did **extreme angles** actually work or fail?
- What **file size** correlates with best quality?

### 4. Technique Effectiveness
For exploration batch, which shot types worked:
- [ ] Extreme closeup/macro shots
- [ ] Dutch angles
- [ ] Volumetric lighting
- [ ] Frame-within-frame compositions
- [ ] Silhouette/rim lighting

---

## Location of Images

```
ComfyUI/output/
├── hillclimb_iter{1-5}_{index}_.png  (Production batch)
└── explore_iter{1-5}_{index}_.png     (Exploration batch)
```

---

## Decision Points

After reviewing, decide:

1. **Did Juggernaut XL work well?** Or should we test other models?
2. **What step count is optimal?** 25? 30? 35?
3. **What CFG range?** 6.5-7.5? 7.0-8.0?
4. **Which shot types succeeded?** Document for future use
5. **Any issues to fix?** Before running more

---

## Next Steps (AFTER Review)

Only after reviewing should we:
- Run targeted optimizations based on findings
- Test advanced techniques that showed promise
- Create production-ready workflows

**DO NOT generate more images until review is complete.**
