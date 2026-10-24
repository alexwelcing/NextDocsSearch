// Hero-scale windfoil title card: every world arrival plants the world's name in world space
// at the direction you were looking, materializes it glyph-by-glyph with the phosphor glow on,
// holds a beat, and fades. World-anchored (not camera-locked) on purpose — turn your head and
// the title stays where the world put it, which is what sells it as a place-name and not a HUD
// toast. This is the coverage shader's showcase: at this scale SDF text would visibly soften,
// windfoil stays razor sharp.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { float, smoothstep, uniform, uv, vec4 } from 'three/tsl'
import { WindfoilText } from '../text/WindfoilText'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { worldById, type WorldDef } from '@/lib/immersive/worlds'
import { ARC, FONT, rgba } from '@/lib/immersive/theme'

const DISTANCE = 7 // metres out — inside the panorama sphere, well past the dock
const RISE = 0.8 // metres above eye line, so it crowns the view instead of blocking it
const APPEAR_DELAY_MS = 420 // let the panorama crossfade get moving first
const TITLE_REVEAL_MS = 900
const BLURB_REVEAL_MS = 700
const BLURB_DELAY_MS = 650
const HOLD_MS = 2400 // measured from the end of the title reveal
const FADE_MS = 900
const GAP = 0.12 // metres from the accent rule to the title's baseline box / the blurb's top

type Box = { width: number; height: number }

// Legibility scrim: a feathered band of bezel-black behind the name and blurb. Without it the
// white title and pale blurb dissolve into the bright worlds' skies (night-train, meridian); on
// the dark worlds it is dark on dark and all but invisible. Full strength only through the
// middle and eased to nothing well inside the plane's edges, so it has no hard edge — but on a
// bright sky it deliberately reads as a soft smoked plate behind the text, like a lower-third.
const SCRIM_ALPHA = 0.72
const SCRIM_PAD_X = 1.3 // metres past the wider text block on each side — mostly feather
const SCRIM_PAD_Y = 0.45
const SCRIM_FADE_IN_MS = 500

function createScrimMaterial() {
  const material = new THREE.NodeMaterial()
  const strength = uniform(0)
  const p = uv().sub(0.5).mul(2).abs() // 0 at the centre, 1 at each edge
  const feather = float(1)
    .sub(smoothstep(0.55, 1, p.x))
    .mul(float(1).sub(smoothstep(0.35, 1, p.y)))
  const tint = new THREE.Color(ARC.bezel)
  material.colorNode = vec4(tint.r, tint.g, tint.b, feather.mul(strength).mul(SCRIM_ALPHA))
  material.transparent = true
  material.depthWrite = false
  material.fog = false
  return { material, strength }
}

/** The scrim plane: eases in over SCRIM_FADE_IN_MS from mount, then follows `opacity`. Exported
 *  so the boot WarmupRig can prebuild its pipeline. */
export function TitleScrim({
  width,
  height,
  opacity,
  position,
}: {
  width: number
  height: number
  opacity: number
  position?: [number, number, number]
}) {
  const { material, strength } = useMemo(() => createScrimMaterial(), [])
  useEffect(() => () => material.dispose(), [material])
  const bornAt = useRef<number | null>(null)
  useFrame(() => {
    const now = performance.now()
    if (bornAt.current === null) bornAt.current = now
    strength.value = Math.min((now - bornAt.current) / SCRIM_FADE_IN_MS, 1) * opacity
  })
  return (
    <mesh position={position} scale={[width, height, 1]} renderOrder={13} material={material}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}

interface Card {
  world: WorldDef
  /** Monotonic key so re-entering the same world remounts (fresh reveal). */
  key: number
  position: [number, number, number]
  rotationY: number
}

export function WorldTitleCard() {
  const worldId = useImmersiveStore((s) => s.worldId)
  const bootPhase = useImmersiveStore((s) => s.bootPhase)
  const sceneReady = useImmersiveStore((s) => s.sceneReady)
  const reducedMotion = useImmersiveStore((s) => s.reducedMotion)
  const camera = useThree((s) => s.camera)

  const [card, setCard] = useState<Card | null>(null)
  const serial = useRef(0)

  useEffect(() => {
    if (bootPhase !== 'ready' || !sceneReady) return
    const world = worldById(worldId)
    const t = setTimeout(() => {
      // Plant it along the current gaze yaw (CameraRig keeps rotation in YXZ order, so the
      // euler y IS the yaw). Camera sits at the origin, so facing it = rotating by that yaw.
      const yaw = camera.rotation.y
      serial.current += 1
      setCard({
        world,
        key: serial.current,
        position: [-Math.sin(yaw) * DISTANCE, RISE, -Math.cos(yaw) * DISTANCE],
        rotationY: yaw,
      })
    }, APPEAR_DELAY_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId, bootPhase, sceneReady])

  if (!card) return null
  return (
    <CardInstance
      key={card.key}
      card={card}
      reducedMotion={reducedMotion}
      onDone={() => setCard(null)}
    />
  )
}

function CardInstance({
  card,
  reducedMotion,
  onDone,
}: {
  card: Card
  reducedMotion: boolean
  onDone: () => void
}) {
  const [opacity, setOpacity] = useState(1)
  const [titleBox, setTitleBox] = useState<Box | null>(null)
  const [blurbBox, setBlurbBox] = useState<Box | null>(null)
  const bornAt = useRef<number | null>(null)
  const done = useRef(false)

  useFrame(() => {
    if (done.current) return
    const now = performance.now()
    if (bornAt.current === null) bornAt.current = now
    const fadeStart = (reducedMotion ? 0 : TITLE_REVEAL_MS + BLURB_DELAY_MS) + HOLD_MS
    const t = now - bornAt.current
    if (t < fadeStart) return
    const k = 1 - (t - fadeStart) / FADE_MS
    if (k <= 0) {
      done.current = true
      onDone()
      return
    }
    // Ease-out on the opacity; a state write per frame is fine here — the card exists for a
    // few seconds total and the subtree is two memoized text meshes.
    setOpacity(k * k)
  })

  return (
    <group position={card.position} rotation={[0, card.rotationY, 0]}>
      {/* behind both blocks: title spans [GAP, GAP + titleH], blurb [-GAP - blurbH, -GAP] */}
      {titleBox && blurbBox && (
        <TitleScrim
          width={Math.max(titleBox.width, blurbBox.width) + 2 * SCRIM_PAD_X}
          height={titleBox.height + blurbBox.height + 2 * GAP + 2 * SCRIM_PAD_Y}
          position={[0, (titleBox.height - blurbBox.height) / 2, -0.002]}
          opacity={opacity}
        />
      )}
      <WindfoilText
        font={FONT.display}
        fontSize={0.85}
        color={rgba('#ffffff', 0.96)}
        anchorX="center"
        anchorY="bottom"
        position={[0, GAP, 0]}
        renderOrder={15}
        opacity={opacity}
        revealDuration={reducedMotion ? undefined : TITLE_REVEAL_MS}
        onLayout={setTitleBox}
        glow
      >
        {card.world.name}
      </WindfoilText>
      <WindfoilText
        font={FONT.mono}
        fontSize={0.17}
        color={rgba(card.world.particles.color, 0.85)}
        anchorX="center"
        anchorY="top"
        position={[0, -GAP, 0]}
        renderOrder={15}
        opacity={opacity}
        revealDuration={reducedMotion ? undefined : BLURB_REVEAL_MS}
        revealDelay={reducedMotion ? 0 : BLURB_DELAY_MS}
        onLayout={setBlurbBox}
      >
        {card.world.blurb}
      </WindfoilText>
      {/* thin rule between name and blurb, in the world's own accent */}
      <mesh position={[0, 0, -0.001]} renderOrder={14}>
        <planeGeometry args={[3.4, 0.014]} />
        <meshBasicMaterial
          color={card.world.particles.color}
          transparent
          opacity={0.55 * opacity}
          depthWrite={false}
          fog={false}
        />
      </mesh>
    </group>
  )
}
