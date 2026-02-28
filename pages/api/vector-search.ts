import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { codeBlock, oneLine } from 'common-tags'
import GPT3Tokenizer from 'gpt3-tokenizer'
import { OpenAIStream, StreamingTextResponse } from 'ai'
import { ApplicationError, UserError } from '@/lib/errors'
import { shipPersona, extractShipSignals, extractCorpusSignals } from '@/lib/ai/shipPersona'
import { createLLMProvider, type ChatMessage } from '@/lib/ai/llm-provider'
import { processCorpusSignals } from '@/lib/ai/corpus-manager'

export const runtime = 'edge'

interface HybridResult {
  id: number
  page_id: number | null
  slug: string | null
  heading: string | null
  content: string
  source_type: string
  fts_rank: number
  vector_rank: number
  rrf_score: number
}

export default async function handler(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl) {
      throw new ApplicationError('Missing environment variable SUPABASE_URL')
    }

    if (!supabaseServiceKey) {
      throw new ApplicationError('Missing environment variable SUPABASE_SERVICE_ROLE_KEY')
    }

    const llm = createLLMProvider()

    const requestData = await req.json()

    if (!requestData) {
      throw new UserError('Missing request data')
    }

    const { prompt: query, history = [], questContext } = requestData

    if (!query) {
      throw new UserError('Missing query in request data')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Moderate the content
    const sanitizedQuery = query.trim()
    const moderation = await llm.createModeration(sanitizedQuery)

    if (moderation.flagged) {
      throw new UserError('Flagged content', {
        flagged: true,
        categories: moderation.categories,
      })
    }

    // Create embedding from query
    const { embedding } = await llm.createEmbedding(sanitizedQuery)

    // ═══════════════════════════════════════════════════════════
    // QMD-STYLE HYBRID SEARCH
    // BM25 full-text + vector semantic with RRF merging
    // ═══════════════════════════════════════════════════════════

    const { error: searchError, data: hybridResults } = await supabaseClient.rpc(
      'hybrid_search',
      {
        query_text: sanitizedQuery,
        query_embedding: embedding,
        match_count: 15,
        rrf_k: 60,
        fts_weight: 1.0,
        vector_weight: 1.0,
        min_content_length: 50,
      }
    )

    if (searchError) {
      throw new ApplicationError(
        'Hybrid search failed',
        searchError as unknown as Record<string, unknown>
      )
    }

    const results: HybridResult[] = hybridResults ?? []

    // ═══════════════════════════════════════════════════════════
    // LLM RE-RANKING
    // Score top candidates for relevance, blend with retrieval
    // ═══════════════════════════════════════════════════════════

    let rankedResults = results

    if (results.length > 3) {
      const documents = results.map(
        (r) => `${r.heading ? `${r.heading}: ` : ''}${r.content.slice(0, 300)}`
      )

      try {
        const rerankScores = await llm.rerank(sanitizedQuery, documents)

        rankedResults = results.map((result, idx) => {
          const rerankEntry = rerankScores.find((s) => s.index === idx)
          const rerankScore = rerankEntry?.score ?? 3

          // Position-aware blending: top positions trust retrieval more
          const retrievalWeight = idx < 3 ? 0.75 : 0.4
          const rerankWeight = 1 - retrievalWeight
          const normalizedRerank = rerankScore / 5

          return {
            ...result,
            rrf_score:
              result.rrf_score * retrievalWeight + normalizedRerank * rerankWeight,
          }
        })

        rankedResults.sort((a, b) => b.rrf_score - a.rrf_score)
      } catch (err) {
        // Re-ranking is non-critical; fall back to RRF order
        console.error('Re-ranking failed, using RRF order:', err)
      }
    }

    // ═══════════════════════════════════════════════════════════
    // ASSEMBLE CONTEXT
    // Build attributed context up to token budget
    // ═══════════════════════════════════════════════════════════

    const tokenizer = new GPT3Tokenizer({ type: 'gpt3' })
    let tokenCount = 0
    let contextText = ''
    const TOKEN_BUDGET = 2500

    for (const section of rankedResults) {
      const label =
        section.source_type === 'article'
          ? `[Article${section.heading ? `: "${section.heading}"` : ''}]`
          : `[Corpus: "${section.heading ?? 'untitled'}" — ${section.source_type}]`

      const block = `${label}\n${section.content.trim()}\n---\n`
      const encoded = tokenizer.encode(block)
      tokenCount += encoded.text.length

      if (tokenCount >= TOKEN_BUDGET) break

      contextText += block
    }

    // ═══════════════════════════════════════════════════════════
    // BUILD PROMPT
    // ═══════════════════════════════════════════════════════════

    const questDetails = questContext?.currentQuest
      ? `${questContext.currentQuest.title}: ${questContext.currentQuest.objective}`
      : 'No active mission'
    const missionBrief = questContext?.missionBrief
      ? `Current mission brief: ${questContext.missionBrief}`
      : 'Current mission brief: none (generate one if missing)'

    const prompt = codeBlock`
      ${oneLine`
      You are answering questions about Alex Welcing while staying in character as Ship AI.
      Draw from the provided context sections. Cite which sources you reference.
      Answer directly and substantively.`}

      Mission status:
      ${questDetails}
      Current phase: ${questContext?.currentPhase ?? 'unknown'}
      ${missionBrief}

      Context sections:
      ${contextText || 'No relevant context found.'}

      Question: """
      ${sanitizedQuery}
      """

      Answer directly, citing sources where applicable. If the context is insufficient, say so.
    `

    const historyMessages: ChatMessage[] = Array.isArray(history)
      ? history
          .slice(-shipPersona.memory.maxInteractions)
          .flatMap((entry: { question?: string; response?: string }) =>
            [
              entry.question
                ? ({ role: 'user', content: entry.question } as ChatMessage)
                : null,
              entry.response
                ? ({ role: 'assistant', content: entry.response } as ChatMessage)
                : null,
            ].filter(Boolean) as ChatMessage[]
          )
      : []

    const response = await llm.createChatCompletion({
      messages: [
        { role: 'system', content: shipPersona.systemPrompt },
        ...historyMessages,
        { role: 'user', content: prompt },
      ],
      maxTokens: 1024,
      temperature: 0.4,
      stream: true,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new ApplicationError('Failed to generate completion', error)
    }

    // ═══════════════════════════════════════════════════════════
    // STREAM WITH CORPUS SIGNAL EXTRACTION
    // Intercept streamed response, extract CORPUS_ENTRY signals,
    // process them async after streaming completes.
    // ═══════════════════════════════════════════════════════════

    const stream = OpenAIStream(response, {
      async onFinal(fullText: string) {
        // Fire-and-forget: extract and store corpus signals
        try {
          const { signals } = extractShipSignals(fullText)
          const corpusSignals = extractCorpusSignals(signals)

          if (corpusSignals.length > 0) {
            const corpusProvider = createLLMProvider()
            processCorpusSignals(corpusSignals, sanitizedQuery, corpusProvider).catch(
              (err) => console.error('Background corpus processing failed:', err)
            )
          }
        } catch (err) {
          console.error('Corpus signal extraction failed:', err)
        }
      },
    })

    return new StreamingTextResponse(stream)
  } catch (err: unknown) {
    if (err instanceof UserError) {
      return new Response(
        JSON.stringify({
          error: err.message,
          data: err.data,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } else if (err instanceof ApplicationError) {
      console.error(`${err.message}: ${JSON.stringify(err.data)}`)
    } else {
      console.error(err)
    }

    return new Response(
      JSON.stringify({
        error: 'There was an error processing your request',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
