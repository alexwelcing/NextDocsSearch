import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORLD_ID } from '@/lib/immersive/worlds'
import { WORLD_STORAGE_KEY, storedWorld, useImmersiveStore } from './immersiveStore'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  }
}

describe('world persistence', () => {
  beforeEach(() => {
    useImmersiveStore.setState({ worldId: DEFAULT_WORLD_ID })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips the chosen world through localStorage', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() })
    expect(storedWorld()).toBeUndefined()
    useImmersiveStore.getState().setWorld('ember')
    expect(useImmersiveStore.getState().worldId).toBe('ember')
    expect(window.localStorage.getItem(WORLD_STORAGE_KEY)).toBe('ember')
    expect(storedWorld()).toBe('ember')
  })

  it('shows an arriving world without replacing the stored choice when persist is false', () => {
    const storage = memoryStorage()
    storage.setItem(WORLD_STORAGE_KEY, 'deep-space')
    vi.stubGlobal('window', { localStorage: storage })
    useImmersiveStore.getState().setWorld('ember', { persist: false })
    expect(useImmersiveStore.getState().worldId).toBe('ember')
    expect(storage.getItem(WORLD_STORAGE_KEY)).toBe('deep-space')
    expect(storedWorld()).toBe('deep-space')
  })

  it('drops a stored id that is no longer in the registry', () => {
    const storage = memoryStorage()
    storage.setItem(WORLD_STORAGE_KEY, 'retired-world')
    vi.stubGlobal('window', { localStorage: storage })
    expect(storedWorld()).toBeUndefined()
  })

  it('survives storage that throws (private mode, blocked site data, SSR)', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    vi.stubGlobal('window', { localStorage: throwing })
    expect(storedWorld()).toBeUndefined()
    expect(() => useImmersiveStore.getState().setWorld('verdant')).not.toThrow()
    expect(useImmersiveStore.getState().worldId).toBe('verdant')

    vi.unstubAllGlobals() // node: no window at all
    expect(storedWorld()).toBeUndefined()
    expect(() => useImmersiveStore.getState().setWorld('atrium')).not.toThrow()
  })
})
