# Timeline Convergence System - Quick Start

## What This Does

Automatically generates and publishes articles **once per hour** from two parallel timelines:
- **Present (2024-2026)**: Technical tutorials and guides
- **Future (2045-2058)**: Tech horror stories about "legacy" 2025 code

The timelines converge as major tech breakthroughs occur, creating a unique narrative arc.

## Setup (5 minutes)

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Set Environment Variables

Create `.env.local`:

```bash
# Required
OPENAI_KEY=sk-your-openai-api-key
ARTICLE_GENERATION_API_KEY=your-secure-random-key
CRON_SECRET=your-cron-secret

# Optional
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

Generate secure keys:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Test Locally

```bash
# Test the system (no API calls)
npm run timeline:test

# Estimate cost
npm run timeline:dry-run

# Generate one article (uses OpenAI API)
npm run timeline:generate
```

### 4. Deploy to Vercel

```bash
vercel --prod
```

Add environment variables in Vercel dashboard, then the cron job will run automatically every hour.

## Usage

### Check Status

```bash
curl https://yourdomain.com/api/articles/timeline-status
```

### Manual Generation

```bash
curl -X POST https://yourdomain.com/api/articles/generate \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### View Convergence Progress

Visit: `https://yourdomain.com/api/articles/timeline-status`

## What Gets Generated

### Present Timeline Article Example
- **Title**: "React Three Fiber Performance Optimization in Production"
- **Style**: Modern, optimistic, practical
- **Content**: Tutorials, best practices, code examples
- **Author**: Alex Welcing

### Future Timeline Article Example  
- **Title**: "Why We Still Maintain 2025-Era React Three Fiber Code"
- **Style**: Dark, cautionary, retrospective
- **Content**: Horror stories, legacy systems, technical debt
- **Author**: Anonymous Researcher

## Cost

- **Per Article**: ~$0.11
- **Per Hour**: ~$0.11 (1 article)
- **Per Month**: ~$79 (720 articles)

## Monitoring

**Vercel Logs**:
```bash
vercel logs --follow
```

**Timeline State**:
```bash
cat .timeline-state.json
```

## Troubleshooting

**Articles not publishing?**
1. Check Vercel logs for errors
2. Verify environment variables are set
3. Check OpenAI API key is valid

**Want to change frequency?**  
Edit `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/articles/auto-publish",
    "schedule": "0 */2 * * *"  // Every 2 hours
  }]
}
```

## Full Documentation

See [docs/TIMELINE_CONVERGENCE_SYSTEM.md](./docs/TIMELINE_CONVERGENCE_SYSTEM.md) for complete details.

## Quick Commands

```bash
# Test system
npm run timeline:test

# Generate article (local)
npm run timeline:generate

# Check cost estimate
npm run timeline:dry-run

# Deploy
vercel --prod

# View logs
vercel logs --follow
```

That's it! The system will now automatically publish one article per hour, alternating between present and future timelines as they converge.
