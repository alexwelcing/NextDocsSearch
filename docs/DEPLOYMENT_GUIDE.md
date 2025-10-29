# Deployment Guide - Sphere Hunter Game

This guide walks you through deploying the Sphere Hunter 360 game to production.

## Pre-Deployment Checklist

- [ ] Supabase project is created and configured
- [ ] Environment variables are set in your hosting platform
- [ ] Database migration file is ready to apply
- [ ] Code is built successfully locally (`npm run build`)
- [ ] VR detection has been tested

## Step 1: Apply Database Migration

### Using Supabase Dashboard (Easiest)

1. **Navigate to your Supabase project**
   - Go to [app.supabase.com](https://app.supabase.com)
   - Select your project

2. **Open SQL Editor**
   - Click **SQL Editor** in the left sidebar
   - Click **New query**

3. **Copy and run the migration**
   ```sql
   -- Copy the entire contents from:
   -- supabase/migrations/20250127000000_sphere_hunter_leaderboard.sql

   -- The migration creates:
   -- 1. sphere_hunter_scores table
   -- 2. Indexes for leaderboard queries
   -- 3. RLS policies for public access
   ```

4. **Execute the query**
   - Click **Run** or press `Cmd/Ctrl + Enter`
   - Verify success message appears

5. **Verify table creation**
   - Go to **Table Editor** in sidebar
   - You should see `sphere_hunter_scores` table
   - Confirm columns: id, player_name, score, combo_max, accuracy, etc.

### Using Supabase CLI (Advanced)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migration
supabase db push

# Verify migration was applied
supabase db diff
```

## Step 2: Configure Environment Variables

### Vercel Deployment

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

```bash
# Required for game leaderboard
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional (if using embeddings/chat)
OPENAI_KEY=your-openai-api-key
```

4. Click **Save**
5. Redeploy your application

### Netlify Deployment

1. Go to **Site settings** → **Environment variables**
2. Add variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_KEY` (optional)
3. Trigger a new deploy

### Other Platforms

Consult your platform's documentation for setting environment variables:
- **Railway**: Settings → Variables
- **Render**: Environment → Environment Variables
- **AWS Amplify**: Environment variables section
- **DigitalOcean App Platform**: App Settings → Environment Variables

## Step 3: Test the Deployment

### Manual Testing

1. **Visit your deployed site**
   - The game should appear in IDLE state with floating orbs

2. **Test game flow**
   - Click "Start Game" button
   - Verify orbs spawn and are clickable
   - Check HUD displays correctly (score, timer, combo)
   - Play until timer reaches 0
   - Verify game over screen appears

3. **Test leaderboard**
   - Submit a score (any score qualifies if leaderboard is empty)
   - Enter a name (e.g., "Test Player")
   - Click "Submit Score"
   - Verify score appears in leaderboard
   - Check Supabase Table Editor to confirm database entry

4. **Test VR detection**
   - On non-VR device: VR button should NOT appear
   - On VR-capable device: VR button should appear
   - Try entering VR mode (if available)

### Verify API Endpoints

Use browser DevTools or curl to test:

```bash
# Test leaderboard endpoint
curl https://your-site.com/api/game/get-leaderboard

# Expected response:
{
  "success": true,
  "leaderboard": [...]
}

# Test score submission
curl -X POST https://your-site.com/api/game/submit-score \
  -H "Content-Type: application/json" \
  -d '{
    "player_name": "Test",
    "score": 100,
    "combo_max": 5,
    "accuracy": 85.5,
    "total_clicks": 20,
    "successful_clicks": 17
  }'

# Expected response:
{
  "success": true,
  "entry": {...}
}
```

### Check for Errors

1. **Browser Console**
   - Open DevTools → Console
   - Look for any errors during gameplay
   - Check Network tab for failed API requests

2. **Supabase Logs**
   - Go to Supabase Dashboard → Logs
   - Check for database errors
   - Verify API requests are going through

3. **Vercel/Platform Logs**
   - Check deployment logs for runtime errors
   - Look for failed API endpoint executions

## Step 4: Performance Verification

### Test on Different Devices

- **Desktop**: Chrome, Firefox, Safari, Edge
- **Mobile**: iOS Safari, Android Chrome
- **VR**: Meta Quest Browser, VIVE

### Check Frame Rate

1. Enable Stats component in development:
   - Already enabled in ThreeSixty.tsx for `NODE_ENV === 'development'`
   - Check FPS stays above 30 (ideally 60)

2. If performance is poor:
   - Reduce particle count in ParticleExplosion.tsx
   - Lower max orb spawn rate
   - Adjust canvas DPR settings

### Lighthouse Score

Run Lighthouse audit:
```bash
# Install lighthouse CLI
npm install -g lighthouse

# Run audit
lighthouse https://your-site.com --view
```

Target scores:
- Performance: 80+
- Accessibility: 90+
- Best Practices: 90+

## Step 5: Monitor and Maintain

### Database Maintenance

**Check leaderboard growth:**
```sql
-- Count total scores submitted
SELECT COUNT(*) FROM sphere_hunter_scores;

-- View score distribution
SELECT
  FLOOR(score / 100) * 100 as score_range,
  COUNT(*) as count
FROM sphere_hunter_scores
GROUP BY score_range
ORDER BY score_range;

-- Check average accuracy
SELECT AVG(accuracy) as avg_accuracy
FROM sphere_hunter_scores;
```

**Optional: Add leaderboard rotation**
```sql
-- Create monthly leaderboard view
CREATE VIEW monthly_leaderboard AS
SELECT *
FROM sphere_hunter_scores
WHERE created_at >= date_trunc('month', CURRENT_DATE)
ORDER BY score DESC
LIMIT 5;
```

### Analytics Integration

Add event tracking (Google Analytics, Mixpanel, etc.):

```typescript
// In ClickingGame.tsx
const handleGameEnd = useCallback((finalScore: number, stats: GameStats) => {
  // Track game completion
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', 'game_complete', {
      score: finalScore,
      combo_max: stats.comboMax,
      accuracy: stats.accuracy,
    });
  }

  setScore(finalScore);
  setGameStats(stats);
  setGameState('GAME_OVER');
}, []);
```

### Security Considerations

1. **Rate Limiting**: Consider adding rate limits to prevent spam scores
   ```typescript
   // In submit-score.ts
   // Add rate limiting middleware
   // Example: max 10 submissions per IP per hour
   ```

2. **Score Validation**: Add server-side validation for realistic scores
   ```typescript
   // Maximum theoretical score calculation
   // 30 seconds * 6 orbs/sec * 30 points * 3x multiplier = ~16,200 max
   if (score > 20000) {
     return res.status(400).json({ error: 'Unrealistic score' });
   }
   ```

3. **Name Sanitization**: Already implemented, but verify
   ```typescript
   // Already in submit-score.ts
   player_name: player_name.trim()
   ```

## Rollback Plan

If something goes wrong:

### Revert Database Migration

```sql
-- Drop the leaderboard table
DROP TABLE IF EXISTS sphere_hunter_scores CASCADE;

-- This removes all game data - use with caution!
```

### Revert Code Changes

```bash
# If you need to revert the game entirely
git revert <commit-hash>
git push origin main

# Or create a hotfix branch without the game
git checkout -b hotfix/remove-game
git revert <game-commit-hash>
git push origin hotfix/remove-game
```

## Production Optimization

### Enable Caching

**Leaderboard caching** (Vercel example):
```typescript
// In get-leaderboard.ts
export const config = {
  runtime: 'edge',
};

// Add cache headers
res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
```

### CDN Configuration

Ensure static assets are cached:
- Particle textures
- Component bundles
- 3D assets

### Database Indexing

Already included in migration, but verify:
```sql
-- Check indexes
SELECT * FROM pg_indexes
WHERE tablename = 'sphere_hunter_scores';

-- Should see:
-- idx_scores_leaderboard (score DESC, created_at ASC)
-- idx_session_id (session_id)
```

## Troubleshooting Common Issues

### Issue: "Failed to fetch leaderboard"

**Solution:**
1. Check Supabase URL and key in environment variables
2. Verify RLS policies are enabled
3. Check network tab for CORS errors
4. Confirm table exists in Supabase

### Issue: VR button shows on non-VR devices

**Solution:**
1. Verify `useXRSessionModeSupported` is properly imported
2. Check console for WebXR errors
3. Clear browser cache

### Issue: Orbs not clickable

**Solution:**
1. Check for JavaScript errors in console
2. Verify OrbitControls are not blocking clicks
3. Ensure Canvas pointer events are enabled
4. Test with different mouse/touch inputs

### Issue: Poor mobile performance

**Solution:**
1. Reduce particle count (ParticleExplosion.tsx line 30: `particleCount = 15`)
2. Lower orb spawn rates
3. Adjust canvas DPR: `dpr={[0.5, 1]}` instead of `dpr={[1, 2]}`

## Post-Deployment Success Metrics

Track these KPIs:

- **Engagement Rate**: % of visitors who start the game
- **Completion Rate**: % who finish the full 30 seconds
- **Average Score**: Benchmark difficulty
- **Leaderboard Submissions**: % of players who make top 5
- **Replay Rate**: Players who play multiple rounds
- **Session Duration**: Time spent on site (should increase)

## Support

If you encounter issues:

1. Check the [SPHERE_HUNTER_GAME.md](./SPHERE_HUNTER_GAME.md) documentation
2. Review browser console errors
3. Check Supabase dashboard logs
4. Verify all environment variables are set correctly
5. Test in incognito mode to rule out cache issues

---

**Deployment Status Checklist:**

- [ ] Database migration applied successfully
- [ ] Environment variables configured
- [ ] Game tested on desktop
- [ ] Game tested on mobile
- [ ] Leaderboard submission works
- [ ] Leaderboard display works
- [ ] VR detection working correctly
- [ ] No console errors
- [ ] Performance is acceptable (30+ FPS)
- [ ] Analytics tracking enabled (optional)

**Ready for launch! 🚀**
