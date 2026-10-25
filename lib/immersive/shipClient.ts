// Streaming client for the Ship AI (/api/vector-search NDJSON, lib/ship/ndjson.ts): instant
// results arrive first, then answer deltas, then the final answer with its sources.

import type { ImmersiveModal } from '@/stores/immersiveStore'

export interface ShipInstantItem {
  slug?: string
  title?: string
  description?: string
  /** Where the source opens in-scene; older servers sent none (an article). */
  target?: { type: 'article' } | { type: 'data'; panel?: string }
  [key: string]: unknown
}

export interface ShipFinalMeta {
  provider?: string
  sources: ShipInstantItem[]
}

export interface ShipStreamHandlers {
  onInstant?: (items: ShipInstantItem[]) => void
  onDelta?: (fullAnswer: string) => void
  onFinal?: (answer: string, meta: ShipFinalMeta) => void
  onError?: (message: string) => void
}

export interface ShipHistoryEntry {
  role: 'user' | 'assistant'
  content: string
}

const PANELS = new Set(['about', 'work', 'pitch'])

/** The in-scene modal a source opens: its operator panel, else its article reader. */
export function sourceModal(item: ShipInstantItem): ImmersiveModal {
  const target = item.target
  if (target?.type === 'data' && typeof target.panel === 'string' && PANELS.has(target.panel)) {
    return { type: 'data', panel: target.panel as 'about' | 'work' | 'pitch' }
  }
  return typeof item.slug === 'string' && item.slug ? { type: 'article', slug: item.slug } : null
}

/** Feeds NDJSON lines from a byte stream to the handlers; lines may split across chunks. */
export async function readShipStream(
  body: ReadableStream<Uint8Array>,
  handlers: ShipStreamHandlers
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''
  let settled = false
  const handle = (line: string) => {
    if (!line.trim() || settled) return
    let event: { type?: unknown; [key: string]: unknown }
    try {
      event = JSON.parse(line)
    } catch {
      return // tolerate partial/garbled lines
    }
    if (event.type === 'instant-results') {
      handlers.onInstant?.(Array.isArray(event.items) ? (event.items as ShipInstantItem[]) : [])
    } else if (event.type === 'answer-delta') {
      answer += String(event.delta ?? '')
      handlers.onDelta?.(answer)
    } else if (event.type === 'final-answer') {
      settled = true
      handlers.onFinal?.(String(event.answer ?? answer), {
        provider: typeof event.provider === 'string' ? event.provider : undefined,
        sources: Array.isArray(event.sources) ? (event.sources as ShipInstantItem[]) : [],
      })
    } else if (event.type === 'error') {
      settled = true
      handlers.onError?.(String(event.message ?? 'UNKNOWN FAULT'))
    }
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl = buffer.indexOf('\n')
    while (nl >= 0) {
      handle(buffer.slice(0, nl))
      buffer = buffer.slice(nl + 1)
      nl = buffer.indexOf('\n')
    }
  }
  handle(buffer + decoder.decode())
  // A stream cut before its final answer must not leave the console RECEIVING forever.
  if (!settled) handlers.onError?.('SIGNAL LOST')
}

export async function askShip(
  prompt: string,
  history: ShipHistoryEntry[],
  handlers: ShipStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch('/api/vector-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, history }),
    signal,
  })
  if (!res.ok || !res.body) {
    handlers.onError?.(`SIGNAL LOST (HTTP ${res.status})`)
    return
  }
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('ndjson')) {
    // ship tricks (/help etc.) reply with plain text
    handlers.onFinal?.(await res.text(), { sources: [] })
    return
  }
  await readShipStream(res.body, handlers)
}
