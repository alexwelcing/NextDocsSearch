// 360 equirect panorama on an inverted sphere, with crossfade between worlds and a slow idle
// drift. Signals sceneReady to the store when the first texture is live (boot gate).

import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { worldById } from '@/lib/immersive/worlds'

const RADIUS = 60
const FADE_SPEED = 1.6 // opacity units per second

interface Layer {
  texture: THREE.Texture
  url: string
}

const loader = new THREE.TextureLoader()

async function loadPanorama(url: string): Promise<THREE.Texture> {
  const tex = await loader.loadAsync(url)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.wrapS = THREE.RepeatWrapping
  tex.flipY = true
  tex.anisotropy = 4
  return tex
}

export function PanoramaSphere() {
  const worldId = useImmersiveStore((s) => s.worldId)
  const setSceneReady = useImmersiveStore((s) => s.setSceneReady)
  const reducedMotion = useImmersiveStore((s) => s.reducedMotion)
  const world = worldById(worldId)

  const [front, setFront] = useState<Layer | null>(null)
  const [back, setBack] = useState<Layer | null>(null)
  const frontMat = useRef<THREE.MeshBasicMaterial>(null)
  const group = useRef<THREE.Group>(null)
  const fading = useRef(false)

  useEffect(() => {
    let live = true
    if (front?.url === world.panorama) return
    loadPanorama(world.panorama).then(
      (texture) => {
        if (!live) {
          texture.dispose()
          return
        }
        setFront((prev) => {
          setBack((old) => {
            old?.texture.dispose()
            return prev
          })
          return { texture, url: world.panorama }
        })
        fading.current = true
        setSceneReady(true)
      },
      (err) => console.error('[panorama] load failed:', err)
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.panorama, setSceneReady])

  useFrame((_, delta) => {
    if (group.current && !reducedMotion) group.current.rotation.y += world.drift * delta * 10
    if (fading.current && frontMat.current) {
      frontMat.current.opacity = Math.min(frontMat.current.opacity + FADE_SPEED * delta, 1)
      if (frontMat.current.opacity >= 1) {
        fading.current = false
        setBack((old) => {
          old?.texture.dispose()
          return null
        })
      }
    }
  })

  // Reset the fade whenever the front layer swaps.
  useEffect(() => {
    if (frontMat.current && back) frontMat.current.opacity = 0
  }, [front, back])

  return (
    <group ref={group}>
      {back && (
        <mesh scale={[-1, 1, 1]} renderOrder={-2}>
          <sphereGeometry args={[RADIUS + 1, 64, 32]} />
          <meshBasicMaterial
            map={back.texture}
            side={THREE.BackSide}
            depthWrite={false}
            fog={false}
            toneMapped={false}
          />
        </mesh>
      )}
      {front && (
        <mesh scale={[-1, 1, 1]} renderOrder={-1}>
          <sphereGeometry args={[RADIUS, 64, 32]} />
          <meshBasicMaterial
            ref={frontMat}
            map={front.texture}
            side={THREE.BackSide}
            depthWrite={false}
            fog={false}
            transparent={!!back}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  )
}
