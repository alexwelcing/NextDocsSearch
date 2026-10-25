// Hero-scale windfoil title card: every world arrival plants the world's name in world space
// at the direction you were looking, materializes it glyph-by-glyph with the phosphor glow on,
// holds a beat, and fades. World-anchored (not camera-locked) on purpose — turn your head and
// the title stays where the world put it, which is what sells it as a place-name and not a HUD
// toast. This is the coverage shader's showcase: at this scale SDF text would visibly soften,
// windfoil stays razor sharp. On a narrow (portrait) view the blurb breaks into even lines and
// the card shrinks just enough to sit inside the frame (lib/immersive/fit.ts); landscape views
// keep the authored size and the single-line blurb.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { float, smoothstep, uniform, uv, vec4 } from 'three/tsl'
import { WindfoilText, useFontAtlas } from '../text/WindfoilText'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { worldById, type WorldDef } from '@/lib/immersive/worlds'
import { ARC, FONT, rgba } from '@/lib/immersive/theme'
import { FIT_MARGIN, fitScale, horizontalFov } from '@/lib/immersive/fit'
import { measureText } from '@/lib/windfoil/layout'

const DISTANCE = 7 // metres out — inside the panorama sphere, well past the dock
const RISE = 0.8 // metres above eye line, so it crowns the view instead of blocking it
const APPEAR_DELAY_MS = 420 // let the panorama crossfade get moving first
const TITLE_REVEAL_MS = 900
const BLURB_REVEAL_MS = 700
const BLURB_DELAY_MS = 650
const HOLD_MS = 2400 // measured from the end of the title reveal
const FADE_MS = 900
const GAP = 0.12 // metres from the accent rule to the title's baseline box / the blurb's top
export const TITLE_SIZE = 0.85 // metres per em, world name
export const BLURB_SIZE = 0.17 // metres per em, blurb line
export const RULE_W = 3.4 // metres, the accent rule

/** Width the card may span when faced: fit.ts's share of the horizontal view at DISTANCE. */
export function cardSpan(vFov: number, aspect: number): number {
  return FIT_MARGIN * 2 * DISTANCE * Math.tan(horizontalFov(vFov, aspect) / 2)
}

/**
 * Wrap width for a one-line caption (words split by spaces) that may outgrow `span`: undefined
 * when it fits on one line, else the narrowest width that still breaks it into as few lines as
 * `span` would — even lines rather than a full line and an orphan. Mirrors windfoil's greedy
 * wrap (breakLines in lib/windfoil/layout.ts) token for token, so laying the text out at the
 * returned width reproduces exactly that line count. `measure` is the layout's own advance.
 */
export function balancedWrapWidth(
  text: string,
  span: number,
  measure: (s: string) => number
): number | undefined {
  const words = text.split(' ')
  const widths = words.map((w) => (w ? measure(w) : 0))
  const space = measure(' ')
  const lineCount = (maxWidth: number) => {
    let lines = 1
    let width = 0
    let empty = true
    for (let i = 0; i < words.length; i++) {
      if (i > 0 && !empty) width += space // a line swallows its leading spaces
      if (!words[i]) continue
      if (!empty && width + widths[i] > maxWidth) {
        lines++
        width = 0
      }
      width += widths[i]
      empty = false
    }
    return lines
  }
  const lines = lineCount(span)
  if (lines <= 1) return undefined
  // No line is narrower than its widest word (the layout won't break inside one), and greedy
  // line count only falls as the width grows: bisect above that for the narrowest that holds.
  const longest = Math.max(...widths)
  if (lineCount(longest) <= lines) return longest
  let lo = longest
  let hi = span
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (lineCount(mid) <= lines) hi = mid
    else lo = mid
  }
  return hi
}

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
  const fit = useRef<THREE.Group>(null)

  // The blurb wraps for the view the card arrives in and keeps that layout for its few seconds
  // (a relayout would rebuild the text and replay its reveal); the per-frame fit below absorbs
  // any later resize, rotation or zoom.
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const [span] = useState(() => cardSpan(camera.fov, camera.aspect))
  const blurbAtlas = useFontAtlas(FONT.mono)
  const blurbWrap = useMemo(
    () =>
      blurbAtlas &&
      balancedWrapWidth(card.world.blurb, span, (s) => measureText(blurbAtlas, s, BLURB_SIZE)),
    [blurbAtlas, card.world.blurb, span]
  )

  useFrame((state) => {
    if (done.current) return
    // Shrink-only, about the rule: 1 on every landscape view, so the desktop card is untouched.
    const g = fit.current
    if (g && titleBox && blurbBox) {
      const cam = state.camera as THREE.PerspectiveCamera
      const width = Math.max(titleBox.width, blurbBox.width, RULE_W)
      g.scale.setScalar(fitScale({ vFov: cam.fov, aspect: cam.aspect, distance: DISTANCE, width }))
    }
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
    <group ref={fit} position={card.position} rotation={[0, card.rotationY, 0]}>
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
        fontSize={TITLE_SIZE}
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
        fontSize={BLURB_SIZE}
        color={rgba(card.world.particles.color, 0.85)}
        maxWidth={blurbWrap}
        align="center"
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
        <planeGeometry args={[RULE_W, 0.014]} />
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
