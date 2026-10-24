// World-driven lighting: hemisphere ambience + a key light, tinted per world definition.
// Panorama and text are unlit; these lights shape the dock body, modals, and game objects.

import { useImmersiveStore } from '@/stores/immersiveStore'
import { worldById } from '@/lib/immersive/worlds'

// The old ACES output pre-scaled the whole frame by exposure / 0.6 (≈1.75×) before its curve;
// Neutral at exposure 1 doesn't, and its toe pulls dark values (the chassis greys) down further.
// Lit surfaces get the difference back here, so the dock body keeps its look without the UI
// colors or the panorama paying for it.
const LIGHT_GAIN = 1.6

export function SceneLights() {
  const worldId = useImmersiveStore((s) => s.worldId)
  const world = worldById(worldId)
  return (
    <>
      <hemisphereLight
        color={world.ambient.color}
        groundColor="#1a1410"
        intensity={world.ambient.intensity * LIGHT_GAIN}
      />
      <directionalLight
        color={world.key.color}
        intensity={world.key.intensity * LIGHT_GAIN}
        position={world.key.position}
      />
    </>
  )
}
