import type { NextApiRequest, NextApiResponse } from 'next'
import { codeBlock, oneLine } from 'common-tags';
import { createClient } from '@supabase/supabase-js'
import { Configuration, OpenAIApi, type CreateEmbeddingResponse } from 'openai-edge'
import { ApplicationError, UserError } from '@/lib/errors';
import articleManifest from '@/lib/generated/article-manifest.json'
import { generateHuggingFaceChatStream, hasHfToken, type HfChatMessage } from '@/lib/ai/huggingface'
import { extractShipSignals, shipPersona } from '@/lib/ai/shipPersona';
import { resolveShipTrick, type ResolvedShipTrick } from '@/lib/ai/shipTricks'
import { queryLocalArchive, type LocalArchiveQueryResult } from '@/lib/chat/archiveQuery'
import {
  buildStructuredAnswer,
  type InstantAnswerItem,
  type ShipAnswerMode,
  type ShipStreamEvent,
} from '@/lib/chat/shipAnswer'

/** Ship (shipClient.ts) sends {role, content}; older clients sent {question, response} pairs.
 *  Fields are unknown until validated — history is untrusted client input. */
interface ChatHistoryEntry {
  role?: unknown
  content?: unknown
  question?: unknown
  response?: unknown
}

const HISTORY_MAX_MESSAGES = 8
const HISTORY_MAX_CHARS = 1200

interface QuestContext {
  currentQuest?: {
    id?: string
    title?: string
    objective?: string
  }
  currentPhase?: number
  completedQuests?: string[]
  missionBrief?: string
}

interface VectorSearchRequest {
  prompt?: string
  history?: ChatHistoryEntry[]
  questContext?: QuestContext
  articleContext?: {
    slug?: string
    title?: string
    articleType?: 'fiction' | 'research'
    description?: string
    keywords?: string[]
    content?: string
  }
}

interface ArticleRecord {
  slug: string
  filename?: string
  title?: string
  description?: string
  searchText?: string
  keywords?: string[]
  domains?: string[]
  mechanics?: string[]
  articleType?: string
  date?: string
}

interface SemanticPageSection {
  id: number
  page_id: number
  slug: string | null
  heading: string | null
  content: string
  similarity: number
}

const openAiKey = process.env.OPENAI_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const stopWords = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'have', 'what', 'about',
  'would', 'there', 'their', 'them', 'then', 'when', 'where', 'which', 'while', 'were', 'been',
  'will', 'just', 'like', 'than', 'they', 'alex', 'welcing', 'ship', 'ai'
])

function getManifestArticles(): ArticleRecord[] {
  if (Array.isArray(articleManifest)) {
    return articleManifest as ArticleRecord[]
  }

  const wrapped = (articleManifest as { default?: unknown }).default
  return Array.isArray(wrapped) ? (wrapped as ArticleRecord[]) : []
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function hasConfiguredValue(value: string | undefined): value is string {
  return Boolean(value?.trim() && !/your-[a-z-]*key/i.test(value))
}

function createSupabaseAdminClient() {
  if (!hasConfiguredValue(supabaseUrl) || !hasConfiguredValue(supabaseServiceKey)) {
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function getSemanticPageSections(query: string): Promise<SemanticPageSection[]> {
  if (!hasConfiguredValue(openAiKey)) {
    return []
  }

  const supabaseClient = createSupabaseAdminClient()
  if (!supabaseClient) {
    return []
  }

  try {
    const openai = new OpenAIApi(new Configuration({ apiKey: openAiKey }))
    const embeddingResponse = await openai.createEmbedding({
      model: 'text-embedding-ada-002',
      input: query.replace(/\n/g, ' '),
    })

    if (!embeddingResponse.ok) {
      console.error('[vector-search] Failed to create embedding', embeddingResponse.status)
      return []
    }

    const embeddingJson = (await embeddingResponse.json()) as CreateEmbeddingResponse
    const embedding = embeddingJson.data?.[0]?.embedding

    if (!embedding) {
      return []
    }

    const { data, error } = await supabaseClient.rpc('match_page_sections', {
      embedding,
      match_threshold: 0.72,
      match_count: 8,
      min_content_length: 80,
    })

    if (error) {
      console.error('[vector-search] Semantic section match failed', error)
      return []
    }

    return Array.isArray(data) ? (data as SemanticPageSection[]) : []
  } catch (error) {
    console.error('[vector-search] Semantic retrieval fallback to manifest', error)
    return []
  }
}

function tokenize(input: string): string[] {
  return normalizeWhitespace(input)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopWords.has(token))
}

function scoreField(fieldValue: string | undefined, queryTokens: string[], weight: number): number {
  if (!fieldValue) return 0

  const haystack = fieldValue.toLowerCase()
  let score = 0

  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      score += weight
    }
  }

  return score
}

function scoreArticle(article: ArticleRecord, query: string, queryTokens: string[]): number {
  let score = 0

  score += scoreField(article.title, queryTokens, 9)
  score += scoreField(article.description, queryTokens, 5)
  score += scoreField(article.searchText, queryTokens, 2)
  score += scoreField(article.slug, queryTokens, 4)
  score += scoreField(article.articleType, queryTokens, 2)
  score += scoreField(article.date, queryTokens, 1)
  score += (article.keywords || []).reduce((sum, keyword) => sum + scoreField(keyword, queryTokens, 7), 0)
  score += (article.domains || []).reduce((sum, domain) => sum + scoreField(domain, queryTokens, 5), 0)
  score += (article.mechanics || []).reduce((sum, mechanic) => sum + scoreField(mechanic, queryTokens, 3), 0)

  const fullQuery = query.trim().toLowerCase()
  if (fullQuery && article.title?.toLowerCase().includes(fullQuery)) {
    score += 20
  }

  return score
}

function getArticleBySlug(slug: string | null | undefined): ArticleRecord | undefined {
  if (!slug) return undefined
  return getManifestArticles().find((article) => article.slug === slug)
}

function extractSnippet(articleBody: string, queryTokens: string[]): string {
  if (!articleBody) {
    return ''
  }

  const normalizedBody = normalizeWhitespace(articleBody)
  const lowerBody = normalizedBody.toLowerCase()
  const matchIndex = queryTokens
    .map((token) => lowerBody.indexOf(token))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0]

  if (matchIndex === undefined) {
    return normalizedBody.slice(0, 420)
  }

  const start = Math.max(0, matchIndex - 140)
  const end = Math.min(normalizedBody.length, matchIndex + 320)
  const prefix = start > 0 ? '... ' : ''
  const suffix = end < normalizedBody.length ? ' ...' : ''

  return `${prefix}${normalizedBody.slice(start, end).trim()}${suffix}`
}

function buildSemanticContextSections(
  sections: SemanticPageSection[],
  queryTokens: string[],
): string {
  if (!sections.length) {
    return ''
  }

  let remainingBudget = 2600
  const blocks: string[] = []

  for (const section of sections) {
    if (remainingBudget <= 0) {
      break
    }

    const article = getArticleBySlug(section.slug)
    const excerpt = normalizeWhitespace(section.content).slice(0, Math.min(680, remainingBudget))
    const snippet = extractSnippet(excerpt, queryTokens) || excerpt

    blocks.push(codeBlock`
      Page: ${article?.title || section.slug || section.heading || 'unknown'}
      Slug: ${article?.slug || section.slug || 'unknown'}
      Heading: ${section.heading || 'Intro'}
      Similarity: ${section.similarity.toFixed(3)}
      Type: ${article?.articleType || 'unknown'}
      Matched section: ${snippet}
    `)

    remainingBudget -= snippet.length
  }

  return blocks.join('\n\n---\n\n')
}

function buildLexicalContextSections(query: string): string {
  const articles = getManifestArticles()
  const queryTokens = tokenize(query)
  const rankedArticles = articles
    .map((article) => ({ article, score: scoreArticle(article, query, queryTokens) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)

  if (!rankedArticles.length) {
    return 'No strongly matching article context found in the local archive. Answer carefully and say when certainty is low.'
  }

  return rankedArticles
    .map(({ article }) => {
      const body = article.searchText || article.description || ''
      const snippet = extractSnippet(body, queryTokens)

      return codeBlock`
        Title: ${article.title || article.slug}
        Slug: ${article.slug}
        Type: ${article.articleType || 'unknown'}
        Date: ${article.date || 'unknown'}
        Description: ${article.description || 'No description available.'}
        Keywords: ${(article.keywords || []).join(', ') || 'none'}
        Domains: ${(article.domains || []).join(', ') || 'none'}
        Excerpt: ${snippet || 'No excerpt available.'}
      `
    })
    .join('\n\n---\n\n')
}

function buildContextSections(query: string, semanticSections: SemanticPageSection[]): string {
  const queryTokens = tokenize(query)
  const semanticContext = buildSemanticContextSections(semanticSections, queryTokens)

  if (semanticContext) {
    return semanticContext
  }

  return buildLexicalContextSections(query)
}

function buildProfileContextSection(profileFacts: string[]): string {
  if (!profileFacts.length) {
    return ''
  }

  return [
    'Owner profile evidence:',
    ...profileFacts.map((fact, index) => `${index + 1}. ${fact}`),
  ].join('\n')
}

function buildArchiveContextSections(
  query: string,
  semanticSections: SemanticPageSection[],
  localArchiveContext: string,
  profileFacts: string[] = [],
  profileIntent = false,
): string {
  const sections: string[] = []
  const profileContext = buildProfileContextSection(profileFacts)
  const semanticContext = buildSemanticContextSections(semanticSections, tokenize(query))

  if (profileContext) {
    sections.push(profileContext)
  }

  if (localArchiveContext) {
    sections.push(localArchiveContext)
  }

  if (semanticContext && !profileIntent) {
    sections.push(semanticContext)
  }

  if (semanticContext && profileIntent) {
    sections.push(semanticContext)
  }

  if (sections.length > 0) {
    return sections.join('\n\n---\n\n')
  }

  return buildContextSections(query, semanticSections)
}

function getInstantResults(query: string, limit = 5): InstantAnswerItem[] {
  const articles = getManifestArticles()
  const queryTokens = tokenize(query)

  return articles
    .map((article) => ({ article, score: scoreArticle(article, query, queryTokens) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ article, score }) => ({
      slug: article.slug,
      title: article.title || article.slug,
      description: article.description || 'No description available.',
      snippet: extractSnippet(article.searchText || article.description || '', queryTokens),
      articleType: article.articleType,
      score,
      keywords: article.keywords || [],
      domains: article.domains || [],
    }))
}

function getSemanticInstantResults(query: string, sections: SemanticPageSection[], limit = 5): InstantAnswerItem[] {
  const queryTokens = tokenize(query)
  const grouped = new Map<string, { score: number; section: SemanticPageSection }>()

  for (const section of sections) {
    const slug = section.slug || undefined
    if (!slug) continue

    const existing = grouped.get(slug)
    const score = Math.max(1, Math.round(section.similarity * 100))

    if (!existing || score > existing.score) {
      grouped.set(slug, { score, section })
    }
  }

  return Array.from(grouped.entries())
    .sort((left, right) => right[1].score - left[1].score)
    .slice(0, limit)
    .map(([slug, entry]) => {
      const article = getArticleBySlug(slug)
      const sourceText = entry.section.content || article?.searchText || article?.description || ''

      return {
        slug,
        title: article?.title || entry.section.heading || slug,
        description: article?.description || entry.section.heading || 'Relevant archive match.',
        snippet: extractSnippet(sourceText, queryTokens),
        articleType: article?.articleType,
        score: entry.score,
        keywords: article?.keywords || [],
        domains: article?.domains || [],
      }
    })
}

function dedupeInstantResults(items: InstantAnswerItem[], limit = 5): InstantAnswerItem[] {
  const deduped = new Map<string, InstantAnswerItem>()

  for (const item of items) {
    const existing = deduped.get(item.slug)
    if (!existing || item.score > existing.score) {
      deduped.set(item.slug, item)
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}

function toHistoryMessage(role: 'user' | 'assistant', content: unknown): HfChatMessage[] {
  if (typeof content !== 'string') return []
  const trimmed = content.trim().slice(0, HISTORY_MAX_CHARS)
  return trimmed ? [{ role, content: trimmed }] : []
}

/** Last 8 history messages, each capped at 1,200 chars. Only user/assistant roles are
 *  accepted (a client-supplied 'system' turn is dropped); malformed entries are skipped. */
function buildHistoryMessages(history: unknown): HfChatMessage[] {
  if (!Array.isArray(history)) return []

  return history
    .flatMap((entry: unknown): HfChatMessage[] => {
      if (!entry || typeof entry !== 'object') return []
      const { role, content, question, response } = entry as ChatHistoryEntry

      if (role === 'user' || role === 'assistant') {
        return toHistoryMessage(role, content)
      }

      return [...toHistoryMessage('user', question), ...toHistoryMessage('assistant', response)]
    })
    .slice(-HISTORY_MAX_MESSAGES)
}

function writeStreamEvent(res: NextApiResponse, event: ShipStreamEvent) {
  res.write(`${JSON.stringify(event)}\n`)
}

const EMPTY_LOCAL_ARCHIVE: LocalArchiveQueryResult = {
  profileIntent: false,
  profileFacts: [],
  context: '',
  instantResults: [],
}

/** When generation is unavailable (no HF_TOKEN, deprecated models, provider outage), the
 *  knowledge set still answers: a short notice plus the strongest archive matches. */
function buildLocalFallbackAnswer(query: string, instantResults: InstantAnswerItem[]): string {
  if (!instantResults.length) {
    return oneLine`
      Generative link offline — and the archive index has no strong match for "${query}".
      Try different terms, or open the ARCHIVE tab to browse the records directly.`
  }

  const lines = instantResults.slice(0, 3).map((item, index) => {
    const summary = normalizeWhitespace(item.description || item.snippet || '').slice(0, 140)
    return `${index + 1}. ${item.title} — ${summary}`
  })

  return [
    'Generative link offline — answering from the archive index.',
    '',
    `Closest records on "${query}":`,
    ...lines,
    '',
    'Open a source below to read the full record.',
  ].join('\n')
}

const STREAM_BATCH_MIN_CHARS = 32
const STREAM_BATCH_MAX_DELAY_MS = 180

function shouldFlushAnswerDelta(pendingDelta: string, elapsedMs: number): boolean {
  if (!pendingDelta.trim()) return false
  if (elapsedMs >= STREAM_BATCH_MAX_DELAY_MS) return true
  if (pendingDelta.length >= STREAM_BATCH_MIN_CHARS) return true
  if (/[.!?]\s*$/.test(pendingDelta)) return true
  if (/\n\s*\n$/.test(pendingDelta)) return true
  return false
}

function buildArticleContextSection(articleContext?: VectorSearchRequest['articleContext']): string {
  if (!articleContext?.title) {
    return ''
  }

  const excerpt = normalizeWhitespace(articleContext.content || '').slice(0, 1400)

  return codeBlock`
    Current article:
    Title: ${articleContext.title}
    Slug: ${articleContext.slug || 'unknown'}
    Type: ${articleContext.articleType || 'unknown'}
    Description: ${articleContext.description || 'No description available.'}
    Keywords: ${(articleContext.keywords || []).join(', ') || 'none'}
    Excerpt: ${excerpt || 'No excerpt available.'}
  `
}

function mergeInstantResults(
  baseResults: InstantAnswerItem[],
  articleContext?: VectorSearchRequest['articleContext'],
  limit = 5,
): InstantAnswerItem[] {
  const ranked = dedupeInstantResults(baseResults, Math.max(limit, 8))

  if (!articleContext?.title) {
    return ranked.slice(0, limit)
  }

  const currentArticle: InstantAnswerItem = {
    slug: articleContext.slug || 'current-article',
    title: articleContext.title,
    description: articleContext.description || 'Current article context.',
    snippet: extractSnippet(articleContext.content || articleContext.description || '', tokenize(articleContext.title)),
    articleType: articleContext.articleType,
    score: ranked.length > 0 ? Math.max(ranked[0].score + 1, 100) : 100,
    keywords: articleContext.keywords || [],
    domains: [],
  }

  return [currentArticle, ...ranked.filter((item) => item.slug !== currentArticle.slug)].slice(0, limit)
}

function buildUserPrompt(
  query: string,
  archiveContext: string,
  profileContext: string,
  profileIntent: boolean,
  questContext?: QuestContext,
  trickContext?: ResolvedShipTrick,
  articleContext?: VectorSearchRequest['articleContext'],
): string {
  const sanitizedQuery = query.trim()
  const questDetails = questContext?.currentQuest
    ? `${questContext.currentQuest.title}: ${questContext.currentQuest.objective}`
    : 'No active mission'
  const missionBrief = questContext?.missionBrief
    ? `Current mission brief: ${questContext.missionBrief}`
    : 'Current mission brief: none'
  const trickLabel = trickContext?.trick ? `${trickContext.trick.command} — ${trickContext.trick.label}` : 'default'

  return codeBlock`
    ${oneLine`
    Answer questions about Alex Welcing using the archive context below.
    Be direct, sharp, and grounded in the material. If the archive is thin or ambiguous, say so plainly.`}

    Mission status:
    ${questDetails}
    Current phase: ${questContext?.currentPhase ?? 'unknown'}
    ${missionBrief}
    Active mode: ${trickLabel}

    ${buildArticleContextSection(articleContext) || 'Current article: none'}

  ${profileContext || 'Owner profile evidence: none'}

    Archive context:
    ${archiveContext}

    User question:
    """
    ${trickContext?.transformedQuery || sanitizedQuery}
    """

    Instructions:
    - Lead with the answer.
    - Use specifics from the archive when you have them.
    - Avoid making up capabilities, dates, or facts.
    - Treat first-person identity questions about you or your as questions about Alex Welcing unless the user explicitly asks about Ship AI as a fiction layer.
    - If owner profile evidence is provided, treat it as highest-confidence grounding for identity, location, work, and purpose.
    - If current article context is provided, anchor the answer there before generalizing outward.
    - If the active mode is /story and current article context is provided, treat that article as the primary canon.
    - If relevant, connect the answer to product strategy, systems thinking, fiction themes, or technical work.
    - ${profileIntent ? 'This is a profile-style question. Prefer exact profile facts over broad thematic inference.' : 'Use the strongest grounded evidence available before generalizing.'}
    - ${trickContext?.styleInstruction || 'Keep the answer tight and high-signal.'}
  `
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // No hard requirement on HF_TOKEN: without it the endpoint degrades to archive-index
    // answers instead of refusing the query outright.

    const requestData = (req.body || {}) as VectorSearchRequest

    if (!requestData) {
      throw new UserError('Missing request data')
    }

    const { prompt: query, history = [], questContext, articleContext } = requestData

    if (!query) {
      throw new UserError('Missing query in request data')
    }

    const sanitizedQuery = query.trim()
    const trickContext = resolveShipTrick(sanitizedQuery)
    const retrievalQuery = trickContext?.searchQuery || sanitizedQuery

    if (trickContext.helpResponse) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).send(trickContext.helpResponse)
    }

    const historyMessages = buildHistoryMessages(history)

    // both retrieval layers are best-effort — a failure in either must never take down the
    // whole query (this used to hard-500 when the local archive walk hit a missing directory)
    const [semanticSections, localArchive] = await Promise.all([
      getSemanticPageSections(retrievalQuery).catch((error) => {
        console.error('[vector-search] Semantic retrieval failed:', error)
        return [] as SemanticPageSection[]
      }),
      queryLocalArchive(retrievalQuery).catch((error) => {
        console.error('[vector-search] Local archive retrieval failed:', error)
        return EMPTY_LOCAL_ARCHIVE
      }),
    ])
    const profileContext = buildProfileContextSection(localArchive.profileFacts)
    const archiveContext = buildArchiveContextSections(
      retrievalQuery,
      semanticSections,
      localArchive.context,
      localArchive.profileFacts,
      localArchive.profileIntent,
    )
    const answerMode = (trickContext.trick?.id ?? 'default') as ShipAnswerMode
    const instantResults = mergeInstantResults(
      [
        ...localArchive.instantResults,
        ...getSemanticInstantResults(retrievalQuery, semanticSections, 5),
        ...getInstantResults(retrievalQuery, 5),
      ],
      articleContext,
    )
    const prompt = buildUserPrompt(
      sanitizedQuery,
      archiveContext,
      profileContext,
      localArchive.profileIntent,
      questContext,
      trickContext,
      articleContext,
    )

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Accel-Buffering', 'no')

    writeStreamEvent(res, {
      type: 'instant-results',
      question: sanitizedQuery,
      items: instantResults,
    })

    let streamedAnswer = ''
    let lastEmittedAnswer = ''
    let pendingDelta = ''
    let lastFlushAt = Date.now()

    const flushPendingDelta = (force = false) => {
      const elapsedMs = Date.now() - lastFlushAt
      if (!force && !shouldFlushAnswerDelta(pendingDelta, elapsedMs)) {
        return
      }

      if (!pendingDelta) {
        return
      }

      writeStreamEvent(res, {
        type: 'answer-delta',
        question: sanitizedQuery,
        delta: pendingDelta,
        answer: lastEmittedAnswer,
      })
      pendingDelta = ''
      lastFlushAt = Date.now()
    }

    let generation: { text: string; model: string } | null = null

    if (hasHfToken()) {
      try {
        generation = await generateHuggingFaceChatStream({
          messages: [
            { role: 'system', content: shipPersona.systemPrompt },
            ...historyMessages,
            { role: 'user', content: prompt },
          ],
          maxNewTokens: 700,
          temperature: localArchive.profileIntent ? 0.35 : 0.78,
          onDelta: (delta, answer) => {
            streamedAnswer = answer
            lastEmittedAnswer = answer
            pendingDelta += delta
            flushPendingDelta(false)
          },
        })
      } catch (error) {
        console.error('[vector-search] Generative answer failed — degrading to archive index:', error)
      }
    } else {
      console.error('[vector-search] HF_TOKEN not configured — serving archive-index answer only')
    }

    flushPendingDelta(true)

    // graceful degrade: the knowledge set still answers when generation is unavailable
    if (!generation) {
      const fallbackMessage = buildLocalFallbackAnswer(sanitizedQuery, instantResults)
      writeStreamEvent(res, {
        type: 'final-answer',
        question: sanitizedQuery,
        answer: fallbackMessage,
        structuredAnswer: buildStructuredAnswer(fallbackMessage, answerMode),
        provider: 'local-archive',
        signals: [],
      })
      res.end()
      return
    }

    const finalRawAnswer = streamedAnswer || generation.text
    const { cleanMessage, signals } = extractShipSignals(finalRawAnswer)

    // No client renders structuredAnswer yet, so it is built locally rather than with a second
    // LLM call that held the UI in RECEIVING. The provider rides in the event, not a header:
    // headers are already flushed once streaming starts.
    const structuredAnswer = buildStructuredAnswer(cleanMessage, answerMode)

    writeStreamEvent(res, {
      type: 'final-answer',
      question: sanitizedQuery,
      answer: cleanMessage,
      structuredAnswer,
      provider: `huggingface:${generation.model}`,
      signals,
    })
    res.end()
    return
  } catch (err: unknown) {
    if (res.headersSent) {
      writeStreamEvent(res, {
        type: 'error',
        message: err instanceof Error ? err.message : 'There was an error processing your request',
      })
      res.end()
      return
    }

    if (err instanceof UserError) {
      return res.status(400).json({
        error: err.message,
        data: err.data,
      })
    } else if (err instanceof ApplicationError) {
      console.error(`${err.message}: ${JSON.stringify(err.data)}`)
    } else {
      console.error(err)
    }

    // A knowledge query never hard-500s: hand the client a well-formed stream with a notice
    // it can render instead of a dead 'SIGNAL LOST (HTTP 500)'.
    res.status(200)
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    const notice =
      'Ship systems fault — the archive index is unreachable right now. Try again in a moment, or browse the ARCHIVE tab directly.'
    writeStreamEvent(res, {
      type: 'final-answer',
      question: '',
      answer: notice,
      structuredAnswer: buildStructuredAnswer(notice, 'default'),
      provider: 'local-archive',
      signals: [],
    })
    res.end()
    return
  }
}
