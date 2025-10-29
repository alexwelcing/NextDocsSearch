# 🎮 Sphere Hunter 360 - Quick Start Guide

**A 30-second clicking challenge in your 360° environment!**

## ⚡ Quick Setup (5 minutes)

### 1. Apply Database Migration

**Option A: Supabase Dashboard** (Recommended)
```
1. Go to app.supabase.com → Your Project
2. Click "SQL Editor" → "New query"
3. Copy contents of: supabase/migrations/20250127000000_sphere_hunter_leaderboard.sql
4. Paste and click "Run"
5. ✅ Done!
```

**Option B: Supabase CLI**
```bash
supabase db push
```

### 2. Verify Environment Variables

Check your `.env.local` or hosting platform:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key_here
```

### 3. Deploy & Test

```bash
# Build locally to verify
npm run build

# Deploy to your platform
git push origin main  # (or your deployment branch)

# Visit your site - you're done! 🎉
```

## 🎯 How to Play

1. **Visit your site** - See orbs gently floating
2. **Click "Start Game"** - Begin 30-second challenge
3. **Click orbs fast!**
   - Blue orbs = 10 points
   - Golden orbs = 30 points
4. **Build combos** for multipliers (3+ hits = 2x, 5+ hits = 3x)
5. **Game ends** at 30 seconds
6. **Top 5?** Enter your name for the leaderboard!

## 🏆 Leaderboard

- Top 5 scores only (creates competition!)
- Persistent storage in Supabase
- Shows: Score, Max Combo, Accuracy
- Real-time updates

## ✨ Features at a Glance

| Feature | Description |
|---------|-------------|
| **Duration** | 30 seconds |
| **Orb Types** | Blue (10pts), Golden (30pts rare) |
| **Combos** | 3x = 2x points, 5x = 3x points |
| **Difficulty** | Progressive: 2/sec → 4/sec → 6/sec |
| **VR Support** | Auto-detects VR devices |
| **Particles** | Explosions on every hit! |
| **Mobile** | Fully responsive |

## 🐛 Troubleshooting

**Orbs not spawning?**
- Check browser console for errors
- Verify Supabase env vars are set

**Leaderboard not working?**
- Confirm database migration was applied
- Check Supabase → Table Editor for `sphere_hunter_scores` table
- Test API: `curl https://your-site.com/api/game/get-leaderboard`

**VR button not showing?**
- That's normal on non-VR devices! It only appears on VR-capable hardware.

## 📖 Full Documentation

For detailed documentation, see:
- **Game Guide**: [docs/SPHERE_HUNTER_GAME.md](./docs/SPHERE_HUNTER_GAME.md)
- **Deployment**: [docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md)
- **VR & Splats**: [docs/VR_AND_GAUSSIAN_SPLATS.md](./docs/VR_AND_GAUSSIAN_SPLATS.md)

## 🎨 Customization

Want to tweak the game? Edit these values:

**Game duration** (`components/ClickingGame.tsx:58`):
```typescript
const gameDuration = 30; // Change to 60 for longer games
```

**Spawn rates** (`components/ClickingGame.tsx:161-164`):
```typescript
if (timeElapsed < 10) return 0.5; // 2 per second
if (timeElapsed < 20) return 0.25; // 4 per second
return 0.167; // 6 per second
```

**Orb points** (`components/GameOrb.tsx:28`):
```typescript
const points = isGolden ? 30 : 10; // Increase for easier high scores
```

## 🚀 What's Next?

Some ideas to enhance the game:

- [ ] Add sound effects (pop on hit, countdown beeps)
- [ ] Mobile haptic feedback
- [ ] Social sharing ("I scored X!")
- [ ] Daily/weekly leaderboard rotation
- [ ] Power-ups (2x points, slow-mo)
- [ ] Achievements system
- [ ] Multiple difficulty modes

## 📊 Success Metrics

Track these to measure engagement:
- Game starts per visit
- Completion rate
- Average score
- Top 5 submission rate
- Replay rate

---

**Built with**: React Three Fiber, Supabase, React, Next.js

**Game Deployed?** Share your leaderboard! 🎮
