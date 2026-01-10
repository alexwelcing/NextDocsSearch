# Deployment Guide: Timeline Convergence System

## Prerequisites

- Vercel account
- OpenAI API account with GPT-4 access
- GitHub repository connected to Vercel

## Step-by-Step Deployment

### 1. Generate API Keys

```bash
# Generate two secure random keys
node -e "console.log('ARTICLE_GENERATION_API_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Save these keys - you'll need them in step 3.

### 2. Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy and save it (starts with `sk-`)

### 3. Configure Vercel Environment Variables

In your Vercel dashboard:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add the following variables:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `OPENAI_KEY` | Your OpenAI API key | Production |
| `ARTICLE_GENERATION_API_KEY` | Generated key from step 1 | Production |
| `CRON_SECRET` | Generated key from step 1 | Production |
| `NEXT_PUBLIC_SITE_URL` | https://yourdomain.com | Production |

### 4. Deploy

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### 5. Verify Deployment

Check that the cron job is configured:

1. In Vercel dashboard, go to your project
2. Click on "Settings" → "Cron Jobs"
3. You should see: `/api/articles/auto-publish` running hourly

### 6. Test the System

**Check Status:**
```bash
curl https://yourdomain.com/api/articles/timeline-status
```

**Manual Generation (to test immediately):**
```bash
curl -X POST https://yourdomain.com/api/articles/generate \
  -H "Authorization: Bearer YOUR_ARTICLE_GENERATION_API_KEY" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "article": {
    "filename": "present-react-three-fiber-performance-xyz123.mdx",
    "title": "React Three Fiber Performance Optimization in Production",
    "timeline": "present",
    "convergence": 42.5
  }
}
```

### 7. Monitor

**View Logs:**
```bash
vercel logs --follow
```

**Check Generated Articles:**
```bash
ls -la pages/docs/articles/present-*.mdx
ls -la pages/docs/articles/future-*.mdx
```

## Cron Job Schedule

The system runs **every hour** on Vercel:

- **Schedule**: `0 * * * *` (top of every hour)
- **Endpoint**: `/api/articles/auto-publish`
- **Expected**: 24 articles per day, 720 per month

### Modifying the Schedule

To change frequency, edit `vercel.json`:

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

Common schedules:
- `0 * * * *` - Every hour
- `0 */2 * * *` - Every 2 hours
- `0 */4 * * *` - Every 4 hours
- `0 9,12,15,18 * * *` - 4 times per day (9am, 12pm, 3pm, 6pm)

After changing, redeploy:
```bash
vercel --prod
```

## Cost Analysis

### Expected Costs

**OpenAI API (GPT-4-turbo):**
- Per article: ~$0.47 (2K input + 15K output tokens)
- Hourly (1 article): ~$0.47
- Daily (24 articles): ~$11.28
- Monthly (720 articles): ~$338

### Budget Alerts

Set up OpenAI usage limits:
1. Go to https://platform.openai.com/account/limits
2. Set a monthly budget (e.g., $400)
3. Enable email alerts

### Cost Optimization

**Option 1: Reduce Frequency**
Generate every 2 hours instead of every hour:
- Monthly cost: ~$169 (360 articles)

**Option 2: Mixed Quality Tiers**
- 50% full articles (5-15K words): $0.47 each
- 50% shorter articles (1-3K words): $0.11 each
- Average: ~$0.29/article, ~$209/month

**Option 3: Variable Schedule**
- Peak hours (8am-8pm): High-quality articles
- Off-hours: Shorter articles or skip
- Estimated: ~$200-250/month

## Troubleshooting

### Issue: Cron job not running

**Check:**
1. Verify environment variables are set
2. Check Vercel cron logs for errors
3. Ensure `CRON_SECRET` matches in Vercel settings

**Solution:**
```bash
# Redeploy
vercel --prod

# Check logs
vercel logs --follow
```

### Issue: OpenAI rate limit errors

**Error:** `RateLimitError: You exceeded your current quota`

**Solutions:**
1. Add credits to OpenAI account
2. Reduce generation frequency
3. Switch to GPT-3.5-turbo

### Issue: Authentication errors

**Error:** `401 Unauthorized`

**Check:**
1. `ARTICLE_GENERATION_API_KEY` is set correctly
2. Using correct key in Authorization header
3. Key doesn't have extra spaces or newlines

### Issue: Articles not appearing

**Check:**
1. Look in `pages/docs/articles/` directory
2. Check `.timeline-state.json` for errors
3. Verify write permissions

**Solution:**
```bash
# Check state file
cat .timeline-state.json

# Check recent articles
ls -lt pages/docs/articles/ | head -10
```

## Monitoring Dashboard

### Key Metrics to Track

1. **Convergence Progress**
   - Check: `/api/articles/timeline-status`
   - Expected: Increases over time as convergence points pass

2. **Article Count**
   - Check: Count files in `pages/docs/articles/`
   - Expected: +24 per day

3. **Error Rate**
   - Check: Vercel logs
   - Expected: 0 errors

4. **Cost**
   - Check: OpenAI dashboard
   - Expected: ~$2.64 per day

### Set Up Alerts

**Vercel Notifications:**
1. Go to project settings
2. Enable deployment notifications
3. Add Slack/Discord webhook (optional)

**OpenAI Budget Alerts:**
1. Platform settings → Usage limits
2. Set monthly budget
3. Enable email alerts

## Backup and Recovery

### Backup Timeline State

```bash
# Backup state file
cp .timeline-state.json .timeline-state.backup.json

# Or use git
git add .timeline-state.json
git commit -m "Backup timeline state"
```

### Reset State

If state gets corrupted:

```bash
# Remove state file
rm .timeline-state.json

# System will create new default state on next run
```

### Restore from Backup

```bash
cp .timeline-state.backup.json .timeline-state.json
```

## Scaling Considerations

### High Volume (100+ articles/day)

1. **Increase OpenAI rate limits**
   - Contact OpenAI for tier upgrade
   
2. **Use queue system**
   - Add Redis or database queue
   - Process multiple articles in parallel

3. **Optimize costs**
   - Cache common responses
   - Use cheaper models for some articles

### Multiple Sites

Deploy separately for each site:
1. Clone repository
2. Set different environment variables
3. Use different OpenAI keys (for tracking)

## Security Best Practices

1. **Never commit API keys**
   - Keys stay in Vercel environment variables
   - `.env.local` is gitignored

2. **Rotate keys regularly**
   - Change every 90 days
   - Update in Vercel settings

3. **Monitor usage**
   - Check OpenAI dashboard weekly
   - Set up budget alerts

4. **Restrict access**
   - Only admin team has Vercel access
   - API keys are not shared

## Support

If you encounter issues:

1. Check this guide first
2. Review `docs/TIMELINE_CONVERGENCE_SYSTEM.md`
3. Check Vercel logs: `vercel logs`
4. Review OpenAI API status: https://status.openai.com/

## Success Checklist

- [ ] Vercel project deployed
- [ ] Environment variables configured
- [ ] OpenAI API key valid and funded
- [ ] Cron job appears in Vercel dashboard
- [ ] First article generated successfully
- [ ] Timeline status API responding
- [ ] Budget alerts configured
- [ ] Monitoring set up

Once all checked, your system is live and will automatically publish articles every hour! 🎉
