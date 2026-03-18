import type { ShipSignal } from '@/lib/ai/shipPersona'

export type ShipAnswerMode =
  | 'default'
  | 'brief'
  | 'signal'
  | 'map'
  | 'roast'
  | 'compare'
  | 'mission'

export interface InstantAnswerItem {
  slug: string
  title: string
  description: string
  snippet: string
  articleType?: string
  score: number
  keywords: string[]
  domains: string[]
}

export interface ShipAnswerSection {
  id: string
  title: string
  body: string
  tone: 'summary' | 'insight' | 'detail' | 'next-step'
  sourceSlug?: string
}

export interface ShipAnswerDiagramNode {
  id: string
  label: string
  detail: string
  weight: number
  tone: 'core' | 'supporting' | 'source'
  sourceSlug?: string
}

export interface ShipStructuredAnswer {
  mode: ShipAnswerMode
  headline: string
  kicker?: string
  summary: string
  sections: ShipAnswerSection[]
  quickFacts: string[]
  suggestedActions: string[]
  diagram: {
    title: string
    nodes: ShipAnswerDiagramNode[]
  }
}

export interface ShipAnswerState {
  question: string
  response: string
  instantResults: InstantAnswerItem[]
  structuredAnswer: ShipStructuredAnswer | null
  status: 'idle' | 'loading' | 'complete' | 'error'
  provider?: string
}

export interface ShipInstantResultsEvent {
  type: 'instant-results'
  question: string
  items: InstantAnswerItem[]
}

export interface ShipAnswerDeltaEvent {
  type: 'answer-delta'
  question: string
  delta: string
  answer: string
}

export interface ShipFinalAnswerEvent {
  type: 'final-answer'
  question: string
  answer: string
  structuredAnswer: ShipStructuredAnswer
  provider?: string
  signals?: ShipSignal[]
}

export interface ShipErrorEvent {
  type: 'error'
  message: string
}

export type ShipStreamEvent =
  | ShipInstantResultsEvent
  | ShipAnswerDeltaEvent
  | ShipFinalAnswerEvent
  | ShipErrorEvent

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function stripMarkdownMarkers(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
}

function stripLeadInLabel(value: string): string {
  return value.replace(/^(verdict|summary|key aspects|why it matters|product|technical|narrative|next steps?|let'?s break down)\s*:?\s*/i, '')
}

export function cleanPresentationText(value: string): string {
  return normalizeWhitespace(stripLeadInLabel(stripMarkdownMarkers(value)))
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function cleanSectionTitle(value: string, fallbackBody: string, index: number): string {
  const cleaned = cleanPresentationText(value).replace(/[.:;,]+$/g, '')
  const source = cleaned || cleanPresentationText(fallbackBody)
  if (!source) {
    return `Section ${index + 1}`
  }

  const words = source.split(' ').filter(Boolean)
  const candidate = words.slice(0, 6).join(' ')
  const longSentence = source.length > 54 || /[.!?]/.test(source)
  const normalized = longSentence ? candidate : source
  return toTitleCase(normalized.replace(/[.!?].*$/, '').trim()) || `Section ${index + 1}`
}

function dedupeFacts(facts: string[], summary: string): string[] {
  const seen = new Set<string>()
  const normalizedSummary = cleanPresentationText(summary).toLowerCase()

  return facts.filter((fact) => {
    const cleaned = cleanPresentationText(fact)
    const key = cleaned.toLowerCase()
    if (!cleaned || key === normalizedSummary || seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function createHeadline(summary: string, mode: ShipAnswerMode): string {
  const cleaned = cleanPresentationText(summary)
  const words = cleaned.split(' ').filter(Boolean).slice(0, mode === 'brief' ? 5 : 6)
  if (words.length === 0) {
    return 'Ship AI Answer'
  }
  return toTitleCase(words.join(' ').replace(/[.!?].*$/, '').trim())
}

function isWeakSummary(value: string): boolean {
  const cleaned = cleanPresentationText(value).toLowerCase()
  return (
    !cleaned ||
    cleaned === 'let s break it down' ||
    cleaned === 'lets break it down' ||
    cleaned === 'let us break it down' ||
    cleaned === 'here s the answer' ||
    cleaned === 'heres the answer'
  )
}

function fallbackSummary(
  summary: string,
  quickFacts: string[],
  sections: ShipAnswerSection[],
  fallback: string,
): string {
  if (!isWeakSummary(summary)) {
    return cleanPresentationText(summary)
  }

  return (
    quickFacts.find((fact) => !isWeakSummary(fact)) ||
    sections.map((section) => section.body).find((body) => !isWeakSummary(body)) ||
    cleanPresentationText(fallback)
  )
}

function createKicker(summary: string, mode: ShipAnswerMode): string {
  if (mode === 'roast') {
    return 'Pressure-testing the idea without padding.'
  }
  if (mode === 'map') {
    return 'A systems-level read across strategy, execution, and narrative.'
  }
  if (mode === 'brief') {
    return 'Condensed for fast decisions.'
  }
  if (mode === 'mission') {
    return 'Turn the answer into an actionable next move.'
  }
  return cleanPresentationText(summary).slice(0, 120)
}

function canonicalSectionTitles(mode: ShipAnswerMode): string[] | null {
  if (mode === 'brief') {
    return ['Verdict', 'Key Signal', 'Why It Matters', 'Next Watchpoint']
  }
  if (mode === 'map') {
    return ['Product', 'Technical', 'Narrative', 'Operator View']
  }
  if (mode === 'roast') {
    return ['Weak Spot', 'Biggest Risk', 'Fix Next', 'What To Stop']
  }
  if (mode === 'mission') {
    return ['Objective', 'First Move', 'Second Move', 'Finish Line']
  }
  if (mode === 'compare') {
    return ['Similarities', 'Differences', 'Best Choice', 'Why']
  }
  if (mode === 'signal') {
    return ['Top Signal', 'Second Signal', 'Third Signal', 'What Matters']
  }
  return null
}

function normalizeSectionTitlesByMode(
  sections: ShipAnswerSection[],
  mode: ShipAnswerMode,
): ShipAnswerSection[] {
  const canonical = canonicalSectionTitles(mode)
  if (!canonical) {
    return sections
  }

  return sections.map((section, index) => ({
    ...section,
    title: canonical[index] || section.title,
    id: createSlugId(canonical[index] || section.title, 'section', index),
  }))
}

function normalizeHeadlineByMode(headline: string, summary: string, mode: ShipAnswerMode): string {
  const cleaned = cleanPresentationText(headline)
  if (mode === 'brief') return 'Executive Brief'
  if (mode === 'map') return 'Systems Map'
  if (mode === 'roast') return 'Pressure Test'
  if (mode === 'mission') return 'Mission Plan'
  if (mode === 'signal') return 'High Signal'
  if (mode === 'compare') return 'Head To Head'
  if (!cleaned || isWeakSummary(cleaned)) {
    return createHeadline(summary, mode)
  }
  return cleaned
}

function normalizeNodeLabelsByMode(
  nodes: ShipAnswerDiagramNode[],
  sections: ShipAnswerSection[],
  mode: ShipAnswerMode,
): ShipAnswerDiagramNode[] {
  const canonical = canonicalSectionTitles(mode)
  const summaryNode = nodes[0]
    ? {
        ...nodes[0],
        label: mode === 'map' ? 'Core Thesis' : 'Summary',
        id: createSlugId(mode === 'map' ? 'Core Thesis' : 'Summary', 'node', 0),
      }
    : {
        id: 'node-summary',
        label: mode === 'map' ? 'Core Thesis' : 'Summary',
        detail: sections[0]?.body || '',
        weight: 1,
        tone: 'core' as const,
      }

  const sectionNodes = sections.slice(0, canonical ? canonical.length : 4).map((section, index) => {
    const node = nodes[index + 1]
    const label = canonical?.[index] || section.title
    return {
      id: createSlugId(label, 'node', index + 1),
      label,
      detail: node?.detail || section.body,
      weight: node?.weight ?? Math.max(0.35, 0.92 - index * 0.12),
      tone: node?.tone ?? (index < 2 ? 'supporting' : 'source'),
      sourceSlug: node?.sourceSlug ?? section.sourceSlug,
    }
  })

  const fallbackNodes = !canonical
    ? nodes
      .slice(sectionNodes.length + 1, 5)
      .map((node, index) => ({
        ...node,
        id: createSlugId(node.label, 'node', sectionNodes.length + index + 1),
        label: cleanSectionTitle(node.label, node.detail, index),
      }))
    : []

  return [summaryNode, ...sectionNodes, ...fallbackNodes].slice(0, 5)
}

function finalizeStructuredAnswer(answer: ShipStructuredAnswer, fallbackText: string): ShipStructuredAnswer {
  const normalizedSections = normalizeSectionTitlesByMode(answer.sections, answer.mode)
  const normalizedSummary = fallbackSummary(answer.summary, answer.quickFacts, normalizedSections, fallbackText)
  const normalizedFacts = dedupeFacts(answer.quickFacts, normalizedSummary)
  const normalizedHeadline = normalizeHeadlineByMode(answer.headline, normalizedSummary, answer.mode)
  const normalizedNodes = normalizeNodeLabelsByMode(answer.diagram.nodes, normalizedSections, answer.mode)

  return {
    ...answer,
    headline: normalizedHeadline,
    kicker: answer.kicker || createKicker(normalizedSummary, answer.mode),
    summary: normalizedSummary,
    sections: normalizedSections,
    quickFacts: normalizedFacts,
    diagram: {
      ...answer.diagram,
      title: answer.mode === 'map' ? 'Systems Map' : answer.diagram.title,
      nodes: normalizedNodes,
    },
  }
}

function createSlugId(value: string, prefix: string, index: number): string {
  const slug = cleanPresentationText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug ? `${prefix}-${slug}` : `${prefix}-${index + 1}`
}

function titleFromContent(content: string, index: number): string {
  const headingMatch = content.match(/^#{1,6}\s+(.+)$/m)
  if (headingMatch) {
    return cleanPresentationText(headingMatch[1])
  }

  const sentenceMatch = cleanPresentationText(content).match(/^([^.!?]{8,80}[.!?]?)/)
  if (sentenceMatch) {
    return sentenceMatch[1]
  }

  return `Section ${index + 1}`
}

function inferTone(title: string, body: string, index: number): ShipAnswerSection['tone'] {
  const value = `${title} ${body}`.toLowerCase()

  if (index === 0) return 'summary'
  if (value.includes('next step') || value.includes('recommend') || value.includes('should')) {
    return 'next-step'
  }
  if (value.includes('key') || value.includes('insight') || value.includes('important')) {
    return 'insight'
  }

  return 'detail'
}

function splitSentences(value: string): string[] {
  return cleanPresentationText(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter(Boolean)
}

function extractBulletLines(markdown: string): string[] {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => cleanPresentationText(line.replace(/^[-*]\s+/, '')))
}

function buildSections(markdown: string): ShipAnswerSection[] {
  const normalized = markdown.trim()
  if (!normalized) return []

  const blocks = normalized
    .split(/\n\s*\n+/)
    .map((block) => cleanPresentationText(block.trim()))
    .filter(Boolean)

  return blocks.slice(0, 6).map((block, index) => {
    const title = cleanSectionTitle(titleFromContent(block, index), block, index)
    return {
      id: createSlugId(title, 'section', index),
      title,
      body: block,
      tone: inferTone(title, block, index),
    }
  })
}

function buildQuickFacts(markdown: string, sections: ShipAnswerSection[]): string[] {
  const bullets = extractBulletLines(markdown)
  if (bullets.length > 0) {
    return bullets.slice(0, 4)
  }

  return sections
    .flatMap((section) => splitSentences(section.body))
    .slice(0, 4)
}

function buildSuggestedActions(markdown: string, sections: ShipAnswerSection[]): string[] {
  const matches = markdown
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter((line) => /\b(next|consider|focus|try|build|ship|start)\b/i.test(line))

  if (matches.length > 0) {
    return matches.slice(0, 3)
  }

  return sections
    .filter((section) => section.tone === 'next-step' || section.tone === 'insight')
    .map((section) => splitSentences(section.body)[0] || section.body)
    .filter(Boolean)
    .slice(0, 3)
}

export function buildStructuredAnswer(markdown: string, mode: ShipAnswerMode = 'default'): ShipStructuredAnswer {
  const sections = buildSections(markdown)
  const summary = splitSentences(markdown)[0] || cleanPresentationText(markdown).slice(0, 180)
  const quickFacts = dedupeFacts(buildQuickFacts(markdown, sections), summary)
  const suggestedActions = buildSuggestedActions(markdown, sections)

  const nodes = [
    {
      id: 'summary',
      label: 'Summary',
      detail: summary,
      weight: 1,
      tone: 'core' as const,
    },
    ...sections.slice(0, 5).map((section, index) => ({
      id: section.id,
      label: section.title,
      detail: splitSentences(section.body)[0] || section.body,
      weight: Math.max(0.35, 0.92 - index * 0.12),
      tone: index < 2 ? ('supporting' as const) : ('source' as const),
    })),
  ]

  return finalizeStructuredAnswer({
    mode,
    headline: createHeadline(summary, mode),
    kicker: createKicker(summary, mode),
    summary,
    sections,
    quickFacts,
    suggestedActions,
    diagram: {
      title: 'Ship AI Answer Map',
      nodes,
    },
  }, markdown)
}

function extractFirstJsonObject(value: string): string | null {
  const input = value.trim()
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') {
      if (depth === 0) {
        start = index
      }
      depth += 1
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0 && start >= 0) {
        return input.slice(start, index + 1)
      }
    }
  }

  return null
}

function clampWeight(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }

  return Math.min(1, Math.max(0.15, value))
}

function normalizeTone<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

export function parseStructuredAnswerResponse(
  raw: string,
  fallbackAnswer: string,
  instantResults: InstantAnswerItem[] = [],
  mode: ShipAnswerMode = 'default',
): ShipStructuredAnswer {
  const jsonObject = extractFirstJsonObject(raw)
  if (!jsonObject) {
    return buildStructuredAnswer(fallbackAnswer, mode)
  }

  try {
    const parsed = JSON.parse(jsonObject) as Record<string, unknown>
    const fallback = buildStructuredAnswer(fallbackAnswer, mode)
    const allowedSlugs = new Set(instantResults.map((item) => item.slug))

    const sectionsInput = Array.isArray(parsed.sections) ? parsed.sections : []
    const sections = sectionsInput
      .map((entry, index): ShipAnswerSection | null => {
        if (!entry || typeof entry !== 'object') return null
        const record = entry as Record<string, unknown>
        const rawTitle = typeof record.title === 'string' ? record.title : ''
        const body = typeof record.body === 'string' ? cleanPresentationText(record.body) : ''
        const title = cleanSectionTitle(rawTitle, body, index)
        const sourceSlug =
          typeof record.sourceSlug === 'string' && allowedSlugs.has(record.sourceSlug)
            ? record.sourceSlug
            : undefined

        if (!title || !body) return null

        return {
          id: createSlugId(title, 'section', index),
          title,
          body,
          tone: normalizeTone(record.tone, ['summary', 'insight', 'detail', 'next-step'] as const, inferTone(title, body, index)),
          sourceSlug,
        }
      })
      .filter((entry): entry is ShipAnswerSection => Boolean(entry))

    const quickFacts = Array.isArray(parsed.quickFacts)
      ? parsed.quickFacts.filter((item): item is string => typeof item === 'string').map(cleanPresentationText).filter(Boolean).slice(0, 4)
      : fallback.quickFacts

    const suggestedActions = Array.isArray(parsed.suggestedActions)
      ? parsed.suggestedActions.filter((item): item is string => typeof item === 'string').map(cleanPresentationText).filter(Boolean).slice(0, 3)
      : fallback.suggestedActions

    const diagramInput = parsed.diagram && typeof parsed.diagram === 'object'
      ? (parsed.diagram as Record<string, unknown>)
      : null
    const nodeInput = Array.isArray(diagramInput?.nodes) ? diagramInput?.nodes : []
    const nodes = nodeInput
      .map((entry, index): ShipAnswerDiagramNode | null => {
        if (!entry || typeof entry !== 'object') return null
        const record = entry as Record<string, unknown>
        const label = typeof record.label === 'string' ? cleanPresentationText(record.label) : ''
        const detail = typeof record.detail === 'string' ? cleanPresentationText(record.detail) : ''
        const sourceSlug =
          typeof record.sourceSlug === 'string' && allowedSlugs.has(record.sourceSlug)
            ? record.sourceSlug
            : undefined

        if (!label || !detail) return null

        return {
          id: createSlugId(label, 'node', index),
          label,
          detail,
          weight: clampWeight(record.weight, Math.max(0.35, 0.92 - index * 0.12)),
          tone: normalizeTone(record.tone, ['core', 'supporting', 'source'] as const, index === 0 ? 'core' : 'supporting'),
          sourceSlug,
        }
      })
      .filter((entry): entry is ShipAnswerDiagramNode => Boolean(entry))

    return finalizeStructuredAnswer({
      mode: normalizeTone(parsed.mode, ['default', 'brief', 'signal', 'map', 'roast', 'compare', 'mission'] as const, mode),
      headline:
        typeof parsed.headline === 'string' && cleanPresentationText(parsed.headline)
          ? cleanPresentationText(parsed.headline)
          : fallback.headline,
      kicker:
        typeof parsed.kicker === 'string' && cleanPresentationText(parsed.kicker)
          ? cleanPresentationText(parsed.kicker)
          : fallback.kicker,
      summary:
        typeof parsed.summary === 'string' && cleanPresentationText(parsed.summary)
          ? cleanPresentationText(parsed.summary)
          : fallback.summary,
      sections: sections.length > 0 ? sections : fallback.sections,
      quickFacts: dedupeFacts(quickFacts.length > 0 ? quickFacts : fallback.quickFacts, typeof parsed.summary === 'string' ? cleanPresentationText(parsed.summary) : fallback.summary),
      suggestedActions: suggestedActions.length > 0 ? suggestedActions : fallback.suggestedActions,
      diagram: {
        title:
          typeof diagramInput?.title === 'string' && cleanPresentationText(diagramInput.title)
            ? cleanPresentationText(diagramInput.title)
            : fallback.diagram.title,
        nodes: nodes.length > 0 ? nodes : fallback.diagram.nodes,
      },
    }, fallbackAnswer)
  } catch {
    return buildStructuredAnswer(fallbackAnswer, mode)
  }
}

export function createIdleAnswerState(idleMessage: string): ShipAnswerState {
  return {
    question: '',
    response: idleMessage,
    instantResults: [],
    structuredAnswer: null,
    status: 'idle',
  }
}

export function parseShipStreamEvent(value: string): ShipStreamEvent | null {
  try {
    const parsed = JSON.parse(value) as ShipStreamEvent
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}