import { ApplicationError } from '@/lib/errors'

const DEFAULT_PROVIDER = 'featherless-ai'
const DEFAULT_PRIMARY_MODEL = 'Orenguteng/Llama-3.1-8B-Lexi-Uncensored-V2'
const DEFAULT_FALLBACK_MODEL = 'Qwen/Qwen2.5-7B-Instruct'
const HUGGING_FACE_CHAT_COMPLETIONS_URL = 'https://router.huggingface.co/v1/chat/completions'

export interface HfChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface HfChatOptions {
  messages: HfChatMessage[]
  maxNewTokens?: number
  temperature?: number
}

interface HfGenerationResult {
  text: string
  model: string
}

function getHfToken(): string {
  const token = process.env.HF_TOKEN?.trim()

  if (!token) {
    throw new ApplicationError('Missing environment variable HF_TOKEN')
  }

  return token
}

function getCandidateModels(): string[] {
  const configured = process.env.HF_CHAT_MODEL?.trim()

  return [configured, DEFAULT_PRIMARY_MODEL, DEFAULT_FALLBACK_MODEL]
    .filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index)
    .map((value) => (value.includes(':') ? value : `${value}:${DEFAULT_PROVIDER}`))
}

function extractGeneratedText(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const text = extractGeneratedText(item)
      if (text) return text
    }
    return ''
  }

  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const record = payload as Record<string, unknown>

  if (typeof record.generated_text === 'string') {
    return record.generated_text
  }

  if (typeof record.text === 'string') {
    return record.text
  }

  if (typeof record.response === 'string') {
    return record.response
  }

  if (Array.isArray(record.choices) && record.choices.length > 0) {
    const firstChoice = record.choices[0] as Record<string, unknown>
    const message = firstChoice.message as Record<string, unknown> | undefined

    if (message && typeof message.content === 'string') {
      return message.content
    }

    if (typeof firstChoice.text === 'string') {
      return firstChoice.text
    }
  }

  return ''
}

async function generateWithModel(model: string, options: HfChatOptions): Promise<string> {
  const token = getHfToken()
  const response = await fetch(HUGGING_FACE_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      max_tokens: options.maxNewTokens ?? 700,
      temperature: options.temperature ?? 0.75,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new ApplicationError(`Hugging Face generation failed for ${model}`, {
      status: response.status,
      body: errorText.slice(0, 500),
    })
  }

  const payload = await response.json()
  const text = extractGeneratedText(payload).trim()

  if (!text) {
    throw new ApplicationError(`Hugging Face returned an empty response for ${model}`)
  }

  return text
}

export async function generateHuggingFaceChat(options: HfChatOptions): Promise<HfGenerationResult> {
  const models = getCandidateModels()
  let lastError: unknown = null

  for (const model of models) {
    try {
      const text = await generateWithModel(model, options)
      return { text, model }
    } catch (error) {
      lastError = error
      console.error('[hf-chat] Model failed:', model, error)
    }
  }

  if (lastError instanceof ApplicationError) {
    throw lastError
  }

  throw new ApplicationError('All Hugging Face chat models failed')
}

export function getDefaultHfChatModel(): string {
  return getCandidateModels()[0]
}