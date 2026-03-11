/**
 * Voice Research Engine
 *
 * The autoresearch loop for prose voice. Given a VoiceProfile, the engine:
 *
 *   1. GENERATE — produces prose samples using the profile as system prompt
 *   2. MEASURE — computes quantitative metrics on the generated text
 *   3. EVALUATE — uses an LLM judge to score the sample against the profile
 *   4. MUTATE — adjusts the profile parameters based on evaluation feedback
 *   5. REPEAT — until convergence or max iterations
 *
 * The search space is the set of all possible prose styles. The fitness function
 * is a combination of quantitative metrics (sentence length, punctuation profile)
 * and qualitative LLM judgment (does it sound like Sebald? Is the body present?).
 */

import { Configuration, OpenAIApi } from 'openai-edge'
import { computeMetrics } from './metrics'
import type {
  VoiceProfile,
  VoiceSample,
  VoiceEvaluation,
  EvaluationDimensions,
  EvaluationFeedback,
  MutationStrategy,
  ResearchIteration,
  VoiceResearchRun,
  MeasuredMetrics,
} from './types'

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const GENERATION_MODEL = 'gpt-4o'
const JUDGE_MODEL = 'gpt-4o'
const GENERATION_TEMPERATURE = 0.85
const JUDGE_TEMPERATURE = 0.3
const SAMPLES_PER_ITERATION = 3

/** Scenarios to generate samples from — varied to test range of voice */
const SAMPLE_SCENARIOS = [
  {
    type: 'opening' as const,
    prompt:
      'Write the opening 400-500 words of a story about a [PROFESSION] who discovers that ' +
      'an AI system has exceeded their capability in one specific, undeniable way. Set it in a ' +
      'specific place with specific sensory details. Do not name the series or use meta-references.',
    professionOptions: [
      'surgeon', 'jazz pianist', 'structural engineer', 'documentary filmmaker',
      'sommelier', 'air traffic controller', 'forensic accountant', 'choreographer',
    ],
  },
  {
    type: 'scene' as const,
    prompt:
      'Write a 300-400 word scene in which a character interacts with a deprecated or ' +
      'abandoned piece of technology. Focus on the physical environment and the character\'s ' +
      'body. Do not explain the significance of the scene.',
  },
  {
    type: 'closing' as const,
    prompt:
      'Write a 200-300 word closing journal entry / field note / voice memo from a character ' +
      'who has just experienced something they cannot yet fully articulate. The entry should ' +
      'feel raw, unedited, and unresolved.',
  },
  {
    type: 'description' as const,
    prompt:
      'Write a 300-400 word description of an abstract concept (choose one: emergence, ' +
      'obsolescence, cognitive symbiosis, the weight of expertise) rendered through concrete ' +
      'sensory experience. No abstractions without physical anchors.',
  },
]

// ═══════════════════════════════════════════════════════════════
// GENERATE
// ═══════════════════════════════════════════════════════════════

function buildSystemPrompt(profile: VoiceProfile): string {
  const { promptFragments: pf, parameters: p, heritage: h } = profile

  return [
    pf.systemPreamble,
    '',
    '## Voice Heritage',
    `Channel the literary DNA of ${h.primary} and ${h.secondary}. ${h.blendDescription}`,
    `Reference works for calibration: ${h.referenceWorks.join('; ')}`,
    '',
    '## Style Directive',
    pf.styleDirective,
    '',
    '## Technical Parameters (internalize, do not mention)',
    `- Target average sentence length: ~${p.rhythm.avgSentenceLength} words`,
    `- Sentence length variance: high (mix short punches with long flows)`,
    `- Short sentences (≤8 words): ~${Math.round(p.rhythm.shortSentenceRatio * 100)}% of total`,
    `- Long sentences (≥50 words): ~${Math.round(p.rhythm.longSentenceRatio * 100)}% of total`,
    `- Signature punctuation: prefer ${p.rhythm.signaturePunctuation}`,
    `- Paragraph architecture: ${p.structure.paragraphArchitecture}`,
    `- Paragraphs should feel: ${p.structure.paragraphClosure}`,
    `- Draw metaphors from: ${p.imagery.metaphorDomains.join(', ')}`,
    `- Emphasize sensory channels: ${p.imagery.sensoryChanels.join(', ')}`,
    `- Show vs tell ratio: ${Math.round(p.narration.showTellRatio * 100)}% show`,
    `- Reader trust level: ${p.register.readerTrust > 0.7 ? 'high — do not over-explain' : 'moderate — some guidance okay'}`,
    `- Emotional temperature: ${p.register.emotionalTemperature > 0.6 ? 'warm but controlled' : p.register.emotionalTemperature > 0.3 ? 'restrained' : 'clinical'}`,
    '',
    '## Constraints',
    pf.constraintDirective,
    '',
    '## Closing',
    pf.closingDirective,
  ].join('\n')
}

function pickScenario(profile: VoiceProfile, iteration: number): { type: string; prompt: string } {
  const scenario = SAMPLE_SCENARIOS[iteration % SAMPLE_SCENARIOS.length]
  let prompt = scenario.prompt

  if ('professionOptions' in scenario && scenario.professionOptions) {
    const profession =
      scenario.professionOptions[Math.floor(Math.random() * scenario.professionOptions.length)]
    prompt = prompt.replace('[PROFESSION]', profession)
  }

  return { type: scenario.type, prompt }
}

export async function generateSample(
  openai: OpenAIApi,
  profile: VoiceProfile,
  scenarioIndex: number
): Promise<VoiceSample> {
  const systemPrompt = buildSystemPrompt(profile)
  const scenario = pickScenario(profile, scenarioIndex)

  const response = await openai.createChatCompletion({
    model: GENERATION_MODEL,
    temperature: GENERATION_TEMPERATURE,
    max_tokens: 2000,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: scenario.prompt },
    ],
  })

  const json = await response.json()
  const text = json.choices?.[0]?.message?.content || ''
  const metrics = computeMetrics(text, profile.constraints.forbidden)

  return {
    id: `sample-${profile.id}-${Date.now()}-${scenarioIndex}`,
    profileId: profile.id,
    profileVersion: profile.version,
    sampleType: scenario.type as VoiceSample['sampleType'],
    scenario: scenario.prompt,
    text,
    wordCount: text.split(/\s+/).length,
    metrics,
    model: GENERATION_MODEL,
    temperature: GENERATION_TEMPERATURE,
    generatedAt: new Date().toISOString(),
  }
}

// ═══════════════════════════════════════════════════════════════
// EVALUATE
// ═══════════════════════════════════════════════════════════════

function buildJudgePrompt(profile: VoiceProfile, sample: VoiceSample): string {
  const p = profile.parameters

  return `You are a literary critic and prose analyst. Evaluate this prose sample against the target voice profile.

## Target Voice: ${profile.name}
Heritage: ${profile.heritage.primary} meets ${profile.heritage.secondary}
${profile.heritage.blendDescription}

## Target Parameters
- Sentence rhythm: avg ~${p.rhythm.avgSentenceLength} words, variance ${p.rhythm.sentenceLengthVariance}, ${Math.round(p.rhythm.shortSentenceRatio * 100)}% short, ${Math.round(p.rhythm.longSentenceRatio * 100)}% long
- Structure: ${p.structure.paragraphArchitecture} paragraphs, ${p.structure.paragraphClosure} closure, ${p.structure.closingStyle} endings
- Imagery from: ${p.imagery.metaphorDomains.join(', ')} — FORBIDDEN: ${p.imagery.forbiddenDomains.join(', ')}
- Sensory emphasis: ${p.imagery.sensoryChanels.join(', ')}
- Narration: ${p.narration.pov}, show/tell ${Math.round(p.narration.showTellRatio * 100)}/${Math.round((1 - p.narration.showTellRatio) * 100)}, characters ${p.narration.characterRendering}
- Register: formality ${p.register.formality}, emotion ${p.register.emotionalTemperature}, reader trust ${p.register.readerTrust}

## Forbidden Patterns
${profile.constraints.forbidden.map((f) => `- "${f}"`).join('\n')}

## Measured Metrics (already computed)
- Actual avg sentence length: ${sample.metrics.avgSentenceLength} words
- Actual short sentence ratio: ${sample.metrics.shortSentenceRatio}
- Actual long sentence ratio: ${sample.metrics.longSentenceRatio}
- Punctuation profile: ${JSON.stringify(sample.metrics.punctuationProfile)}
- Detected metaphor domains: ${sample.metrics.detectedMetaphorDomains.join(', ') || 'none detected'}
- Constraint violations: ${sample.metrics.constraintViolations.join('; ') || 'none'}

## Sample (${sample.sampleType}, ${sample.wordCount} words)

${sample.text}

---

Score each dimension 0-100 with a rationale and specific quotes as evidence.
Then provide actionable feedback items.

Respond in JSON:
{
  "overallScore": <0-100>,
  "dimensions": {
    "rhythmFidelity": { "score": <0-100>, "rationale": "...", "specificExamples": ["quote1", "quote2"] },
    "structureFidelity": { "score": <0-100>, "rationale": "...", "specificExamples": ["..."] },
    "imageryFidelity": { "score": <0-100>, "rationale": "...", "specificExamples": ["..."] },
    "narrationFidelity": { "score": <0-100>, "rationale": "...", "specificExamples": ["..."] },
    "registerFidelity": { "score": <0-100>, "rationale": "...", "specificExamples": ["..."] },
    "constraintCompliance": { "score": <0-100>, "rationale": "...", "specificExamples": ["..."] },
    "proseQuality": { "score": <0-100>, "rationale": "...", "specificExamples": ["..."] },
    "voiceDistinctiveness": { "score": <0-100>, "rationale": "...", "specificExamples": ["..."] },
    "voiceConsistency": { "score": <0-100>, "rationale": "...", "specificExamples": ["..."] }
  },
  "feedback": [
    {
      "dimension": "<dimension key>",
      "severity": "critical|major|minor|suggestion",
      "feedback": "...",
      "evidence": "quote from sample",
      "suggestion": "how to fix"
    }
  ],
  "keepAsSample": <true if score > 75>
}`
}

export async function evaluateSample(
  openai: OpenAIApi,
  profile: VoiceProfile,
  sample: VoiceSample
): Promise<VoiceEvaluation> {
  const judgePrompt = buildJudgePrompt(profile, sample)

  const response = await openai.createChatCompletion({
    model: JUDGE_MODEL,
    temperature: JUDGE_TEMPERATURE,
    max_tokens: 3000,
    messages: [
      {
        role: 'system',
        content:
          'You are a precise literary critic. Respond ONLY with valid JSON. No markdown, no commentary.',
      },
      { role: 'user', content: judgePrompt },
    ],
  })

  const json = await response.json()
  const content = json.choices?.[0]?.message?.content || '{}'

  // Parse the JSON response, handling potential markdown code blocks
  let parsed: Record<string, unknown>
  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('Failed to parse judge response:', content.slice(0, 200))
    parsed = { overallScore: 0, dimensions: {}, feedback: [] }
  }

  return {
    profileId: profile.id,
    profileVersion: profile.version,
    sampleId: sample.id,
    overallScore: (parsed.overallScore as number) || 0,
    dimensions: (parsed.dimensions as EvaluationDimensions) || ({} as EvaluationDimensions),
    feedback: (parsed.feedback as EvaluationFeedback[]) || [],
    keepAsSample: (parsed.keepAsSample as boolean) || false,
    evaluatedAt: new Date().toISOString(),
  }
}

// ═══════════════════════════════════════════════════════════════
// MUTATE
// ═══════════════════════════════════════════════════════════════

/**
 * Build a mutation prompt that asks the LLM to suggest profile adjustments
 * based on evaluation feedback.
 */
function buildMutationPrompt(
  profile: VoiceProfile,
  evaluations: VoiceEvaluation[]
): string {
  const avgScore =
    evaluations.reduce((sum, e) => sum + e.overallScore, 0) / evaluations.length

  const allFeedback = evaluations.flatMap((e) => e.feedback)
  const criticalFeedback = allFeedback.filter((f) => f.severity === 'critical' || f.severity === 'major')

  // Find the weakest dimensions across all evaluations
  const dimensionScores: Record<string, number[]> = {}
  for (const evaluation of evaluations) {
    for (const [key, value] of Object.entries(evaluation.dimensions)) {
      if (!dimensionScores[key]) dimensionScores[key] = []
      dimensionScores[key].push((value as { score: number }).score || 0)
    }
  }

  const weakest = Object.entries(dimensionScores)
    .map(([key, scores]) => ({
      key,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)

  return `You are a voice profile engineer. Given evaluation results, suggest specific parameter mutations.

## Current Profile: ${profile.name} v${profile.version}
Average score: ${Math.round(avgScore)}

## Weakest Dimensions
${weakest.map((w) => `- ${w.key}: ${Math.round(w.avg)}/100`).join('\n')}

## Critical/Major Feedback
${criticalFeedback.map((f) => `- [${f.dimension}] ${f.feedback}${f.suggestion ? ` → Suggestion: ${f.suggestion}` : ''}`).join('\n') || 'None'}

## Current Parameters (JSON)
${JSON.stringify(profile.parameters, null, 2)}

## Current Prompt Fragments
systemPreamble: ${profile.promptFragments.systemPreamble.slice(0, 200)}...
styleDirective: ${profile.promptFragments.styleDirective.slice(0, 200)}...
constraintDirective: ${profile.promptFragments.constraintDirective.slice(0, 200)}...

---

Suggest mutations. Respond in JSON:
{
  "parameterChanges": {
    "<path.to.parameter>": <new_value>,
    ...
  },
  "promptFragmentChanges": {
    "<fragment_key>": "<new text or null to keep>"
  },
  "addConstraints": ["new forbidden pattern", ...],
  "removeConstraints": ["pattern to remove", ...],
  "rationale": "Why these changes should improve the score"
}`
}

export async function mutateProfile(
  openai: OpenAIApi,
  profile: VoiceProfile,
  evaluations: VoiceEvaluation[]
): Promise<VoiceProfile> {
  const mutationPrompt = buildMutationPrompt(profile, evaluations)

  const response = await openai.createChatCompletion({
    model: JUDGE_MODEL,
    temperature: 0.4,
    max_tokens: 2000,
    messages: [
      {
        role: 'system',
        content:
          'You are a voice profile engineer. Respond ONLY with valid JSON. Make targeted, specific changes.',
      },
      { role: 'user', content: mutationPrompt },
    ],
  })

  const json = await response.json()
  const content = json.choices?.[0]?.message?.content || '{}'

  let mutations: Record<string, unknown>
  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    mutations = JSON.parse(cleaned)
  } catch {
    console.error('Failed to parse mutation response, returning unchanged profile')
    return { ...profile, version: profile.version + 1, parentId: profile.id }
  }

  // Apply parameter changes
  const newProfile: VoiceProfile = JSON.parse(JSON.stringify(profile))
  newProfile.id = `${profile.name.toLowerCase().replace(/\s+/g, '-')}-v${profile.version + 1}`
  newProfile.version = profile.version + 1
  newProfile.parentId = profile.id
  newProfile.createdAt = new Date().toISOString()

  // Apply parameter mutations via dot-path
  const paramChanges = (mutations.parameterChanges || {}) as Record<string, unknown>
  for (const [path, value] of Object.entries(paramChanges)) {
    setNestedValue(newProfile.parameters, path, value)
  }

  // Apply prompt fragment changes
  const fragmentChanges = (mutations.promptFragmentChanges || {}) as Record<string, string | null>
  for (const [key, value] of Object.entries(fragmentChanges)) {
    if (value && key in newProfile.promptFragments) {
      ;(newProfile.promptFragments as Record<string, string>)[key] = value
    }
  }

  // Apply constraint changes
  const addConstraints = (mutations.addConstraints || []) as string[]
  const removeConstraints = (mutations.removeConstraints || []) as string[]
  newProfile.constraints.forbidden = [
    ...newProfile.constraints.forbidden.filter((c) => !removeConstraints.includes(c)),
    ...addConstraints,
  ]

  console.log(`  Mutation rationale: ${(mutations.rationale as string) || 'none provided'}`)

  return newProfile
}

/**
 * Set a value at a dot-separated path in a nested object.
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let current: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] && typeof current[parts[i]] === 'object') {
      current = current[parts[i]] as Record<string, unknown>
    } else {
      return // path doesn't exist, skip
    }
  }
  current[parts[parts.length - 1]] = value
}

// ═══════════════════════════════════════════════════════════════
// RESEARCH LOOP
// ═══════════════════════════════════════════════════════════════

export interface ResearchCallbacks {
  onIterationStart?: (iteration: number, profile: VoiceProfile) => void
  onSampleGenerated?: (sample: VoiceSample, index: number) => void
  onEvaluation?: (evaluation: VoiceEvaluation) => void
  onMutation?: (oldProfile: VoiceProfile, newProfile: VoiceProfile) => void
  onIterationComplete?: (iteration: ResearchIteration) => void
}

export async function runResearch(
  apiKey: string,
  seedProfile: VoiceProfile,
  options: {
    maxIterations?: number
    convergenceThreshold?: number
    samplesPerIteration?: number
    callbacks?: ResearchCallbacks
  } = {}
): Promise<VoiceResearchRun> {
  const config = new Configuration({ apiKey })
  const openai = new OpenAIApi(config)

  const maxIterations = options.maxIterations || 5
  const convergenceThreshold = options.convergenceThreshold || 85
  const samplesPerIteration = options.samplesPerIteration || SAMPLES_PER_ITERATION
  const callbacks = options.callbacks || {}

  const run: VoiceResearchRun = {
    runId: `run-${Date.now()}`,
    series: seedProfile.series,
    seedProfileId: seedProfile.id,
    iterations: [],
    convergenceThreshold,
    maxIterations,
    bestProfileId: seedProfile.id,
    bestScore: 0,
    status: 'running',
    startedAt: new Date().toISOString(),
  }

  let currentProfile = seedProfile

  for (let i = 0; i < maxIterations; i++) {
    callbacks.onIterationStart?.(i, currentProfile)

    // Generate samples
    const samples: VoiceSample[] = []
    for (let j = 0; j < samplesPerIteration; j++) {
      const sample = await generateSample(openai, currentProfile, i * samplesPerIteration + j)
      samples.push(sample)
      callbacks.onSampleGenerated?.(sample, j)
    }

    // Evaluate samples
    const evaluations: VoiceEvaluation[] = []
    for (const sample of samples) {
      const evaluation = await evaluateSample(openai, currentProfile, sample)
      evaluations.push(evaluation)
      callbacks.onEvaluation?.(evaluation)
    }

    const avgScore =
      evaluations.reduce((sum, e) => sum + e.overallScore, 0) / evaluations.length
    const bestScore = Math.max(...evaluations.map((e) => e.overallScore))

    // Track best
    if (bestScore > run.bestScore) {
      run.bestScore = bestScore
      run.bestProfileId = currentProfile.id
    }

    // Mutate for next iteration
    let childProfile: VoiceProfile | undefined
    if (avgScore < convergenceThreshold && i < maxIterations - 1) {
      childProfile = await mutateProfile(openai, currentProfile, evaluations)
      callbacks.onMutation?.(currentProfile, childProfile)
    }

    const iteration: ResearchIteration = {
      iteration: i,
      profile: currentProfile,
      samples,
      evaluations,
      avgScore,
      bestScore,
      childProfileId: childProfile?.id,
      completedAt: new Date().toISOString(),
    }
    run.iterations.push(iteration)
    callbacks.onIterationComplete?.(iteration)

    // Check convergence
    if (avgScore >= convergenceThreshold) {
      run.status = 'converged'
      break
    }

    // Advance to child profile
    if (childProfile) {
      currentProfile = childProfile
    }
  }

  if (run.status === 'running') {
    run.status = 'max-iterations'
  }

  run.completedAt = new Date().toISOString()
  return run
}
