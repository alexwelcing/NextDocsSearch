/**
 * Scene Planner for Article-to-Video Pipeline
 *
 * Implements deterministic heuristics for:
 * - Hook selection scoring
 * - Close selection scoring
 * - Article type detection
 * - Shot list generation
 * - Clip pattern mapping
 */

import type {
  ArticleIntermediate,
  ArticleType,
  ClipPlan,
  ClipRole,
  ScenePlan,
  ScoredLine,
} from './types'

// ═══════════════════════════════════════════════════════════════
// HOOK / CLOSE SCORING
// ═══════════════════════════════════════════════════════════════

const NUMBER_PATTERN = /\d[\d,.]*\s*(%|years?|months?|days?|hours?|x\b|×|billion|million|thousand)/i
const RISK_PATTERN = /⚠|break|fail|catastroph|danger|risk|warning|vulner|threat|attack|breach|exploit/i
const CONTRAST_PATTERN = /\bvs\.?\b|\bversus\b|today.*future|before.*after|fragile.*fault|old.*new/i
const CONCRETE_PATTERN = /\b(algorithm|protocol|framework|architecture|system|model|engine|circuit|network|pipeline)\b/i
const CONCLUSION_HEADING = /conclusion|summary|takeaway|wrap.?up|closing|final/i
const IMPERATIVE_PATTERN = /^(start|begin|adopt|migrate|implement|consider|ensure|prioritize|use|avoid|check)\b/i
const SO_WHAT_PATTERN = /matters?\b|important|implication|impact|consequence|future|next step/i

/**
 * Score a sentence for hook potential.
 * Higher score = better hook candidate.
 */
export function scoreHook(sentence: string): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  if (NUMBER_PATTERN.test(sentence)) {
    score += 3
    reasons.push('contains number/date/timeline')
  }

  if (RISK_PATTERN.test(sentence)) {
    score += 3
    reasons.push('expresses risk/warning/high stakes')
  }

  if (CONTRAST_PATTERN.test(sentence)) {
    score += 2
    reasons.push('contrasts two states')
  }

  if (CONCRETE_PATTERN.test(sentence)) {
    score += 1
    reasons.push('names concrete system/mechanism')
  }

  return { score, reasons }
}

/**
 * Score a sentence for closing potential.
 * Higher score = better close candidate.
 */
export function scoreClose(
  sentence: string,
  sectionHeading: string
): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  if (CONCLUSION_HEADING.test(sectionHeading)) {
    score += 3
    reasons.push('from conclusion section')
  }

  if (IMPERATIVE_PATTERN.test(sentence.trim())) {
    score += 2
    reasons.push('direct recommendation')
  }

  if (SO_WHAT_PATTERN.test(sentence)) {
    score += 1
    reasons.push('clear "so what" for audience')
  }

  return { score, reasons }
}

/**
 * Select the best hook line from an article
 */
export function selectHook(article: ArticleIntermediate): ScoredLine {
  let best: ScoredLine = { text: article.title, score: 0, sectionHeading: '', reasons: ['fallback to title'] }

  for (const section of article.sections) {
    for (const para of section.paragraphs) {
      const sentences = para.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20 && s.length < 200)
      for (const sentence of sentences) {
        const { score, reasons } = scoreHook(sentence)
        if (score > best.score) {
          best = { text: sentence.trim(), score, sectionHeading: section.heading, reasons }
        }
      }
    }

    // Also score callouts (often high-impact)
    for (const callout of section.callouts) {
      const { score, reasons } = scoreHook(callout.text)
      const bonus = callout.type === 'warning' ? 2 : 0
      if (score + bonus > best.score) {
        best = {
          text: callout.text,
          score: score + bonus,
          sectionHeading: section.heading,
          reasons: [...reasons, ...(bonus > 0 ? ['warning callout'] : [])],
        }
      }
    }
  }

  return best
}

/**
 * Select the best closing line from an article
 */
export function selectClose(article: ArticleIntermediate): ScoredLine {
  let best: ScoredLine = {
    text: `Read the full article: ${article.title}`,
    score: 0,
    sectionHeading: '',
    reasons: ['fallback to CTA'],
  }

  for (const section of article.sections) {
    for (const para of section.paragraphs) {
      const sentences = para.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20 && s.length < 200)
      for (const sentence of sentences) {
        const { score, reasons } = scoreClose(sentence, section.heading)
        if (score > best.score) {
          best = { text: sentence.trim(), score, sectionHeading: section.heading, reasons }
        }
      }
    }
  }

  return best
}

// ═══════════════════════════════════════════════════════════════
// ARTICLE TYPE DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Detect article type from structural signals
 */
export function detectArticleType(article: ArticleIntermediate): ArticleType {
  const headings = article.sections.map((s) => s.heading.toLowerCase()).join(' ')
  const hasCode = article.sections.some((s) => s.codeBlocks.length > 0)
  const warningCallouts = article.sections.flatMap((s) =>
    s.callouts.filter((c) => c.type === 'warning')
  )
  const hasWarnings = warningCallouts.length > 0
  const hasConclusionSection = article.sections.some((s) =>
    CONCLUSION_HEADING.test(s.heading)
  )

  // Also check all callout text and quotes for risk language
  const allCalloutText = warningCallouts.map((c) => c.text).join(' ')
  const allQuoteText = article.quotes.map((q) => q.text).join(' ')
  const riskInContent = RISK_PATTERN.test(headings) ||
    RISK_PATTERN.test(allCalloutText) ||
    RISK_PATTERN.test(allQuoteText)

  // Warning/risk memo: warnings + risk-oriented content
  if (hasWarnings && riskInContent) {
    return 'warning-risk-memo'
  }

  // Technical tutorial: code blocks + conclusion + many sections
  if (hasCode && hasConclusionSection && article.sections.length >= 4) {
    return 'technical-tutorial'
  }

  // Speculative fiction: narrative signals
  if (
    headings.includes('chapter') ||
    headings.includes('prologue') ||
    headings.includes('epilogue') ||
    headings.includes('chronicle')
  ) {
    return 'speculative-fiction'
  }

  // Product/strategy: tradeoff/framework signals
  if (
    headings.includes('tradeoff') ||
    headings.includes('trade-off') ||
    headings.includes('framework') ||
    headings.includes('strategy') ||
    headings.includes('analysis')
  ) {
    return 'product-strategy'
  }

  return 'general'
}

// ═══════════════════════════════════════════════════════════════
// CLIP PATTERN TEMPLATES
// ═══════════════════════════════════════════════════════════════

const CLIP_PATTERNS: Record<ArticleType, ClipRole[]> = {
  'technical-tutorial': [
    'hook',
    'why_it_matters',
    'key_concept',
    'mechanism',
    'example',
    'limits',
    'recommendation',
    'cta',
  ],
  'product-strategy': [
    'hook',
    'why_it_matters',
    'tradeoff',
    'tradeoff',
    'framework',
    'recommendation',
    'cta',
  ],
  'speculative-fiction': [
    'hook',
    'escalation',
    'key_concept',
    'twist',
    'consequence',
    'closing_thought',
    'cta',
  ],
  'warning-risk-memo': [
    'hook',
    'risk_metaphor',
    'mechanism',
    'warning',
    'mitigation',
    'cta',
  ],
  general: [
    'hook',
    'why_it_matters',
    'key_concept',
    'example',
    'recommendation',
    'cta',
  ],
}

// ═══════════════════════════════════════════════════════════════
// SCENE PLAN GENERATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Map a clip role to a source section index
 */
function mapRoleToSection(role: ClipRole, sectionCount: number, clipIndex: number): number {
  if (role === 'hook' || role === 'cta') return 0
  if (role === 'closing_thought' || role === 'recommendation') return Math.max(0, sectionCount - 1)
  // Distribute remaining roles across middle sections
  const middleSections = Math.max(1, sectionCount - 2)
  const offset = Math.min(clipIndex, middleSections)
  return Math.min(offset + 1, sectionCount - 1)
}

/**
 * Generate a complete scene plan from an article intermediate
 */
export function generateScenePlan(
  article: ArticleIntermediate,
  options?: {
    targetDurationS?: number
    clipDurationS?: number
  }
): ScenePlan {
  const articleType = detectArticleType(article)
  const clipPattern = CLIP_PATTERNS[articleType]
  const clipDurationS = options?.clipDurationS || 7
  const totalClips = clipPattern.length

  const hookLine = selectHook(article)
  const closeLine = selectClose(article)

  const clips: ClipPlan[] = clipPattern.map((role, index) => {
    const sectionIdx = mapRoleToSection(role, article.sections.length, index)
    const section = article.sections[sectionIdx]
    const isFirst = index === 0
    const isLast = index === clipPattern.length - 1
    const duration = isFirst ? 6 : isLast ? 8 : clipDurationS

    // Caption text: use hook for first, close for last, section summary otherwise
    let captionText: string
    if (isFirst) {
      captionText = hookLine.text
    } else if (isLast) {
      captionText = `Read the full article at alexwelcing.com/articles/${article.slug}`
    } else {
      captionText = section?.paragraphs[0]?.slice(0, 120) || section?.heading || ''
    }

    // Voiceover: brief narration
    let voiceoverText: string
    if (isFirst) {
      voiceoverText = hookLine.text
    } else if (isLast) {
      voiceoverText = closeLine.text
    } else {
      voiceoverText = section?.paragraphs[0]?.slice(0, 200) || ''
    }

    // Decide LTX mode: use I2V if article has images, T2V for B-roll
    const hasImage = section?.images.length > 0 || (isFirst && !!article.heroImage)
    const ltxMode = hasImage ? 'I2V' : 'T2V'
    const imageAnchor = isFirst
      ? article.heroImage
      : section?.images[0]

    return {
      sceneId: `S${String(index + 1).padStart(2, '0')}_${role}`,
      clipIndex: index,
      role,
      durationS: duration,
      captionText,
      voiceoverText,
      sourceSection: section?.heading,
      sourceTextSpan: section?.paragraphs[0]?.slice(0, 100),
      ltxMode,
      promptTemplate: role,
      imageAnchor: imageAnchor || undefined,
    } satisfies ClipPlan
  })

  const estimatedDurationS = clips.reduce((sum, c) => sum + c.durationS, 0)
  const voiceoverScript = clips.map(
    (c) => `[${c.sceneId}] ${c.voiceoverText}`
  )

  return {
    articleSlug: article.slug,
    articleType,
    totalClips,
    estimatedDurationS,
    hookLine,
    closeLine,
    clips,
    voiceoverScript,
  }
}
