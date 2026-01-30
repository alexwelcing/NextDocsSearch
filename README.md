# NextDocsSearch: AI-Powered Content Platform

Transform your content experience with AI! NextDocsSearch is a high-performance SPA focused on SEO optimization and automated content generation, integrating OpenAI's API with Next.js for an efficient, scalable publishing platform.

## 🚀 Key Features

- **Automated Content Drips**: New articles generated every 4 hours via GitHub Actions
- **SEO Optimized**: Complete meta tags, structured data, and sitemap generation
- **RSS Feed**: Full-featured RSS 2.0 feed for content syndication
- **High Performance**: Optimized for Core Web Vitals (LCP < 2.5s, FID < 100ms)
- **Social Sharing**: Rich Open Graph and Twitter Card support
- **AI Chat Integration**: Supabase-powered conversational interface
- **341+ Articles**: Pre-generated content on AI strategy, R3F, and speculative futures

## 📦 Tech Stack

- **Framework**: Next.js 15.5.9 (React 19)
- **Styling**: Tailwind CSS + Styled Components
- **Backend**: Supabase
- **AI**: OpenAI API (GPT-4)
- **Deployment**: Vercel
- **Analytics**: Google Tag Manager
- **Content**: MDX with Gray Matter

## 🏗️ Architecture

```
├── pages/
│   ├── index.tsx              # Homepage (simplified, SEO-focused)
│   ├── articles/
│   │   ├── index.tsx          # Article listing
│   │   └── [slug].tsx         # Individual articles
│   ├── api/
│   │   ├── articles.ts        # Article metadata API
│   │   └── rss.ts             # RSS feed generator
│   └── docs/
│       └── articles/          # 341+ MDX articles
├── components/
│   ├── ui/                    # UI components
│   └── contexts/              # React contexts
├── lib/
│   ├── knowledge/             # Content taxonomy
│   └── generate-embeddings.ts # Vector embeddings
└── .github/
    └── workflows/
        └── auto-content-generation.yml  # 4-hour content drips
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9.7.1+
- OpenAI API key
- Supabase account

### Installation

```bash
# Clone repository
git clone https://github.com/alexwelcing/NextDocsSearch.git
cd NextDocsSearch

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env
# Add your keys:
# OPENAI_API_KEY=
# SUPABASE_URL=
# SUPABASE_ANON_KEY=

# Generate embeddings (required for AI features)
pnpm embeddings

# Run development server
pnpm dev

# Open http://localhost:3000
```

### Build for Production

```bash
# Build with embeddings generation
pnpm build

# Start production server
pnpm start
```

## 📝 Content Generation

### Automated (GitHub Actions)
New articles are automatically generated every 4 hours:
- Triggers: Schedule (cron) or manual dispatch
- Output: 1 high-SEO article per cycle
- Location: `pages/docs/articles/`
- Auto-commit and push to repository

### Manual Generation

```bash
# Generate single high-SEO article
pnpm run generate:knowledge -- --high-seo --count 1

# Generate multiple articles
pnpm run generate:knowledge -- --count 5

# Generate by category
pnpm run generate:knowledge -- --category "AI Strategy"

# Generate by difficulty
pnpm run generate:knowledge -- --difficulty advanced --count 3
```

## 🔧 Configuration

### GitHub Actions Secrets
Required for automated content generation:
```
OPENAI_API_KEY          # OpenAI API access
SUPABASE_URL            # Supabase project URL
SUPABASE_ANON_KEY       # Supabase anonymous key
VERCEL_TOKEN            # (Optional) Deployment triggers
```

### Sitemap Configuration
Edit `next-sitemap.config.js` to customize:
- URL structure
- Priority weights
- Change frequencies
- Excluded paths

### Content Schedule
Edit `.github/workflows/auto-content-generation.yml`:
```yaml
schedule:
  - cron: '0 */4 * * *'  # Every 4 hours (customize as needed)
```

## 📊 Performance

### Metrics (Target)
- **Lighthouse Performance**: 95+
- **First Contentful Paint**: < 1.0s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3.0s
- **Bundle Size**: ~400KB (down from 2.5MB)

### Optimizations
- Removed heavy 3D dependencies from main bundle
- Static generation for all articles
- Aggressive caching headers
- Image optimization (AVIF/WebP)
- Code splitting per route

See `docs/PERFORMANCE_OPTIMIZATIONS_V2.md` for details.

## 🌐 SEO Features

- **Structured Data**: Schema.org markup (Person, Article, Website)
- **Open Graph**: Rich social previews
- **Twitter Cards**: Summary with large image
- **RSS Feed**: `/api/rss` for syndication
- **Sitemap**: Auto-generated XML sitemap
- **Canonical URLs**: Proper link canonicalization
- **Meta Tags**: Complete SEO meta information

## 📚 Documentation

- [Auto Content Drips Setup](docs/AUTO_CONTENT_DRIPS.md)
- [Performance Optimizations](docs/PERFORMANCE_OPTIMIZATIONS_V2.md)
- [Article System](docs/ARTICLE_SYSTEM.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [3D Architecture](AGENTS.md) (preserved for reference)

## 🛠️ Development Scripts

```bash
# Development
pnpm dev                          # Start dev server
pnpm build                        # Production build
pnpm start                        # Start production server

# Content Generation
pnpm embeddings                   # Generate vector embeddings
pnpm generate:knowledge           # Generate articles
pnpm generate:article             # Interactive article generator

# Code Quality
pnpm lint                         # ESLint
pnpm type-check                   # TypeScript validation
pnpm format                       # Prettier formatting

# Testing
pnpm test:visual                  # Visual regression tests
```

## 🔄 Migration from 3D Version

The original 3D version is preserved in `pages/index-3d.tsx.bak`. To restore:

```bash
# Restore 3D homepage
mv pages/index.tsx pages/index-simple.tsx
mv pages/index-3d.tsx.bak pages/index.tsx
```

Note: 3D dependencies are still installed but not loaded on the main homepage.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

**Essential Resources**:
- [Supabase](https://www.supabase.io/)
- [OpenAI](https://openai.com/)
- [Vercel](https://vercel.com/)
- [Next.js](https://nextjs.org/)

## 📧 Contact

Alex Welcing
- Website: [alexwelcing.com](https://alexwelcing.com)
- X (Twitter): [@alexwelcing](https://x.com/alexwelcing)
- LinkedIn: [alexwelcing](https://linkedin.com/in/alexwelcing)
- GitHub: [@alexwelcing](https://github.com/alexwelcing)

---

**Built with ❤️ for the AI future**
