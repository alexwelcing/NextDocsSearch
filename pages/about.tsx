import Head from 'next/head'
import Link from 'next/link'
import StructuredData from '@/components/StructuredData'

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About | Alex Welcing</title>
        <meta
          name="description"
          content="Alex Welcing - AI Strategy & Product Leadership. Building frameworks for understanding worlds where intelligence becomes abundant."
        />
        <link rel="canonical" href="https://alexwelcing.com/about" />
        <meta property="og:title" content="About | Alex Welcing" />
        <meta property="og:description" content="AI Strategy & Product Leadership. Building frameworks for abundant cognition." />
        <meta property="og:url" content="https://alexwelcing.com/about" />
        <meta property="og:type" content="profile" />
      </Head>

      <StructuredData
        type="Person"
        data={{
          name: "Alex Welcing",
          url: "https://alexwelcing.com",
          jobTitle: "AI Strategy & Product Leadership",
          description: "Building frameworks for understanding worlds where intelligence becomes abundant.",
          sameAs: [
            "https://www.linkedin.com/in/alexwelcing",
            "https://github.com/alexwelcing",
            "https://x.com/alexwelcing"
          ]
        }}
      />

      <div className="min-h-screen bg-[#030308] text-white">
        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030308]/90 backdrop-blur-sm border-b border-white/5">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-mono text-sm tracking-wide text-white/90 hover:text-white transition-colors">
              ALEX WELCING
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/articles" className="font-mono text-xs tracking-wider text-white/60 hover:text-white transition-colors">
                RESEARCH
              </Link>
              <Link href="/about" className="font-mono text-xs tracking-wider text-cyan-400">
                ABOUT
              </Link>
            </div>
          </div>
        </nav>

        <main className="pt-32 pb-20 px-6">
          <div className="max-w-3xl mx-auto">
            <header className="mb-16">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-white/95">
                About
              </h1>
              <p className="text-xl text-white/60 leading-relaxed">
                Building frameworks for understanding worlds where intelligence becomes abundant.
              </p>
            </header>

            <div className="space-y-12">
              {/* Bio Section */}
              <section>
                <h2 className="font-mono text-xs tracking-widest text-cyan-400/80 mb-4">BIO</h2>
                <div className="space-y-4 text-white/70 leading-relaxed">
                  <p>
                    I'm Alex Welcing, focused on AI strategy and product leadership at the intersection of
                    emerging technology and human systems. My work explores speculative AI futures,
                    emergent intelligence patterns, and the systemic consequences of abundant cognition.
                  </p>
                  <p>
                    This site hosts original research on what happens when cognitive labor approaches
                    zero marginal cost—examining agent civilizations, governance frameworks, and the
                    economic transformations ahead.
                  </p>
                </div>
              </section>

              {/* Focus Areas */}
              <section>
                <h2 className="font-mono text-xs tracking-widest text-cyan-400/80 mb-4">FOCUS AREAS</h2>
                <ul className="grid gap-4">
                  <li className="p-4 border border-white/10 hover:border-white/20 transition-colors">
                    <h3 className="font-semibold text-white/90 mb-1">Speculative AI Research</h3>
                    <p className="text-sm text-white/50">Scenario planning and analysis of near-future AI developments</p>
                  </li>
                  <li className="p-4 border border-white/10 hover:border-white/20 transition-colors">
                    <h3 className="font-semibold text-white/90 mb-1">Emergent Intelligence</h3>
                    <p className="text-sm text-white/50">Studying collective behaviors and unexpected capabilities in AI systems</p>
                  </li>
                  <li className="p-4 border border-white/10 hover:border-white/20 transition-colors">
                    <h3 className="font-semibold text-white/90 mb-1">AI Product Strategy</h3>
                    <p className="text-sm text-white/50">Building products that leverage AI capabilities responsibly</p>
                  </li>
                </ul>
              </section>

              {/* Connect */}
              <section>
                <h2 className="font-mono text-xs tracking-widest text-cyan-400/80 mb-4">CONNECT</h2>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="https://x.com/alexwelcing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-all font-mono text-sm"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    @alexwelcing
                  </a>
                  <a
                    href="https://linkedin.com/in/alexwelcing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-all font-mono text-sm"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    LinkedIn
                  </a>
                  <a
                    href="https://github.com/alexwelcing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-all font-mono text-sm"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    GitHub
                  </a>
                </div>
              </section>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-white/5">
          <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/" className="font-mono text-xs text-white/30 hover:text-white/60 transition-colors">
              &larr; BACK TO HOME
            </Link>
            <div className="flex items-center gap-6">
              <a href="/feed.xml" className="font-mono text-xs text-white/30 hover:text-white/60 transition-colors">RSS</a>
              <a href="/sitemap.xml" className="font-mono text-xs text-white/30 hover:text-white/60 transition-colors">SITEMAP</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
