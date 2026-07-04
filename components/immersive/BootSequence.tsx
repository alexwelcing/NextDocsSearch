// CRT boot sequence: a diegetic loader that plays over the scene while critical assets stream in.
// Lines type on with staggered delays; the PANORAMA BUS gauge tracks sceneReady; a final flash
// hands off to the live scene. Click/Enter skips once assets are ready.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useImmersiveStore } from '@/stores/immersiveStore'

interface BootLine {
  text: string
  /** ms after the previous line */
  delay: number
  /** typed character-by-character */
  typed?: boolean
}

const BOOT_LINES: BootLine[] = [
  { text: 'WELCING SYSTEMS UNIFIED ARCHIVE LOADER', delay: 300 },
  { text: 'COPYRIGHT 2019-2126 WELCING SYSTEMS', delay: 120 },
  { text: 'ARC TERMINAL — ARCHIVE RETRIEVAL CONSOLE MK.III', delay: 160 },
  { text: '', delay: 200 },
  { text: 'ROM CHECK ................ OK', delay: 260 },
  { text: 'PHOSPHOR ARRAY ........... OK', delay: 180 },
  { text: 'WINDFOIL TEXT ENGINE ..... OK', delay: 200 },
  { text: '> mount /dev/archive', delay: 320, typed: true },
  { text: '330+ RECORDS INDEXED', delay: 240 },
  { text: '> exec arc.sys --immersive', delay: 300, typed: true },
]

const TYPE_MS = 22

export function BootSequence() {
  const sceneReady = useImmersiveStore((s) => s.sceneReady)
  const reducedMotion = useImmersiveStore((s) => s.reducedMotion)
  const setBootPhase = useImmersiveStore((s) => s.setBootPhase)

  const [visibleLines, setVisibleLines] = useState(0)
  const [typedChars, setTypedChars] = useState(0)
  const [gauge, setGauge] = useState(0)
  const [flash, setFlash] = useState(false)
  const doneRef = useRef(false)

  const linesDone = visibleLines >= BOOT_LINES.length

  // Line scheduler (typed lines advance char-by-char).
  useEffect(() => {
    if (reducedMotion) {
      setVisibleLines(BOOT_LINES.length)
      return
    }
    if (linesDone) return
    const line = BOOT_LINES[visibleLines]
    if (line.typed && typedChars < line.text.length) {
      const t = setTimeout(() => setTypedChars((c) => c + 1), TYPE_MS)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setVisibleLines((n) => n + 1)
      setTypedChars(0)
    }, line.delay)
    return () => clearTimeout(t)
  }, [visibleLines, typedChars, linesDone, reducedMotion])

  // Panorama gauge: creeps to 90% on its own, snaps to 100% when the scene is ready.
  useEffect(() => {
    const iv = setInterval(() => {
      setGauge((g) => {
        if (sceneReady) return 1
        return Math.min(g + 0.06 * Math.random(), 0.9)
      })
    }, 160)
    return () => clearInterval(iv)
  }, [sceneReady])

  const finish = useMemo(
    () => () => {
      if (doneRef.current) return
      doneRef.current = true
      setFlash(true)
      setTimeout(() => setBootPhase('ready'), reducedMotion ? 60 : 420)
    },
    [setBootPhase, reducedMotion]
  )

  // Auto-finish shortly after everything is in.
  useEffect(() => {
    if (linesDone && sceneReady && gauge >= 1) {
      const t = setTimeout(finish, reducedMotion ? 50 : 650)
      return () => clearTimeout(t)
    }
  }, [linesDone, sceneReady, gauge, finish, reducedMotion])

  // Skip on input once assets are ready.
  useEffect(() => {
    const skip = () => {
      if (sceneReady) finish()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') skip()
    }
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', onKey)
    }
  }, [sceneReady, finish])

  const gaugeCells = 24
  const filled = Math.round(gauge * gaugeCells)

  return (
    <div className={`arc-boot ${flash ? 'arc-boot--flash' : ''}`} role="status" aria-live="polite">
      <div className="arc-boot__inner">
        {BOOT_LINES.slice(0, Math.min(visibleLines + 1, BOOT_LINES.length)).map((line, i) => {
          const isCurrent = i === visibleLines
          const text =
            isCurrent && line.typed ? line.text.slice(0, typedChars) : isCurrent ? '' : line.text
          return (
            <div key={i} className="arc-boot__line">
              {text}
              {isCurrent && !linesDone && <span className="arc-boot__cursor">▮</span>}
            </div>
          )
        })}
        <div className="arc-boot__line">
          PANORAMA BUS ....... [{'▓'.repeat(filled)}{'░'.repeat(gaugeCells - filled)}]{' '}
          {Math.round(gauge * 100)}%
        </div>
        {linesDone && sceneReady && (
          <div className="arc-boot__line arc-boot__hint">— PRESS ANY KEY —</div>
        )}
      </div>
      <div className="arc-crt-overlay" aria-hidden />
    </div>
  )
}
