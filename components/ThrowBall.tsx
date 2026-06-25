/**
 * CARNIVAL CANNON — obvious projectile launcher for the glass-image wall.
 *
 * This keeps the existing ThrowBall component name/API so HeroMosaic does not
 * need a wider rename, but the interaction is now the clown-face knock-down
 * game metaphor: aim the cannon, fire balls at the panels, break the glass.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface ThrowBallProps {
  onImpact: (x: number, y: number, force: number) => void
  disabled?: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
}

const BALL_SIZE = 34
const FLIGHT_DURATION = 320
const CANNON_WIDTH = 220
const CANNON_HEIGHT = 120

export default function ThrowBall({ onImpact, disabled, containerRef }: ThrowBallProps) {
  const [aim, setAim] = useState<{ x: number; y: number } | null>(null)
  const [ballPos, setBallPos] = useState<{ x: number; y: number } | null>(null)
  const [flyProgress, setFlyProgress] = useState(0)
  const [isFlying, setIsFlying] = useState(false)
  const [recoilKey, setRecoilKey] = useState(0)
  const [hintVisible, setHintVisible] = useState(true)
  const flyAnimRef = useRef<number>(0)
  const cannonRef = useRef<HTMLDivElement>(null)

  const getCannonBase = useCallback(() => {
    const container = containerRef.current
    if (!container) {
      return { x: window.innerWidth / 2, y: window.innerHeight - 64 }
    }
    const rect = container.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2,
      y: rect.bottom - 58,
    }
  }, [containerRef])

  const clampToContainer = useCallback(
    (x: number, y: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return { x, y }
      return {
        x: Math.max(rect.left + 8, Math.min(rect.right - 8, x)),
        y: Math.max(rect.top + 8, Math.min(rect.bottom - 8, y)),
      }
    },
    [containerRef]
  )

  const currentAim = useMemo(() => {
    if (aim) return aim
    const base = getCannonBase()
    return { x: base.x, y: base.y - 360 }
  }, [aim, getCannonBase])

  const fireAt = useCallback(
    (targetX: number, targetY: number) => {
      if (disabled || isFlying) return

      const target = clampToContainer(targetX, targetY)
      const base = getCannonBase()
      const dx = target.x - base.x
      const dy = target.y - base.y
      const dist = Math.hypot(dx, dy)
      if (dist < 36) return

      setHintVisible(false)
      setRecoilKey((k) => k + 1)
      setIsFlying(true)

      const angle = Math.atan2(dy, dx)
      const muzzleX = base.x + Math.cos(angle) * 76
      const muzzleY = base.y + Math.sin(angle) * 76
      const startTime = performance.now()
      const arcHeight = Math.min(210, Math.max(80, dist * 0.18))

      const animateFlight = (now: number) => {
        const t = Math.min(1, (now - startTime) / FLIGHT_DURATION)
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        const oneMinusT = 1 - eased
        const midX = (muzzleX + target.x) / 2
        const controlY = Math.min(muzzleY, target.y) - arcHeight
        const px =
          oneMinusT * oneMinusT * muzzleX + 2 * oneMinusT * eased * midX + eased * eased * target.x
        const py =
          oneMinusT * oneMinusT * muzzleY +
          2 * oneMinusT * eased * controlY +
          eased * eased * target.y

        setBallPos({ x: px, y: py })
        setFlyProgress(eased)

        if (t < 1) {
          flyAnimRef.current = requestAnimationFrame(animateFlight)
        } else {
          setIsFlying(false)
          setBallPos(null)
          setFlyProgress(0)
          onImpact(target.x, target.y, Math.min(1.6, Math.max(0.75, dist / 520)))
        }
      }

      flyAnimRef.current = requestAnimationFrame(animateFlight)
    },
    [clampToContainer, disabled, getCannonBase, isFlying, onImpact]
  )

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      setAim(clampToContainer(e.clientX, e.clientY))
    }

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-cannon-control="true"], a, button')) return
      setAim(clampToContainer(e.clientX, e.clientY))
      fireAt(e.clientX, e.clientY)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [clampToContainer, containerRef, fireAt])

  useEffect(() => {
    return () => {
      if (flyAnimRef.current) cancelAnimationFrame(flyAnimRef.current)
    }
  }, [])

  const base = getCannonBase()
  const angleRad = Math.atan2(currentAim.y - base.y, currentAim.x - base.x)
  const angleDeg = (angleRad * 180) / Math.PI
  const arcSin = Math.sin(flyProgress * Math.PI)

  return (
    <>
      <svg
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 9997,
        }}
      >
        <defs>
          <linearGradient id="cannonTrajectory" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255, 216, 92, 0.75)" />
            <stop offset="100%" stopColor="rgba(0, 212, 255, 0.05)" />
          </linearGradient>
        </defs>
        <line
          x1={base.x + Math.cos(angleRad) * 82}
          y1={base.y + Math.sin(angleRad) * 82}
          x2={currentAim.x}
          y2={currentAim.y}
          stroke="url(#cannonTrajectory)"
          strokeWidth="2"
          strokeDasharray="8 8"
          opacity={disabled || isFlying ? 0.25 : 0.7}
        />
        <circle
          cx={currentAim.x}
          cy={currentAim.y}
          r="16"
          fill="none"
          stroke="rgba(255, 216, 92, 0.55)"
          strokeWidth="2"
        />
        <path
          d={`M ${currentAim.x - 8} ${currentAim.y} L ${currentAim.x + 8} ${currentAim.y} M ${
            currentAim.x
          } ${currentAim.y - 8} L ${currentAim.x} ${currentAim.y + 8}`}
          stroke="rgba(255, 245, 210, 0.65)"
          strokeWidth="1.5"
        />
      </svg>

      {ballPos && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: ballPos.x - BALL_SIZE / 2,
            top: ballPos.y - BALL_SIZE / 2,
            width: BALL_SIZE,
            height: BALL_SIZE,
            borderRadius: '50%',
            zIndex: 9999,
            pointerEvents: 'none',
            transform: `scale(${1 + arcSin * 0.9})`,
            background:
              'radial-gradient(circle at 35% 28%, #fff8d0 0%, #ffd85c 18%, #e05a25 52%, #4b1608 100%)',
            border: '1px solid rgba(255, 245, 210, 0.7)',
            boxShadow: `0 0 ${
              18 + arcSin * 34
            }px rgba(255, 116, 48, 0.65), inset -5px -7px 10px rgba(0,0,0,0.35)`,
          }}
        />
      )}

      <div
        ref={cannonRef}
        data-cannon-control="true"
        style={{
          position: 'fixed',
          left: base.x - CANNON_WIDTH / 2,
          top: base.y - CANNON_HEIGHT / 2,
          width: CANNON_WIDTH,
          height: CANNON_HEIGHT,
          zIndex: 9998,
          pointerEvents: 'auto',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 2,
            transform: 'translateX(-50%)',
            width: 154,
            height: 42,
            borderRadius: '50% 50% 18px 18px',
            background: 'linear-gradient(180deg, #f8c04d, #8a3d10 72%, #311305)',
            border: '2px solid rgba(255, 233, 154, 0.65)',
            boxShadow: '0 14px 28px rgba(0,0,0,0.45), inset 0 8px 16px rgba(255,255,255,0.18)',
          }}
        />

        <div
          key={recoilKey}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 34,
            width: 142,
            height: 38,
            transformOrigin: '18px 50%',
            transform: `translateX(-18px) rotate(${angleDeg}deg)`,
            animation: 'cannonRecoil 0.22s ease-out',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '28px 42px 42px 28px',
              background: 'linear-gradient(180deg, #ffef9f 0%, #e84f24 46%, #6f1f0f 100%)',
              border: '2px solid rgba(255, 240, 176, 0.8)',
              boxShadow:
                'inset 10px 8px 16px rgba(255,255,255,0.25), inset -10px -8px 14px rgba(0,0,0,0.35), 0 0 22px rgba(255, 89, 33, 0.35)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: -7,
              top: -5,
              width: 28,
              height: 48,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #fff4bb, #c62f17 48%, #260b05 100%)',
              border: '2px solid rgba(255, 232, 153, 0.8)',
            }}
          />
        </div>

        <button
          data-cannon-control="true"
          type="button"
          disabled={disabled || isFlying}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            fireAt(currentAim.x, currentAim.y)
          }}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -30,
            transform: 'translateX(-50%)',
            padding: '8px 18px',
            borderRadius: 999,
            border: '1px solid rgba(255, 232, 153, 0.7)',
            background:
              disabled || isFlying
                ? 'rgba(80, 50, 24, 0.72)'
                : 'linear-gradient(180deg, #ffe28a, #e85a24 62%, #7b210d)',
            color: '#210b02',
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            cursor: disabled || isFlying ? 'default' : 'pointer',
            boxShadow: '0 10px 24px rgba(0,0,0,0.42)',
          }}
        >
          Fire
        </button>
      </div>

      {hintVisible && !disabled && !isFlying && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 164,
            transform: 'translateX(-50%)',
            zIndex: 9998,
            padding: '9px 13px',
            borderRadius: 999,
            background: 'rgba(5, 8, 16, 0.68)',
            border: '1px solid rgba(255, 216, 92, 0.35)',
            color: 'rgba(255, 245, 210, 0.82)',
            fontSize: 11,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            pointerEvents: 'none',
            animation: 'cannonHintPulse 1.7s ease-in-out infinite',
            whiteSpace: 'nowrap',
          }}
        >
          Click a glass image or press Fire
        </div>
      )}

      <style jsx>{`
        @keyframes cannonHintPulse {
          0%,
          100% {
            opacity: 0.82;
            transform: translateX(-50%) translateY(0);
          }
          50% {
            opacity: 0.45;
            transform: translateX(-50%) translateY(5px);
          }
        }
        @keyframes cannonRecoil {
          0% {
            translate: 0 0;
            filter: brightness(1.45);
          }
          45% {
            translate: -16px 0;
            filter: brightness(1.15);
          }
          100% {
            translate: 0 0;
            filter: brightness(1);
          }
        }
      `}</style>
    </>
  )
}
