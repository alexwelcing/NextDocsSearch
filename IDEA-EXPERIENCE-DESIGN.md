# The Idea Experience - Design Document

## Vision

Transform the 360 scene from a "menu-based app" into an **immersive idea space** where:

- Content, games, and interactions are spatially integrated
- Progress is visible as environmental transformation
- Discovery replaces navigation
- Play and learning merge seamlessly

---

## Core Concept: The Idea Constellation

Instead of:

- Tablet → Modal menu → Content

We create:

- **Floating idea orbs** in 3D space that you can explore
- **Energy/activation** mechanic (the game) that unlocks deeper content
- **Visual progression** as the space evolves

---

## Component Architecture

### 1. IdeaOrb (Unified Orb System)

One orb type that serves multiple purposes:

```typescript
type OrbState =
  | 'dormant'    // Gray, needs activation
  | 'awakening'  // During game - clickable target
  | 'active'     // Glowing, interactive content
  | 'explored'   // Completed, contributes to constellation

type OrbContent =
  | { type: 'article'; data: ArticleData }
  | { type: 'question'; prompt: string }
  | { type: 'quiz'; topic: string }
  | { type: 'creation'; template: string }
  | { type: 'mystery'; hidden: true }
```

**Visual States:**

- Dormant: Dim, gray, slight pulse
- Awakening: Bright, moving, game target
- Active: Glowing halo, click to engage
- Explored: Part of constellation, persistent glow

### 2. IdeaHub (The Central Experience)

Replaces InteractiveTablet with a spatial hub:

```txt
                    ○ Article Orb
                   /
    ○ Quiz ─── [CORE] ─── ○ Chat
                   \
                    ○ Create

    [Surrounding: Dormant orbs waiting to awaken]
```

**Core Behaviors:**

- Central "core" pulses with energy
- Active orbs orbit around the core
- Dormant orbs float in outer ring
- Game mode activates all orbs for clicking

### 3. IdeaGame (Reimagined Clicking Game)

Instead of "score points," the game becomes "awaken ideas":

**Flow:**

1. Click core to start "Awakening"
2. Dormant orbs begin moving/glowing
3. Click orbs to "awaken" them (same satisfying mechanic)
4. Each awakened orb reveals content type
5. End: See what you've unlocked

**Scoring becomes:**

- Ideas Awakened (count)
- Insight Level (combo-based)
- Discovery Bonus (golden = rare content)

### 4. IdeaProgress (Visual Constellation)

Background visualization of journey:

```txt
Phase 1: Single point of light
Phase 2: Line connecting to first idea
Phase 3: Triangle of awakened ideas
Phase 4: Complex constellation pattern
Phase 5: Full mandala/galaxy formation
```

Each completed interaction adds to the constellation:

- Questions asked = blue nodes
- Articles read = green nodes
- Quizzes passed = purple nodes
- Creations made = gold nodes
- Games played = silver connections

---

## User Flow Reimagined

### First Visit

1. **Awakening** (Cinematic)
   - Camera pulls into scene
   - Single glowing core visible
   - Ambient orbs in distance (dormant)

2. **First Interaction**
   - Core pulses invitingly
   - Click → Core "speaks" (chat interface appears spatially)
   - Ask question → First orb awakens nearby

3. **Discovery Loop**
   - Each awakened orb can be approached
   - Click orb → Content expands around you
   - Complete content → Orb joins constellation

4. **Game as Catalyst**
   - Notice dormant orbs in distance
   - Core offers "Awakening Ritual" (game)
   - Click core → Game starts → Mass awakening
   - End → Multiple new orbs available

### Repeat Visits

- Constellation visible immediately
- Previously explored orbs glow softly
- New dormant orbs spawn based on content
- Progress feels tangible and spatial

---

## Interaction Patterns

### Content Engagement (Replacing Modals)

**Article Orb:**

```txt
Click → Orb expands into reading surface
       Text flows on curved 3D surface
       Scroll via gesture or buttons
       Complete → Orb condenses, glows
```

**Chat Orb (Core):**

```txt
Click → Input field appears spatially
       Response manifests as floating text
       History forms a spiral trail
```

**Quiz Orb:**

```txt
Click → Questions appear on floating cards
       Answer by clicking correct card
       Wrong = card falls away
       Right = card adds to stack
       Complete = stack becomes achievement
```

**Creation Orb:**

```txt
Click → Sculpting interface appears
       Generated object forms in space
       Save → Object joins your collection
       Collection visible as mini-constellation
```

---

## Component Files to Create

```txt
components/ideas/
├── IdeaOrb.tsx         # Unified orb component
├── IdeaHub.tsx         # Central hub orchestrator
├── IdeaGame.tsx        # Reimagined clicking game
├── IdeaProgress.tsx    # Constellation visualization
├── IdeaContent.tsx     # Spatial content display
├── IdeaChat.tsx        # Spatial chat interface
├── IdeaReader.tsx      # 3D article reader
├── IdeaQuiz.tsx        # Card-based quiz
├── index.ts            # Exports
└── types.ts            # Type definitions
```

---

## Migration Path

### Phase 1: Core Components (This Session)

- [x] Design document
- [ ] IdeaOrb.tsx - Base orb with states
- [ ] IdeaHub.tsx - Hub replacing tablet
- [ ] IdeaGame.tsx - Game integration

### Phase 2: Content Surfaces (Next Session)

- [ ] IdeaContent.tsx - Base content renderer
- [ ] IdeaChat.tsx - Spatial chat
- [ ] IdeaReader.tsx - Article reader

### Phase 3: Polish

- [ ] IdeaProgress.tsx - Constellation
- [ ] IdeaQuiz.tsx - Card quiz
- [ ] Animations and transitions
- [ ] Sound design hooks

### Phase 4: Cutover

- [ ] Wire into Scene3D
- [ ] Migrate journey progress
- [ ] Remove old components

---

## Technical Considerations

### Performance

- Orb count limited by device capability
- LOD system for distant orbs
- Instanced rendering for constellation
- Content lazy-loads on approach

### Accessibility

- Keyboard navigation for orbs
- Screen reader descriptions
- Reduced motion mode
- High contrast option

### State Management

- Orb states in context
- Content lazy-loaded
- Progress persisted to localStorage
- Syncs with existing JourneyContext

---

## The Experience in Words

> You awaken in a space of infinite possibility. A single point of light pulses before you - curious, inviting. You reach out (click) and it responds, asking what you seek. Your question births a new light nearby.
>
> More lights exist in the distance, dormant, waiting. The core offers you power - to awaken them all at once. You accept, and the space erupts into a cascade of rising lights. You catch as many as you can, each one a new idea waiting to be explored.
>
> When the awakening ends, you're surrounded by glowing orbs. Each one holds something different - a story, a challenge, a creative tool. As you explore each one, it joins a growing constellation behind you - a map of your journey, unique to you.
>
> This is not a menu. This is a space of ideas, and you are its cartographer.
