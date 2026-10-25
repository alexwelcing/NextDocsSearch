import { describe, expect, it, vi } from 'vitest'
import { byteStream, sseFixture } from '../testing'
import {
  DEFAULT_HF_MODELS,
  createHuggingFaceChat,
  huggingFaceChatFromEnv,
  huggingFaceTemplateReasoning,
} from './huggingface'

const REQUEST = {
  messages: [{ role: 'user' as const, content: 'who is alex?' }],
  maxTokens: 700,
  temperature: 0.78,
}

function sse(text: string) {
  return new Response(byteStream(text, 11), {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('createHuggingFaceChat', () => {
  it('streams the router transcript with the documented request body', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      sse(sseFixture('huggingface-router'))
    )
    const deltas: string[] = []
    const chat = createHuggingFaceChat({ token: 'hf_test', fetch: fetchMock as typeof fetch })
    const result = await chat.stream({ ...REQUEST, onDelta: (delta) => deltas.push(delta) })
    expect(result).toEqual({
      text: 'Alex Welcing builds AI products.',
      provider: `huggingface:${DEFAULT_HF_MODELS[0]}`,
    })
    expect(deltas.join('')).toBe(result.text)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://router.huggingface.co/v1/chat/completions')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer hf_test' })
    expect(JSON.parse(String(init?.body))).toEqual({
      model: DEFAULT_HF_MODELS[0],
      messages: REQUEST.messages,
      max_tokens: 700,
      temperature: 0.78,
      stream: true,
    })
  })

  it('fails over past an HTTP error and accepts a non-streamed JSON reply', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const { model } = JSON.parse(String(init?.body))
      if (model === 'a') return new Response('{"error":"Invalid credentials"}', { status: 401 })
      return Response.json({ choices: [{ message: { role: 'assistant', content: 'From b.' } }] })
    })
    const chat = createHuggingFaceChat({
      token: 'hf_test',
      models: ['a', 'b'],
      fetch: fetchMock as typeof fetch,
      log: () => undefined,
    })
    expect(await chat.stream({ ...REQUEST, onDelta: () => undefined })).toEqual({
      text: 'From b.',
      provider: 'huggingface:b',
    })
  })
})

describe('huggingFaceTemplateReasoning', () => {
  it('streams the known defaults and holds any other model until </think>', async () => {
    for (const model of DEFAULT_HF_MODELS) {
      expect(huggingFaceTemplateReasoning(model)).toBe(false)
      expect(huggingFaceTemplateReasoning(`${model}:novita`)).toBe(false)
    }
    expect(huggingFaceTemplateReasoning('Qwen/Qwen3-32B')).toBe(true)

    const reasoning = ['Okay, let me', ' look.', '</think>\n\nAlex builds ', 'AI products.']
    const body = reasoning
      .map((content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
      .join('')
    const chat = createHuggingFaceChat({
      token: 'hf_test',
      models: ['Qwen/Qwen3-32B'],
      fetch: (async () => sse(body)) as typeof fetch,
    })
    const deltas: string[] = []
    const result = await chat.stream({ ...REQUEST, onDelta: (delta) => deltas.push(delta) })
    expect(result.text).toBe('Alex builds AI products.')
    expect(deltas.join('')).toBe(result.text)
  })
})

describe('huggingFaceChatFromEnv', () => {
  it('needs HF_TOKEN', () => {
    expect(huggingFaceChatFromEnv({})).toBeNull()
    expect(huggingFaceChatFromEnv({ HF_TOKEN: '  ' })).toBeNull()
  })

  it('tries HF_CHAT_MODEL before the defaults', async () => {
    const models: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        models.push(JSON.parse(String(init?.body)).model)
        return new Response('gone', { status: 410 })
      })
    )
    try {
      const chat = huggingFaceChatFromEnv({
        HF_TOKEN: 'hf_test',
        HF_CHAT_MODEL: DEFAULT_HF_MODELS[1],
      })
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      await expect(chat?.stream({ ...REQUEST, onDelta: () => undefined })).rejects.toThrow(
        'no model answered'
      )
      expect(models).toEqual([DEFAULT_HF_MODELS[1], DEFAULT_HF_MODELS[0], DEFAULT_HF_MODELS[2]])
    } finally {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    }
  })
})
