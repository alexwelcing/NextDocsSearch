// The Ship handler: one Web-standard (Request) => Response for every target. The Worker calls it
// with the Workers AI provider and env.ASSETS; pages/api/vector-search.ts calls it on Vercel with
// the Hugging Face provider and assets read from disk. Retrieval is lexical today and hybrid when
// an embedQuery is supplied; generation is optional. A knowledge query never answers with a 500.
import type { ChatProvider } from '../ai/chatProvider'
import { resolveShipTrick } from '../ai/shipTricks'
import type { ArchiveRecord } from '../archive/types'
import { OPERATOR_PANELS } from '../immersive/operatorData'
import { OPERATOR_DOCS, chunkBlocks, operatorBlocks } from '../retrieval/chunk'
import { PROFILE_SLUG } from '../retrieval/profile'
import { SHIP_CONTEXT_LIMITS, getShipContext } from '../retrieval/shipContext'
import type {
  RetrievalDeps,
  RetrievalItem,
  RetrievalResult,
  SearchManifest,
} from '../retrieval/types'
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
 * The operator panels as records, mirroring the operator docs the index builds, so record-level
 * ranking (all there is while the index is unavailable) still finds them; groundProfile makes
 * sure identity questions lead with the about panel.
 */
const OPERATOR_RECORDS: ArchiveRecord[] = OPERATOR_DOCS.map(({ slug, panel, title }) => {
  const blocks = operatorBlocks(OPERATOR_PANELS[panel])
  return {
    slug,
    title,
    date: '',
    description: blocks.find((block) => block.t === 'p')?.x ?? OPERATOR_PANELS[panel].title,
    type: 'operator',
    minutes: 1,
    keywords: [],
    domains: [],
    mechanics: [],
    searchText: blocks.map((block) => block.x).join(' '),
    hero: null,
  }
})

const collapse = (value: string) => value.replace(/\s+/g, ' ').trim()

function clip(value: string, max: number): string {
  const text = collapse(value)
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 4)).trim()} ...`
}

const ABOUT_RECORD = OPERATOR_RECORDS.find((record) => record.slug === PROFILE_SLUG)

/** The about panel's leading chunks, read the way the index's profile facts read. */
const ABOUT_FACTS = chunkBlocks(
  { slug: PROFILE_SLUG, title: '', blocks: operatorBlocks(OPERATOR_PANELS.about) },
  'operator'
)
  .slice(0, SHIP_CONTEXT_LIMITS.profileFacts)
  .map((chunk) => clip(chunk.text, SHIP_CONTEXT_LIMITS.factChars))

/**
 * Record-level ranking has no profile facts, and whole-record term overlap ranks fiction above
 * the about panel for a bare "who is alex?". When the index is unavailable and the question is
 * about Alex, the about panel leads the results and grounds the answer, as it does lexically.
 */
function groundProfile(retrieval: RetrievalResult): RetrievalResult {
  if (retrieval.mode !== 'records' || !retrieval.profileIntent || !ABOUT_RECORD) return retrieval
  const ranked = retrieval.instantResults.find((item) => item.slug === PROFILE_SLUG)
  const about: RetrievalItem = ranked ?? {
    slug: ABOUT_RECORD.slug,
    title: ABOUT_RECORD.title,
    heading: '',
    description: ABOUT_RECORD.description,
    snippet: clip(ABOUT_RECORD.description, SHIP_CONTEXT_LIMITS.snippetChars),
    articleType: ABOUT_RECORD.type,
    score: retrieval.instantResults[0]?.score ?? 0,
    keywords: [],
    domains: [],
    target: { type: 'data', panel: 'about' },
  }
  const rest = retrieval.instantResults.filter((item) => item.slug !== about.slug)
  return {
    ...retrieval,
    profileFacts: retrieval.profileFacts.length ? retrieval.profileFacts : ABOUT_FACTS,
    instantResults: [about, ...rest].slice(0, SHIP_CONTEXT_LIMITS.instantResults),
  }
}

/**
 * Index retrieval ranks the operator docs itself, so the operator records join record-level
 * ranking only without an index, or, ranking again, when the index did not load.
 */
async function retrieve(
  query: string,
  deps: ShipDeps,
  manifest: SearchManifest | null,
  records: ArchiveRecord[]
): Promise<RetrievalResult> {
  const retrievalDeps = { fetchAsset: deps.fetchAsset, embedQuery: deps.embedQuery?.bind(deps) }
  const withOperators = [...records, ...OPERATOR_RECORDS]
  if (!manifest) return getShipContext(query, retrievalDeps, { records: withOperators })
  const indexed = await getShipContext(query, retrievalDeps, {
    manifest,
    records,
    model: deps.embedModel,
  })
  if (indexed.mode === 'lexical' || indexed.mode === 'hybrid') return indexed
  const ranked = await getShipContext(query, retrievalDeps, { records: withOperators })
  return { ...ranked, fallbackReason: indexed.fallbackReason ?? ranked.fallbackReason }
}

/** Retrieval lines already logged for an expected absence, so they appear once per process. */
const loggedOnce = new Set<string>()

/**
 * Only what the scene can open: an operator id opens its Data panel (record-level ranking cannot
 * know that), an article must be in the records (every record is prerendered). With no records
 * to check against, the index's own docs stand.
 */
function openableItems(items: RetrievalItem[], records: ArchiveRecord[]): RetrievalItem[] {
  const slugs = new Set(records.map((record) => record.slug))
  return items.flatMap((item): RetrievalItem[] => {
    const panel = OPERATOR_PANEL_OF.get(item.slug)
    if (panel) return [{ ...item, target: { type: 'data', panel } }]
    if (item.target.type !== 'article' || item.slug.includes('#')) return []
    return !slugs.size || slugs.has(item.slug) ? [item] : []
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
    if (turn.input.mode === 'retrieve' || stream.signal.aborted) return
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
    {
      type: 'final-answer',
      question: '',
      answer: SYSTEM_FAULT_NOTICE,
      provider: 'local-archive',
      sources: [],
    },
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
      retrieval = await retrieve(trick.searchQuery || input.prompt, deps, manifest, records)
    } catch (error) {
      log(`[ship] retrieval failed: ${message(error)}`)
    }
    retrieval = groundProfile(retrieval)
    // Lexical without an embedder is the expected path today; anything else is worth a line. A
    // build without the search index is expected too (until it ships), so that one logs once.
    if (
      retrieval.mode === 'records' ||
      retrieval.mode === 'none' ||
      (deps.embedQuery && retrieval.mode !== 'hybrid')
    ) {
      const line = `[ship] retrieval ${retrieval.mode}: ${retrieval.fallbackReason ?? 'no match'}`
      const expected = !manifest && retrieval.mode === 'records'
      if (!expected || !loggedOnce.has(line)) log(line)
      if (expected) loggedOnce.add(line)
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
