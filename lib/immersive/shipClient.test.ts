import { describe, expect, it, vi } from 'vitest'
import { byteStream } from '../ai/testing'
import { readShipStream, sourceModal, type ShipStreamHandlers } from './shipClient'

function handlers() {
  const calls: unknown[][] = []
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      calls.push([name, ...args])
  const value: Required<ShipStreamHandlers> = {
    onInstant: record('instant'),
    onDelta: record('delta'),
    onFinal: record('final'),
    onError: record('error'),
  }
  return { calls, value }
}

const lines = (...events: unknown[]) => events.map((event) => `${JSON.stringify(event)}\n`).join('')

const STREAM = lines(
  {
    type: 'instant-results',
    question: 'q',
    retrieval: 'lexical',
    items: [{ slug: 'a', title: 'Á' }],
  },
  { type: 'answer-delta', delta: 'Hello — ' },
  { type: 'answer-delta', delta: 'world.' },
  {
    type: 'final-answer',
    question: 'q',
    answer: 'Hello — world.',
    provider: 'fake:model',
    sources: [{ slug: 'a', title: 'Á', heading: '', target: { type: 'article' } }],
  }
)

describe('readShipStream', () => {
  it('handles NDJSON split at any byte boundary', async () => {
    for (const size of [1, 2, 7, 33, Infinity]) {
      const { calls, value } = handlers()
      await readShipStream(byteStream(STREAM, size), value)
      expect(calls).toEqual([
        ['instant', [{ slug: 'a', title: 'Á' }]],
        ['delta', 'Hello — '],
        ['delta', 'Hello — world.'],
        [
          'final',
          'Hello — world.',
          {
            provider: 'fake:model',
            sources: [{ slug: 'a', title: 'Á', heading: '', target: { type: 'article' } }],
          },
        ],
      ])
    }
  })

  it('reads a last line with no newline and skips garbage', async () => {
    const { calls, value } = handlers()
    const text = `not json\n${lines({
      type: 'answer-delta',
      delta: 'x',
    })}{"type":"final-answer","answer":"x"}`
    await readShipStream(byteStream(text, 4), value)
    expect(calls).toEqual([
      ['delta', 'x'],
      ['final', 'x', { provider: undefined, sources: [] }],
    ])
  })

  it('ignores anything after the final answer', async () => {
    const { calls, value } = handlers()
    await readShipStream(
      byteStream(STREAM + lines({ type: 'error', message: 'late fault' })),
      value
    )
    expect(calls.some(([name]) => name === 'error')).toBe(false)
  })

  it('reports a stream that ends before its final answer', async () => {
    const onError = vi.fn()
    await readShipStream(byteStream(lines({ type: 'answer-delta', delta: 'cut' })), { onError })
    expect(onError).toHaveBeenCalledWith('SIGNAL LOST')
  })
})

describe('sourceModal', () => {
  it('opens operator panels in the Data modal and records in the reader', () => {
    expect(sourceModal({ slug: 'about', target: { type: 'data', panel: 'about' } })).toEqual({
      type: 'data',
      panel: 'about',
    })
    expect(sourceModal({ slug: 'current-work', target: { type: 'data', panel: 'work' } })).toEqual({
      type: 'data',
      panel: 'work',
    })
    expect(sourceModal({ slug: 'raft', target: { type: 'article' } })).toEqual({
      type: 'article',
      slug: 'raft',
    })
    expect(sourceModal({ slug: 'legacy' })).toEqual({ type: 'article', slug: 'legacy' })
    expect(sourceModal({ slug: 'x', target: { type: 'data', panel: 'nope' } })).toEqual({
      type: 'article',
      slug: 'x',
    })
    expect(sourceModal({})).toBeNull()
  })
})
