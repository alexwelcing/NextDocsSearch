// ARCHIVE: the full record index. Arrow-key or pointer selection, Enter/click opens the article
// modal via its canonical URL. The selected record's description previews under the list.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { WindfoilText } from '../../text/WindfoilText'
import { ScreenHeader, ScreenHints } from '../widgets/ScreenChrome'
import { ScreenList } from '../widgets/ScreenList'
import { useTabKeys } from '../useTabKeys'
import { loadArchive, type ArcRecord } from '@/lib/immersive/archive'
import { prefetchRecord } from '@/lib/immersive/prefetch'
import { openModal } from '@/lib/immersive/navigation'
import { playSound } from '@/lib/immersive/audio'
import { ARC, FONT, TYPE, rgba } from '@/lib/immersive/theme'

const ROWS = 5

export function ArchiveTab({ active, width }: { active: boolean; width: number }) {
  const router = useRouter()
  const [records, setRecords] = useState<ArcRecord[]>([])
  const [failed, setFailed] = useState(false)
  const [sel, setSel] = useState(0)

  useEffect(() => {
    let live = true
    loadArchive().then(
      (r) => live && setRecords(r),
      () => live && setFailed(true)
    )
    return () => {
      live = false
    }
  }, [])

  const items = useMemo(
    () =>
      records.map((r) => ({
        id: r.slug,
        primary: r.title.toUpperCase(),
        meta: r.date.slice(0, 7),
      })),
    [records]
  )

  const activate = (index: number) => {
    const rec = records[index]
    if (!rec) return
    playSound('confirm')
    openModal(router, { type: 'article', slug: rec.slug })
  }

  useTabKeys(active, (e) => {
    if (!records.length) return false
    if (e.key === 'ArrowDown') {
      setSel((s) => Math.min(s + 1, records.length - 1))
      playSound('key')
      return true
    }
    if (e.key === 'ArrowUp') {
      setSel((s) => Math.max(s - 1, 0))
      playSound('key')
      return true
    }
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      setSel((s) => Math.min(s + ROWS, records.length - 1))
      return true
    }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      setSel((s) => Math.max(s - ROWS, 0))
      return true
    }
    if (e.key === 'Enter') {
      activate(sel)
      return true
    }
    return false
  })

  const selected = records[sel]

  useEffect(() => {
    if (selected) prefetchRecord(selected.slug)
  }, [selected])

  return (
    <group>
      <ScreenHeader title="ARCHIVE" right={`${records.length} RECORDS`} width={width} />
      {failed && (
        <WindfoilText font={FONT.mono} fontSize={TYPE.body} color={rgba(ARC.red)} position={[0, -0.07, 0]}>
          ARCHIVE BUS FAULT — RETRY LATER
        </WindfoilText>
      )}
      {!failed && !records.length && (
        <WindfoilText font={FONT.mono} fontSize={TYPE.body} color={rgba(ARC.greenDim)} position={[0, -0.07, 0]}>
          READING INDEX…
        </WindfoilText>
      )}
      <ScreenList
        items={items}
        selected={sel}
        onSelect={(index) => {
          setSel(index)
          playSound('key')
        }}
        onActivate={activate}
        width={width}
        rows={ROWS}
        y={-0.055}
      />
      {selected && (
        <WindfoilText
          font={FONT.mono}
          fontSize={TYPE.small}
          color={rgba(ARC.green, 0.6)}
          position={[0, -0.055 - ROWS * 0.037 - 0.016, 0]}
          maxWidth={width}
          maxLines={2}
        >
          {selected.description || '—'}
        </WindfoilText>
      )}
      <ScreenHints text="↑↓ SELECT · ←→ PAGE · ENTER OPEN" width={width} />
    </group>
  )
}
