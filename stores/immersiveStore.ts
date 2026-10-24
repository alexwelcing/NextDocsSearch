// Global state for the immersive 360 app: boot lifecycle, dock, modals, worlds, quality.
// URL deep-links are synced by ImmersiveApp (router events -> store; dock actions -> router).

import { create } from 'zustand'

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

  /** GPU render pipelines prebuilt (stand-ins drawn under the overlay) — gates boot to avoid a
   *  first-frame hitch when the CRT overlay lifts. See scene/WarmupRig.tsx. */
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

  worldId: 'the-stacks',
  setWorld: (worldId) => set({ worldId }),

  quality: 'high',
  setQuality: (quality) => set({ quality }),

  gameActive: false,
  setGameActive: (gameActive) => set({ gameActive }),

  reducedMotion: false,
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}))
