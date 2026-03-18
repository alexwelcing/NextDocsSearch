import type { NextApiRequest, NextApiResponse } from 'next'
import { codeBlock, oneLine } from 'common-tags';
import { ApplicationError, UserError } from '@/lib/errors';
import articleManifest from '@/lib/generated/article-manifest.json'
import { generateHuggingFaceChat, generateHuggingFaceChatStream, type HfChatMessage } from '@/lib/ai/huggingface'
import { extractShipSignals, shipPersona } from '@/lib/ai/shipPersona';
import { resolveShipTrick, type ResolvedShipTrick } from '@/lib/ai/shipTricks'
import {
  buildStructuredAnswer,
  parseStructuredAnswerResponse,
  type InstantAnswerItem,
  type ShipAnswerMode,
  type ShipStreamEvent,
} from '@/lib/chat/shipAnswer'

interface ChatHistoryEntry {
  question?: string
  response?: string
}

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

function buildContextSections(query: string): string {
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

function writeStreamEvent(res: NextApiResponse, event: ShipStreamEvent) {
  res.write(`${JSON.stringify(event)}\n`)
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
  query: string,
  articleContext?: VectorSearchRequest['articleContext'],
  limit = 5,
): InstantAnswerItem[] {
  const ranked = getInstantResults(query, limit)

  if (!articleContext?.title) {
    return ranked
  }

  const currentArticle: InstantAnswerItem = {
    slug: articleContext.slug || 'current-article',
    title: articleContext.title,
    description: articleContext.description || 'Current article context.',
    snippet: extractSnippet(articleContext.content || articleContext.description || '', tokenize(query)),
    articleType: articleContext.articleType,
    score: ranked.length > 0 ? Math.max(ranked[0].score + 1, 100) : 100,
    keywords: articleContext.keywords || [],
    domains: [],
  }

  return [currentArticle, ...ranked.filter((item) => item.slug !== currentArticle.slug)].slice(0, limit)
}

function buildUserPrompt(
  query: string,
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

    Archive context:
    ${buildContextSections(trickContext?.searchQuery || sanitizedQuery)}

    User question:
    """
    ${trickContext?.transformedQuery || sanitizedQuery}
    """

    Instructions:
    - Lead with the answer.
    - Use specifics from the archive when you have them.
    - Avoid making up capabilities, dates, or facts.
    - If current article context is provided, anchor the answer there before generalizing outward.
    - If the active mode is /story and current article context is provided, treat that article as the primary canon.
    - If relevant, connect the answer to product strategy, systems thinking, fiction themes, or technical work.
    - ${trickContext?.styleInstruction || 'Keep the answer tight and high-signal.'}
  `
}

function buildStructuredAnswerPrompt(
  question: string,
  answer: string,
  instantResults: InstantAnswerItem[],
  mode: ShipAnswerMode,
  trickLabel?: string,
  articleContext?: VectorSearchRequest['articleContext'],
): string {
  const sources = instantResults
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${item.slug} | ${item.title} | ${item.domains.join(', ') || 'unknown domain'}`)
    .join('\n')

  return codeBlock`
    Transform the answer below into valid JSON only.

    User question:
    ${question}

    Answer:
    ${answer}

    Candidate source slugs:
    ${sources || 'none'}

    Current article context:
    ${articleContext?.title ? `${articleContext.title} | ${articleContext.slug || 'unknown'} | ${articleContext.articleType || 'unknown'}` : 'none'}

    Active mode:
    ${mode}${trickLabel ? ` (${trickLabel})` : ''}

    Return exactly one JSON object with this shape:
    {
      "mode": "default" | "story" | "brief" | "signal" | "map" | "roast" | "compare" | "mission",
      "headline": string,
      "kicker": string,
      "summary": string,
      "quickFacts": string[],
      "suggestedActions": string[],
      "sections": [
        {
          "title": string,
          "body": string,
          "tone": "summary" | "insight" | "detail" | "next-step",
          "sourceSlug": string | null
        }
      ],
      "diagram": {
        "title": string,
        "nodes": [
          {
            "label": string,
            "detail": string,
            "weight": number,
            "tone": "core" | "supporting" | "source",
            "sourceSlug": string | null
          }
        ]
      }
    }

    Rules:
    - JSON only. No markdown fences. No explanation.
    - The mode field must equal ${mode}.
    - headline must be 3 to 7 words, plain text only.
    - kicker must be 1 short sentence, plain text only.
    - Keep summary to 1 sentence.
    - summary must be plain text only, no labels like Verdict or Executive Brief.
    - Keep quickFacts to at most 4 items.
    - quickFacts must be plain text statements, not bullets or labels.
    - Keep suggestedActions to at most 3 items.
    - Keep sections to at most 4 items.
    - Each section title must be 2 to 5 words, plain text only.
    - Keep diagram nodes to at most 5 items.
    - Each diagram node label must be 1 to 4 words, plain text only.
    - Only use sourceSlug values from the candidate list.
    - Ignore presentation wrappers from the original answer. Extract the semantic content only.
    - If mode is story, prefer sections titled Character Pressure, World Rule, Hidden Assumption, Next Scene.
    - If mode is story, the diagram should feel like a narrative map: premise plus 3 to 4 beats or story forces.
    - If mode is map, prefer sections titled Product, Technical, Narrative.
    - If mode is brief, prefer a decisive headline and compact executive framing.
    - If mode is roast, keep the critique useful and evidence-grounded, not theatrical.
    - If mode is mission, make suggestedActions concrete and immediate.
  `
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST'])
      return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!process.env.HF_TOKEN?.trim()) {
      throw new ApplicationError('Missing environment variable HF_TOKEN')
    }

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

    if (trickContext.helpResponse) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).send(trickContext.helpResponse)
    }

    const historyMessages: HfChatMessage[] = Array.isArray(history)
      ? history
        .slice(-shipPersona.memory.maxInteractions)
        .flatMap((entry): HfChatMessage[] => {
          const messages: HfChatMessage[] = []

          if (entry.question) {
            messages.push({ role: 'user', content: entry.question })
          }

          if (entry.response) {
            messages.push({ role: 'assistant', content: entry.response })
          }

          return messages
        })
      : []

    const prompt = buildUserPrompt(sanitizedQuery, questContext, trickContext, articleContext)
    const answerMode = (trickContext.trick?.id ?? 'default') as ShipAnswerMode
    const instantResults = mergeInstantResults(trickContext?.searchQuery || sanitizedQuery, articleContext)

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

    const generation = await generateHuggingFaceChatStream({
      messages: [
        { role: 'system', content: shipPersona.systemPrompt },
        ...historyMessages,
        { role: 'user', content: prompt },
      ],
      maxNewTokens: 700,
      temperature: 0.78,
      onDelta: (delta, answer) => {
        streamedAnswer = answer
        lastEmittedAnswer = answer
        pendingDelta += delta
        flushPendingDelta(false)
      },
    })

    flushPendingDelta(true)

    const finalRawAnswer = streamedAnswer || generation.text
    const { cleanMessage, signals } = extractShipSignals(finalRawAnswer)

    let structuredAnswer = buildStructuredAnswer(cleanMessage, answerMode)

    try {
      const structuredGeneration = await generateHuggingFaceChat({
        messages: [
          {
            role: 'system',
            content: 'You convert answers into strict JSON for a UI renderer. Respond with JSON only.',
          },
          {
            role: 'user',
            content: buildStructuredAnswerPrompt(
              sanitizedQuery,
              cleanMessage,
              instantResults,
              answerMode,
              trickContext.trick?.label,
              articleContext,
            ),
          },
        ],
        maxNewTokens: 700,
        temperature: 0.15,
      })

      structuredAnswer = parseStructuredAnswerResponse(
        structuredGeneration.text,
        cleanMessage,
        instantResults,
        answerMode,
      )
    } catch (error) {
      console.error('[vector-search] Structured synthesis fallback:', error)
    }

    res.setHeader('X-Ship-AI-Provider', `huggingface:${generation.model}`)
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

    return res.status(500).json({
      error: 'There was an error processing your request',
    })
  }
}
