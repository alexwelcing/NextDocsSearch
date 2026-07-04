// WORLDS: environment selector. Choosing a world crossfades the panorama and re-tints the
// lighting and atmosphere. The dock stays put — the room changes around you.

import { useState } from 'react'
import { WindfoilText } from '../../text/WindfoilText'
import { ScreenHeader, ScreenHints } from '../widgets/ScreenChrome'
import { ScreenList } from '../widgets/ScreenList'
import { useTabKeys } from '../useTabKeys'
import { WORLDS } from '@/lib/immersive/worlds'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { playSound } from '@/lib/immersive/audio'
import { ARC, FONT, TYPE, rgba } from '@/lib/immersive/theme'

const ROWS = 5

export function WorldsTab({ active, width }: { active: boolean; width: number }) {
  const worldId = useImmersiveStore((s) => s.worldId)
  const setWorld = useImmersiveStore((s) => s.setWorld)
  const [sel, setSel] = useState(() => Math.max(0, WORLDS.findIndex((w) => w.id === worldId)))

  const activate = (index: number) => {
    const world = WORLDS[index]
    if (!world || world.id === worldId) return
    playSound('confirm')
    setWorld(world.id)
  }

  useTabKeys(active, (e) => {
    if (e.key === 'ArrowDown') {
      setSel((s) => Math.min(s + 1, WORLDS.length - 1))
      playSound('key')
      return true
    }
    if (e.key === 'ArrowUp') {
      setSel((s) => Math.max(s - 1, 0))
      playSound('key')
      return true
    }
    if (e.key === 'Enter') {
      activate(sel)
      return true
    }
    return false
  })

  const items = WORLDS.map((w) => ({
    id: w.id,
    primary: w.name,
    meta: w.id === worldId ? '* LIVE' : '',
  }))

  return (
    <group>
      <ScreenHeader title="WORLDS" right={`${WORLDS.length} MAPPED`} width={width} />
      <ScreenList
        items={items}
        selected={sel}
        onSelect={(index) => {
          setSel(index)
          playSound('key')
        }}
        onActivate={activate}
        width={width}
        rows={ROWS}
        y={-0.055}
      />
      <WindfoilText
        font={FONT.mono}
        fontSize={TYPE.small}
        color={rgba(ARC.green, 0.6)}
        position={[0, -0.055 - ROWS * 0.037 - 0.012, 0]}
        maxWidth={width}
        maxLines={2}
      >
        {WORLDS[sel]?.blurb ?? ''}
      </WindfoilText>
      <ScreenHints text="^v SELECT · ENTER JUMP" width={width} />
    </group>
  )
}
