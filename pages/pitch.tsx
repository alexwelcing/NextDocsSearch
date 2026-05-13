import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import type { GetStaticProps } from 'next';
import { SITE_URL } from '@/lib/site-url';
import {
  Mail,
  Linkedin,
  Github,
  ArrowRight,
  ExternalLink,
  Wand2,
  Search,
  Box,
  BarChart3,
  Layers,
  FileText,
} from 'lucide-react';

// Swap these slugs to re-curate the "Selected writing" grid.
// Each must exist in lib/generated/article-manifest.json.
const FEATURED_SLUGS = [
  'reproducible-ai-evals-version-control',
  'rag-vector-databases-deep-dive',
  'tech-distributed-tracing-observability',
  'ai-infrastructure-at-scale',
  'mlops-data-pipelines-best-practices',
  'ai-product-strategy-roadmap',
];

const PILLARS: Array<{ icon: keyof typeof ICONS; title: string; body: string }> = [
  {
    icon: 'BarChart3',
    title: 'Evals & quality',
    body: 'Reproducible eval suites, regression gates, and the discipline to ship behind them.',
  },
  {
    icon: 'Search',
    title: 'Retrieval & RAG',
    body: 'Vector search, chunking, recall metrics — the parts of LLM systems that quietly decide outcomes.',
  },
  {
    icon: 'Box',
    title: 'Observability',
    body: 'Tracing, telemetry, and the feedback loops that turn model behavior into product signal.',
  },
  {
    icon: 'Wand2',
    title: 'Product judgment',
    body: 'Translating fuzzy AI capability into roadmaps, runbooks, and risks a team can actually decide on.',
  },
];

const DEMOS: Array<{ href: string; icon: keyof typeof ICONS; title: string; body: string }> = [
  {
    href: '/chat',
    icon: 'Wand2',
    title: 'Talk to Ship AI',
    body: 'Persona-driven chat with memory, streamed responses, and a system prompt that holds.',
  },
  {
    href: '/articles',
    icon: 'Search',
    title: 'Semantic search this site',
    body: 'OpenAI embeddings + Supabase pgvector across 300+ articles, with streaming answers.',
  },
  {
    href: '/',
    icon: 'Box',
    title: 'Step into the 3D scene',
    body: 'React Three Fiber, physics, post-processing — a real-time UI surface, not a screenshot.',
  },
];

const ICONS = {
  BarChart3,
  Search,
  Box,
  Wand2,
  Layers,
  FileText,
};

type ManifestEntry = {
  slug: string;
  title: string;
  description?: string;
  heroImage?: string;
  thumbnail?: string;
  ogImage?: string;
  readingTime?: number | string;
  keywords?: string[];
  domains?: string[];
};

type Props = {
  featured: ManifestEntry[];
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  const manifestPath = path.join(process.cwd(), 'lib', 'generated', 'article-manifest.json');
  let featured: ManifestEntry[] = [];
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const all = JSON.parse(raw) as ManifestEntry[];
    const bySlug = new Map(all.map((a) => [a.slug, a]));
    featured = FEATURED_SLUGS.map((s) => bySlug.get(s)).filter(
      (a): a is ManifestEntry => Boolean(a)
    );
  } catch {
    featured = [];
  }
  return { props: { featured }, revalidate: 60 };
};

export default function Pitch({ featured }: Props) {
  const siteUrl = SITE_URL;

  return (
    <>
      <Head>
        <title>Pitch — Alex Welcing</title>
        <meta
          name="description"
          content="AI product and engineering work — evals, retrieval, observability, and the receipts to back them up."
        />
        <link rel="canonical" href={`${siteUrl}/pitch`} />

        <meta property="og:title" content="Alex Welcing — AI product, evals, retrieval, observability" />
        <meta property="og:description" content="A working demo, not a deck. Explore the AI work and reach out." />
        <meta property="og:image" content={`${siteUrl}/social-preview.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={`${siteUrl}/pitch`} />
        <meta property="og:type" content="profile" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Alex Welcing — AI product, evals, retrieval, observability" />
        <meta name="twitter:description" content="A working demo, not a deck." />
        <meta name="twitter:image" content={`${siteUrl}/social-preview.png`} />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Person',
              name: 'Alex Welcing',
              url: `${siteUrl}/pitch`,
              jobTitle: 'Product Manager',
              sameAs: [
                'https://www.linkedin.com/in/alexwelcing',
                'https://github.com/alexwelcing',
              ],
            }),
          }}
        />
      </Head>

      <div className="min-h-screen bg-slate-950 text-white">
        <nav className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
            <Link
              href="/"
              className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent"
            >
              Alex Welcing
            </Link>
            <div className="flex gap-6 text-sm">
              <Link href="/" className="text-slate-400 hover:text-white transition">
                Portfolio
              </Link>
              <Link href="/articles" className="text-slate-400 hover:text-white transition">
                Writing
              </Link>
              <Link href="/about" className="text-slate-400 hover:text-white transition">
                About
              </Link>
              <Link href="/pitch" className="text-cyan-400 font-medium">
                Pitch
              </Link>
            </div>
          </div>
        </nav>

        <main className="max-w-5xl mx-auto px-6">
          {/* Hero ─────────────────────────────────────────────── */}
          <section className="pt-20 pb-24">
            <p className="text-cyan-400 text-sm tracking-widest uppercase mb-6">
              Open to the next thing
            </p>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
              AI product and engineering,{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                shipped behind evals.
              </span>
            </h1>
            {/* TODO(you): your one-sentence thesis. */}
            <p className="text-xl text-slate-400 max-w-2xl leading-relaxed mb-10">
              A working surface, not a deck. Built with the same primitives the AI
              infra world ships on — retrieval, traces, telemetry, and the patience
              to put a real eval gate in front of them.
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href="mailto:alexwelcing@gmail.com?subject=Hiring%20%E2%80%94%20Alex%20Welcing"
                className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg transition"
              >
                <Mail className="w-4 h-4" />
                Get in touch
              </a>
              <a
                href="https://linkedin.com/in/alexwelcing"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 hover:border-white/40 rounded-lg transition"
              >
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </a>
              <a
                href="https://github.com/alexwelcing"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 hover:border-white/40 rounded-lg transition"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
              <a
                href="/resume.pdf"
                className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 hover:border-white/40 rounded-lg transition"
              >
                <FileText className="w-4 h-4" />
                Resume
              </a>
            </div>
          </section>

          {/* Pillars ──────────────────────────────────────────── */}
          <section className="pb-24">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="w-8 h-px bg-cyan-500" />
                The shape of the work
              </h2>
              <span className="text-xs uppercase tracking-widest text-slate-500">
                Four pillars
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {PILLARS.map(({ icon, title, body }) => {
                const Icon = ICONS[icon] ?? Layers;
                return (
                  <div
                    key={title}
                    className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/40 transition"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <Icon className="w-5 h-5 text-cyan-400" />
                      </div>
                      <h3 className="font-semibold">{title}</h3>
                    </div>
                    <p className="text-slate-400 leading-relaxed">{body}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Live demos ───────────────────────────────────────── */}
          <section className="pb-24">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="w-8 h-px bg-cyan-500" />
                Try it, don&apos;t read about it
              </h2>
              <span className="text-xs uppercase tracking-widest text-slate-500">
                Live on this site
              </span>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {DEMOS.map(({ href, icon, title, body }) => {
                const Icon = ICONS[icon] ?? Wand2;
                return (
                  <Link
                    key={href}
                    href={href}
                    className="group p-6 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-cyan-500/40 transition flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <Icon className="w-5 h-5 text-cyan-400" />
                      </div>
                      <ExternalLink className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition" />
                    </div>
                    <h3 className="font-semibold mb-2">{title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Selected writing ─────────────────────────────────── */}
          <section className="pb-24">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="w-8 h-px bg-cyan-500" />
                Selected writing
              </h2>
              <Link
                href="/articles"
                className="text-sm text-slate-400 hover:text-cyan-400 transition inline-flex items-center gap-1"
              >
                All writing <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {featured.length === 0 ? (
              <p className="text-slate-500 text-sm">
                Article manifest unavailable. Run{' '}
                <code className="px-1 py-0.5 rounded bg-white/5">pnpm build</code> to regenerate{' '}
                <code className="px-1 py-0.5 rounded bg-white/5">
                  lib/generated/article-manifest.json
                </code>
                .
              </p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {featured.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/docs/articles/${a.slug}`}
                    className="group rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-cyan-500/40 transition flex flex-col"
                  >
                    {a.heroImage ? (
                      <div
                        className="aspect-[16/9] bg-slate-900 bg-cover bg-center"
                        style={{ backgroundImage: `url(${a.heroImage})` }}
                        aria-hidden
                      />
                    ) : (
                      <div className="aspect-[16/9] bg-gradient-to-br from-cyan-500/10 to-blue-500/10" />
                    )}
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-semibold text-lg mb-2 group-hover:text-cyan-400 transition">
                        {a.title}
                      </h3>
                      {a.description && (
                        <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">
                          {a.description}
                        </p>
                      )}
                      {(a.readingTime || (a.domains && a.domains.length > 0)) && (
                        <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2 text-xs text-slate-500">
                          {a.readingTime && <span>{a.readingTime} min read</span>}
                          {a.domains?.slice(0, 2).map((d) => (
                            <span key={d} className="px-2 py-0.5 rounded-full bg-white/5">
                              {d}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Receipts ─────────────────────────────────────────── */}
          {/* TODO(you): replace the placeholders with three quantified wins.
              Three lines beats three paragraphs. Delete the section if you'd
              rather skip it for now. */}
          <section className="pb-24">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="w-8 h-px bg-cyan-500" />
                Receipts
              </h2>
              <span className="text-xs uppercase tracking-widest text-slate-500">
                The numbers
              </span>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 border-dashed"
                >
                  <div className="text-3xl font-bold text-cyan-400 mb-2">—</div>
                  <p className="text-sm text-slate-500">Drop a quantified win here.</p>
                </div>
              ))}
            </div>
          </section>

          {/* Closing CTA ──────────────────────────────────────── */}
          <section className="pb-24">
            <div className="p-10 rounded-3xl bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent border border-white/10">
              <h2 className="text-3xl font-bold mb-4">
                Building something where evals and retrieval matter?
              </h2>
              {/* TODO(you): tighten this paragraph — timing, role shape, location. */}
              <p className="text-slate-400 mb-8 max-w-2xl leading-relaxed">
                I&apos;d rather sit with your roadmap for an hour than send a deck. If
                you&apos;re hiring for AI product, applied AI, evals, or platform work
                — let&apos;s talk.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="mailto:alexwelcing@gmail.com?subject=Hiring%20%E2%80%94%20Alex%20Welcing"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg transition"
                >
                  Start a conversation
                  <ArrowRight className="w-5 h-5" />
                </a>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 px-8 py-4 border border-white/20 hover:border-white/40 rounded-lg transition"
                >
                  Full background
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-white/10 py-8">
          <div className="max-w-5xl mx-auto px-6 text-center text-slate-500 text-sm">
            <p>© {new Date().getFullYear()} Alex Welcing. Built with Next.js.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
