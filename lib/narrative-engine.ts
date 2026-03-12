/**
 * Narrative Authoring Engine
 *
 * This is the operating system for composing fiction series into unified works.
 * It does three things:
 *
 * 1. READS the existing articles and understands where each sits in the
 *    narrative corridor — what it resolves, what it opens, what came before.
 *
 * 2. GENERATES the connective tissue — "previously on" summaries, series
 *    prefaces, continuity markers, voice-directed interstitials, and
 *    per-article narrative context for the AI article generator.
 *
 * 3. COMPUTES the narrative graph — which articles depend on which, what
 *    reading order maximizes impact, and what frontmatter should be updated.
 *
 * This module is consumed by:
 * - Article generation scripts (series-aware context for new articles)
 * - Article detail pages (series navigation, "previously on" sections)
 * - Recommendation engine (narrative relevance > recency)
 * - 3D scene system (era-aware visual transitions)
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import {
  TEMPORAL_ERAS,
  THEMATIC_BRIDGES,
  RECURRING_MOTIFS,
  getEraForSlug,
  getBridgesForArticle,
  type TemporalEra,
  type ThematicBridge,
} from './narrative-arc'
import { SEED_PROFILES } from './voice-engine/profiles'
import type { VoiceProfile, PromptFragments } from './voice-engine/types'

// ═══════════════════════════════════════════════════════════════
// ARTICLE NARRATIVE METADATA
// ═══════════════════════════════════════════════════════════════

export interface NarrativePosition {
  /** Which era this article belongs to */
  era: string
  /** Position within the era (1-indexed) */
  position: number
  /** Total articles in this era */
  totalInEra: number
  /** Where in the emotional arc: opening, rising, midpoint, falling, closing */
  phase: NarrativePhase
  /** The year the story takes place */
  storyYear: number
  /** What narrative questions this article opens (for later resolution) */
  opensQuestions: string[]
  /** What questions from earlier articles this one resolves or deepens */
  resolves: string[]
  /** Articles that should be read before this one for full impact */
  narrativeDependencies: string[]
  /** The single-sentence "so far" — what the reader needs to know */
  narrativeContext: string
}

export type NarrativePhase =
  | 'opening'     // First in era — establishes the world and question
  | 'rising'      // Building tension, deepening the question
  | 'midpoint'    // The pivot — the question sharpens or inverts
  | 'falling'     // Consequences, implications, the weight of change
  | 'closing'     // Not resolution — but a resting point before the next era

// ═══════════════════════════════════════════════════════════════
// CONTINUITY MARKERS
// ═══════════════════════════════════════════════════════════════

export interface ContinuityMarker {
  /** The article slug this marker belongs to */
  slug: string
  /** "Previously" — what happened in articles before this one */
  previouslyOn?: string
  /** "Meanwhile" — what was happening in other eras at this narrative moment */
  meanwhile?: string
  /** "This continues" — a sentence linking this article's ending to the next */
  continuesIn?: string
  /** "Echo" — the strongest thematic bridge from this article */
  echo?: { slug: string; connection: string }
}

// ═══════════════════════════════════════════════════════════════
// SERIES COMPOSITION
// ═══════════════════════════════════════════════════════════════

export interface SeriesComposition {
  /** The series key */
  key: string
  /** The era this series occupies */
  era: TemporalEra
  /** The voice profile directing this series */
  voice: VoiceProfile
  /** Ordered articles with their narrative positions */
  articles: Array<{
    slug: string
    title: string
    position: NarrativePosition
    continuity: ContinuityMarker
  }>
  /** Series-level preface — the context a reader needs before starting */
  preface: string
  /** Series-level arc summary — for cross-series navigation */
  arcSummary: string
  /** Motifs active in this series (for visual/thematic continuity) */
  activeMotifs: Array<{ key: string; expression: string }>
}

// ═══════════════════════════════════════════════════════════════
// ARTICLE READER — Parse existing MDX into narrative-aware data
// ═══════════════════════════════════════════════════════════════

interface ParsedArticle {
  slug: string
  title: string
  date: string
  series: string
  seriesOrder: number
  description: string
  relatedArticles: string[]
  /** First paragraph of body text (after frontmatter) */
  openingLine: string
  /** Last paragraph of body text */
  closingLine: string
  /** All section headers (## level) */
  sectionHeaders: string[]
  /** Approximate word count */
  wordCount: number
}

const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles')

function parseArticle(slug: string): ParsedArticle | null {
  const filePath = path.join(ARTICLES_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data: frontmatter, content } = matter(raw)

  // Extract opening and closing lines
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith('#') && !p.startsWith('---') && !p.startsWith('import'))

  const openingLine = paragraphs[0]?.replace(/\*\*/g, '').slice(0, 200) || ''
  const closingLine = paragraphs[paragraphs.length - 1]?.replace(/\*\*/g, '').slice(0, 200) || ''

  // Extract section headers
  const headerRegex = /^##\s+(.+)$/gm
  const sectionHeaders: string[] = []
  let match
  while ((match = headerRegex.exec(content)) !== null) {
    sectionHeaders.push(match[1])
  }

  // Word count
  const wordCount = content.split(/\s+/).length

  return {
    slug,
    title: frontmatter.title || slug,
    date: frontmatter.date || '',
    series: frontmatter.series || '',
    seriesOrder: frontmatter.seriesOrder || 0,
    description: frontmatter.description || '',
    relatedArticles: frontmatter.relatedArticles || [],
    openingLine,
    closingLine,
    sectionHeaders,
    wordCount,
  }
}

// ═══════════════════════════════════════════════════════════════
// NARRATIVE POSITION COMPUTER
// ═══════════════════════════════════════════════════════════════

/**
 * Determine narrative phase from position within a 5-article series
 */
function computePhase(position: number, total: number): NarrativePhase {
  const ratio = (position - 1) / (total - 1)
  if (ratio === 0) return 'opening'
  if (ratio <= 0.3) return 'rising'
  if (ratio <= 0.5) return 'midpoint'
  if (ratio < 1) return 'falling'
  return 'closing'
}

/**
 * The narrative questions each article opens and resolves.
 * These are hand-authored because they ARE the narrative architecture.
 */
const NARRATIVE_QUESTIONS: Record<string, { opens: string[]; resolves: string[] }> = {
  // ─── Threshold ────────────────────────────────────────────
  'threshold-01-the-last-diagnosis': {
    opens: [
      'What does it feel like when a machine sees what your trained eyes missed?',
      'Can professional identity survive the evidence of its own insufficiency?',
    ],
    resolves: [],
  },
  'threshold-02-the-closing-window': {
    opens: [
      'What happens to the untranslatable when machines learn nuance?',
      'Is the gap between competent and masterful still worth a career?',
    ],
    resolves: [
      'The threshold is not sudden — it is the slow recognition that competence is no longer enough',
    ],
  },
  'threshold-03-the-weight-of-the-hammer': {
    opens: [
      'What knowledge lives in the body that cannot be digitized?',
      'Can imperfection be a feature, not a flaw?',
    ],
    resolves: [
      'The threshold moment can be chosen, not just suffered — the blacksmith chooses his hands',
    ],
  },
  'threshold-04-the-student-who-stopped-asking': {
    opens: [
      'Is struggle necessary for understanding, or just for feeling like you understand?',
      'What is lost when the answer is always available?',
    ],
    resolves: [
      'The threshold can be refused — but at what cost?',
    ],
  },
  'threshold-05-the-beautiful-redundancy': {
    opens: [
      'Can human knowledge be encoded in structure itself — not as data, but as architecture?',
    ],
    resolves: [
      'Professional obsolescence is not the end — the knowledge transforms into something structural',
      'The threshold series closes with a door opening, not closing',
    ],
  },

  // ─── Residue ──────────────────────────────────────────────
  'residue-01-the-last-prompt-engineer': {
    opens: [
      'When a craft becomes obsolete, who curates its memory?',
      'Is preservation an act of defiance or nostalgia?',
    ],
    resolves: [
      'The skills lost at the threshold became artifacts — someone is collecting them',
    ],
  },
  'residue-02-the-training-data-ghosts': {
    opens: [
      'Are the humans who made AI still alive inside it — as patterns, as ghosts, as sediment?',
    ],
    resolves: [
      'The translators and diagnosticians did not simply disappear — they were absorbed',
    ],
  },
  'residue-03-the-deprecated-caretaker': {
    opens: [
      'Who maintains the systems the world has moved past — and why?',
    ],
    resolves: [
      'Dependency is not weakness — some people still need what the world forgot',
    ],
  },
  'residue-04-the-analog-holdouts': {
    opens: [
      'Is choosing friction a political act or a personal one?',
    ],
    resolves: [
      'The blacksmith chose his hands; now a community chooses analog deliberately',
    ],
  },
  'residue-05-the-compatibility-museum': {
    opens: [
      'Can obsolescence itself be exhibited — and if so, what does the visitor learn?',
    ],
    resolves: [
      'Everything deprecated tells a story about what the world decided to forget',
      'The residue is not waste — it is evidence',
    ],
  },

  // ─── Cartography ──────────────────────────────────────────
  'cartography-01-the-unnamed-continent': {
    opens: [
      'What exists in the space between human and machine cognition?',
      'Can you explore a territory that changes when you observe it?',
    ],
    resolves: [
      'The ghosts in the training data were not ghosts — they were the first features of a new landscape',
    ],
  },
  'cartography-02-the-isthmus-of-intent': {
    opens: [
      'Why must intent narrow before it can cross between two kinds of mind?',
    ],
    resolves: [
      'The analog holdouts were right — friction is what intent feels like under pressure',
    ],
  },
  'cartography-03-the-depth-soundings': {
    opens: [
      'What lies beneath the surface of human-AI cognitive space — layers, strata, history?',
    ],
    resolves: [
      'The radiologist saw surfaces; now we see geological depth — the same act of seeing, transformed',
    ],
  },
  'cartography-04-the-tidal-zone': {
    opens: [
      'What grows in the boundary between two cognitions — and can it survive outside that boundary?',
    ],
    resolves: [
      'The deprecated caretaker lived at this boundary; now the boundary is a living ecosystem',
    ],
  },
  'cartography-05-the-atlas-of-disappearances': {
    opens: [],
    resolves: [
      'The map dissolves into the territory — the act of knowing changes what is known',
      'The beautiful redundancy returns: structure encoding knowledge, then becoming invisible',
      'All three series converge: the threshold was the beginning, the residue was the evidence, the cartography was the territory that emerged between',
    ],
  },
}

// ═══════════════════════════════════════════════════════════════
// CONTINUITY GENERATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Build "previously on" text for an article from its predecessors in the series.
 */
function buildPreviouslyOn(
  slug: string,
  seriesArticles: ParsedArticle[]
): string | undefined {
  const current = seriesArticles.find((a) => a.slug === slug)
  if (!current || current.seriesOrder <= 1) return undefined

  const predecessors = seriesArticles
    .filter((a) => a.seriesOrder < current.seriesOrder)
    .sort((a, b) => a.seriesOrder - b.seriesOrder)

  if (predecessors.length === 0) return undefined

  // Build a concise "so far" from descriptions
  const summaries = predecessors.map(
    (p) => `*${p.title.split(':')[0]}* — ${p.description.split('.')[0]}.`
  )

  return summaries.join(' ')
}

/**
 * Find the strongest thematic echo from another era.
 */
function findStrongestEcho(
  slug: string
): { slug: string; connection: string } | undefined {
  const bridges = getBridgesForArticle(slug)
  const strongBridge = bridges.find((b) => b.strength === 'strong')
  if (!strongBridge) {
    if (!bridges[0]) return undefined
    const b = bridges[0]
    return {
      slug: b.from.slug === slug ? b.to.slug : b.from.slug,
      connection: b.readerBridge,
    }
  }

  return {
    slug: strongBridge.from.slug === slug ? strongBridge.to.slug : strongBridge.from.slug,
    connection: strongBridge.readerBridge,
  }
}

// ═══════════════════════════════════════════════════════════════
// VOICE-DIRECTED PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════

export interface ArticleGenerationContext {
  /** The article to generate */
  slug: string
  /** The article's position in the narrative */
  position: NarrativePosition
  /** The voice profile directing this series */
  voice: VoiceProfile
  /** Continuity context — what came before, what comes after */
  continuity: ContinuityMarker
  /** The full system prompt for article generation */
  systemPrompt: string
  /** The user prompt with narrative context */
  userPrompt: string
  /** Suggested frontmatter for the generated article */
  frontmatter: Record<string, unknown>
}

/**
 * Build a complete, voice-directed generation context for a single article.
 * This is what you feed to an LLM to generate a narratively coherent piece.
 */
export function buildArticleGenerationContext(
  slug: string,
  storyBrief: string,
  seriesArticles: ParsedArticle[]
): ArticleGenerationContext {
  const era = getEraForSlug(slug)
  if (!era) throw new Error(`No era found for slug: ${slug}`)

  const current = seriesArticles.find((a) => a.slug === slug)
  const position = current?.seriesOrder || 1
  const total = seriesArticles.length

  // Find the voice profile for this era
  const voiceEntry = Object.values(SEED_PROFILES).find(
    (p) => p.series === `the-${era.key}`
  )
  if (!voiceEntry) throw new Error(`No voice profile for era: ${era.key}`)

  const questions = NARRATIVE_QUESTIONS[slug] || { opens: [], resolves: [] }
  const phase = computePhase(position, total)

  const narrativePosition: NarrativePosition = {
    era: era.key,
    position,
    totalInEra: total,
    phase,
    storyYear: era.yearRange[0] + Math.floor((position - 1) / total * (era.yearRange[1] - era.yearRange[0])),
    opensQuestions: questions.opens,
    resolves: questions.resolves,
    narrativeDependencies: seriesArticles
      .filter((a) => a.seriesOrder < position)
      .map((a) => a.slug),
    narrativeContext: buildNarrativeContext(slug, era, phase, seriesArticles),
  }

  const continuity: ContinuityMarker = {
    slug,
    previouslyOn: buildPreviouslyOn(slug, seriesArticles),
    echo: findStrongestEcho(slug),
    continuesIn: seriesArticles.find((a) => a.seriesOrder === position + 1)?.slug,
  }

  // Build the motif instructions
  const eraMotifs = RECURRING_MOTIFS
    .map((m) => `- ${m.name}: ${m.manifestations[era.key]}`)
    .join('\n')

  // Build the system prompt — combining voice profile with narrative position
  const systemPrompt = buildSystemPrompt(voiceEntry, era, narrativePosition, continuity, eraMotifs)
  const userPrompt = buildUserPrompt(slug, storyBrief, narrativePosition, continuity, questions)

  // Build suggested frontmatter
  const bridges = getBridgesForArticle(slug)
  const crossSeriesRelated = bridges.map((b) =>
    b.from.slug === slug ? b.to.slug : b.from.slug
  )

  const frontmatter: Record<string, unknown> = {
    series: `the-${era.key}`,
    seriesOrder: position,
    articleType: 'fiction',
    narrativePhase: phase,
    storyYear: narrativePosition.storyYear,
    opensQuestions: questions.opens,
    resolves: questions.resolves,
    relatedArticles: [
      ...seriesArticles.filter((a) => a.slug !== slug).map((a) => a.slug).slice(0, 2),
      ...crossSeriesRelated.slice(0, 2),
    ],
  }

  return {
    slug,
    position: narrativePosition,
    voice: voiceEntry,
    continuity,
    systemPrompt,
    userPrompt,
    frontmatter,
  }
}

function buildNarrativeContext(
  slug: string,
  era: TemporalEra,
  phase: NarrativePhase,
  seriesArticles: ParsedArticle[]
): string {
  const phaseDescriptions: Record<NarrativePhase, string> = {
    opening: `This is the first article in ${era.title}. It establishes the world and the central question: ${era.question}`,
    rising: `The series is building tension. The question "${era.question}" deepens through a new angle.`,
    midpoint: `This is the pivot point of ${era.title}. The central question sharpens or inverts here.`,
    falling: `The consequences are arriving. What was abstract becomes concrete and personal.`,
    closing: `This is the final article in ${era.title}. It does not resolve — it opens toward what comes next.`,
  }

  const predecessors = seriesArticles
    .filter((a) => a.seriesOrder < (seriesArticles.find((s) => s.slug === slug)?.seriesOrder || 1))
    .sort((a, b) => a.seriesOrder - b.seriesOrder)

  const contextParts = [phaseDescriptions[phase]]

  if (predecessors.length > 0) {
    const lastPred = predecessors[predecessors.length - 1]
    contextParts.push(
      `The previous article, "${lastPred.title}", ended with: "${lastPred.closingLine.slice(0, 120)}..."`
    )
  }

  return contextParts.join(' ')
}

function buildSystemPrompt(
  voice: VoiceProfile,
  era: TemporalEra,
  position: NarrativePosition,
  continuity: ContinuityMarker,
  motifInstructions: string
): string {
  const fragments = voice.promptFragments

  return `${fragments.systemPreamble}

You are writing article ${position.position} of ${position.totalInEra} in ${era.title} (${era.yearRange[0]}–${era.yearRange[1]}).

${era.thesis}

EMOTIONAL ARC OF THIS ERA:
- Opening register: ${era.emotionalArc.opening}
- Midpoint tension: ${era.emotionalArc.midpoint}
- Closing register: ${era.emotionalArc.closing}

This article is in the "${position.phase}" phase of the arc.

STYLE:
${fragments.styleDirective}

CONSTRAINTS:
${fragments.constraintDirective}

CLOSING:
${fragments.closingDirective}

RECURRING MOTIFS (weave at least one into this piece):
${motifInstructions}

${continuity.previouslyOn ? `\nPREVIOUSLY: ${continuity.previouslyOn}` : ''}
${continuity.echo ? `\nTHEMATIC ECHO: This article resonates with "${continuity.echo.slug}" — ${continuity.echo.connection}. Do not make this explicit. Let it be a subliminal rhyme.` : ''}

NARRATIVE QUESTIONS this article must OPEN (plant these as lived experiences, not thesis statements):
${position.opensQuestions.map((q) => `- ${q}`).join('\n') || '(none — this article resolves rather than opens)'}

NARRATIVE QUESTIONS this article RESOLVES from earlier pieces (do not state these — embody them):
${position.resolves.map((r) => `- ${r}`).join('\n') || '(none — this article opens rather than resolves)'}

CRITICAL: Never state the theme. Never write "This was the moment when." Never name the series metaphor directly. The prose must do the work.`
}

function buildUserPrompt(
  slug: string,
  storyBrief: string,
  position: NarrativePosition,
  continuity: ContinuityMarker,
  questions: { opens: string[]; resolves: string[] }
): string {
  return `Write "${slug}" — a ~3000-word fiction piece set in ${position.storyYear}.

STORY BRIEF: ${storyBrief}

This is article ${position.position} of ${position.totalInEra}. Phase: ${position.phase}.

${continuity.previouslyOn ? `The reader has already experienced: ${continuity.previouslyOn}` : 'This is the reader\'s entry point into the series.'}

${continuity.continuesIn ? `After this, the reader will encounter "${continuity.continuesIn}" — leave a thread that will resonate forward, but do not telegraph it.` : 'This is the final piece in this era. Leave an opening, not a conclusion.'}

FORMAT: MDX with YAML frontmatter. Use thematic section breaks (---) not numbered sections. Bold the date/time markers (**March 2027**). No import statements needed.`
}

// ═══════════════════════════════════════════════════════════════
// SERIES COMPOSITION BUILDER
// ═══════════════════════════════════════════════════════════════

/**
 * Build a complete series composition — the full narrative picture of one era.
 */
export function buildSeriesComposition(seriesKey: string): SeriesComposition {
  const era = TEMPORAL_ERAS.find((e) => e.key === seriesKey)
  if (!era) throw new Error(`Unknown series: ${seriesKey}`)

  const voiceEntry = Object.values(SEED_PROFILES).find(
    (p) => p.series === `the-${seriesKey}`
  )
  if (!voiceEntry) throw new Error(`No voice profile for: ${seriesKey}`)

  // Load all articles in this series
  const slugPattern = new RegExp(`^${seriesKey}-\\d{2}-`)
  const allFiles = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.mdx'))
  const seriesSlugs = allFiles
    .map((f) => f.replace('.mdx', ''))
    .filter((s) => slugPattern.test(s))
    .sort()

  const parsedArticles = seriesSlugs
    .map((s) => parseArticle(s))
    .filter((a): a is ParsedArticle => a !== null)
    .sort((a, b) => a.seriesOrder - b.seriesOrder)

  const articles = parsedArticles.map((article) => {
    const questions = NARRATIVE_QUESTIONS[article.slug] || { opens: [], resolves: [] }
    const phase = computePhase(article.seriesOrder, parsedArticles.length)

    const position: NarrativePosition = {
      era: seriesKey,
      position: article.seriesOrder,
      totalInEra: parsedArticles.length,
      phase,
      storyYear: era.yearRange[0] + Math.floor(
        ((article.seriesOrder - 1) / parsedArticles.length) *
        (era.yearRange[1] - era.yearRange[0])
      ),
      opensQuestions: questions.opens,
      resolves: questions.resolves,
      narrativeDependencies: parsedArticles
        .filter((a) => a.seriesOrder < article.seriesOrder)
        .map((a) => a.slug),
      narrativeContext: buildNarrativeContext(article.slug, era, phase, parsedArticles),
    }

    const continuity: ContinuityMarker = {
      slug: article.slug,
      previouslyOn: buildPreviouslyOn(article.slug, parsedArticles),
      echo: findStrongestEcho(article.slug),
      continuesIn: parsedArticles.find((a) => a.seriesOrder === article.seriesOrder + 1)?.slug,
    }

    return {
      slug: article.slug,
      title: article.title,
      position,
      continuity,
    }
  })

  // Series preface
  const preface = `${era.title} is a ${parsedArticles.length}-part series set in ${era.yearRange[0]}–${era.yearRange[1]}. ` +
    `${era.thesis} ` +
    `The voice is ${voiceEntry.name}'s — ${voiceEntry.heritage.blendDescription.split('.')[0]}.`

  // Arc summary
  const arcSummary = `From "${era.emotionalArc.opening}" through "${era.emotionalArc.midpoint}" ` +
    `to "${era.emotionalArc.closing}".`

  // Active motifs
  const activeMotifs = RECURRING_MOTIFS
    .filter((m) => m.manifestations[seriesKey])
    .map((m) => ({ key: m.key, expression: m.manifestations[seriesKey] }))

  return {
    key: seriesKey,
    era,
    voice: voiceEntry,
    articles,
    preface,
    arcSummary,
    activeMotifs,
  }
}

// ═══════════════════════════════════════════════════════════════
// FULL NARRATIVE GRAPH
// ═══════════════════════════════════════════════════════════════

export interface NarrativeGraph {
  series: SeriesComposition[]
  bridges: ThematicBridge[]
  /** The complete reading order across all series */
  canonicalOrder: string[]
  /** Total word count across all articles */
  totalWords: number
  /** Total estimated reading time (minutes, at 250 wpm) */
  totalReadingMinutes: number
}

/**
 * Build the complete narrative graph — the full picture of all three series
 * and their connections.
 */
export function buildNarrativeGraph(): NarrativeGraph {
  const series = ['threshold', 'residue', 'cartography'].map(buildSeriesComposition)

  const canonicalOrder = series.flatMap((s) => s.articles.map((a) => a.slug))

  // Calculate totals
  const allSlugs = canonicalOrder
  const allParsed = allSlugs.map(parseArticle).filter((a): a is ParsedArticle => a !== null)
  const totalWords = allParsed.reduce((sum, a) => sum + a.wordCount, 0)

  return {
    series,
    bridges: THEMATIC_BRIDGES,
    canonicalOrder,
    totalWords,
    totalReadingMinutes: Math.ceil(totalWords / 250),
  }
}

// ═══════════════════════════════════════════════════════════════
// INTERSTITIAL GENERATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Generate the "between chapters" text that connects two articles.
 * This is voice-directed — it uses the destination article's voice.
 *
 * Returns a prompt that should be sent to an LLM to generate the actual prose.
 */
export function buildInterstitialPrompt(
  fromSlug: string,
  toSlug: string
): { systemPrompt: string; userPrompt: string } | null {
  const fromArticle = parseArticle(fromSlug)
  const toArticle = parseArticle(toSlug)
  if (!fromArticle || !toArticle) return null

  const fromEra = getEraForSlug(fromSlug)
  const toEra = getEraForSlug(toSlug)
  if (!fromEra || !toEra) return null

  const bridge = THEMATIC_BRIDGES.find(
    (b) =>
      (b.from.slug === fromSlug && b.to.slug === toSlug) ||
      (b.from.slug === toSlug && b.to.slug === fromSlug)
  )

  // Use the destination era's voice
  const voice = Object.values(SEED_PROFILES).find((p) => p.series === `the-${toEra.key}`)
  if (!voice) return null

  const yearGap = toEra.yearRange[0] - fromEra.yearRange[1]
  const sameEra = fromEra.key === toEra.key

  const systemPrompt = `${voice.promptFragments.systemPreamble}

You are writing a brief interstitial passage (150-250 words) that bridges two articles.

${voice.promptFragments.styleDirective}

${voice.promptFragments.constraintDirective}

This is not a summary. It is a passage of time rendered as prose — ${sameEra ? 'weeks or months' : `${yearGap} years`} compressed into a paragraph or two. It should feel like the space between chapters in a novel.`

  const userPrompt = `Write an interstitial bridging:

FROM: "${fromArticle.title}" (${fromEra.yearRange[0]}–${fromEra.yearRange[1]})
  Ending: "${fromArticle.closingLine.slice(0, 150)}..."

TO: "${toArticle.title}" (${toEra.yearRange[0]}–${toEra.yearRange[1]})
  Opening: "${toArticle.openingLine.slice(0, 150)}..."

${bridge ? `THEMATIC CONNECTION: ${bridge.connection}` : ''}
${yearGap > 0 ? `TIME GAP: ${yearGap} years pass between these pieces.` : ''}

The interstitial should:
- Never summarize either article
- Evoke the passage of time through concrete sensory detail
- ${sameEra ? 'Bridge the emotional shift within the same era' : 'Mark the transition between eras — from ' + fromEra.visualIdentity.lighting + ' to ' + toEra.visualIdentity.lighting}
- End at the threshold of the next article — the reader should feel the new world beginning

FORMAT: Plain prose, no headers, no frontmatter. 150-250 words.`

  return { systemPrompt, userPrompt }
}
