// @vitest-environment jsdom

// FIND over the full-text BM25F index (public/search/), and its fallback to record search.
import { act, type ComponentType, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArchiveRecord } from '@/lib/archive'
import { openModal } from '@/lib/immersive/navigation'
import { FIXTURE_ARCHIVE, fixtureIndex } from '@/lib/retrieval/testing'

// Render the scene's intrinsic elements as plain DOM so the tab mounts without a renderer.
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const runtime = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof runtime.jsxDEV = (type, props, key, isStatic, source, self) => {
    if (
      typeof type === 'string' &&
      ['group', 'mesh', 'planeGeometry', 'meshBasicMaterial'].includes(type)
    ) {
      const { children, onPointerDown } = props as Record<string, unknown>
      return runtime.jsxDEV('div', { children, onPointerDown }, key, isStatic, source, self)
    }
    return runtime.jsxDEV(type, props, key, isStatic, source, self)
  }
  return { ...runtime, jsxDEV }
})
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/' }) }))
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
vi.mock('../widgets/ScreenList', () => ({
  ScreenList: ({
    items,
    onActivate,
  }: {
    items: { id: string; primary: string; meta?: string }[]
    onActivate: (index: number) => void
  }) => (
    <div>
      {items.map((item, index) => (
        <button key={item.id} onClick={() => onActivate(index)}>
          {item.primary} {item.meta}
        </button>
      ))}
    </div>
  ),
}))
vi.mock('@/lib/immersive/audio', () => ({ playSound: vi.fn() }))
vi.mock('@/lib/immersive/navigation', () => ({ openModal: vi.fn() }))
vi.mock('@/lib/immersive/prefetch', () => ({ prefetchRecord: vi.fn() }))
vi.mock('../DockKey', () => ({ stopLook: (event: Event) => event.stopPropagation() }))
vi.mock('three/webgpu', () => import('three'))
// The build's manifest, swapped for one naming the fixture index's assets.
vi.mock('@/lib/generated/search-manifest.json', async () => {
  const { fixtureIndex: build } = await import('@/lib/retrieval/testing')
  return { default: (await build()).manifest }
})

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

// The archive payload carries only a searchText preview; here it is empty, so a body-only word
// ('eavesdropper', deep in the quantum record) is findable through the full-text index alone.
const ARCHIVE: ArchiveRecord[] = FIXTURE_ARCHIVE.map((record) => ({ ...record, searchText: '' }))

let host: HTMLDivElement
let root: Root
let SearchTab: ComponentType<{ active: boolean; width: number }>

async function render(active = true) {
  await act(async () => root.render(<SearchTab active={active} width={0.6} />))
}

async function type(query: string) {
  await act(async () => {
    for (const key of query) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    }
  })
}

async function clear() {
  await act(async () => {
    for (let i = 0; i < 60; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))
    }
  })
}

/** Serve the archive and, through `asset`, the index files; returns the fetch spy. */
async function serve(asset?: (path: string, bytes?: Uint8Array) => Promise<Response>) {
  const { assets } = await fixtureIndex()
  const files = new Map(assets.map((file) => [file.path, file.bytes]))
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const { pathname } = new URL(String(input), 'https://archive.test')
    if (!pathname.startsWith('/search/')) {
      return new Response(JSON.stringify({ records: ARCHIVE, total: ARCHIVE.length }))
    }
    const bytes = files.get(pathname)
    if (asset) return asset(pathname, bytes)
    return bytes ? new Response(bytes) : new Response('missing', { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

const indexCalls = (fetcher: { mock: { calls: unknown[][] } }) =>
  fetcher.mock.calls.filter(([input]) => String(input).startsWith('/search/')).length

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  ;({ SearchTab } = await import('./SearchTab'))
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('FIND full-text index', () => {
  it('finds words beyond the record preview and opens the article', async () => {
    const fetcher = await serve()
    await render()
    await type('eavesdropper')

    expect(host.textContent).toContain('QUANTUM KEY DISTRIBUTION 3MIN')
    expect(host.textContent).toContain('1 HITS')
    expect(host.textContent).toContain('eavesdropper detection')
    expect(indexCalls(fetcher)).toBe(2)

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(openModal).toHaveBeenCalledWith(expect.anything(), {
      type: 'article',
      slug: 'quantum-key-distribution',
    })
  })

  it('loads the index once for the page, across tab remounts', async () => {
    const fetcher = await serve()
    await render(false)
    expect(indexCalls(fetcher)).toBe(0)

    await render()
    await act(async () => root.render(null))
    await render()
    await type('eavesdropper')
    expect(host.textContent).toContain('QUANTUM KEY DISTRIBUTION')
    expect(indexCalls(fetcher)).toBe(2)
  })

  it('lists articles only, never the operator panels the index also holds', async () => {
    await serve()
    await render()
    await type('welcing')
    expect(host.textContent).toContain('NO RECORDS MATCH')
  })

  it('answers from the records while the index loads, then from the full text', async () => {
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await serve(async (_path, bytes) => {
      await held
      return new Response(bytes)
    })
    await render()
    await type('credentials')
    expect(host.textContent).toContain('AGENTS NEED THEIR OWN CREDENTIALS')

    await clear()
    await type('eavesdropper')
    expect(host.textContent).toContain('NO RECORDS MATCH')

    await act(async () => release())
    expect(host.textContent).toContain('QUANTUM KEY DISTRIBUTION')
    expect(host.textContent).not.toContain('NO RECORDS MATCH')
  })

  it('falls back to record search, with no error, when the index cannot load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetcher = await serve(async () => new Response('missing', { status: 404 }))
    await render()
    await type('eavesdropper')
    expect(host.textContent).toContain('NO RECORDS MATCH')
    expect(host.textContent).not.toContain('SEARCH UNAVAILABLE')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('full-text index unavailable'),
      expect.any(Error)
    )

    await clear()
    await type('quantum')
    expect(host.textContent).toContain('QUANTUM KEY DISTRIBUTION')

    // A later visit tries the index again rather than caching the failure.
    await render(false)
    await render()
    expect(indexCalls(fetcher)).toBe(4)
  })
})
