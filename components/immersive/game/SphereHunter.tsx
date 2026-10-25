// Sphere Hunter: a complete drill loop. ARM (3-2-1 countdown) → LIVE (60 seconds of drifting
// phosphor orbs, click to burst, fast hands build a combo that raises the ding's pitch) →
// OVER (debrief: final score, personal best from localStorage, callsign entry, FILE SCORE to
// the public ledger, RUN IT BACK, STAND DOWN). HUD is windfoil text, camera-anchored, built
// only from atlas-safe glyphs (see lib/windfoil/charset.ts — no ⏱/◉, time renders as m:ss).
//
// The quarry is one InstancedMesh driven from a ref — no React state per frame — and a burst is
// an additive emissive ring from a second InstancedMesh, so a hit never swaps in a new pipeline
// mid-hunt. The callsign field rides useTouchTextInput so touch players get an OS keyboard.

import { useEffect, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { CameraAnchor } from '../dock/CameraAnchor'
import { WindfoilText } from '../text/WindfoilText'
import { isTouchTextTarget, useTouchTextInput } from '../hooks/useTouchTextInput'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { playSound } from '@/lib/immersive/audio'
import { ARC, FONT, rgba } from '@/lib/immersive/theme'

const GAME_SECONDS = 60
const ORB_COUNT = 14
const COMBO_WINDOW_MS = 1600
const BEST_KEY = 'arc.sphere.best'
const CALLSIGN_MAX = 12
/** Orbs bounce between these radii from the viewer. */
const SHELL_MIN = 5
const SHELL_MAX = 22
/** An instanced draw sorts by the shell's center — the camera — so it would land nearest and
 *  draw after the near transparent UI (summon chip), which then depth-rejects orbs behind it.
 *  Pin the field where per-orb depth sorting used to put it: after the panorama's crossfade
 *  layer (-1), before everything at the default order. */
const FIELD_RENDER_ORDER = -0.5

type Phase = 'arm' | 'live' | 'over'

export interface Orb {
  position: THREE.Vector3
  velocity: THREE.Vector3
  radius: number
  /** burst progress 0 = alive; >0 animating out */
  burst: number
}

function spawnOrb(): Orb {
  const dir = new THREE.Vector3(
    Math.random() * 2 - 1,
    Math.random() * 1.1 - 0.35,
    Math.random() * 2 - 1
  ).normalize()
  const dist = 7 + Math.random() * 13
  return {
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

/** Advance every orb one frame in place: drift, reflect at the shell, and respawn finished
 *  bursts into the same slot so the field always holds ORB_COUNT. */
export function stepOrbs(orbs: Orb[], delta: number): void {
  for (let i = 0; i < orbs.length; i++) {
    const orb = orbs[i]
    orb.position.addScaledVector(orb.velocity, delta)
    // keep them in the shell: reflect at a bound only while still heading through it, so a long
    // frame (back from a hidden tab) that overshoots can't flip-flop an orb outside the shell
    const d = orb.position.length()
    const outward = orb.velocity.dot(orb.position)
    if ((d < SHELL_MIN && outward < 0) || (d > SHELL_MAX && outward > 0)) {
      orb.velocity.multiplyScalar(-1)
    }
    if (orb.burst > 0) {
      orb.burst += delta * 4
      if (orb.burst >= 1) orbs[i] = spawnOrb()
    }
  }
}

export interface OrbField {
  orbs: THREE.InstancedMesh
  rings: THREE.InstancedMesh
  dispose: () => void
}

const HIDDEN_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0)
const NO_ROTATION = new THREE.Quaternion()
const RING_HOT = new THREE.Color(ARC.green).multiplyScalar(2.5)
const BLACK = new THREE.Color(0, 0, 0)
const tmpMatrix = new THREE.Matrix4()
const tmpScale = new THREE.Vector3()
const tmpColor = new THREE.Color()
const tmpCamera = new THREE.Vector3()
const billboard = new THREE.Object3D()

/** Two instanced draws for the whole hunt: the orbs, and one burst ring per orb slot. */
export function createOrbField(): OrbField {
  const green = new THREE.Color(ARC.green)
  const orbs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({
      color: green,
      emissive: green,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.92,
    }),
    ORB_COUNT
  )
  // Additive, so the per-instance color fading to black IS the fade-out; fog off because fog
  // under additive blending adds haze instead of attenuating (see Atmosphere).
  const rings = new THREE.InstancedMesh(
    new THREE.RingGeometry(0.82, 1, 48),
    new THREE.MeshBasicMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
    ORB_COUNT
  )
  for (const mesh of [orbs, rings]) {
    // same order and sort depth for both, so rings (created second) draw over their orbs
    mesh.renderOrder = FIELD_RENDER_ORDER
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    // Instances move every frame: skip culling, and give raycasts one fixed sphere around the
    // whole shell instead of a stale one computed from the first frame's matrices.
    mesh.frustumCulled = false
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SHELL_MAX + 4)
    for (let i = 0; i < ORB_COUNT; i++) mesh.setMatrixAt(i, HIDDEN_MATRIX)
  }
  // Allocate instanceColor up front — adding it after the first draw would change the shader.
  for (let i = 0; i < ORB_COUNT; i++) rings.setColorAt(i, BLACK)
  rings.instanceColor!.setUsage(THREE.DynamicDrawUsage)
  rings.raycast = () => {}
  return {
    orbs,
    rings,
    dispose: () => {
      for (const mesh of [orbs, rings]) {
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
        mesh.dispose()
      }
    },
  }
}

let sharedField: { field: OrbField; users: number } | null = null

/**
 * The canvas's one orb field, shared by the hunt and the boot WarmupRig. Shared rather than a
 * second createOrbField(): r185 names each InstancedMesh's matrix uniform buffer after its node
 * id ('NodeBuffer_' + id in WGSLNodeBuilder), so every field generates its own vertex shader and
 * pipelines — only the very meshes the rig drew can reuse what it compiled. Disposed (GPU side)
 * when its last user unmounts; a canvas mounted after that starts a fresh one.
 */
export function useOrbField(): OrbField {
  const [entry] = useState(() => (sharedField ??= { field: createOrbField(), users: 0 }))
  useEffect(() => {
    entry.users++
    return () => {
      if (--entry.users > 0) return
      entry.field.dispose()
      if (sharedField === entry) sharedField = null
    }
  }, [entry])
  return entry.field
}

/** Write the orb list into the field: orbs collapse as their ring blooms outward and fades. */
export function syncOrbField(field: OrbField, orbs: Orb[], camera: THREE.Vector3): void {
  for (let i = 0; i < ORB_COUNT; i++) {
    const orb = orbs[i]
    if (!orb) {
      field.orbs.setMatrixAt(i, HIDDEN_MATRIX)
      field.rings.setMatrixAt(i, HIDDEN_MATRIX)
      continue
    }
    const b = orb.burst
    tmpMatrix.compose(orb.position, NO_ROTATION, tmpScale.setScalar(orb.radius * (1 - b)))
    field.orbs.setMatrixAt(i, tmpMatrix)
    if (b > 0) {
      billboard.position.copy(orb.position)
      billboard.lookAt(camera)
      billboard.scale.setScalar(orb.radius * (1 + b * 2.5))
      billboard.updateMatrix()
      field.rings.setMatrixAt(i, billboard.matrix)
      field.rings.setColorAt(i, tmpColor.copy(RING_HOT).multiplyScalar(1 - b))
    } else {
      field.rings.setMatrixAt(i, HIDDEN_MATRIX)
    }
  }
  field.orbs.instanceMatrix.needsUpdate = true
  field.rings.instanceMatrix.needsUpdate = true
  field.rings.instanceColor!.needsUpdate = true
}

export function sanitizeCallsign(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9 _-]/g, '')
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
  const orbs = useRef<Orb[]>([])
  const field = useOrbField()
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
  // Filing guard, read synchronously: two Enters can land before React re-renders, and a reply
  // from an earlier round (RUN IT BACK while FILING…) must not mark this round filed.
  const round = useRef(0)
  const filing = useRef(false)

  const arm = () => {
    round.current++
    filing.current = false
    setPhase('arm')
    setArmCount(3)
    orbs.current = []
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
      orbs.current = []
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
          orbs.current = Array.from({ length: ORB_COUNT }, spawnOrb)
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

  const submit = () => {
    if (filing.current) return
    filing.current = true
    const filedRound = round.current
    const settle = (ok: boolean) => {
      if (round.current !== filedRound) return
      filing.current = ok // a failure leaves FILE SCORE open for a retry
      setSubmitState(ok ? 'sent' : 'failed')
    }
    setSubmitState('sending')
    fetch('/api/game/submit-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_name: name || 'HUNTER', score, combo_max: comboMax.current }),
    })
      .then((r) => settle(r.ok))
      .catch(() => settle(false))
  }
  const submitRef = useRef(submit)
  submitRef.current = submit

  // callsign entry for the ledger — typed on window, or through the hidden input on touch (which
  // unmounts once the score is filed, so the OS keyboard folds away)
  const { owns: ownsCallsign, focus: focusCallsign } = useTouchTextInput({
    active: gameActive && phase === 'over' && submitState !== 'sent',
    value: name,
    onChange: setName,
    label: 'Callsign',
    maxLength: CALLSIGN_MAX,
    sanitize: sanitizeCallsign,
    autoCapitalize: 'characters',
    enterKeyHint: 'send',
  })

  useEffect(() => {
    if (phase !== 'over') return
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return
      // keys belong to the dock or a reader while one is up, and to any other surface's field
      const { dockOpen, modal } = useImmersiveStore.getState()
      if (dockOpen || modal || (isTouchTextTarget(e) && !ownsCallsign(e))) return
      if (e.key === 'Enter') submitRef.current()
      // the native input owns its own edits (OS keyboard, paste, composition)
      else if (ownsCallsign(e)) return
      else if (e.key === 'Backspace') setName((n) => n.slice(0, -1))
      else if (e.key.length === 1 && /[a-z0-9 _-]/i.test(e.key)) {
        setName((n) => (n.length < CALLSIGN_MAX ? n + e.key.toUpperCase() : n))
      } else {
        return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, ownsCallsign])

  // ARM syncs the empty list (every instance hidden) while the field's pipelines warm up
  useFrame((state, delta) => {
    if (!gameActive || phase === 'over') return
    if (phase === 'live') stepOrbs(orbs.current, delta)
    syncOrbField(field, orbs.current, state.camera.getWorldPosition(tmpCamera))
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
    orb.burst = 0.001
  }

  if (!gameActive) return null

  const hudColor = remaining <= 3 ? ARC.red : remaining <= 10 ? ARC.amber : ARC.green

  return (
    <>
      {/* the quarry — mounted (all instances hidden) through ARM so its pipelines compile
          during the countdown rather than on the first live frame */}
      {phase !== 'over' && (
        <>
          <primitive
            object={field.orbs}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              const orb = e.instanceId === undefined ? undefined : orbs.current[e.instanceId]
              if (!orb) return
              stopLook(e)
              hit(orb)
            }}
          />
          <primitive object={field.rings} />
        </>
      )}

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
              {newBest ? `* NEW PERSONAL BEST *` : `PERSONAL BEST ${best}`}
            </WindfoilText>
            {/* callsign line — tap to summon the OS keyboard on touch */}
            {submitState !== 'sent' && (
              <mesh
                position={[0, 0.024, 0.0005]}
                onPointerDown={(e) => {
                  stopLook(e)
                  focusCallsign()
                }}
              >
                <planeGeometry args={[0.5, 0.046]} />
                <meshBasicMaterial color={ARC.greenFaint} transparent opacity={0.65} />
              </mesh>
            )}
            <WindfoilText
              font={FONT.mono}
              fontSize={0.032}
              color={rgba(ARC.green, 0.85)}
              anchorX="center"
              position={[0, 0.04, 0.001]}
            >
              {submitState === 'sent'
                ? 'FILED TO LEDGER [OK]'
                : submitState === 'failed'
                ? 'LEDGER UNREACHABLE'
                : `CALLSIGN: ${name}${name.length < CALLSIGN_MAX ? '_' : ''}`}
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
