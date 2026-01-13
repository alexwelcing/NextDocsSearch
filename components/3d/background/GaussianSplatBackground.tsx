import React, { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d'

interface GaussianSplatBackgroundProps {
  splatUrl: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

/**
 * Component to render a Gaussian Splat as a navigable 3D background
 * Uses @mkkellogg/gaussian-splats-3d for rendering
 */
const GaussianSplatBackground: React.FC<GaussianSplatBackgroundProps> = ({
  splatUrl,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}) => {
  const { scene, camera, gl } = useThree()
  const viewerRef = useRef<any>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    // Create a new Gaussian Splat Viewer
    const viewer = new GaussianSplats3D.Viewer({
      cameraUp: [0, 1, 0],
      initialCameraPosition: position,
      initialCameraLookAt: [0, 0, 0],
      renderer: gl,
      camera: camera,
    })

    viewerRef.current = viewer

    // Load the splat file
    viewer
      .addSplatScene(splatUrl, {
        position: position,
        rotation: rotation,
        scale: [scale, scale, scale],
      })
      .then(() => {
        console.log('Gaussian Splat loaded successfully')
        viewer.start()
      })
      .catch((error: Error) => {
        console.error('Failed to load Gaussian Splat:', error)
      })

    return () => {
      if (viewerRef.current) {
        viewerRef.current.dispose()
        viewerRef.current = null
        loadedRef.current = false
      }
    }
  }, [splatUrl, scene, camera, gl, position, rotation, scale])

  // Render nothing - the viewer manages its own rendering
  return null
}

export default GaussianSplatBackground
