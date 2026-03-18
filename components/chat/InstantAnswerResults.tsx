import Link from 'next/link'
import type { InstantAnswerItem } from '@/lib/chat/shipAnswer'

interface InstantAnswerResultsProps {
  items: InstantAnswerItem[]
  compact?: boolean
  limit?: number
}

export default function InstantAnswerResults({
  items,
  compact = false,
  limit = 5,
}: InstantAnswerResultsProps) {
  const visibleItems = items.slice(0, limit)

  if (visibleItems.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/70">Instant archive hits</div>
          <div className="text-xs text-slate-300/75">Fast-ranked matches while Ship AI builds the fuller answer.</div>
        </div>
        <div className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-cyan-200">
          {visibleItems.length} results
        </div>
      </div>

      <div className={compact ? 'space-y-2' : 'grid gap-3 md:grid-cols-2'}>
        {visibleItems.map((item, index) => (
          <Link
            key={`${item.slug}-${index}`}
            href={`/articles/${item.slug}`}
            className="group rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(17,24,39,0.95),rgba(7,14,26,0.82))] p-3 transition-colors hover:border-cyan-400/35"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-300/65">Rank {index + 1}</div>
                <div className="text-sm font-semibold text-white group-hover:text-cyan-200">{item.title}</div>
              </div>
              <div className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-200">
                {Math.max(1, Math.round(item.score))}
              </div>
            </div>

            {!compact && <p className="mb-2 text-xs leading-5 text-slate-300/80">{item.description}</p>}

            <p className="text-xs leading-5 text-slate-400">{item.snippet}</p>

            {(item.domains.length > 0 || item.articleType) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.articleType && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-200">
                    {item.articleType}
                  </span>
                )}
                {item.domains.slice(0, compact ? 1 : 2).map((domain) => (
                  <span
                    key={domain}
                    className="rounded-full border border-cyan-400/15 bg-cyan-400/8 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-100"
                  >
                    {domain}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}