# NextDocsSearch

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-R3F-000000?logo=three.js)](https://docs.pmnd.rs/react-three-fiber)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Deployed on Vercel](https://img.shields.io/badge/Vercel-Deployed-000?logo=vercel)](https://vercel.com/)

An immersive 3D content platform combining a portfolio and article system with interactive visualization, AI-powered semantic search, and gamification. Live at [alexwelcing.com](https://alexwelcing.com).

## Features

- **3D Visualization** — Interactive React Three Fiber scene with physics, post-processing, and splat backgrounds
- **AI Semantic Search** — OpenAI embeddings stored in Supabase vector DB for natural language article discovery
- **Article System** — MDX-based articles with SSG, image manifests, and precomputed recommendations
- **Gamification** — Quest/achievement system with a leaderboard, persisted to localStorage and Supabase

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15 (Pages Router), React 19, TypeScript (strict) |
| 3D | React Three Fiber, Drei, Cannon (physics), Postprocessing |
| AI / ML | OpenAI embeddings, Vercel AI SDK, FAL AI image generation |
| Database | Supabase (PostgreSQL + pgvector + storage) |
| Styling | Tailwind CSS, Styled Components, CSS Modules |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+
- A [Supabase](https://supabase.com/) project with pgvector enabled
- An [OpenAI](https://platform.openai.com/) API key

### Install

```bash
git clone https://github.com/alexwelcing/NextDocsSearch.git
cd NextDocsSearch
pnpm install
```

### Environment Variables

Copy `.env.example` and fill in your keys:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `ADMIN_API_KEY` | Admin endpoint authentication key |
| `OPENAI_KEY` | OpenAI API key |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL |

### Development

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

The build runs a multi-stage pipeline before `next build`:

1. **Image manifest** — maps article slugs to image paths, avoiding bundling ~650 MB of assets into serverless functions
2. **Article manifest** — extracts metadata from MDX frontmatter
3. **Recommendation index** — precomputes article-to-article recommendations
4. **Embeddings** — generates OpenAI embeddings for semantic search

Generated data lands in `lib/generated/*.json` and is consumed at runtime by API routes.

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development server |
| `pnpm build` | Full build (manifests + embeddings + next build + sitemap) |
| `pnpm lint` | Run ESLint |
| `pnpm type-check` | TypeScript check (`tsc --noEmit`) |
| `pnpm validate` | Lint + type-check combined |
| `pnpm format` | Prettier formatting |
