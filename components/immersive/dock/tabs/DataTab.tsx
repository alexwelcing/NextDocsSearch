// DATA: operator files — about, current work, and the working pitch — plus the four curated
// collections. Everything opens as an in-scene modal at its canonical URL.

import { useState } from 'react'
import { useRouter } from 'next/router'
import { ScreenHeader, ScreenHints } from '../widgets/ScreenChrome'
import { ScreenList } from '../widgets/ScreenList'
import { useTabKeys } from '../useTabKeys'
import { openModal } from '@/lib/immersive/navigation'
import type { ImmersiveModal } from '@/stores/immersiveStore'
import { playSound } from '@/lib/immersive/audio'

const ENTRIES: { id: string; primary: string; meta: string; modal: ImmersiveModal }[] = [
  { id: 'about', primary: 'OPERATOR DOSSIER — ALEX WELCING', meta: 'BIO', modal: { type: 'data', panel: 'about' } },
  { id: 'work', primary: 'CURRENT WORK', meta: 'LOG', modal: { type: 'data', panel: 'work' } },
  { id: 'pitch', primary: 'WORKING PITCH', meta: 'DECK', modal: { type: 'data', panel: 'pitch' } },
  { id: 'agent-futures', primary: 'COLLECTION: AGENT FUTURES', meta: 'HUB', modal: { type: 'collection', hub: 'agent-futures' } },
  { id: 'emergent-intelligence', primary: 'COLLECTION: EMERGENT INTELLIGENCE', meta: 'HUB', modal: { type: 'collection', hub: 'emergent-intelligence' } },
  { id: 'speculative-ai', primary: 'COLLECTION: SPECULATIVE AI', meta: 'HUB', modal: { type: 'collection', hub: 'speculative-ai' } },
  { id: 'the-interface', primary: 'COLLECTION: THE INTERFACE', meta: 'HUB', modal: { type: 'collection', hub: 'the-interface' } },
]

export function DataTab({ active, width }: { active: boolean; width: number }) {
  const router = useRouter()
  const [sel, setSel] = useState(0)

  const activate = (index: number) => {
    playSound('confirm')
    openModal(router, ENTRIES[index].modal)
  }

  useTabKeys(active, (e) => {
    if (e.key === 'ArrowDown') {
      setSel((s) => Math.min(s + 1, ENTRIES.length - 1))
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

  return (
    <group>
      <ScreenHeader title="DATA" right="OPERATOR FILES" width={width} />
      <ScreenList
        items={ENTRIES}
        selected={sel}
        onSelect={(index) => {
          setSel(index)
          playSound('key')
        }}
        onActivate={activate}
        width={width}
        rows={7}
        y={-0.055}
      />
      <ScreenHints text="^v SELECT · ENTER OPEN" width={width} />
    </group>
  )
}
