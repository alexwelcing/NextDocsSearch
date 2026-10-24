// Boot-gate helpers: the pieces of the CRT boot sequence that decide whether a visitor can get
// past it. A stalled asset must never strand anyone on the overlay — see BootSequence.tsx and
// scene/PanoramaSphere.tsx.

/** Skip unlocks after this long even if the panorama or pipelines never report in, ms. */
export const BOOT_WATCHDOG_MS = 8000

export interface BootGate {
  /** First panorama texture live — or definitively failed (dark fallback). */
  sceneReady: boolean
  /** GPU render pipelines precompiled. */
  shadersWarm: boolean
  /** BOOT_WATCHDOG_MS has elapsed since the overlay mounted. */
  watchdogFired: boolean
}

/** Whether a key/tap may dismiss the boot overlay: once everything is in, or once the watchdog
 *  says waiting longer would only trap the visitor. */
export function bootSkippable({ sceneReady, shadersWarm, watchdogFired }: BootGate): boolean {
  return (sceneReady && shadersWarm) || watchdogFired
}

/** The record-count boot line. null = the index is still loading; a negative count = the fetch
 *  failed (the dock retries on open, so boot just defers it). */
export function recordsText(count: number | null): string {
  if (count === null) return 'INDEXING RECORDS …'
  if (count < 0) return 'RECORD INDEX DEFERRED'
  return `${count} RECORDS INDEXED`
}

export interface RetryOptions {
  /** Pause before the single retry, ms. */
  delayMs: number
  /** Called with the first failure, before the pause. */
  onRetry?: (err: unknown) => void
  /** Injectable timer (tests). */
  wait?: (ms: number) => Promise<void>
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Run `load`; if it rejects, wait `delayMs` and try exactly once more. A second failure
 *  rejects with that second error. */
export async function retryOnce<T>(
  load: () => Promise<T>,
  { delayMs, onRetry, wait = sleep }: RetryOptions
): Promise<T> {
  try {
    return await load()
  } catch (err) {
    onRetry?.(err)
    await wait(delayMs)
    return load()
  }
}
