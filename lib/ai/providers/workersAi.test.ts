import { describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../chatProvider'
import { byteStream, sseFixture } from '../testing'
import {
  DEFAULT_WORKERS_AI_MODELS,
  WORKERS_AI_MODELS,
  createWorkersAiChat,
  parseModelList,
  workersAiInputs,
  workersAiModelSpec,
  type AiBindingLike,
} from './workersAi'

const MESSAGES: ChatMessage[] = [
  { role: 'system', content: 'persona' },
  { role: 'user', content: 'who is alex?' },
]
const REQUEST = {
  messages: MESSAGES,
  maxTokens: 700,
  temperature: 0.35,
}

describe('workersAiInputs', () => {
  it('sends gemma-4 max_completion_tokens with thinking switched off', () => {
    expect(workersAiInputs('@cf/google/gemma-4-26b-a4b-it', REQUEST)).toEqual({
      messages: REQUEST.messages,
      stream: true,
      temperature: 0.35,
      max_completion_tokens: 700,
      chat_template_kwargs: { enable_thinking: false },
    })
  })

  it('switches glm-4.7-flash thinking off the same way', () => {
    expect(workersAiInputs('@cf/zai-org/glm-4.7-flash', REQUEST)).toMatchObject({
      max_completion_tokens: 700,
      chat_template_kwargs: { enable_thinking: false },
    })
  })

  it('sends qwen3 and the legacy schemas max_tokens and no thinking switch', () => {
    for (const model of [
      '@cf/qwen/qwen3-30b-a3b-fp8',
      '@cf/meta/llama-4-scout-17b-16e-instruct',
      '@cf/mistralai/mistral-small-3.1-24b-instruct',
      '@cf/unknown/new-model',
    ]) {
      const inputs = workersAiInputs(model, REQUEST)
      expect(inputs).toMatchObject({ max_tokens: 700, stream: true, temperature: 0.35 })
      expect(inputs).not.toHaveProperty('max_completion_tokens')
      expect(inputs).not.toHaveProperty('chat_template_kwargs')
    }
  })

  it('treats a model outside the table as a reasoning model on the legacy schema', () => {
    expect(workersAiModelSpec('@cf/unknown/new-model')).toEqual({
      maxTokensKey: 'max_tokens',
      thinkingSwitch: false,
      reasoning: true,
    })
  })
})

describe('the default ladder', () => {
  it('only names tabled models, and falls back to a non-reasoning one', () => {
    for (const model of DEFAULT_WORKERS_AI_MODELS) expect(WORKERS_AI_MODELS).toHaveProperty([model])
    const [primary, ...fallbacks] = DEFAULT_WORKERS_AI_MODELS
    const spec = WORKERS_AI_MODELS[primary]
    expect(!spec.reasoning || spec.thinkingSwitch).toBe(true)
    expect(fallbacks.some((model) => !WORKERS_AI_MODELS[model].reasoning)).toBe(true)
  })

  it('takes a comma-separated SHIP_CHAT_MODELS override', () => {
    expect(parseModelList(' @cf/a , @cf/b,,@cf/a ')).toEqual(['@cf/a', '@cf/b'])
    expect(parseModelList('')).toEqual(DEFAULT_WORKERS_AI_MODELS)
    expect(parseModelList(undefined)).toEqual(DEFAULT_WORKERS_AI_MODELS)
  })
})

function fakeAi(results: Record<string, () => unknown>) {
  const run = vi.fn(async (model: string, _inputs: Record<string, unknown>, _options?: unknown) => {
    const result = results[model]
    if (!result) throw new Error(`3040: capacity exceeded for ${model}`)
    return result()
  })
  return { ai: { run } satisfies AiBindingLike, run }
}

describe('createWorkersAiChat', () => {
  it('streams gemma-4 deltas without its reasoning, through the gateway', async () => {
    const { ai, run } = fakeAi({
      '@cf/google/gemma-4-26b-a4b-it': () => byteStream(sseFixture('workers-ai-gemma-4'), 40),
    })
    const deltas: string[] = []
    const chat = createWorkersAiChat({ ai, gatewayId: 'ship', log: () => undefined })
    const result = await chat.stream({ ...REQUEST, onDelta: (delta) => deltas.push(delta) })
    expect(result).toEqual({
      text: 'Alex Welcing builds AI products for regulated industries.',
      provider: 'workers-ai:@cf/google/gemma-4-26b-a4b-it',
    })
    expect(deltas.join('')).toBe(result.text)
    const [model, inputs, options] = run.mock.calls[0]
    expect(model).toBe('@cf/google/gemma-4-26b-a4b-it')
    expect(inputs).toMatchObject({ chat_template_kwargs: { enable_thinking: false } })
    expect(options).toMatchObject({ gateway: { id: 'ship' } })
    expect((options as { signal?: unknown }).signal).toBeInstanceOf(AbortSignal)
  })

  it('fails over to the non-reasoning llama-4-scout and its {response} stream', async () => {
    const { ai, run } = fakeAi({
      '@cf/meta/llama-4-scout-17b-16e-instruct': () =>
        byteStream(sseFixture('workers-ai-llama-4-scout'), 7),
    })
    const chat = createWorkersAiChat({ ai, log: () => undefined })
    const result = await chat.stream({ ...REQUEST, onDelta: () => undefined })
    expect(result.provider).toBe('workers-ai:@cf/meta/llama-4-scout-17b-16e-instruct')
    expect(result.text).toBe('Alex Welcing builds AI products for regulated industries.')
    expect(run.mock.calls.map(([model]) => model)).toEqual(DEFAULT_WORKERS_AI_MODELS.slice(0, 2))
    expect(run.mock.calls[1][1]).toMatchObject({ max_tokens: 700 })
  })

  it('strips qwen3 think blocks and reasoning_content from the answer', async () => {
    const { ai } = fakeAi({
      '@cf/qwen/qwen3-30b-a3b-fp8': () => byteStream(sseFixture('workers-ai-qwen3-think'), 9),
    })
    const deltas: string[] = []
    const chat = createWorkersAiChat({ ai, models: ['@cf/qwen/qwen3-30b-a3b-fp8'] })
    const result = await chat.stream({ ...REQUEST, onDelta: (delta) => deltas.push(delta) })
    expect(result.text).toBe('Quantum key distribution uses photon polarization.')
    expect(deltas.join('')).toBe(result.text)
  })

  it('accepts a model that answers in one object', async () => {
    const { ai } = fakeAi({ '@cf/x': () => ({ response: 'Whole answer.' }) })
    const chat = createWorkersAiChat({ ai, models: ['@cf/x'] })
    expect((await chat.stream({ ...REQUEST, onDelta: () => undefined })).text).toBe('Whole answer.')
  })
})
