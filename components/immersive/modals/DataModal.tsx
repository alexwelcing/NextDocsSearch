// Operator files viewer: about / current work / pitch rendered as paginated terminal dossiers
// from lib/immersive/operatorData.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { ModalShell, MODAL_H, MODAL_PAD, MODAL_W } from './ModalShell'
import { WindfoilText, useFontAtlas } from '../text/WindfoilText'
import { layoutText } from '@/lib/windfoil/layout'
import { OPERATOR_PANELS, type PanelBlock } from '@/lib/immersive/operatorData'
import { closeModal } from '@/lib/immersive/navigation'
import { playSound } from '@/lib/immersive/audio'
import { ARC, FONT, rgba } from '@/lib/immersive/theme'

const CONTENT_W = MODAL_W - MODAL_PAD * 2
const COL_GAP = 0.07
const COL_W = (CONTENT_W - COL_GAP) / 2
const PAGE_H = MODAL_H - 0.33
const BODY = 0.028
const HEAD = 0.034
const LH = 1.36
const GAP = 0.026

interface Placed {
  block: PanelBlock
  col: number
  y: number
}

export function DataModal({ panel }: { panel: 'about' | 'work' | 'pitch' }) {
  const router = useRouter()
  const atlas = useFontAtlas(FONT.mono)
  const [page, setPage] = useState(0)
  const data = OPERATOR_PANELS[panel]

  useEffect(() => setPage(0), [panel])

  const pages = useMemo(() => {
    if (!atlas) return null
    const out: Placed[][] = []
    let cur: Placed[] = []
    let col = 0
    let y = 0
    for (const block of data.blocks) {
      const size = block.kind === 'heading' ? HEAD : BODY
      const text =
        block.kind === 'item' ? `· ${block.text}${block.meta ? `  [${block.meta}]` : ''}` : block.text
      const h = layoutText(atlas, text, { fontSize: size, maxWidth: COL_W, lineHeight: LH }).height
      if (y + h > PAGE_H && y > 0) {
        col++
        y = 0
        if (col > 1) {
          out.push(cur)
          cur = []
          col = 0
        }
      }
      cur.push({ block: { ...block, text }, col, y })
      y += h + GAP
    }
    if (cur.length) out.push(cur)
    return out.length ? out : [[]]
  }, [atlas, data])

  useEffect(() => {
    if (!pages) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setPage((p) => Math.min(p + 1, pages.length - 1))
        playSound('key')
      } else if (e.key === 'ArrowLeft') {
        setPage((p) => Math.max(p - 1, 0))
        playSound('key')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages])

  return (
    <ModalShell
      title={data.title}
      meta={pages ? `PAGE ${page + 1}/${pages.length}` : ''}
      hints="<> TURN PAGE · ESC CLOSE"
      onClose={() => closeModal(router)}
    >
      {pages?.[page]?.map((p, i) => (
        <WindfoilText
          key={`${page}-${i}`}
          font={FONT.mono}
          fontSize={p.block.kind === 'heading' ? HEAD : BODY}
          color={
            p.block.kind === 'heading'
              ? rgba(ARC.amber)
              : p.block.kind === 'item'
                ? rgba(ARC.green, 0.85)
                : rgba(ARC.greenBright, 1)
          }
          position={[p.col * (COL_W + COL_GAP), -p.y, 0]}
          maxWidth={COL_W}
          lineHeight={LH}
        >
          {p.block.kind === 'heading' ? p.block.text.toUpperCase() : p.block.text}
        </WindfoilText>
      ))}
    </ModalShell>
  )
}
