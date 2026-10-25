// @vitest-environment jsdom

import { act, type ComponentType, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openModal } from '@/lib/immersive/navigation'

// Same harness as SearchTab.test.tsx: intrinsic three nodes become divs that keep their pointer
// handlers, so the console renders under ReactDOM without a WebGPU renderer.
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const runtime = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof runtime.jsxDEV = (type, props, key, isStatic, source, self) => {
    if (
      typeof type === 'string' &&
      ['group', 'mesh', 'planeGeometry', 'meshBasicMaterial'].includes(type)
    ) {
      const { children, onPointerDown } = props as Record<string, unknown>
      return runtime.jsxDEV(
        'div',
        { children, onPointerDown, 'data-three': type },
        key,
        isStatic,
        source,
        self
      )
    }
    return runtime.jsxDEV(type, props, key, isStatic, source, self)
  }
  return { ...runtime, jsxDEV }
})

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/' }) }))
vi.mock('../../text/WindfoilText', () => ({
  WindfoilText: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))
vi.mock('../widgets/ScreenChrome', () => ({
  ScreenHeader: ({ title, right }: { title: string; right?: string }) => (
    <header>
      {title} {right}
    </header>
  ),
  ScreenHints: ({ text }: { text: string }) => <footer>{text}</footer>,
}))
vi.mock('@/lib/immersive/audio', () => ({ playSound: vi.fn() }))
vi.mock('@/lib/immersive/navigation', () => ({ openModal: vi.fn() }))
vi.mock('../DockKey', () => ({ stopLook: (event: Event) => event.stopPropagation() }))
vi.mock('../CrtScreen', () => ({ SCREEN_H: 0.5 }))

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let host: HTMLDivElement
let root: Root
let ShipTab: ComponentType<{ active: boolean; width: number }>

const SOURCES = [
  { slug: 'about', title: 'About Alex Welcing', target: { type: 'data', panel: 'about' } },
  { slug: 'raft', title: 'Raft Consensus', target: { type: 'article' } },
]

function ndjson(answer: string) {
  const lines = [
    { type: 'instant-results', question: 'q', retrieval: 'lexical', items: SOURCES },
    { type: 'answer-delta', delta: answer },
    { type: 'final-answer', question: 'q', answer, provider: 'fake:model', sources: SOURCES },
  ]
  return new Response(lines.map((line) => `${JSON.stringify(line)}\n`).join(''), {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  })
}

async function render(active = true) {
  await act(async () => root.render(<ShipTab active={active} width={0.6} />))
}

async function press(key: string, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  await act(async () => target.dispatchEvent(event))
  return event
}

async function type(text: string) {
  for (const key of text) await press(key)
}

/** Let askShip read the whole NDJSON body. */
async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
}

const field = () =>
  document.querySelector<HTMLInputElement>('input[aria-label="Ask the ship mind"]')

function bodies(fetcher: ReturnType<typeof vi.fn>) {
  return fetcher.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)))
}

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  ;({ ShipTab } = await import('./ShipTab'))
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

describe('ShipTab', () => {
  it('sends typed questions with the {role, content} history of earlier turns', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(ndjson('Alex builds AI products.'))
      .mockResolvedValueOnce(ndjson('In New York.'))
    vi.stubGlobal('fetch', fetcher)
    await render()

    await type('who is alex')
    await press('Enter')
    await settle()
    expect(host.textContent).toContain('Alex builds AI products.')
    expect(host.textContent).toContain('ABOUT ALEX WELCING')
    await type('where')
    await press('Enter')
    await settle()

    expect(fetcher.mock.calls[0][0]).toBe('/api/vector-search')
    expect(bodies(fetcher)).toEqual([
      { prompt: 'who is alex', history: [] },
      {
        prompt: 'where',
        history: [
          { role: 'user', content: 'who is alex' },
          { role: 'assistant', content: 'Alex builds AI products.' },
        ],
      },
    ])
    expect(host.textContent).toContain('In New York.')
  })

  it('takes touch-keyboard input through its hidden field without doubling keys', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(ndjson('Answer.'))
    vi.stubGlobal('fetch', fetcher)
    await render(false)
    expect(field()).toBeNull()
    await render()

    const input = field()!
    expect(input.getAttribute('enterkeyhint')).toBe('send')
    const [queryLine] = host.querySelectorAll('[data-three="mesh"]')
    await act(async () => queryLine.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(document.activeElement).toBe(input)

    // The OS keyboard edits the native field; its keydowns must not append a second copy.
    await press('h', input)
    await act(async () => {
      input.value = 'hi there'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(host.textContent).toContain('> hi there_')
    await press('Enter', input)
    await settle()
    expect(bodies(fetcher)).toEqual([{ prompt: 'hi there', history: [] }])
    expect(input.value).toBe('')
  })

  it("ignores keys typed into another surface's field", async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>())
    await render()
    const other = document.createElement('input')
    other.setAttribute('data-touch-text-input', '')
    document.body.appendChild(other)
    await press('x', other)
    await press('Enter', other)
    expect(host.textContent).toContain('> _')
    expect(fetch).not.toHaveBeenCalled()
    other.remove()
  })

  it('opens operator sources in their Data panel and records in the reader', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(ndjson('Answer.')))
    await render()
    await type('alex')
    await press('Enter')
    await settle()

    const meshes = host.querySelectorAll('[data-three="mesh"]')
    const [about, raft] = [...meshes].slice(-2)
    await act(async () => about.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    await act(async () => raft.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(vi.mocked(openModal).mock.calls.map(([, modal]) => modal)).toEqual([
      { type: 'data', panel: 'about' },
      { type: 'article', slug: 'raft' },
    ])
  })
})
