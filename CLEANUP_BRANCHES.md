# Branches to Delete - Repository Cleanup

This file documents branches that have been merged to main and can be safely deleted.

## Merged AI-Generated Branches (33 total)

These branches have been fully merged into main and can be deleted from remote:

### Claude Branches (29)
- `claude/add-future-tech-horror-stories-011CUzwLry4sijqDxaWA1ubC`
- `claude/add-map-thumbnails-O0fss`
- `claude/add-r3f-knowledge-index-011CUqtUvPnBqat7G3vPMQBH`
- `claude/add-research-articles-QaP3b`
- `claude/article-recommendation-modal-2PDCf`
- `claude/clean-360-scene-HHUwD`
- `claude/document-app-architecture-011CUoaXiLEauahzywxBjF1S`
- `claude/fix-article-display-yllLH`
- `claude/fix-article-table-mobile-af5Oq`
- `claude/fix-articles-loading-wAhyR`
- `claude/fix-bottom-navigation-DYqbd`
- `claude/fix-google-search-indexing-011CUckuubdGnStQ8XiBjNV5`
- `claude/fix-nav-article-links-c6r6m`
- `claude/fix-scene-alignment-transitions-Lr4cG`
- `claude/fix-score-calculation-exeMC`
- `claude/fix-tablet-click-crash-011CUm5p6GeWRba5nzEBeMrX`
- `claude/fix-threesixty-background-a1TSj`
- `claude/fix-useeffect-import-Lf24O`
- `claude/friendly-ship-persona-MefmZ`
- `claude/gaussian-splat-rigging-animation-011CUwkshNgYUKPV5bjesRG2`
- `claude/hide-season-picker-fix-tablet-011CUhKyuwS1sTtP57cV3tzo`
- `claude/merge-and-upgrade-threejs-01By2hVeGsq18UBJEeuVk31n`
- `claude/modern-workshop-organizer-Nx4OA`
- `claude/plan-3d-generation-utility-011CUwdzYCQueCN8yG4tCYoZ`
- `claude/quiz-tablet-holiday-theme-011CUfp8mEKece3hLoRQYtrH`
- `claude/rewrite-introduction-zcVFc`
- `claude/seo-speculative-ai-futures-N4pbk`
- `claude/social-share-images-clzxr`
- `claude/tablet-slide-out-overlay-011CUhPt6Q2SKd6Nx6oRNJmn`

### Codex Branches (4)
- `codex/build-ship-ai-persona-layer-with-memory`
- `codex/generate-article-images-in-all-sizes`
- `codex/generate-audio-and-image-assets`
- `codex/run-lighthouse-on-production-and-preview`

## Security Patch Branches (Confirmed Secure in Production)
- `claude/patch-rsc-vulnerability-01QXezisN3Zpau1KeJ6fMpsU`
- `vercel/react-server-components-cve-vu-hrcngx`

## Delete Command

To delete these branches from remote, run:

```bash
# Delete merged claude branches
git push origin --delete \
  claude/add-future-tech-horror-stories-011CUzwLry4sijqDxaWA1ubC \
  claude/add-map-thumbnails-O0fss \
  claude/add-r3f-knowledge-index-011CUqtUvPnBqat7G3vPMQBH \
  claude/add-research-articles-QaP3b \
  claude/article-recommendation-modal-2PDCf \
  claude/clean-360-scene-HHUwD \
  claude/document-app-architecture-011CUoaXiLEauahzywxBjF1S \
  claude/fix-article-display-yllLH \
  claude/fix-article-table-mobile-af5Oq \
  claude/fix-articles-loading-wAhyR \
  claude/fix-bottom-navigation-DYqbd \
  claude/fix-google-search-indexing-011CUckuubdGnStQ8XiBjNV5 \
  claude/fix-nav-article-links-c6r6m \
  claude/fix-scene-alignment-transitions-Lr4cG \
  claude/fix-score-calculation-exeMC \
  claude/fix-tablet-click-crash-011CUm5p6GeWRba5nzEBeMrX \
  claude/fix-threesixty-background-a1TSj \
  claude/fix-useeffect-import-Lf24O \
  claude/friendly-ship-persona-MefmZ \
  claude/gaussian-splat-rigging-animation-011CUwkshNgYUKPV5bjesRG2 \
  claude/hide-season-picker-fix-tablet-011CUhKyuwS1sTtP57cV3tzo \
  claude/merge-and-upgrade-threejs-01By2hVeGsq18UBJEeuVk31n \
  claude/modern-workshop-organizer-Nx4OA \
  claude/plan-3d-generation-utility-011CUwdzYCQueCN8yG4tCYoZ \
  claude/quiz-tablet-holiday-theme-011CUfp8mEKece3hLoRQYtrH \
  claude/rewrite-introduction-zcVFc \
  claude/seo-speculative-ai-futures-N4pbk \
  claude/social-share-images-clzxr \
  claude/tablet-slide-out-overlay-011CUhPt6Q2SKd6Nx6oRNJmn

# Delete merged codex branches
git push origin --delete \
  codex/build-ship-ai-persona-layer-with-memory \
  codex/generate-article-images-in-all-sizes \
  codex/generate-audio-and-image-assets \
  codex/run-lighthouse-on-production-and-preview

# Delete security patch branches
git push origin --delete \
  claude/patch-rsc-vulnerability-01QXezisN3Zpau1KeJ6fMpsU \
  vercel/react-server-components-cve-vu-hrcngx
```

## Cleanup Summary

**Files Removed:**
- `package-lock.json` (project uses pnpm, not npm)
- `build.log` (build artifact, should not be tracked)

**Files Updated:**
- `.gitignore` - Added `*.log` and `package-lock.json`

**Total Branches for Deletion:** 35
- 33 merged AI-generated branches
- 2 security patch branches (confirmed secure in production)
