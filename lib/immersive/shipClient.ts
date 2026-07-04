// Streaming client for the Ship AI (/api/vector-search NDJSON): instant results arrive first,
// then answer deltas, then the final structured answer.

export interface ShipInstantItem {
  slug?: string
  title?: string
  description?: string
  [key: string]: unknown
}

export interface ShipStreamHandlers {
  onInstant?: (items: ShipInstantItem[]) => void
  onDelta?: (fullAnswer: string) => void
  onFinal?: (answer: string) => void
  onError?: (message: string) => void
}

export interface ShipHistoryEntry {
  role: 'user' | 'assistant'
  content: string
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
    const text = await res.text()
    handlers.onFinal?.(text)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl = buffer.indexOf('\n')
    while (nl >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      nl = buffer.indexOf('\n')
      if (!line) continue
      try {
        const event = JSON.parse(line) as { type: string; [key: string]: unknown }
        if (event.type === 'instant-results') {
          handlers.onInstant?.((event.items as ShipInstantItem[]) ?? [])
        } else if (event.type === 'answer-delta') {
          answer += String(event.delta ?? '')
          handlers.onDelta?.(answer)
        } else if (event.type === 'final-answer') {
          handlers.onFinal?.(String(event.answer ?? answer))
        } else if (event.type === 'error') {
          handlers.onError?.(String(event.message ?? 'UNKNOWN FAULT'))
        }
      } catch {
        // tolerate partial/garbled lines
      }
    }
  }
}
