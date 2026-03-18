import type { ShipAnswerState } from '@/lib/chat/shipAnswer'
import { motion } from 'framer-motion'
import InstantAnswerResults from './InstantAnswerResults'
import ShipMarkdown from './ShipMarkdown'

interface ShipAnswerPanelProps {
  chatData: Pick<ShipAnswerState, 'question' | 'response' | 'instantResults' | 'structuredAnswer' | 'status'>
  density?: 'full' | 'compact' | 'terminal'
  showQuestion?: boolean
}

function SectionHeader({ label }: { label: string }) {
  return <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/70">{label}</div>
}

const MODE_COPY = {
  default: { label: 'Ship AI', chip: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100' },
  brief: { label: 'Executive Brief', chip: 'border-amber-300/25 bg-amber-400/10 text-amber-100' },
  signal: { label: 'High Signal', chip: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100' },
  map: { label: 'Systems Map', chip: 'border-sky-300/25 bg-sky-400/10 text-sky-100' },
  roast: { label: 'Brutal Critique', chip: 'border-rose-300/25 bg-rose-400/10 text-rose-100' },
  compare: { label: 'Head To Head', chip: 'border-violet-300/25 bg-violet-400/10 text-violet-100' },
  mission: { label: 'Next Move', chip: 'border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-100' },
} as const

const PANEL_VARIANTS = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.28,
      staggerChildren: 0.05,
    },
  },
}

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22 } },
}

function factGridClass(mode: keyof typeof MODE_COPY, density: 'full' | 'compact' | 'terminal') {
  if (density === 'terminal') return 'space-y-2'
  if (mode === 'brief') return 'space-y-2'
  if (mode === 'map') return 'grid gap-3 md:grid-cols-3'
  return 'grid gap-2 md:grid-cols-2'
}

function factCardClass(mode: keyof typeof MODE_COPY, density: 'full' | 'compact' | 'terminal') {
  if (density === 'terminal') {
    return 'border border-[#233423] bg-[#101810] px-3 py-2 text-xs leading-5 text-[#c8f3c8]'
  }
  if (mode === 'roast') {
    return 'rounded-2xl border border-rose-400/18 bg-[linear-gradient(180deg,rgba(96,21,33,0.18),rgba(58,12,24,0.08))] px-4 py-3 text-sm leading-6 text-rose-50'
  }
  if (mode === 'brief') {
    return 'rounded-2xl border border-amber-300/18 bg-[linear-gradient(180deg,rgba(120,86,20,0.16),rgba(55,33,8,0.08))] px-4 py-3 text-sm leading-6 text-amber-50'
  }
  if (mode === 'map') {
    return 'rounded-[22px] border border-sky-400/16 bg-[linear-gradient(180deg,rgba(14,45,78,0.18),rgba(7,20,38,0.08))] px-4 py-3 text-sm leading-6 text-sky-50'
  }
  if (mode === 'mission') {
    return 'rounded-[22px] border border-fuchsia-300/18 bg-[linear-gradient(180deg,rgba(96,25,107,0.18),rgba(37,10,42,0.08))] px-4 py-3 text-sm leading-6 text-fuchsia-50'
  }
  return 'rounded-2xl border border-cyan-400/12 bg-cyan-500/6 px-4 py-3 text-sm leading-6 text-slate-100/90'
}

function sectionGridClass(mode: keyof typeof MODE_COPY) {
  if (mode === 'map') return 'grid gap-3 xl:grid-cols-4'
  if (mode === 'brief') return 'grid gap-3 xl:grid-cols-2'
  return 'grid gap-3 xl:grid-cols-2'
}

function sectionCardClass(mode: keyof typeof MODE_COPY) {
  if (mode === 'map') {
    return 'rounded-[24px] border border-sky-400/14 bg-[linear-gradient(180deg,rgba(14,29,47,0.9),rgba(6,14,24,0.86))] p-4'
  }
  if (mode === 'roast') {
    return 'rounded-2xl border border-rose-400/14 bg-[linear-gradient(180deg,rgba(73,14,26,0.18),rgba(28,8,15,0.08))] p-4'
  }
  if (mode === 'brief') {
    return 'rounded-2xl border border-amber-300/14 bg-[linear-gradient(180deg,rgba(92,68,16,0.18),rgba(29,18,5,0.08))] p-4'
  }
  if (mode === 'mission') {
    return 'rounded-[24px] border border-fuchsia-300/14 bg-[linear-gradient(180deg,rgba(82,20,89,0.18),rgba(28,8,31,0.08))] p-4'
  }
  return 'rounded-2xl border border-white/8 bg-white/5 p-4'
}

function summaryShellClass(mode: keyof typeof MODE_COPY, density: 'full' | 'compact' | 'terminal') {
  if (density === 'terminal') return 'space-y-3 rounded-xl border border-[#223322] bg-[#0f170f] p-3'
  if (mode === 'brief') {
    return 'space-y-4 rounded-[24px] border border-amber-300/16 bg-[linear-gradient(135deg,rgba(70,51,11,0.26),rgba(14,16,28,0.92))] p-5'
  }
  if (mode === 'map') {
    return 'space-y-4 rounded-[26px] border border-sky-400/16 bg-[radial-gradient(circle_at_top_left,rgba(18,68,114,0.24),transparent_48%),linear-gradient(135deg,rgba(8,17,31,0.96),rgba(3,10,20,0.9))] p-5'
  }
  if (mode === 'roast') {
    return 'space-y-4 rounded-[24px] border border-rose-400/16 bg-[linear-gradient(135deg,rgba(65,15,26,0.24),rgba(12,11,19,0.92))] p-5'
  }
  if (mode === 'mission') {
    return 'space-y-4 rounded-[26px] border border-fuchsia-300/16 bg-[radial-gradient(circle_at_top_left,rgba(110,27,118,0.22),transparent_48%),linear-gradient(135deg,rgba(16,10,24,0.96),rgba(5,8,20,0.9))] p-5'
  }
  return 'space-y-4 rounded-[24px] border border-white/10 bg-white/5 p-5'
}

export default function ShipAnswerPanel({
  chatData,
  density = 'full',
  showQuestion = true,
}: ShipAnswerPanelProps) {
  const { question, response, instantResults, structuredAnswer, status } = chatData
  const isCompact = density !== 'full'
  const mode = structuredAnswer?.mode ?? 'default'
  const modeMeta = MODE_COPY[mode]
  const shellClassName = density === 'terminal'
    ? 'space-y-4 rounded-xl border border-[#2b3b2b] bg-[#0b110b] p-4'
    : 'space-y-5 rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,16,28,0.96),rgba(5,10,20,0.88))] p-5 shadow-[0_30px_80px_rgba(2,10,26,0.45)]'

  if (!question && instantResults.length === 0 && !structuredAnswer && !response.trim()) {
    return null
  }

  return (
    <motion.div
      className={shellClassName}
      variants={PANEL_VARIANTS}
      initial="hidden"
      animate="visible"
      key={`${mode}-${density}-${structuredAnswer?.headline || question || 'ship'}`}
    >
      {showQuestion && question && (
        <motion.div className="space-y-2" variants={ITEM_VARIANTS}>
          <SectionHeader label="Current query" />
          <div className={density === 'terminal' ? 'font-mono text-sm text-[#9ff79f]' : 'text-sm text-slate-200'}>
            {question}
          </div>
        </motion.div>
      )}

      <motion.div variants={ITEM_VARIANTS}>
        <InstantAnswerResults items={instantResults} compact={isCompact} limit={density === 'terminal' ? 3 : 5} />
      </motion.div>

      {structuredAnswer && (
        <motion.section className="space-y-4" variants={ITEM_VARIANTS}>
          <motion.div className="flex items-center justify-between gap-3" variants={ITEM_VARIANTS}>
            <SectionHeader label={density === 'terminal' ? 'Tactical summary' : 'Ship AI answer'} />
            {status === 'loading' && (
              <span className="text-[11px] uppercase tracking-[0.16em] text-amber-200/80">Synthesizing</span>
            )}
          </motion.div>

          <motion.div className={summaryShellClass(mode, density)} variants={ITEM_VARIANTS}>
            <div className="flex flex-wrap items-center gap-3">
              <div className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${modeMeta.chip}`}>
                {modeMeta.label}
              </div>
              <div className={density === 'terminal' ? 'text-xs uppercase tracking-[0.14em] text-[#8fa98f]' : 'text-xs uppercase tracking-[0.14em] text-slate-400'}>
                {structuredAnswer.headline}
              </div>
            </div>

            {structuredAnswer.kicker && (
              <div className={density === 'terminal' ? 'font-mono text-xs leading-5 text-[#b5d6b5]' : 'text-sm leading-6 text-slate-300'}>
                {structuredAnswer.kicker}
              </div>
            )}

            <div className={density === 'terminal' ? 'font-mono text-sm leading-6 text-[#d4ffd4]' : 'text-base leading-7 text-white'}>
              {structuredAnswer.summary}
            </div>
          </motion.div>

          {structuredAnswer.quickFacts.length > 0 && (
            <motion.div className="space-y-2" variants={ITEM_VARIANTS}>
              <SectionHeader label={density === 'terminal' ? 'Highlights' : mode === 'brief' ? 'Decision points' : 'Key insights'} />
              <div className={factGridClass(mode, density)}>
                {structuredAnswer.quickFacts.slice(0, density === 'terminal' ? 3 : 4).map((fact, index) => (
                  <motion.div
                    key={`${fact}-${index}`}
                    className={factCardClass(mode, density)}
                    variants={ITEM_VARIANTS}
                  >
                    {mode === 'brief' && density !== 'terminal' ? (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-200/70">{`0${index + 1}`}</div>
                        <div>{fact}</div>
                      </div>
                    ) : fact}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {density !== 'terminal' && structuredAnswer.sections.length > 0 && (
            <motion.div className="space-y-3" variants={ITEM_VARIANTS}>
              <SectionHeader label={mode === 'map' ? 'System lenses' : 'Expanded answer'} />
              <div className={sectionGridClass(mode)}>
                {structuredAnswer.sections.slice(0, density === 'compact' ? 2 : 4).map((section) => (
                  <motion.div
                    key={section.id}
                    className={sectionCardClass(mode)}
                    variants={ITEM_VARIANTS}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-amber-200/75">{section.title}</div>
                      {mode === 'map' && (
                        <div className="rounded-full border border-sky-300/15 bg-sky-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-sky-100">lens</div>
                      )}
                    </div>
                    <ShipMarkdown content={section.body} compact />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {structuredAnswer.suggestedActions.length > 0 && density !== 'terminal' && (
            <motion.div className="space-y-2" variants={ITEM_VARIANTS}>
              <SectionHeader label={mode === 'mission' ? 'Mission actions' : 'Next moves'} />
              <div className={mode === 'mission' ? 'grid gap-3 md:grid-cols-3' : 'flex flex-wrap gap-2'}>
                {structuredAnswer.suggestedActions.slice(0, 3).map((action, index) => (
                  <motion.div
                    key={`${action}-${index}`}
                    className={mode === 'mission'
                      ? 'rounded-[22px] border border-fuchsia-300/18 bg-fuchsia-400/8 px-4 py-4 text-sm leading-6 text-fuchsia-50'
                      : 'rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100'}
                    variants={ITEM_VARIANTS}
                  >
                    {mode === 'mission' ? `${index + 1}. ${action}` : action}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.section>
      )}

      {!structuredAnswer && response.trim() && (
        <motion.section className="space-y-2" variants={ITEM_VARIANTS}>
          <SectionHeader label="Ship AI answer" />
          <ShipMarkdown content={response} compact={density !== 'full'} />
        </motion.section>
      )}
    </motion.div>
  )
}