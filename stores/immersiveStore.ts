// Global state for the immersive 360 app: boot lifecycle, dock, modals, worlds, quality.
// URL deep-links are synced by ImmersiveApp (router events -> store; dock actions -> router).

import { create } from 'zustand'
import { DEFAULT_WORLD_ID, worldById } from '@/lib/immersive/worlds'

/** localStorage key holding the last world the visitor chose. */
export const WORLD_STORAGE_KEY = 'arc.world'

/** The persisted world id, if storage is readable and the id is still in the registry.
 *  Storage can throw outright (private windows, blocked site data), so every access is guarded. */
export function storedWorld(): string | undefined {
  try {
    const id = window.localStorage.getItem(WORLD_STORAGE_KEY)
    return id && worldById(id).id === id ? id : undefined
  } catch {
    return undefined
  }
}

function persistWorld(id: string): void {
  try {
    window.localStorage.setItem(WORLD_STORAGE_KEY, id)
  } catch {
    /* storage unavailable — the choice just lasts for this visit */
  }
}

export type BootPhase =
  | 'checking' // probing WebGPU support
  | 'unsupported' // no adapter — terminal fallback owns the page
  | 'booting' // CRT boot sequence over the loading scene
  | 'ready' // scene live, dock powered
  | 'lost' // GPU device lost mid-session (driver reset, OOM) — reconnect prompt owns the page

export type DockTab = 'archive' | 'search' | 'ship' | 'worlds' | 'data' | 'game'

export type ImmersiveModal =
  | { type: 'article'; slug: string }
  | { type: 'video'; slug: string }
  | { type: 'collection'; hub: string }
  | { type: 'data'; panel: 'about' | 'work' | 'pitch' }
  | null

export type QualityTier = 'low' | 'high'

interface ImmersiveState {
  bootPhase: BootPhase
  setBootPhase: (p: BootPhase) => void

  /** First panorama texture decoded and live. */
  sceneReady: boolean
  setSceneReady: (v: boolean) => void

  /** GPU render pipelines precompiled (renderer.compileAsync) — gates boot to avoid a
   *  first-frame hitch when the CRT overlay lifts. See scene/ShaderWarmup.tsx. */
  shadersWarm: boolean
  setShadersWarm: (v: boolean) => void

  dockOpen: boolean
  dockTab: DockTab
  setDockOpen: (open: boolean) => void
  setDockTab: (tab: DockTab) => void

  modal: ImmersiveModal
  /** Set by ImmersiveApp's router sync; components open modals through navigation helpers. */
  setModal: (m: ImmersiveModal) => void

  worldId: string
  /** Switch worlds; the choice persists to localStorage for the next visit. */
  setWorld: (id: string) => void

  quality: QualityTier
  setQuality: (q: QualityTier) => void

  /** Sphere Hunter session (dock GAME tab launches it; HUD lives in-scene). */
  gameActive: boolean
  setGameActive: (v: boolean) => void

  reducedMotion: boolean
  setReducedMotion: (v: boolean) => void
}

export const useImmersiveStore = create<ImmersiveState>((set) => ({
  bootPhase: 'checking',
  setBootPhase: (bootPhase) => set({ bootPhase }),

  sceneReady: false,
  setSceneReady: (sceneReady) => set({ sceneReady }),

  shadersWarm: false,
  setShadersWarm: (shadersWarm) => set({ shadersWarm }),

  dockOpen: false,
  dockTab: 'archive',
  setDockOpen: (dockOpen) => set({ dockOpen }),
  setDockTab: (dockTab) => set({ dockTab, dockOpen: true }),

  modal: null,
  setModal: (modal) => set({ modal }),

  worldId: DEFAULT_WORLD_ID,
  setWorld: (worldId) => {
    set({ worldId })
    persistWorld(worldId)
  },

  quality: 'high',
  setQuality: (quality) => set({ quality }),

  gameActive: false,
  setGameActive: (gameActive) => set({ gameActive }),

  reducedMotion: false,
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}))
