import {
  Configuration,
  OpenAIApi,
  type ChatCompletionRequestMessage,
} from 'openai-edge'

// ═══════════════════════════════════════════════════════════════
// LLM Provider Abstraction
// Currently wraps OpenAI. Structured so HuggingFace or other
// providers can be swapped in via env config.
// ═══════════════════════════════════════════════════════════════

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionParams {
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
  stream?: boolean
  model?: string
}

export interface RerankResult {
  index: number
  score: number
  document: string
}

export interface EmbeddingResult {
  embedding: number[]
}

export interface LLMProvider {
  createEmbedding(input: string): Promise<EmbeddingResult>
  createChatCompletion(params: ChatCompletionParams): Promise<Response>
  createModeration(input: string): Promise<{ flagged: boolean; categories?: unknown }>
  rerank(query: string, documents: string[]): Promise<RerankResult[]>
}

// ═══════════════════════════════════════════════════════════════
// OpenAI Provider
// ═══════════════════════════════════════════════════════════════

class OpenAIProvider implements LLMProvider {
  private client: OpenAIApi

  constructor(apiKey: string) {
    const config = new Configuration({ apiKey })
    this.client = new OpenAIApi(config)
  }

  async createEmbedding(input: string): Promise<EmbeddingResult> {
    const response = await this.client.createEmbedding({
      model: 'text-embedding-ada-002',
      input: input.replaceAll('\n', ' '),
    })

    if (response.status !== 200) {
      throw new Error(`Embedding failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return { embedding: data.data[0].embedding }
  }

  async createChatCompletion(params: ChatCompletionParams): Promise<Response> {
    const messages: ChatCompletionRequestMessage[] = params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    return this.client.createChatCompletion({
      model: params.model ?? 'gpt-4-turbo-preview',
      messages,
      max_tokens: params.maxTokens ?? 1024,
      temperature: params.temperature ?? 0.4,
      stream: params.stream ?? true,
    })
  }

  async createModeration(
    input: string
  ): Promise<{ flagged: boolean; categories?: unknown }> {
    const response = await this.client
      .createModeration({ input })
      .then((res) => res.json())

    const [results] = response.results
    return { flagged: results.flagged, categories: results.categories }
  }

  async rerank(query: string, documents: string[]): Promise<RerankResult[]> {
    if (documents.length === 0) return []

    const numbered = documents
      .map((doc, i) => `[${i}] ${doc.slice(0, 200)}`)
      .join('\n\n')

    const response = await this.client.createChatCompletion({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content:
            'You are a relevance scorer. Rate each document\'s relevance to the query on a scale of 1-5. Respond ONLY with a JSON array of objects: [{"index": 0, "score": 5}, ...]. No explanation.',
        },
        {
          role: 'user',
          content: `Query: "${query}"\n\nDocuments:\n${numbered}`,
        },
      ],
      max_tokens: 512,
      temperature: 0,
      stream: false,
    })

    if (!response.ok) return documents.map((doc, i) => ({ index: i, score: 3, document: doc }))

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? '[]'

    try {
      const scores: { index: number; score: number }[] = JSON.parse(content)
      return scores.map((s) => ({
        index: s.index,
        score: s.score,
        document: documents[s.index] ?? '',
      }))
    } catch {
      return documents.map((doc, i) => ({ index: i, score: 3, document: doc }))
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Factory
// Reads LLM_PROVIDER env to decide which provider to use.
// Currently only 'openai' is implemented. When HuggingFace
// fine-tuning is ready, add a HuggingFaceProvider here.
// ═══════════════════════════════════════════════════════════════

export function createLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER ?? 'openai'

  switch (provider) {
    case 'openai': {
      const apiKey = process.env.OPENAI_KEY
      if (!apiKey) throw new Error('Missing OPENAI_KEY environment variable')
      return new OpenAIProvider(apiKey)
    }
    // TODO: Add HuggingFace provider when fine-tuned model is ready
    // case 'huggingface': {
    //   const apiKey = process.env.HF_API_KEY
    //   const endpoint = process.env.HF_INFERENCE_ENDPOINT
    //   return new HuggingFaceProvider(apiKey, endpoint)
    // }
    default:
      throw new Error(`Unknown LLM provider: ${provider}`)
  }
}
