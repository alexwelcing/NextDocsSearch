// World-driven lighting: hemisphere ambience + a key light, tinted per world definition.
// Panorama and text are unlit; these lights shape the dock body, modals, and game objects.

import { useImmersiveStore } from '@/stores/immersiveStore'
import { worldById } from '@/lib/immersive/worlds'

export function SceneLights() {
  const worldId = useImmersiveStore((s) => s.worldId)
  const world = worldById(worldId)
  return (
    <>
      <hemisphereLight
        color={world.ambient.color}
        groundColor="#1a1410"
        intensity={world.ambient.intensity}
      />
      <directionalLight
        color={world.key.color}
        intensity={world.key.intensity}
        position={world.key.position}
      />
    </>
  )
}
