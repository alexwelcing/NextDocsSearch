# NextDocsSearch Architecture Guide

## Product surface

NextDocsSearch is now a focused Next.js content/portfolio site with a lightweight interactive 3D entry experience.

Keep the product surface small:

- `/` — cannon/glass-tile landing page.
- `/explore` — entry point for the 3D scene and article archive.
- `/articles` and `/articles/[slug]` — article index/detail pages.
- `/videos/[slug]` — selected generated video pages.
- SEO/professional pages: `/about`, `/current-work`, `/pitch`, `/speculative-ai`, `/agent-futures`, `/emergent-intelligence`, `/the-interface`.

Removed product paths should stay removed unless explicitly reintroduced:

- legacy 360/tablet/game/leaderboard scene
- ProGen character lab
- procedural rooms/article levels
- galaxy view
- admin media upload UI
- in-app video/image generation labs

## Stack

- Next.js Pages Router
- React 19
- React Three Fiber for the modern scene layer
- Styled Components, CSS Modules, and Tailwind utility classes
- Supabase/OpenAI-backed article search
- pnpm

## Commands

- `pnpm dev` — local development
- `pnpm lint` — ESLint gate
- `pnpm build` — full production build, including manifest/recommendation/embedding generation
- `pnpm format` — Prettier formatting

Verification before pushing:

1. `pnpm run lint`
2. `pnpm run build`

## Build/data pipeline

`pnpm build` runs:

1. `scripts/generate-image-manifest.ts`
2. `scripts/generate-article-manifest.ts`
3. `scripts/generate-recommendation-index.ts`
4. `pnpm run embeddings`
5. `pnpm run repair:client-only`
6. `next build --webpack`

Generated manifests live in `lib/generated/` and are runtime inputs. Prefer manifest-backed APIs over request-time filesystem scans.

Current manifest-backed APIs:

- `pages/api/articles.ts`
- `pages/api/tile-images.ts`
- `pages/api/articles-enhanced.ts`
- `pages/api/articles/recommendations.ts`

## 3D architecture

The active scene path is:

- `components/3d/Interactive3DExperience.tsx`
- `components/scene/Scene3D.tsx`
- `components/scene/SceneCanvas.tsx`
- `components/scene/SceneBackground.tsx`
- `components/scene/SceneCamera.tsx`
- `components/scene/SceneEnvironment.tsx`

The scene is presentation-only: no cannon physics, game state, tablet terminal, or leaderboard.

## Cleanup rules

- Do not re-add visual test harnesses, bespoke validators, or old lab routes without explicit approval.
- Do not add request-time public-directory scans for image/article discovery; generate a manifest instead.
- Keep route and API surface small. If a route has no live UI caller, remove it.
- Favor deletion over compatibility shims for removed experiments.

## Important directories

- `pages/docs/articles/` — MDX article source
- `pages/articles/` — article routes
- `components/scene/` — modern 3D scene system
- `components/3d/` — active 3D components
- `components/ui/` — shared UI components
- `components/chat/`, `lib/chat/` — article-aware answer/search UI
- `lib/generated/` — generated manifests and recommendation index
- `lib/worlds/` — scene/world config

## Current warnings

`pnpm run lint` currently passes with a small number of warnings in unrelated legacy components/scripts. Do not treat those warnings as blockers unless your change touches them.
