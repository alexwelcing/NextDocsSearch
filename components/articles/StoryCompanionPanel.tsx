import type { StoryCompanionData } from '@/lib/articles/storyCompanion'

interface StoryCompanionPanelProps {
  data: StoryCompanionData
  disabled?: boolean
  onPromptSelect: (prompt: string) => void
}

export default function StoryCompanionPanel({
  data,
  disabled = false,
  onPromptSelect,
}: StoryCompanionPanelProps) {
  return (
    <section className="space-y-4 rounded-[24px] border border-fuchsia-400/14 bg-[radial-gradient(circle_at_top_left,rgba(130,42,157,0.18),transparent_38%),linear-gradient(135deg,rgba(15,12,30,0.96),rgba(6,9,18,0.92))] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-fuchsia-200/70">Story companion</div>
          <div className="text-sm text-slate-300">Turn this fiction piece into a map, sequel, fork, or pressure test.</div>
        </div>
        <div className="rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-fuchsia-100">
          Fiction mode
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-3 rounded-[20px] border border-white/8 bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-fuchsia-200/70">Premise</div>
          <div className="text-sm leading-6 text-white">{data.premise}</div>
          <div className="text-xs leading-5 text-slate-400">{data.worldHook}</div>
        </div>

        <div className="space-y-3 rounded-[20px] border border-white/8 bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-fuchsia-200/70">Motifs</div>
          <div className="flex flex-wrap gap-2">
            {data.motifs.length > 0 ? (
              data.motifs.map((motif) => (
                <span
                  key={motif}
                  className="rounded-full border border-fuchsia-300/18 bg-fuchsia-400/8 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-fuchsia-50"
                >
                  {motif}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">No frontmatter motifs available yet.</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.16em] text-fuchsia-200/70">Story beats</div>
        <div className="grid gap-3 md:grid-cols-2">
          {data.beats.map((beat) => (
            <button
              key={beat.id}
              type="button"
              onClick={() => onPromptSelect(beat.prompt)}
              disabled={disabled}
              className="rounded-[20px] border border-white/8 bg-white/5 p-4 text-left transition-colors hover:border-fuchsia-300/30 hover:bg-fuchsia-400/8 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-fuchsia-200/75">{beat.title}</div>
              <div className="text-sm leading-6 text-slate-200">{beat.detail}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.16em] text-fuchsia-200/70">Ask Ship to play with it</div>
        <div className="flex flex-wrap gap-2">
          {data.prompts.map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              onClick={() => onPromptSelect(prompt.prompt)}
              disabled={disabled}
              className="rounded-full border border-fuchsia-300/18 bg-fuchsia-400/10 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-fuchsia-50 transition-colors hover:border-fuchsia-200/35 hover:bg-fuchsia-300/18 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {prompt.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}