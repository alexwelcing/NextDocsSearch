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

      <div className="min-h-screen bg-parchment-50">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 bg-parchment-50/95 backdrop-blur-sm border-b border-earth-200">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-sun-400 to-flora-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">AW</span>
              </span>
              <span className="font-serif text-lg text-earth-700 group-hover:text-flora-600 transition-colors">
                Alex Welcing
              </span>
            </Link>
            <div className="flex items-center gap-8">
              <Link href="/articles" className="text-sm text-earth-600 hover:text-flora-600 transition-colors font-medium">
                Research
              </Link>
              <Link href="/about" className="text-sm text-flora-600 font-medium">
                About
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <header className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-flora-50 via-parchment-50 to-sun-50 opacity-60" />
          <div className="absolute top-10 right-20 w-48 h-48 bg-flora-300/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-10 w-32 h-32 bg-sun-300/30 rounded-full blur-2xl" />

          <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-2 h-2 rounded-full bg-flora-400" />
              <span className="text-sm font-medium text-flora-600 uppercase tracking-wide">About</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-earth-700 mb-6">
              Cultivating Ideas at the
              <span className="block bg-gradient-to-r from-flora-600 to-sun-500 bg-clip-text text-transparent">
                Edge of Tomorrow
              </span>
            </h1>
            <p className="text-xl text-earth-500 leading-relaxed">
              Building frameworks for understanding worlds where intelligence becomes abundant.
            </p>
          </div>
        </header>

        <main className="pb-20 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="space-y-16">
              {/* Bio Section */}
              <section className="bg-white rounded-3xl p-8 md:p-10 border border-earth-100 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-sun-400" />
                  <h2 className="text-sm font-semibold text-earth-500 uppercase tracking-wider">Bio</h2>
                </div>
                <div className="space-y-5 text-earth-600 leading-relaxed">
                  <p className="text-lg">
                    I&apos;m Alex Welcing, focused on AI strategy and product leadership at the intersection of
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
                <div className="flex items-center gap-2 mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-flora-400" />
                  <h2 className="text-sm font-semibold text-earth-500 uppercase tracking-wider">Focus Areas</h2>
                </div>
                <div className="grid gap-4">
                  <div className="p-6 bg-gradient-to-br from-sun-50 to-parchment-50 rounded-2xl border border-sun-200 hover:border-sun-300 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-sun-400/20 flex items-center justify-center mb-4">
                      <svg className="w-5 h-5 text-sun-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h3 className="font-serif text-xl font-semibold text-earth-700 mb-2">Speculative AI Research</h3>
                    <p className="text-earth-500">Scenario planning and analysis of near-future AI developments and their cascading effects on society.</p>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-flora-50 to-parchment-50 rounded-2xl border border-flora-200 hover:border-flora-300 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-flora-400/20 flex items-center justify-center mb-4">
                      <svg className="w-5 h-5 text-flora-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="font-serif text-xl font-semibold text-earth-700 mb-2">Emergent Intelligence</h3>
                    <p className="text-earth-500">Studying collective behaviors and unexpected capabilities that arise in complex AI systems.</p>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-terra-50 to-parchment-50 rounded-2xl border border-terra-200 hover:border-terra-300 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-terra-400/20 flex items-center justify-center mb-4">
                      <svg className="w-5 h-5 text-terra-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h3 className="font-serif text-xl font-semibold text-earth-700 mb-2">AI Product Strategy</h3>
                    <p className="text-earth-500">Building products that leverage AI capabilities responsibly and create genuine value.</p>
                  </div>
                </div>
              </section>

              {/* Connect */}
              <section>
                <div className="flex items-center gap-2 mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-sun-400" />
                  <h2 className="text-sm font-semibold text-earth-500 uppercase tracking-wider">Connect</h2>
                </div>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="https://x.com/alexwelcing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3 bg-white border border-earth-200 text-earth-600 hover:text-earth-700 hover:border-sun-300 hover:shadow-md transition-all rounded-xl font-medium"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    @alexwelcing
                  </a>
                  <a
                    href="https://linkedin.com/in/alexwelcing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3 bg-white border border-earth-200 text-earth-600 hover:text-earth-700 hover:border-flora-300 hover:shadow-md transition-all rounded-xl font-medium"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    LinkedIn
                  </a>
                  <a
                    href="https://github.com/alexwelcing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3 bg-white border border-earth-200 text-earth-600 hover:text-earth-700 hover:border-earth-400 hover:shadow-md transition-all rounded-xl font-medium"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
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
        <footer className="py-12 bg-earth-700">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-sun-400 to-flora-500 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">AW</span>
                </span>
                <span className="text-earth-300 text-sm">&copy; {new Date().getFullYear()} Alex Welcing</span>
              </div>
              <div className="flex items-center gap-8">
                <Link href="/" className="text-earth-400 hover:text-sun-400 text-sm transition-colors">Home</Link>
                <a href="/feed.xml" className="text-earth-400 hover:text-sun-400 text-sm transition-colors">RSS</a>
                <a href="/sitemap.xml" className="text-earth-400 hover:text-sun-400 text-sm transition-colors">Sitemap</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
