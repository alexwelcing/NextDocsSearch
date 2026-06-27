import React, { useEffect, useMemo, useState } from 'react'
import { Euler, Quaternion } from 'three'
import { DropInViewer, LogLevel, SceneRevealMode } from '@mkkellogg/gaussian-splats-3d'

interface GaussianSplatBackgroundProps {
  splatUrl: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

const toQuaternionArray = (rotation: [number, number, number]): [number, number, number, number] => {
  const quaternion = new Quaternion().setFromEuler(new Euler(rotation[0], rotation[1], rotation[2], 'XYZ'))

  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w]
}

/**
 * R3F-compatible Gaussian splat renderer.
 *
 * Uses DropInViewer so splats are rendered inside the existing react-three-fiber
 * scene/camera/render loop.
 */
const GaussianSplatBackground: React.FC<GaussianSplatBackgroundProps> = ({
  splatUrl,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}) => {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const viewer = useMemo(() => {
    return new DropInViewer({
      gpuAcceleratedSort: true,
      sharedMemoryForWorkers: true,
      integerBasedSort: false,
      sceneRevealMode: SceneRevealMode.Instant,
      logLevel: LogLevel.None,
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    setReady(false)
    setError(null)

    viewer
      .addSplatScene(splatUrl, {
        showLoadingUI: false,
        position,
        rotation: toQuaternionArray(rotation),
        scale: [scale, scale, scale],
      })
      .then(() => {
        if (!cancelled) {
          setReady(true)
        }
      })
      .catch((loadError: Error) => {
        if (!cancelled) {
          console.error('Failed to load Gaussian Splat:', loadError)
          setError(loadError)
        }
      })

    return () => {
      cancelled = true
      const sceneCount = viewer.getSceneCount()
      if (sceneCount > 0) {
        const sceneIndexes = Array.from({ length: sceneCount }, (_, index) => index)
        void viewer.removeSplatScenes(sceneIndexes, false)
      }
    }
  }, [viewer, splatUrl, position, rotation, scale])

  useEffect(() => {
    return () => {
      void viewer.dispose()
    }
  }, [viewer])

  if (error || !ready) {
    return null
  }

  return <primitive object={viewer} />
}

export default GaussianSplatBackground
