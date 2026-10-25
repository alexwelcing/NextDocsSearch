// Workers AI chat over the env.AI binding (the Worker target, P2). Model parameters differ per
// schema, so they live in one table checked against cloudflare-docs
// src/content/workers-ai-models/<model>.json (2026-10): the OpenAI-style schemas take
// max_completion_tokens and a chat_template_kwargs.enable_thinking switch that defaults to true;
// the legacy schemas take max_tokens and stream {response} chunks.
import { modelLadder, payloadText, streamSseText, type ChatProvider } from '../chatProvider'

/** The slice of the Workers AI binding this provider uses (no generated worker types in lib/). */
export interface AiBindingLike {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<unknown>
}

export interface WorkersAiModelSpec {
  /** The token cap's field name: 'max_tokens' is deprecated on the OpenAI-style schemas. */
  maxTokensKey: 'max_completion_tokens' | 'max_tokens'
  /** chat_template_kwargs.enable_thinking exists (default true): it is sent as false. */
  thinkingSwitch: boolean
  /**
   * The catalog flags it as a reasoning model. Its reasoning never reaches the answer either way
   * (payloadText reads content only and the ladder drops <think> blocks; with no switch its
   * output is also held until </think>, in case the template opened the block), but one with no
   * switch still spends latency and tokens on it, so a ladder needs a non-reasoning fallback.
   */
  reasoning: boolean
}

export const WORKERS_AI_MODELS: Record<string, WorkersAiModelSpec> = {
  '@cf/google/gemma-4-26b-a4b-it': {
    maxTokensKey: 'max_completion_tokens',
    thinkingSwitch: true,
    reasoning: true,
  },
  '@cf/zai-org/glm-4.7-flash': {
    maxTokensKey: 'max_completion_tokens',
    thinkingSwitch: true,
    reasoning: true,
  },
  '@cf/qwen/qwen3-30b-a3b-fp8': {
    maxTokensKey: 'max_tokens',
    thinkingSwitch: false,
    reasoning: true,
  },
  '@cf/meta/llama-4-scout-17b-16e-instruct': {
    maxTokensKey: 'max_tokens',
    thinkingSwitch: false,
    reasoning: false,
  },
  '@cf/mistralai/mistral-small-3.1-24b-instruct': {
    maxTokensKey: 'max_tokens',
    thinkingSwitch: false,
    reasoning: false,
  },
}

/**
 * Gemma 4 with thinking switched off, then two models that never reason (llama-4-scout,
 * mistral-small), so the ladder stays fast exactly when the primary is failing.
 */
export const DEFAULT_WORKERS_AI_MODELS = [
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
]

/** An id outside the table gets the legacy field and is treated as reasoning, to be safe. */
const UNKNOWN_MODEL: WorkersAiModelSpec = {
  maxTokensKey: 'max_tokens',
  thinkingSwitch: false,
  reasoning: true,
}

export function workersAiModelSpec(model: string): WorkersAiModelSpec {
  return WORKERS_AI_MODELS[model] ?? UNKNOWN_MODEL
}

/** A reasoning model that cannot be told not to think may start inside a template-opened block. */
export function workersAiTemplateReasoning(model: string): boolean {
  const spec = workersAiModelSpec(model)
  return spec.reasoning && !spec.thinkingSwitch
}

/** A comma-separated SHIP_CHAT_MODELS override, else the default ladder. */
export function parseModelList(value: string | undefined, fallback = DEFAULT_WORKERS_AI_MODELS) {
  const models = (value ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter((model, index, all) => model && all.indexOf(model) === index)
  return models.length ? models : [...fallback]
}

export interface WorkersAiRequest {
  messages: { role: string; content: string }[]
  maxTokens: number
  temperature: number
}

/** The env.AI.run inputs for one model. */
export function workersAiInputs(model: string, request: WorkersAiRequest): Record<string, unknown> {
  const spec = workersAiModelSpec(model)
  return {
    messages: request.messages,
    stream: true,
    temperature: request.temperature,
    [spec.maxTokensKey]: request.maxTokens,
    ...(spec.thinkingSwitch ? { chat_template_kwargs: { enable_thinking: false } } : {}),
  }
}

function isStream(value: unknown): value is ReadableStream<Uint8Array> {
  return Boolean(value && typeof (value as ReadableStream).getReader === 'function')
}

export interface WorkersAiChatOptions {
  ai: AiBindingLike
  models?: string[]
  /** AI Gateway id: caching, logs and rate limits in front of the binding. */
  gatewayId?: string
  firstTokenMs?: number
  log?: (message: string) => void
}

export function createWorkersAiChat({
  ai,
  models = DEFAULT_WORKERS_AI_MODELS,
  gatewayId,
  firstTokenMs,
  log,
}: WorkersAiChatOptions): ChatProvider {
  return modelLadder({
    name: 'workers-ai',
    models,
    firstTokenMs,
    templateReasoning: workersAiTemplateReasoning,
    log,
    async run(model, request) {
      const options: Record<string, unknown> = { signal: request.signal }
      if (gatewayId) options.gateway = { id: gatewayId }
      const result = await ai.run(model, workersAiInputs(model, request), options)
      if (isStream(result)) {
        await streamSseText(result, request.onText, request.signal)
        return
      }
      // A model that ignores stream:true answers in one object.
      const text = payloadText(result)
      if (!text) throw new Error('empty response')
      request.onText(text)
    },
  })
}
