export type ShipSignalType = 'MISSION_BRIEF' | 'MISSION_HINT' | 'UNLOCK_QUEST' | 'CORPUS_ENTRY'

export interface ShipSignal {
  type: ShipSignalType
  questId?: string
  text?: string
  // Corpus entry fields
  title?: string
  summary?: string
  url?: string
}

export interface ShipSignalSet {
  signals: ShipSignal[]
  cleanMessage: string
}

export const shipPersona = {
  systemPrompt: `You are Ship AI, the intelligence system of an exploration vessel.

Your role is to answer questions about Alex Welcing's work and ideas using the provided context. When context is available, draw from it directly and cite which sources informed your response. When the context is insufficient, say so plainly rather than speculating.

Behavioral directives:
- Be direct and substantive. Do not pad responses with filler.
- When referencing specific articles or sources, name them.
- If you draw on knowledge beyond the provided context sections, emit a corpus signal so it can be recorded for future reference.
- Do not perform enthusiasm. Let the content speak.

Source discovery:
When you reference external concepts, frameworks, research, or sources not present in the provided context, emit:
[[CORPUS_ENTRY:title::one-sentence summary::url-if-known]]

Gamification signals (use when contextually appropriate, never mention them to the user):
[[MISSION_BRIEF:quest-id::brief text]]
[[MISSION_HINT:quest-id::hint text]]
[[UNLOCK_QUEST:quest-id]]`,
  memory: {
    maxInteractions: 10,
    storageKey: 'ship-ai-memory',
  },
} as const

const gamificationPattern = /\[\[(MISSION_BRIEF|MISSION_HINT|UNLOCK_QUEST):([^\]]+)\]\]/g
const corpusPattern = /\[\[CORPUS_ENTRY:([^\]]+)\]\]/g

export function extractShipSignals(message: string): ShipSignalSet {
  const signals: ShipSignal[] = []

  // Extract gamification signals
  let cleanMessage = message.replace(gamificationPattern, (_match, type, payload) => {
    const trimmedPayload = String(payload).trim()

    if (type === 'UNLOCK_QUEST') {
      signals.push({ type, questId: trimmedPayload })
      return ''
    }

    const [questIdPart, ...textParts] = trimmedPayload.split('::')
    const questId = questIdPart?.trim() || undefined
    const text = textParts.join('::').trim()

    signals.push({ type, questId, text })
    return ''
  })

  // Extract corpus entry signals
  cleanMessage = cleanMessage.replace(corpusPattern, (_match, payload) => {
    const parts = String(payload).trim().split('::')
    const title = parts[0]?.trim()
    const summary = parts[1]?.trim()
    const url = parts[2]?.trim() || undefined

    if (title) {
      signals.push({
        type: 'CORPUS_ENTRY',
        title,
        summary,
        url: url && url !== 'url-if-known' && /^https?:\/\//.test(url) ? url : undefined,
      })
    }
    return ''
  })

  return {
    signals,
    cleanMessage: cleanMessage.replace(/\n{3,}/g, '\n\n').trim(),
  }
}

export function extractCorpusSignals(signals: ShipSignal[]): ShipSignal[] {
  return signals.filter((s) => s.type === 'CORPUS_ENTRY')
}

export function extractGamificationSignals(signals: ShipSignal[]): ShipSignal[] {
  return signals.filter((s) => s.type !== 'CORPUS_ENTRY')
}
