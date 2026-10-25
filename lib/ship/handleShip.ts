// The Ship handler: one Web-standard (Request) => Response for every target. The Worker calls it
// with the Workers AI provider and env.ASSETS; pages/api/vector-search.ts calls it on Vercel with
// the Hugging Face provider and assets read from disk. Retrieval is lexical today and hybrid when
// an embedQuery is supplied; generation is optional. A knowledge query never answers with a 500.
import type { ChatProvider } from '../ai/chatProvider'
import { resolveShipTrick } from '../ai/shipTricks'
import type { ArchiveRecord } from '../archive/types'
import { OPERATOR_DOCS } from '../retrieval/chunk'
import { getShipContext } from '../retrieval/shipContext'
import type { RetrievalDeps, RetrievalItem, RetrievalResult, SearchManifest } from '../retrieval/types'
import { NDJSON_HEADERS, createNdjsonStream, type NdjsonStream, type ShipSource } from './ndjson'
import {
  SHIP_GENERATION,
  SYSTEM_FAULT_NOTICE,
  buildExtractiveAnswer,
  buildShipMessages,
} from './prompt'
import { readShipRequest, type ShipRequest } from './request'

/** Gate in front of the chat model (rate limit, daily spend cap). The Worker supplies it in P2. */
export interface ShipLimiter {
  /** False, or a throw, skips generation: the archive still answers, extractively. */
  allowChat(request: Request): boolean | Promise<boolean>
}

type Lazy<T> = T | (() => Promise<T>)

export interface ShipDeps extends RetrievalDeps {
  /** Streaming chat; without one every answer is the extractive local-archive answer. */
  chat?: ChatProvider | null
  limiter?: ShipLimiter
  /** The search index manifest; without it retrieval ranks whole records only. */
  manifest?: Lazy<SearchManifest | null>
  /** Article records: record-level ranking, the index-down fallback, and the slug allowlist. */
  records?: Lazy<ArchiveRecord[]>
  /** The vector-set model embedQuery speaks; dense retrieval stays off without it. */
  embedModel?: string
  log?: (message: string) => void
}

const STREAM_BATCH_MIN_CHARS = 32
const STREAM_BATCH_MAX_DELAY_MS = 180

function shouldFlushDelta(pending: string, elapsedMs: number): boolean {
  if (!pending.trim()) return false
  return (
    elapsedMs >= STREAM_BATCH_MAX_DELAY_MS ||
    pending.length >= STREAM_BATCH_MIN_CHARS ||
    /[.!?]\s*$/.test(pending) ||
    /\n\s*\n$/.test(pending)
  )
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function resolveLazy<T>(value: Lazy<T> | undefined, fallback: T): Promise<T> {
  try {
    return (typeof value === 'function' ? await (value as () => Promise<T>)() : value) ?? fallback
  } catch {
    return fallback
  }
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  })

const OPERATOR_PANEL_OF = new Map(OPERATOR_DOCS.map((doc) => [doc.slug, doc.panel]))

/**
 * Only slugs the scene can open: operator ids with their own panel, or articles in the records
 * (every record is prerendered). With no records to check against, the index's own docs stand.
 */
function openableItems(items: RetrievalItem[], records: ArchiveRecord[]): RetrievalItem[] {
  const slugs = new Set(records.map((record) => record.slug))
  return items.filter((item) => {
    if (item.target.type === 'data') return OPERATOR_PANEL_OF.get(item.slug) === item.target.panel
    if (item.slug.includes('#') || OPERATOR_PANEL_OF.has(item.slug)) return false
    return !slugs.size || slugs.has(item.slug)
  })
}

function toSource({ slug, title, heading, target }: RetrievalItem): ShipSource {
  return { slug, title, heading, target }
}

const EMPTY_RETRIEVAL: RetrievalResult = {
  profileIntent: false,
  profileFacts: [],
  context: '',
  instantResults: [],
  mode: 'none',
}

interface Turn {
  request: Request
  input: ShipRequest
  question: string
  trick: ReturnType<typeof resolveShipTrick>
  retrieval: RetrievalResult
  items: RetrievalItem[]
}

/** Generated when a model is available and allowed, extractive otherwise or on any failure. */
async function answer(turn: Turn, deps: ShipDeps, stream: NdjsonStream, log: (m: string) => void) {
  const extractive = () => ({
    answer: buildExtractiveAnswer(turn.question, turn.retrieval, turn.items),
    provider: 'local-archive',
  })
  if (!deps.chat) return extractive()
  if (deps.limiter) {
    let allowed = false
    try {
      allowed = await deps.limiter.allowChat(turn.request)
    } catch (error) {
      log(`[ship] limiter failed closed: ${message(error)}`)
    }
    if (!allowed) return extractive()
  }

  let pending = ''
  let lastFlush = Date.now()
  const flush = (force: boolean) => {
    if (!pending || (!force && !shouldFlushDelta(pending, Date.now() - lastFlush))) return
    void stream.send({ type: 'answer-delta', delta: pending })
    pending = ''
    lastFlush = Date.now()
  }
  try {
    const result = await deps.chat.stream({
      messages: buildShipMessages(turn.question, turn.trick, turn.retrieval, turn.input.history),
      maxTokens: SHIP_GENERATION.maxTokens,
      temperature: turn.retrieval.profileIntent
        ? SHIP_GENERATION.profileTemperature
        : SHIP_GENERATION.temperature,
      signal: stream.signal,
      onDelta: (delta) => {
        pending += delta
        flush(false)
      },
    })
    flush(true)
    return { answer: result.text, provider: result.provider }
  } catch (error) {
    if (stream.signal.aborted) throw error
    // The final answer replaces whatever partial text already streamed.
    log(`[ship] generation failed, answering from the archive: ${message(error)}`)
    return extractive()
  }
}

async function respond(turn: Turn, deps: ShipDeps, stream: NdjsonStream, log: (m: string) => void) {
  try {
    await stream.send({
      type: 'instant-results',
      question: turn.question,
      retrieval: turn.retrieval.mode,
      items: turn.items,
    })
    if (turn.input.mode === 'retrieve') return
    const { answer: text, provider } = await answer(turn, deps, stream, log)
    await stream.send({
      type: 'final-answer',
      question: turn.question,
      answer: text,
      provider,
      sources: turn.items.map(toSource),
    })
  } catch (error) {
    if (!stream.signal.aborted) {
      log(`[ship] stream fault: ${message(error)}`)
      await stream.send({ type: 'error', message: SYSTEM_FAULT_NOTICE })
    }
  } finally {
    await stream.close()
  }
}

/** Even an unexpected failure reaches the client as a renderable answer. */
function faultResponse(): Response {
  const lines = [
    { type: 'instant-results', question: '', retrieval: 'none', items: [] },
    { type: 'final-answer', question: '', answer: SYSTEM_FAULT_NOTICE, provider: 'local-archive', sources: [] },
  ]
  return new Response(lines.map((line) => `${JSON.stringify(line)}\n`).join(''), {
    status: 200,
    headers: NDJSON_HEADERS,
  })
}

export async function handleShip(request: Request, deps: ShipDeps): Promise<Response> {
  const log = deps.log ?? ((line: string) => console.error(line))
  try {
    const parsed = await readShipRequest(request)
    if (!parsed.ok) return json(parsed.status, { error: parsed.error }, parsed.headers)
    const input = parsed.value
    const trick = resolveShipTrick(input.prompt)
    // /help, /tricks and unknown commands are listings, not questions.
    if (trick.helpResponse) {
      return new Response(trick.helpResponse, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }

    const [manifest, records] = await Promise.all([
      resolveLazy(deps.manifest, null),
      resolveLazy(deps.records, [] as ArchiveRecord[]),
    ])
    let retrieval = EMPTY_RETRIEVAL
    try {
      retrieval = await getShipContext(
        trick.searchQuery || input.prompt,
        { fetchAsset: deps.fetchAsset, embedQuery: deps.embedQuery?.bind(deps) },
        { manifest, records, model: deps.embedModel }
      )
    } catch (error) {
      log(`[ship] retrieval failed: ${message(error)}`)
    }
    // Lexical without an embedder is the expected path today; anything else is worth a line.
    if (retrieval.mode === 'records' || retrieval.mode === 'none' || (deps.embedQuery && retrieval.mode !== 'hybrid')) {
      log(`[ship] retrieval ${retrieval.mode}: ${retrieval.fallbackReason ?? 'no match'}`)
    }

    const turn: Turn = {
      request,
      input,
      question: input.prompt,
      trick,
      retrieval,
      items: openableItems(retrieval.instantResults, records),
    }
    const stream = createNdjsonStream()
    void respond(turn, deps, stream, log)
    return new Response(stream.readable, {
      status: 200,
      headers: { ...NDJSON_HEADERS, 'X-Ship-Retrieval': retrieval.mode },
    })
  } catch (error) {
    log(`[ship] request failed: ${message(error)}`)
    return faultResponse()
  }
}
