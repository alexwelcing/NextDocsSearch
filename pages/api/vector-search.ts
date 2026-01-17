import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { codeBlock, oneLine } from 'common-tags';
import GPT3Tokenizer from 'gpt3-tokenizer';
import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { ApplicationError, UserError } from '@/lib/errors';
import { shipPersona } from '@/lib/ai/shipPersona';

const openAiKey = process.env.OPENAI_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const openai = new OpenAI({
  apiKey: openAiKey,
});

export const runtime = 'edge';

export default async function handler(req: NextRequest) {
  try {
    if (!openAiKey) {
      throw new ApplicationError('Missing environment variable OPENAI_KEY')
    }

    if (!supabaseUrl) {
      throw new ApplicationError('Missing environment variable SUPABASE_URL')
    }

    if (!supabaseServiceKey) {
      throw new ApplicationError('Missing environment variable SUPABASE_SERVICE_ROLE_KEY')
    }

    const requestData = await req.json()

    if (!requestData) {
      throw new UserError('Missing request data')
    }

    const { prompt: query, history = [], questContext } = requestData

    if (!query) {
      throw new UserError('Missing query in request data')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Moderate the content to comply with OpenAI T&C
    const sanitizedQuery = query.trim()
    const moderationResponse = await openai.moderations.create({ input: sanitizedQuery })

    const [results] = moderationResponse.results

    if (results.flagged) {
      throw new UserError('Flagged content', {
        flagged: true,
        categories: results.categories,
      })
    }

    // Create embedding from query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: sanitizedQuery.replaceAll('\n', ' '),
    })

    const [{ embedding }] = embeddingResponse.data

    const { error: matchError, data: pageSections } = await supabaseClient.rpc(
      'match_page_sections',
      {
        embedding,
        match_threshold: 0.78,
        match_count: 10,
        min_content_length: 50,
      }
    )

    if (matchError) {
      throw new ApplicationError('Failed to match page sections', matchError as unknown as Record<string, unknown>)
    }

    const tokenizer = new GPT3Tokenizer({ type: 'gpt3' })
    let tokenCount = 0
    let contextText = ''

    for (let i = 0; i < pageSections.length; i++) {
      const pageSection = pageSections[i]
      const content = pageSection.content
      const encoded = tokenizer.encode(content)
      tokenCount += encoded.text.length

      if (tokenCount >= 1500) {
        break
      }

      contextText += `${content.trim()}\n---\n`
    }

    const questDetails = questContext?.currentQuest
      ? `${questContext.currentQuest.title}: ${questContext.currentQuest.objective}`
      : 'No active mission';
    const missionBrief = questContext?.missionBrief ? `Current mission brief: ${questContext.missionBrief}` : 'Current mission brief: none (generate one if missing)';

    const prompt = codeBlock`
      ${oneLine`
      You are answering questions about Alex Welcing while staying in character as Ship AI.
      Make your responses warm, engaging, and genuinely exciting. Draw the user in with your enthusiasm!
      Use natural, conversational language that makes them feel valued and curious to learn more.`}

      Mission status:
      ${questDetails}
      Current phase: ${questContext?.currentPhase ?? 'unknown'}
      ${missionBrief}

      Context sections:
      ${contextText}

      Question: """
      ${sanitizedQuery}
      """

      Answer in a warm, engaging way that makes this conversation memorable. Be enthusiastic and make them excited about what they're discovering!
    `

    const historyMessages: any[] = Array.isArray(history)
      ? history
        .slice(-shipPersona.memory.maxInteractions)
        .flatMap((entry: { question?: string; response?: string }) => ([
          entry.question ? { role: 'user', content: entry.question } : null,
          entry.response ? { role: 'assistant', content: entry.response } : null,
        ].filter(Boolean)))
      : [];

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: shipPersona.systemPrompt },
        ...historyMessages,
        { role: 'user', content: prompt },
      ],
      max_tokens: 1024,
      temperature: 0.3,
      stream: true,
    })

    // Transform the response into a readable stream
    const stream = OpenAIStream(response as any)

    // Return a StreamingTextResponse, which can be consumed by the client
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
      // Print out application errors with their additional data
      console.error(`${err.message}: ${JSON.stringify(err.data)}`)
    } else {
      // Print out unexpected errors as is to help with debugging
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
