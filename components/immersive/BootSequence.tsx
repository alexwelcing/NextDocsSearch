// CRT boot sequence: a diegetic loader that plays over the scene while critical assets stream in
// AND the GPU render pipelines precompile (see scene/ShaderWarmup.tsx) — so the flash reveal
// never pays a visible shader-compile hitch. Lines type on with staggered delays; the PANORAMA
// BUS gauge, PIPELINE CACHE and record-count lines track real async state. Click/Enter skips once
// both are in — or after a watchdog, so a stalled asset can never trap the visitor here.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { loadArchive } from '@/lib/immersive/archive'

interface BootLine {
  text: string
  /** ms after the previous line */
  delay: number
  /** typed character-by-character */
  typed?: boolean
}

/** Placeholder line swapped for the live archive count at render. */
const RECORDS_LINE = '{records}'

const BOOT_LINES: BootLine[] = [
  { text: 'WELCING SYSTEMS UNIFIED ARCHIVE LOADER', delay: 300 },
  { text: 'COPYRIGHT 2019-2126 WELCING SYSTEMS', delay: 120 },
  { text: 'ARC TERMINAL — ARCHIVE RETRIEVAL CONSOLE MK.III', delay: 160 },
  { text: '', delay: 200 },
  { text: 'ROM CHECK ................ OK', delay: 260 },
  { text: 'PHOSPHOR ARRAY ........... OK', delay: 180 },
  { text: 'WINDFOIL TEXT ENGINE ..... OK', delay: 200 },
  { text: '> mount /dev/archive', delay: 320, typed: true },
  { text: RECORDS_LINE, delay: 240 },
  { text: '> exec arc.sys --immersive', delay: 300, typed: true },
]

const TYPE_MS = 22
/** Skip unlocks after this long even if the panorama or pipelines never report in. */
const WATCHDOG_MS = 8000

/** null = still loading, -1 = the index fetch failed. */
function recordsText(count: number | null): string {
  if (count === null) return 'INDEXING RECORDS …'
  if (count < 0) return 'RECORD INDEX DEFERRED'
  return `${count} RECORDS INDEXED`
}

export function BootSequence() {
  const sceneReady = useImmersiveStore((s) => s.sceneReady)
  const shadersWarm = useImmersiveStore((s) => s.shadersWarm)
  const reducedMotion = useImmersiveStore((s) => s.reducedMotion)
  const setBootPhase = useImmersiveStore((s) => s.setBootPhase)

  // Both the panorama texture and the GPU render pipelines (windfoil text, CRT overlays, the
  // panorama material) need to be in before the reveal, or the flash covers for a texture load
  // but not a shader-compile hitch.
  const assetsReady = sceneReady && shadersWarm

  const [visibleLines, setVisibleLines] = useState(0)
  const [typedChars, setTypedChars] = useState(0)
  const [gauge, setGauge] = useState(0)
  const [flash, setFlash] = useState(false)
  const [watchdog, setWatchdog] = useState(false)
  const [records, setRecords] = useState<number | null>(null)
  const doneRef = useRef(false)

  const linesDone = visibleLines >= BOOT_LINES.length
  const canSkip = assetsReady || watchdog
  // Read by the input listener: set during render, so a key pressed the moment the hint paints
  // is honoured (an effect-bound closure would lag a frame behind it).
  const canSkipRef = useRef(canSkip)
  canSkipRef.current = canSkip

  // Watchdog: a hung panorama or pipeline compile must not hold the overlay forever.
  useEffect(() => {
    const t = setTimeout(() => setWatchdog(true), WATCHDOG_MS)
    return () => clearTimeout(t)
  }, [])

  // Live record count (ImmersiveApp already started this fetch; the promise is shared).
  useEffect(() => {
    let live = true
    loadArchive().then(
      (r) => live && setRecords(r.length),
      () => live && setRecords(-1)
    )
    return () => {
      live = false
    }
  }, [])

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

  // Panorama gauge: creeps to 90% on its own, snaps to 100% once everything is actually in.
  useEffect(() => {
    const iv = setInterval(() => {
      setGauge((g) => {
        if (assetsReady) return 1
        return Math.min(g + 0.06 * Math.random(), 0.9)
      })
    }, 160)
    return () => clearInterval(iv)
  }, [assetsReady])

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
    if (linesDone && assetsReady && gauge >= 1) {
      const t = setTimeout(finish, reducedMotion ? 50 : 650)
      return () => clearTimeout(t)
    }
  }, [linesDone, assetsReady, gauge, finish, reducedMotion])

  // Skip on input once assets are ready (or the watchdog has fired).
  useEffect(() => {
    const skip = () => {
      if (canSkipRef.current) finish()
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
  }, [finish])

  const gaugeCells = 24
  const filled = Math.round(gauge * gaugeCells)

  return (
    <div className={`arc-boot ${flash ? 'arc-boot--flash' : ''}`} role="status" aria-live="polite">
      <div className="arc-boot__inner">
        {BOOT_LINES.slice(0, Math.min(visibleLines + 1, BOOT_LINES.length)).map((line, i) => {
          const isCurrent = i === visibleLines
          const full = line.text === RECORDS_LINE ? recordsText(records) : line.text
          const text = isCurrent && line.typed ? full.slice(0, typedChars) : isCurrent ? '' : full
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
        {linesDone && (
          <div className="arc-boot__line">
            PIPELINE CACHE ..... {shadersWarm ? 'WARM' : 'COMPILING…'}
          </div>
        )}
        {linesDone && canSkip && (
          <div className="arc-boot__line arc-boot__hint">— PRESS ANY KEY —</div>
        )}
      </div>
      <div className="arc-crt-overlay" aria-hidden />
    </div>
  )
}
