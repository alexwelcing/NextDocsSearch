// SHIP: the ship-mind console. Ask a question, watch the answer stream onto the tube, open any
// source it cites in-scene. History stays for the session. Keystrokes are captured while the tab
// is active; touch devices get a hidden input via useTouchTextInput so the OS keyboard opens.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { WindfoilText } from '../../text/WindfoilText'
import { ScreenHeader, ScreenHints } from '../widgets/ScreenChrome'
import { useTabKeys } from '../useTabKeys'
import { isTouchTextTarget, useTouchTextInput } from '../../hooks/useTouchTextInput'
import {
  askShip,
  sourceModal,
  type ShipHistoryEntry,
  type ShipInstantItem,
} from '@/lib/immersive/shipClient'
import { openModal } from '@/lib/immersive/navigation'
import { playSound } from '@/lib/immersive/audio'
import { ARC, FONT, TYPE, rgba } from '@/lib/immersive/theme'
import { stopLook } from '../DockKey'
import { SCREEN_H } from '../CrtScreen'

type Phase = 'idle' | 'thinking' | 'streaming' | 'done' | 'error'

const MAX_QUERY = 120

export function ShipTab({ active, width }: { active: boolean; width: number }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [sources, setSources] = useState<ShipInstantItem[]>([])
  const history = useRef<ShipHistoryEntry[]>([])
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  // Hidden DOM input for touch keyboards; desktop keys are handled below.
  const field = useTouchTextInput({
    active,
    value: query,
    onChange: setQuery,
    label: 'Ask the ship mind',
    maxLength: MAX_QUERY,
    enterKeyHint: 'send',
  })

  const ask = () => {
    const q = query.trim()
    if (!q || phase === 'thinking' || phase === 'streaming') return
    playSound('confirm')
    setPhase('thinking')
    setAnswer('')
    setSources([])
    abort.current?.abort()
    const ac = new AbortController()
    abort.current = ac
    askShip(
      q,
      history.current,
      {
        onInstant: (items) => setSources(items.slice(0, 3)),
        onDelta: (full) => {
          setPhase('streaming')
          setAnswer(full)
        },
        onFinal: (final) => {
          setPhase('done')
          setAnswer(final)
          history.current = [
            ...history.current.slice(-6),
            { role: 'user', content: q },
            { role: 'assistant', content: final.slice(0, 1200) },
          ]
        },
        onError: (message) => {
          setPhase('error')
          setAnswer(message)
        },
      },
      ac.signal
    ).catch(() => {
      setPhase('error')
      setAnswer('SIGNAL LOST')
    })
    setQuery('')
  }

  useTabKeys(active, (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return false
    // keys typed into another surface's field (the Sphere Hunter callsign) are that field's
    if (isTouchTextTarget(e) && !field.owns(e)) return false
    if (e.key === 'Enter') {
      ask()
      return true
    }
    // The native input owns text editing, paste, composition and mobile input.
    // Only the unfocused desktop terminal appends/deletes characters itself.
    if (field.owns(e)) return false
    if (e.key === 'Backspace') {
      setQuery((q) => q.slice(0, -1))
      playSound('key')
      return true
    }
    if (e.key.length === 1) {
      setQuery((q) => (q.length < MAX_QUERY ? q + e.key : q))
      playSound('key')
      return true
    }
    return false
  })

  const status =
    phase === 'thinking'
      ? 'SHIP MIND ENGAGED…'
      : phase === 'streaming'
        ? 'RECEIVING'
        : phase === 'error'
          ? 'FAULT'
          : phase === 'done'
            ? 'COMPLETE'
            : 'STANDING BY'

  return (
    <group>
      <ScreenHeader title="SHIP" right={status} width={width} />
      {/* query line — tap to summon the OS keyboard on touch */}
      <mesh
        position={[width / 2, -0.062, -0.0005]}
        onPointerDown={(e) => {
          stopLook(e)
          field.focus()
        }}
      >
        <planeGeometry args={[width, 0.04]} />
        <meshBasicMaterial color={ARC.greenFaint} transparent opacity={0.65} />
      </mesh>
      <WindfoilText
        font={FONT.mono}
        fontSize={TYPE.row}
        color={rgba(ARC.greenBright)}
        position={[0.008, -0.052, 0.0002]}
        maxWidth={width - 0.02}
        maxLines={1}
      >
        {`> ${query}_`}
      </WindfoilText>

      <WindfoilText
        font={FONT.mono}
        fontSize={TYPE.body}
        color={phase === 'error' ? rgba(ARC.red) : rgba(ARC.green, 0.85)}
        position={[0, -0.105, 0]}
        maxWidth={width}
        maxLines={5}
        lineHeight={1.32}
      >
        {answer ||
          (phase === 'thinking'
            ? '…'
            : 'ASK THE SHIP MIND ABOUT THE ARCHIVE.\nIT ANSWERS FROM THE RECORDS, WITH SOURCES.')}
      </WindfoilText>

      {sources.length > 0 && (
        <group position={[0, -(SCREEN_H - 0.115), 0]}>
          <WindfoilText font={FONT.mono} fontSize={TYPE.micro} color={rgba(ARC.greenDim)}>
            SOURCES:
          </WindfoilText>
          {sources.map((s, i) => (
            <group key={String(s.slug ?? i)} position={[0.07 + i * ((width - 0.07) / 3), 0, 0]}>
              <mesh
                position={[(width - 0.09) / 6 - 0.01, -0.002, -0.0005]}
                onPointerDown={(e) => {
                  stopLook(e)
                  const modal = sourceModal(s)
                  if (modal) openModal(router, modal)
                }}
              >
                <planeGeometry args={[(width - 0.09) / 3 - 0.008, 0.026]} />
                <meshBasicMaterial color={ARC.greenFaint} transparent opacity={0.8} />
              </mesh>
              <WindfoilText
                font={FONT.mono}
                fontSize={TYPE.micro}
                color={rgba(ARC.amber)}
                maxWidth={(width - 0.09) / 3 - 0.016}
                maxLines={1}
                position={[0.004, -0.006, 0.0002]}
              >
                {String(s.title ?? s.slug ?? '?').toUpperCase()}
              </WindfoilText>
            </group>
          ))}
        </group>
      )}
      <ScreenHints text="TYPE QUESTION · ENTER TRANSMIT" width={width} />
    </group>
  )
}
