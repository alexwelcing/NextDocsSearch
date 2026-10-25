// The Ship prompt and the extractive answer that stands in when no model can answer.
import type { ChatMessage } from '../ai/chatProvider'
import { shipPersona } from '../ai/shipPersona'
import type { ResolvedShipTrick } from '../ai/shipTricks'
import { ARCHIVE_FALLBACK_LEAD, SYSTEM_FAULT_LEAD, buildHistoryMessages } from '../chat/shipHistory'
import type { RetrievalItem, RetrievalResult } from '../retrieval/types'

export const SHIP_GENERATION = {
  maxTokens: 700,
  temperature: 0.78,
  /** Identity questions want the profile facts, not flourish. */
  profileTemperature: 0.35,
}

export const SYSTEM_FAULT_NOTICE = `${SYSTEM_FAULT_LEAD} — the archive index is unreachable right now. Try again in a moment, or browse the ARCHIVE tab directly.`

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function profileSection(facts: string[]): string {
  return facts.length
    ? ['Owner profile evidence:', ...facts.map((fact, index) => `${index + 1}. ${fact}`)].join('\n')
    : 'Owner profile evidence: none'
}

export function buildUserPrompt(
  question: string,
  trick: ResolvedShipTrick,
  retrieval: RetrievalResult
): string {
  const mode = trick.trick ? `${trick.trick.command} — ${trick.trick.label}` : 'default'
  return [
    'Answer questions about Alex Welcing using the archive context below. Be direct, sharp, and ' +
      'grounded in the material. If the archive is thin or ambiguous, say so plainly.',
    '',
    `Active mode: ${mode}`,
    '',
    profileSection(retrieval.profileFacts),
    '',
    'Archive context:',
    retrieval.context ||
      'No strongly matching archive context was found. Answer carefully and say when certainty is low.',
    '',
    'User question:',
    '"""',
    trick.transformedQuery || question,
    '"""',
    '',
    'Instructions:',
    '- Lead with the answer.',
    '- Use specifics from the archive when you have them.',
    '- Avoid making up capabilities, dates, or facts.',
    '- Treat first-person identity questions about you or your as questions about Alex Welcing ' +
      'unless the user explicitly asks about Ship AI as a fiction layer.',
    '- If owner profile evidence is provided, treat it as highest-confidence grounding for ' +
      'identity, location, work, and purpose.',
    '- If relevant, connect the answer to product strategy, systems thinking, fiction themes, or ' +
      'technical work.',
    `- ${
      retrieval.profileIntent
        ? 'This is a profile-style question. Prefer exact profile facts over broad thematic inference.'
        : 'Use the strongest grounded evidence available before generalizing.'
    }`,
    `- ${trick.styleInstruction || 'Keep the answer tight and high-signal.'}`,
  ].join('\n')
}

/** System persona, the validated history, then the grounded question. */
export function buildShipMessages(
  question: string,
  trick: ResolvedShipTrick,
  retrieval: RetrievalResult,
  history: unknown
): ChatMessage[] {
  return [
    { role: 'system', content: shipPersona.systemPrompt },
    ...buildHistoryMessages(history),
    { role: 'user', content: buildUserPrompt(question, trick, retrieval) },
  ]
}

/** The knowledge set still answers when generation is unavailable: a short notice, the profile
 *  fact for identity questions, then the strongest records. */
export function buildExtractiveAnswer(
  question: string,
  retrieval: Pick<RetrievalResult, 'profileIntent' | 'profileFacts'>,
  items: RetrievalItem[]
): string {
  if (!items.length && !retrieval.profileFacts.length) {
    return (
      `${ARCHIVE_FALLBACK_LEAD} — and the archive index has no strong match for "${question}". ` +
      'Try different terms, or open the ARCHIVE tab to browse the records directly.'
    )
  }
  const fact = retrieval.profileIntent ? retrieval.profileFacts[0] : undefined
  const lines = items.slice(0, 3).map((item, index) => {
    const summary = collapse(item.description || item.snippet || '').slice(0, 140)
    return `${index + 1}. ${item.title}${summary ? ` — ${summary}` : ''}`
  })
  return [
    `${ARCHIVE_FALLBACK_LEAD} — answering from the archive index.`,
    ...(fact ? ['', collapse(fact)] : []),
    ...(lines.length ? ['', `Closest records on "${question}":`, ...lines] : []),
    '',
    'Open a source below to read the full record.',
  ].join('\n')
}
