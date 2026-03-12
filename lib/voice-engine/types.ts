/**
 * Voice Profile Types
 *
 * A voice profile is a structured, quantifiable specification of an authorial
 * style. Think of it as a genome: each parameter is a gene that can be measured,
 * mutated, and selected for. The system generates prose samples from a profile,
 * evaluates them against the target, and evolves the profile toward convergence.
 *
 * Inspired by Karpathy's autoresearch: instead of searching over ML architectures,
 * we search over the space of prose styles.
 */

// ═══════════════════════════════════════════════════════════════
// VOICE PROFILE — THE GENOME
// ═══════════════════════════════════════════════════════════════

export interface VoiceProfile {
  /** Unique identifier */
  id: string
  /** Human-readable name (e.g., "Nkechi Adesanya v3.2") */
  name: string
  /** Which series this voice directs */
  series: string
  /** Version, auto-incremented on mutation */
  version: number
  /** Parent profile ID if this was derived via mutation */
  parentId?: string

  /** The voice heritage — literary ancestors to channel */
  heritage: VoiceHeritage

  /** Quantifiable prose parameters — the actual genome */
  parameters: VoiceParameters

  /** Constraint set — hard rules the voice must obey */
  constraints: VoiceConstraints

  /** Prompt fragments — reusable building blocks for system prompts */
  promptFragments: PromptFragments

  /** Metadata */
  createdAt: string
  /** Best evaluation score achieved by this profile */
  bestScore?: number
  /** Number of generations run with this profile */
  generationCount: number
}

export interface VoiceHeritage {
  /** Primary literary ancestor (e.g., "W.G. Sebald") */
  primary: string
  /** Secondary ancestor for tension/blend (e.g., "Svetlana Alexievich") */
  secondary: string
  /** One-line description of what the blend produces */
  blendDescription: string
  /** Specific works to reference for calibration */
  referenceWorks: string[]
}

export interface VoiceParameters {
  /** Sentence rhythm — the heartbeat of the prose */
  rhythm: RhythmParameters
  /** Paragraph architecture — how ideas build */
  structure: StructureParameters
  /** Metaphor and imagery configuration */
  imagery: ImageryParameters
  /** Narrative stance and distance */
  narration: NarrationParameters
  /** Emotional register */
  register: RegisterParameters
}

export interface RhythmParameters {
  /** Target average sentence length in words (e.g., 18 for punchy, 45 for Sebaldian) */
  avgSentenceLength: number
  /** Standard deviation — higher means more variation (e.g., 5 is uniform, 20 is wild) */
  sentenceLengthVariance: number
  /** Ratio of sentences under 8 words (0.0 to 0.3) */
  shortSentenceRatio: number
  /** Ratio of sentences over 50 words (0.0 to 0.4) */
  longSentenceRatio: number
  /** How often fragments (non-sentences) appear (0.0 to 0.2) */
  fragmentFrequency: number
  /** Dominant punctuation beyond periods: 'em-dash' | 'semicolon' | 'colon' | 'comma-chain' */
  signaturePunctuation: string
  /** Whether rhythm should vary between sections or stay consistent */
  rhythmModulation: 'consistent' | 'section-variable' | 'movement-based'
}

export interface StructureParameters {
  /** How paragraphs build: 'linear' | 'spiral' | 'observation-complication' | 'accumulative' */
  paragraphArchitecture: string
  /** Whether paragraphs resolve (close) or leave threads open */
  paragraphClosure: 'resolved' | 'open-ended' | 'mixed'
  /** How the overall piece progresses */
  narrativeArc: 'chronological' | 'circular' | 'fragmentary' | 'telescoping'
  /** Section break style */
  sectionBreaks: 'thematic-headers' | 'whitespace-only' | 'numbered' | 'dated'
  /** How the piece ends */
  closingStyle: 'aphorism' | 'question' | 'trailing-off' | 'inventory' | 'image' | 'silence'
}

export interface ImageryParameters {
  /** Primary metaphor domains (e.g., ["body", "workshop", "clinic"]) */
  metaphorDomains: string[]
  /** Forbidden metaphor domains (e.g., ["cartography", "bridges"]) */
  forbiddenDomains: string[]
  /** Sensory channels emphasized: "visual" | "tactile" | "olfactory" | "auditory" | "kinesthetic" */
  sensoryChanels: string[]
  /** How abstract concepts are rendered: 'direct-metaphor' | 'sensory-experience' | 'anecdote' | 'nested-scale' */
  abstractionStrategy: string
  /** Frequency of extended metaphor vs quick comparison (0.0 = all quick, 1.0 = all extended) */
  metaphorExtension: number
}

export interface NarrationParameters {
  /** Point of view */
  pov: 'close-third' | 'distant-third' | 'omniscient' | 'variable-distance' | 'first-person'
  /** How much the narrator explains vs shows */
  showTellRatio: number // 0.0 = all tell, 1.0 = all show
  /** Whether the narrator has a personality or is transparent */
  narratorPresence: 'invisible' | 'subtle' | 'distinct' | 'unreliable'
  /** How characters are rendered */
  characterRendering: 'through-action' | 'through-traces' | 'through-interiority' | 'through-dialogue'
  /** Degree of interiority access (0.0 = external only, 1.0 = stream of consciousness) */
  interiorityDepth: number
}

export interface RegisterParameters {
  /** Formality level (0.0 = conversational, 1.0 = academic) */
  formality: number
  /** Emotional temperature (0.0 = clinical detachment, 1.0 = raw feeling) */
  emotionalTemperature: number
  /** Humor frequency (0.0 = none, 1.0 = pervasive) */
  humorFrequency: number
  /** Confidence of assertions (0.0 = deeply hedged, 1.0 = declarative) */
  assertionConfidence: number
  /** How much the prose trusts the reader to interpret (0.0 = spells everything out, 1.0 = maximally implicit) */
  readerTrust: number
}

export interface VoiceConstraints {
  /** Phrases or patterns the voice must NEVER use */
  forbidden: string[]
  /** Phrases or patterns the voice SHOULD use */
  encouraged: string[]
  /** Maximum number of times any rhetorical device can repeat per piece */
  maxDeviceRepetition: number
  /** Whether the closing section can use aphorisms */
  allowAphorisms: boolean
  /** Whether the narrator can directly state thematic significance */
  allowExplicitThematics: boolean
}

export interface PromptFragments {
  /** System prompt preamble — sets the voice identity */
  systemPreamble: string
  /** Style instruction block — the core voice direction */
  styleDirective: string
  /** Constraint block — the "never do this" section */
  constraintDirective: string
  /** Closing instruction — how to end pieces */
  closingDirective: string
}

// ═══════════════════════════════════════════════════════════════
// EVALUATION — THE FITNESS FUNCTION
// ═══════════════════════════════════════════════════════════════

export interface VoiceEvaluation {
  /** The profile that was evaluated */
  profileId: string
  profileVersion: number
  /** The sample that was generated and scored */
  sampleId: string
  /** Overall score (0-100) */
  overallScore: number
  /** Per-dimension scores */
  dimensions: EvaluationDimensions
  /** Specific feedback for improvement */
  feedback: EvaluationFeedback[]
  /** Whether this sample should be kept as a reference example */
  keepAsSample: boolean
  /** Timestamp */
  evaluatedAt: string
}

export interface EvaluationDimensions {
  /** Does the rhythm match the target profile? */
  rhythmFidelity: DimensionScore
  /** Does the paragraph structure match? */
  structureFidelity: DimensionScore
  /** Are metaphors drawn from the right domains? */
  imageryFidelity: DimensionScore
  /** Is the narrative distance correct? */
  narrationFidelity: DimensionScore
  /** Is the register (formality, emotion, humor) right? */
  registerFidelity: DimensionScore
  /** Are constraints respected (no forbidden patterns)? */
  constraintCompliance: DimensionScore
  /** Is the prose actually good, independent of profile match? */
  proseQuality: DimensionScore
  /** Does it feel like a distinct voice, not generic? */
  voiceDistinctiveness: DimensionScore
  /** Does it feel like the same voice across samples? */
  voiceConsistency: DimensionScore
}

export interface DimensionScore {
  score: number // 0-100
  rationale: string
  specificExamples: string[] // quotes from the sample
}

export interface EvaluationFeedback {
  dimension: keyof EvaluationDimensions
  severity: 'critical' | 'major' | 'minor' | 'suggestion'
  feedback: string
  /** Specific text from the sample that triggered this feedback */
  evidence?: string
  /** Suggested fix or direction */
  suggestion?: string
}

// ═══════════════════════════════════════════════════════════════
// GENERATION — WHAT THE LOOP PRODUCES
// ═══════════════════════════════════════════════════════════════

export interface VoiceSample {
  id: string
  profileId: string
  profileVersion: number
  /** What was generated: a scene, an opening, a closing, a full piece */
  sampleType: 'scene' | 'opening' | 'closing' | 'full-piece' | 'dialogue' | 'description'
  /** The prompt/scenario given to generate this sample */
  scenario: string
  /** The generated text */
  text: string
  /** Word count */
  wordCount: number
  /** Measured metrics (computed post-generation) */
  metrics: MeasuredMetrics
  /** Generation metadata */
  model: string
  temperature: number
  generatedAt: string
}

export interface MeasuredMetrics {
  /** Actual average sentence length */
  avgSentenceLength: number
  /** Actual sentence length std dev */
  sentenceLengthVariance: number
  /** Actual ratio of short sentences */
  shortSentenceRatio: number
  /** Actual ratio of long sentences */
  longSentenceRatio: number
  /** Count of em-dashes, semicolons, etc */
  punctuationProfile: Record<string, number>
  /** Average paragraph length in sentences */
  avgParagraphLength: number
  /** Unique metaphor domains detected */
  detectedMetaphorDomains: string[]
  /** Forbidden patterns found */
  constraintViolations: string[]
}

// ═══════════════════════════════════════════════════════════════
// MUTATION — HOW PROFILES EVOLVE
// ═══════════════════════════════════════════════════════════════

export interface MutationStrategy {
  /** Which dimensions to adjust */
  targetDimensions: (keyof EvaluationDimensions)[]
  /** How aggressively to mutate (0.0 = tiny nudge, 1.0 = radical shift) */
  mutationRate: number
  /** Whether to also update prompt fragments based on feedback */
  updatePromptFragments: boolean
  /** Specific parameter overrides to force */
  parameterOverrides?: Partial<VoiceParameters>
}

export interface ResearchIteration {
  /** Iteration number */
  iteration: number
  /** The profile used for this iteration */
  profile: VoiceProfile
  /** Samples generated */
  samples: VoiceSample[]
  /** Evaluations of those samples */
  evaluations: VoiceEvaluation[]
  /** Average score across evaluations */
  avgScore: number
  /** Best score in this iteration */
  bestScore: number
  /** Mutation strategy used to derive the next iteration's profile */
  mutationApplied?: MutationStrategy
  /** The resulting child profile (used in the next iteration) */
  childProfileId?: string
  /** Timestamp */
  completedAt: string
}

// ═══════════════════════════════════════════════════════════════
// RESEARCH RUN — THE FULL EXPERIMENT
// ═══════════════════════════════════════════════════════════════

export interface VoiceResearchRun {
  /** Unique run ID */
  runId: string
  /** Which series/voice this is researching */
  series: string
  /** Starting profile */
  seedProfileId: string
  /** All iterations */
  iterations: ResearchIteration[]
  /** Convergence threshold — stop when avg score exceeds this */
  convergenceThreshold: number
  /** Max iterations before stopping */
  maxIterations: number
  /** Current best profile ID */
  bestProfileId: string
  /** Current best score */
  bestScore: number
  /** Status */
  status: 'running' | 'converged' | 'max-iterations' | 'stopped'
  /** Timestamps */
  startedAt: string
  completedAt?: string
}
