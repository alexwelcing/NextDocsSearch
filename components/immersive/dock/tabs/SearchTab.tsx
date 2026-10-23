// SEARCH: live lexical search over the archive index, typed directly on the terminal (keystrokes
// are captured while the tab is active — no DOM input on desktop; touch devices get a hidden
// input so the OS keyboard opens).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { WindfoilText } from '../../text/WindfoilText'
import { ScreenHeader, ScreenHints } from '../widgets/ScreenChrome'
import { ScreenList } from '../widgets/ScreenList'
import { useTabKeys } from '../useTabKeys'
import { HttpIndexSource, listRecords, searchRecords, type ArchiveRecord } from '@/lib/archive'
import { prefetchRecord } from '@/lib/immersive/prefetch'
import { openModal } from '@/lib/immersive/navigation'
import { playSound } from '@/lib/immersive/audio'
import { ARC, FONT, TYPE, rgba } from '@/lib/immersive/theme'
import { stopLook } from '../DockKey'

const ROWS = 3
// FIND mounts on demand. Reuse its source across visits without adding the full
// search index to ImmersiveApp's compact landing-page preload.
const source = new HttpIndexSource()

export function SearchTab({ active, width }: { active: boolean; width: number }) {
  const router = useRouter()
  const [records, setRecords] = useState<ArchiveRecord[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!active) return
    let live = true
    setStatus('loading')
    listRecords(source, { throwOnError: true }).then(
      (loaded) => {
        if (!live) return
        setRecords(loaded)
        setStatus('ready')
      },
      () => {
        if (live) setStatus('error')
      }
    )
    return () => {
      live = false
    }
  }, [active, attempt])

  const retry = () => setAttempt((value) => value + 1)

  // Hidden DOM input for touch keyboards; desktop keys are handled below.
  useEffect(() => {
    if (!active) return
    const el = document.createElement('input')
    el.type = 'search'
    el.setAttribute('aria-label', 'Search archive')
    el.maxLength = 60
    el.autocapitalize = 'off'
    el.autocomplete = 'off'
    el.style.cssText =
      'position:fixed;opacity:0;pointer-events:none;left:50%;bottom:0;height:1px;width:1px;'
    el.addEventListener('input', () => {
      el.value = el.value.slice(0, 60)
      setQuery(el.value)
    })
    document.body.appendChild(el)
    inputRef.current = el
    return () => {
      el.remove()
      inputRef.current = null
    }
  }, [active])

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== query) inputRef.current.value = query
  }, [query, active])

  const results = useMemo(
    () => (status === 'ready' ? searchRecords(records, query, 40) : []),
    [records, query, status]
  )
  useEffect(() => setSel(0), [query])
  const selected = results[sel]
  useEffect(() => {
    if (active && selected) prefetchRecord(selected.record.slug)
  }, [active, selected])

  const activate = (index: number) => {
    const rec = results[index]?.record
    if (!rec) return
    playSound('confirm')
    openModal(router, { type: 'article', slug: rec.slug })
  }

  useTabKeys(active, (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return false
    if (e.key === 'ArrowDown') {
      setSel((s) => Math.min(s + 1, Math.max(results.length - 1, 0)))
      return true
    }
    if (e.key === 'ArrowUp') {
      setSel((s) => Math.max(s - 1, 0))
      return true
    }
    if (e.key === 'Enter') {
      if (status === 'error') retry()
      else activate(sel)
      return true
    }
    // The native input owns text editing, paste, composition and mobile input.
    // Only the unfocused desktop terminal appends/deletes characters itself.
    if (e.target === inputRef.current) return false
    if (e.key === 'Backspace') {
      setQuery((q) => q.slice(0, -1))
      playSound('key')
      return true
    }
    if (e.key.length === 1) {
      setQuery((q) => (q.length < 60 ? q + e.key : q))
      playSound('key')
      return true
    }
    return false
  })

  const items = results.map(({ record }) => ({
    id: record.slug,
    primary: record.title.toUpperCase(),
    meta: `${record.minutes}MIN`,
  }))

  const message =
    status === 'loading'
      ? 'READING SEARCH INDEX...'
      : status === 'error'
      ? 'SEARCH UNAVAILABLE. ENTER OR TAP TO RETRY.'
      : !records.length
      ? 'ARCHIVE IS EMPTY.'
      : query.trim() && !results.length
      ? 'NO RECORDS MATCH'
      : !query.trim()
      ? 'TYPE TO SEARCH ARTICLES AND TOPICS.\nFOR THE SHIP MIND, USE THE SHIP TAB.'
      : ''

  return (
    <group>
      <ScreenHeader
        title="SEARCH"
        right={status === 'ready' && query.trim() ? `${results.length} HITS` : ''}
        width={width}
      />
      {/* query line — tap to summon the OS keyboard on touch */}
      <mesh
        position={[width / 2, -0.062, -0.0005]}
        onPointerDown={(e) => {
          stopLook(e)
          inputRef.current?.focus()
        }}
      >
        <planeGeometry args={[width, 0.04]} />
        <meshBasicMaterial color={ARC.greenFaint} transparent opacity={0.65} />
      </mesh>
      <WindfoilText
        font={FONT.mono}
        fontSize={TYPE.row}
        color={rgba(ARC.greenBright)}
        position={[0.008, -0.052, 0.0002]}
        maxWidth={width - 0.02}
        maxLines={1}
      >
        {`> ${query}_`}
      </WindfoilText>

      {status === 'error' && (
        <mesh
          position={[width / 2, -0.135, 0.0002]}
          onPointerDown={(e) => {
            stopLook(e)
            retry()
          }}
          onPointerOver={() => {
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto'
          }}
        >
          <planeGeometry args={[width, 0.065]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} transparent />
        </mesh>
      )}
      {message && (
        <WindfoilText
          font={FONT.mono}
          fontSize={TYPE.body}
          color={rgba(status === 'error' ? ARC.amber : ARC.greenDim)}
          position={[0, -0.115, 0]}
          maxWidth={width}
          maxLines={3}
        >
          {message}
        </WindfoilText>
      )}
      <ScreenList
        items={items}
        selected={sel}
        onSelect={setSel}
        onActivate={activate}
        width={width}
        rows={ROWS}
        y={-0.105}
      />
      {selected?.snippet && (
        <WindfoilText
          font={FONT.mono}
          fontSize={TYPE.small}
          color={rgba(ARC.green, 0.7)}
          position={[0, -0.248, 0]}
          maxWidth={width}
          maxLines={2}
        >
          {selected.snippet}
        </WindfoilText>
      )}
      <ScreenHints text="TYPE QUERY · ^v SELECT · ENTER OPEN" width={width} />
    </group>
  )
}
