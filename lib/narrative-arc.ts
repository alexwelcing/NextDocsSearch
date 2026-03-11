/**
 * Narrative Arc — The Connective Tissue
 *
 * Three fiction series form a single temporal corridor:
 *
 *   THE THRESHOLD (2027–2028) → THE RESIDUE (2032–2034) → THE CARTOGRAPHY (2045–2050)
 *   "The moment before"          "What was left behind"     "What emerged between"
 *
 * This module defines the structural relationships between series,
 * the thematic bridges between articles, the temporal arc, and the
 * visual identity progression that unifies them into a single work.
 *
 * It is consumed by:
 * - Article recommendation engine (cross-series suggestions)
 * - 3D scene system (visual transitions between temporal zones)
 * - AI search (semantic connections across series)
 * - Video generation (visual continuity across the arc)
 */

// ═══════════════════════════════════════════════════════════════
// TEMPORAL ARC
// ═══════════════════════════════════════════════════════════════

export interface TemporalEra {
  key: string
  title: string
  subtitle: string
  yearRange: [number, number]
  /** One-sentence description of what defines this era */
  thesis: string
  /** The central dramatic question the era poses */
  question: string
  /** Visual identity for 3D scenes and video generation */
  visualIdentity: VisualIdentity
  /** The emotional register that shifts across the era's articles */
  emotionalArc: EmotionalArc
}

export interface VisualIdentity {
  /** Dominant color palette (CSS-style values) */
  palette: { primary: string; secondary: string; accent: string; shadow: string }
  /** Color temperature 0 = cold blue, 1 = warm amber */
  colorTemperature: number
  /** Light quality */
  lighting: string
  /** Camera tendency */
  camera: string
  /** Texture/grain feel */
  texture: string
  /** Scale of environments */
  scale: 'intimate' | 'medium' | 'vast'
}

export interface EmotionalArc {
  /** Where the era starts emotionally */
  opening: string
  /** The pivot or tension point */
  midpoint: string
  /** Where it resolves */
  closing: string
}

export const TEMPORAL_ERAS: TemporalEra[] = [
  {
    key: 'threshold',
    title: 'The Threshold',
    subtitle: 'The moment before the door closes',
    yearRange: [2027, 2028],
    thesis:
      'The moment when abstract knowledge that AI has surpassed you becomes a specific, embodied experience you cannot undo.',
    question: 'What does it feel like to become professionally obsolete — not in theory, but in your hands?',
    visualIdentity: {
      palette: {
        primary: '#D4A574',   // warm sand
        secondary: '#8B6914', // deep amber
        accent: '#F5DEB3',    // wheat
        shadow: '#3D2B1F',    // dark umber
      },
      colorTemperature: 0.8,
      lighting: 'warm golden hour, natural ambient, documentary',
      camera: 'handheld, eye-level, intimate 50mm',
      texture: 'film grain, slight warmth cast, analog tactility',
      scale: 'intimate',
    },
    emotionalArc: {
      opening: 'quiet competence — mastery in its last season',
      midpoint: 'the specific moment of recognition — "it does this better than I do"',
      closing: 'grief transmuted into something unnameable — not acceptance, not defeat',
    },
  },
  {
    key: 'residue',
    title: 'The Residue',
    subtitle: 'What AI left behind when it moved on',
    yearRange: [2032, 2034],
    thesis:
      'After the threshold was crossed, the world reorganized around what came next. This series is about what stayed behind — the deprecated, the forgotten, the deliberately preserved.',
    question: 'When progress makes something obsolete, who decides what is still worth keeping?',
    visualIdentity: {
      palette: {
        primary: '#6B7B8D',   // cool slate
        secondary: '#4A5568', // blue-gray
        accent: '#D4A574',    // warm amber (echoing Threshold)
        shadow: '#1A202C',    // deep charcoal
      },
      colorTemperature: 0.3,
      lighting: 'cool diffused, overcast, fluorescent practicals with warm pockets',
      camera: 'wide shots, slow deliberate movement, 35mm',
      texture: 'desaturated, slight blue cast, post-industrial grain',
      scale: 'medium',
    },
    emotionalArc: {
      opening: 'melancholy inventory — cataloguing what was lost',
      midpoint: 'unexpected meaning found in abandoned things',
      closing: 'quiet defiance — choosing to maintain what the world forgot',
    },
  },
  {
    key: 'cartography',
    title: 'The Cartography',
    subtitle: 'Mapping the space between minds',
    yearRange: [2045, 2050],
    thesis:
      'The space between human and machine cognition is not empty — it teems with new forms of meaning that belong to neither shore.',
    question: 'When we finally mapped the territory between human and AI thought, what did we find there?',
    visualIdentity: {
      palette: {
        primary: '#6B46C1',   // deep violet
        secondary: '#3182CE', // ocean blue
        accent: '#D69E2E',    // warm amber (the thread through all three)
        shadow: '#1A1A2E',    // cosmic dark
      },
      colorTemperature: 0.4,
      lighting: 'luminous volumetric, bioluminescent, ethereal',
      camera: 'slow crane, orbit, wide overhead reveals, 35mm',
      texture: 'crystalline, translucent layers, particle drift',
      scale: 'vast',
    },
    emotionalArc: {
      opening: 'awe — vastness of the unmapped',
      midpoint: 'vertigo — the map dissolving into the territory',
      closing: 'wonder tempered by loss — some things cannot be named without changing them',
    },
  },
]

// ═══════════════════════════════════════════════════════════════
// THEMATIC BRIDGES — CROSS-SERIES CONNECTIONS
// ═══════════════════════════════════════════════════════════════

export interface ThematicBridge {
  /** The thematic thread connecting two articles */
  theme: string
  /** Brief description of the connection */
  connection: string
  /** Source article (earlier in timeline) */
  from: { slug: string; era: string }
  /** Destination article (later in timeline) */
  to: { slug: string; era: string }
  /** How strong the connection is (for recommendation weighting) */
  strength: 'strong' | 'moderate' | 'subtle'
  /** A sentence the reader might see: "If this moved you, read X because..." */
  readerBridge: string
}

/**
 * The bridges between articles across series.
 * These are not random — each represents a deliberate echo
 * where a question raised in one era finds its answer (or deepening) in another.
 */
export const THEMATIC_BRIDGES: ThematicBridge[] = [
  // ─── Threshold → Residue ───────────────────────────────────

  {
    theme: 'expertise-as-identity',
    connection: 'Dr. Adaora loses her diagnostic edge; years later, someone curates the craft she lost',
    from: { slug: 'threshold-01-the-last-diagnosis', era: 'threshold' },
    to: { slug: 'residue-01-the-last-prompt-engineer', era: 'residue' },
    strength: 'strong',
    readerBridge:
      'The radiologist who watched AI surpass her diagnosis — years later, someone preserves the craft of prompt engineering the same way.',
  },
  {
    theme: 'translation-and-ghosts',
    connection: 'Lena loses the untranslatable; Yui later finds the ghosts of human creators inside AI outputs',
    from: { slug: 'threshold-02-the-closing-window', era: 'threshold' },
    to: { slug: 'residue-02-the-training-data-ghosts', era: 'residue' },
    strength: 'strong',
    readerBridge:
      'The translator who lost the untranslatable nuance — years later, a researcher discovers human fingerprints were there all along, fossilized in the training data.',
  },
  {
    theme: 'embodied-vs-optimized',
    connection: 'Tomáš chooses imperfect steel; the analog holdouts choose imperfection as a way of life',
    from: { slug: 'threshold-03-the-weight-of-the-hammer', era: 'threshold' },
    to: { slug: 'residue-04-the-analog-holdouts', era: 'residue' },
    strength: 'strong',
    readerBridge:
      'The blacksmith who chose imperfect steel over perfect optimization — years later, a whole community makes the same choice deliberately.',
  },
  {
    theme: 'dependency-and-care',
    connection: 'Priya stops asking AI for answers; Miriam keeps a deprecated AI alive for those who still need it',
    from: { slug: 'threshold-04-the-student-who-stopped-asking', era: 'threshold' },
    to: { slug: 'residue-03-the-deprecated-caretaker', era: 'residue' },
    strength: 'moderate',
    readerBridge:
      'The student who chose struggle over instant answers — years later, someone maintains a forgotten AI for elderly users who never learned the new ones.',
  },
  {
    theme: 'preservation-of-context',
    connection: 'Adaeze encodes community wisdom into architecture; the museum preserves obsolete interfaces',
    from: { slug: 'threshold-05-the-beautiful-redundancy', era: 'threshold' },
    to: { slug: 'residue-05-the-compatibility-museum', era: 'residue' },
    strength: 'moderate',
    readerBridge:
      'The architect who built community knowledge into concrete — years later, a museum preserves the interfaces that once connected us to machines.',
  },

  // ─── Residue → Cartography ────────────────────────────────

  {
    theme: 'craft-to-territory',
    connection: 'The last prompt engineer curated a dying craft; the first explorer discovers a new continent of thought',
    from: { slug: 'residue-01-the-last-prompt-engineer', era: 'residue' },
    to: { slug: 'cartography-01-the-unnamed-continent', era: 'cartography' },
    strength: 'strong',
    readerBridge:
      'The curator of a vanishing craft — decades later, the territory he glimpsed through prompts becomes a continent others can walk.',
  },
  {
    theme: 'spectral-to-structural',
    connection: 'Yui found ghosts in training data; the depth soundings reveal those ghosts are geological strata',
    from: { slug: 'residue-02-the-training-data-ghosts', era: 'residue' },
    to: { slug: 'cartography-03-the-depth-soundings', era: 'cartography' },
    strength: 'strong',
    readerBridge:
      'The spectral archaeologist who found human imprints in AI — decades later, those imprints are geological layers in a new cognitive landscape.',
  },
  {
    theme: 'boundary-dwelling',
    connection: 'The deprecated caretaker lived at the edge between old and new; the tidal zone is that edge made visible',
    from: { slug: 'residue-03-the-deprecated-caretaker', era: 'residue' },
    to: { slug: 'cartography-04-the-tidal-zone', era: 'cartography' },
    strength: 'moderate',
    readerBridge:
      'The woman who maintained the boundary between deprecated and modern — decades later, that boundary is a living ecosystem.',
  },
  {
    theme: 'analog-as-intent',
    connection: 'The analog holdouts chose friction deliberately; the isthmus of intent reveals why that choice mattered',
    from: { slug: 'residue-04-the-analog-holdouts', era: 'residue' },
    to: { slug: 'cartography-02-the-isthmus-of-intent', era: 'cartography' },
    strength: 'moderate',
    readerBridge:
      'The community that chose analog deliberately — decades later, intent itself becomes the narrow bridge between two kinds of mind.',
  },
  {
    theme: 'museum-to-atlas',
    connection: 'The compatibility museum preserved what was lost; the atlas of disappearances maps what happens when even the map dissolves',
    from: { slug: 'residue-05-the-compatibility-museum', era: 'residue' },
    to: { slug: 'cartography-05-the-atlas-of-disappearances', era: 'cartography' },
    strength: 'strong',
    readerBridge:
      'The museum that preserved obsolete interfaces — decades later, the map itself becomes obsolete as the territory it described absorbs it.',
  },

  // ─── Threshold → Cartography (long arc) ───────────────────

  {
    theme: 'diagnosis-to-depth',
    connection: 'The radiologist who saw the threshold; decades later, the same act of seeing becomes geological survey',
    from: { slug: 'threshold-01-the-last-diagnosis', era: 'threshold' },
    to: { slug: 'cartography-03-the-depth-soundings', era: 'cartography' },
    strength: 'subtle',
    readerBridge:
      'The doctor who peered into scans for the last time — decades later, a new kind of seeing probes depths no single mind can reach.',
  },
  {
    theme: 'closing-window-to-unnamed',
    connection: 'Lena watched a window close on human translation; decades later, an entirely new language space opens',
    from: { slug: 'threshold-02-the-closing-window', era: 'threshold' },
    to: { slug: 'cartography-01-the-unnamed-continent', era: 'cartography' },
    strength: 'subtle',
    readerBridge:
      'The translator who watched one window close — decades later, an unmapped continent of meaning opens where no single language applies.',
  },
  {
    theme: 'redundancy-to-disappearance',
    connection: 'Adaeze built beautiful redundancy into structure; the atlas maps the moment when all structure dissolves',
    from: { slug: 'threshold-05-the-beautiful-redundancy', era: 'threshold' },
    to: { slug: 'cartography-05-the-atlas-of-disappearances', era: 'cartography' },
    strength: 'subtle',
    readerBridge:
      'The architect who encoded wisdom into structure — decades later, the last structures dissolve as the map becomes the territory.',
  },
]

// ═══════════════════════════════════════════════════════════════
// RECURRING MOTIFS — VISUAL AND THEMATIC THREADS
// ═══════════════════════════════════════════════════════════════

export interface RecurringMotif {
  /** Motif identifier */
  key: string
  /** What the motif is */
  name: string
  /** How it manifests across eras */
  manifestations: Record<string, string>
  /** Visual expression for video/3D generation */
  visualExpression: Record<string, string>
}

/**
 * Motifs that recur across all three series, transforming as they move
 * through the temporal corridor. These create subliminal coherence.
 */
export const RECURRING_MOTIFS: RecurringMotif[] = [
  {
    key: 'amber-light',
    name: 'The Amber Thread',
    manifestations: {
      threshold: 'Golden late-afternoon light — the last warm hours of an era',
      residue: 'A single warm desk lamp in a cold room — the ember that refuses to die',
      cartography: 'Amber veins running through blue-violet terrain — the human trace in alien landscape',
    },
    visualExpression: {
      threshold: 'warm amber sunlight filtering through blinds, golden hour, honey-toned',
      residue: 'single warm practical light in desaturated scene, amber accent in cold palette',
      cartography: 'amber veins of bioluminescent light flowing through translucent blue-violet terrain',
    },
  },
  {
    key: 'hands',
    name: 'Human Hands',
    manifestations: {
      threshold: 'Skilled hands doing their craft for the last time — the radiologist\'s gesture, the blacksmith\'s tremor',
      residue: 'Weathered hands reaching for obsolete interfaces — the elderly man\'s thumbs poised over a deprecated chatbot',
      cartography: 'A hand reaching toward a luminous tidepool — touching the boundary between two kinds of mind',
    },
    visualExpression: {
      threshold: 'close-up of practiced hands mid-craft, warm light on skin, subtle motion',
      residue: 'weathered hands on old devices, cool light on aged skin, careful deliberate movement',
      cartography: 'human hand reaching into luminous abstract space, the boundary visible as light',
    },
  },
  {
    key: 'threshold-space',
    name: 'The In-Between',
    manifestations: {
      threshold: 'Doorways, windows, the gap between two monitors showing different realities',
      residue: 'Corridors, the space between server racks, the museum hall with an empty pedestal at the end',
      cartography: 'The isthmus, the tidal zone, the layered depths — all are threshold spaces made vast',
    },
    visualExpression: {
      threshold: 'framed doorways, split screens, two sources of light meeting, transitional spaces',
      residue: 'long corridors, gaps between machines, empty spaces where something was removed',
      cartography: 'narrow luminous passages between vast territories, boundary zones teeming with hybrid light',
    },
  },
  {
    key: 'silence',
    name: 'The Pause Before',
    manifestations: {
      threshold: 'The pen hovering over the page. The hammer paused mid-strike. The student\'s blank notebook.',
      residue: 'The quiet data center. The empty chair at the workstation. The museum after hours.',
      cartography: 'The vast stillness of unmapped territory. The map dissolving into white light.',
    },
    visualExpression: {
      threshold: 'suspended motion, held breath, the moment before action, time-frozen feeling',
      residue: 'still air, dust settling, indicator lights blinking in silence, abandoned stillness',
      cartography: 'cosmic stillness, vast luminous emptiness, the last features fading to unity',
    },
  },
]

// ═══════════════════════════════════════════════════════════════
// READING ORDER & NAVIGATION
// ═══════════════════════════════════════════════════════════════

export interface ReadingPath {
  key: string
  name: string
  description: string
  articles: string[]
}

/**
 * Suggested reading paths through the three series.
 * Not all readers should go chronologically — some paths follow
 * thematic threads instead of temporal ones.
 */
export const READING_PATHS: ReadingPath[] = [
  {
    key: 'chronological',
    name: 'The Timeline',
    description: 'Experience the full temporal corridor from 2027 to 2050, era by era.',
    articles: [
      // Threshold (2027–2028)
      'threshold-01-the-last-diagnosis',
      'threshold-02-the-closing-window',
      'threshold-03-the-weight-of-the-hammer',
      'threshold-04-the-student-who-stopped-asking',
      'threshold-05-the-beautiful-redundancy',
      // Residue (2032–2034)
      'residue-01-the-last-prompt-engineer',
      'residue-02-the-training-data-ghosts',
      'residue-03-the-deprecated-caretaker',
      'residue-04-the-analog-holdouts',
      'residue-05-the-compatibility-museum',
      // Cartography (2045–2050)
      'cartography-01-the-unnamed-continent',
      'cartography-02-the-isthmus-of-intent',
      'cartography-03-the-depth-soundings',
      'cartography-04-the-tidal-zone',
      'cartography-05-the-atlas-of-disappearances',
    ],
  },
  {
    key: 'echoes',
    name: 'The Echoes',
    description:
      'Follow the strongest thematic bridges — each pair of articles resonates across decades.',
    articles: [
      'threshold-01-the-last-diagnosis',
      'residue-01-the-last-prompt-engineer',
      'cartography-01-the-unnamed-continent',
      'threshold-02-the-closing-window',
      'residue-02-the-training-data-ghosts',
      'cartography-03-the-depth-soundings',
      'threshold-03-the-weight-of-the-hammer',
      'residue-04-the-analog-holdouts',
      'cartography-02-the-isthmus-of-intent',
      'threshold-05-the-beautiful-redundancy',
      'residue-05-the-compatibility-museum',
      'cartography-05-the-atlas-of-disappearances',
    ],
  },
  {
    key: 'characters',
    name: 'The Human Thread',
    description:
      'The articles most centered on individual human experience, across all three eras.',
    articles: [
      'threshold-01-the-last-diagnosis',
      'threshold-03-the-weight-of-the-hammer',
      'threshold-04-the-student-who-stopped-asking',
      'residue-03-the-deprecated-caretaker',
      'residue-04-the-analog-holdouts',
      'cartography-04-the-tidal-zone',
    ],
  },
  {
    key: 'abstraction',
    name: 'The Ascending Scale',
    description:
      'From the intimate and concrete to the vast and abstract — a journey of expanding scale.',
    articles: [
      'threshold-03-the-weight-of-the-hammer', // a single hammer stroke
      'threshold-01-the-last-diagnosis',        // one scan, one doctor
      'residue-03-the-deprecated-caretaker',     // one server, a handful of users
      'residue-05-the-compatibility-museum',     // a building full of history
      'cartography-02-the-isthmus-of-intent',    // a narrow passage between worlds
      'cartography-01-the-unnamed-continent',    // a continent
      'cartography-05-the-atlas-of-disappearances', // the map dissolving into everything
    ],
  },
]

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get the era for a given article slug
 */
export function getEraForSlug(slug: string): TemporalEra | undefined {
  if (slug.startsWith('threshold-')) return TEMPORAL_ERAS[0]
  if (slug.startsWith('residue-')) return TEMPORAL_ERAS[1]
  if (slug.startsWith('cartography-')) return TEMPORAL_ERAS[2]
  return undefined
}

/**
 * Get all thematic bridges for a given article (as source or destination)
 */
export function getBridgesForArticle(slug: string): ThematicBridge[] {
  return THEMATIC_BRIDGES.filter(
    (b) => b.from.slug === slug || b.to.slug === slug
  )
}

/**
 * Get cross-series recommendations for a given article.
 * Returns articles from OTHER eras that connect thematically.
 */
export function getCrossSeriesRecommendations(
  slug: string
): Array<{ slug: string; reason: string; strength: ThematicBridge['strength'] }> {
  const bridges = getBridgesForArticle(slug)
  return bridges.map((b) => {
    const isSource = b.from.slug === slug
    return {
      slug: isSource ? b.to.slug : b.from.slug,
      reason: b.readerBridge,
      strength: b.strength,
    }
  })
}

/**
 * Get the visual identity for transitioning between two eras in 3D/video.
 * Returns interpolated values for smooth visual transitions.
 */
export function getTransitionIdentity(
  fromEra: string,
  toEra: string,
  progress: number // 0 = fully "from", 1 = fully "to"
): { colorTemperature: number; scale: string; description: string } {
  const from = TEMPORAL_ERAS.find((e) => e.key === fromEra)
  const to = TEMPORAL_ERAS.find((e) => e.key === toEra)
  if (!from || !to) {
    return { colorTemperature: 0.5, scale: 'medium', description: 'Unknown transition' }
  }

  const temp =
    from.visualIdentity.colorTemperature * (1 - progress) +
    to.visualIdentity.colorTemperature * progress

  const scales = { intimate: 0, medium: 1, vast: 2 }
  const fromScale = scales[from.visualIdentity.scale]
  const toScale = scales[to.visualIdentity.scale]
  const blendedScale = fromScale * (1 - progress) + toScale * progress
  const scale = blendedScale < 0.5 ? 'intimate' : blendedScale < 1.5 ? 'medium' : 'vast'

  return {
    colorTemperature: temp,
    scale,
    description: `Transitioning from ${from.title} (${from.yearRange.join('–')}) to ${to.title} (${to.yearRange.join('–')})`,
  }
}

/**
 * Get the motif expression for a specific era
 */
export function getMotifForEra(motifKey: string, eraKey: string): string | undefined {
  const motif = RECURRING_MOTIFS.find((m) => m.key === motifKey)
  return motif?.manifestations[eraKey]
}

/**
 * Get all motif visual expressions for an era (for video prompt enrichment)
 */
export function getMotifVisualsForEra(eraKey: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const motif of RECURRING_MOTIFS) {
    if (motif.visualExpression[eraKey]) {
      result[motif.key] = motif.visualExpression[eraKey]
    }
  }
  return result
}
