# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NextDocsSearch is an immersive 3D content platform built with Next.js, React Three Fiber, and OpenAI. It combines a portfolio/article system with interactive 3D visualization, AI-powered semantic search, and gamification.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development server |
| `pnpm build` | Full build (generates manifests, embeddings, then `next build` + sitemap) |
| `pnpm lint` | Run ESLint |
| `pnpm type-check` | TypeScript check (`tsc --noEmit`) |
| `pnpm validate` | Lint + type-check combined |
| `pnpm format` | Prettier formatting |
| `pnpm test:visual` | Run Playwright visual tests |
| `pnpm test:visual:full` | Enhanced visual tests + analysis |

## Architecture

### Framework & Routing

- **Next.js 15** (Pages Router, not App Router) with React 19 and TypeScript
- Pages in `pages/`, API routes in `pages/api/`
- Path alias: `@/*` maps to project root (e.g., `@/components/`, `@/lib/`)

### Build Pipeline

The build (`pnpm build`) runs a multi-stage pipeline before `next build`:
1. `scripts/generate-image-manifest.ts` — maps article slugs to image paths, avoiding bundling ~650MB of assets into serverless functions
2. `scripts/generate-article-manifest.ts` — extracts article metadata from MDX frontmatter
3. `scripts/generate-recommendation-index.ts` — precomputes article recommendations
4. `lib/generate-embeddings.ts` — generates OpenAI embeddings for semantic search

Generated data lands in `lib/generated/*.json` and is consumed at runtime by API routes.

### Content System

- Articles are MDX files in `pages/docs/articles/` with `gray-matter` frontmatter
- Article detail pages use SSG (`getStaticPaths` + `getStaticProps` with `revalidate: 60`)
- Featured articles and collections defined in `lib/featured-articles.ts`
- Image resolution at runtime via `lib/article-images.ts` reading from the generated image manifest

### 3D Layer (React Three Fiber)

- Main scene: `components/3d/scene/` (Scene3D, SceneCanvas, SceneCamera, SceneBackground, SceneEnvironment)
- Interactive elements: `components/3d/interactive/` (tablet, article display panels)
- Physics: `@react-three/cannon`; post-processing: `@react-three/postprocessing`
- Scene3D is dynamically imported with `ssr: false`
- Performance utilities in `lib/3d/performanceUtils.ts` (geometry/material/texture caching, LOD, frustum culling, instancing)

### AI & Search

- OpenAI embeddings stored in Supabase vector DB for semantic search (`/api/vector-search`)
- AI chat persona defined in `lib/ai/shipPersona.ts`
- FAL AI image generation via `/api/fal/generate`
- Uses `openai-edge` and Vercel `ai` SDK for streaming responses

### Data Layer

- **Supabase**: PostgreSQL + vector search + media storage + game leaderboard
- **Supabase client**: initialized in `lib/supabaseClient.ts`
- **Admin auth**: API key–based via `lib/auth/admin-auth.ts`

### Context Providers

App-level providers in `pages/_app.tsx`:
- `JourneyContext` — quest/achievement/gamification state (persisted to localStorage)
- `ArticleDiscoveryProvider` — article browsing state
- `SupabaseDataContext` — shared Supabase data

### Key UI Components

- `components/ui/` — Button, Dialog, ArticleCard, CircleNav, SearchDialog, etc.
- `components/overlays/` — GameHUD, Leaderboard, QuestNotification
- Styling: Tailwind CSS + Styled Components + CSS Modules (in `styles/`)

## Environment Variables

Required (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `ADMIN_API_KEY` — admin endpoint authentication
- `OPENAI_KEY` — OpenAI API key
- `NEXT_PUBLIC_SITE_URL` — canonical site URL

## Code Style

- Prettier config in `package.json`: single quotes, no semicolons, 100 char width, 2-space tabs, trailing commas (es5)
- ESLint extends `next/core-web-vitals`
- Package manager: **pnpm** (v9.7.1)
