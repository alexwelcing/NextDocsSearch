import React, { useState, useEffect, useMemo, useRef } from 'react'
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
 *
 * Performance optimized: Uses refs to avoid state updates in useFrame
 */
const BackgroundSphere: React.FC<BackgroundSphereProps> = ({
  imageUrl,
  transitionDuration,
  onLoad,
}) => {
  const [oldTexture, setOldTexture] = useState<THREE.Texture | null>(null)
  const [newTexture, setNewTexture] = useState<THREE.Texture | null>(null)

  // Use refs for animation to avoid setState in useFrame
  const newOpacityRef = useRef(0)
  const isFadingRef = useRef(false)
  const newMaterialRef = useRef<THREE.MeshBasicMaterial>(null)

  // Reduce polygon count for better performance
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(15, 24, 12), [])

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
      newOpacityRef.current = 0
      isFadingRef.current = true // start crossfade
    })
  }, [imageUrl, oldTexture])

  // 3) Animate the crossfade in a useFrame loop - optimized with refs
  useFrame((_state, delta) => {
    if (!isFadingRef.current || !newTexture || !oldTexture) return

    // Raise newOpacity from 0 to 1 over transitionDuration seconds
    const fadeSpeed = 1 / transitionDuration
    const nextOpacity = Math.min(newOpacityRef.current + fadeSpeed * delta, 1)

    newOpacityRef.current = nextOpacity

    // Update material opacity directly without triggering re-render
    if (newMaterialRef.current) {
      newMaterialRef.current.opacity = nextOpacity
    }

    // Once it hits 1, finalize the fade
    if (nextOpacity >= 1) {
      setOldTexture(newTexture) // The new becomes the old
      setNewTexture(null) // Clear the 'new' sphere
      newOpacityRef.current = 0
      isFadingRef.current = false
    }
  })

  // A helper function to load textures with a callback - optimized settings
  function loadTexture(url: string, onTexLoad: (tex: THREE.Texture) => void) {
    const loader = new THREE.TextureLoader()
    loader.load(
      url,
      (tex) => {
        // Optimize texture settings
        tex.generateMipmaps = true
        tex.minFilter = THREE.LinearMipmapLinearFilter
        tex.magFilter = THREE.LinearFilter
        tex.anisotropy = 4 // Lower anisotropy for better performance
        onTexLoad(tex)
      },
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
            ref={newMaterialRef}
            attach="material"
            map={newTexture}
            side={THREE.BackSide}
            transparent
            opacity={newOpacityRef.current}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  )
}

export default BackgroundSphere
