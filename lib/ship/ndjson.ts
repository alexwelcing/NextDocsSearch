// The Ship wire protocol: one JSON event per line on a Web stream, so the same writer runs on the
// Worker and behind the Node adapter. Order: instant-results, answer-delta*, final-answer.
import type { RetrievalItem, RetrievalMode, RetrievalTarget } from '../retrieval/types'

/** A cited record: always a real article slug or operator id, with where it opens in-scene. */
export interface ShipSource {
  slug: string
  title: string
  heading: string
  target: RetrievalTarget
}

export interface ShipInstantResultsEvent {
  type: 'instant-results'
  question: string
  /** Which retrieval rung answered: hybrid, lexical, records or none. */
  retrieval: RetrievalMode
  items: RetrievalItem[]
}

/** Only the new text: the client accumulates it (the cumulative answer field is gone). */
export interface ShipAnswerDeltaEvent {
  type: 'answer-delta'
  delta: string
}

export interface ShipFinalAnswerEvent {
  type: 'final-answer'
  question: string
  answer: string
  /** '<provider>:<model>' for a generated answer, 'local-archive' for the extractive one. */
  provider: string
  sources: ShipSource[]
}

/** A stream-level fault before any final answer; never sent after one. */
export interface ShipErrorEvent {
  type: 'error'
  message: string
}

export type ShipEvent =
  | ShipInstantResultsEvent
  | ShipAnswerDeltaEvent
  | ShipFinalAnswerEvent
  | ShipErrorEvent

export const NDJSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/x-ndjson; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Accel-Buffering': 'no',
}

export interface NdjsonStream {
  readable: ReadableStream<Uint8Array>
  /** Queue an event; resolves once it is written or the client has gone. Never rejects. */
  send(event: ShipEvent): Promise<void>
  close(): Promise<void>
  /** Aborts when a write fails, i.e. the client went away: stop generating. */
  signal: AbortSignal
  readonly finalSent: boolean
}

/**
 * Writes are chained, so events keep their order however they are queued. Nothing is written
 * after the final answer: an event after success once made the client flip a finished answer to
 * a fault.
 */
export function createNdjsonStream(): NdjsonStream {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  const gone = new AbortController()
  let tail: Promise<void> = Promise.resolve()
  let finalSent = false
  return {
    readable,
    send(event) {
      if (finalSent || gone.signal.aborted) return tail
      if (event.type === 'final-answer') finalSent = true
      const line = encoder.encode(`${JSON.stringify(event)}\n`)
      tail = tail.then(() => writer.write(line)).catch(() => gone.abort())
      return tail
    },
    close() {
      tail = tail.then(() => writer.close()).catch(() => undefined)
      return tail
    },
    signal: gone.signal,
    get finalSent() {
      return finalSent
    },
  }
}
