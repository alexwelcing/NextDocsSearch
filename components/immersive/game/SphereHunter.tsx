// Sphere Hunter: 60 seconds, drifting phosphor orbs around the viewer, click to burst them.
// Fast consecutive hits build a combo multiplier. Score files to the public ledger through the
// existing Supabase endpoint. HUD and end-panel are windfoil text, camera-anchored.

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

export function SphereHunter() {
  const gameActive = useImmersiveStore((s) => s.gameActive)
  const setGameActive = useImmersiveStore((s) => s.setGameActive)

  const [orbs, setOrbs] = useState<Orb[]>([])
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(1)
  const [remaining, setRemaining] = useState(GAME_SECONDS)
  const [over, setOver] = useState(false)
  const [name, setName] = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const lastHitAt = useRef(0)
  const endAt = useRef(0)

  // arm / reset on activation
  useEffect(() => {
    if (gameActive) {
      setOrbs(Array.from({ length: ORB_COUNT }, spawnOrb))
      setScore(0)
      setCombo(1)
      setOver(false)
      setSubmitState('idle')
      setRemaining(GAME_SECONDS)
      endAt.current = performance.now() + GAME_SECONDS * 1000
    } else {
      setOrbs([])
      setOver(false)
    }
  }, [gameActive])

  // 1 Hz clock
  useEffect(() => {
    if (!gameActive || over) return
    const iv = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - performance.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        setOver(true)
        playSound('deny')
      }
    }, 250)
    return () => clearInterval(iv)
  }, [gameActive, over])

  // name entry for the ledger
  useEffect(() => {
    if (!over) return
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
  }, [over, name, score])

  const submit = () => {
    if (submitState === 'sending' || submitState === 'sent') return
    setSubmitState('sending')
    fetch('/api/game/submit-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_name: name || 'HUNTER', score }),
    })
      .then((r) => setSubmitState(r.ok ? 'sent' : 'failed'))
      .catch(() => setSubmitState('failed'))
  }

  useFrame((_, delta) => {
    if (!gameActive || over) return
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
    if (over || orb.burst > 0) return
    const now = performance.now()
    const inCombo = now - lastHitAt.current < COMBO_WINDOW_MS
    const nextCombo = inCombo ? Math.min(combo + 1, 8) : 1
    lastHitAt.current = now
    setCombo(nextCombo)
    setScore((s) => s + Math.round(100 * nextCombo * (0.9 / orb.radius)))
    playSound('confirm')
    setOrbs((prev) => prev.map((o) => (o.id === orb.id ? { ...o, burst: 0.001 } : o)))
  }

  const orbMaterialColor = useMemo(() => new THREE.Color(ARC.green), [])

  if (!gameActive) return null

  return (
    <>
      {/* the quarry */}
      {orbs.map((orb) => (
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

      {/* HUD */}
      <CameraAnchor stiffness={22}>
        <group position={[0, 0.42, -1.1]}>
          <WindfoilText
            font={FONT.display}
            fontSize={0.05}
            color={rgba(ARC.green)}
            anchorX="center"
          >
            {`◉ ${score.toString().padStart(6, '0')}   ⏱ ${remaining}s   ${combo > 1 ? `x${combo} COMBO` : ''}`}
          </WindfoilText>
        </group>

        {/* end panel */}
        {over && (
          <group position={[0, 0, -1.2]}>
            <mesh>
              <planeGeometry args={[0.9, 0.5]} />
              <meshBasicMaterial color={ARC.screenBg} transparent opacity={0.95} />
            </mesh>
            <WindfoilText
              font={FONT.display}
              fontSize={0.055}
              color={rgba(ARC.amber)}
              anchorX="center"
              position={[0, 0.17, 0.001]}
            >
              HUNT COMPLETE
            </WindfoilText>
            <WindfoilText
              font={FONT.mono}
              fontSize={0.04}
              color={rgba(ARC.greenBright)}
              anchorX="center"
              position={[0, 0.09, 0.001]}
            >
              {`FINAL SCORE ${score}`}
            </WindfoilText>
            <WindfoilText
              font={FONT.mono}
              fontSize={0.032}
              color={rgba(ARC.green, 0.85)}
              anchorX="center"
              position={[0, 0.015, 0.001]}
            >
              {submitState === 'sent'
                ? 'FILED TO LEDGER ✓'
                : submitState === 'failed'
                  ? 'LEDGER UNREACHABLE'
                  : `CALLSIGN: ${name || '_'}${name.length < 12 ? '▮' : ''}`}
            </WindfoilText>
            {submitState !== 'sent' && (
              <GameButton
                y={-0.07}
                label={submitState === 'sending' ? 'FILING…' : 'FILE SCORE [ENTER]'}
                onPress={submit}
              />
            )}
            <GameButton
              y={-0.16}
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
