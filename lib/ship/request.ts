// Ship request validation. The body is untrusted: anything malformed is a 4xx, never a 500.
import { HISTORY_MAX_MESSAGES } from '../chat/shipHistory'

export const SHIP_LIMITS = {
  promptChars: 400,
  bodyBytes: 32 * 1024,
  /** Entries accepted before buildHistoryMessages keeps the newest HISTORY_MAX_MESSAGES. Legacy
   *  clients send {question, response} pairs, and handler-written replies are dropped first. */
  historyEntries: HISTORY_MAX_MESSAGES * 4,
}

/** 'answer' streams a generated (or extractive) answer; 'retrieve' stops after the results. */
export type ShipMode = 'answer' | 'retrieve'

export interface ShipRequest {
  prompt: string
  /** Raw entries, validated turn by turn in lib/chat/shipHistory.ts. */
  history: unknown[]
  mode: ShipMode
}

export type ShipRequestResult =
  | { ok: true; value: ShipRequest }
  | { ok: false; status: number; error: string; headers?: Record<string, string> }

const reject = (
  status: number,
  error: string,
  headers?: Record<string, string>
): ShipRequestResult => ({ ok: false, status, error, headers })

export async function readShipRequest(request: Request): Promise<ShipRequestResult> {
  if (request.method !== 'POST') return reject(405, 'Method not allowed', { Allow: 'POST' })
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > SHIP_LIMITS.bodyBytes) return reject(413, 'Request body too large')
  let text: string
  try {
    text = await request.text()
  } catch {
    return reject(400, 'Unreadable request body')
  }
  if (new TextEncoder().encode(text).byteLength > SHIP_LIMITS.bodyBytes) {
    return reject(413, 'Request body too large')
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return reject(400, 'Request body must be JSON')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reject(400, 'Request body must be a JSON object')
  }
  const { prompt, history = [], mode = 'answer' } = body as Record<string, unknown>
  if (typeof prompt !== 'string' || !prompt.trim()) return reject(400, 'Missing prompt')
  if (prompt.trim().length > SHIP_LIMITS.promptChars) {
    return reject(400, `Prompt is longer than ${SHIP_LIMITS.promptChars} characters`)
  }
  if (history !== null && !Array.isArray(history)) return reject(400, 'History must be an array')
  if (Array.isArray(history) && history.length > SHIP_LIMITS.historyEntries) {
    return reject(400, `History has more than ${SHIP_LIMITS.historyEntries} entries`)
  }
  if (mode !== 'answer' && mode !== 'retrieve') {
    return reject(400, "Mode must be 'answer' or 'retrieve'")
  }
  return { ok: true, value: { prompt: prompt.trim(), history: history ?? [], mode } }
}
