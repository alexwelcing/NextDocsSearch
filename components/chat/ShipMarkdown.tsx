import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ShipMarkdownProps {
  content: string
  compact?: boolean
  className?: string
}

const baseText = 'text-slate-100/88'
const compactSpacing = 'space-y-2 text-[13px] leading-6'
const fullSpacing = 'space-y-3 text-sm leading-7'

export default function ShipMarkdown({ content, compact = false, className }: ShipMarkdownProps) {
  if (!content.trim()) {
    return null
  }

  return (
    <div className={[baseText, compact ? compactSpacing : fullSpacing, className].filter(Boolean).join(' ')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2 className="text-lg font-semibold uppercase tracking-[0.14em] text-cyan-200">{children}</h2>,
          h2: ({ children }) => <h3 className="text-base font-semibold uppercase tracking-[0.12em] text-cyan-100">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-semibold uppercase tracking-[0.1em] text-amber-200">{children}</h4>,
          p: ({ children }) => <p className="text-slate-100/88">{children}</p>,
          ul: ({ children }) => <ul className="space-y-2 pl-4 text-slate-100/80">{children}</ul>,
          ol: ({ children }) => <ol className="space-y-2 pl-4 text-slate-100/80">{children}</ol>,
          li: ({ children }) => <li className="list-disc marker:text-cyan-300">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="text-amber-100/90">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[0.9em] text-cyan-200">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-cyan-400/50 pl-4 text-slate-300">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-cyan-300 underline decoration-cyan-500/40 underline-offset-4" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}