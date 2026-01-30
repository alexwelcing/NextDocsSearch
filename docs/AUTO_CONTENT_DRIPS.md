# Automated Content Drips Setup

## Overview

This site now features automated article generation every 4 hours via GitHub Actions, creating a consistent content drip for SEO and social traffic optimization.

## How It Works

### 1. Scheduled Generation
- **Frequency**: Every 4 hours (0 */4 * * *)
- **Script**: `generate-knowledge-base.ts`
- **Mode**: High-SEO topics focused on R3F, AI, and product strategy
- **Output**: 1 new article per cycle in `pages/docs/articles/`

### 2. Content Strategy
The system generates articles from a curated knowledge taxonomy:
- React-Three-Fiber topics
- AI product strategy
- Speculative AI futures
- Technical deep-dives

Articles are:
- SEO-optimized with rich metadata
- Tagged with relevant keywords
- Structured for social sharing
- Automatically committed to the repository

### 3. Distribution Channels

#### RSS Feed
- Endpoint: `/api/rss`
- Updates: Real-time with new content
- Format: RSS 2.0 with full content

#### Social Preview
- Open Graph tags for rich previews
- Twitter Card support
- Custom og:image per article

#### Sitemap
- Auto-generated via `next-sitemap`
- Runs on every build
- Includes all articles with priority weighting

## GitHub Actions Workflow

### Required Secrets
Set these in your repository settings:

```
OPENAI_API_KEY          # For content generation
SUPABASE_URL            # For backend integration
SUPABASE_ANON_KEY       # For backend integration
VERCEL_TOKEN            # (Optional) For deployment triggers
VERCEL_ORG_ID          # (Optional)
VERCEL_PROJECT_ID      # (Optional)
```

### Manual Triggering
You can manually trigger content generation:
1. Go to Actions tab in GitHub
2. Select "Auto Content Generation"
3. Click "Run workflow"

### Customization

#### Change frequency
Edit `.github/workflows/auto-content-generation.yml`:
```yaml
schedule:
  - cron: '0 */4 * * *'  # Change to desired schedule
```

#### Change article count
```yaml
- name: Generate new article
  run: pnpm run generate:knowledge -- --high-seo --count 2  # Generate 2 instead of 1
```

#### Change topic focus
```yaml
- name: Generate new article
  run: pnpm run generate:knowledge -- --category "AI Strategy" --count 1
```

## Performance Optimizations

### Build Strategy
- **ISR (Incremental Static Regeneration)**: Articles regenerate on-demand
- **Static Generation**: All articles pre-rendered at build time
- **Cache Headers**: Aggressive caching for static assets

### Image Optimization
- AVIF/WebP format support
- Responsive sizes for different devices
- CDN delivery via Vercel

### Bundle Optimization
- Removed heavy 3D dependencies (Three.js, R3F, Cannon)
- Minimal JavaScript for homepage
- Code splitting per route

## SEO Features

### Structured Data
- Organization schema
- Person schema
- Article schema per post
- BreadcrumbList for navigation

### Meta Tags
- Complete Open Graph tags
- Twitter Cards
- Canonical URLs
- Robots directives

### Sitemap
- XML sitemap at `/sitemap.xml`
- Priority weighting for featured content
- Change frequency hints

## Monitoring

### Content Quality
- Review generated articles in `pages/docs/articles/`
- Check commit messages for generation timestamps
- Monitor article keywords and descriptions

### Traffic
- Google Analytics (GTM-W24L468)
- Track article views
- Monitor bounce rates
- Analyze social referrals

## Maintenance

### Article Cleanup
If you need to remove or archive articles:
```bash
# Move old articles to archive
mkdir -p archive
mv pages/docs/articles/old-article.mdx archive/

# Rebuild to update sitemap
npm run build
```

### Knowledge Base Updates
Edit the taxonomy in `lib/knowledge/r3f-taxonomy.ts` to:
- Add new topics
- Adjust SEO scores
- Change difficulty levels
- Update categories

## Troubleshooting

### Workflow Fails
1. Check GitHub Actions logs
2. Verify secrets are set correctly
3. Ensure OpenAI API has credits
4. Check rate limits

### No Articles Generated
- Verify the knowledge base has available topics
- Check for duplicate slugs
- Review OpenAI API errors in logs

### Build Failures
- Run `npm run build` locally to reproduce
- Check for TypeScript errors
- Verify all article frontmatter is valid YAML

## Next Steps

### Phase 2 Enhancements
- [ ] Add trending articles section
- [ ] Implement view tracking
- [ ] Create newsletter signup
- [ ] Add social share buttons
- [ ] Generate article cover images

### Phase 3 Advanced Features
- [ ] A/B testing for headlines
- [ ] Personalized recommendations
- [ ] Search functionality
- [ ] Related articles algorithm
- [ ] Topic clustering

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Next.js ISR](https://nextjs.org/docs/basic-features/data-fetching/incremental-static-regeneration)
- [next-sitemap](https://github.com/iamvishnusankar/next-sitemap)
- [RSS 2.0 Specification](https://www.rssboard.org/rss-specification)
