import { useMemo, useState } from 'react'
import type { ShipStructuredAnswer } from '@/lib/chat/shipAnswer'
import type { StoryCompanionData } from '@/lib/articles/storyCompanion'

interface StoryConstellationPreviewProps {
  structuredAnswer: ShipStructuredAnswer | null
  storyCompanion: StoryCompanionData
  disabled?: boolean
  onPromptSelect: (prompt: string) => void
}

interface PreviewNode {
  id: string
  label: string
  detail: string
  prompt?: string
}

export default function StoryConstellationPreview({
  structuredAnswer,
  storyCompanion,
  disabled = false,
  onPromptSelect,
}: StoryConstellationPreviewProps) {
  const isStoryAnswer = structuredAnswer?.mode === 'story'
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const nodes = useMemo<PreviewNode[]>(() => {
    if (isStoryAnswer && structuredAnswer) {
      return structuredAnswer.diagram.nodes.map((node, index) => ({
        id: node.id,
        label: node.label,
        detail: node.detail,
        prompt: index > 0 ? `/story Expand the ${node.label.toLowerCase()} in "${storyCompanion.title}".` : undefined,
      }))
    }

    return [
      {
        id: 'premise',
        label: 'Premise',
        detail: storyCompanion.premise,
        prompt: `/story Explain the premise of "${storyCompanion.title}" as a live narrative system.`,
      },
      ...storyCompanion.beats.slice(0, 4).map((beat) => ({
        id: beat.id,
        label: beat.title,
        detail: beat.detail,
        prompt: beat.prompt,
      })),
    ]
  }, [isStoryAnswer, storyCompanion, structuredAnswer])

  const selectedNode = nodes.find((node) => node.id === selectedId) || nodes[0]

  return (
    <section className="space-y-4 rounded-[28px] border border-orange-300/14 bg-[radial-gradient(circle_at_top_left,rgba(172,94,33,0.18),transparent_42%),linear-gradient(135deg,rgba(22,14,8,0.97),rgba(7,10,18,0.94))] p-5 shadow-[0_24px_70px_rgba(25,10,4,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-orange-200/70">Story map</div>
          <div className="text-sm text-slate-300">
            {isStoryAnswer ? 'Live narrative structure from the current Ship answer.' : 'A compact preview of the story engine waiting to be activated.'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onPromptSelect(`/story Map the characters, pressures, and turning points in "${storyCompanion.title}" using the story details in this article.`)}
          disabled={disabled}
          className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-orange-50 transition-colors hover:border-orange-200/35 hover:bg-orange-300/18 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isStoryAnswer ? 'Refresh story map' : 'Launch story map'}
        </button>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="relative flex min-w-[720px] items-center justify-between gap-4 px-2 py-4">
          <div className="pointer-events-none absolute left-[7%] right-[7%] top-1/2 h-px -translate-y-1/2 bg-[linear-gradient(90deg,rgba(255,153,85,0.12),rgba(255,183,120,0.5),rgba(255,153,85,0.12))]" />
          {nodes.map((node, index) => {
            const active = selectedNode.id === node.id
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => {
                  setSelectedId(node.id)
                  if (node.prompt) {
                    onPromptSelect(node.prompt)
                  }
                }}
                disabled={disabled}
                className="relative z-10 flex flex-1 min-w-[120px] flex-col items-center gap-2 disabled:cursor-not-allowed"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-full border text-[10px] uppercase tracking-[0.14em] transition-all ${active ? 'border-orange-200 bg-orange-300/22 text-white shadow-[0_0_30px_rgba(255,153,85,0.28)]' : 'border-orange-300/20 bg-[#1b120c] text-orange-100/85'}`}>
                  {index + 1}
                </div>
                <div className={`max-w-[130px] text-center text-[11px] uppercase tracking-[0.14em] ${active ? 'text-orange-50' : 'text-slate-400'}`}>
                  {node.label}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3 rounded-[22px] border border-white/8 bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-orange-200/70">Motifs</div>
          <div className="flex flex-wrap gap-2">
            {storyCompanion.motifs.length > 0 ? storyCompanion.motifs.map((motif) => (
              <span key={motif} className="rounded-full border border-orange-300/18 bg-orange-400/8 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-orange-50">
                {motif}
              </span>
            )) : <span className="text-xs text-slate-500">No motifs available.</span>}
          </div>
        </div>

        <div className="space-y-3 rounded-[22px] border border-white/8 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-orange-200/70">Selected node</div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{selectedNode.label}</div>
          </div>
          <div className="text-sm leading-6 text-white">{selectedNode.detail}</div>
          {structuredAnswer?.summary && (
            <div className="text-xs leading-5 text-slate-400">{structuredAnswer.summary}</div>
          )}
        </div>
      </div>
    </section>
  )
}