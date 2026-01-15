import React, { useState, useEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d'

interface HybridBackgroundProps {
  panoUrl: string
  splatUrl?: string
  transitionDuration?: number
}

/**
 * Hybrid background that loads panorama immediately,
 * then loads Gaussian splat in background and transitions with vaporize effect
 */
const HybridBackground: React.FC<HybridBackgroundProps> = ({
  panoUrl,
  splatUrl,
  transitionDuration = 2.0,
}) => {
  const { scene, camera, gl } = useThree()

  // Panorama state
  const [panoTexture, setPanoTexture] = useState<THREE.Texture | null>(null)
  const panoOpacityRef = useRef(1)
  const panoMaterialRef = useRef<THREE.MeshBasicMaterial>(null)

  // Splat state
  const [splatLoaded, setSplatLoaded] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const transitionProgressRef = useRef(0)
  const splatViewerRef = useRef<any>(null)
  const loadingRef = useRef(false)

  // Geometry for pano sphere
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(15, 32, 16), [])

  // Load panorama immediately on mount
  useEffect(() => {
    if (!panoUrl) return

    const loader = new THREE.TextureLoader()
    loader.load(
      panoUrl,
      (texture) => {
        texture.generateMipmaps = true
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.anisotropy = 2
        setPanoTexture(texture)
        console.log('[HybridBackground] Panorama loaded:', panoUrl)
      },
      undefined,
      (error) => {
        console.error('[HybridBackground] Failed to load panorama:', error)
      }
    )
  }, [panoUrl])

  // Load splat in background after pano is ready
  useEffect(() => {
    if (!splatUrl || !panoTexture || loadingRef.current) return
    if (!scene || scene.type !== 'Scene') {
      console.warn('[HybridBackground] Scene not ready, deferring splat load')
      return
    }

    loadingRef.current = true
    console.log('[HybridBackground] Starting splat load:', splatUrl)

    // Small delay to ensure scene is stable
    const timer = setTimeout(() => {
      try {
        const viewer = new GaussianSplats3D.Viewer({
          cameraUp: [0, 1, 0],
          initialCameraPosition: [0, 2, 10],
          initialCameraLookAt: [0, 0, 0],
          renderer: gl,
          camera: camera,
          scene: scene,
          selfDrivenMode: false, // We control the render loop
        })

        splatViewerRef.current = viewer

        viewer
          .addSplatScene(splatUrl, {
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            splatAlphaRemovalThreshold: 5,
          })
          .then(() => {
            console.log('[HybridBackground] Splat loaded successfully')
            setSplatLoaded(true)
            setIsTransitioning(true)
            transitionProgressRef.current = 0
          })
          .catch((error) => {
            console.error('[HybridBackground] Failed to load splat:', error)
            loadingRef.current = false
          })
      } catch (error) {
        console.error('[HybridBackground] Error initializing splat viewer:', error)
        loadingRef.current = false
      }
    }, 500)

    return () => {
      clearTimeout(timer)
      if (splatViewerRef.current) {
        try {
          splatViewerRef.current.dispose()
        } catch (e) {
          console.warn('[HybridBackground] Error disposing splat viewer:', e)
        }
        splatViewerRef.current = null
      }
    }
  }, [splatUrl, panoTexture, scene, camera, gl])

  // Vaporize transition animation
  useFrame((_state, delta) => {
    if (!isTransitioning || !splatLoaded) return

    // Progress the transition
    const transitionSpeed = 1 / transitionDuration
    transitionProgressRef.current = Math.min(1, transitionProgressRef.current + delta * transitionSpeed)

    // Vaporize effect: fade out pano with particles/noise effect
    const progress = transitionProgressRef.current
    const easeOut = 1 - Math.pow(1 - progress, 3) // Smooth deceleration

    // Fade out panorama
    panoOpacityRef.current = 1 - easeOut
    if (panoMaterialRef.current) {
      panoMaterialRef.current.opacity = panoOpacityRef.current
    }

    // Update splat viewer
    if (splatViewerRef.current) {
      try {
        splatViewerRef.current.update()
        splatViewerRef.current.render()
      } catch (e) {
        // Silently handle render errors during transition
      }
    }

    // Complete transition
    if (progress >= 1) {
      setIsTransitioning(false)
      // Dispose pano texture to free memory
      if (panoTexture) {
        panoTexture.dispose()
        setPanoTexture(null)
      }
    }
  })

  return (
    <>
      {/* Panorama sphere - shows immediately, fades out when splat ready */}
      {panoTexture && panoOpacityRef.current > 0.01 && (
        <mesh geometry={sphereGeometry}>
          <meshBasicMaterial
            ref={panoMaterialRef}
            map={panoTexture}
            side={THREE.BackSide}
            transparent
            opacity={panoOpacityRef.current}
          />
        </mesh>
      )}

      {/* Splat will be rendered by the GaussianSplats3D viewer directly into the scene */}
    </>
  )
}

export default HybridBackground
