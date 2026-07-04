// Sphere Hunter: a complete drill loop. ARM (3-2-1 countdown) → LIVE (60 seconds of drifting
// phosphor orbs, click to burst, fast hands build a combo that raises the ding's pitch) →
// OVER (debrief: final score, personal best from localStorage, callsign entry, FILE SCORE to
// the public ledger, RUN IT BACK, STAND DOWN). HUD is windfoil text, camera-anchored, built
// only from atlas-safe glyphs (see lib/windfoil/charset.ts — no ⏱/◉, time renders as m:ss).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { CameraAnchor } from '../dock/CameraAnchor'
import { WindfoilText } from '../text/WindfoilText'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { playSound } from '@/lib/immersive/audio'
import { ARC, FONT, rgba } from '@/lib/immersive/theme'

const GAME_SECONDS = 60
const ORB_COUNT = 14
const COMBO_WINDOW_MS = 1600
const BEST_KEY = 'arc.sphere.best'

type Phase = 'arm' | 'live' | 'over'

interface Orb {
  id: number
  position: THREE.Vector3
  velocity: THREE.Vector3
  radius: number
  /** burst progress 0 = alive; >0 animating out */
  burst: number
}

let orbSerial = 1

function spawnOrb(): Orb {
  const dir = new THREE.Vector3(
    Math.random() * 2 - 1,
    Math.random() * 1.1 - 0.35,
    Math.random() * 2 - 1
  ).normalize()
  const dist = 7 + Math.random() * 13
  return {
    id: orbSerial++,
    position: dir.multiplyScalar(dist),
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * 1.6,
      (Math.random() - 0.5) * 0.7,
      (Math.random() - 0.5) * 1.6
    ),
    radius: 0.35 + Math.random() * 0.5,
    burst: 0,
  }
}

function stopLook(e: ThreeEvent<PointerEvent>) {
  e.stopPropagation()
  e.nativeEvent.stopImmediatePropagation?.()
}

function readBest(): number {
  try {
    return parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0
  } catch {
    return 0
  }
}

function writeBest(score: number): void {
  try {
    window.localStorage.setItem(BEST_KEY, String(score))
  } catch {
    /* private mode */
  }
}

/** m:ss — every glyph here is in the atlas charset. */
function clock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SphereHunter() {
  const gameActive = useImmersiveStore((s) => s.gameActive)
  const setGameActive = useImmersiveStore((s) => s.setGameActive)

  const [phase, setPhase] = useState<Phase>('arm')
  const [armCount, setArmCount] = useState(3)
  const [orbs, setOrbs] = useState<Orb[]>([])
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(1)
  const [remaining, setRemaining] = useState(GAME_SECONDS)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [name, setName] = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const lastHitAt = useRef(0)
  const comboMax = useRef(1)
  const endAt = useRef(0)
  const lastTickSecond = useRef(-1)

  const arm = () => {
    setPhase('arm')
    setArmCount(3)
    setOrbs([])
    setScore(0)
    setCombo(1)
    comboMax.current = 1
    setNewBest(false)
    setSubmitState('idle')
    setRemaining(GAME_SECONDS)
    lastTickSecond.current = -1
  }

  // arm / reset on activation
  useEffect(() => {
    if (gameActive) {
      arm()
    } else {
      setOrbs([])
      setPhase('arm')
    }
  }, [gameActive])

  // ARM: 3-2-1 countdown, then go live
  useEffect(() => {
    if (!gameActive || phase !== 'arm') return
    playSound('tab')
    const iv = setInterval(() => {
      setArmCount((c) => {
        if (c <= 1) {
          setPhase('live')
          setOrbs(Array.from({ length: ORB_COUNT }, spawnOrb))
          endAt.current = performance.now() + GAME_SECONDS * 1000
          playSound('confirm', { rate: 1.2 })
          return 0
        }
        playSound('tab')
        return c - 1
      })
    }, 900)
    return () => clearInterval(iv)
  }, [gameActive, phase])

  const endDrill = () => {
    setPhase('over')
    const prevBest = readBest()
    setBest(Math.max(prevBest, score))
    if (score > prevBest) {
      setNewBest(true)
      writeBest(score)
      playSound('confirm', { rate: 1.4 })
    } else {
      playSound('deny')
    }
  }
  const endDrillRef = useRef(endDrill)
  endDrillRef.current = endDrill

  // LIVE clock: countdown, final-5-seconds tick, time-out
  useEffect(() => {
    if (!gameActive || phase !== 'live') return
    const iv = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - performance.now()) / 1000))
      setRemaining(left)
      if (left <= 5 && left > 0 && left !== lastTickSecond.current) {
        lastTickSecond.current = left
        playSound('key', { rate: 1.5, gain: 1.4 })
      }
      if (left <= 0) endDrillRef.current()
    }, 250)
    return () => clearInterval(iv)
  }, [gameActive, phase])

  // Esc during LIVE ends the drill early into the debrief
  useEffect(() => {
    if (!gameActive || phase !== 'live') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      endDrillRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gameActive, phase])

  // callsign entry for the ledger
  useEffect(() => {
    if (phase !== 'over') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') setName((n) => n.slice(0, -1))
      else if (e.key === 'Enter') submit()
      else if (e.key.length === 1 && /[a-z0-9 _-]/i.test(e.key)) {
        setName((n) => (n.length < 12 ? n + e.key.toUpperCase() : n))
      } else {
        return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, name, score])

  const submit = () => {
    if (submitState === 'sending' || submitState === 'sent') return
    setSubmitState('sending')
    fetch('/api/game/submit-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_name: name || 'HUNTER', score, combo_max: comboMax.current }),
    })
      .then((r) => setSubmitState(r.ok ? 'sent' : 'failed'))
      .catch(() => setSubmitState('failed'))
  }

  useFrame((_, delta) => {
    if (!gameActive || phase !== 'live') return
    setOrbs((prev) => {
      let changed = false
      const next = prev.map((orb) => {
        const p = orb.position.clone().addScaledVector(orb.velocity, delta)
        // keep them in the shell: reflect at bounds
        const d = p.length()
        if (d < 5 || d > 22) orb.velocity.multiplyScalar(-1)
        const burst = orb.burst > 0 ? orb.burst + delta * 4 : 0
        if (burst !== orb.burst || !p.equals(orb.position)) changed = true
        return { ...orb, position: p, burst }
      })
      const alive = next.filter((o) => o.burst < 1)
      while (alive.length < ORB_COUNT) {
        alive.push(spawnOrb())
        changed = true
      }
      return changed ? alive : prev
    })
  })

  const hit = (orb: Orb) => {
    if (phase !== 'live' || orb.burst > 0) return
    const now = performance.now()
    const inCombo = now - lastHitAt.current < COMBO_WINDOW_MS
    const nextCombo = inCombo ? Math.min(combo + 1, 8) : 1
    lastHitAt.current = now
    setCombo(nextCombo)
    comboMax.current = Math.max(comboMax.current, nextCombo)
    setScore((s) => s + Math.round(100 * nextCombo * (0.9 / orb.radius)))
    // the ding climbs with the combo — a rising pitch ladder for hot streaks
    playSound('confirm', { rate: 1 + (nextCombo - 1) * 0.08 })
    setOrbs((prev) => prev.map((o) => (o.id === orb.id ? { ...o, burst: 0.001 } : o)))
  }

  const orbMaterialColor = useMemo(() => new THREE.Color(ARC.green), [])

  if (!gameActive) return null

  const hudColor = remaining <= 3 ? ARC.red : remaining <= 10 ? ARC.amber : ARC.green

  return (
    <>
      {/* the quarry */}
      {phase === 'live' &&
        orbs.map((orb) => (
          <mesh
            key={orb.id}
            position={orb.position.toArray()}
            scale={orb.radius * (orb.burst > 0 ? 1 + orb.burst * 2.5 : 1)}
            onPointerDown={(e) => {
              stopLook(e)
              hit(orb)
            }}
          >
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial
              color={orbMaterialColor}
              emissive={orbMaterialColor}
              emissiveIntensity={orb.burst > 0 ? 2.5 : 0.7}
              transparent
              opacity={orb.burst > 0 ? Math.max(1 - orb.burst, 0) : 0.92}
              wireframe={orb.burst > 0}
            />
          </mesh>
        ))}

      <CameraAnchor stiffness={22}>
        {/* ARM: big centered countdown */}
        {phase === 'arm' && (
          <group position={[0, 0, -1.1]}>
            <WindfoilText
              font={FONT.display}
              fontSize={0.24}
              color={rgba(ARC.amber)}
              anchorX="center"
              anchorY="middle"
              glow
            >
              {String(armCount)}
            </WindfoilText>
            <WindfoilText
              font={FONT.mono}
              fontSize={0.032}
              color={rgba(ARC.green, 0.8)}
              anchorX="center"
              position={[0, -0.18, 0]}
            >
              STAND BY — HUNT COMMENCES
            </WindfoilText>
          </group>
        )}

        {/* LIVE HUD — atlas-safe glyphs only, time as m:ss */}
        {phase === 'live' && (
          <group position={[0, 0.42, -1.1]}>
            <WindfoilText
              font={FONT.display}
              fontSize={0.05}
              color={rgba(hudColor)}
              anchorX="center"
            >
              {`SCORE ${score.toString().padStart(6, '0')} · ${clock(remaining)} · x${combo}`}
            </WindfoilText>
          </group>
        )}

        {/* OVER: debrief */}
        {phase === 'over' && (
          <group position={[0, 0, -1.2]}>
            <mesh>
              <planeGeometry args={[0.94, 0.62]} />
              <meshBasicMaterial color={ARC.screenBg} transparent opacity={0.95} />
            </mesh>
            <WindfoilText
              font={FONT.display}
              fontSize={0.055}
              color={rgba(ARC.amber)}
              anchorX="center"
              position={[0, 0.24, 0.001]}
            >
              HUNT COMPLETE
            </WindfoilText>
            <WindfoilText
              font={FONT.mono}
              fontSize={0.04}
              color={rgba(ARC.greenBright)}
              anchorX="center"
              position={[0, 0.16, 0.001]}
            >
              {`FINAL SCORE ${score}`}
            </WindfoilText>
            <WindfoilText
              font={FONT.mono}
              fontSize={0.03}
              color={newBest ? rgba(ARC.amber) : rgba(ARC.green, 0.85)}
              anchorX="center"
              position={[0, 0.1, 0.001]}
              glow={newBest}
            >
              {newBest ? `★ NEW PERSONAL BEST ★` : `PERSONAL BEST ${best}`}
            </WindfoilText>
            <WindfoilText
              font={FONT.mono}
              fontSize={0.032}
              color={rgba(ARC.green, 0.85)}
              anchorX="center"
              position={[0, 0.04, 0.001]}
            >
              {submitState === 'sent'
                ? 'FILED TO LEDGER ✓'
                : submitState === 'failed'
                  ? 'LEDGER UNREACHABLE'
                  : `CALLSIGN: ${name}${name.length < 12 ? '_' : ''}`}
            </WindfoilText>
            {submitState !== 'sent' && (
              <GameButton
                y={-0.04}
                label={submitState === 'sending' ? 'FILING…' : 'FILE SCORE [ENTER]'}
                onPress={submit}
              />
            )}
            <GameButton
              y={-0.13}
              label="RUN IT BACK"
              onPress={() => {
                playSound('confirm')
                arm()
              }}
            />
            <GameButton
              y={-0.22}
              label="STAND DOWN"
              onPress={() => {
                playSound('close')
                setGameActive(false)
              }}
            />
          </group>
        )}
      </CameraAnchor>
    </>
  )
}

function GameButton({ y, label, onPress }: { y: number; label: string; onPress: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <group position={[0, y, 0.001]}>
      <mesh
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
        <planeGeometry args={[0.44, 0.06]} />
        <meshBasicMaterial color={hover ? ARC.greenDim : ARC.greenFaint} />
      </mesh>
      <WindfoilText
        font={FONT.display}
        fontSize={0.03}
        color={rgba(hover ? ARC.greenBright : ARC.green)}
        anchorX="center"
        anchorY="middle"
        position={[0, 0, 0.001]}
      >
        {label}
      </WindfoilText>
    </group>
  )
}
