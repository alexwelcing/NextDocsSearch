// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { useOrbField, type OrbField } from './SphereHunter'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

/** A stand-in user of the hook (the hunt and the boot WarmupRig, in the real canvas). */
function User({ seen }: { seen: OrbField[] }) {
  seen.push(useOrbField())
  return null
}

describe('useOrbField', () => {
  it('hands every user the same meshes, so the warmed pipelines are the ones the hunt draws', async () => {
    const seen: OrbField[] = []
    const root = createRoot(document.createElement('div'))
    await act(async () =>
      root.render(
        <>
          <User seen={seen} />
          <User seen={seen} />
        </>
      )
    )
    expect(seen).toHaveLength(2)
    expect(seen[1]).toBe(seen[0])
    expect(seen[0].orbs.isInstancedMesh).toBe(true)
    await act(async () => root.unmount())
  })

  it('disposes the field only after its last user leaves, and starts fresh after that', async () => {
    const seen: OrbField[] = []
    const root = createRoot(document.createElement('div'))
    await act(async () =>
      root.render(
        <>
          <User seen={seen} />
          <User seen={seen} />
        </>
      )
    )
    const field = seen[0]
    const dispose = vi.spyOn(field, 'dispose')
    await act(async () => root.render(<User seen={seen} />))
    expect(dispose).not.toHaveBeenCalled()
    await act(async () => root.unmount())
    expect(dispose).toHaveBeenCalledTimes(1)

    // a canvas mounted later (after a device loss, say) gets its own
    const next: OrbField[] = []
    const again = createRoot(document.createElement('div'))
    await act(async () => again.render(<User seen={next} />))
    expect(next[0]).not.toBe(field)
    await act(async () => again.unmount())
  })
})
