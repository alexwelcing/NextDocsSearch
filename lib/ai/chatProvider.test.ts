import { describe, expect, it, vi } from 'vitest'
import {
  ChatStreamError,
  createReasoningFilter,
  modelLadder,
  payloadText,
  readSseStream,
  streamSseText,
  type ChatRequest,
  type LadderOptions,
} from './chatProvider'
import { byteStream, sseFixture, type SseFixture } from './testing'

async function sseText(text: string, size?: number) {
  let out = ''
  await streamSseText(byteStream(text, size), (delta) => {
    out += delta
  })
  return out
}

const EXPECTED: Record<SseFixture, string> = {
  'workers-ai-gemma-4': 'Alex Welcing builds AI products for regulated industries.',
  'workers-ai-llama-4-scout': 'Alex Welcing builds AI products for regulated industries.',
  // The raw content still carries the <think> block: the ladder's filter removes it.
  'workers-ai-qwen3-think':
    '<think>The context mentions BB84.</think>\n\nQuantum key distribution uses photon polarization.',
  // Template-opened: only the close tag marks the reasoning, which a held filter drops.
  'workers-ai-qwen3-template-open':
    'Okay, let me look at the context. It mentions BB84.</think>\n\n' +
    'Quantum key distribution uses photon polarization.',
  'huggingface-router': 'Alex Welcing builds AI products.',
}

describe('streamSseText', () => {
  it.each(Object.keys(EXPECTED) as SseFixture[])(
    'reads the %s transcript at any chunking',
    async (name) => {
      const fixture = sseFixture(name)
      for (const size of [Infinity, 1, 3, 17, 64]) {
        expect(await sseText(fixture, size)).toBe(EXPECTED[name])
      }
      expect(await sseText(fixture.replace(/\n/g, '\r\n'), 5)).toBe(EXPECTED[name])
    }
  )

  it('never reads reasoning fields', async () => {
    const text = await sseText(sseFixture('workers-ai-gemma-4'))
    expect(text).not.toContain('profile answer')
    expect(await sseText(sseFixture('workers-ai-qwen3-think'))).not.toContain('Okay, let me')
  })

  it('keeps multi-byte characters split across chunks', async () => {
    const line = `data: ${JSON.stringify({ response: 'New York–based — café' })}\n\n`
    expect(await sseText(line, 1)).toBe('New York–based — café')
  })

  it('dispatches a final event that has no trailing blank line', async () => {
    expect(await sseText('data: {"response":"tail"}')).toBe('tail')
  })

  it('skips keep-alives and unparseable data, and throws on an in-stream error', async () => {
    expect(await sseText(': ping\n\ndata: not json\n\ndata: {"response":"ok"}\n\n')).toBe('ok')
    await expect(
      sseText('data: {"response":"a"}\n\ndata: {"error":"overloaded"}\n\n')
    ).rejects.toThrow('overloaded')
  })

  it('joins multi-line data fields', async () => {
    const data: string[] = []
    await readSseStream(byteStream('data: {"response":\ndata: "x"}\n\n'), (value) =>
      data.push(value)
    )
    expect(data).toEqual(['{"response":\n"x"}'])
  })

  it('keeps a multi-line CRLF event whole wherever a chunk splits its line ends', async () => {
    const text = 'data: {"response":\r\ndata: "x"}\r\n\r\ndata: {"response":"y"}\r\n\r\n'
    const bytes = new TextEncoder().encode(text)
    for (let cut = 1; cut < bytes.length; cut++) {
      const body = new ReadableStream<Uint8Array>({
        start(stream) {
          stream.enqueue(bytes.slice(0, cut))
          stream.enqueue(bytes.slice(cut))
          stream.close()
        },
      })
      const data: string[] = []
      await readSseStream(body, (value) => data.push(value))
      expect(data).toEqual(['{"response":\n"x"}', '{"response":"y"}'])
    }
  })

  it('stops reading when aborted', async () => {
    const controller = new AbortController()
    const body = new ReadableStream<Uint8Array>({
      start(stream) {
        stream.enqueue(new TextEncoder().encode('data: {"response":"first"}\n\n'))
      },
    })
    const seen: string[] = []
    const reading = streamSseText(
      body,
      (text) => {
        seen.push(text)
        controller.abort()
      },
      controller.signal
    )
    await expect(reading).rejects.toThrow('aborted')
    expect(seen).toEqual(['first'])
  })
})

describe('payloadText', () => {
  it('accepts both wire shapes and whole messages', () => {
    expect(payloadText({ response: 'a' })).toBe('a')
    expect(payloadText({ choices: [{ delta: { content: 'b' } }] })).toBe('b')
    expect(
      payloadText({ choices: [{ delta: { content: [{ type: 'text', text: 'c' }, 'd'] } }] })
    ).toBe('cd')
    expect(payloadText({ choices: [{ message: { content: 'e', reasoning_content: 'no' } }] })).toBe(
      'e'
    )
    expect(
      payloadText({ choices: [{ delta: { reasoning: 'hidden', reasoning_content: 'no' } }] })
    ).toBe('')
    expect(payloadText({ choices: [] })).toBe('')
    expect(payloadText(null)).toBe('')
  })

  it('reads choices when a chunk also carries an empty response', () => {
    expect(payloadText({ response: '', choices: [{ delta: { content: 'hi' } }] })).toBe('hi')
    expect(payloadText({ response: '' })).toBe('')
    expect(payloadText({ response: 'r', choices: [{ delta: { content: 'c' } }] })).toBe('r')
  })
})

describe('createReasoningFilter', () => {
  function run(chunks: string[]) {
    const filter = createReasoningFilter()
    return chunks.map((chunk) => filter.push(chunk)).join('') + filter.flush()
  }

  it('drops think blocks split anywhere, with the whitespace they leave', () => {
    const text = '<think>plan the answer</think>\n\nThe answer.'
    for (let cut = 0; cut <= text.length; cut++) {
      expect(run([text.slice(0, cut), text.slice(cut)])).toBe('The answer.')
    }
    expect(run([...text])).toBe('The answer.')
  })

  it('drops blocks mid-answer and keeps ordinary angle brackets', () => {
    expect(run(['a <b> ', '<think>x</think>', 'c < d <'])).toBe('a <b> c < d <')
  })

  it('drops an unclosed block and an orphan close tag before any answer', () => {
    expect(run(['Answer. <think>never closed'])).toBe('Answer. ')
    expect(run(['template-opened reasoning</think>\nAnswer.'])).toBe('Answer.')
  })

  describe('when the template opens the block', () => {
    function held(chunks: string[]) {
      const filter = createReasoningFilter({ templateOpens: true })
      const pushed = chunks.map((chunk) => filter.push(chunk))
      return { pushed, text: pushed.join('') + filter.flush() }
    }
    const reasoning = ['Okay, let me', ' look at the context.', '</think>', '\n\nQuantum keys.']

    it('drops reasoning that spans chunks before the close tag', () => {
      const { pushed, text } = held(reasoning)
      expect(text).toBe('Quantum keys.')
      expect(pushed.slice(0, 3)).toEqual(['', '', ''])
      // Without the hold, the first chunks have already gone out by the time </think> arrives.
      expect(run(reasoning)).toContain('Okay, let me')
    })

    it('finds a close tag split anywhere', () => {
      const text = 'Plan the answer.</think>\n\nThe answer.'
      for (let cut = 0; cut <= text.length; cut++) {
        expect(held([text.slice(0, cut), text.slice(cut)]).text).toBe('The answer.')
      }
      expect(held([...text]).text).toBe('The answer.')
    })

    it('releases everything at the end when no reasoning came', () => {
      const { pushed, text } = held(['No reasoning ', 'here, a < b.'])
      expect(pushed).toEqual(['', ''])
      expect(text).toBe('No reasoning here, a < b.')
    })

    it('streams as usual once the model opens the block itself', () => {
      const { pushed, text } = held(['\n<think>plan</think>', 'Visible ', 'at once.'])
      expect(pushed).toEqual(['', 'Visible ', 'at once.'])
      expect(text).toBe('Visible at once.')
    })
  })
})

function request(overrides: Partial<ChatRequest> = {}): ChatRequest & { deltas: string[] } {
  const deltas: string[] = []
  return {
    messages: [{ role: 'user', content: 'hi' }],
    maxTokens: 50,
    temperature: 0.5,
    onDelta: (delta) => deltas.push(delta),
    deltas,
    ...overrides,
  }
}

function ladder(run: LadderOptions['run'], extra: Partial<LadderOptions> = {}) {
  return modelLadder({ name: 'fake', models: ['m1', 'm2'], run, log: () => undefined, ...extra })
}

describe('modelLadder', () => {
  it('streams visible text and names the model', async () => {
    const chat = ladder(async (_model, req) => {
      req.onText('<think>hmm</think>Hel')
      req.onText('lo.')
    })
    const req = request()
    expect(await chat.stream(req)).toEqual({ text: 'Hello.', provider: 'fake:m1' })
    expect(req.deltas.join('')).toBe('Hello.')
  })

  it('fails over before the first token', async () => {
    const run = vi.fn(async (model: string, req: { onText: (text: string) => void }) => {
      if (model === 'm1') throw new Error('HTTP 503')
      req.onText('From m2.')
    })
    const req = request()
    expect(await ladder(run).stream(req)).toEqual({ text: 'From m2.', provider: 'fake:m2' })
    expect(run).toHaveBeenCalledTimes(2)
    expect(req.deltas).toEqual(['From m2.'])
  })

  it('treats an empty or all-reasoning completion as a failure', async () => {
    const chat = ladder(async (model, req) => {
      req.onText(model === 'm1' ? '<think>only thoughts</think>  ' : 'Real.')
    })
    expect((await chat.stream(request())).provider).toBe('fake:m2')
  })

  it('raises ChatStreamError when a model breaks mid-answer', async () => {
    const run = vi.fn(async (_model: string, req: { onText: (text: string) => void }) => {
      req.onText('Partial ')
      throw new Error('socket reset')
    })
    const error = await ladder(run)
      .stream(request())
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ChatStreamError)
    expect(error).toMatchObject({ partial: 'Partial ', provider: 'fake:m1' })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('abandons a model that sends nothing before the first-token deadline', async () => {
    const chat = ladder(
      (model, req) =>
        model === 'm1'
          ? new Promise((_resolve, reject) =>
              req.signal?.addEventListener('abort', () => reject(new Error('aborted')))
            )
          : Promise.resolve(req.onText('Fast.')),
      { firstTokenMs: 20 }
    )
    expect(await chat.stream(request())).toEqual({ text: 'Fast.', provider: 'fake:m2' })
  })

  it('holds a template-reasoning model until </think>, and its held text beats the deadline', async () => {
    const pause = () => new Promise((resolve) => setTimeout(resolve, 15))
    const chat = ladder(
      async (_model, req) => {
        for (const chunk of ['Okay, let me', ' think it over.', '</think>\n\nQuantum ', 'keys.']) {
          await pause()
          req.onText(chunk)
        }
      },
      { firstTokenMs: 20, templateReasoning: (model) => model === 'm1' }
    )
    const req = request()
    expect(await chat.stream(req)).toEqual({ text: 'Quantum keys.', provider: 'fake:m1' })
    expect(req.deltas.join('')).toBe('Quantum keys.')
  })

  it('rejects when every model fails, and stops when the caller aborts', async () => {
    const failing = ladder(async () => {
      throw new Error('down')
    })
    await expect(failing.stream(request())).rejects.toThrow(
      'fake: no model answered (m1: down; m2: down)'
    )

    const controller = new AbortController()
    const run = vi.fn(async () => {
      controller.abort()
      throw new Error('aborted')
    })
    await expect(ladder(run).stream(request({ signal: controller.signal }))).rejects.toThrow()
    expect(run).toHaveBeenCalledTimes(1)
  })
})
