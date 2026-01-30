import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import StructuredData from '@/components/StructuredData'
import styles from '@/styles/Home.module.css'

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  return (
    <>
      <Head>
        <title>Alex Welcing | AI Product Manager - Building Intelligent Systems</title>
        <meta
          name="description"
          content="AI Product Manager with 10+ years building intelligent systems. Expert in ML/AI product strategy, platform development, and driving business outcomes through technology innovation."
        />
        <meta 
          name="keywords" 
          content="AI Product Manager, Machine Learning, AI Strategy, Product Leadership, SaaS, Platform Development, Alex Welcing" 
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://alexwelcing.com" />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph Meta Tags */}
        <meta
          property="og:title"
          content="Alex Welcing | AI Product Manager - Building Intelligent Systems"
        />
        <meta
          property="og:description"
          content="AI Product Manager with 10+ years building intelligent systems. Expert in ML/AI product strategy, platform development, and driving business outcomes."
        />
        <meta property="og:image" content="https://alexwelcing.com/social-preview.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://alexwelcing.com" />
        <meta property="og:type" content="website" />

        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Alex Welcing | AI Product Manager" />
        <meta name="twitter:description" content="Building intelligent systems and AI products. 10+ years of product leadership in SaaS, ML/AI, and platform technologies." />
        <meta name="twitter:image" content="https://alexwelcing.com/social-preview.png" />

        {/* Performance and PWA hints */}
        <meta name="theme-color" content="#0a0a0a" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </Head>

      <StructuredData
        type="Person"
        data={{
          name: "Alex Welcing",
          url: "https://alexwelcing.com",
          jobTitle: "AI Product Manager",
          description: "AI Product Manager with expertise in machine learning systems, platform development, and driving business outcomes through intelligent technology.",
          sameAs: [
            "https://www.linkedin.com/in/alexwelcing",
            "https://github.com/alexwelcing",
            "https://x.com/alexwelcing"
          ],
          knowsAbout: [
            "AI Product Management",
            "Machine Learning",
            "Product Strategy",
            "Platform Development",
            "SaaS",
            "System Architecture"
          ]
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        {/* Navigation */}
        <nav className="fixed top-0 w-full z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Alex Welcing
              </Link>
              
              {/* Desktop Navigation */}
              <div className="hidden md:flex gap-8">
                <a href="#about" className="hover:text-blue-400 transition-colors">About</a>
                <a href="#experience" className="hover:text-blue-400 transition-colors">Experience</a>
                <Link href="/articles" className="hover:text-blue-400 transition-colors">Articles</Link>
                <a href="#contact" className="hover:text-blue-400 transition-colors">Contact</a>
              </div>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden text-white p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
              <div className="md:hidden py-4 space-y-3">
                <a 
                  href="#about" 
                  className="block hover:text-blue-400 transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  About
                </a>
                <a 
                  href="#experience" 
                  className="block hover:text-blue-400 transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Experience
                </a>
                <Link 
                  href="/articles" 
                  className="block hover:text-blue-400 transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Articles
                </Link>
                <a 
                  href="#contact" 
                  className="block hover:text-blue-400 transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Contact
                </a>
              </div>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-8">
              <div className="inline-block px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm font-medium mb-4">
                Available for AI Product Leadership Roles
              </div>
              
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-300 bg-clip-text text-transparent">
                  Building Intelligent Systems
                </span>
                <br />
                <span className="text-gray-300">
                  That Drive Business Impact
                </span>
              </h1>

              <p className="text-xl sm:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
                AI Product Manager with 10+ years turning complex ML/AI capabilities into 
                successful products. Expert in product strategy, platform development, and 
                bridging the research-to-production gap.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                <a
                  href="#contact"
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors shadow-lg shadow-blue-500/25"
                >
                  Get In Touch
                </a>
                <Link
                  href="/about"
                  className="px-8 py-4 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-colors border border-gray-700"
                >
                  View Resume
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Key Strengths Section */}
        <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-800/30">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold mb-12 text-center">
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Core Expertise
              </span>
            </h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-colors">
                <div className="text-3xl mb-4">🤖</div>
                <h3 className="text-xl font-bold mb-3 text-blue-400">AI Product Strategy</h3>
                <p className="text-gray-400 leading-relaxed">
                  Defining product vision and roadmaps for ML/AI systems. Expert in prioritization 
                  frameworks (RIBS) and balancing innovation with business value.
                </p>
              </div>

              <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-colors">
                <div className="text-3xl mb-4">⚡</div>
                <h3 className="text-xl font-bold mb-3 text-blue-400">Platform Development</h3>
                <p className="text-gray-400 leading-relaxed">
                  Building scalable SaaS platforms from concept to launch. Experience across 
                  legal tech, healthcare, and analytics verticals.
                </p>
              </div>

              <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-colors">
                <div className="text-3xl mb-4">📊</div>
                <h3 className="text-xl font-bold mb-3 text-blue-400">Research to Production</h3>
                <p className="text-gray-400 leading-relaxed">
                  Translating cutting-edge AI research into production-ready features. 
                  Bridging technical teams and business stakeholders.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Experience Highlights */}
        <section id="experience" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold mb-4 text-center">
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Experience Highlights
              </span>
            </h2>
            <p className="text-center text-gray-400 mb-12 text-lg">
              10+ years building products across legal, healthcare, and analytics
            </p>

            <div className="space-y-6">
              <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Technical Product Manager</h3>
                    <p className="text-blue-400 font-medium">Various SaaS Companies</p>
                  </div>
                  <span className="text-gray-500 mt-2 sm:mt-0">2014 - Present</span>
                </div>
                <ul className="space-y-3 text-gray-400">
                  <li className="flex items-start">
                    <span className="text-blue-400 mr-2">→</span>
                    Led AI/ML product initiatives from ideation to launch
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-400 mr-2">→</span>
                    Managed cross-functional teams (engineering, design, data science)
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-400 mr-2">→</span>
                    Drove product strategy and roadmap for B2B SaaS platforms
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-400 mr-2">→</span>
                    Established metrics frameworks and KPIs for AI product success
                  </li>
                </ul>
              </div>

              <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4">Key Achievements</h3>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <div className="text-3xl font-bold text-blue-400 mb-2">$10M+</div>
                    <p className="text-gray-400">Revenue generated through AI product launches</p>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-blue-400 mb-2">85%</div>
                    <p className="text-gray-400">Average user satisfaction score</p>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-blue-400 mb-2">15+</div>
                    <p className="text-gray-400">Successful product launches</p>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-blue-400 mb-2">50+</div>
                    <p className="text-gray-400">Team members led across multiple projects</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Skills Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-800/30">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold mb-12 text-center">
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Technical Skills
              </span>
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                'Product Strategy', 'ML/AI Systems', 'Platform Architecture', 'API Design',
                'User Research', 'Data Analytics', 'Agile/Scrum', 'Technical Specs',
                'Roadmap Planning', 'Stakeholder Mgmt', 'A/B Testing', 'Market Analysis'
              ].map((skill) => (
                <div
                  key={skill}
                  className="px-4 py-3 bg-gray-800/50 rounded-lg border border-gray-700 text-center hover:border-blue-500/50 transition-colors"
                >
                  {skill}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Recent Thinking */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-bold mb-4 text-center">
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Recent Thinking
              </span>
            </h2>
            <p className="text-center text-gray-400 mb-12 text-lg">
              Insights on AI product management and intelligent systems
            </p>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/10">
                <div className="text-sm text-blue-400 mb-2 font-medium">AI STRATEGY</div>
                <h3 className="text-xl font-bold mb-3">The RIBS Framework for AI Feature Prioritization</h3>
                <p className="text-gray-400 mb-4 leading-relaxed">
                  A systematic approach to prioritizing AI features based on Research readiness, 
                  Integration complexity, Business value, and Stakeholder alignment.
                </p>
                <Link href="/articles" className="text-blue-400 hover:text-blue-300 font-medium">
                  Read more →
                </Link>
              </div>

              <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/10">
                <div className="text-sm text-blue-400 mb-2 font-medium">PRODUCT LEADERSHIP</div>
                <h3 className="text-xl font-bold mb-3">Bridging Research and Production</h3>
                <p className="text-gray-400 mb-4 leading-relaxed">
                  How to translate cutting-edge AI research into production systems that 
                  deliver real business value while managing technical risk.
                </p>
                <Link href="/articles" className="text-blue-400 hover:text-blue-300 font-medium">
                  Read more →
                </Link>
              </div>
            </div>

            <div className="text-center">
              <Link
                href="/articles"
                className="inline-block px-8 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-colors border border-gray-700"
              >
                View All Articles
              </Link>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-800/30">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Let&apos;s Build Something Great
              </span>
            </h2>
            <p className="text-xl text-gray-400 mb-8 leading-relaxed">
              Looking for an AI Product Manager who can bridge technical innovation 
              and business outcomes? Let&apos;s talk.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <a
                href="mailto:AlexWelcing@gmail.com"
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
              >
                <span>📧</span>
                AlexWelcing@gmail.com
              </a>
              <a
                href="tel:817-734-5375"
                className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-colors border border-gray-700"
              >
                <span>📱</span>
                817-734-5375
              </a>
            </div>

            <div className="flex gap-6 justify-center">
              <a
                href="https://linkedin.com/in/alexwelcing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-400 transition-colors"
              >
                LinkedIn
              </a>
              <a
                href="https://github.com/alexwelcing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-400 transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://x.com/alexwelcing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-400 transition-colors"
              >
                Twitter/X
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-gray-800">
          <div className="max-w-6xl mx-auto text-center text-gray-500">
            <p>© 2024 Alex Welcing. All rights reserved.</p>
            <p className="mt-2 text-sm">
              Based in New York, NY • Available for remote opportunities
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}
