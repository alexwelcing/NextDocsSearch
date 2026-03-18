import type { NextApiRequest, NextApiResponse } from 'next'
import { codeBlock, oneLine } from 'common-tags';
import { ApplicationError, UserError } from '@/lib/errors';
import articleManifest from '@/lib/generated/article-manifest.json'
import { generateHuggingFaceChat, type HfChatMessage } from '@/lib/ai/huggingface'
import { shipPersona } from '@/lib/ai/shipPersona';
import { resolveShipTrick, type ResolvedShipTrick } from '@/lib/ai/shipTricks'

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

function buildUserPrompt(query: string, questContext?: QuestContext, trickContext?: ResolvedShipTrick): string {
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
    - If relevant, connect the answer to product strategy, systems thinking, fiction themes, or technical work.
    - ${trickContext?.styleInstruction || 'Keep the answer tight and high-signal.'}
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

    const { prompt: query, history = [], questContext } = requestData

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

    const prompt = buildUserPrompt(sanitizedQuery, questContext, trickContext)
    const generation = await generateHuggingFaceChat({
      messages: [
        { role: 'system', content: shipPersona.systemPrompt },
        ...historyMessages,
        { role: 'user', content: prompt },
      ],
      maxNewTokens: 700,
      temperature: 0.78,
    })

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Ship-AI-Provider', `huggingface:${generation.model}`)
    return res.status(200).send(generation.text)
  } catch (err: unknown) {
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
