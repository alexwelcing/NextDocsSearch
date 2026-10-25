// Hugging Face router chat: the Vercel target's provider until the Worker takes over /api/*.
import { modelLadder, payloadText, streamSseText, type ChatProvider } from '../chatProvider'

// Router models get deprecated often — every entry here was verified live on
// https://router.huggingface.co/v1/models (the old Orenguteng/Llama-3.1-8B-Lexi-Uncensored-V2
// primary is gone from the router entirely). Bare ids let the router auto-select any provider
// currently serving the model; pin one explicitly with 'model:provider' via HF_CHAT_MODEL.
export const DEFAULT_HF_MODELS = [
  'meta-llama/Llama-3.1-8B-Instruct',
  'Qwen/Qwen2.5-7B-Instruct',
  'meta-llama/Llama-3.3-70B-Instruct',
]
const HUGGING_FACE_CHAT_COMPLETIONS_URL = 'https://router.huggingface.co/v1/chat/completions'

/**
 * Only the defaults are known not to reason. Any other id (an HF_CHAT_MODEL override) may start
 * inside a template-opened <think> block, so its output is held until </think> or the end.
 */
export function huggingFaceTemplateReasoning(model: string): boolean {
  return !DEFAULT_HF_MODELS.includes(model.replace(/:[^/]*$/, ''))
}

export interface HuggingFaceChatOptions {
  token: string
  models?: string[]
  fetch?: typeof fetch
  firstTokenMs?: number
  log?: (message: string) => void
}

export function createHuggingFaceChat({
  token,
  models = DEFAULT_HF_MODELS,
  fetch: fetchImpl = fetch,
  firstTokenMs,
  log,
}: HuggingFaceChatOptions): ChatProvider {
  return modelLadder({
    name: 'huggingface',
    models,
    firstTokenMs,
    templateReasoning: huggingFaceTemplateReasoning,
    log,
    async run(model, request) {
      const response = await fetchImpl(HUGGING_FACE_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: request.messages,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          stream: true,
        }),
        signal: request.signal,
      })
      if (!response.ok) {
        const body = (await response.text().catch(() => '')).slice(0, 300)
        throw new Error(`HTTP ${response.status}${body ? `: ${body}` : ''}`)
      }
      if (!(response.headers.get('content-type') ?? '').includes('text/event-stream')) {
        const text = payloadText(await response.json())
        if (!text) throw new Error('empty response')
        request.onText(text)
        return
      }
      if (!response.body) throw new Error('response body missing')
      await streamSseText(response.body, request.onText, request.signal)
    },
  })
}

/** The provider when HF_TOKEN is set (HF_CHAT_MODEL first); without it Ship answers from the
 *  archive alone. */
export function huggingFaceChatFromEnv(
  env: Record<string, string | undefined> = process.env
): ChatProvider | null {
  const token = env.HF_TOKEN?.trim()
  if (!token) return null
  const configured = env.HF_CHAT_MODEL?.trim()
  const models = [configured, ...DEFAULT_HF_MODELS].filter(
    (model, index, all): model is string => Boolean(model) && all.indexOf(model) === index
  )
  return createHuggingFaceChat({ token, models })
}
