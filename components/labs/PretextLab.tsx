import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { layout, layoutNextLine, prepare, prepareWithSegments } from '@chenglou/pretext'
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'

type Span = { x: number; width: number }
type Scanline = { y: number; spans: Span[] }
type Placement = { text: string; x: number; y: number; width: number }

type UserRecord = {
  id: number
  name: string
  role: string
  team: string
  tier: string
  risk: 'low' | 'medium' | 'high'
  lastActive: string
  summary: string
}

const ARTICLE_TEXT = `React Three Fiber lets us project article content directly into spatial UI, but typography quality usually lags behind geometry quality. Pretext closes that gap by giving deterministic line measurement and layout without repeated DOM reads. This demo uses scanline image analysis to find safer text corridors, then streams lines through those corridors with layoutNextLine so copy adapts to image constraints. In parallel, the utility-box demo simulates one million users and applies Pretext only to visible records, where right-sized summaries benefit most from fit-aware composition.`

const IMAGE_URL = '/background/scifi1.jpg'
const WORLD_WIDTH = 1024
const WORLD_HEIGHT = 576
const TOTAL_USERS = 1_000_000
const SUMMARY_FONT = '12px Inter'
const SUMMARY_LINE_HEIGHT = 16

const preparedSummaryCache = new Map<string, ReturnType<typeof prepare>>()

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function userFromIndex(index: number): UserRecord {
  const first = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Avery', 'Quinn']
  const last = ['Nguyen', 'Patel', 'Lee', 'Garcia', 'Kim', 'Singh', 'Johnson']
  const roles = ['PM', 'Growth', 'Support', 'Engineering', 'Security', 'Operations']
  const teams = ['Atlas', 'Nova', 'Orion', 'Flux']
  const tiers = ['Free', 'Pro', 'Enterprise']
  const risks: UserRecord['risk'][] = ['low', 'medium', 'high']

  const a = Math.floor(seededRandom(index + 1) * first.length)
  const b = Math.floor(seededRandom(index + 7) * last.length)
  const role = roles[Math.floor(seededRandom(index + 17) * roles.length)]
  const team = teams[Math.floor(seededRandom(index + 31) * teams.length)]
  const tier = tiers[Math.floor(seededRandom(index + 53) * tiers.length)]
  const risk = risks[Math.floor(seededRandom(index + 71) * risks.length)]
  const hoursAgo = Math.floor(seededRandom(index + 103) * 240)

  return {
    id: index + 1,
    name: `${first[a]} ${last[b]}`,
    role,
    team,
    tier,
    risk,
    lastActive: `${hoursAgo}h ago`,
    summary:
      risk === 'high'
        ? 'Needs follow-up on churn signals and unresolved tickets.'
        : risk === 'medium'
          ? 'Healthy usage with moderate expansion potential this quarter.'
          : 'Highly active account with strong retention indicators.',
  }
}

async function analyzeImageForScanlines(
  imageUrl: string,
  width: number,
  height: number,
  lineHeight: number
): Promise<Scanline[]> {
  const img = new Image()
  img.src = imageUrl
  await img.decode()

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  ctx.drawImage(img, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  const rows: Scanline[] = []

  const safePadding = 40
  const centerX = width / 2
  const centerY = height * 0.5
  const excludedRx = width * 0.19
  const excludedRy = height * 0.30

  for (let y = safePadding; y < height - safePadding; y += lineHeight) {
    const spans: Span[] = []
    let openStart = -1

    for (let x = safePadding; x < width - safePadding; x += 8) {
      const nx = (x - centerX) / excludedRx
      const ny = (y - centerY) / excludedRy
      const inSubjectZone = nx * nx + ny * ny < 1

      const ix = (Math.floor(y) * width + Math.floor(x)) * 4
      const r = imageData.data[ix] ?? 0
      const g = imageData.data[ix + 1] ?? 0
      const b = imageData.data[ix + 2] ?? 0
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const textFriendly = luminance < 160

      if (!inSubjectZone && textFriendly) {
        if (openStart < 0) openStart = x
      } else if (openStart >= 0) {
        const widthPx = x - openStart
        if (widthPx > 150) spans.push({ x: openStart, width: widthPx })
        openStart = -1
      }
    }

    if (openStart >= 0) {
      const widthPx = width - safePadding - openStart
      if (widthPx > 150) spans.push({ x: openStart, width: widthPx })
    }

    rows.push({ y, spans: spans.sort((a, b) => b.width - a.width) })
  }

  return rows
}

function fitUtilityText(user: UserRecord, width: number, maxHeight: number) {
  const essential = [`${user.name} (${user.tier})`, `${user.role} · ${user.team}`]
  const optionalVariants = [
    [`Risk: ${user.risk.toUpperCase()}`, `R:${user.risk[0].toUpperCase()}`],
    [`Active ${user.lastActive}`, user.lastActive],
    [user.summary, 'Strong account health and growth trend.'],
  ]

  const selected = [...essential]

  for (const variants of optionalVariants) {
    let accepted = false
    for (const variant of variants) {
      const candidate = [...selected, variant].join(' • ')
      const cacheKey = `${SUMMARY_FONT}:${candidate}`
      const prepared = preparedSummaryCache.get(cacheKey) ?? prepare(candidate, SUMMARY_FONT)
      if (!preparedSummaryCache.has(cacheKey)) {
        preparedSummaryCache.set(cacheKey, prepared)
      }
      const metrics = layout(prepared, width, SUMMARY_LINE_HEIGHT)
      if (metrics.height <= maxHeight) {
        selected.push(variant)
        accepted = true
        break
      }
    }
    if (!accepted) continue
  }

  return selected.join(' • ')
}

function MillionUserUtilityTable() {
  const parentRef = useRef<HTMLDivElement | null>(null)

  const rowVirtualizer = useVirtualizer({
    count: TOTAL_USERS,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 78,
    overscan: 10,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()

  const visibleUsers = useMemo(
    () =>
      virtualItems.map((item) => ({
        virtualIndex: item.index,
        user: userFromIndex(item.index),
      })),
    [virtualItems]
  )

  const columns = useMemo<ColumnDef<(typeof visibleUsers)[number]>[]>(
    () => [
      {
        header: 'ID',
        cell: (info) => info.row.original.user.id.toLocaleString(),
      },
      {
        header: 'Name',
        cell: (info) => info.row.original.user.name,
      },
      {
        header: 'Utility Box (Pretext fit)',
        cell: (info) => {
          const summary = fitUtilityText(info.row.original.user, 360, 48)
          return <div className="utilityBox">{summary}</div>
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data: visibleUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="sectionCard">
      <h2>Million-record utility-box simulation</h2>
      <p>
        This view virtualizes 1,000,000 synthetic users. Only visible rows are rendered, and Pretext
        is applied to each visible utility box to choose the densest readable summary.
      </p>
      <div className="tableShell" ref={parentRef}>
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {virtualItems.map((virtualRow, localIndex) => {
            const row = table.getRowModel().rows[localIndex]
            if (!row) return null

            return (
              <div
                className="virtualRow"
                key={virtualRow.key}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <div className="cell" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ArticlePlane() {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [lineCount, setLineCount] = useState(0)

  useEffect(() => {
    let disposed = false

    async function build() {
      const lineHeight = 28
      const font = '600 24px Inter'
      const prepared = prepareWithSegments(ARTICLE_TEXT, font)
      const scanlines = await analyzeImageForScanlines(IMAGE_URL, WORLD_WIDTH, WORLD_HEIGHT, lineHeight)

      const placements: Placement[] = []
      let cursor = { segmentIndex: 0, graphemeIndex: 0 }
      const textInset = 18

      for (const row of scanlines) {
        const targetSpan = row.spans[0]
        if (!targetSpan) continue
        const line = layoutNextLine(prepared, cursor, targetSpan.width - textInset * 2)
        if (!line) break

        placements.push({
          text: line.text,
          x: targetSpan.x + textInset,
          y: row.y,
          width: line.width,
        })
        cursor = line.end
      }

      const canvas = document.createElement('canvas')
      canvas.width = WORLD_WIDTH
      canvas.height = WORLD_HEIGHT
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const img = new Image()
      img.src = IMAGE_URL
      await img.decode()

      ctx.drawImage(img, 0, 0, WORLD_WIDTH, WORLD_HEIGHT)
      ctx.fillStyle = 'rgba(6, 8, 15, 0.35)'
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

      ctx.font = font
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#e6f0ff'
      ctx.shadowColor = 'rgba(0,0,0,0.7)'
      ctx.shadowBlur = 8

      placements.forEach((line) => {
        ctx.fillText(line.text, line.x, line.y)
      })

      const nextTexture = new THREE.CanvasTexture(canvas)
      nextTexture.needsUpdate = true

      if (!disposed) {
        setTexture(nextTexture)
        setLineCount(placements.length)
      } else {
        nextTexture.dispose()
      }
    }

    build()

    return () => {
      disposed = true
    }
  }, [])

  return (
    <section className="sectionCard">
      <h2>3D article typography with scanline-aware Pretext flow</h2>
      <p>
        The plane below is composited in-browser: image analysis finds available scanline spans,
        then Pretext streams article lines into those spans via <code>layoutNextLine</code>.
      </p>
      <div className="canvasWrap">
        <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
          <ambientLight intensity={0.7} />
          <directionalLight intensity={1} position={[2, 3, 4]} />
          <mesh>
            <planeGeometry args={[8.4, 4.7]} />
            <meshStandardMaterial map={texture ?? undefined} color={texture ? 'white' : '#0d1422'} />
          </mesh>
          <OrbitControls enablePan={false} minDistance={5.5} maxDistance={8.5} />
        </Canvas>
      </div>
      <p className="meta">Rendered lines: {lineCount}</p>
    </section>
  )
}

export default function PretextLab() {
  return (
    <main className="shell">
      <h1>Pretext Integration Lab</h1>
      <p className="intro">
        This prototype demonstrates two production patterns: 3D article text flow over analyzed
        images, and a one-million-row utility-box table where Pretext runs only on visible rows.
      </p>
      <ArticlePlane />
      <MillionUserUtilityTable />
      <style jsx>{`
        .shell {
          min-height: 100vh;
          padding: 24px;
          background: radial-gradient(circle at top, #16223a, #080b12 60%);
          color: #edf2ff;
          font-family: Inter, sans-serif;
        }
        h1 {
          margin: 0 0 8px;
        }
        .intro {
          margin: 0 0 20px;
          max-width: 980px;
          color: #c2cde6;
        }
        .sectionCard {
          background: rgba(15, 20, 34, 0.85);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 18px;
        }
        .canvasWrap {
          height: 460px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.2);
        }
        .meta {
          margin-top: 10px;
          color: #9fb0d0;
        }
        .tableShell {
          margin-top: 12px;
          height: 520px;
          overflow: auto;
          position: relative;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 10px;
          background: rgba(9, 13, 24, 0.9);
        }
        .virtualRow {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          display: grid;
          grid-template-columns: 120px 220px 1fr;
          gap: 8px;
          padding: 10px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        }
        .cell {
          display: flex;
          align-items: center;
          font-size: 13px;
          color: #dce7ff;
        }
        .utilityBox {
          width: 100%;
          max-width: 360px;
          max-height: 48px;
          overflow: hidden;
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 8px;
          padding: 6px 8px;
          line-height: 16px;
          color: #c7d7ff;
        }
      `}</style>
    </main>
  )
}
