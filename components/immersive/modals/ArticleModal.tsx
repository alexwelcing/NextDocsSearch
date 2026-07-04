// The ARC article reader: full record text as windfoil glyphs, paginated into two columns per
// page (real layout measurement, not estimates). Arrow keys / on-screen chevrons turn pages;
// a WATCH chip appears when the record has a companion film.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { WindfoilText, useFontAtlas } from '../text/WindfoilText'
import { ModalShell, MODAL_H, MODAL_PAD, MODAL_W, stopLook } from './ModalShell'
import { layoutText } from '@/lib/windfoil/layout'
import type { FontAtlas } from '@/lib/windfoil/types'
import { closeModal, openModal } from '@/lib/immersive/navigation'
import { playSound } from '@/lib/immersive/audio'
import { ARC, FONT, TYPE, rgba } from '@/lib/immersive/theme'

interface RecordBlock {
  t: 'h' | 'p' | 'l' | 'q'
  x: string
}

interface ArticleRecord {
  slug: string
  title: string
  date: string
  description: string
  hero: string | null
  blocks: RecordBlock[]
}

const COL_GAP = 0.07
const COL_W = (MODAL_W - MODAL_PAD * 2 - COL_GAP) / 2
const PAGE_H = MODAL_H - 0.33
const BODY_SIZE = 0.028
const HEAD_SIZE = 0.034
const LINE_HEIGHT = 1.38
const BLOCK_GAP = 0.024

interface Placed {
  block: RecordBlock
  col: number
  y: number
}

/** Split an oversized paragraph at sentence boundaries into column-height chunks. */
function splitBlock(block: RecordBlock, atlas: FontAtlas, maxH: number): RecordBlock[] {
  const sentences = block.x.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [block.x]
  const out: RecordBlock[] = []
  let cur = ''
  for (const s of sentences) {
    const candidate = cur + s
    const h = layoutText(atlas, candidate, {
      fontSize: BODY_SIZE,
      maxWidth: COL_W,
      lineHeight: LINE_HEIGHT,
    }).height
    if (h > maxH && cur) {
      out.push({ t: block.t, x: cur.trim() })
      cur = s
    } else {
      cur = candidate
    }
  }
  if (cur.trim()) out.push({ t: block.t, x: cur.trim() })
  return out
}

function paginate(blocks: RecordBlock[], atlas: FontAtlas): Placed[][] {
  const pages: Placed[][] = []
  let page: Placed[] = []
  let col = 0
  let y = 0
  const push = (block: RecordBlock, h: number) => {
    if (y + h > PAGE_H && y > 0) {
      col++
      y = 0
      if (col > 1) {
        pages.push(page)
        page = []
        col = 0
      }
    }
    page.push({ block, col, y })
    y += h + BLOCK_GAP
  }
  for (const raw of blocks) {
    const isHead = raw.t === 'h'
    const size = isHead ? HEAD_SIZE : BODY_SIZE
    const text = raw.t === 'l' ? `· ${raw.x}` : raw.t === 'q' ? `» ${raw.x}` : raw.x
    const measured = layoutText(atlas, isHead ? text.toUpperCase() : text, {
      fontSize: size,
      maxWidth: COL_W,
      lineHeight: LINE_HEIGHT,
    })
    if (measured.height > PAGE_H) {
      for (const part of splitBlock({ ...raw, x: text }, atlas, PAGE_H - BLOCK_GAP)) {
        const h = layoutText(atlas, part.x, {
          fontSize: size,
          maxWidth: COL_W,
          lineHeight: LINE_HEIGHT,
        }).height
        push(part, h)
      }
    } else {
      push({ ...raw, x: text }, measured.height)
    }
  }
  if (page.length) pages.push(page)
  return pages.length ? pages : [[]]
}

export function ArticleModal({ slug }: { slug: string }) {
  const router = useRouter()
  const atlas = useFontAtlas(FONT.mono)
  const [record, setRecord] = useState<ArticleRecord | null>(null)
  const [failed, setFailed] = useState(false)
  const [page, setPage] = useState(0)
  const [hasFilm, setHasFilm] = useState(false)
  const pageRef = useRef(0)
  pageRef.current = page

  useEffect(() => {
    let live = true
    setRecord(null)
    setPage(0)
    setFailed(false)
    fetch(`/arc/records/${slug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ArticleRecord) => live && setRecord(d))
      .catch(() => live && setFailed(true))
    fetch(`/images/article-videos/${slug}.mp4`, { method: 'HEAD' })
      .then((r) => live && setHasFilm(r.ok))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [slug])

  const pages = useMemo(() => {
    if (!record || !atlas) return null
    return paginate(record.blocks, atlas)
  }, [record, atlas])

  useEffect(() => {
    if (!pages) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        setPage((p) => Math.min(p + 1, pages.length - 1))
        playSound('key')
        e.preventDefault()
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setPage((p) => Math.max(p - 1, 0))
        playSound('key')
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages])

  const close = () => closeModal(router)
  const title = record?.title ?? (failed ? 'RECORD FAULT' : 'RETRIEVING…')
  const meta = record ? `${record.date.slice(0, 10)} · PAGE ${page + 1}/${pages?.length ?? 1}` : ''

  return (
    <ModalShell
      title={title}
      meta={meta}
      hints="←→ TURN PAGE · ESC CLOSE"
      onClose={close}
    >
      {failed && (
        <WindfoilText font={FONT.mono} fontSize={TYPE.body} color={rgba(ARC.red)} position={[0, -0.1, 0]}>
          {'THIS RECORD DID NOT DECODE.\nTHE FLAT ARCHIVE STILL HAS IT — CHECK THE URL DIRECTLY.'}
        </WindfoilText>
      )}
      {!failed && !pages && (
        <WindfoilText
          font={FONT.mono}
          fontSize={TYPE.body}
          color={rgba(ARC.greenDim)}
          position={[0, -0.1, 0]}
        >
          DECODING RECORD…
        </WindfoilText>
      )}
      {pages &&
        pages[page]?.map((p, i) => (
          <WindfoilText
            key={`${page}-${i}`}
            font={FONT.mono}
            fontSize={p.block.t === 'h' ? HEAD_SIZE : BODY_SIZE}
            color={
              p.block.t === 'h'
                ? rgba(ARC.amber)
                : p.block.t === 'q'
                  ? rgba(ARC.green, 0.7)
                  : rgba(ARC.greenBright, 1)
            }
            position={[p.col * (COL_W + COL_GAP), -p.y, 0]}
            maxWidth={COL_W}
            lineHeight={LINE_HEIGHT}
            // Fresh blocks every page turn (key changes with `page`) — the record "decodes in"
            // block by block, staggered slightly by reading order.
            revealDuration={420}
            revealDelay={Math.min(i * 18, 260)}
          >
            {p.block.t === 'h' ? p.block.x.toUpperCase() : p.block.x}
          </WindfoilText>
        ))}

      {/* page chevrons */}
      {pages && pages.length > 1 && (
        <>
          {page > 0 && (
            <PageChevron
              x={-0.028}
              label="◀"
              onPress={() => setPage((p) => Math.max(p - 1, 0))}
            />
          )}
          {page < pages.length - 1 && (
            <PageChevron
              x={MODAL_W - MODAL_PAD * 2 + 0.028}
              label="▶"
              onPress={() => setPage((p) => Math.min(p + 1, (pages?.length ?? 1) - 1))}
            />
          )}
        </>
      )}

      {/* film chip */}
      {hasFilm && (
        <group position={[MODAL_W - MODAL_PAD * 2 - 0.14, 0.085, 0]}>
          <mesh
            onPointerDown={(e) => {
              stopLook(e)
              playSound('confirm')
              openModal(router, { type: 'video', slug })
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'auto'
            }}
          >
            <planeGeometry args={[0.28, 0.05]} />
            <meshBasicMaterial color={ARC.greenFaint} />
          </mesh>
          <WindfoilText
            font={FONT.display}
            fontSize={0.028}
            color={rgba(ARC.amber)}
            anchorX="center"
            anchorY="middle"
            position={[0, 0, 0.001]}
          >
            ▶ WATCH FILM
          </WindfoilText>
        </group>
      )}
    </ModalShell>
  )
}

function PageChevron({ x, label, onPress }: { x: number; label: string; onPress: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <group position={[x, -PAGE_H / 2, 0]}>
      <mesh
        onPointerDown={(e) => {
          stopLook(e)
          playSound('key')
          onPress()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <planeGeometry args={[0.055, 0.11]} />
        <meshBasicMaterial color={hover ? ARC.greenFaint : ARC.bezel} transparent opacity={0.9} />
      </mesh>
      <WindfoilText
        font={FONT.display}
        fontSize={0.04}
        color={rgba(ARC.green, hover ? 1 : 0.7)}
        anchorX="center"
        anchorY="middle"
        position={[0, 0, 0.001]}
      >
        {label}
      </WindfoilText>
    </group>
  )
}
