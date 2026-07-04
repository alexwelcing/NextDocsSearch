// Modal dispatcher: renders whichever in-scene surface the current URL resolves to.

import { useImmersiveStore } from '@/stores/immersiveStore'
import { ArticleModal } from './modals/ArticleModal'
import { VideoModal } from './modals/VideoModal'
import { CollectionModal } from './modals/CollectionModal'
import { DataModal } from './modals/DataModal'

export function ImmersiveModals() {
  const modal = useImmersiveStore((s) => s.modal)
  const bootPhase = useImmersiveStore((s) => s.bootPhase)
  if (!modal || bootPhase !== 'ready') return null
  switch (modal.type) {
    case 'article':
      return <ArticleModal slug={modal.slug} />
    case 'video':
      return <VideoModal slug={modal.slug} />
    case 'collection':
      return <CollectionModal hub={modal.hub} />
    case 'data':
      return <DataModal panel={modal.panel} />
  }
}
