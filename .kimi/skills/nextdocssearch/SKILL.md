# NextDocsSearch Development Skill

Comprehensive guide for AI agents working on the NextDocsSearch codebase.

## Project Overview

NextDocsSearch is an immersive 3D content platform built with Next.js, React Three Fiber, and AI integrations. It combines a portfolio/article system with interactive 3D visualization, AI-powered semantic search, and gamification.

**Live Site**: https://alexwelcing.com

## Tech Stack Quick Reference

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (Pages Router), React 19, TypeScript (strict) |
| 3D | React Three Fiber, Drei, Cannon (physics), Postprocessing |
| AI / ML | OpenAI embeddings, Vercel AI SDK, FAL AI image generation |
| Database | Supabase (PostgreSQL + pgvector + storage) |
| Styling | Tailwind CSS, Styled Components, CSS Modules |
| Deployment | Vercel |

## Essential Commands

```bash
# Development
pnpm dev                    # Start dev server on localhost:3000
pnpm build                  # Full production build
pnpm lint                   # ESLint check
pnpm type-check             # TypeScript check (tsc --noEmit)
pnpm validate               # Lint + type-check combined

# Content/Build Pipeline
pnpm embeddings             # Generate OpenAI embeddings for articles

# Testing
pnpm test:visual            # Run Playwright visual tests
pnpm test:visual:full       # Enhanced visual tests + analysis
```

## Project Structure

```
/workspaces/NextDocsSearch/
├── pages/                  # Next.js Pages Router
│   ├── index.tsx          # 3D scene entry (ThreeSixty component)
│   ├── about.tsx          # About page
│   ├── articles/          # Article system
│   │   ├── index.tsx      # Articles listing
│   │   └── [slug].tsx     # Article detail page
│   ├── api/               # API routes
│   ├── docs/articles/     # MDX article content (322 articles)
│   └── ...
├── components/
│   ├── 3d/                # React Three Fiber components
│   │   ├── scene/         # Scene3D, SceneCanvas, lighting
│   │   ├── camera/        # CinematicCamera, CameraController
│   │   ├── background/    # BackgroundSphere, GaussianSplatBackground
│   │   ├── interactive/   # InteractiveTablet
│   │   └── game/          # ClickingGame, GameOrb, BouncingBall
│   ├── ui/                # UI components (Button, Dialog, etc.)
│   ├── overlays/          # GameHUD, Leaderboard, TerminalInterface
│   └── contexts/          # JourneyContext, SupabaseDataContext
├── lib/
│   ├── generated/         # Build-generated JSON files
│   ├── article-images.ts  # Image discovery from manifest
│   ├── ai/                # AI personas, prompts
│   └── supabaseClient.ts  # Supabase initialization
├── content/               # (If exists - check structure)
├── styles/                # Global styles, CSS modules
├── scripts/               # Build pipeline scripts
│   ├── generate-image-manifest.ts
│   ├── generate-article-manifest.ts
│   └── generate-recommendation-index.ts
└── types/                 # TypeScript type definitions
```

## Build Pipeline (CRITICAL)

The build process runs a multi-stage pipeline **before** `next build`:

1. **Image Manifest** (`scripts/generate-image-manifest.ts`)
   - Maps article slugs to image paths
   - Avoids bundling ~650MB of images into serverless functions
   - Output: `lib/generated/image-manifest.json`

2. **Article Manifest** (`scripts/generate-article-manifest.ts`)
   - Extracts metadata from MDX frontmatter
   - Output: `lib/generated/article-manifest.json`

3. **Recommendation Index** (`scripts/generate-recommendation-index.ts`)
   - Precomputes article-to-article recommendations
   - Output: `lib/generated/recommendation-index.json`

4. **Embeddings** (`lib/generate-embeddings.ts`)
   - Generates OpenAI embeddings for semantic search
   - Stores in Supabase vector DB

**Never use `fs` to read from `public/images/` at runtime!** Always use the generated manifests.

## Key Patterns

### Article Image Discovery
```typescript
// CORRECT - Use the manifest
import { discoverArticleImages } from '@/lib/article-images';

const images = discoverArticleImages(slug);
// Returns: { heroImage, multiArt: [{path, model}], ogImage, ... }
```

### 3D Components (R3F)
```typescript
// Always use ssr: false for R3F components
const Scene3D = dynamic(() => import('@/components/3d/Scene3D'), { ssr: false });

// In R3F components, use refs for animations (no setState in useFrame)
const meshRef = useRef<Mesh>(null);
useFrame(() => {
  if (meshRef.current) {
    meshRef.current.rotation.y += 0.01; // OK
  }
});
```

### Context Providers
App-level providers in `pages/_app.tsx`:
- `JourneyContext` — quest/achievement/gamification state (localStorage)
- `ArticleDiscoveryProvider` — article browsing state
- `SupabaseDataContext` — shared Supabase data

### Article Structure
Articles are MDX files in `pages/docs/articles/`:
```yaml
---
title: 'Article Title'
author:
  - Alex Welcing
date: '2025-01-15'
description: 'SEO description'
keywords: ['ai', 'product', 'strategy']
ogImage: /images/og/article-slug.svg
articleType: research  # or 'fiction'
featured: true
featuredPriority: 5
relatedArticles:
  - related-article-slug
---

Content here...
```

## Critical Conventions

### Image Handling
- **Hero images**: `/images/articles/{slug}.jpg` or `.svg`
- **OG images**: `/images/og/{slug}.svg`
- **Multi-art**: `/images/articles/{slug}/{option}-{model}.png`
- **Article videos**: `/images/article-videos/{slug}.mp4`

### Styling Priority
1. **Styled Components** — For complex animations, 3D overlays, dynamic styles
2. **Tailwind CSS** — For UI components, utility classes
3. **CSS Modules** — For page-specific styles in `styles/`

### TypeScript Strict Mode
- Always define return types for exported functions
- No implicit any
- Use `satisfies` keyword where appropriate

## Common Tasks

### Add a New Article
1. Create MDX file in `pages/docs/articles/{slug}.mdx`
2. Add frontmatter (see structure above)
3. Run `pnpm build` to regenerate manifests
4. Images auto-discovered from `/public/images/articles/`

### Add a New 3D Object
```typescript
// In a scene component:
<mesh position={[x, y, z]}>
  <boxGeometry args={[1, 1, 1]} />
  <meshStandardMaterial color="hotpink" />
</mesh>
```

### Add API Route
```typescript
// pages/api/my-route.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Implementation
}
```

### Modify Article Layout
The article detail page is at `pages/articles/[slug].tsx`. Key styled components:
- `ArtMosaic` — Multi-image gallery grid
- `CinematicImage` — Full-bleed images
- `OffsetImageRight/Left` — Breaking images
- `BodyContainer` — Article typography

## Environment Variables

Required in `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=      # Supabase service role key
ADMIN_API_KEY=                  # Admin endpoint auth
OPENAI_KEY=                     # OpenAI API key
NEXT_PUBLIC_SITE_URL=           # Canonical site URL
```

## Testing & Validation

Before committing:
```bash
pnpm validate    # Runs lint + type-check
```

## Pitfalls to Avoid

1. **Don't use fs in API routes for images** — Use the generated manifest
2. **Don't setState in useFrame** — Use refs for R3F animations
3. **Don't import heavy 3D libraries server-side** — Always use `ssr: false`
4. **Don't modify generated files directly** — They'll be overwritten on build
5. **Don't use 'any' types** — Strict mode is enabled

## External Dependencies

Key packages to understand:
- `@react-three/fiber` — R3F core
- `@react-three/drei` — R3F helpers
- `@react-three/cannon` — Physics
- `styled-components` — CSS-in-JS
- `gray-matter` — MDX frontmatter parsing
- `react-markdown` — Markdown rendering

## Getting Help

- Check `CLAUDE.md` for architecture details
- Check `AGENTS.md` for system documentation
- Review existing similar components before building new ones
- Run `pnpm validate` before committing

## Quick Start for New Tasks

1. **Read the existing code** — Find similar implementations
2. **Check types** — Look in `types/` and `lib/generated/`
3. **Use manifests** — Never read `public/` directly at runtime
4. **Test visually** — Run `pnpm dev` and check in browser
5. **Validate** — Run `pnpm validate` before finishing
