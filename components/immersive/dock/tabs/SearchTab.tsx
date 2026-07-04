// SEARCH: live lexical search over the archive index, typed directly on the terminal (keystrokes
// are captured while the tab is active — no DOM input on desktop; touch devices get a hidden
// input so the OS keyboard opens).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { WindfoilText } from '../../text/WindfoilText'
import { ScreenHeader, ScreenHints } from '../widgets/ScreenChrome'
import { ScreenList } from '../widgets/ScreenList'
import { useTabKeys } from '../useTabKeys'
import { loadArchive, searchArchive, type ArcRecord } from '@/lib/immersive/archive'
import { prefetchRecord } from '@/lib/immersive/prefetch'
import { openModal } from '@/lib/immersive/navigation'
import { playSound } from '@/lib/immersive/audio'
import { ARC, FONT, TYPE, rgba } from '@/lib/immersive/theme'
import { stopLook } from '../DockKey'

const ROWS = 5

export function SearchTab({ active, width }: { active: boolean; width: number }) {
  const router = useRouter()
  const [records, setRecords] = useState<ArcRecord[]>([])
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    loadArchive().then(setRecords, () => undefined)
  }, [])

  // Hidden DOM input for touch keyboards; desktop keys are handled below.
  useEffect(() => {
    if (!active) return
    const el = document.createElement('input')
    el.type = 'search'
    el.autocapitalize = 'off'
    el.autocomplete = 'off'
    el.style.cssText =
      'position:fixed;opacity:0;pointer-events:none;left:50%;bottom:0;height:1px;width:1px;'
    el.value = query
    el.addEventListener('input', () => setQuery(el.value))
    document.body.appendChild(el)
    inputRef.current = el
    return () => {
      el.remove()
      inputRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const results = useMemo(() => searchArchive(records, query, 40), [records, query])
  useEffect(() => setSel(0), [query])
  useEffect(() => {
    const rec = results[sel]
    if (rec) prefetchRecord(rec.slug)
  }, [results, sel])

  const activate = (index: number) => {
    const rec = results[index]
    if (!rec) return
    playSound('confirm')
    openModal(router, { type: 'article', slug: rec.slug })
  }

  useTabKeys(active, (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return false
    if (e.key === 'ArrowDown') {
      setSel((s) => Math.min(s + 1, Math.max(results.length - 1, 0)))
      return true
    }
    if (e.key === 'ArrowUp') {
      setSel((s) => Math.max(s - 1, 0))
      return true
    }
    if (e.key === 'Enter') {
      activate(sel)
      return true
    }
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

  const items = results.map((r) => ({
    id: r.slug,
    primary: r.title.toUpperCase(),
    meta: `${r.minutes}MIN`,
  }))

  return (
    <group>
      <ScreenHeader title="SEARCH" right={query ? `${results.length} HITS` : ''} width={width} />
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

      {query && !results.length && (
        <WindfoilText
          font={FONT.mono}
          fontSize={TYPE.body}
          color={rgba(ARC.amber)}
          position={[0, -0.115, 0]}
        >
          NO RECORDS MATCH
        </WindfoilText>
      )}
      {!query && (
        <WindfoilText
          font={FONT.mono}
          fontSize={TYPE.body}
          color={rgba(ARC.greenDim)}
          position={[0, -0.115, 0]}
          maxWidth={width}
        >
          {'TYPE TO SCAN THE ARCHIVE.\nFOR THE SHIP MIND, USE THE SHIP TAB.'}
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
      <ScreenHints text="TYPE QUERY · ^v SELECT · ENTER OPEN" width={width} />
    </group>
  )
}
