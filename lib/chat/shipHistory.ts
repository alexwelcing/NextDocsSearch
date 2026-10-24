// Ship conversation history → model messages for /api/vector-search. History is untrusted
// client input: ShipTab (shipClient.ts) sends {role, content}; older clients sent
// {question, response} pairs.

import type { HfChatMessage } from '@/lib/ai/huggingface'
import { resolveShipTrick } from '@/lib/ai/shipTricks'

export const HISTORY_MAX_MESSAGES = 8
export const HISTORY_MAX_CHARS = 1200

/** Lead-ins of the replies the route writes itself when the model can't answer. */
export const ARCHIVE_FALLBACK_LEAD = 'Generative link offline'
export const SYSTEM_FAULT_LEAD = 'Ship systems fault'

/** Fields are unknown until validated. */
export interface ChatHistoryEntry {
  role?: unknown
  content?: unknown
  question?: unknown
  response?: unknown
}

function toHistoryMessage(role: 'user' | 'assistant', content: unknown): HfChatMessage[] {
  if (typeof content !== 'string') return []
  const trimmed = content.trim().slice(0, HISTORY_MAX_CHARS)
  return trimmed ? [{ role, content: trimmed }] : []
}

function isRouteReply(content: string): boolean {
  return content.startsWith(ARCHIVE_FALLBACK_LEAD) || content.startsWith(SYSTEM_FAULT_LEAD)
}

/** Some replies come from the route, not the model: the archive fallback, the fault notice and
 *  the text/plain trick listings (/help, /tricks, unknown commands). Replaying them would tell
 *  the model it said them, so each is dropped along with the question it answered. */
function dropRouteReplies(messages: HfChatMessage[]): HfChatMessage[] {
  const kept: HfChatMessage[] = []
  let dropReply = false

  for (const message of messages) {
    if (message.role === 'user') {
      dropReply = Boolean(resolveShipTrick(message.content).helpResponse)
      if (!dropReply) kept.push(message)
      continue
    }

    if (dropReply) {
      dropReply = false
      continue
    }

    if (isRouteReply(message.content)) {
      if (kept[kept.length - 1]?.role === 'user') kept.pop()
      continue
    }

    kept.push(message)
  }

  return kept
}

/** The newest HISTORY_MAX_MESSAGES user/assistant turns, each capped at HISTORY_MAX_CHARS.
 *  Client-supplied 'system' turns and malformed entries are dropped before the cap is applied,
 *  so junk can't crowd out real turns. */
export function buildHistoryMessages(history: unknown): HfChatMessage[] {
  if (!Array.isArray(history)) return []

  const messages = history.flatMap((entry: unknown): HfChatMessage[] => {
    if (!entry || typeof entry !== 'object') return []
    const { role, content, question, response } = entry as ChatHistoryEntry

    if (role === 'user' || role === 'assistant') {
      return toHistoryMessage(role, content)
    }

    return [...toHistoryMessage('user', question), ...toHistoryMessage('assistant', response)]
  })

  return dropRouteReplies(messages).slice(-HISTORY_MAX_MESSAGES)
}
