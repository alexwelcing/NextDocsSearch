import { describe, expect, it, vi } from 'vitest'
import { BOOT_WATCHDOG_MS, bootSkippable, recordsText, retryOnce } from './boot'

describe('retryOnce', () => {
  const noWait = vi.fn(() => Promise.resolve())

  it('returns the first success without retrying or waiting', async () => {
    const load = vi.fn(() => Promise.resolve('tex'))
    const onRetry = vi.fn()
    const wait = vi.fn(() => Promise.resolve())
    await expect(retryOnce(load, { delayMs: 800, onRetry, wait })).resolves.toBe('tex')
    expect(load).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
    expect(wait).not.toHaveBeenCalled()
  })

  it('retries exactly once after the delay and returns the retry result', async () => {
    const first = new Error('aborted')
    const load = vi.fn().mockRejectedValueOnce(first).mockResolvedValueOnce('tex')
    const onRetry = vi.fn()
    const wait = vi.fn(() => Promise.resolve())
    await expect(retryOnce(load, { delayMs: 800, onRetry, wait })).resolves.toBe('tex')
    expect(load).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledWith(first)
    expect(wait).toHaveBeenCalledWith(800)
  })

  it('gives up after the second failure with that failure', async () => {
    const second = new Error('404')
    const load = vi.fn().mockRejectedValueOnce(new Error('aborted')).mockRejectedValueOnce(second)
    await expect(retryOnce(load, { delayMs: 800, wait: noWait })).rejects.toBe(second)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('waits on a real timer by default', async () => {
    vi.useFakeTimers()
    try {
      const load = vi.fn().mockRejectedValueOnce(new Error('blip')).mockResolvedValueOnce('tex')
      const result = retryOnce(load, { delayMs: 800 })
      await vi.advanceTimersByTimeAsync(799)
      expect(load).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      await expect(result).resolves.toBe('tex')
      expect(load).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('recordsText', () => {
  it('shows a loading line until the index arrives', () => {
    expect(recordsText(null)).toBe('INDEXING RECORDS …')
  })

  it('defers instead of inventing a count when the fetch failed', () => {
    expect(recordsText(-1)).toBe('RECORD INDEX DEFERRED')
  })

  it('shows the live count', () => {
    expect(recordsText(327)).toBe('327 RECORDS INDEXED')
    expect(recordsText(0)).toBe('0 RECORDS INDEXED')
  })
})

describe('bootSkippable', () => {
  const none = { sceneReady: false, shadersWarm: false, watchdogFired: false }

  it('stays locked until both the panorama and the pipelines are in', () => {
    expect(bootSkippable(none)).toBe(false)
    expect(bootSkippable({ ...none, sceneReady: true })).toBe(false)
    expect(bootSkippable({ ...none, shadersWarm: true })).toBe(false)
    expect(bootSkippable({ ...none, sceneReady: true, shadersWarm: true })).toBe(true)
  })

  it('unlocks on the watchdog whatever is still outstanding', () => {
    expect(bootSkippable({ ...none, watchdogFired: true })).toBe(true)
    expect(bootSkippable({ ...none, sceneReady: true, watchdogFired: true })).toBe(true)
  })

  it('fires the watchdog at 8 s', () => {
    expect(BOOT_WATCHDOG_MS).toBe(8000)
  })
})
