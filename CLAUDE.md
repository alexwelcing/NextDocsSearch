# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project overview

NextDocsSearch is an immersive 360 personal site (Alex Welcing): a WebGPU-only React Three
Fiber environment — panoramic worlds, a diegetic retro-CRT console called the **ARC Terminal**
(Archive Retrieval Console; never "Pip-Boy"), and in-scene modals for all content. Every URL is
a deep link into the scene, and every page also server-renders full semantic HTML as the SEO
layer and the reading surface for browsers without WebGPU.

Text in the scene renders through a vendored port of **windfoil** (texel-org, Apache-2.0):
exact box-filter coverage of quadratic Bezier glyph outlines computed per-pixel in WGSL — no
SDF atlases. See `lib/windfoil/LICENSE.md`.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development server |
| `pnpm build` | Full build: font atlases, article bodies, manifests, Next build, sitemap |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Prettier formatting |

Use `pnpm run lint` and `pnpm run build` as the real gates before pushing.

## Architecture

### Framework

- Next.js 16 Pages Router, React 19, TypeScript, pnpm. Path alias `@/*` → repo root.
- `reactStrictMode` is OFF deliberately: double-mount destroys the async WebGPURenderer init.

### The immersive app

- `pages/_app.tsx` mounts `components/immersive/ImmersiveApp.tsx` once; it persists across
  route changes. Page components only contribute crawlable HTML inside `#arc-page-content`
  (hidden while the scene runs) plus `<Head>` metadata.
- `ImmersiveApp`: WebGPU gate (navigator.gpu only — no probe requestAdapter; see comment),
  CRT boot sequence, compatibility banner, URL↔store sync via `lib/immersive/navigation.ts`.
- `ImmersiveCanvas`: R3F `Canvas` with `three/webgpu` WebGPURenderer (async `gl` factory +
  `extend(THREE)`), scene = PanoramaSphere (crossfading equirect worlds), Atmosphere (TSL
  instanced motes), SceneLights, CameraRig (inertial look), ArcDock, ImmersiveModals,
  SphereHunter.
- State: `stores/immersiveStore.ts` (zustand): bootPhase, dock, modal, world, quality, game.
- Worlds: `lib/immersive/worlds.ts` registry; panoramas in `public/background/`.
- Audio: `lib/immersive/audio.ts` SFX bus; clips in `public/sounds/arc/`.

### ARC Terminal dock (`components/immersive/dock/`)

Camera-anchored console (CameraAnchor spring). CRT screen = TSL materials in `CrtMaterials.ts`
(multiply scanlines need `premultipliedAlpha = true` under WebGPU). Six surfaces under
`dock/tabs/`: Archive, Search (lexical), Ship (streaming `/api/vector-search` NDJSON), Worlds,
Data, Game. The dock only opens modals / changes in-scene state — it never navigates away.

### Windfoil text engine (`lib/windfoil/`)

- Build step `scripts/generate-font-atlas.ts`: TTF → `public/fonts/*.wfa.{bin,json}`
  (monotone-piece curves + row-band tables + metrics; charset in `charset.ts`).
- Runtime: `atlas.ts` (loader), `layout.ts` (wrap/align/maxLines), `material.ts`
  (`createTextMesh`: instanced quads + wgslFn coverage shader over storage buffers),
  `wgsl.ts` (the vendored shader).
- React: `components/immersive/text/WindfoilText.tsx`. All in-scene text uses it.
- Storage buffers ride pointer parameters (WGSL `unrestricted_pointer_parameters`) — fine on
  Chrome-class WebGPU, the only supported tier.

### Content pipeline

- Articles: MDX in `pages/docs/articles/` (327 records).
- `scripts/generate-article-bodies.ts` → `public/arc/records/<slug>.json` (full text as blocks;
  consumed by the in-scene reader AND `pages/articles/[slug].tsx` SSG).
- Manifests in `lib/generated/*.json` feed APIs (`/api/arc/archive` is the dock index).
- Films: MP4s in `public/images/article-videos/` play in-scene via VideoTexture.

### Routes (all 360 deep links with crawlable HTML beneath)

`/`, `/articles`, `/articles/[slug]`, `/videos/[slug]`, `/about`, `/current-work`, `/pitch`,
`/agent-futures`, `/emergent-intelligence`, `/speculative-ai`, `/the-interface`.

## Verification

Headless WebGPU works via SwiftShader but only for single presents; for real screenshots run
headed Chromium under Xvfb (playwright with `--enable-unsafe-webgpu
--use-webgpu-adapter=swiftshader` and a virtual display via `xvfb-run`).

## Code style

- Prettier: single quotes, no semicolons, 100 char width, 2-space indentation.
- ESLint is the primary lint gate.

## Guardrails

- Do not re-add: XR/VR, cannon physics, Gaussian splats (WebGL-only lib), the removed labs
  (film-bridge, ProGen, galaxy, tablet terminal), or a WebGL fallback renderer.
- Keep the route/API surface small; content opens in-scene, not on new 2D pages.
- The SEO layer must stay: every content URL server-renders its full text.
