# Timeline Convergence Article System

## Overview

An automated article generation and publishing system that creates content from two parallel timelines - **Present (2024-2026)** and **Future (2045-2058)** - with a narrative about their convergence towards a unified reality.

## Concept

The system generates two types of articles:

1. **Present Timeline Articles**: Modern tutorials, best practices, and guides about React Three Fiber, WebGL, and 3D web development
2. **Future Timeline Articles**: Dark tech horror stories from IT professionals in 2045-2058 maintaining "legacy" 2025 code

As convergence points are reached (major tech breakthroughs), the timelines draw closer together, creating a unique narrative arc.

## Features

- ✅ **AI-Powered Content Generation** - Uses OpenAI GPT-4 to create high-quality articles
- ✅ **Automated Publishing** - Hourly cron job publishes new articles automatically
- ✅ **Timeline Convergence Tracking** - Monitors progress towards timeline unification
- ✅ **Convergence Points** - Major tech events that bridge both timelines
- ✅ **Auto-Approval** - Generated content is validated and published without manual review
- ✅ **SEO Optimized** - Articles include metadata, keywords, and structured content
- ✅ **Dual Narrative** - Balances present and future perspectives

## Architecture

```
lib/knowledge/
├── timeline-convergence.ts    # Timeline logic & convergence points
├── ai-article-generator.ts    # OpenAI integration for content generation
├── narrative-framework.ts     # Story templates & metadata
└── content-generator.ts       # Article assembly

pages/api/articles/
├── generate.ts               # Manual article generation endpoint
├── auto-publish.ts          # Cron job endpoint (runs hourly)
└── timeline-status.ts       # Convergence status API

vercel.json                   # Cron job configuration
.timeline-state.json         # Persistent state (gitignored)
```

## Setup

### 1. Environment Variables

Add to your `.env.local` or Vercel environment variables:

```bash
# Required
OPENAI_KEY=sk-...                              # OpenAI API key
ARTICLE_GENERATION_API_KEY=your-secure-key    # For API authentication
CRON_SECRET=your-cron-secret                   # For Vercel Cron authentication

# Optional
NEXT_PUBLIC_SITE_URL=https://yourdomain.com   # For internal API calls
```

### 2. Generate API Keys

```bash
# Generate secure API keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use the output for `ARTICLE_GENERATION_API_KEY` and `CRON_SECRET`.

### 3. Deploy to Vercel

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Deploy
vercel --prod
```

The cron job will automatically start running once deployed.

## Usage

### Automatic Publishing (Recommended)

Once deployed to Vercel, articles are published automatically every hour via Vercel Cron.

**Cron Schedule:** `0 * * * *` (every hour, on the hour)

### Manual Article Generation

Generate a single article manually:

```bash
curl -X POST https://yourdomain.com/api/articles/generate \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### Dry Run (Cost Estimate)

Check estimated cost without generating:

```bash
curl -X POST https://yourdomain.com/api/articles/generate \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

### Check Timeline Status

View current convergence progress:

```bash
curl https://yourdomain.com/api/articles/timeline-status
```

Response:
```json
{
  "convergence": {
    "current": 24.5,
    "percentage": "24.5%",
    "status": "distant"
  },
  "narrative": "The timelines remain distant. Technologies developed today will echo through decades of future maintenance.",
  "nextConvergencePoint": {
    "technology": "Brain-Computer Interface",
    "date": "2025-03-15",
    "presentEvent": "First successful non-invasive neural reading",
    "futureEvent": "Legacy systems from 2025 BCI still haunt us",
    "significance": 9
  },
  "statistics": {
    "totalArticlesPublished": 12,
    "convergencePointsPassed": 0,
    "convergencePointsTotal": 8,
    "convergencePointsRemaining": 8
  }
}
```

## Convergence Points

The system tracks 8 major convergence points:

1. **Neural Interface Breakthrough** (March 2025) - Brain-Computer Interfaces
2. **Quantum Encryption** (June 2025) - Quantum Key Distribution
3. **AI Autonomy** (September 2025) - Autonomous AI Agents
4. **Fusion Energy** (November 2025) - Sustained Fusion Power
5. **Nanotech Medicine** (February 2026) - Medical Nanobots
6. **AGI Emergence** (May 2026) - Artificial General Intelligence
7. **Climate Reversal** (August 2026) - Atmospheric Processors
8. **Space Elevator** (December 2026) - Orbital Access

As these dates pass, convergence increases and the narrative shifts.

## Timeline Selection Logic

The system intelligently balances which timeline to publish from:

- **Early Convergence (0-30%)**: 70% present, 30% future
- **Mid Convergence (30-70%)**: 50% present, 50% future
- **Late Convergence (70-100%)**: 30% present, 70% future

This creates a narrative arc where future warnings become more frequent as convergence approaches.

## Content Generation

### Present Timeline Articles

**Style:** Optimistic, technical, forward-thinking  
**Topics:** Modern best practices, tutorials, implementation guides  
**Author:** Alex Welcing, NextDocs Engineering  
**Example Titles:**
- "React Three Fiber Performance Optimization in Production"
- "Building Scalable 3D Web Applications with WebGL"
- "AI-Powered 3D Content Generation"

### Future Timeline Articles

**Style:** Dark, cautionary, retrospective  
**Topics:** Legacy system horror stories, technical debt, maintenance nightmares  
**Author:** Anonymous Researcher, Chronicles Archive  
**Example Titles:**
- "Why We Still Maintain 2025-Era React Three Fiber Code"
- "The Shader That Crashed a Space Station"
- "When useFrame Became Sentient"

## Article Structure

Each generated article includes:

1. **Frontmatter** (YAML)
   - Title, author, date, description
   - Keywords for SEO
   - Timeline type and convergence percentage
   - OG image

2. **Main Content** (Markdown)
   - Introduction with hook
   - Technical deep dive (3-4 sections)
   - Implementation guide or lessons learned
   - Best practices or modern implications
   - Conclusion

3. **Convergence Footer**
   - Current convergence status
   - Timeline indicator
   - Narrative connecting timelines
   - Next convergence point

## Cost Estimation

Each article generation costs approximately:

- **Input Tokens:** ~1,500 tokens
- **Output Tokens:** ~3,000 tokens
- **Total Cost:** ~$0.105 per article

**Monthly Cost (24 articles/day):**
- 720 articles/month × $0.105 = ~$75.60/month

## Monitoring

### Logs

Check Vercel logs for cron job execution:
```bash
vercel logs --follow
```

### Timeline State

The `.timeline-state.json` file tracks:
- Current convergence percentage
- Last published article per timeline
- Total articles published
- Next convergence point

### Article Validation

Each article is validated before publishing:
- Title length (min 10 chars)
- Description length (100-160 chars)
- Content length (min 1000 chars)
- Minimum 3 keywords
- Author present

## Troubleshooting

### Articles Not Publishing

1. Check Vercel cron logs for errors
2. Verify `OPENAI_KEY` is set correctly
3. Check `ARTICLE_GENERATION_API_KEY` matches in both endpoints
4. Ensure `CRON_SECRET` is configured

### OpenAI Rate Limits

If you hit rate limits:
1. Reduce cron frequency (e.g., every 2 hours)
2. Upgrade OpenAI account tier
3. Add retry logic with exponential backoff

### Invalid Articles

Check validation errors in API response:
```bash
# View last generation attempt
curl https://yourdomain.com/api/articles/timeline-status
```

## Customization

### Change Cron Schedule

Edit `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/articles/auto-publish",
      "schedule": "0 */2 * * *"  // Every 2 hours
    }
  ]
}
```

### Add Convergence Points

Edit `lib/knowledge/timeline-convergence.ts`:
```typescript
export const CONVERGENCE_POINTS: ConvergencePoint[] = [
  // Add new convergence point
  {
    id: 'your-new-point',
    date: '2026-03-15',
    technology: 'New Technology',
    presentEvent: 'What happens now',
    futureEvent: 'What it means later',
    significance: 8,
  },
];
```

### Modify Topics

Edit topic arrays in `lib/knowledge/timeline-convergence.ts`:
```typescript
export const PRESENT_TOPICS = [
  'Your New Present Topic',
  // ...
];

export const FUTURE_TOPICS = [
  'Your New Future Topic',
  // ...
];
```

## Security

- API endpoints require authentication via `ARTICLE_GENERATION_API_KEY`
- Cron endpoint requires Vercel's `CRON_SECRET`
- Timeline state file is gitignored
- Environment variables are not exposed to client

## Testing

### Local Testing

```bash
# Start development server
npm run dev

# Test article generation (from another terminal)
curl -X POST http://localhost:3000/api/articles/generate \
  -H "Authorization: Bearer your-test-key" \
  -H "Content-Type: application/json"
```

### Test Cron Manually

```bash
curl -X GET http://localhost:3000/api/articles/auto-publish \
  -H "Authorization: Bearer your-cron-secret"
```

## Future Enhancements

- [ ] Add article preview before publishing
- [ ] Support multiple AI models (GPT-4, Claude, etc.)
- [ ] Add article editing API
- [ ] Implement article scheduling
- [ ] Add webhook notifications
- [ ] Create admin dashboard
- [ ] Support custom convergence narratives
- [ ] Add A/B testing for titles
- [ ] Implement article analytics
- [ ] Add multi-language support

## Support

For issues or questions:
1. Check Vercel deployment logs
2. Review OpenAI API status
3. Check environment variables configuration
4. Review this documentation

## License

Part of NextDocsSearch - see main repository LICENSE

---

**Last Updated:** 2024-11-24  
**Version:** 1.0.0
