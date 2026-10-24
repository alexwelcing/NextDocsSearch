// @vitest-environment jsdom

import { act, useEffect, type ComponentType, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArchiveRecord } from '@/lib/archive'
import { openModal } from '@/lib/immersive/navigation'
import { useTouchTextInput, type TouchTextInput } from '../../hooks/useTouchTextInput'

// Keep intrinsic mesh event handlers observable without mounting a WebGL renderer.
// Strip graphics-only props so ReactDOM can render these presentation nodes cleanly.
vi.mock('react/jsx-dev-runtime', async (importOriginal) => {
  const runtime = await importOriginal<typeof import('react/jsx-dev-runtime')>()
  const jsxDEV: typeof runtime.jsxDEV = (type, props, key, isStatic, source, self) => {
    if (
      typeof type === 'string' &&
      ['group', 'mesh', 'planeGeometry', 'meshBasicMaterial'].includes(type)
    ) {
      const { children, onPointerDown, onPointerOver, onPointerOut } = props as Record<
        string,
        unknown
      >
      return runtime.jsxDEV(
        'div',
        {
          children,
          onPointerDown,
          onPointerOver,
          onPointerOut,
          'data-three': type,
        },
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
    selected,
    onSelect,
    onActivate,
    rows,
  }: {
    items: { id: string; primary: string; meta?: string }[]
    selected: number
    onSelect: (index: number) => void
    onActivate: (index: number) => void
    rows: number
  }) => (
    <div data-testid="results" data-rows={rows}>
      {items.map((item, index) => (
        <button
          key={item.id}
          data-selected={selected === index}
          onMouseOver={() => onSelect(index)}
          onClick={() => onActivate(index)}
        >
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

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

function record(fields: Partial<ArchiveRecord> = {}): ArchiveRecord {
  return {
    slug: 'quiet-entry',
    title: 'A quiet entry',
    date: '2026-01-01',
    description: 'The archive description.',
    type: 'article',
    minutes: 3,
    keywords: [],
    domains: [],
    mechanics: [],
    searchText: '',
    hero: null,
    ...fields,
  }
}

function payload(records: ArchiveRecord[]) {
  return new Response(JSON.stringify({ records, total: records.length }))
}

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

function input() {
  const element = document.querySelector<HTMLInputElement>('input[aria-label="Search archive"]')
  expect(element).not.toBeNull()
  return element!
}

beforeEach(async () => {
  // A fresh module graph gives each test its own actual HTTP source/cache, while remounts
  // inside a test exercise the production cache retained across dock tab changes.
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
})

describe('FIND full archive integration', () => {
  it('loads only when active and reuses the full index across tab remounts', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(payload([record()]))
    vi.stubGlobal('fetch', fetcher)

    await render(false)
    expect(fetcher).not.toHaveBeenCalled()
    expect(document.querySelector('input[aria-label="Search archive"]')).toBeNull()

    await render(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const url = new URL(String(fetcher.mock.calls[0][0]), 'https://archive.test')
    expect(url.pathname).toBe('/api/arc/archive')
    expect(url.searchParams.get('view')).toBe('full')

    await act(async () => root.render(null))
    expect(document.querySelector('input[aria-label="Search archive"]')).toBeNull()
    await render(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('shows loading rather than a false no-match result while the full request is pending', async () => {
    let finish!: (response: Response) => void
    const pending = new Promise<Response>((resolve) => {
      finish = resolve
    })
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(pending))

    await render()
    await type('quasar')
    expect(host.textContent).toContain('READING SEARCH INDEX...')
    expect(host.textContent).not.toContain('NO RECORDS MATCH')

    await act(async () => finish(payload([record({ searchText: 'quasar evidence' })])))
    expect(host.textContent).not.toContain('READING SEARCH INDEX...')
    expect(host.textContent).toContain('A QUIET ENTRY')
    expect(host.textContent).toContain('quasar evidence')
  })

  it('distinguishes a failed request from an empty search and retries with Enter', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(payload([record({ keywords: ['quasar'] })]))
    vi.stubGlobal('fetch', fetcher)

    await render()
    await type('quasar')
    expect(host.textContent).toContain('SEARCH UNAVAILABLE. ENTER OR TAP TO RETRY.')
    expect(host.textContent).not.toContain('NO RECORDS MATCH')

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(host.textContent).not.toContain('SEARCH UNAVAILABLE')
    expect(host.textContent).toContain('A QUIET ENTRY')
    expect(openModal).not.toHaveBeenCalled()
  })

  it('reports a successfully loaded empty archive separately from failure', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(payload([])))
    await render()
    await type('quasar')

    expect(host.textContent).toContain('ARCHIVE IS EMPTY.')
    expect(host.textContent).not.toContain('SEARCH UNAVAILABLE')
    expect(host.textContent).not.toContain('NO RECORDS MATCH')
  })

  it('offers a pointer retry after rejecting an incomplete full-index response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            records: [
              {
                slug: 'slim',
                title: 'Slim record',
                description: '',
                date: '',
                type: 'article',
                minutes: 1,
              },
            ],
            total: 1,
          })
        )
      )
      .mockResolvedValueOnce(payload([record({ keywords: ['quasar'] })]))
    vi.stubGlobal('fetch', fetcher)
    await render()
    await type('quasar')
    expect(host.textContent).toContain('SEARCH UNAVAILABLE. ENTER OR TAP TO RETRY.')

    const meshes = host.querySelectorAll('[data-three="mesh"]')
    await act(async () => meshes[1].dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(host.textContent).toContain('A QUIET ENTRY')
  })

  it('removes input and ignores a pending completion after deactivation', async () => {
    let finish!: (response: Response) => void
    const pending = new Promise<Response>((resolve) => {
      finish = resolve
    })
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(pending)
    vi.stubGlobal('fetch', fetcher)
    await render()
    await type('quasar')
    await render(false)
    expect(document.querySelector('input[aria-label="Search archive"]')).toBeNull()

    await act(async () => finish(payload([record({ searchText: 'quasar evidence' })])))
    expect(host.textContent).not.toContain('A QUIET ENTRY')

    await render(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(host.textContent).toContain('A QUIET ENTRY')
  })

  it('reuses an in-flight full request when the search tab is closed and reopened', async () => {
    let finish!: (response: Response) => void
    const pending = new Promise<Response>((resolve) => {
      finish = resolve
    })
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(pending)
    vi.stubGlobal('fetch', fetcher)
    await render()
    await act(async () => root.render(null))
    await render()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(host.textContent).toContain('READING SEARCH INDEX...')

    await act(async () => finish(payload([record({ keywords: ['quasar'] })])))
    await type('quasar')
    expect(host.textContent).toContain('A QUIET ENTRY')
  })

  it.each(['searchText', 'keywords', 'domains', 'mechanics'] as const)(
    'finds a record whose query appears only in %s and opens its canonical article',
    async (field) => {
      const full = record({ [field]: field === 'searchText' ? 'quasar evidence' : ['quasar'] })
      vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(payload([full])))
      await render()
      await type('quasar')

      expect(host.textContent).toContain('A QUIET ENTRY')
      expect(host.textContent).toContain('1 HITS')
      await act(async () => host.querySelector('button')!.click())
      expect(openModal).toHaveBeenCalledWith(expect.anything(), {
        type: 'article',
        slug: 'quiet-entry',
      })
    }
  )

  it('focuses the hidden input when the query line is tapped', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(payload([record()])))
    await render()
    expect(document.activeElement).not.toBe(input())

    const queryLine = host.querySelector('[data-three="mesh"]')!
    await act(async () => queryLine.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(document.activeElement).toBe(input())

    // the same tap's compatibility mousedown must not move focus back off the field
    const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    queryLine.dispatchEvent(mousedown)
    expect(mousedown.defaultPrevented).toBe(true)
  })

  it('keeps desktop and native input edits in sync and bounds pasted text', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(payload([record()])))
    await render()
    await type('2026')
    expect(host.textContent).toContain('> 2026_')
    expect(input().value).toBe('2026')
    expect(input().maxLength).toBe(60)

    const native = input()
    const nativeKey = new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true })
    await act(async () => native.dispatchEvent(nativeKey))
    expect(nativeKey.defaultPrevented).toBe(false)
    expect(host.textContent).toContain('> 2026_')

    const nativeDelete = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true,
    })
    await act(async () => native.dispatchEvent(nativeDelete))
    expect(nativeDelete.defaultPrevented).toBe(false)
    expect(host.textContent).toContain('> 2026_')

    await act(async () => {
      native.value = '2026b'
      native.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(host.textContent).toContain('> 2026b_')

    await act(async () => {
      native.value = 'x'.repeat(90)
      native.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(native.value).toBe('x'.repeat(60))
    expect(host.textContent).toContain(`> ${'x'.repeat(60)}_`)

    await render(false)
    expect(document.querySelector('input[aria-label="Search archive"]')).toBeNull()
    await type('ignored')
    await render(true)
    expect(input().value).toBe('x'.repeat(60))
  })
})

describe('useTouchTextInput', () => {
  let field: TouchTextInput
  const onChange = vi.fn()

  function Callsign({
    active,
    value,
    expose,
  }: {
    active: boolean
    value: string
    expose: (field: TouchTextInput) => void
  }) {
    const touch = useTouchTextInput({
      active,
      value,
      onChange,
      label: 'Callsign',
      maxLength: 12,
      sanitize: (v) => v.toUpperCase().replace(/[^A-Z0-9 _-]/g, ''),
      autoCapitalize: 'characters',
      enterKeyHint: 'send',
    })
    useEffect(() => {
      expose(touch)
    })
    return null
  }

  async function show(active: boolean, value: string) {
    await act(async () =>
      root.render(
        <Callsign
          active={active}
          value={value}
          expose={(f) => {
            field = f
          }}
        />
      )
    )
  }

  const callsign = () => document.querySelector<HTMLInputElement>('input[aria-label="Callsign"]')

  it('mounts a field only while active and focuses it on demand', async () => {
    await show(false, '')
    expect(callsign()).toBeNull()

    await show(true, 'ACE')
    const el = callsign()!
    expect(el.value).toBe('ACE')
    expect(el.type).toBe('text')
    expect(el.maxLength).toBe(12)
    expect(el.getAttribute('autocapitalize')).toBe('characters')
    expect(el.getAttribute('enterkeyhint')).toBe('send')

    field.focus()
    expect(document.activeElement).toBe(el)

    await show(false, 'ACE')
    expect(el.isConnected).toBe(false)
    expect(field.inputRef.current).toBeNull()
  })

  it("guards focus only through the tap's own mousedown and click", async () => {
    vi.useFakeTimers()
    try {
      await show(true, '')
      const press = () => {
        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
        host.dispatchEvent(event)
        return event.defaultPrevented
      }

      field.focus()
      expect(press()).toBe(true)
      host.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(press()).toBe(false)

      // a gesture that never clicks (drag, long-press) releases the guard on a timer
      field.focus()
      vi.advanceTimersByTime(1000)
      expect(press()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('sanitizes native edits before bounding them and reports them', async () => {
    await show(true, '')
    const el = callsign()!

    // a pasted name keeps its valid tail: filter first, then bound
    el.value = 'ace.of$spades-99'
    el.dispatchEvent(new Event('input', { bubbles: true }))
    expect(el.value).toBe('ACEOFSPADES-')
    expect(onChange).toHaveBeenLastCalledWith('ACEOFSPADES-')

    // window-captured edits flow back into the element
    await show(true, 'ZED')
    expect(el.value).toBe('ZED')
  })

  it('tells key events from the native field apart from window-captured keys', async () => {
    await show(true, '')
    const native = new KeyboardEvent('keydown', { key: 'x', bubbles: true })
    callsign()!.dispatchEvent(native)
    expect(field.owns(native)).toBe(true)

    const desktop = new KeyboardEvent('keydown', { key: 'x', bubbles: true })
    window.dispatchEvent(desktop)
    expect(field.owns(desktop)).toBe(false)

    await show(false, '')
    expect(field.owns(native)).toBe(false)
  })
})
