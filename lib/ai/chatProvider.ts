// The chat contract the Ship handler streams through, shared by every target: Workers AI on the
// Worker, the Hugging Face router on Vercel. Also the pieces both providers need: the SSE reader,
// a delta extractor that accepts either wire shape, a reasoning filter, and a failover ladder.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  maxTokens: number
  temperature: number
  /** Visible answer text only: reasoning never reaches this callback. */
  onDelta: (delta: string) => void
  signal?: AbortSignal
}

export interface ChatResult {
  text: string
  /** '<provider>:<model>', e.g. 'workers-ai:@cf/google/gemma-4-26b-a4b-it'. */
  provider: string
}

export interface ChatProvider {
  /** Stream one completion; rejects only when no model produced an answer. */
  stream(request: ChatRequest): Promise<ChatResult>
}

/** A model failed after part of its answer already streamed, so it cannot be retried silently. */
export class ChatStreamError extends Error {
  constructor(message: string, readonly partial: string, readonly provider: string) {
    super(message)
    this.name = 'ChatStreamError'
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// ---- SSE -------------------------------------------------------------------------------------

/** Call onData with each event's data field ('[DONE]' and comments skipped) until the body ends. */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const reader = body.getReader()
  const cancel = () => {
    reader.cancel().catch(() => undefined)
  }
  signal?.addEventListener('abort', cancel, { once: true })
  const decoder = new TextDecoder()
  let buffer = ''
  const dispatch = (block: string) => {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n')
      .trim()
    if (data && data !== '[DONE]') onData(data)
  }
  try {
    for (;;) {
      if (signal?.aborted) throw new Error('aborted')
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n')
      let end = buffer.indexOf('\n\n')
      while (end >= 0) {
        dispatch(buffer.slice(0, end))
        buffer = buffer.slice(end + 2)
        end = buffer.indexOf('\n\n')
      }
    }
    if (signal?.aborted) throw new Error('aborted')
    dispatch(buffer + decoder.decode())
  } catch (error) {
    cancel()
    throw error
  } finally {
    signal?.removeEventListener('abort', cancel)
    reader.releaseLock()
  }
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) =>
      typeof part === 'string'
        ? part
        : part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
        ? (part as { text: string }).text
        : ''
    )
    .join('')
}

/**
 * The answer text in one payload, streamed or not: Workers AI's {response} chunks, OpenAI-style
 * choices[0].delta.content (string or parts) or choices[0].message.content. Reasoning fields
 * (reasoning_content, reasoning) are never read.
 */
export function payloadText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return typeof payload === 'string' ? payload : ''
  const record = payload as Record<string, unknown>
  if (typeof record.response === 'string') return record.response
  const choice = Array.isArray(record.choices)
    ? (record.choices[0] as Record<string, unknown>)
    : null
  if (!choice || typeof choice !== 'object') return ''
  const delta = choice.delta as Record<string, unknown> | undefined
  if (delta && typeof delta === 'object') return textOf(delta.content)
  const message = choice.message as Record<string, unknown> | undefined
  if (message && typeof message === 'object') return textOf(message.content)
  return typeof choice.text === 'string' ? choice.text : ''
}

/** The error a provider embeds in a 200 stream ({error} or {errors: [...]}), if any. */
export function payloadError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const { error, errors } = payload as { error?: unknown; errors?: unknown }
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') return String((error as { message?: unknown }).message)
  if (Array.isArray(errors) && errors.length) return JSON.stringify(errors).slice(0, 300)
  return null
}

/** Stream an SSE body, handing each payload's answer text to onText. */
export async function streamSseText(
  body: ReadableStream<Uint8Array>,
  onText: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  await readSseStream(
    body,
    (data) => {
      let payload: unknown
      try {
        payload = JSON.parse(data)
      } catch {
        return // keep-alives and partial garbage are not fatal
      }
      const problem = payloadError(payload)
      if (problem) throw new Error(`stream error: ${problem}`)
      const text = payloadText(payload)
      if (text) onText(text)
    },
    signal
  )
}

// ---- Reasoning -------------------------------------------------------------------------------

const OPEN = '<think>'
const CLOSE = '</think>'

/** Length of the longest suffix of text that is a proper prefix of one of the tags. */
function partialTagLength(text: string, tags: string[]): number {
  for (let n = Math.min(text.length, 8); n > 0; n--) {
    const tail = text.slice(-n)
    if (tags.some((tag) => tag.length > n && tag.startsWith(tail))) return n
  }
  return 0
}

/**
 * Drops <think>…</think> blocks from a streamed answer, tags split across chunks included, and
 * the leading whitespace a dropped block leaves behind. An orphan </think> (the chat template
 * opened the block) drops itself, plus everything before it while nothing has been emitted yet.
 */
export function createReasoningFilter() {
  let inside = false
  let carry = ''
  let started = false

  const emit = (text: string) => {
    const visible = started ? text : text.replace(/^\s+/, '')
    if (visible) started = true
    return visible
  }

  return {
    push(chunk: string): string {
      let text = carry + chunk
      carry = ''
      let out = ''
      for (;;) {
        if (inside) {
          const close = text.indexOf(CLOSE)
          if (close < 0) {
            carry = text.slice(text.length - partialTagLength(text, [CLOSE]))
            return out
          }
          text = text.slice(close + CLOSE.length)
          inside = false
          continue
        }
        const open = text.indexOf(OPEN)
        const close = text.indexOf(CLOSE)
        if (close >= 0 && (open < 0 || close < open)) {
          if (started) out += emit(text.slice(0, close))
          text = text.slice(close + CLOSE.length)
          continue
        }
        if (open >= 0) {
          out += emit(text.slice(0, open))
          text = text.slice(open + OPEN.length)
          inside = true
          continue
        }
        const hold = partialTagLength(text, [OPEN, CLOSE])
        carry = text.slice(text.length - hold)
        return out + emit(text.slice(0, text.length - hold))
      }
    },
    /** End of stream: a dangling partial tag is text; an unclosed block is dropped. */
    flush(): string {
      const rest = inside ? '' : carry
      carry = ''
      return emit(rest)
    },
  }
}

// ---- Failover --------------------------------------------------------------------------------

export interface LadderOptions {
  /** Provider label, the first half of ChatResult.provider. */
  name: string
  models: string[]
  /** Stream one model's raw text through onText; reasoning filtering happens here. */
  run: (
    model: string,
    request: Omit<ChatRequest, 'onDelta'> & { onText: (text: string) => void }
  ) => Promise<void>
  /** A model that has produced no visible text by then is abandoned for the next one. */
  firstTokenMs?: number
  log?: (message: string) => void
}

export const FIRST_TOKEN_MS = 12_000

/**
 * Sequential failover over models. A model that fails before its first visible token is skipped;
 * one that fails mid-answer raises ChatStreamError, since its partial text has already streamed.
 */
export function modelLadder({
  name,
  models,
  run,
  firstTokenMs = FIRST_TOKEN_MS,
  log = (message) => console.error(message),
}: LadderOptions): ChatProvider {
  return {
    async stream(request) {
      const failures: string[] = []
      for (const model of models) {
        if (request.signal?.aborted) break
        const provider = `${name}:${model}`
        const controller = new AbortController()
        const abort = () => controller.abort()
        request.signal?.addEventListener('abort', abort, { once: true })
        const timer = setTimeout(abort, firstTokenMs)
        const filter = createReasoningFilter()
        let text = ''
        const visible = (delta: string) => {
          if (!delta) return
          if (!text) clearTimeout(timer)
          text += delta
          request.onDelta(delta)
        }
        try {
          await run(model, {
            messages: request.messages,
            maxTokens: request.maxTokens,
            temperature: request.temperature,
            signal: controller.signal,
            onText: (raw) => visible(filter.push(raw)),
          })
          if (controller.signal.aborted) throw new Error('aborted')
          visible(filter.flush())
          if (!text.trim()) throw new Error('empty completion')
          return { text: text.trim(), provider }
        } catch (error) {
          if (request.signal?.aborted) throw error
          const timedOut = controller.signal.aborted && !text
          const reason = timedOut ? `no answer within ${firstTokenMs}ms` : errorMessage(error)
          if (text) throw new ChatStreamError(reason, text, provider)
          failures.push(`${model}: ${reason}`)
          log(`[chat] ${provider} failed: ${reason}`)
        } finally {
          clearTimeout(timer)
          request.signal?.removeEventListener('abort', abort)
        }
      }
      throw new Error(`${name}: no model answered (${failures.join('; ') || 'aborted'})`)
    },
  }
}
