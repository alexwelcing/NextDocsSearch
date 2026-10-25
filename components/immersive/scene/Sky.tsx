// Sky v2: the world's 360 sky as one direction-sampled equirect shell (lib/immersive/sky/nodes.ts)
// with a two-slot crossfade in the shader. Replaces PanoramaSphere's stacked UV spheres: no pole
// kinks, no seam line, one pipeline for every world and tier, and at most two sky textures resident.
//
// Loading walks the world's tier ladder (lib/immersive/sky/tiers.ts): a 1024 WebP preview, then
// the 4K UASTC KTX2 (or a legacy world's 2K JPEG), then the 8K only on 'high' desktops. Every
// upload is explicit and placed where its main-thread cost is not seen (loader.ts uploadSky):
//  - boot: under the CRT overlay — tiers are shown the frame they arrive;
//  - world switch: inside the hold — the outgoing world stays up (static) until the incoming
//    world's full tier is uploaded, or HOLD_MAX_MS passes and its preview fades in instead;
//  - upgrades of the world on screen: at a quiet moment — no drag or wheel for QUIET_MS (an 8K
//    upload is a 45-70 ms frame), or after QUIET_MAX_WAIT_MS regardless.
//
// Kept from PanoramaSphere (#195, #196): one retry per asset and a dark fallback that still
// releases the boot gate (sceneReady) so a dead sky can never strand the overlay; the idle spin
// that eases out under a modal or the dock and yields to the camera's attract drift; per-world
// exposure — now a per-slot shader uniform, so a crossfade keeps each world's own gain.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { texture as textureNode, uniform } from 'three/tsl'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { worldById, type WorldDef } from '@/lib/immersive/worlds'
import { attractDrift, panoramaSpin } from '@/lib/immersive/drift'
import { retryOnce } from '@/lib/immersive/boot'
import { SkyCrossfade, type SkySlot, type SlotIndex } from '@/lib/immersive/sky/crossfade'
import { HERO_U_DEFAULT, heroOffset } from '@/lib/immersive/sky/equirect'
import {
  SkyStaleError,
  compressedSkySupport,
  disposeSkyLoader,
  loadImageSky,
  loadKtx2Sky,
  maxTextureSize,
  uploadSky,
} from '@/lib/immersive/sky/loader'
import {
  SKY_RADIUS,
  createDepthSkyMaterial,
  createPlaceholder,
  createSkyMaterial,
  createSkyNodes,
} from '@/lib/immersive/sky/nodes'
import {
  TIER_RANK,
  fallbackFor,
  holdTarget,
  isDesktopClass,
  planKey,
  skyTierPlan,
  type SkyEnv,
  type SkyStep,
  type SkyTier,
} from '@/lib/immersive/sky/tiers'
import { SKY_DEBUG, skyDebugHandle } from '@/lib/immersive/sky/debug'

/** A world switch fades over this long (PanoramaSphere's 1.6 opacity units per second). */
const WORLD_FADE_S = 1 / 1.6
/** A sharper tier of the world on screen fades in over this long. */
const TIER_FADE_S = 0.3
/** How quickly the spin eases out/in around a modal or the dock, per second. */
const DRIFT_EASE = 3
/** Pause before the single retry of a failed sky asset, ms. */
const RETRY_DELAY_MS = 800
/** Longest a world switch holds the outgoing world for the incoming one's full tier, ms. */
const HOLD_MAX_MS = 1200
/** An upgrade waits for this long without look input… */
const QUIET_MS = 400
/** …but never longer than this after it arrived, ms. */
const QUIET_MAX_WAIT_MS = 4000

const SHELL_SEGMENTS: [number, number] = [64, 32]
/** Debug depth mesh density, and the depth map's near radius (its far is the shell radius). */
const DEPTH_SEGMENTS: [number, number] = [1024, 512]
const DEPTH_NEAR = 4
/** The debug depth mode's hole-fill shell: a little beyond the displaced mesh, defocused. */
const DEPTH_SHELL_BLUR = 6

/** A loaded tier waiting for its moment (see the header). */
interface Arrival {
  worldId: string
  tier: SkyTier
  texture: THREE.Texture
  at: number
}

interface SkyEvent {
  t: number
  kind: 'arrive' | 'present' | 'fail' | 'fallback'
  world: string
  tier: SkyTier
  ms?: number
  bytes?: number
  note?: string
}

const roundUpload = ({ ms, bytes }: { ms: number; bytes: number }) => ({
  ms: Math.round(ms * 10) / 10,
  bytes,
})

function deviceEnv(renderer: THREE.WebGPURenderer): Omit<SkyEnv, 'quality' | 'cap'> {
  const nav = navigator as Navigator & {
    deviceMemory?: number
    userAgentData?: { mobile?: boolean }
  }
  return {
    desktop: isDesktopClass({
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      mobileUA: nav.userAgentData?.mobile,
      deviceMemory: nav.deviceMemory,
    }),
    compressed: compressedSkySupport(renderer),
    maxTextureSize: maxTextureSize(renderer),
  }
}

function loadStep(
  renderer: THREE.WebGPURenderer,
  step: SkyStep,
  isLive: () => boolean
): Promise<THREE.Texture> {
  const load = () =>
    step.tier === 'k4' || step.tier === 'k8'
      ? loadKtx2Sky(renderer, step.url, isLive)
      : loadImageSky(renderer, step.url)
  // One retry covers a transient network blip; a second failure is final for this tier. A load
  // for a world already left is not retried.
  return retryOnce(load, {
    delayMs: RETRY_DELAY_MS,
    onRetry: (err) => {
      if (!(err instanceof SkyStaleError)) {
        console.warn(`[sky] ${step.tier} load failed, retrying once:`, step.url, err)
      }
    },
  })
}

export function Sky() {
  const renderer = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const domElement = useThree((s) => s.gl.domElement)
  const worldId = useImmersiveStore((s) => s.worldId)
  const quality = useImmersiveStore((s) => s.quality)
  const setSceneReady = useImmersiveStore((s) => s.setSceneReady)
  const reducedMotion = useImmersiveStore((s) => s.reducedMotion)
  const world = worldById(worldId)

  const nodes = useMemo(() => createSkyNodes(), [])
  const material = useMemo(() => createSkyMaterial(nodes), [nodes])
  const geometry = useMemo(
    () => new THREE.SphereGeometry(SKY_RADIUS, SHELL_SEGMENTS[0], SHELL_SEGMENTS[1]),
    []
  )

  // Slot bookkeeping: the crossfade owns the textures; this mirrors each slot into the shader.
  const fade = useMemo(
    () =>
      new SkyCrossfade<THREE.Texture>({
        onSlot(index: SlotIndex, slot: SkySlot<THREE.Texture> | null) {
          const tex = index === 0 ? nodes.texA : nodes.texB
          const u = index === 0 ? nodes.a : nodes.b
          tex.value = slot?.texture ?? nodes.placeholders[index]
          u.exposure.value = slot?.exposure ?? 1
          u.offset.value = heroOffset(slot?.heroU ?? HERO_U_DEFAULT)
        },
      }),
    [nodes]
  )

  const env = useMemo(() => deviceEnv(renderer), [renderer])
  const plan = useMemo(
    () => skyTierPlan(world.sky, { ...env, quality, cap: SKY_DEBUG.tier }),
    [world.sky, env, quality]
  )
  const key = planKey(plan)

  const arrivals = useRef<Arrival[]>([])
  /** The world switch in progress: hold the outgoing world until `until` for `target`. */
  const hold = useRef<{ worldId: string; until: number; target: SkyTier | null } | null>(null)
  const lastLook = useRef({ at: 0, dragging: false })
  const yaw = useRef(0)
  const driftGain = useRef(1)
  const everShown = useRef(false)
  const events = useRef<SkyEvent[]>([])
  const log = (e: Omit<SkyEvent, 't'>) => {
    if (!SKY_DEBUG.handle) return
    events.current.push({ t: Math.round(performance.now()), ...e })
    if (events.current.length > 400) events.current.shift()
  }

  // Look activity, for the quiet-moment rule. Passive listeners on the canvas: CameraRig owns
  // the controls, this only notices them.
  useEffect(() => {
    const look = lastLook.current
    const down = () => {
      look.dragging = true
      look.at = performance.now()
    }
    const move = () => {
      if (look.dragging) look.at = performance.now()
    }
    const up = () => {
      look.dragging = false
      look.at = performance.now()
    }
    const wheel = () => {
      look.at = performance.now()
    }
    domElement.addEventListener('pointerdown', down, { passive: true })
    domElement.addEventListener('pointermove', move, { passive: true })
    domElement.addEventListener('pointerup', up, { passive: true })
    domElement.addEventListener('pointercancel', up, { passive: true })
    domElement.addEventListener('wheel', wheel, { passive: true })
    return () => {
      domElement.removeEventListener('pointerdown', down)
      domElement.removeEventListener('pointermove', move)
      domElement.removeEventListener('pointerup', up)
      domElement.removeEventListener('pointercancel', up)
      domElement.removeEventListener('wheel', wheel)
    }
  }, [domElement])

  // Load the world's ladder. Tiers already showing (or sharper) for this world are skipped, so a
  // re-run for the same world (a quality change, a switch back mid-load) never reloads them.
  useEffect(() => {
    let live = true
    const isLive = () => live
    const showing = fade.current
    const floor = showing?.key === world.id ? showing.rank : -1
    const steps = plan.filter((s) => TIER_RANK[s.tier] > floor)
    for (const a of arrivals.current) {
      if (a.worldId !== world.id) a.texture.dispose()
    }
    arrivals.current = arrivals.current.filter((a) => a.worldId === world.id)
    if (showing && showing.key !== world.id) {
      const until = performance.now() + HOLD_MAX_MS
      hold.current = { worldId: world.id, until, target: holdTarget(steps) }
    } else if (hold.current?.worldId !== world.id) {
      hold.current = null
    }
    if (steps.length === 0) return

    let settled = 0
    let succeeded = 0
    const total = { n: 0 }
    const done = () => {
      settled++
      if (!live || settled < total.n || succeeded > 0) return
      // Only an upgrade failed (this world is up, or has a tier waiting): nothing more to do.
      if (fade.current?.key === world.id) return
      if (arrivals.current.some((a) => a.worldId === world.id)) return
      // Dark fallback: no tier of this world loaded. At boot the canvas's near-black clear stands
      // in (on a switch the previous world stays up); either way the boot gate is released, and
      // the next switch tries afresh.
      console.error(`[sky] ${world.id}: every sky tier failed, continuing without it`)
      if (hold.current?.worldId === world.id) hold.current = null
      setSceneReady(true)
    }
    const run = async (step: SkyStep): Promise<boolean> => {
      total.n++
      const t0 = performance.now()
      try {
        const tex = await loadStep(renderer, step, isLive)
        if (!live) {
          tex.dispose()
          return false
        }
        succeeded++
        const at = performance.now()
        arrivals.current.push({ worldId: world.id, tier: step.tier, texture: tex, at })
        log({ kind: 'arrive', world: world.id, tier: step.tier, ms: Math.round(at - t0) })
        return true
      } catch (err) {
        if (!live || err instanceof SkyStaleError) return false
        log({ kind: 'fail', world: world.id, tier: step.tier, note: String(err) })
        const fb = fallbackFor(step.tier, world.sky, { ...env, quality, cap: SKY_DEBUG.tier })
        if (fb && !steps.some((s) => s.tier === fb.tier)) {
          console.warn(`[sky] ${step.tier} unavailable, falling back to ${fb.tier}:`, err)
          log({ kind: 'fallback', world: world.id, tier: fb.tier })
          if (hold.current?.worldId === world.id && hold.current.target === step.tier) {
            hold.current.target = fb.tier
          }
          return run(fb)
        }
        // A lower tier is (or will be) up — say so, but this is not the dark fallback.
        console.warn(`[sky] ${step.tier} unavailable, keeping the tier below:`, step.url, err)
        if (hold.current?.worldId === world.id && hold.current.target === step.tier) {
          hold.current.target = null // nothing better is coming: show what there is
        }
        return false
      } finally {
        done()
      }
    }

    const preview = steps.find((s) => s.tier === 'preview')
    const full = steps.find((s) => s.tier === 'k4' || s.tier === 'legacy')
    const k8 = steps.find((s) => s.tier === 'k8')
    if (preview) void run(preview)
    // k8 waits for the full tier: they would only compete for bandwidth and the one worker.
    // If the full tier (and its fallback) failed, the 8K is not tried either.
    if (full) void run(full).then((ok) => (ok && k8 && live ? run(k8) : false))
    else if (k8) void run(k8)
    return () => {
      live = false
    }
    // `plan` is keyed by `key`; env/quality/world.sky feed it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.id, key, renderer, fade, setSceneReady])

  /** Upload an arrival (now: this is the moment the header's rules picked) and fade it in. */
  const present = (due: Arrival, fadeSeconds: number) => {
    let upload: { ms: number; bytes: number }
    try {
      upload = uploadSky(renderer, due.texture)
    } catch (err) {
      // A texture the GPU refused (validation, out of memory): drop it, keep what is up.
      console.error(`[sky] ${due.worldId} ${due.tier} upload failed, keeping what is up:`, err)
      due.texture.dispose()
      if (!fade.current) setSceneReady(true) // never strand the boot overlay
      return
    }
    const w: WorldDef = worldById(due.worldId)
    fade.present(
      {
        texture: due.texture,
        key: due.worldId,
        rank: TIER_RANK[due.tier],
        tier: due.tier,
        exposure: w.exposure,
        heroU: w.sky.heroU ?? HERO_U_DEFAULT,
      },
      fadeSeconds
    )
    log({ kind: 'present', world: due.worldId, tier: due.tier, ...roundUpload(upload) })
    if (!everShown.current) {
      everShown.current = true
      setSceneReady(true)
    }
  }

  useFrame((_, delta) => {
    const now = performance.now()
    const store = useImmersiveStore.getState()

    // Present whatever is due — only ever the current world's sharpest arrival. (A stale world's
    // arrivals wait for the load effect, which disposes them on its next run.)
    const queue = arrivals.current.filter((a) => a.worldId === store.worldId)
    if (queue.length > 0) {
      const current = fade.current
      const booting = !current || store.bootPhase !== 'ready'
      const switching = !!current && current.key !== store.worldId
      const h = hold.current
      let due: Arrival | null = null
      const best = queue.reduce((a, b) => (TIER_RANK[b.tier] > TIER_RANK[a.tier] ? b : a))
      if (booting) {
        due = best
      } else if (switching) {
        const reached = h?.target ? TIER_RANK[best.tier] >= TIER_RANK[h.target] : true
        if (reached || !h || now >= h.until) due = best
      } else {
        const look = lastLook.current
        const quiet = !look.dragging && now - look.at > QUIET_MS
        if (quiet || now - best.at > QUIET_MAX_WAIT_MS) due = best
      }
      if (due) {
        arrivals.current = arrivals.current.filter((a) => a.worldId !== store.worldId)
        for (const a of queue) if (a !== due) a.texture.dispose()
        if (hold.current?.worldId === due.worldId) hold.current = null
        present(due, switching ? WORLD_FADE_S : TIER_FADE_S)
      }
    }

    // Idle spin: eases out under a modal or the dock (the room holds still behind the page), and
    // yields to the camera's attract drift so the two share one ceiling (drift.ts).
    const still = store.modal !== null || store.dockOpen
    driftGain.current += ((still ? 0 : 1) - driftGain.current) * (1 - Math.exp(-DRIFT_EASE * delta))
    if (!reducedMotion && !SKY_DEBUG.still) {
      yaw.current += panoramaSpin(world.drift, driftGain.current, attractDrift.gain) * delta
      // Keep the angle small so float precision never matters on a tab left open for days.
      if (yaw.current > Math.PI * 2) yaw.current -= Math.PI * 2
    }
    nodes.yaw.value = yaw.current
    fade.step(delta)
    nodes.mix.value = fade.mix
  })

  // Debug handle for probes (?skydebug=1).
  useEffect(() => {
    const h = skyDebugHandle()
    if (!h) return
    h.renderer = renderer
    h.events = events.current
    h.info = () => ({
      memory: { ...renderer.info.memory },
      render: {
        calls: renderer.info.render.calls,
        drawCalls: renderer.info.render.drawCalls,
        frameCalls: renderer.info.render.frameCalls,
      },
    })
    h.state = () => ({
      front: fade.front,
      mix: fade.mix,
      slots: fade.slots.map((s) => (s ? { key: s.key, tier: s.tier, rank: s.rank } : null)),
      arrivals: arrivals.current.map((a) => ({ world: a.worldId, tier: a.tier })),
      hold: hold.current,
      plan,
      yaw: yaw.current,
    })
    h.setWorld = (id: string) => useImmersiveStore.getState().setWorld(id, { persist: false })
  }, [renderer, fade, plan])

  // Unmount: every texture, the material, the worker.
  useEffect(
    () => () => {
      for (const a of arrivals.current) a.texture.dispose()
      arrivals.current = []
      fade.dispose()
      material.dispose()
      geometry.dispose()
      for (const p of nodes.placeholders) p.dispose()
      disposeSkyLoader()
    },
    [fade, material, geometry, nodes]
  )

  if (SKY_DEBUG.depth && world.sky.depth) {
    return <DepthSky nodes={nodes} world={world} renderer={renderer} />
  }
  return <mesh geometry={geometry} material={material} renderOrder={-1} frustumCulled={false} />
}

/**
 * DEBUG ONLY (?depth=1): the depth-parallax experiment from the H1 spike — a dense sphere
 * displaced by the world's disparity map (edges discarded), over a defocused flat shell that fills
 * the holes, with CameraRig's head-lean supplying the parallax. NO-GO for shipping (nodes.ts).
 */
function DepthSky({
  nodes,
  world,
  renderer,
}: {
  nodes: ReturnType<typeof createSkyNodes>
  world: WorldDef
  renderer: THREE.WebGPURenderer
}) {
  const parts = useMemo(() => {
    const placeholder = createPlaceholder(THREE.NoColorSpace)
    const depthTex = textureNode(placeholder)
    const u = { near: uniform(DEPTH_NEAR), far: uniform(SKY_RADIUS), offset: uniform(0) }
    const material = createDepthSkyMaterial(nodes, depthTex, u, DEPTH_SEGMENTS)
    const geometry = new THREE.SphereGeometry(SKY_RADIUS, DEPTH_SEGMENTS[0], DEPTH_SEGMENTS[1])
    const shellMaterial = createSkyMaterial(nodes)
    shellMaterial.colorNode = nodes.colorAt(nodes.grad.mul(DEPTH_SHELL_BLUR))
    const shellGeometry = new THREE.SphereGeometry(SKY_RADIUS + 2, 64, 32)
    return { placeholder, depthTex, u, material, geometry, shellMaterial, shellGeometry }
  }, [nodes])

  useEffect(() => {
    let live = true
    parts.u.offset.value = heroOffset(world.sky.heroU ?? HERO_U_DEFAULT)
    const url = world.sky.depth
    if (!url) return
    loadImageSky(renderer, url).then(
      (tex) => {
        if (!live) return tex.dispose()
        tex.colorSpace = THREE.NoColorSpace
        tex.generateMipmaps = false
        tex.minFilter = THREE.LinearFilter
        tex.magFilter = THREE.LinearFilter
        uploadSky(renderer, tex)
        const old = parts.depthTex.value as THREE.Texture
        parts.depthTex.value = tex
        if (old !== parts.placeholder) old.dispose()
      },
      (err) => console.warn('[sky] depth map failed (debug flag):', url, err)
    )
    return () => {
      live = false
    }
  }, [world, renderer, parts])

  useEffect(
    () => () => {
      const cur = parts.depthTex.value as THREE.Texture
      if (cur !== parts.placeholder) cur.dispose()
      parts.placeholder.dispose()
      parts.material.dispose()
      parts.geometry.dispose()
      parts.shellMaterial.dispose()
      parts.shellGeometry.dispose()
    },
    [parts]
  )

  return (
    <>
      <mesh
        geometry={parts.geometry}
        material={parts.material}
        renderOrder={-1}
        frustumCulled={false}
      />
      <mesh
        geometry={parts.shellGeometry}
        material={parts.shellMaterial}
        renderOrder={-2}
        frustumCulled={false}
      />
    </>
  )
}
