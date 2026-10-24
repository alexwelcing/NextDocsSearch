// Boot-time GPU pipeline warmup. While the opaque CRT boot overlay still covers the canvas, this
// parks one live instance of every render-pipeline variant the app uses half a metre down the
// gaze and lets the real frame loop draw it for a few frames — through PostFX's scene pass when
// it's mounted, so each pipeline is built against the exact target format, sample count, lights
// and fog it will meet later. Then it hides itself and flips `shadersWarm` (BootSequence's gate).
//
// Why this replaced compileAsync(scene): at boot the dock, title card and modals aren't mounted
// yet and compileAsync skips anything invisible, so it warmed an almost empty scene and the
// pipelines compiled on the first visible frames instead (the reveal hitch, the dock-open hitch).
//
// Why it HIDES rather than unmounts: three releases a pipeline the moment its last user is
// disposed, so unmounting would throw the warm cache away before the dock ever opened. A few
// invisible meshes keep every variant referenced for the session at no per-frame cost.
//
// Pipelines key on shader code + blend/depth/cull/topology/winding state, not on material
// identity, so one stand-in per variant covers every later mesh of that kind. When a new kind of
// material lands in the scene, add its twin here; the reveal probe will show it otherwise.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { loadFontAtlas } from '@/lib/windfoil/atlas'
import { ARC, FONT, rgba } from '@/lib/immersive/theme'
import { WindfoilText } from '../text/WindfoilText'
import { DockChassis } from '../dock/DockChassis'
import { CrtScreen } from '../dock/CrtScreen'

const DISTANCE = 0.5 // metres down the gaze — inside the frustum, in front of the whole world
const SCALE = 0.25 // shrink the stand-ins; size never enters a pipeline key
const WARM_FRAMES = 3

const forward = new THREE.Vector3()

/** Tiny sRGB canvas texture with a real texture's sampler setup (TextureLoader/VideoTexture). */
function standInTexture(kind: 'panorama' | 'image' | 'video'): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 2
  // a canvas with no painted context has no image resource to upload
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.fillRect(0, 0, canvas.width, canvas.height)
  const tex = new THREE.Texture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  if (kind === 'panorama') {
    // mirrors PanoramaSphere.loadPanorama
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.wrapS = THREE.RepeatWrapping
  } else if (kind === 'video') {
    // VideoTexture defaults
    tex.minFilter = THREE.LinearFilter
    tex.generateMipmaps = false
  }
  tex.needsUpdate = true
  return tex
}

export function WarmupRig() {
  const camera = useThree((s) => s.camera)
  const bootPhase = useImmersiveStore((s) => s.bootPhase)
  const setShadersWarm = useImmersiveStore((s) => s.setShadersWarm)

  // Only ever drawn under the boot overlay. A canvas that mounts outside 'booting' (nothing does
  // today) skips the rig rather than flashing stand-ins at the viewer.
  const [armed] = useState(() => useImmersiveStore.getState().bootPhase === 'booting')
  const [fontsReady, setFontsReady] = useState(false)
  const rig = useRef<THREE.Group>(null)
  const frames = useRef(0)
  const done = useRef(false)

  const textures = useMemo(
    () => ({
      panorama: standInTexture('panorama'),
      image: standInTexture('image'),
      video: standInTexture('video'),
    }),
    []
  )
  useEffect(() => {
    return () => {
      textures.panorama.dispose()
      textures.image.dispose()
      textures.video.dispose()
    }
  }, [textures])

  useEffect(() => {
    if (!armed) {
      setShadersWarm(true)
      return
    }
    let live = true
    // Windfoil meshes only exist once their atlas is in (ImmersiveApp already started both loads).
    Promise.all([loadFontAtlas(FONT.display), loadFontAtlas(FONT.mono)]).then(
      () => live && setFontsReady(true),
      (err) => {
        // never hold the boot hostage to a warmup
        console.error('[arc] warmup fonts failed (continuing cold):', err)
        if (live) setShadersWarm(true)
      }
    )
    return () => {
      live = false
    }
  }, [armed, setShadersWarm])

  // Safety net: if boot ends some other way (skip, phase change), never keep stand-ins visible.
  useEffect(() => {
    if (bootPhase !== 'booting' && rig.current) rig.current.visible = false
  }, [bootPhase])

  useFrame(() => {
    const g = rig.current
    if (!g || done.current) return
    camera.getWorldDirection(forward)
    g.position.copy(camera.position).addScaledVector(forward, DISTANCE)
    g.quaternion.copy(camera.quaternion)
    // Runs before this tick's render, so WARM_FRAMES real frames have drawn the rig by the time
    // the counter passes it.
    frames.current += 1
    if (frames.current > WARM_FRAMES) {
      done.current = true
      g.visible = false
      setShadersWarm(true)
    }
  })

  if (!armed || !fontsReady) return null

  const s = SCALE
  return (
    <group ref={rig}>
      {/* dock body: lit standard materials (boxes, LEDs, antenna), windfoil display+glow and
          mono text, all with scene fog — the real component, so its materials can't drift */}
      <group position={[-0.07, 0.03, 0]} scale={s}>
        <DockChassis activity={false} />
      </group>
      {/* CRT stack: phosphor base, multiply scanlines, additive glow — plus text on the raster */}
      <group position={[0.07, 0.03, 0]} scale={s}>
        <CrtScreen powered>
          <WindfoilText font={FONT.display} fontSize={0.03} color={rgba(ARC.green)}>
            WARM
          </WindfoilText>
          <WindfoilText
            font={FONT.mono}
            fontSize={0.02}
            color={rgba(ARC.greenBright)}
            position={[0, -0.05, 0]}
            glow
          >
            PIPELINE CACHE
          </WindfoilText>
        </CrtScreen>
      </group>
      <group position={[0, -0.05, 0]} scale={s}>
        {/* key caps (DockKey): standard material with emissive */}
        <mesh position={[-0.3, 0, 0]}>
          <boxGeometry args={[0.07, 0.04, 0.018]} />
          <meshStandardMaterial color={ARC.chassis} roughness={0.55} emissive={ARC.greenDim} />
        </mesh>
        {/* Sphere Hunter orb and its burst (wireframe = line topology) */}
        <mesh position={[-0.2, 0, 0]} scale={0.03}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={ARC.green}
            emissive={ARC.green}
            emissiveIntensity={0.7}
            transparent
            opacity={0.92}
          />
        </mesh>
        <mesh position={[-0.12, 0, 0]} scale={0.03}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={ARC.green}
            emissive={ARC.green}
            emissiveIntensity={2.5}
            transparent
            opacity={0.5}
            wireframe
          />
        </mesh>
        {/* flat UI fills: opaque / translucent, fogged / fog-free, and the invisible hit pads */}
        <mesh position={[-0.04, 0, 0]}>
          <planeGeometry args={[0.05, 0.05]} />
          <meshBasicMaterial color={ARC.greenDim} />
        </mesh>
        <mesh position={[0.02, 0, 0]}>
          <planeGeometry args={[0.05, 0.05]} />
          <meshBasicMaterial color={ARC.chassisDark} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0.08, 0, 0]}>
          <planeGeometry args={[0.05, 0.05]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} transparent />
        </mesh>
        <mesh position={[0.14, 0, 0]}>
          <planeGeometry args={[0.05, 0.05]} />
          <meshBasicMaterial color={ARC.greenFaint} fog={false} />
        </mesh>
        <mesh position={[0.2, 0, 0]}>
          <planeGeometry args={[0.05, 0.05]} />
          <meshBasicMaterial color={ARC.screenBg} transparent opacity={0.97} fog={false} />
        </mesh>
        {/* the title card's accent rule: translucent, fog-free, no depth write */}
        <mesh position={[0.2, 0.06, 0]}>
          <planeGeometry args={[0.05, 0.01]} />
          <meshBasicMaterial color={ARC.green} transparent depthWrite={false} fog={false} />
        </mesh>
        {/* textured planes: reader images (fog-free) and the film panel (fogged, video sampler) */}
        <mesh position={[0.26, 0, 0]}>
          <planeGeometry args={[0.05, 0.05]} />
          <meshBasicMaterial map={textures.image} fog={false} />
        </mesh>
        <mesh position={[0.32, 0, 0]}>
          <planeGeometry args={[0.05, 0.05]} />
          <meshBasicMaterial map={textures.video} />
        </mesh>
      </group>
      {/* panorama layers, settled (opaque) and mid-crossfade (transparent): inverted spheres seen
          from inside-out, mirrored like PanoramaSphere's (negative scale flips the winding) */}
      <group position={[0, 0.12, 0]}>
        <mesh position={[-0.05, 0, 0]} scale={[-0.03, 0.03, 0.03]}>
          <sphereGeometry args={[1, 16, 8]} />
          <meshBasicMaterial
            map={textures.panorama}
            side={THREE.BackSide}
            depthWrite={false}
            fog={false}
          />
        </mesh>
        <mesh position={[0.05, 0, 0]} scale={[-0.03, 0.03, 0.03]}>
          <sphereGeometry args={[1, 16, 8]} />
          <meshBasicMaterial
            map={textures.panorama}
            side={THREE.BackSide}
            depthWrite={false}
            fog={false}
            transparent
          />
        </mesh>
      </group>
    </group>
  )
}
