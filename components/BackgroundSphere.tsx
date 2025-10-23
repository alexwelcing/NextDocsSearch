import React, { useState, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

interface BackgroundSphereProps {
  imageUrl: string
  transitionDuration: number // in seconds
  onLoad?: () => void
}

/**
 * We maintain two spheres:
 *   1) the "old" texture sphere
 *   2) the "new" texture sphere, which fades in once loaded
 * We only switch to the new sphere once the new texture is fully loaded,
 * so there's no momentary blank or flash.
 */
const BackgroundSphere: React.FC<BackgroundSphereProps> = ({
  imageUrl,
  transitionDuration,
  onLoad,
}) => {
  const [oldTexture, setOldTexture] = useState<THREE.Texture | null>(null)
  const [newTexture, setNewTexture] = useState<THREE.Texture | null>(null)

  // Opacity for crossfading from old => new
  const [newOpacity, setNewOpacity] = useState(0)
  const [isFading, setIsFading] = useState(false)

  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(15, 32, 16), [])

  // 1) On mount, load initial texture immediately so we have something displayed
  useEffect(() => {
    loadTexture(imageUrl, (loadedTex) => {
      setOldTexture(loadedTex)
      if (onLoad) onLoad()
    })
  }, [imageUrl, onLoad])

  // 2) If imageUrl changes, load the new texture but don't fade until it's fully loaded
  useEffect(() => {
    // If the same image is reloaded, skip
    if (oldTexture && oldTexture.image?.src.includes(imageUrl)) {
      return
    }
    loadTexture(imageUrl, (loadedTex) => {
      // Put the newly loaded texture in newTexture state at 0 opacity
      setNewTexture(loadedTex)
      setNewOpacity(0)
      setIsFading(true) // start crossfade
    })
  }, [imageUrl, oldTexture])

  // 3) Animate the crossfade in a useFrame loop
  useFrame((_state, delta) => {
    if (!isFading || !newTexture || !oldTexture) return

    // Raise newOpacity from 0 to 1 over transitionDuration seconds
    const fadeSpeed = 1 / transitionDuration
    const nextOpacity = Math.min(newOpacity + fadeSpeed * delta, 1)

    setNewOpacity(nextOpacity)

    // Once it hits 1, finalize the fade
    if (nextOpacity >= 1) {
      setOldTexture(newTexture) // The new becomes the old
      setNewTexture(null) // Clear the 'new' sphere
      setNewOpacity(0)
      setIsFading(false)
    }
  })

  // A helper function to load textures with a callback
  function loadTexture(url: string, onTexLoad: (tex: THREE.Texture) => void) {
    const loader = new THREE.TextureLoader()
    loader.load(
      url,
      (tex) => onTexLoad(tex),
      undefined, // onProgress
      (err) => console.error(`Error loading texture:`, err),
    )
  }

  return (
    <>
      {/* OLD TEXTURE SPHERE - always full opacity */}
      {oldTexture && (
        <mesh geometry={sphereGeometry}>
          <meshBasicMaterial
            attach="material"
            map={oldTexture}
            side={THREE.BackSide}
            transparent
            opacity={1}
          />
        </mesh>
      )}

      {/* NEW TEXTURE SPHERE - crossfade from 0 to 1 */}
      {newTexture && (
        <mesh geometry={sphereGeometry}>
          <meshBasicMaterial
            attach="material"
            map={newTexture}
            side={THREE.BackSide}
            transparent
            opacity={newOpacity}
          />
        </mesh>
      )}
    </>
  )
}

export default BackgroundSphere
