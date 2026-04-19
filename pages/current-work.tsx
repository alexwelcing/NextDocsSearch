import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { SITE_URL } from '@/lib/site-url';
import {
  ArrowRight,
  Mail,
  Linkedin,
  Github,
  Building2,
} from 'lucide-react';

export default function CurrentWork() {
  const siteUrl = SITE_URL;
  const description =
    'Four research areas: coordination across model providers, agent authentication and security, UX development with AI, and materials science and molecular dynamics.';

  return (
    <>
      <Head>
        <title>Work — Alex Welcing</title>
        <meta name="description" content={description} />
        <meta name="keywords" content="Alex Welcing, work, multi-provider agents, agent authentication, AI UX, materials science, molecular dynamics, glimPSE, lupine" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${siteUrl}/current-work`} />

        {/* Open Graph */}
        <meta property="og:title" content="Work — Alex Welcing" />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={`${siteUrl}/social-preview.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={`${siteUrl}/current-work`} />
        <meta property="og:type" content="profile" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Work — Alex Welcing" />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={`${siteUrl}/social-preview.png`} />

        {/* Profile Structured Data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            "mainEntity": {
              "@type": "Person",
              "name": "Alex Welcing",
              "description": description,
              "url": siteUrl,
              "sameAs": [
                "https://www.linkedin.com/in/alexwelcing",
                "https://github.com/alexwelcing",
                "https://x.com/alexwelcing"
              ],
              "knowsAbout": [
                "Large Language Models",
                "AI Product Management",
                "Agent Systems",
                "Enterprise AI Strategy",
                "Regulated AI",
                "Legal Technology",
                "AI Governance"
              ]
            }
          })
        }} />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        {/* Navigation */}
        <nav className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Alex Welcing
            </Link>
            <div className="flex gap-6 text-sm">
              <Link href="/" className="text-slate-400 hover:text-white transition">Portfolio</Link>
              <Link href="/articles" className="text-slate-400 hover:text-white transition">Writing</Link>
              <Link href="/about" className="text-slate-400 hover:text-white transition">About</Link>
              <Link href="/current-work" className="text-cyan-400 font-medium">Current Work</Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-6 py-20 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm mb-8">
              <Building2 className="w-4 h-4" />
              Currently Building
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Work
            </h1>

            <p className="text-xl md:text-2xl text-slate-400 mb-8 leading-relaxed">
              Four threads, one shared premise: the interesting problems in AI
              right now aren&apos;t inside the model — they&apos;re in the coordination
              layer around it. Between providers. Between the agent and the person
              authorizing it. Between the model&apos;s confidence and the human&apos;s
              trust. Between the simulation and the experiment. The gap between
              what a model can do and what it can do <em>for you</em> is where I
              spend my time.
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href="mailto:alexwelcing@gmail.com"
                className="inline-flex items-center gap-2 px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg transition"
              >
                <Mail className="w-5 h-5" />
                Get in Touch
              </a>
              <Link
                href="/articles"
                className="inline-flex items-center gap-2 px-8 py-4 border border-white/20 hover:border-white/40 rounded-lg transition"
              >
                Read My Research
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Section 1 — Coordination */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold mb-6">Coordination across model providers for long-running research</h2>
            <div className="space-y-6 text-slate-300 text-lg leading-relaxed">
              <p>
                No single model provider runs a 48-hour research job well. Claude
                has the reasoning, Gemini has the context window, local models have
                the rate-limit headroom, a specialized model has the domain
                knowledge. The actual research workflow inevitably crosses
                provider boundaries, and every crossing today is a manual
                handoff — copy a transcript, paste it into the next interface,
                re-explain the goal, hope the next model catches the thread.
              </p>
              <p>
                The Hermitage is my attempt to do that coordination
                programmatically. A dedicated VM running an Agent Manager UI
                that dispatches tasks to Claude, Gemini, and local models based
                on which one is best for the subtask, and a Covenant dashboard
                that tracks which agent is holding which piece of state.
                It&apos;s a crude first draft of something that, done right,
                would be worth the whole current model-wrapper app category put
                together.
              </p>
              <p>
                The interesting technical question isn&apos;t &ldquo;which model
                is smartest.&rdquo; It&apos;s: how does state — memory, open
                questions, partial conclusions, sources, corrections — survive
                a handoff between providers that don&apos;t know about each
                other? Whoever builds that layer cleanly gets to run research
                jobs the scale of a small lab out of a single laptop.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2 — Auth and security */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold mb-6">User and agent authentication and security</h2>
            <div className="space-y-6 text-slate-300 text-lg leading-relaxed">
              <p>
                Existing auth was built assuming a human is at the endpoint.
                OAuth screens, SMS 2FA, &ldquo;click approve on your
                phone&rdquo; — the consent ceremony is sized to match a single
                human action. Agents break that in both directions: they need
                credentials to do useful work, and they need to prove to third
                parties that they&apos;re acting inside a scope the user
                authorized.
              </p>
              <p>
                My first startup, LBR, was identity and access work. The
                problems I hit with agents now are the same category, one
                abstraction layer up. I run my personal agents on a Compute
                Engine VM via Chrome Remote Desktop specifically to sidestep
                credential delegation — the agent acts through my actual
                logged-in browser, so there&apos;s no &ldquo;give Claude my API
                token&rdquo; moment. That&apos;s not a solution; it&apos;s
                evidence that the tooling is bad enough that operating a remote
                desktop is the least-bad available option.
              </p>
              <p>
                What I&apos;m watching for: scoped, revocable, time-bounded
                credentials built for agents instead of humans. Tokens that say
                &ldquo;this agent can read my Gmail for the next 4 hours,
                cannot send, cannot delete, and emits an audit trail I can
                review.&rdquo; That primitive doesn&apos;t exist yet, and
                it&apos;s the thing that unlocks everything downstream —
                agent-to-agent delegation, marketplaces, third-party agent
                integrations — without the whole system collapsing into a
                trust bankruptcy the first time an agent gets prompt-injected.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3 — UX with AI */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold mb-6">UX development with AI</h2>
            <div className="space-y-6 text-slate-300 text-lg leading-relaxed">
              <p>
                Most AI UX today is a chat box wrapped around a model.
                That&apos;s not design; it&apos;s exposure. Real design shows
                up in the moments the chat box handles badly: when the model is
                uncertain and doesn&apos;t say so, when the user wants to
                interrupt and there&apos;s no way, when the answer is partially
                right and the interface offers no tool for correction, when
                trust is violated and there&apos;s no recovery path.
              </p>
              <p>
                Trust calibration is the through-line. I wrote about it in{' '}
                <Link
                  href="/articles/trust-calibration-ai-ux"
                  className="text-cyan-400 hover:text-cyan-300 underline italic"
                >
                  trust-calibration-ai-ux
                </Link>{' '}
                because it&apos;s the UX problem I kept hitting at Manatt —
                lawyers needed document-AI outputs to be <em>useful</em> and{' '}
                <em>distrustable in the right proportion</em>. Too confident,
                and they stopped reading critically; too hedged, and they
                stopped using it. The interface has to carry signals the model
                itself doesn&apos;t know how to emit.
              </p>
              <p>
                The{' '}
                <Link href="/explore" className="text-cyan-400 hover:text-cyan-300 underline">
                  /explore
                </Link>{' '}
                routes on this site are me poking at adjacent shapes: what if
                the narrative context for AI-generated content were spatial?
                What if the reader could walk around inside the essay instead
                of scrolling past it? Not a claim these are the answer — a
                claim that the chat-box default deserves actual competition.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 — Materials science and MD */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold mb-6">Materials science and molecular dynamics</h2>
            <div className="space-y-6 text-slate-300 text-lg leading-relaxed">
              <p>
                The current build is{' '}
                <a
                  href="https://lupine.science"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-white hover:text-cyan-300 underline"
                >
                  glimPSE
                </a>
                {' '}— a WebGPU-powered web app for LAMMPS molecular dynamics
                visualization. Drag a dump file into the browser, first frame
                renders in under two seconds, rotate around millions of atoms
                at 60fps, export a 4K publication image or an MP4 without
                installing anything. The competitive field right now is OVITO
                (desktop, paid-per-seat for the features researchers actually
                need for papers), VMD (1990s-era UI that routinely explodes to
                220GB of RAM on a 4GB trajectory), and 50-line matplotlib
                scripts that only produce 2D plots. Nobody else has built a
                WebGPU-native molecular visualization tool for materials
                science, and they should have.
              </p>
              <p>
                glimPSE is the wedge for <strong className="text-white">glim</strong> — a
                longer-horizon open-source platform meant to unify DFT
                (VASP-compatible plane-wave PAW), classical and reactive
                molecular dynamics (LAMMPS-compatible), and an ML interatomic
                potential pipeline into one stack. The current research tooling
                landscape is a chain of specialized command-line programs with
                incompatible file formats, duplicated UIs, and paywalls at the
                quality-matters boundary. It&apos;s the same meta-problem from
                the first section: the capability already exists; the
                coordination layer around it is missing.
              </p>
              <p>
                The materials-science version of the coordination problem is
                especially tangible — a DFT simulation produces training data
                for an ML potential, which enables a much larger MD simulation,
                which reveals a structural motif worth refining with more DFT.
                Nothing about that loop has to be hand-wired by a grad student,
                and nothing about the visualization layer has to cost per-seat
                per-year. Live at{' '}
                <a
                  href="https://lupine.science"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline"
                >
                  lupine.science
                </a>
                ; code, product plan, and research notes are public in the{' '}
                <a
                  href="https://github.com/alexwelcing/lupine"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline"
                >
                  lupine repo
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Let&apos;s Connect</h2>
            <p className="text-slate-400 mb-8">
              Interested in any of these threads? I&apos;m always open to
              meaningful conversations.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <a
                href="mailto:alexwelcing@gmail.com"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition"
              >
                <Mail className="w-5 h-5" />
                alexwelcing@gmail.com
              </a>
              <a
                href="https://www.linkedin.com/in/alexwelcing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition"
              >
                <Linkedin className="w-5 h-5" />
                LinkedIn
              </a>
              <a
                href="https://github.com/alexwelcing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition"
              >
                <Github className="w-5 h-5" />
                GitHub
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 py-8">
          <div className="max-w-6xl mx-auto px-6 text-center text-slate-500 text-sm">
            <p>© {new Date().getFullYear()} Alex Welcing. Built with Next.js, Three.js, and AI.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
