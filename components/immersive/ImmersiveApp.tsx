// Orchestrator for the immersive 360 app: probes WebGPU, runs the boot sequence, mounts the
// canvas, and keeps the URL and store in sync (deep links <-> modals/dock). Rendered once from
// _app.tsx so the scene persists across route changes.

import { Component, type ReactNode, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { routeToState } from '@/lib/immersive/navigation'
import { loadFontAtlas } from '@/lib/windfoil/atlas'
import { loadArchive } from '@/lib/immersive/archive'
import { BootSequence } from './BootSequence'
import { TerminalFallback } from './TerminalFallback'

const ImmersiveCanvas = dynamic(() => import('./ImmersiveCanvas'), { ssr: false })

// navigator.gpu existing does not guarantee a working adapter (blocklisted GPUs, headless,
// remote sessions). If the renderer's init throws inside the canvas tree, downgrade to the
// compatibility feed instead of a dead black viewport.
class CanvasFailureBoundary extends Component<
  { onFailure: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error('[arc] renderer failed, dropping to compatibility mode:', error)
    this.props.onFailure()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function ImmersiveApp() {
  const bootPhase = useImmersiveStore((s) => s.bootPhase)
  const setBootPhase = useImmersiveStore((s) => s.setBootPhase)
  const setReducedMotion = useImmersiveStore((s) => s.setReducedMotion)
  const setQuality = useImmersiveStore((s) => s.setQuality)
  const setModal = useImmersiveStore((s) => s.setModal)
  const setDockTab = useImmersiveStore((s) => s.setDockTab)
  const router = useRouter()

  // WebGPU gate. Deliberately no requestAdapter probe here: a probe adapter that never creates a
  // device can cause the browser to reclaim the GPU instance and kill the renderer's real device
  // (observed on SwiftShader). navigator.gpu decides the gate; the renderer's own init is the
  // authoritative probe, and its failure downgrades to the fallback (see ImmersiveCanvas onError).
  useEffect(() => {
    const gpu = (navigator as Navigator & { gpu?: unknown }).gpu
    setBootPhase(gpu ? 'booting' : 'unsupported')
    if (gpu) {
      // Warm the critical caches behind the boot sequence so the dock and reader open instantly.
      const swallow = () => undefined
      loadFontAtlas('vt323').catch(swallow)
      loadFontAtlas('share-tech-mono').catch(swallow)
      loadArchive().catch(swallow)
    }
  }, [setBootPhase])

  // Reduced motion + coarse quality heuristics.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReducedMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    const mobile = window.matchMedia('(max-width: 768px)').matches
    const smallHeap = (navigator as { deviceMemory?: number }).deviceMemory
    if (mobile || (smallHeap !== undefined && smallHeap <= 4)) setQuality('low')
    return () => mq.removeEventListener('change', apply)
  }, [setReducedMotion, setQuality])

  // URL -> store sync (deep links, back/forward).
  useEffect(() => {
    const apply = (url: string) => {
      const state = routeToState(url)
      setModal(state.modal)
      if (state.dockTab) setDockTab(state.dockTab)
    }
    apply(router.asPath)
    router.events.on('routeChangeComplete', apply)
    return () => router.events.off('routeChangeComplete', apply)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.events, setModal, setDockTab])

  // Scene active: lock page scroll and hide the SEO layer (crawlers without WebGPU never get here,
  // so the server-rendered content stays their whole page).
  useEffect(() => {
    const active = bootPhase === 'booting' || bootPhase === 'ready'
    document.documentElement.classList.toggle('arc-active', active)
    return () => document.documentElement.classList.remove('arc-active')
  }, [bootPhase])

  if (bootPhase === 'unsupported') return <TerminalFallback />
  if (bootPhase === 'checking') return <div className="arc-checking" aria-hidden />

  return (
    <>
      <CanvasFailureBoundary onFailure={() => setBootPhase('unsupported')}>
        <ImmersiveCanvas />
      </CanvasFailureBoundary>
      {bootPhase === 'booting' && <BootSequence />}
    </>
  )
}
