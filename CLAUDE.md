# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project overview

NextDocsSearch is a focused Next.js content/portfolio site with:

- a cannon/glass-tile landing page
- a lightweight React Three Fiber scene launched from `/explore`
- an article archive with semantic search and recommendation surfaces
- selected video/article SEO pages

Old experimental labs have been removed: ProGen, procedural rooms, article levels, galaxy view, game/leaderboard/tablet terminal, admin media upload, and generation-only APIs.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development server |
| `pnpm build` | Full build: manifests, recommendations, embeddings, repair, Next build, sitemap |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Prettier formatting |

Use `pnpm run lint` and `pnpm run build` as the real gates before pushing.

## Architecture

### Framework and routing

- Next.js 16 Pages Router with React 19 and TypeScript.
- Pages live in `pages/`.
- API routes live in `pages/api/`.
- Path alias: `@/*` maps to project root.

### Active product routes

- `/`
- `/explore`
- `/articles`
- `/articles/[slug]`
- `/videos/[slug]`
- `/about`
- `/current-work`
- `/pitch`
- `/speculative-ai`
- `/agent-futures`
- `/emergent-intelligence`
- `/the-interface`

### Build pipeline

`pnpm build` runs:

1. `scripts/generate-image-manifest.ts`
2. `scripts/generate-article-manifest.ts`
3. `scripts/generate-recommendation-index.ts`
4. `lib/generate-embeddings.ts`
5. `scripts/repair-client-only-package.cjs`
6. `next build --webpack`
7. postbuild video sitemap + `next-sitemap`

Generated data lives in `lib/generated/*.json` and is consumed by runtime APIs. Prefer generated manifests over request-time filesystem scans.

### Content system

- Articles are MDX files in `pages/docs/articles/`.
- Article pages use SSG with fallback blocking and capped prebuilds.
- Article metadata/image/recommendation APIs should read generated manifests.

### 3D layer

Active scene path:

- `components/3d/Interactive3DExperience.tsx`
- `components/scene/Scene3D.tsx`
- `components/scene/SceneCanvas.tsx`
- `components/scene/SceneBackground.tsx`
- `components/scene/SceneCamera.tsx`
- `components/scene/SceneEnvironment.tsx`

The active 3D layer is presentation-only. Do not re-add cannon physics, game/leaderboard state, tablet terminal UI, or XR unless explicitly requested.

### AI and search

- Semantic/article answer surfaces use `/api/vector-search` and `lib/chat/*`.
- `openai-edge` remains for vector search.
- Removed generation-only UI/API paths should stay removed unless explicitly requested.

## Code style

- Prettier: single quotes, no semicolons, 100 char width, 2-space indentation, trailing commas where configured.
- ESLint is the primary lint gate.
- Package manager: pnpm.

## Cleanup guidance

- Keep the route/API surface small.
- Delete unused labs instead of preserving compatibility shims.
- Avoid adding new custom validators/test harnesses.
- Keep homepage first-arrival behavior as the tile/glass cannon landing page; users enter 3D from CTA/completion.
