// URL <-> immersive-state mapping. Every route is a deep link into the 360 scene: pages
// server-render crawlable HTML, and the client resolves the same URL to a modal/dock state.

import type { NextRouter } from 'next/router'
import type { ImmersiveModal } from '@/stores/immersiveStore'

export const HUB_SLUGS = [
  'agent-futures',
  'emergent-intelligence',
  'speculative-ai',
  'the-interface',
] as const

export interface RouteState {
  modal: ImmersiveModal
  /** Open the dock on this tab (deep link straight into a dock surface). */
  dockTab?: 'archive'
}

/** Resolve a Next.js asPath to immersive UI state. */
export function routeToState(asPath: string): RouteState {
  const path = asPath.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  const seg = path.split('/').filter(Boolean)

  if (seg.length === 2 && seg[0] === 'articles') return { modal: { type: 'article', slug: seg[1] } }
  if (seg.length === 2 && seg[0] === 'videos') return { modal: { type: 'video', slug: seg[1] } }
  if (seg.length === 1 && seg[0] === 'articles') return { modal: null, dockTab: 'archive' }
  if (seg.length === 1 && (HUB_SLUGS as readonly string[]).includes(seg[0])) {
    return { modal: { type: 'collection', hub: seg[0] } }
  }
  if (seg.length === 1 && seg[0] === 'about') return { modal: { type: 'data', panel: 'about' } }
  if (seg.length === 1 && seg[0] === 'current-work') {
    return { modal: { type: 'data', panel: 'work' } }
  }
  if (seg.length === 1 && seg[0] === 'pitch') return { modal: { type: 'data', panel: 'pitch' } }
  return { modal: null }
}

/** The canonical URL for a modal (deep link the dock/modals push when opening content). */
export function stateToRoute(modal: ImmersiveModal): string {
  if (!modal) return '/'
  switch (modal.type) {
    case 'article':
      return `/articles/${modal.slug}`
    case 'video':
      return `/videos/${modal.slug}`
    case 'collection':
      return `/${modal.hub}`
    case 'data':
      return modal.panel === 'about' ? '/about' : modal.panel === 'work' ? '/current-work' : '/pitch'
  }
}

/** Push a modal's canonical URL (ImmersiveApp's route listener then updates the store). */
export function openModal(router: NextRouter, modal: ImmersiveModal): void {
  const target = stateToRoute(modal)
  if (router.asPath.split(/[?#]/)[0] !== target) {
    router.push(target, undefined, { scroll: false }).catch(() => undefined)
  }
}

export function closeModal(router: NextRouter): void {
  router.push('/', undefined, { scroll: false }).catch(() => undefined)
}
