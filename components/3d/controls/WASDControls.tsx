/**
 * WASDControls - Keyboard-driven first-person camera movement
 *
 * Adds WASD + arrow key navigation for moving through 3D scenes.
 * Works alongside OrbitControls — mouse to look, WASD to move.
 *
 * Keys:
 *   W / ArrowUp    - Move forward
 *   S / ArrowDown  - Move backward
 *   A / ArrowLeft  - Strafe left
 *   D / ArrowRight - Strafe right
 *   Q              - Move down
 *   E              - Move up
 */

import { useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface WASDControlsProps {
  enabled?: boolean
  moveSpeed?: number
  /** Target ref from OrbitControls to keep in sync */
  orbitTarget?: React.RefObject<THREE.Vector3 | null>
}

const _direction = new THREE.Vector3()
const _right = new THREE.Vector3()
const _forward = new THREE.Vector3()

export default function WASDControls({
  enabled = true,
  moveSpeed = 5,
  orbitTarget,
}: WASDControlsProps) {
  const { camera } = useThree()
  const keysRef = useRef<Set<string>>(new Set())

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return
      // Ignore if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const key = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysRef.current.add(key)
        e.preventDefault()
      }
    },
    [enabled]
  )

  const onKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current.delete(e.key.toLowerCase())
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    // Clear all keys on blur to prevent stuck keys
    const onBlur = () => keysRef.current.clear()
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [onKeyDown, onKeyUp])

  useFrame((_, delta) => {
    if (!enabled || keysRef.current.size === 0) return

    const keys = keysRef.current
    const speed = moveSpeed * delta

    // Get camera's forward and right vectors (projected to horizontal plane)
    camera.getWorldDirection(_forward)
    _forward.y = 0
    _forward.normalize()

    _right.crossVectors(_forward, camera.up).normalize()

    _direction.set(0, 0, 0)

    // Forward / Backward
    if (keys.has('w') || keys.has('arrowup')) _direction.add(_forward)
    if (keys.has('s') || keys.has('arrowdown')) _direction.sub(_forward)

    // Strafe Left / Right
    if (keys.has('a') || keys.has('arrowleft')) _direction.sub(_right)
    if (keys.has('d') || keys.has('arrowright')) _direction.add(_right)

    // Up / Down
    if (keys.has('e')) _direction.y += 1
    if (keys.has('q')) _direction.y -= 1

    if (_direction.lengthSq() === 0) return
    _direction.normalize().multiplyScalar(speed)

    // Move camera position
    camera.position.add(_direction)

    // Also move OrbitControls target so the pivot follows the camera
    if (orbitTarget?.current) {
      orbitTarget.current.add(_direction)
    }
  })

  return null
}
