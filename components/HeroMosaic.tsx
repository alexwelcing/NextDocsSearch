/**
 * HERO MOSAIC — interactive image wall that reveals the 360 scene behind glass.
 *
 * The landing page is a carnival knock-down game: users aim a cannon at curated
 * image panels, crack/shatter every panel, and then automatically enter the 360
 * panoramic scene that has been revealed behind the wall.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import GlassCrackOverlay from './GlassCrackOverlay'
import GlassBreakEffect from './GlassBreakEffect'
import ThrowBall from './ThrowBall'

const GRID_COLS = 4
const GRID_ROWS = 3
const TILE_COUNT = GRID_COLS * GRID_ROWS
const COMPLETE_TRANSITION_DELAY = 900

const FALLBACK_TILES: { src: string; alt: string }[] = [
  {
    src: '/images/multi-art/tech-byzantine-fault-tolerance/option-2-stable-diffusion-v35-large.png',
    alt: 'Byzantine fault tolerance',
  },
  {
    src: '/images/multi-art/tech-cellular-automata-computing/option-2-stable-diffusion-v35-large.png',
    alt: 'Cellular automata computing',
  },
  {
    src: '/images/multi-art/tech-nanoscale-self-assembly/option-2-stable-diffusion-v35-large.png',
    alt: 'Nanoscale self assembly',
  },
  {
    src: '/images/multi-art/tech-quantum-error-correction-qiskit/option-2-stable-diffusion-v35-large.png',
    alt: 'Quantum error correction',
  },
  {
    src: '/images/multi-art/tech-secrets-management-vault/option-2-stable-diffusion-v35-large.png',
    alt: 'Secrets management vault',
  },
  {
    src: '/images/multi-art/tech-thermal-imaging-detection/option-2-stable-diffusion-v35-large.png',
    alt: 'Thermal imaging detection',
  },
  {
    src: '/images/multi-art/tech-time-series-database-prometheus/option-2-stable-diffusion-v35-large.png',
    alt: 'Time series database Prometheus',
  },
  {
    src: '/images/multi-art/tech-tokamak-plasma-control/option-2-stable-diffusion-v35-large.png',
    alt: 'Tokamak plasma control',
  },
  {
    src: '/images/multi-art/tech-blockchain-smart-contracts/option-3-stable-cascade.png',
    alt: 'Blockchain smart contracts',
  },
  {
    src: '/images/multi-art/tech-dna-data-storage/option-3-stable-cascade.png',
    alt: 'DNA data storage',
  },
  {
    src: '/images/multi-art/tech-optical-neural-networks/option-3-stable-cascade.png',
    alt: 'Optical neural networks',
  },
  {
    src: '/images/multi-art/tech-swarm-robotics-coordination/option-3-stable-cascade.png',
    alt: 'Swarm robotics coordination',
  },
]

type DescentPhase = 'void' | 'grid' | 'shapes' | 'color' | 'alive'

interface TileState {
  src: string
  alt: string
  hits: number
  crackImpacts: { x: number; y: number }[]
  breaking: boolean
  broken: boolean
  impactX: number
  impactY: number
  impactForce: number
  flashKey: number
}

interface HeroMosaicProps {
  panoramaSrc?: string | null
  onAllPanelsBroken?: () => void
}

const PHASE_TIMING: Record<DescentPhase, number> = {
  void: 0,
  grid: 500,
  shapes: 1300,
  color: 2500,
  alive: 3600,
}

function makeTileState(t: { src: string; alt: string }): TileState {
  return {
    ...t,
    hits: 0,
    crackImpacts: [],
    breaking: false,
    broken: false,
    impactX: 0.5,
    impactY: 0.5,
    impactForce: 3,
    flashKey: 0,
  }
}

function normalizePublicSrc(src?: string | null) {
  if (!src) return '/background/space.jpg'
  return src.startsWith('./') ? src.slice(1) : src
}

export default function HeroMosaic({ panoramaSrc, onAllPanelsBroken }: HeroMosaicProps) {
  const [phase, setPhase] = useState<DescentPhase>('void')
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 })
  const [transitioning, setTransitioning] = useState(false)
  const [tiles, setTiles] = useState<TileState[]>(
    FALLBACK_TILES.slice(0, TILE_COUNT).map(makeTileState)
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const tileRefs = useRef<(HTMLDivElement | null)[]>([])
  const completionTriggeredRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/tile-images')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((images: { src: string; alt: string }[]) => {
        if (cancelled || images.length === 0) return
        const initial = images.slice(0, TILE_COUNT)
        setTiles((prev) =>
          initial.map((img, i) => ({
            ...(prev[i] ?? makeTileState(img)),
            src: img.src,
            alt: img.alt,
          }))
        )
      })
      .catch(() => {
        // Fallback set is deliberately curated so first paint still feels strong.
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timers = (Object.entries(PHASE_TIMING) as [DescentPhase, number][])
      .filter(([p]) => p !== 'void')
      .map(([p, delay]) => setTimeout(() => setPhase(p), delay))
    return () => timers.forEach(clearTimeout)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setMouse({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    })
  }, [])

  const handleBallImpact = useCallback((viewportX: number, viewportY: number, force: number) => {
    let hitIndex = -1
    let bestDist = Infinity
    let localX = 0.5
    let localY = 0.5

    tileRefs.current.forEach((el, i) => {
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (
        viewportX >= rect.left &&
        viewportX <= rect.right &&
        viewportY >= rect.top &&
        viewportY <= rect.bottom
      ) {
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dist = Math.hypot(viewportX - cx, viewportY - cy)
        if (dist < bestDist) {
          bestDist = dist
          hitIndex = i
          localX = (viewportX - rect.left) / rect.width
          localY = (viewportY - rect.top) / rect.height
        }
      }
    })

    if (hitIndex === -1) {
      tileRefs.current.forEach((el, i) => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dist = Math.hypot(viewportX - cx, viewportY - cy)
        if (dist < bestDist) {
          bestDist = dist
          hitIndex = i
          localX = Math.max(0, Math.min(1, (viewportX - rect.left) / rect.width))
          localY = Math.max(0, Math.min(1, (viewportY - rect.top) / rect.height))
        }
      })
    }

    if (hitIndex === -1) return

    setTiles((prev) => {
      const tile = prev[hitIndex]
      if (tile.breaking || tile.broken || tile.hits >= 3) return prev

      return prev.map((t, i) => {
        if (i !== hitIndex) return t
        const newHits = t.hits + 1

        if (newHits < 3) {
          return {
            ...t,
            hits: newHits,
            crackImpacts: [...t.crackImpacts, { x: localX, y: localY }],
            impactX: localX,
            impactY: localY,
            flashKey: t.flashKey + 1,
          }
        }

        return {
          ...t,
          hits: 3,
          breaking: true,
          impactX: localX,
          impactY: localY,
          impactForce: 2.4 + force * 2.2,
          flashKey: t.flashKey + 1,
        }
      })
    })
  }, [])

  const handleBreakComplete = useCallback(
    (tileIndex: number) => {
      setTiles((prev) => {
        const next = prev.map((t, i) =>
          i === tileIndex ? { ...t, breaking: false, broken: true, hits: 3, crackImpacts: [] } : t
        )

        if (next.every((t) => t.broken) && !completionTriggeredRef.current) {
          completionTriggeredRef.current = true
          setTransitioning(true)
          setTimeout(() => onAllPanelsBroken?.(), COMPLETE_TRANSITION_DELAY)
        }

        return next
      })
    },
    [onAllPanelsBroken]
  )

  const brokenCount = tiles.filter((tile) => tile.broken).length
  const panoramaReveal = Math.min(0.92, 0.18 + (brokenCount / TILE_COUNT) * 0.74)
  const gridOpacity =
    phase === 'void'
      ? 0
      : phase === 'grid'
      ? 0.25
      : phase === 'shapes'
      ? 0.55
      : phase === 'color'
      ? 0.82
      : 0.96
  const gridFilter =
    phase === 'void'
      ? 'grayscale(1) brightness(0)'
      : phase === 'grid'
      ? 'grayscale(1) brightness(0.35) contrast(1.5)'
      : phase === 'shapes'
      ? 'grayscale(0.55) brightness(0.62) contrast(1.18)'
      : phase === 'color'
      ? 'grayscale(0.1) brightness(0.82) saturate(1.28)'
      : 'grayscale(0) brightness(0.92) saturate(1.36)'
  const isAlive = phase === 'alive'
  const backgroundSrc = normalizePublicSrc(panoramaSrc)

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        zIndex: 0,
        background: '#030308',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '-8%',
          zIndex: 0,
          backgroundImage: `linear-gradient(rgba(2, 4, 12, 0.08), rgba(2, 4, 12, 0.18)), url(${backgroundSrc})`,
          backgroundSize: 'cover',
          backgroundPosition: `${50 + (mouse.x - 0.5) * 8}% ${50 + (mouse.y - 0.5) * 5}%`,
          filter: 'saturate(1.35) contrast(1.08) brightness(0.9)',
          opacity: panoramaReveal,
          transform: `scale(${1.04 + brokenCount * 0.002})`,
          transition: 'opacity 0.7s ease, background-position 0.15s ease, transform 0.7s ease',
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background:
            'radial-gradient(circle at 50% 55%, transparent 0%, rgba(3, 3, 8, 0.35) 64%, rgba(3, 3, 8, 0.82) 100%)',
          pointerEvents: 'none',
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          opacity:
            phase === 'void' ? 0 : phase === 'grid' ? 0.34 : phase === 'shapes' ? 0.18 : 0.08,
          transition: 'opacity 1.2s ease',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: `${100 / GRID_COLS}% ${100 / GRID_ROWS}%`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: '-5%',
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          gap: '2px',
          opacity: gridOpacity,
          filter: gridFilter,
          transition: 'opacity 1.4s ease, filter 1.8s ease',
          willChange: 'opacity, filter',
          transform: `translate(${(mouse.x - 0.5) * -12}px, ${(mouse.y - 0.5) * -12}px)`,
        }}
      >
        {tiles.map((tile, i) => {
          const col = i % GRID_COLS
          const row = Math.floor(i / GRID_COLS)
          const tileCenterX = (col + 0.5) / GRID_COLS
          const tileCenterY = (row + 0.5) / GRID_ROWS
          const dist = Math.hypot(mouse.x - tileCenterX, mouse.y - tileCenterY)
          const proximityBoost = isAlive ? Math.max(0, 1 - dist * 2.2) : 0
          const stagger = i * 100
          const crackTint =
            tile.hits > 0 && !tile.breaking ? `brightness(${1 - tile.hits * 0.05})` : ''

          return (
            <div
              key={`tile-${i}`}
              ref={(el) => {
                tileRefs.current[i] = el
              }}
              style={{
                position: 'relative',
                overflow: 'hidden',
                opacity: tile.broken ? 0 : 1,
                filter:
                  isAlive && !tile.breaking
                    ? `brightness(${1 + proximityBoost * 0.52}) saturate(${
                        1 + proximityBoost * 0.8
                      }) ${crackTint}`
                    : crackTint || 'none',
                transition: 'filter 0.35s ease, transform 0.45s ease, opacity 0.5s ease',
                transitionDelay: phase === 'shapes' ? `${stagger}ms` : '0ms',
                transform:
                  isAlive && !tile.breaking ? `scale(${1 + proximityBoost * 0.035})` : 'none',
                boxShadow:
                  tile.hits > 0 && !tile.broken
                    ? 'inset 0 0 28px rgba(166, 226, 255, 0.16)'
                    : undefined,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: tile.breaking ? 0 : 1,
                  transition: tile.breaking ? 'opacity 0.1s ease' : undefined,
                }}
              >
                <Image
                  src={tile.src}
                  alt={tile.alt}
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="25vw"
                  priority={i < 4}
                />
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.02) 35%, rgba(0,0,0,0.18))',
                    border: '1px solid rgba(230, 248, 255, 0.22)',
                    boxShadow: 'inset 0 0 22px rgba(255,255,255,0.08)',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {tile.hits > 0 && tile.hits < 3 && !tile.breaking && !tile.broken && (
                <GlassCrackOverlay
                  width={tileRefs.current[i]?.offsetWidth ?? 300}
                  height={tileRefs.current[i]?.offsetHeight ?? 250}
                  impacts={tile.crackImpacts}
                />
              )}

              {tile.breaking && (
                <GlassBreakEffect
                  imageSrc={tile.src}
                  width={tileRefs.current[i]?.offsetWidth ?? 300}
                  height={tileRefs.current[i]?.offsetHeight ?? 250}
                  impactX={tile.impactX}
                  impactY={tile.impactY}
                  impactForce={tile.impactForce}
                  onComplete={() => handleBreakComplete(i)}
                />
              )}

              {tile.hits > 0 && !tile.broken && (
                <div
                  key={`flash-${tile.flashKey}`}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(circle at ${tile.impactX * 100}% ${
                      tile.impactY * 100
                    }%, rgba(255, 245, 195, ${tile.hits >= 3 ? 0.62 : 0.34}) 0%, transparent 60%)`,
                    opacity: 0,
                    animation: 'impactFlash 0.35s ease-out forwards',
                    pointerEvents: 'none',
                    zIndex: 11,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {isAlive && !transitioning && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 28,
            transform: 'translateX(-50%)',
            zIndex: 8,
            padding: '10px 16px',
            borderRadius: 999,
            border: '1px solid rgba(255, 216, 92, 0.45)',
            background: 'linear-gradient(180deg, rgba(35, 18, 3, 0.72), rgba(8, 10, 18, 0.72))',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35), inset 0 0 22px rgba(255, 194, 80, 0.12)',
            color: 'rgba(255, 245, 210, 0.94)',
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            pointerEvents: 'none',
            textAlign: 'center',
          }}
        >
          Aim the carnival cannon. Break every glass image. {brokenCount}/{TILE_COUNT} panels broken
        </div>
      )}

      {isAlive && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            pointerEvents: 'none',
            background: `radial-gradient(ellipse 35% 40% at ${mouse.x * 100}% ${
              mouse.y * 100
            }%, rgba(255, 255, 255, 0.07) 0%, transparent 100%)`,
            transition: 'background 0.1s ease',
          }}
        />
      )}

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 4,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 52% 48% at 50% 50%, rgba(3, 3, 8, 0.72) 0%, rgba(3, 3, 8, 0.42) 44%, rgba(3, 3, 8, 0.1) 76%, transparent 100%)',
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 5,
          pointerEvents: 'none',
          boxShadow: 'inset 0 0 120px 60px #030308, inset 0 0 250px 100px rgba(3, 3, 8, 0.5)',
        }}
      />

      {isAlive && !transitioning && (
        <ThrowBall onImpact={handleBallImpact} disabled={false} containerRef={containerRef} />
      )}

      {transitioning && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'radial-gradient(circle at 50% 50%, rgba(0, 212, 255, 0.12), rgba(3, 3, 8, 0.9) 72%)',
            color: 'white',
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: 'clamp(22px, 4vw, 52px)',
            fontWeight: 850,
            letterSpacing: '-0.03em',
            animation: 'panoramaPortalIn 0.9s ease forwards',
            pointerEvents: 'none',
          }}
        >
          Entering the 360 scene
        </div>
      )}

      <style>{`
        @keyframes impactFlash {
          0% {
            opacity: 0.9;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(1.4);
          }
        }
        @keyframes panoramaPortalIn {
          0% {
            opacity: 0;
            backdrop-filter: blur(0px);
          }
          100% {
            opacity: 1;
            backdrop-filter: blur(10px);
          }
        }
      `}</style>
    </div>
  )
}
