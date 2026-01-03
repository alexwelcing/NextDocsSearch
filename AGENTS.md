# NextDocsSearch 3D Scene Architecture Guide

## Overview

NextDocsSearch is an interactive 3D documentation and content exploration platform built with React-Three-Fiber. It combines immersive 3D environments, AI-powered chat, gamification, and content presentation in a unique web-based experience.

**Tech Stack:**
- **Next.js** - Application framework
- **React-Three-Fiber (R3F)** - React renderer for Three.js
- **@react-three/drei** - R3F helpers and abstractions
- **@react-three/cannon** - Physics engine (Cannon.js)
- **@react-three/xr** - WebXR/VR support
- **Three.js** - 3D graphics library
- **Styled Components** - Component styling
- **Supabase** - Backend and data storage

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Hierarchy](#component-hierarchy)
3. [Core Systems](#core-systems)
4. [Component Details](#component-details)
5. [State Management](#state-management)
6. [Data Flow](#data-flow)
7. [Recommendations](#recommendations)
8. [Testing Strategy](#testing-strategy)

---

## Architecture Overview

### High-Level Structure

```
pages/index.tsx
    └── ThreeSixty.tsx (Main 3D Scene)
        ├── Canvas (R3F Root)
        │   ├── XR (VR Support)
        │   │   └── PhysicsEnvironment
        │   │       ├── Scene Core
        │   │       │   ├── CinematicCamera (Intro)
        │   │       │   ├── CameraController (Gameplay)
        │   │       │   ├── OrbitControls (User Navigation)
        │   │       │   └── SceneLighting
        │   │       ├── Background Systems
        │   │       │   ├── BackgroundSphere
        │   │       │   ├── GaussianSplatBackground
        │   │       │   └── SeasonalEffects
        │   │       ├── Interactive Content
        │   │       │   └── InteractiveTablet
        │   │       │       └── TerminalInterface (2D Overlay)
        │   │       ├── Game Systems
        │   │       │   ├── BouncingBall
        │   │       │   └── ClickingGame
        │   │       │       ├── GameOrb (instances)
        │   │       │       └── ParticleExplosion (instances)
        │   │       └── PhysicsGround
        │   └── Stats (dev only)
        └── UI Overlays (Outside Canvas)
            ├── CinematicIntro
            ├── GameStartOverlay
            ├── GameHUD
            ├── GameLeaderboard
            └── PerformanceMonitor (dev only)
```

---

## Component Hierarchy

### Entry Point: `pages/index.tsx`

**File:** `pages/index.tsx:1`

**Responsibilities:**
- Application entry point
- Manages 2D/3D mode toggle
- Provides context wrappers (SupabaseDataProvider, JourneyProvider)
- Renders navigation and footer
- Handles game state propagation to UI

**Key Features:**
- Dynamic import of ThreeSixty component (SSR disabled)
- Background image rotation
- Journey system integration (achievements, quests)
- Responsive layout switching

---

### Core Scene: `ThreeSixty.tsx`

**File:** `components/3d/scene/ThreeSixty.tsx:1`

**Responsibilities:**
- Main 3D scene orchestrator
- Manages all scene state (game, cinematic, seasonal themes)
- Coordinates between 3D canvas and 2D UI overlays
- Handles VR session management
- Controls background switching (image vs Gaussian splat)

**Key State:**
- `gameState`: Current game phase (IDLE, STARTING, COUNTDOWN, PLAYING, GAME_OVER)
- `cinematicComplete`: Whether intro animation has finished
- `currentSeason`: Active seasonal theme
- `useGaussianSplat`: Background rendering mode

**Props Interface:**
```typescript
interface ThreeSixtyProps {
  currentImage: string;
  isDialogOpen: boolean;
  onChangeImage: (newImage: string) => void;
  onGameStateChange?: (gameState: GameState) => void;
}
```

---

## Core Systems

### 1. Physics System

**Components:** PhysicsEnvironment, PhysicsGround

**Physics Configuration:**
```typescript
{
  gravity: [0, -9.81, 0],
  iterations: 5,
  tolerance: 0.01,
  allowSleep: true,
  broadphase: "SAP",
  defaultContactMaterial: {
    friction: 0.1,
    restitution: 0.7
  }
}
```

**Ground Planes:**
- Ground plane at y=-5.5 (invisible, physics-enabled)
- Ceiling plane at y=14.5 (invisible, physics-enabled)
- Both use high restitution (0.9) for bouncing physics

**Files:**
- `components/3d/scene/ThreeSixty.tsx:28-44` (PhysicsEnvironment)
- `components/3d/scene/PhysicsGround.tsx:1` (Ground planes)

---

### 2. Camera System

**Three camera control systems work in sequence:**

#### a) CinematicCamera (Intro Sequence)

**File:** `components/3d/camera/CinematicCamera.tsx:1`

**Duration:** 16 seconds

**Keyframes:**
1. **Start (0-30%):** Far back view (0, 5, 15) → Mid (2, 4, 12)
2. **Mid (30-60%):** Mid → Tablet Reveal (0, 3, 10)
3. **Tablet Reveal (60-100%):** Tablet → Final position (0, 2, 10)

**FOV Changes:** 45° → 50° → 55° → 60°

**Easing:** Cubic in-out for smooth cinematics

#### b) CameraController (Game Transitions)

**File:** `components/3d/camera/CameraController.tsx:1`

**Triggers:** When gameState === 'COUNTDOWN'

**Behavior:**
- Smoothly pans camera to face forward (shooting gallery view)
- Uses spherical coordinates for smooth rotation
- Target: azimuth=0, polar=90° (horizontal forward view)
- Duration: ~1.5 seconds (ease-out)

#### c) OrbitControls (Free Navigation)

**File:** `components/3d/scene/ThreeSixty.tsx:547-559`

**Settings:**
- Damping enabled (factor: 0.1)
- Rotate speed: 0.5
- Zoom: 5-50 units
- Max polar angle: 90° (can't look below horizon)
- Pan disabled

**Active:** When cinematicComplete && not in game countdown

---

### 3. Lighting System

**File:** `components/3d/scene/SceneLighting.tsx:1`

**Lighting Rig:**
1. **Ambient Light:** Base illumination (0.5 intensity, #f0f4ff)
2. **Main Key Light:** Primary directional (0.9 intensity, position [8, 12, 6])
3. **Fill Light:** Left-side softener (0.4 intensity, position [-8, 8, 4])
4. **Rim Light:** Back highlight (0.3 intensity, position [0, 5, -10])
5. **Hemisphere Light:** Sky/ground gradient (0.4 intensity, #87ceeb/#4a3f7f)
6. **Tablet Spotlight:** Focused on tablet area (0.6 intensity, 0.4 angle)
7. **Accent Point Lights:** Atmospheric glow (pink/blue, 0.3 intensity)

**Cinematic Mode:**
- All lights dim to 10-20% during intro
- Gradual brightness increase with cinematicProgress
- "Eye opening" effect with breathing animation

---

### 4. Background System

**Two rendering modes:**

#### a) BackgroundSphere (Image-based)

**File:** `components/3d/background/BackgroundSphere.tsx:1`

**Features:**
- Dual-sphere crossfade system (seamless transitions)
- Texture optimization (max 2048px, mipmapping)
- Performance-optimized geometry (24x12 segments)
- Ref-based animations (no setState in useFrame)

**Transition Flow:**
1. Old texture at 100% opacity
2. New texture loads in background
3. New texture fades in 0% → 100%
4. New becomes old, cycle repeats

#### b) GaussianSplatBackground (Splat-based)

**File:** `components/3d/background/GaussianSplatBackground.tsx:1`

**Technology:** @mkkellogg/gaussian-splats-3d

**Features:**
- Photorealistic volumetric rendering
- Supports .ply/.splat files
- Auto-detected from `/public/splats/` directory
- Disabled on mobile (performance)

**API Integration:** `/api/getSplats` returns available splat files

---

### 5. Seasonal Effects System

**File:** `components/3d/background/SeasonalEffects.tsx:1`

**Effect Types:**
- **Snow:** 1000 particles, falling with drift
- **Leaves (Autumn):** 500 particles, swaying fall
- **Petals (Spring):** 400 particles, spiral motion
- **Fireflies (Summer):** 200 particles, floating glow
- **Spiderwebs (Halloween):** Radial web geometry with shimmer

**Performance:**
- Disabled on mobile
- Disabled during gameplay
- Particle count scales with `theme.particleIntensity`
- Uses BufferGeometry for efficiency

**Season Detection:** Automatic based on date, override via `?season=` query param

**Themes File:** `lib/theme/seasonalTheme.ts`

---

### 6. Interactive Tablet System

**File:** `components/3d/interactive/InteractiveTablet.tsx:1`

**Physical Properties:**
- Dimensions: 4×3×0.2 units
- Physics body: mass=0 (floating, no gravity)
- Billboard effect: always faces camera
- Collision box for pointer events

**Visual Elements:**
- Main body: Rounded metallic box (#1a1a2e)
- Screen: Glowing plane (emissive when powered)
- Power button: Bottom-left indicator
- Content preview: Icon + text hints
- Point light emission when active

**Interaction:**
- Click tablet → Opens TerminalInterface
- Power button toggles on/off state
- Cinematic reveal: elastic scale animation
- Hidden during gameplay

**States:**
- `isPoweredOn`: Screen active/inactive
- `terminalOpen`: Overlay displayed
- `pulseAnimation`: Hint text breathing

---

### 7. Terminal Interface (2D Overlay)

**File:** `components/overlays/TerminalInterface.tsx:1`

**Three-Page System:**

#### Page 1: Apps
- **Chat Tab:** AI Q&A interface with Supabase integration
- **Blog Tab:** Article carousel with navigation
- **Quiz Tab:** Interactive article quizzes

#### Page 2: Leaderboard
- Top scores display
- Player stats (combo, accuracy)
- Play game button

**Quest System Integration:**
- Tabs locked until quests completed
- Progress tracking (questions asked, articles read)
- Feature unlocking based on journey progress

**UI Features:**
- Full-screen modal overlay
- ESC key to close
- Glassmorphic design (#0a0a0f → #1a1a2e gradient)
- Monospace terminal aesthetic
- Smooth tab transitions

**Data Sources:**
- Articles: Passed via props from parent
- Leaderboard: `/api/game/get-leaderboard`
- Chat: SupabaseDataContext

---

### 8. Game System

#### ClickingGame (Core Game Logic)

**File:** `components/3d/game/ClickingGame.tsx:1`

**Game Flow:**
1. **IDLE:** BouncingBall visible, 3 idle orbs
2. **STARTING:** Overlay appears, orbs cleared
3. **COUNTDOWN:** 3-2-1 counter
4. **PLAYING:** 30 seconds, spawning orbs
5. **GAME_OVER:** Leaderboard with stats

**Orb Spawning:**
- Position: 160° front-facing arc, 8-14 units from center
- Spawn rate: Increases over time (0.5s → 0.25s → 0.167s)
- Max concurrent: 6 (3 on mobile)
- Golden orbs: 5% chance, 30 points (vs 10)

**Combo System:**
- 3x combo: 2x multiplier
- 5x combo: 3x multiplier
- Combo breaks on miss (timeout)

**Stats Tracked:**
- Score, combo max, accuracy
- Total clicks, successful clicks

#### GameOrb (Individual Targets)

**File:** `components/3d/game/GameOrb.tsx:1`

**Lifetime:** 3 seconds (configurable)

**Animations:**
- Pulsing scale (golden orbs pulse faster)
- Gentle rotation
- Fade-out in last 0.5s

**Visuals:**
- Core sphere: Metallic with emissive glow
- Outer glow: Transparent sphere at 1.3x scale
- Golden: #FFD700/#FFA500, Blue: #00BFFF/#0080FF

#### BouncingBall (Game Trigger)

**File:** `components/3d/game/BouncingBall.tsx` (not shown but referenced)

**Behavior:**
- Physics-enabled sphere
- Bounces continuously
- Click to trigger game start
- Only visible in IDLE state

---

### 9. Journey/Quest System

**File:** `components/contexts/JourneyContext.tsx:1`

**Context Provider:** Wraps entire app, manages progression

**Quest Types:**
1. `first-question`: Ask AI a question
2. `read-article`: View an article for 2+ seconds
3. `play-game`: Complete one game
4. `leaderboard-rank`: Score ≥ 5000

**Unlockable Features:**
- `chat`: Always unlocked
- `articles`: Unlocked via quest
- `quiz`: Unlocked via quest
- `leaderboard`: Unlocked via quest

**Achievements:**
- `first-steps`: Complete first quest
- `bookworm`: Read 5+ articles
- `curious-mind`: Ask 10+ questions
- `scholar`: 100% quiz score
- `game-master`: 10,000+ game score
- `perfectionist`: Complete all quests

**Persistence:** LocalStorage (`journeyProgress` key)

**Stats Tracked:**
```typescript
{
  questionsAsked: number;
  articlesRead: string[];
  quizzesTaken: number;
  highestQuizScore: number;
  gamesPlayed: number;
  highestGameScore: number;
}
```

---

## Component Details

### PhysicsGround
**File:** `components/3d/scene/PhysicsGround.tsx:1`

- Invisible collision planes
- Ground: y=-5.5, Ceiling: y=14.5
- 30×30 unit planes
- High restitution (0.9) for bouncy physics
- Memoized geometry for performance

---

### ParticleExplosion
**Referenced in:** `components/3d/game/ClickingGame.tsx:4`

**Trigger:** Orb hit event

**Behavior:**
- Spawns at orb position
- Color matches orb type (golden/blue)
- Limited to 5 concurrent explosions
- Auto-cleanup on complete

---

### GameHUD
**Referenced in:** `components/3d/scene/ThreeSixty.tsx:642-649`

**Display Elements:**
- Score (top-left)
- Time remaining (top-center)
- Combo counter (with multiplier indicator)
- Only visible during PLAYING state

---

### GameStartOverlay
**Referenced in:** `components/3d/scene/ThreeSixty.tsx:634-640`

**Two Modes:**
1. **STARTING:** "Press Start to Begin" button
2. **COUNTDOWN:** Large number display (3, 2, 1, GO!)

---

### GameLeaderboard
**Referenced in:** `components/3d/scene/ThreeSixty.tsx:651-658`

**Features:**
- Player's final score highlighted
- Stats breakdown (combo, accuracy)
- Top 10 scores from Supabase
- "Play Again" button
- Submit score to database

---

### CinematicIntro
**Referenced in:** `components/3d/scene/ThreeSixty.tsx:625-631`

**2D Overlay:**
- Fade-in/out sequences
- Skip button (stores preference in localStorage)
- Progress bar
- Title cards or narrative text
- Only shows once per session (unless manually replayed)

---

## State Management

### Local State (ThreeSixty.tsx)

```typescript
// Articles & Loading
const [articles, setArticles] = useState<ArticleData[]>([]);
const [loading, setLoading] = useState(true);

// Background Control
const [currentImage, setCurrentImage] = useState<string>('');
const [useGaussianSplat, setUseGaussianSplat] = useState(false);
const [selectedSplat, setSelectedSplat] = useState<string>('');

// Cinematic State
const [showCinematicIntro, setShowCinematicIntro] = useState(() => {
  return !localStorage.getItem('hasWatchedIntro');
});
const [cinematicComplete, setCinematicComplete] = useState(!showCinematicIntro);
const [cinematicProgress, setCinematicProgress] = useState(0);

// Seasonal Theme
const [currentSeason, setCurrentSeason] = useState<Season>(() => {
  const params = new URLSearchParams(window.location.search);
  return getCurrentSeason(params.get('season'));
});
const [seasonalTheme, setSeasonalTheme] = useState<SeasonalTheme>(...);

// Game State
const [gameState, setGameState] = useState<GameState>('IDLE');
const [score, setScore] = useState(0);
const [timeRemaining, setTimeRemaining] = useState(30);
const [combo, setCombo] = useState(0);
const [gameStats, setGameStats] = useState<GameStats>({...});
```

### Context State

#### SupabaseDataContext
**File:** `components/contexts/SupabaseDataContext.tsx`

**Provides:**
- `chatData`: { question: string, response: string }
- `setChatData`: Update function
- Supabase client connection

#### JourneyContext
**File:** `components/JourneyContext.tsx:1`

**Provides:**
- `progress`: Current journey state
- `currentQuest`: Active quest object
- `availableQuests`: Unlocked quests
- `completeQuest(id)`: Mark quest done
- `isFeatureUnlocked(id)`: Check unlock status
- `updateStats(stat, value)`: Track metrics
- `achievements`: Achievement array
- `unlockAchievement(id)`: Award achievement

---

## Data Flow

### 1. Initial Load Flow

```
index.tsx (mount)
    ↓
Fetch background image (/api/backgroundImages)
    ↓
ThreeSixty mounts
    ↓
Parallel fetches:
    - Articles (/api/articles)
    - Splat files (/api/getSplats)
    ↓
Check localStorage for intro preference
    ↓
CinematicIntro or Skip to scene
    ↓
InteractiveTablet revealed
```

### 2. Game Start Flow

```
User clicks BouncingBall
    ↓
gameState → STARTING
    ↓
GameStartOverlay appears
    ↓
User clicks "Start"
    ↓
gameState → COUNTDOWN (3s)
CameraController pans forward
    ↓
gameState → PLAYING
GameHUD visible
ClickingGame spawning orbs
    ↓
Timer expires (30s)
    ↓
gameState → GAME_OVER
GameLeaderboard with score submission
    ↓
"Play Again" → IDLE → loop
```

### 3. Terminal Interface Flow

```
User clicks InteractiveTablet
    ↓
terminalOpen → true
TerminalInterface modal appears
    ↓
Tab selection (Chat/Blog/Quiz)
Check isFeatureUnlocked()
    ↓
If Chat:
    - User types question
    - Question stored in SupabaseDataContext
    - updateStats('questionsAsked')
    - Check quest completion
    ↓
If Blog:
    - Navigate articles
    - After 2s, mark article read
    - updateStats('articlesRead')
    ↓
If Quiz:
    - Load quiz for current article
    - Submit answers
    - updateStats('highestQuizScore')
    ↓
Quest completion triggers:
    - completeQuest(id)
    - unlockFeature(id)
    - Possibly unlockAchievement(id)
```

### 4. Seasonal Theme Flow

```
Page load or URL change
    ↓
Read ?season= query param
    ↓
getCurrentSeason(param || auto-detect)
    ↓
getSeasonalTheme(season)
    ↓
Apply to SeasonalEffects component
    ↓
Render appropriate particles/effects
```

---

## Recommendations

### Architecture Improvements

#### 1. Component Organization
**Current State:** All components in flat `/components` directory

**Recommendation:**
```
components/
  ├── 3d/
  │   ├── scene/
  │   │   ├── ThreeSixty.tsx
  │   │   ├── SceneLighting.tsx
  │   │   └── PhysicsGround.tsx
  │   ├── camera/
  │   │   ├── CinematicCamera.tsx
  │   │   └── CameraController.tsx
  │   ├── background/
  │   │   ├── BackgroundSphere.tsx
  │   │   ├── GaussianSplatBackground.tsx
  │   │   └── SeasonalEffects.tsx
  │   ├── interactive/
  │   │   └── InteractiveTablet.tsx
  │   └── game/
  │       ├── ClickingGame.tsx
  │       ├── GameOrb.tsx
  │       ├── BouncingBall.tsx
  │       └── ParticleExplosion.tsx
  ├── overlays/
  │   ├── TerminalInterface.tsx
  │   ├── CinematicIntro.tsx
  │   ├── GameHUD.tsx
  │   ├── GameLeaderboard.tsx
  │   └── GameStartOverlay.tsx
  ├── contexts/
  │   ├── SupabaseDataContext.tsx
  │   └── JourneyContext.tsx
  └── ui/
      └── (existing UI components)
```

**Benefits:**
- Clear separation of 3D vs 2D components
- Easier navigation for new developers
- Better code organization

---

#### 2. State Management

**Current Issues:**
- Large monolithic state in ThreeSixty.tsx (20+ useState calls)
- Prop drilling (gameState, cinematicProgress, etc.)
- No clear separation of concerns

**Recommendation A: useReducer**
```typescript
// Define game state machine
type GameAction =
  | { type: 'START_GAME' }
  | { type: 'BEGIN_COUNTDOWN' }
  | { type: 'START_PLAYING' }
  | { type: 'END_GAME'; payload: GameStats }
  | { type: 'RESET' };

function gameReducer(state: GameState, action: GameAction) {
  // Centralized state transitions
}

// In ThreeSixty.tsx
const [state, dispatch] = useReducer(gameReducer, initialState);
```

**Recommendation B: Zustand Store**
```typescript
// stores/gameStore.ts
import create from 'zustand';

export const useGameStore = create((set) => ({
  gameState: 'IDLE',
  score: 0,
  combo: 0,
  startGame: () => set({ gameState: 'STARTING' }),
  updateScore: (points) => set((state) => ({
    score: state.score + points
  })),
  // ...
}));
```

**Benefits:**
- Cleaner component code
- Easier testing
- Better debugging
- Eliminates prop drilling

---

#### 3. Performance Optimizations

**Current Bottlenecks:**
- Seasonal effects re-create particles on every render
- Multiple useFrame hooks (potential frame rate drops)
- No LOD (Level of Detail) system for distant objects

**Recommendations:**

**A. Implement LOD System:**
```typescript
import { Lod } from '@react-three/drei';

<Lod distances={[0, 10, 20]}>
  <HighDetailOrb />  {/* < 10 units */}
  <MediumDetailOrb /> {/* 10-20 units */}
  <LowDetailOrb />   {/* > 20 units */}
</Lod>
```

**B. Optimize Seasonal Effects:**
```typescript
// Use instanced meshes for particles
import { Instances, Instance } from '@react-three/drei';

<Instances limit={1000} geometry={particleGeometry} material={particleMaterial}>
  {particles.map((p, i) => (
    <Instance key={i} position={p.position} />
  ))}
</Instances>
```

**C. Implement Frame Budget:**
```typescript
// Limit expensive operations to specific frames
const frameCounter = useRef(0);

useFrame(() => {
  frameCounter.current++;

  // Only update particles every 2nd frame
  if (frameCounter.current % 2 === 0) {
    updateParticles();
  }
});
```

**D. Use Web Workers for Heavy Computation:**
```typescript
// workers/particlePhysics.worker.ts
self.onmessage = (e) => {
  const { particles, delta } = e.data;
  // Calculate new positions
  const updated = computeParticlePositions(particles, delta);
  self.postMessage(updated);
};

// In component
const worker = useMemo(() => new Worker('...'), []);
```

---

#### 4. Code Quality

**Issues:**
- TypeScript warnings with `@ts-ignore` comments (OrbitControls access)
- Inconsistent error handling
- No loading states for async operations

**Recommendations:**

**A. Type-Safe OrbitControls:**
```typescript
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { OrbitControls } from '@react-three/drei';

const controlsRef = useRef<OrbitControlsImpl>(null);

<OrbitControls
  ref={controlsRef}
  makeDefault
  // Now type-safe access:
  onChange={() => {
    const azimuth = controlsRef.current?.getAzimuthalAngle();
  }}
/>
```

**B. Centralized Error Handling:**
```typescript
// utils/errorHandling.ts
export function handleAsyncError<T>(
  promise: Promise<T>,
  errorMessage: string
): Promise<T | null> {
  return promise.catch((error) => {
    console.error(errorMessage, error);
    // Send to error tracking service (Sentry, etc.)
    return null;
  });
}

// Usage
const articles = await handleAsyncError(
  fetch('/api/articles').then(r => r.json()),
  'Failed to load articles'
);
```

**C. Suspense Boundaries:**
```typescript
// Add loading states
<Suspense fallback={<LoadingSpinner />}>
  <BackgroundSphere imageUrl={currentImage} />
</Suspense>

<ErrorBoundary fallback={<ErrorDisplay />}>
  <InteractiveTablet />
</ErrorBoundary>
```

---

#### 5. Accessibility

**Current Issues:**
- No keyboard navigation for 3D interactions
- No screen reader support
- No reduced motion preferences

**Recommendations:**

**A. Keyboard Controls:**
```typescript
// Add keyboard event listeners
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    switch(e.key) {
      case 'Enter':
        // Activate focused object
        break;
      case 'Tab':
        // Cycle through interactive elements
        break;
      case 'Escape':
        // Close overlays
        break;
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

**B. Reduced Motion:**
```typescript
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

<SeasonalEffects
  season={currentSeason}
  theme={seasonalTheme}
  disabled={prefersReducedMotion}
/>
```

**C. ARIA Labels:**
```typescript
<button
  onClick={handleGameStart}
  aria-label="Start sphere hunting game"
  aria-describedby="game-instructions"
>
  Start Game
</button>
```

---

#### 6. Testing Infrastructure

**Current State:** No visible test files

**Recommendation:** See Testing Strategy section below

---

#### 7. Documentation

**Current Issues:**
- Limited inline documentation
- Complex systems not explained (quest flow, physics setup)
- No API documentation for custom hooks

**Recommendations:**

**A. JSDoc Comments:**
```typescript
/**
 * Orchestrates the main 3D scene including camera, lighting, and game systems.
 *
 * @component
 * @param {string} currentImage - URL of the background image
 * @param {boolean} isDialogOpen - Whether the search dialog is open
 * @param {function} onChangeImage - Callback to fetch a new background
 * @param {function} onGameStateChange - Callback when game state changes
 *
 * @example
 * <ThreeSixty
 *   currentImage="/images/space.jpg"
 *   isDialogOpen={false}
 *   onChangeImage={fetchNewImage}
 *   onGameStateChange={handleGameState}
 * />
 */
```

**B. README per Subsystem:**
```
components/3d/game/README.md
components/3d/camera/README.md
components/contexts/README.md
```

**C. Storybook for Component Showcase:**
```typescript
// InteractiveTablet.stories.tsx
export const Default = () => (
  <Canvas>
    <InteractiveTablet
      initialPosition={[0, 3, 5]}
      isGamePlaying={false}
      articles={mockArticles}
    />
  </Canvas>
);
```

---

#### 8. Monitoring & Analytics

**Recommendations:**

**A. Performance Tracking:**
```typescript
// Track FPS drops
const fpsTracker = useRef({ frames: 0, lastTime: Date.now() });

useFrame(() => {
  fpsTracker.current.frames++;
  const now = Date.now();

  if (now - fpsTracker.current.lastTime >= 1000) {
    const fps = fpsTracker.current.frames;

    if (fps < 30) {
      // Log performance warning
      console.warn('Low FPS detected:', fps);
      // Send to analytics
    }

    fpsTracker.current.frames = 0;
    fpsTracker.current.lastTime = now;
  }
});
```

**B. User Interaction Analytics:**
```typescript
// Track game metrics
const trackEvent = (event: string, data: any) => {
  if (window.gtag) {
    window.gtag('event', event, data);
  }
};

// Usage
trackEvent('game_complete', {
  score: finalScore,
  combo_max: comboMax,
  duration: 30,
  accuracy: accuracy
});
```

---

#### 9. Mobile Optimization

**Current Mobile Handling:**
- Reduced DPR (0.3-0.8)
- Disabled Gaussian splats
- Disabled seasonal effects
- Reduced max orbs (3 vs 6)

**Additional Recommendations:**

**A. Adaptive Quality:**
```typescript
const deviceTier = useMemo(() => {
  const gl = document.createElement('canvas').getContext('webgl');
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

  if (renderer.includes('Mali') || renderer.includes('Adreno 5')) {
    return 'low';
  } else if (renderer.includes('Adreno 6')) {
    return 'medium';
  }
  return 'high';
}, []);

// Apply quality settings
const quality = {
  low: { dpr: 0.5, particles: 100, orbs: 2 },
  medium: { dpr: 0.8, particles: 300, orbs: 4 },
  high: { dpr: 1.5, particles: 1000, orbs: 6 }
}[deviceTier];
```

**B. Touch Controls:**
```typescript
// Add touch-specific interactions
const handleTouch = useCallback((e: TouchEvent) => {
  if (e.touches.length === 2) {
    // Pinch to zoom
  } else if (e.touches.length === 1) {
    // Pan camera
  }
}, []);
```

---

#### 10. Developer Experience

**Recommendations:**

**A. Hot Module Replacement for 3D:**
```typescript
// Use react-refresh for R3F
if (import.meta.hot) {
  import.meta.hot.accept();
}
```

**B. Debug Tools:**
```typescript
// Add debug panel
import { useControls } from 'leva';

const { orbCount, spawnRate, showBounds } = useControls({
  orbCount: { value: 6, min: 1, max: 20 },
  spawnRate: { value: 0.5, min: 0.1, max: 2 },
  showBounds: false
});
```

**C. Visual Regression Testing:**
```bash
# Snapshot 3D scenes for comparison
npm run test:visual
```

---

## Testing Strategy

### 1. Unit Testing

**Framework:** Jest + React Testing Library

**Target Components:**
- Utility functions (easing, position generation, collision detection)
- State reducers
- Custom hooks
- Context providers

**Example Test Structure:**
```typescript
// __tests__/utils/collision.test.ts
import { isTooClose } from '@/utils/collision';

describe('isTooClose', () => {
  it('returns true when orbs are within minimum distance', () => {
    const newPos: [number, number, number] = [0, 0, 0];
    const existingOrbs = [
      { id: '1', position: [1, 1, 1], isGolden: false }
    ];

    expect(isTooClose(newPos, existingOrbs, 3)).toBe(true);
  });

  it('returns false when orbs are far apart', () => {
    const newPos: [number, number, number] = [0, 0, 0];
    const existingOrbs = [
      { id: '1', position: [10, 10, 10], isGolden: false }
    ];

    expect(isTooClose(newPos, existingOrbs, 3)).toBe(false);
  });
});
```

```typescript
// __tests__/contexts/JourneyContext.test.tsx
import { renderHook, act } from '@testing-library/react';
import { JourneyProvider, useJourney } from '@/components/JourneyContext';

describe('JourneyContext', () => {
  it('completes quest and unlocks features', () => {
    const wrapper = ({ children }) => (
      <JourneyProvider>{children}</JourneyProvider>
    );

    const { result } = renderHook(() => useJourney(), { wrapper });

    act(() => {
      result.current.completeQuest('first-question');
    });

    expect(result.current.progress.completedQuests).toContain('first-question');
    expect(result.current.isFeatureUnlocked('articles')).toBe(true);
  });
});
```

---

### 2. Integration Testing

**Framework:** Playwright or Cypress

**Test Scenarios:**

#### A. Cinematic Intro Flow
```typescript
// e2e/intro.spec.ts
test('completes cinematic intro and reveals scene', async ({ page }) => {
  await page.goto('/');

  // Wait for cinematic to start
  await expect(page.locator('[data-testid="cinematic-intro"]')).toBeVisible();

  // Skip intro
  await page.click('[data-testid="skip-intro-button"]');

  // Verify scene is visible
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('[data-testid="interactive-tablet"]')).toBeVisible();

  // Verify preference saved
  const hasWatched = await page.evaluate(() =>
    localStorage.getItem('hasWatchedIntro')
  );
  expect(hasWatched).toBe('true');
});
```

#### B. Game Play Flow
```typescript
// e2e/game.spec.ts
test('completes full game cycle', async ({ page }) => {
  await page.goto('/?skipIntro=true');

  // Click bouncing ball
  await page.click('[data-testid="bouncing-ball"]');

  // Verify overlay appears
  await expect(page.locator('[data-testid="game-start-overlay"]')).toBeVisible();

  // Start game
  await page.click('button:has-text("Start")');

  // Wait for countdown
  await page.waitForTimeout(3500);

  // Verify HUD
  await expect(page.locator('[data-testid="game-hud"]')).toBeVisible();

  // Click some orbs (simulate gameplay)
  for (let i = 0; i < 5; i++) {
    await page.click('[data-testid="game-orb"]', { timeout: 5000 });
    await page.waitForTimeout(500);
  }

  // Wait for game to end (30s timeout)
  await page.waitForSelector('[data-testid="game-leaderboard"]', {
    timeout: 35000
  });

  // Verify score display
  const score = await page.textContent('[data-testid="final-score"]');
  expect(parseInt(score)).toBeGreaterThan(0);
});
```

#### C. Terminal Interface Flow
```typescript
// e2e/terminal.spec.ts
test('navigates terminal tabs and interacts', async ({ page }) => {
  await page.goto('/?skipIntro=true');

  // Click tablet
  await page.click('[data-testid="interactive-tablet"]');

  // Terminal opens
  await expect(page.locator('[data-testid="terminal-interface"]')).toBeVisible();

  // Chat tab active by default
  await page.fill('input[placeholder*="question"]', 'What is this?');
  await page.click('button:has-text("Send")');

  // Check quest completion
  // (Assumes first-question quest)

  // Switch to blog tab
  await page.click('button:has-text("ARTICLES")');

  // Navigate articles
  await page.click('button:has-text("NEXT")');
  await page.waitForTimeout(2100); // Quest tracking delay

  // Close terminal
  await page.click('button:has-text("CLOSE")');

  // Verify closed
  await expect(page.locator('[data-testid="terminal-interface"]')).not.toBeVisible();
});
```

---

### 3. Visual Regression Testing

**Framework:** Percy or Chromatic

**Snapshots:**
- Initial scene load
- Cinematic camera positions (keyframes)
- Game states (IDLE, PLAYING, GAME_OVER)
- Terminal interface tabs
- Seasonal effects (one per season)
- Mobile vs desktop layouts

**Example:**
```typescript
// visual-regression/scenes.spec.ts
import percySnapshot from '@percy/playwright';

test('captures scene states', async ({ page }) => {
  await page.goto('/?skipIntro=true');

  // Default state
  await percySnapshot(page, 'Scene - IDLE');

  // Change to autumn
  await page.goto('/?season=autumn&skipIntro=true');
  await percySnapshot(page, 'Scene - Autumn');

  // Open terminal
  await page.click('[data-testid="interactive-tablet"]');
  await percySnapshot(page, 'Terminal - Chat Tab');

  await page.click('button:has-text("ARTICLES")');
  await percySnapshot(page, 'Terminal - Articles Tab');
});
```

---

### 4. Performance Testing

**Framework:** Lighthouse CI + Custom Metrics

**Metrics to Track:**
- FPS (target: 60fps on desktop, 30fps on mobile)
- Memory usage (no leaks over 5 minutes)
- Initial load time (< 3s)
- Time to interactive (< 5s)
- 3D asset load time

**Example:**
```typescript
// performance/fps-tracking.spec.ts
test('maintains 30+ FPS during gameplay', async ({ page }) => {
  await page.goto('/?skipIntro=true');

  // Start FPS monitoring
  const fps = await page.evaluate(() => {
    const samples = [];
    let lastTime = performance.now();

    return new Promise((resolve) => {
      function measureFPS() {
        const now = performance.now();
        const delta = now - lastTime;
        const currentFps = 1000 / delta;
        samples.push(currentFps);
        lastTime = now;

        if (samples.length >= 300) { // 5 seconds @ 60fps
          const avgFps = samples.reduce((a, b) => a + b) / samples.length;
          resolve(avgFps);
        } else {
          requestAnimationFrame(measureFPS);
        }
      }

      requestAnimationFrame(measureFPS);
    });
  });

  expect(fps).toBeGreaterThan(30);
});
```

---

### 5. Accessibility Testing

**Framework:** axe-core + Pa11y

**Checks:**
- Keyboard navigation
- ARIA labels
- Color contrast
- Focus indicators
- Screen reader compatibility

**Example:**
```typescript
// a11y/keyboard-nav.spec.ts
test('supports keyboard navigation', async ({ page }) => {
  await page.goto('/?skipIntro=true');

  // Tab to tablet
  await page.keyboard.press('Tab');

  // Verify focus
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  expect(focused).toBe('interactive-tablet');

  // Press Enter to activate
  await page.keyboard.press('Enter');

  // Terminal opens
  await expect(page.locator('[data-testid="terminal-interface"]')).toBeVisible();

  // ESC to close
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="terminal-interface"]')).not.toBeVisible();
});
```

---

### 6. API Testing

**Framework:** Jest + MSW (Mock Service Worker)

**Endpoints to Test:**
- `/api/articles`
- `/api/backgroundImages`
- `/api/getSplats`
- `/api/game/get-leaderboard`
- `/api/game/submit-score`
- `/api/quiz`

**Example:**
```typescript
// __tests__/api/articles.test.ts
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/articles', (req, res, ctx) => {
    return res(
      ctx.json([
        { title: 'Test Article', date: '2024-01-01', author: ['Test'] }
      ])
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('fetches articles successfully', async () => {
  const response = await fetch('/api/articles');
  const data = await response.json();

  expect(data).toHaveLength(1);
  expect(data[0].title).toBe('Test Article');
});
```

---

### 7. Test Coverage Goals

**Targets:**
- Unit tests: 80%+ coverage
- Integration tests: Critical user paths (100%)
- Visual regression: All major states
- Performance: Key metrics tracked
- Accessibility: WCAG 2.1 AA compliance

**Coverage Areas:**
```
✓ Journey/Quest system (100%)
✓ Game logic (scoring, combos, spawning) (90%)
✓ Camera systems (cinematics, controls) (70%)
✓ Background rendering (sphere, splats) (60%)
✓ Physics interactions (50%)
✓ Seasonal effects (40%)
✓ UI overlays (80%)
✓ Context providers (100%)
```

---

### 8. Continuous Testing

**CI/CD Integration:**

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test:unit

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm playwright install
      - run: pnpm test:e2e

  visual-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm percy exec -- pnpm test:visual

  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            https://preview.com
          budgetPath: ./lighthouse-budget.json
```

---

## Additional Resources

### Key Files Reference

**Scene Core:**
- `components/3d/scene/ThreeSixty.tsx` - Main scene orchestrator
- `components/3d/scene/SceneLighting.tsx` - Lighting setup
- `components/3d/scene/PhysicsGround.tsx` - Collision planes

**Camera:**
- `components/3d/camera/CinematicCamera.tsx` - Intro sequence
- `components/3d/camera/CameraController.tsx` - Game transitions

**Background:**
- `components/3d/background/BackgroundSphere.tsx` - Image-based BG
- `components/3d/background/GaussianSplatBackground.tsx` - Splat-based BG
- `components/3d/background/SeasonalEffects.tsx` - Particle systems

**Interactive:**
- `components/3d/interactive/InteractiveTablet.tsx` - 3D tablet
- `components/overlays/TerminalInterface.tsx` - 2D overlay UI

**Game:**
- `components/3d/game/ClickingGame.tsx` - Game logic
- `components/3d/game/GameOrb.tsx` - Target spheres
- `components/3d/game/BouncingBall.tsx` - Game trigger

**Overlays:**
- `components/overlays/CinematicIntro.tsx` - Intro sequence
- `components/overlays/GameHUD.tsx` - In-game UI
- `components/overlays/GameLeaderboard.tsx` - Score display

**Context:**
- `components/contexts/JourneyContext.tsx` - Quest/progression
- `components/contexts/SupabaseDataContext.tsx` - Data management

**Types:**
- `lib/journey/types.ts` - Quest/achievement definitions
- `lib/theme/seasonalTheme.ts` - Season themes
- `components/3d/game/ClickingGame.tsx:7` - Game state types

---

### External Documentation

- [React-Three-Fiber](https://docs.pmnd.rs/react-three-fiber)
- [Three.js](https://threejs.org/docs/)
- [Cannon.js Physics](https://pmndrs.github.io/cannon-es/)
- [@react-three/drei](https://github.com/pmndrs/drei)
- [Gaussian Splats 3D](https://github.com/mkkellogg/GaussianSplats3D)
- [Next.js](https://nextjs.org/docs)
- [Supabase](https://supabase.com/docs)

---

## Getting Started for New Developers

### 1. Setup

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Generate embeddings (required for AI features)
pnpm embeddings

# Build production
pnpm build
```

### 2. Key Entry Points

**Start Here:**
1. Read this document (AGENTS.md)
2. Explore `pages/index.tsx` - Understand app entry
3. Read `components/ThreeSixty.tsx` - Main scene
4. Run the app and click through features

**Development Workflow:**
1. Make changes to components
2. See hot-reload in browser
3. Check console for errors
4. Use React DevTools + Drei DevTools

### 3. Common Tasks

**Add a new 3D object:**
```typescript
// In ThreeSixty.tsx or child component
<mesh position={[x, y, z]}>
  <boxGeometry args={[1, 1, 1]} />
  <meshStandardMaterial color="hotpink" />
</mesh>
```

**Add a new quest:**
```typescript
// In lib/journey/types.ts
export const QUESTS: Quest[] = [
  // ...existing quests
  {
    id: 'my-new-quest',
    title: 'New Challenge',
    description: 'Do something cool',
    phase: 2,
    unlocks: ['new-feature'],
    requirement: 'previous-quest'
  }
];
```

**Add a new seasonal effect:**
```typescript
// In components/SeasonalEffects.tsx
function MyNewEffect({ theme }: { theme: SeasonalTheme }) {
  // Create particles/geometry
  return <points>...</points>;
}

// In main component:
case 'myeffect':
  return <MyNewEffect theme={theme} />;
```

### 4. Debugging Tips

**3D Scene Issues:**
- Use `<Stats />` to check FPS
- Enable `<gridHelper />` for spatial reference
- Use `<axesHelper />` to verify coordinate system
- Check browser console for Three.js warnings

**Physics Issues:**
- Add `debug` prop to `<Physics>` component
- Visualize collision boxes with `<Debug />`

**State Issues:**
- Use React DevTools to inspect component state
- Add console.logs in useEffect dependencies
- Check localStorage for persisted data

---

## Glossary

**R3F:** React-Three-Fiber - React renderer for Three.js

**Drei:** Collection of helpers for R3F (@react-three/drei)

**Canvas:** R3F root component that creates WebGL context

**useFrame:** R3F hook that runs on every frame (like requestAnimationFrame)

**Billboard:** 3D object that always faces the camera

**LOD:** Level of Detail - rendering optimization technique

**Gaussian Splat:** Point-based rendering technique for photorealistic 3D

**Quest:** Progressive challenge in the journey system

**Achievement:** Award for completing specific milestones

**Orb:** Clickable sphere target in the game

**Combo:** Consecutive hits without missing

**Cinematic:** Scripted camera animation sequence

**DPR:** Device Pixel Ratio - controls render resolution

---

## Version History

**v0.1.2** (Current)
- 3D scene with interactive tablet
- Sphere hunter game
- Journey/quest system
- Seasonal effects
- VR support
- Gaussian splat backgrounds

---

## Contributing

When contributing to the 3D scene:

1. **Follow the architecture** - Keep 3D and 2D components separate
2. **Optimize for performance** - Use refs, memoization, and instancing
3. **Test on mobile** - Ensure features work on lower-end devices
4. **Document your changes** - Update this file and add JSDoc comments
5. **Consider accessibility** - Add keyboard controls and ARIA labels

---

## Support

For questions or issues:
- Check existing documentation
- Review component source code
- Test in isolation using Storybook (recommended)
- Ask in team chat or create GitHub issue

---

**Last Updated:** 2025-11-04
**Maintained By:** Development Team
**Document Version:** 1.0.0
