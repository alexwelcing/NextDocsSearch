// Curated collection viewer (the old hub pages, in-scene): filtered record list with the same
// keyboard/pointer selection as the dock archive, opening records in the reader.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { ModalShell, MODAL_PAD, MODAL_W } from './ModalShell'
import { WindfoilText } from '../text/WindfoilText'
import { ScreenList } from '../dock/widgets/ScreenList'
import { closeModal, openModal } from '@/lib/immersive/navigation'
import { HUB_COLLECTIONS, loadArchive, type ArcRecord } from '@/lib/immersive/archive'
import { playSound } from '@/lib/immersive/audio'
import { ARC, FONT, TYPE, rgba } from '@/lib/immersive/theme'

const ROWS = 9
const CONTENT_W = MODAL_W - MODAL_PAD * 2

export function CollectionModal({ hub }: { hub: string }) {
  const router = useRouter()
  const meta = HUB_COLLECTIONS[hub]
  const [records, setRecords] = useState<ArcRecord[]>([])
  const [sel, setSel] = useState(0)

  useEffect(() => {
    loadArchive().then(setRecords, () => undefined)
  }, [])

  const filtered = useMemo(
    () => (meta ? records.filter(meta.match) : []),
    [records, meta]
  )

  const activate = (index: number) => {
    const rec = filtered[index]
    if (!rec) return
    playSound('confirm')
    openModal(router, { type: 'article', slug: rec.slug })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        setSel((s) => Math.min(s + 1, Math.max(filtered.length - 1, 0)))
        playSound('key')
      } else if (e.key === 'ArrowUp') {
        setSel((s) => Math.max(s - 1, 0))
        playSound('key')
      } else if (e.key === 'Enter') {
        activate(sel)
      } else {
        return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sel])

  if (!meta) return null

  return (
    <ModalShell
      title={meta.title}
      meta={`${filtered.length} RECORDS`}
      hints="↑↓ SELECT · ENTER OPEN · ESC CLOSE"
      onClose={() => closeModal(router)}
    >
      <WindfoilText
        font={FONT.mono}
        fontSize={TYPE.body}
        color={rgba(ARC.green, 0.65)}
        maxWidth={CONTENT_W}
        maxLines={1}
      >
        {meta.blurb.toUpperCase()}
      </WindfoilText>
      <ScreenList
        items={filtered.map((r) => ({
          id: r.slug,
          primary: r.title.toUpperCase(),
          meta: r.date.slice(0, 7),
        }))}
        selected={sel}
        onSelect={(i) => {
          setSel(i)
          playSound('key')
        }}
        onActivate={activate}
        width={CONTENT_W}
        rows={ROWS}
        y={-0.06}
      />
    </ModalShell>
  )
}
