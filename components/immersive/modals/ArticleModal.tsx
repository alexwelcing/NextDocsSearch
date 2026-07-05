// The ARC article reader: full record text as windfoil glyphs, paginated into two columns per
// page (real layout measurement, not estimates). Arrow keys / wheel / on-screen chevrons turn
// pages. Page 1 opens with the record's VISUAL RECORD hero plate; a PLATES chip pages through
// the record's multi-art in a lightbox; a WATCH chip appears when the record has a film.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import * as THREE from 'three/webgpu'
import { WindfoilText, useFontAtlas } from '../text/WindfoilText'
import { ModalShell, MODAL_H, MODAL_PAD, MODAL_W, stopLook } from './ModalShell'
import { layoutText } from '@/lib/windfoil/layout'
import type { FontAtlas } from '@/lib/windfoil/types'
import { closeModal, openModal } from '@/lib/immersive/navigation'
import { loadMedia } from '@/lib/immersive/media'
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
const CONTENT_W = MODAL_W - MODAL_PAD * 2
const PAGE_H = MODAL_H - 0.33
const BODY_SIZE = 0.028
const HEAD_SIZE = 0.034
const LINE_HEIGHT = 1.38
const BLOCK_GAP = 0.024

// VISUAL RECORD plate: caption line + framed image at the top of page 1, column 1. The text
// flow starts below the full reserve.
const HERO_CAP_H = 0.028
const HERO_IMG_H = 0.3
const HERO_RESERVE = HERO_CAP_H + HERO_IMG_H + 0.034

// media chips (PLATES / WATCH FILM) sit in the footer strip between the bottom of the text
// columns (-PAGE_H) and the ModalShell hints line, right-aligned
const CHIP_Y = -PAGE_H - 0.06

const RASTER = /\.(jpe?g|png|webp)$/i

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

function paginate(blocks: RecordBlock[], atlas: FontAtlas, reserveFirstCol = 0): Placed[][] {
  const pages: Placed[][] = []
  let page: Placed[] = []
  let col = 0
  let y = reserveFirstCol
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

/** TextureLoader plane: cover-crops into a fixed frame or contain-fits inside a bounding box. */
function RecordImage({
  url,
  width,
  height,
  fit,
  renderOrder = 8,
}: {
  url: string
  width: number
  height: number
  fit: 'cover' | 'contain'
  renderOrder?: number
}) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    let live = true
    let loaded: THREE.Texture | null = null
    new THREE.TextureLoader().load(
      url,
      (t) => {
        if (!live) {
          t.dispose()
          return
        }
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 4
        loaded = t
        setTex(t)
      },
      undefined,
      () => undefined // missing plate: the frame simply stays empty
    )
    return () => {
      live = false
      loaded?.dispose()
      setTex(null)
    }
  }, [url])

  const img = tex?.image as { width?: number; height?: number } | undefined
  const imgAspect = img?.width && img?.height ? img.width / img.height : 1
  const boxAspect = width / height

  let planeW = width
  let planeH = height
  if (tex && fit === 'cover') {
    // fill the frame, crop the overflow axis, centered
    tex.repeat.set(1, 1)
    tex.offset.set(0, 0)
    if (imgAspect > boxAspect) {
      tex.repeat.x = boxAspect / imgAspect
      tex.offset.x = (1 - tex.repeat.x) / 2
    } else {
      tex.repeat.y = imgAspect / boxAspect
      tex.offset.y = (1 - tex.repeat.y) / 2
    }
  } else if (fit === 'contain') {
    if (imgAspect > boxAspect) {
      planeH = width / imgAspect
    } else {
      planeW = height * imgAspect
    }
  }

  if (!tex) return null
  return (
    <mesh renderOrder={renderOrder} scale={[planeW, planeH, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} toneMapped={false} fog={false} />
    </mesh>
  )
}

/** Thin phosphor frame around a w×h rect centered on the group origin. */
function PlateFrame({ w, h, color = ARC.greenDim }: { w: number; h: number; color?: string }) {
  return (
    <>
      {(
        [
          [0, h / 2 + 0.004, w + 0.012, 0.003],
          [0, -h / 2 - 0.004, w + 0.012, 0.003],
          [-w / 2 - 0.004, 0, 0.003, h + 0.012],
          [w / 2 + 0.004, 0, 0.003, h + 0.012],
        ] as const
      ).map(([x, y, pw, ph], i) => (
        <mesh key={i} position={[x, y, 0.0005]} renderOrder={9}>
          <planeGeometry args={[pw, ph]} />
          <meshBasicMaterial color={color} fog={false} />
        </mesh>
      ))}
    </>
  )
}

const LIGHTBOX_IMG_W = 1.34
const LIGHTBOX_IMG_H = 0.7

/** Paged lightbox over the record's multi-art plates. Owns Escape via a capture-phase keydown
 *  so backing out never closes the reader underneath. */
function PlateLightbox({
  plates,
  index,
  onIndex,
  onExit,
}: {
  plates: string[]
  index: number
  onIndex: (i: number) => void
  onExit: () => void
}) {
  const wheelAcc = useRef(0)
  const cycle = (dir: number) => {
    onIndex((index + dir + plates.length) % plates.length)
    playSound('key')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        playSound('close')
        onExit()
      } else if (e.key === 'ArrowRight') {
        cycle(1)
      } else if (e.key === 'ArrowLeft') {
        cycle(-1)
      } else {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
    // capture phase: this runs before (and suppresses) the reader's page-turn listener and
    // ModalShell's Escape-to-close listener
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, plates.length, onExit])

  // children-local coords of the slab center (children group sits at the top-left inset)
  const cx = MODAL_W / 2 - MODAL_PAD
  const cy = -(MODAL_H / 2 - 0.145)

  return (
    <group position={[cx, cy, 0.01]}>
      <mesh
        renderOrder={14}
        onPointerDown={stopLook}
        onPointerUp={(e) => e.stopPropagation()}
        onPointerOver={(e) => e.stopPropagation()}
        onWheel={(e) => {
          e.stopPropagation()
          e.nativeEvent.stopImmediatePropagation?.()
          wheelAcc.current += e.deltaY
          if (Math.abs(wheelAcc.current) >= 40) {
            cycle(wheelAcc.current > 0 ? 1 : -1)
            wheelAcc.current = 0
          }
        }}
      >
        <planeGeometry args={[MODAL_W - 0.015, MODAL_H - 0.015]} />
        <meshBasicMaterial color={ARC.screenBg} transparent opacity={0.97} fog={false} />
      </mesh>
      <group position={[0, 0.03, 0.002]}>
        <RecordImage
          key={plates[index]}
          url={plates[index]}
          width={LIGHTBOX_IMG_W}
          height={LIGHTBOX_IMG_H}
          fit="contain"
          renderOrder={15}
        />
        <PlateFrame w={LIGHTBOX_IMG_W} h={LIGHTBOX_IMG_H} />
      </group>
      <WindfoilText
        font={FONT.display}
        fontSize={0.032}
        color={rgba(ARC.amber)}
        anchorX="center"
        position={[0, MODAL_H / 2 - 0.045, 0.002]}
        renderOrder={16}
      >
        {`+ PLATE ${index + 1}/${plates.length}`}
      </WindfoilText>
      <LightboxArrow x={-MODAL_W / 2 + 0.09} label="<" onPress={() => cycle(-1)} />
      <LightboxArrow x={MODAL_W / 2 - 0.09} label=">" onPress={() => cycle(1)} />
      <WindfoilText
        font={FONT.mono}
        fontSize={TYPE.micro}
        color={rgba(ARC.greenDim)}
        anchorX="center"
        position={[0, -MODAL_H / 2 + 0.055, 0.002]}
        renderOrder={16}
      >
        {'<> / SCROLL CYCLE · ESC BACK'}
      </WindfoilText>
    </group>
  )
}

function LightboxArrow({ x, label, onPress }: { x: number; label: string; onPress: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <group position={[x, 0.03, 0.002]}>
      <mesh
        renderOrder={15}
        onPointerDown={(e) => {
          stopLook(e)
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
        <planeGeometry args={[0.09, 0.22]} />
        <meshBasicMaterial color={hover ? ARC.greenFaint : ARC.bezel} transparent opacity={0.9} />
      </mesh>
      <WindfoilText
        font={FONT.display}
        fontSize={0.055}
        color={rgba(ARC.green, hover ? 1 : 0.7)}
        anchorX="center"
        anchorY="middle"
        position={[0, 0, 0.001]}
        renderOrder={16}
      >
        {label}
      </WindfoilText>
    </group>
  )
}

export function ArticleModal({ slug }: { slug: string }) {
  const router = useRouter()
  const atlas = useFontAtlas(FONT.mono)
  const [record, setRecord] = useState<ArticleRecord | null>(null)
  const [failed, setFailed] = useState(false)
  const [page, setPage] = useState(0)
  const [hasFilm, setHasFilm] = useState(false)
  const [plates, setPlates] = useState<string[]>([])
  const [lightbox, setLightbox] = useState(false)
  const [plateIndex, setPlateIndex] = useState(0)
  const wheelAcc = useRef(0)
  const pageRef = useRef(0)
  pageRef.current = page

  useEffect(() => {
    let live = true
    setRecord(null)
    setPage(0)
    setFailed(false)
    setLightbox(false)
    setPlateIndex(0)
    fetch(`/arc/records/${slug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ArticleRecord) => live && setRecord(d))
      .catch(() => live && setFailed(true))
    loadMedia()
      .then((m) => {
        if (!live) return
        setHasFilm(m.films.has(slug))
        setPlates(m.plates[slug] ?? [])
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [slug])

  // hero plate source: the record hero when it's a raster, else the first multi-art plate
  // (most heroes are SVG, which TextureLoader can't decode)
  const heroSrc = useMemo(() => {
    const h = record?.hero
    if (h && RASTER.test(h)) return h
    return plates[0] ?? null
  }, [record, plates])

  const pages = useMemo(() => {
    if (!record || !atlas) return null
    return paginate(record.blocks, atlas, heroSrc ? HERO_RESERVE : 0)
  }, [record, atlas, heroSrc])

  const turnPage = (dir: number) => {
    if (!pages) return
    setPage((p) => {
      const next = Math.max(0, Math.min(p + dir, pages.length - 1))
      if (next !== p) playSound('key')
      return next
    })
  }

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
      hints="<> / SCROLL TURN PAGE · ESC CLOSE"
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

      {/* wheel-to-turn-page over the whole text area (chevrons and chips still get their own
          pointer events — this plane only listens for wheel) */}
      {pages && pages.length > 1 && !lightbox && (
        <mesh
          position={[CONTENT_W / 2, -PAGE_H / 2, 0.004]}
          onWheel={(e) => {
            e.stopPropagation()
            e.nativeEvent.stopImmediatePropagation?.()
            wheelAcc.current += e.deltaY
            if (Math.abs(wheelAcc.current) >= 40) {
              turnPage(wheelAcc.current > 0 ? 1 : -1)
              wheelAcc.current = 0
            }
          }}
        >
          <planeGeometry args={[CONTENT_W + 0.18, PAGE_H + 0.08]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} transparent />
        </mesh>
      )}

      {/* VISUAL RECORD hero plate — page 1, column 1; the text flow reserves its space */}
      {pages && page === 0 && heroSrc && (
        <group>
          <WindfoilText
            font={FONT.display}
            fontSize={0.026}
            color={rgba(ARC.amber, 0.9)}
            position={[0.004, -0.002, 0]}
            renderOrder={10}
          >
            + VISUAL RECORD
          </WindfoilText>
          <group position={[COL_W / 2, -HERO_CAP_H - HERO_IMG_H / 2, 0]}>
            <RecordImage url={heroSrc} width={COL_W} height={HERO_IMG_H} fit="cover" />
            <PlateFrame w={COL_W} h={HERO_IMG_H} />
          </group>
        </group>
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
              label="<"
              onPress={() => setPage((p) => Math.max(p - 1, 0))}
            />
          )}
          {page < pages.length - 1 && (
            <PageChevron
              x={MODAL_W - MODAL_PAD * 2 + 0.028}
              label=">"
              onPress={() => setPage((p) => Math.min(p + 1, (pages?.length ?? 1) - 1))}
            />
          )}
        </>
      )}

      {/* media chips live in the footer strip (below the text columns, right-aligned) — the
          header's right side belongs to the date/PAGE meta text, which they used to overlap */}
      {plates.length > 0 && (
        <group position={[CONTENT_W - (hasFilm ? 0.44 : 0.14), CHIP_Y, 0]}>
          <mesh
            onPointerDown={(e) => {
              stopLook(e)
              playSound('open')
              setLightbox(true)
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'auto'
            }}
          >
            <planeGeometry args={[0.26, 0.05]} />
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
            {`+ PLATES ${plates.length}`}
          </WindfoilText>
        </group>
      )}

      {/* film chip */}
      {hasFilm && (
        <group position={[CONTENT_W - 0.14, CHIP_Y, 0]}>
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
            » WATCH FILM
          </WindfoilText>
        </group>
      )}

      {/* plates lightbox — above everything in the slab */}
      {lightbox && plates.length > 0 && (
        <PlateLightbox
          plates={plates}
          index={plateIndex}
          onIndex={setPlateIndex}
          onExit={() => setLightbox(false)}
        />
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
