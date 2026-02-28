import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { LLMProvider } from './llm-provider'

export interface CorpusEntry {
  url?: string
  title: string
  content: string
  summary?: string
  sourceType: 'discovered' | 'article' | 'curated'
  discoveredInChatId?: string
  discoveredFromQuery?: string
  metadata?: Record<string, unknown>
}

export interface StoredCorpusEntry extends CorpusEntry {
  id: number
  createdAt: string
  updatedAt: string
}

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase environment variables')
  return createClient(url, key)
}

export async function saveCorpusEntry(
  entry: CorpusEntry,
  llmProvider: LLMProvider
): Promise<number> {
  const supabase = getSupabaseClient()

  // Generate embedding from the content
  const textForEmbedding = `${entry.title}. ${entry.summary ?? entry.content}`
  const { embedding } = await llmProvider.createEmbedding(textForEmbedding)

  const { data, error } = await supabase.rpc('upsert_corpus_entry', {
    p_url: entry.url ?? null,
    p_title: entry.title,
    p_content: entry.content,
    p_summary: entry.summary ?? null,
    p_source_type: entry.sourceType,
    p_discovered_in_chat_id: entry.discoveredInChatId ?? null,
    p_discovered_from_query: entry.discoveredFromQuery ?? null,
    p_metadata: entry.metadata ?? {},
    p_embedding: embedding,
  })

  if (error) {
    console.error('Failed to save corpus entry:', error)
    throw new Error(`Corpus save failed: ${error.message}`)
  }

  return data as number
}

export async function processCorpusSignals(
  signals: { title?: string; summary?: string; url?: string }[],
  query: string,
  llmProvider: LLMProvider
): Promise<void> {
  for (const signal of signals) {
    if (!signal.title) continue

    try {
      await saveCorpusEntry(
        {
          url: signal.url,
          title: signal.title,
          content: signal.summary ?? `${signal.title}. External reference discovered during conversation.`,
          summary: signal.summary,
          sourceType: 'discovered',
          discoveredFromQuery: query,
          metadata: { autoDiscovered: true },
        },
        llmProvider
      )
    } catch (err) {
      // Non-blocking: log but don't fail the response
      console.error('Corpus signal processing failed:', err)
    }
  }
}
