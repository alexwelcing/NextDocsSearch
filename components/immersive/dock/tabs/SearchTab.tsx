// SEARCH: live full-text search over the archive, typed directly on the terminal (keystrokes
// are captured while the tab is active — no DOM input on desktop; touch devices get a hidden
// input via useTouchTextInput so the OS keyboard opens).

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { WindfoilText } from '../../text/WindfoilText'
import { ScreenHeader, ScreenHints } from '../widgets/ScreenChrome'
import { ScreenList } from '../widgets/ScreenList'
import { useTabKeys } from '../useTabKeys'
import { isTouchTextTarget, useTouchTextInput } from '../../hooks/useTouchTextInput'
import { HttpIndexSource, listRecords, searchRecords, type ArchiveRecord } from '@/lib/archive'
import { searchFullText } from '@/lib/archive/search'
import searchManifest from '@/lib/generated/search-manifest.json'
import { loadCoreIndex, type CoreIndex } from '@/lib/retrieval/load'
import type { SearchManifest } from '@/lib/retrieval/types'
import { prefetchRecord } from '@/lib/immersive/prefetch'
import { openModal } from '@/lib/immersive/navigation'
import { playSound } from '@/lib/immersive/audio'
import { ARC, FONT, TYPE, rgba } from '@/lib/immersive/theme'
import { stopLook } from '../DockKey'

const ROWS = 3
const MAX_QUERY = 60
// FIND mounts on demand. Reuse its source across visits without adding the full
// search index to ImmersiveApp's compact landing-page preload.
const source = new HttpIndexSource()

// The full-text BM25F index: content-hashed public/search/ assets named by the build's manifest,
// fetched the first time FIND opens and kept for the page's lifetime. Until it is ready, or if
// it cannot load, FIND ranks the archive records with searchRecords exactly as before.
let fullText: CoreIndex | null = null
const loadFullText = () =>
  loadCoreIndex(searchManifest as SearchManifest, (path) => fetch(path)).then(
    (index) => (fullText = index)
  )

export function SearchTab({ active, width }: { active: boolean; width: number }) {
  const router = useRouter()
  const [records, setRecords] = useState<ArchiveRecord[]>([])
  const [index, setIndex] = useState<CoreIndex | null>(fullText)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)

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

  useEffect(() => {
    if (!active || index) return
    let live = true
    loadFullText().then(
      (loaded) => {
        if (live) setIndex(loaded)
      },
      (error: unknown) => console.warn('[find] full-text index unavailable, using records:', error)
    )
    return () => {
      live = false
    }
  }, [active, index])

  const retry = () => setAttempt((value) => value + 1)

  // Hidden DOM input for touch keyboards; desktop keys are handled below.
  const field = useTouchTextInput({
    active,
    value: query,
    onChange: setQuery,
    label: 'Search archive',
    maxLength: MAX_QUERY,
    type: 'search',
  })

  const results = useMemo(() => {
    if (status !== 'ready') return []
    return index ? searchFullText(index, records, query, 40) : searchRecords(records, query, 40)
  }, [records, index, query, status])
  // A new query, or the full-text index replacing record ranking, starts again at the top.
  useEffect(() => setSel(0), [query, index])
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
    // keys typed into another surface's field (the Sphere Hunter callsign) are that field's
    if (isTouchTextTarget(e) && !field.owns(e)) return false
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
    if (field.owns(e)) return false
    if (e.key === 'Backspace') {
      setQuery((q) => q.slice(0, -1))
      playSound('key')
      return true
    }
    if (e.key.length === 1) {
      setQuery((q) => (q.length < MAX_QUERY ? q + e.key : q))
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
          field.focus()
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
