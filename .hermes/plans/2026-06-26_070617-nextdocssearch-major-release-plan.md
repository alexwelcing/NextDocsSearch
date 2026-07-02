# NextDocsSearch Major Site Release Plan

> **For Hermes:** This is a planning-only document. Do not implement from this file until the release scope is explicitly approved. When executing, use small branches/commits and verify each phase before moving on.

**Goal:** Ship a polished, high-confidence next major site release centered on an unforgettable no-menu Rive cannon landing page that leads into the 360/3D experience, while holding back experimental/generated/local-only systems that are not production-ready.

**Architecture:** Treat this release as a curated product launch, not a dump of every in-progress branch. The homepage becomes a focused interactive entry experience: Rive cannon + glass/image wall + cinematic transition into the 3D scene. Secondary content remains reachable after the landing interaction or from in-experience UI, not from visible first-arrival menu links.

**Tech Stack:** Next.js 15, React 19, TypeScript, R3F/Three.js, existing glass breaking components, new Rive runtime via `@rive-app/react-canvas` or equivalent, Playwright/browser smoke tests, existing `pnpm run lint`, `pnpm run type-check`, `pnpm run build`, and `pnpm run test:visual` gates.

---

## Current Context / Assumptions

- Branch `main` is now fast-forwarded to `origin/main` at `15fa344 fix: restore tile landing page`.
- The working tree is intentionally dirty with a large set of local changes, deletes, generated images, film bridge work, image grading/orchestrator work, and content assets.
- Homepage invariant from memory: first-arrival homepage should show the tile/glass cannon landing page first; users enter the 360/3D scene via CTA/completion. Do not replace homepage with direct 360 scene unless explicitly confirmed.
- Current homepage entry is in `pages/index.tsx`.
- Current cannon/glass landing implementation is in `components/HeroMosaic.tsx`, `components/ThrowBall.tsx`, `components/GlassBreakEffect.tsx`, and `components/GlassCrackOverlay.tsx`.
- Current `pages/index.tsx:350-390` still includes visible CTA/menu-like choices (`Read Articles`, `3D Experience`). For this release, the first-arrival landing page should have no visible menu items at all.
- `package.json` currently has no Rive dependency.
- Existing verification scripts include `pnpm run lint`, `pnpm run type-check`, `pnpm run build`, `pnpm run test:visual`, and node/vitest tests for some local systems.

---

## Release Principle

This release should feel like one complete world:

1. Arrive on a full-screen interactive mystery/carnival/portal surface.
2. No nav, no article menu, no ordinary portfolio buttons on first paint.
3. A beautiful Rive cannon is the only obvious instrument.
4. Cannon fire breaks glass/image tiles with satisfying feedback.
5. The 360 world is revealed and entered after completion.
6. Inside/after entry, users can reach articles, chat/tablet, 3D exploration, and story worlds.

If a feature breaks that illusion, is experimental, or needs operator/local services, it should not go out in this major public release.

---

## What Should Go Out

### 1. No-menu Rive cannon landing page

**Ship:** Yes — flagship release item.

**Scope:**

- Replace `components/ThrowBall.tsx` SVG/CSS cannon with a Rive-driven cannon component.
- Keep the existing `ThrowBall` public API initially to limit blast radius: `onImpact`, `disabled`, `containerRef`.
- Add a Rive asset under `public/rive/landing-cannon.riv` or `public/animations/landing-cannon.riv`.
- Use state machine inputs if available: aim angle, charging/firing, recoil, idle breathing, loaded/unloaded.
- Remove first-arrival visible navigation and CTA buttons from `pages/index.tsx:350-390`.
- Keep non-visible accessibility escape options only: keyboard instructions, skip link hidden until focus, or a small post-timeout fallback that does not visually read as a menu.

**Likely files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify or replace: `components/ThrowBall.tsx`
- Modify: `components/HeroMosaic.tsx`
- Modify: `pages/index.tsx`
- Add: `public/rive/landing-cannon.riv`
- Optional add: `components/landing/RiveCannon.tsx`
- Optional add: `components/landing/LandingCannonExperience.tsx`

**Acceptance criteria:**

- First paint has no visible nav/menu/CTA items.
- The cannon is visibly Rive-rendered, animated, and reacts to pointer movement/fire.
- User can complete the landing interaction without any menu button.
- Keyboard users can complete or skip without needing a mouse.
- Reduced-motion users get a non-disorienting version.
- No people/faces/crowds are used as targets; targets remain abstract/art/glass/image surfaces.

### 2. Polished glass/image wall reveal

**Ship:** Yes.

**Scope:**

- Keep the current `HeroMosaic` glass tile wall because it already matches the release concept.
- Make all feedback clearer: aim line, impact flash, crack growth, shatter, progress, transition.
- Reduce textual UI. Replace the top instruction pill with diegetic microcopy or a subtle engraved status that does not feel like a menu.
- Ensure progress is visible but atmospheric.

**Likely files:**

- Modify: `components/HeroMosaic.tsx`
- Modify: `components/GlassBreakEffect.tsx`
- Modify: `components/GlassCrackOverlay.tsx`
- Modify: `pages/api/tile-images.ts`

**Acceptance criteria:**

- 12 panels are hittable on desktop.
- Mobile has a viable tap-to-fire path.
- Broken panels remain visibly gone/revealed.
- Completion fires once and only once.

### 3. 360/3D scene entry after landing completion

**Ship:** Yes, but only the stable entry path.

**Scope:**

- Keep `pages/index.tsx` state flow: `HeroMosaic onAllPanelsBroken -> handleEnter3D -> Scene3D`.
- Ensure the landing completion transition does not leave stale listeners or overlays.
- Preserve `InteractiveTablet` and core 3D entry if stable.

**Likely files:**

- Modify: `pages/index.tsx`
- Modify: `components/scene/Scene3D.tsx`
- Modify: `components/scene/SceneCanvas.tsx`
- Modify: `components/3d/interactive/InteractiveTablet.tsx`

**Acceptance criteria:**

- After all panels break, user lands in 3D scene without a blank screen.
- Browser console has no uncaught errors.
- User can return to landing only through deliberate in-scene action, not accidental overlay confusion.

### 4. Article reading experience and core content routes

**Ship:** Yes, but curated.

**Scope:**

- Keep `/articles` and `/articles/[slug]` if build passes and content quality is high.
- Include the strongest curated article/image manifests.
- Ensure article cards, recommendations, and metadata are correct.

**Likely files:**

- Modify: `pages/articles/index.tsx`
- Modify: `pages/articles/[slug].tsx`
- Modify: `lib/generated/article-manifest.json`
- Modify: `lib/generated/image-manifest.json`
- Modify: `lib/generated/recommendation-index.json`
- Modify: `components/ui/ArticleLayoutNew.tsx`
- Modify: `components/articles/StoryCompanionPanel.tsx`

**Acceptance criteria:**

- `/articles` loads quickly.
- At least 10 representative articles render correctly.
- Open Graph/SEO metadata is not stale or broken.
- Missing images have graceful fallbacks.

### 5. Ship-facing AI/product profile pages

**Ship:** Probably yes if stable and aligned.

**Scope:**

- Keep high-value public narrative pages: `/agent-futures`, `/emergent-intelligence`, `/speculative-ai`, `/the-interface`.
- Verify copy, internal links, images, and mobile layout.

**Likely files:**

- Modify: `pages/agent-futures/index.tsx`
- Modify: `pages/emergent-intelligence/index.tsx`
- Modify: `pages/speculative-ai/index.tsx`
- Modify: `pages/the-interface/index.tsx`

**Acceptance criteria:**

- Pages are discoverable after landing/inside site flow, but not as first-paint homepage menu items.
- Pages build statically or dynamically without prerender failures.

### 6. SEO, structured data, sitemap, and social preview

**Ship:** Yes.

**Scope:**

- Preserve/refresh `StructuredData` in `pages/index.tsx`.
- Verify `next-sitemap` output.
- Verify social preview image exists and matches release positioning.
- Keep canonical URL correct.

**Likely files:**

- Modify: `pages/index.tsx`
- Modify: `components/StructuredData.tsx`
- Modify: `next-sitemap.config.js` if present
- Modify: `public/social-preview.png` if needed

**Acceptance criteria:**

- `next build` and `postbuild` sitemap generation pass.
- Homepage metadata does not promise visible nav that no longer exists.

### 7. Visual/performance polish for the landing page

**Ship:** Yes.

**Scope:**

- Optimize landing assets: Rive, tile images, background panorama.
- Keep image targets abstract/non-human-coded.
- Avoid loading the full 3D scene before the user completes landing unless a lightweight prefetch is safe.
- Keep bundle impact of Rive acceptable.

**Likely files:**

- Modify: `components/HeroMosaic.tsx`
- Modify: `components/ThrowBall.tsx` or `components/landing/RiveCannon.tsx`
- Modify: `next.config.js`
- Modify: `pages/api/tile-images.ts`

**Acceptance criteria:**

- Landing first contentful paint remains acceptable locally and in production preview.
- No large local/generated files accidentally inflate the public build.
- Rive loads gracefully if the `.riv` asset fails.

### 8. Basic accessibility and fallback paths

**Ship:** Yes.

**Scope:**

- The first-arrival page can be no-menu visually, but it cannot be a trap.
- Add keyboard fire controls: arrow/WASD or pointer-follow fallback, Space/Enter to fire.
- Add screen-reader-only instructions and a focusable skip route after landing intro.
- Add `prefers-reduced-motion` handling.

**Likely files:**

- Modify: `components/HeroMosaic.tsx`
- Modify: `components/ThrowBall.tsx` or `components/landing/RiveCannon.tsx`
- Modify: `pages/index.tsx`
- Modify: `styles/globals.css` or `styles/Home.module.css`

**Acceptance criteria:**

- Keyboard-only user can enter 3D or reach articles.
- Screen reader has a useful page title and concise instructions.
- Reduced motion avoids extreme shake/recoil/shatter storms.

### 9. Production-safe analytics/telemetry-lite

**Ship:** Maybe, only if minimal and privacy-safe.

**Scope:**

- Track landing completion, cannon fires, panels broken, 3D entry, article click-through if analytics already exists.
- Do not block release on analytics.

**Likely files:**

- Optional modify: `lib/analytics.ts`
- Optional modify: `components/HeroMosaic.tsx`
- Optional modify: `pages/index.tsx`

**Acceptance criteria:**

- No analytics secrets in repo.
- No runtime errors if analytics is absent.

### 10. Stable generation manifests and selected assets

**Ship:** Yes, but only curated outputs required by public pages.

**Scope:**

- Include final generated article/image/recommendation manifests only if they are intentionally part of public content.
- Include selected public images that are referenced by manifests/pages.
- Exclude hill-climb experiments, append-only grading logs, local pipeline outputs unless a page explicitly needs them.

**Likely files:**

- Modify: `lib/generated/article-manifest.json`
- Modify: `lib/generated/image-manifest.json`
- Modify: `lib/generated/recommendation-index.json`
- Keep selected: `public/images/articles/*`
- Keep selected: `public/images/multi-art/*`

**Acceptance criteria:**

- Every manifest image path resolves locally.
- No huge accidental data dumps.
- No broken references from article cards.

### 11. Core 3D scene fixes only

**Ship:** Yes, if required for homepage flow.

**Scope:**

- Fix only blockers in `Scene3D`, `SceneCanvas`, and immediate 3D entry components.
- Do not attempt broad 3D architecture rewrites during release hardening.

**Likely files:**

- Modify: `components/scene/Scene3D.tsx`
- Modify: `components/scene/SceneCanvas.tsx`
- Modify: `components/3d/Interactive3DExperience.tsx`
- Modify: `components/3d/interactive/InteractiveTablet.tsx`

**Acceptance criteria:**

- Entering 3D works after landing.
- In-scene critical UI opens/closes.
- No infinite render loops or obvious console errors.

### 12. Release documentation / launch notes

**Ship:** Yes, concise.

**Scope:**

- Document what changed, test evidence, known limitations, and rollback instructions.
- Keep this as internal release notes unless user wants public copy.

**Likely files:**

- Add: `.hermes/release-notes/major-release-YYYY-MM-DD.md` or `RELEASE_NOTES.md`

**Acceptance criteria:**

- Anyone can understand what shipped, what was held, and how it was verified.

---

## What Should Not Go Out In This Release

### A. Film Bridge / local video generation control plane

**Hold.**

These appear as local/operator tooling and should not ship publicly until isolated behind an admin route, auth, or separate deployment story.

Likely hold/exclude paths:

- `pages/film-bridge/`
- `pages/api/film-bridge/`
- `lib/film-bridge/`
- `scripts/film-bridge-bun.ts`
- `scripts/film-bridge-manager.ts`
- `FILM_BRIDGE_E2E_REPORT.md`
- `FILM_BRIDGE_QUICKSTART.md`

### B. Image grading / ACC queue / orchestrator experiments

**Hold unless already required by public pages.**

Likely hold/exclude paths:

- `lib/acc-queue/`
- `lib/image-grading/`
- `lib/orchestrator/`
- `tests/acc-client.test.ts`
- `tests/image-grader.test.ts`
- `tests/orchestrator.test.ts`
- `vitest.node.config.ts` only if these tests are not part of public release gate

### C. Hill-climb and pipeline outputs

**Hold.**

Likely hold/exclude paths:

- `hill-climb-output/`
- `pipeline-output/`
- `lib/generated/image-grades-append.ndjson`
- `lib/generated/image-grades.json`

### D. Raw generation scripts and stack manager docs

**Hold unless needed for build.**

Likely hold/exclude paths:

- `scripts/generation-stack-manager.ts`
- `scripts/validate-generation-stack.ts`
- `scripts/HILL_CLIMB_README.md`
- `scripts/README-IMAGE-GENERATION.md`
- `COMFY_VIDEO_RESOURCES.md`
- `BUN_MIGRATION.md`
- `BUN_QUICKSTART.md`

### E. Large `public/videos/` artifacts

**Hold unless a page explicitly references them and they are real production assets.**

Release should avoid accidentally shipping placeholder or local generated videos.

### F. Admin/progen/experimental 3D room systems

**Hold unless already linked in the stable 3D flow.**

Likely review/hold paths:

- `components/3d/progen/`
- `components/3d/rooms/AdvancedRoomRenderer.tsx`
- `components/3d/navigation/NavigationSystem.tsx` if not used by stable flow
- `components/3d/physics/PhysicsWorld.tsx` if it introduces dependency/build risk

### G. Deleted legacy pages/components unless explicitly restored

**Hold/restoration decision needed.**

Many paths are currently deleted in local progress. Do not silently ship deletes unless intentional. Classify each deletion as:

- intentional removal,
- replaced by new page/component,
- accidental from local work.

Examples requiring classification:

- `pages/chat.tsx`
- `components/SearchDialog.tsx`
- `components/KnowledgeBaseUI.tsx`
- `components/KnowledgeArchive.tsx`
- `pages/docs/*`
- `pages/docs/r3f-knowledge/*`

---

## Proposed 15-Item Implementation Plan

### Item 1: Freeze and classify the current worktree

**Objective:** Prevent accidental release of unrelated local changes.

**Files:**

- Read-only review of all changed/untracked paths.
- Create: `.hermes/release-audit/major-release-file-classification.md`

**Steps:**

1. Run `git status --short --branch > .hermes/release-audit/status-before-release.txt`.
2. Categorize every changed/untracked top-level group as `ship`, `hold`, `needs-review`, or `discard-later`.
3. Mark every deletion as intentional or needs restoration.
4. Do not stage or commit until this file exists.

**Verification:**

- Every dirty top-level area is assigned exactly one category.
- No generated/local-output directory is categorized as `ship` without a page reference.

### Item 2: Create a clean release worktree from current `origin/main`

**Objective:** Avoid publishing unrelated dirty-tree changes.

**Files:**

- New external worktree, e.g. `/tmp/nextdocssearch-major-release` or Windows-safe equivalent.

**Steps:**

1. Run `git fetch origin main`.
2. Create a clean worktree from `origin/main`.
3. Copy only approved `ship` files into it as implementation proceeds.
4. Run all gates from the clean worktree, not from the dirty source tree.

**Verification:**

- `git status --short` in the release worktree only shows intentional release changes.

### Item 3: Add Rive dependency and asset convention

**Objective:** Establish the Rive runtime and asset location.

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Add: `public/rive/landing-cannon.riv`

**Steps:**

1. Add `@rive-app/react-canvas` or the current recommended Rive React runtime.
2. Install with `pnpm install` in the release worktree.
3. Place final cannon `.riv` asset under `public/rive/landing-cannon.riv`.
4. Document state machine names/inputs in a comment near the Rive component.

**Verification:**

- `pnpm install` succeeds.
- Rive package appears in `pnpm-lock.yaml`.
- Browser can request `/rive/landing-cannon.riv` with 200.

### Item 4: Build `RiveCannon` as a drop-in replacement

**Objective:** Replace the CSS/SVG cannon visual while keeping current interaction behavior stable.

**Files:**

- Add: `components/landing/RiveCannon.tsx`
- Modify: `components/ThrowBall.tsx` or gradually rename to `components/landing/LandingCannonController.tsx`

**Steps:**

1. Keep existing aiming, click-to-fire, arc projectile, and `onImpact` logic.
2. Render Rive cannon at the existing base position.
3. Drive Rive inputs for aim/recoil/fire if the asset exposes them.
4. Add fallback visual if Rive fails to load.
5. Avoid changing `HeroMosaic` API in this task.

**Verification:**

- TypeScript compiles for the edited component.
- Pointer movement visibly aims cannon.
- Pointer down fires exactly one projectile.

### Item 5: Remove visible homepage menu/CTA items

**Objective:** Make first arrival immersive and menu-free.

**Files:**

- Modify: `pages/index.tsx:314-392`
- Possibly modify: `styles/Home.module.css`

**Steps:**

1. Remove the visible `Read Articles` `Link` and `3D Experience` button from the first-arrival overlay.
2. Reduce or remove the big marketing overlay if it competes with the cannon.
3. Keep metadata/structured data unchanged unless copy needs adjustment.
4. Add a screen-reader-only or focus-only escape path if needed.

**Verification:**

- Visual browser smoke: no visible menu items or CTA buttons on first paint.
- `Tab` reveals accessible controls/skip path without breaking the no-menu visual design.

### Item 6: Make landing instructions diegetic and minimal

**Objective:** Clarify what to do without making the page look like a dashboard.

**Files:**

- Modify: `components/HeroMosaic.tsx`

**Steps:**

1. Replace the current pill text (`Aim the carnival cannon...`) with a subtle in-world label or animated glint.
2. Show progress in a non-menu visual way: chamber lights, fuse segments, or small engraved counter.
3. Make first shot obvious within 2 seconds.

**Verification:**

- New user can infer action without visible menu.
- Text does not cover central targets or block clicks.

### Item 7: Improve glass/cannon satisfaction pass

**Objective:** Make the flagship interaction feel premium.

**Files:**

- Modify: `components/HeroMosaic.tsx`
- Modify: `components/GlassBreakEffect.tsx`
- Modify: `components/GlassCrackOverlay.tsx`
- Modify: `components/ThrowBall.tsx` or `components/landing/RiveCannon.tsx`

**Steps:**

1. Tune recoil, flash, particle/shard timing, impact sound placeholder hooks if audio is planned.
2. Add hit variation so repeated shots do not feel mechanical.
3. Ensure broken state persists and completion cannot double-fire.
4. Keep effects performant; avoid excessive DOM nodes per shard.

**Verification:**

- Break all panels in browser.
- No duplicate `Entering the 360 scene` transitions.
- No console errors.

### Item 8: Mobile/touch landing pass

**Objective:** Make the cannon interaction viable on phone/tablet.

**Files:**

- Modify: `components/HeroMosaic.tsx`
- Modify: `components/ThrowBall.tsx` or `components/landing/RiveCannon.tsx`
- Modify: `pages/index.tsx`

**Steps:**

1. Test tap-to-aim/fire.
2. Reduce panel hit count or tile count on small screens if needed.
3. Make cannon scale and position safe around browser UI.
4. Avoid hover-only affordances.

**Verification:**

- Browser devtools mobile viewport can complete landing.
- No target is unreachable under the cannon or viewport chrome.

### Item 9: Accessibility/reduced motion pass

**Objective:** Keep no-menu visual design without trapping users.

**Files:**

- Modify: `components/HeroMosaic.tsx`
- Modify: `components/ThrowBall.tsx` or `components/landing/RiveCannon.tsx`
- Modify: `pages/index.tsx`

**Steps:**

1. Add keyboard aim/fire controls.
2. Add screen-reader instructions.
3. Add reduced-motion mode to shorten/soften shatter/recoil/portal transitions.
4. Ensure focus is managed when entering the 3D scene.

**Verification:**

- Complete landing with keyboard only.
- `prefers-reduced-motion` disables intense animations.

### Item 10: Curate public assets and manifests

**Objective:** Include only assets needed for public pages.

**Files:**

- Modify: `lib/generated/article-manifest.json`
- Modify: `lib/generated/image-manifest.json`
- Modify: `lib/generated/recommendation-index.json`
- Modify: `pages/api/tile-images.ts`
- Keep selected: `public/images/articles/*`
- Keep selected: `public/images/multi-art/*`

**Steps:**

1. Generate or audit manifests.
2. Write a script/check to verify every referenced image exists.
3. Exclude `hill-climb-output`, `pipeline-output`, grading logs, and local-only generated files.

**Verification:**

- Manifest image existence check passes.
- `/api/tile-images` returns only safe abstract/non-human-coded imagery.

### Item 11: Stabilize articles and public story pages

**Objective:** Ensure the rest of the public site is solid after entering/exploring.

**Files:**

- Modify: `pages/articles/index.tsx`
- Modify: `pages/articles/[slug].tsx`
- Modify: `pages/agent-futures/index.tsx`
- Modify: `pages/emergent-intelligence/index.tsx`
- Modify: `pages/speculative-ai/index.tsx`
- Modify: `pages/the-interface/index.tsx`

**Steps:**

1. Visit each route locally.
2. Fix missing imports, broken images, layout overflow, and SEO regressions.
3. Do not add new feature scope.

**Verification:**

- Each route loads in browser without console errors.
- Mobile viewport is acceptable.

### Item 12: Stabilize 3D entry only

**Objective:** Ensure landing-to-3D path works without broad 3D rewrites.

**Files:**

- Modify: `components/scene/Scene3D.tsx`
- Modify: `components/scene/SceneCanvas.tsx`
- Modify: `components/3d/interactive/InteractiveTablet.tsx`
- Modify: `pages/index.tsx`

**Steps:**

1. Enter 3D from completed landing.
2. Open and close tablet.
3. Trigger or skip in-scene game if it remains part of the release.
4. Fix only release-blocking errors.

**Verification:**

- 3D loads after landing completion.
- Tablet opens/closes.
- No blank screen or fatal WebGL error on desktop.

### Item 13: Add a real release smoke test script

**Objective:** Make the final test repeatable.

**Files:**

- Add: `tests/release-smoke.spec.ts` or add flow to existing `tests/visual-test-runner.js`
- Possibly add: `playwright.config.ts` if missing
- Modify: `package.json` scripts if needed, e.g. `test:release-smoke`

**Steps:**

1. Start app locally.
2. Navigate to `/`.
3. Assert no visible nav/menu/CTA on first paint.
4. Simulate cannon shots across all tiles.
5. Assert transition into 3D scene.
6. Visit `/articles` and one article.
7. Visit key narrative pages.
8. Capture screenshots on failure.

**Verification:**

- `pnpm run test:release-smoke` passes locally.
- Failure screenshots are saved under a predictable ignored artifact directory.

### Item 14: Run full release gates from clean worktree

**Objective:** Prove the release is shippable.

**Commands:**

- `pnpm run lint`
- `pnpm run type-check`
- `pnpm run build`
- `pnpm run test:visual`
- `pnpm run test:release-smoke` once added

**Expected:**

- All pass, or any failure is documented as unrelated with evidence and a concrete fix/hold decision.

**Verification:**

- Save logs or summarized output in release notes.

### Item 15: Production preview test and launch/rollback plan

**Objective:** Test the real deployed artifact, not just local dev.

**Steps:**

1. Push release branch to GitHub.
2. Open preview deployment.
3. Run manual and automated smoke against preview URL.
4. Check network panel for missing Rive/image assets.
5. Check browser console.
6. Verify social preview/canonical metadata.
7. Prepare rollback: previous main SHA and command/path to redeploy or revert.

**Verification:**

- Preview landing interaction completes.
- 3D entry works.
- Article route works.
- No missing `/rive/landing-cannon.riv` or image references.
- Rollback path is documented before production promotion.

---

## Real Test-Through Plan

### Local clean-worktree automated gates

Run from the clean release worktree:

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run type-check
pnpm run build
pnpm run test:visual
pnpm run test:release-smoke
```

If `pnpm install --frozen-lockfile` fails after adding Rive, run `pnpm install` once intentionally, commit updated `pnpm-lock.yaml`, then restore frozen install as the repeatable gate.

### Local manual browser script

1. Start dev server: `pnpm dev`.
2. Open `http://localhost:7342/`.
3. Confirm first paint:
   - no visible nav,
   - no `Read Articles`,
   - no `3D Experience`,
   - Rive cannon visible,
   - glass/image wall visible,
   - subtle instruction only.
4. Move mouse/touch around:
   - cannon aims,
   - Rive state changes,
   - aim indicator feels responsive.
5. Fire at several panels:
   - projectile leaves cannon,
   - cracks appear,
   - glass breaks after intended hit count,
   - progress is visible.
6. Break all panels:
   - portal/transition appears once,
   - 3D scene loads.
7. In 3D:
   - no blank screen,
   - tablet opens/closes,
   - return/exit behavior is intentional.
8. Navigate directly to `/articles`:
   - page loads,
   - images render,
   - at least one article opens.
9. Navigate directly to `/agent-futures`, `/emergent-intelligence`, `/speculative-ai`, `/the-interface`.
10. Repeat key landing flow in a mobile viewport.
11. Repeat with keyboard only.
12. Repeat with reduced motion enabled.

### Preview/production gates

Against the deployment preview URL:

1. Run the release smoke test pointed at preview URL.
2. Manual first-paint verification.
3. Manual cannon completion.
4. Manual 3D entry.
5. Manual articles route.
6. Check console/network for missing assets.
7. Lighthouse quick check for homepage performance/accessibility regressions.

---

## Risks / Tradeoffs

- **Rive asset dependency:** If the `.riv` file or state machine names are wrong, the flagship cannon can fail. Mitigation: keep a CSS/SVG fallback behind the Rive component.
- **No-menu homepage vs accessibility:** Visually no menu is desired, but hidden/focus-only escape paths are still needed. Mitigation: screen-reader/focus-only controls that do not alter first-paint visual concept.
- **Dirty worktree risk:** Current repo has many unrelated changes. Mitigation: use a clean release worktree and copy only approved files.
- **Generated asset bloat:** Many local images/videos/logs can accidentally ship. Mitigation: manifest existence checks and explicit asset allowlist.
- **3D scene instability:** Broad 3D changes can derail the release. Mitigation: only fix landing-to-3D blockers.
- **Build scripts generate content:** `pnpm run build` runs manifest generation and embeddings. Mitigation: run in clean worktree and inspect generated diffs before committing.

---

## Open Questions

1. Do we already have a final Rive cannon asset, or should the implementation first use a placeholder `.riv` while design iterates?
2. Should the landing interaction be mandatory for all first-arrival users, or should returning users who completed it once land directly in 3D?
3. Should `/articles` be visually hidden from homepage only, or should it also be de-emphasized in the 3D scene/tablet?
4. Are the deleted legacy docs/chat routes intentionally removed for this release?
5. Is audio allowed on cannon fire/shatter if it is user-initiated, or should launch stay silent?
6. Should the final public release include any Film Bridge/video generation surface, or is that explicitly internal only for now?

---

## Recommended Release Cut

**Ship:**

- No-menu Rive cannon landing page.
- Polished glass/image reveal.
- Stable transition into 3D.
- Stable articles/index/article pages.
- Stable public narrative pages.
- SEO/sitemap/social metadata.
- Curated assets only.
- Repeatable release smoke test.

**Hold:**

- Film Bridge.
- Local generation stack controls.
- Image grading/orchestrator experiments.
- Hill-climb/pipeline outputs.
- Large public videos unless explicitly referenced.
- Admin/progen/experimental 3D systems unless already stable and required.
- Any deletion of legacy public routes not explicitly approved.

**Definition of done:**

- Clean release worktree contains only intentional files.
- `pnpm run lint`, `pnpm run type-check`, `pnpm run build`, visual test, and release smoke pass.
- Preview deployment manually verifies first-paint no-menu Rive cannon, complete glass break flow, 3D entry, article route, mobile, keyboard, and reduced-motion paths.
- Rollback path documented before production promotion.
