# Sphere Hunter 360 - Interactive 3D Clicking Game

## Overview

Sphere Hunter is an engaging 30-second clicking challenge that appears on your website's 360° environment. Players compete to achieve the highest score by clicking colorful orbs that spawn around them in 3D space.

## Features

### 🎮 Game Mechanics

- **30-second timer**: Fast-paced gameplay that respects visitors' time
- **Two orb types**:
  - **Blue orbs**: Worth 10 points (95% spawn rate)
  - **Golden orbs**: Worth 30 points (5% spawn rate, rare!)
- **Combo system**:
  - Hit 3+ orbs in a row without missing → **2x point multiplier**
  - Hit 5+ orbs in a row without missing → **3x point multiplier**
  - Missing an orb (letting it despawn) resets your combo
- **Progressive difficulty**:
  - 0-10 seconds: 2 orbs per second
  - 10-20 seconds: 4 orbs per second
  - 20-30 seconds: 6 orbs per second (intense finale!)

### 🏆 Leaderboard System

- **Top 5 only**: Creates exclusivity and competitive drive
- **Persistent storage**: Scores saved in Supabase database
- **Rich stats tracking**:
  - Final score
  - Maximum combo achieved
  - Accuracy percentage (successful clicks / total clicks)
  - Total clicks and successful hits
- **Name entry**: If you make top 5, enter your name for glory!

### 🎨 Visual Feedback

- **Particle explosions**: Color-coded bursts on every successful hit
- **Pulsing animations**: Orbs breathe and glow to attract attention
- **Real-time HUD**:
  - Score with smooth increment animation
  - Countdown timer with warning animation at <5 seconds
  - Combo display with glowing multiplier badge
- **Dynamic difficulty indicators**: Visual intensity increases over time

### 🥽 VR Support

- **Device detection**: VR button only appears on VR-capable devices
- **Full VR compatibility**: Play in immersive mode with VR headsets
- **Automatic controller rendering**: Works seamlessly with VR controllers

## Setup Instructions

### 1. Apply Database Migration

The game requires a Supabase database table to store high scores. Apply the migration:

#### Option A: Using Supabase CLI (Recommended)

```bash
# If you have Supabase CLI installed
supabase db push
```

#### Option B: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/20250127000000_sphere_hunter_leaderboard.sql`
4. Paste and execute the SQL

The migration creates:
- `sphere_hunter_scores` table with fields for player stats
- Indexes for efficient leaderboard queries
- Row Level Security (RLS) policies for public read/insert access

### 2. Verify Environment Variables

Ensure these environment variables are set in your `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

These are required for the leaderboard API endpoints to communicate with Supabase.

### 3. Test the Game

1. Start your development server: `npm run dev`
2. Visit the home page
3. You should see 2-3 orbs floating in the 360° environment
4. Click the **"Start Game"** button overlay to begin

## How to Play

### Starting the Game

1. **IDLE State**: When you first visit the site, you'll see a few orbs gently floating
2. A **"Start Game"** overlay appears with instructions
3. Click **"Start Game"** to begin the 30-second challenge

### During Gameplay

1. **Click orbs** as they appear around you in 360° space
2. **Build combos** by hitting orbs consecutively without missing
3. **Prioritize golden orbs** - they're worth 3x the points!
4. **Use camera controls** to look around (click and drag to rotate view)
5. Watch the **timer** in the top-right corner
6. Your **score** displays in the top-left with smooth animations
7. **Combo multiplier** appears at the bottom when active

### Game Over

1. After 30 seconds, the game ends automatically
2. You'll see your **final stats**:
   - Total score
   - Maximum combo achieved
   - Accuracy percentage
   - Number of successful hits
3. **If you made top 5**: Enter your name to claim your spot on the leaderboard!
4. View the **current top 5 leaderboard**
5. Click **"Play Again"** to try to beat your score

## Game States

```
IDLE → STARTING → PLAYING → GAME_OVER
  ↓       ↓          ↓           ↓
Orbs   Reset    Gameplay    Leaderboard
Float   Game     Active      Display
```

## Technical Architecture

### Components

- **ClickingGame.tsx**: Main game logic, orb spawning, timer, scoring
- **GameOrb.tsx**: Individual clickable orb with animations and lifetime management
- **ParticleExplosion.tsx**: Instanced particle system for hit feedback
- **GameHUD.tsx**: Real-time score/timer/combo overlay display
- **GameStartOverlay.tsx**: Instructions and start button
- **GameLeaderboard.tsx**: Top 5 display and score submission

### API Endpoints

- **`/api/game/submit-score`**: POST endpoint to submit scores
  - Validates player name (1-20 characters)
  - Validates score range (0-100,000)
  - Stores in Supabase with stats
  - Returns inserted record

- **`/api/game/get-leaderboard`**: GET endpoint for top 5
  - Queries Supabase ordered by score (desc) and date (asc)
  - Returns array of top 5 entries
  - Cached for performance

### Database Schema

```sql
create table "public"."sphere_hunter_scores" (
  id bigserial primary key,
  player_name text not null,
  score int not null,
  combo_max int default 0,
  accuracy float default 0,
  total_clicks int default 0,
  successful_clicks int default 0,
  created_at timestamp with time zone default now(),
  session_id uuid default gen_random_uuid()
);
```

### Performance Optimizations

- **Instanced particle rendering**: 30 particles per explosion, single draw call
- **Refs instead of state**: Prevents re-renders during game loop
- **Reduced polygon counts**: Orbs use 16x16 sphere geometry
- **Conditional UI rendering**: Overlays only render when needed
- **Memoized callbacks**: Prevents unnecessary re-creation of handlers

## Customization Options

### Adjust Difficulty

In `components/ClickingGame.tsx`:

```typescript
// Change game duration (line 58)
const gameDuration = 30; // seconds

// Modify spawn rates (lines 161-164)
const getSpawnInterval = (timeElapsed: number): number => {
  if (timeElapsed < 10) return 0.5; // 2 per second
  if (timeElapsed < 20) return 0.25; // 4 per second
  return 0.167; // 6 per second
};

// Adjust golden orb spawn rate (line 148)
const isGolden = Math.random() < 0.05; // 5% chance
```

### Modify Scoring

```typescript
// Orb values in GameOrb.tsx (line 28)
const points = isGolden ? 30 : 10;

// Combo multipliers in ClickingGame.tsx (lines 205-207)
let multiplier = 1;
if (newCombo >= 5) multiplier = 3;
else if (newCombo >= 3) multiplier = 2;
```

### Change Visual Style

In `components/GameHUD.tsx` and `components/GameStartOverlay.tsx`, all colors and styles are defined using styled-components. Modify the theme colors:

```typescript
// Primary color: #de7ea2 (pink)
// Accent color: #8214a0 (purple)
// Golden color: #FFD700
// Blue orb: #00BFFF
```

## Analytics Opportunities

Track engagement metrics:

1. **Game starts**: How many visitors click "Start Game"
2. **Completion rate**: % who finish the full 30 seconds
3. **Average score**: Benchmark player performance
4. **Top 5 submissions**: Conversion to leaderboard entry
5. **Replay rate**: How many play multiple rounds

Implement by adding event tracking to game state transitions.

## Future Enhancement Ideas

### Easy Wins
- ✅ Sound effects (pop on hit, beep for countdown)
- ✅ Mobile haptic feedback
- ✅ Social sharing buttons ("I scored X!")
- ✅ Daily/weekly leaderboard resets

### Medium Complexity
- Power-ups (2x points, slow-motion, rapid fire)
- Different game modes (zen mode, endless, speed run)
- Achievements system (first golden orb, 10x combo, etc.)
- Avatar/profile pictures for leaderboard

### Advanced Features
- Multiplayer co-op or competitive modes
- Seasonal themes/skins for orbs
- NFT rewards for top scores
- Tournament system with brackets
- Spectator mode for watching top players

## Troubleshooting

### Orbs not spawning
- Check browser console for errors
- Verify game state is 'PLAYING'
- Ensure OrbitControls are functioning

### Leaderboard not loading
- Verify Supabase environment variables are set
- Check database migration was applied successfully
- Open browser DevTools → Network tab, check API responses
- Verify Supabase RLS policies are enabled

### VR button not showing
- Expected on non-VR devices (feature, not bug!)
- Test on VR-capable device (Quest, Vive, etc.)
- Check browser console for XR errors

### Poor performance
- Reduce particle count in ParticleExplosion.tsx
- Lower orb spawn rates
- Disable Stats component in production
- Check GPU usage and throttling

## Credits

**Game Design**: Sphere Hunter 360
**Technology Stack**: React, Three.js, React Three Fiber, @react-three/cannon, Supabase
**Visual Effects**: Particle systems, instanced rendering
**Database**: Supabase PostgreSQL with pgvector

---

**Built with ❤️ to create engaging, interactive web experiences**
