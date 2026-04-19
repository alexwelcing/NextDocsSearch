import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { SITE_URL } from '@/lib/site-url';
import { 
  Zap, 
  Target, 
  Users, 
  Lightbulb, 
  ArrowRight, 
  Mail, 
  Linkedin, 
  Github, 
  Building2,
  Brain,
  Lock,
  Clock,
  Star
} from 'lucide-react';

export default function CurrentWork() {
  const siteUrl = SITE_URL;
  
  return (
    <>
      <Head>
        <title>Work — Alex Welcing</title>
        <meta name="description" content="A partial list of what has my attention." />
        <meta name="keywords" content="Alex Welcing, work, legal intelligence, regulated AI" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${siteUrl}/current-work`} />

        {/* Open Graph */}
        <meta property="og:title" content="Work — Alex Welcing" />
        <meta property="og:description" content="A partial list of what has my attention." />
        <meta property="og:image" content={`${siteUrl}/social-preview.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={`${siteUrl}/current-work`} />
        <meta property="og:type" content="profile" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Work — Alex Welcing" />
        <meta name="twitter:description" content="A partial list of what has my attention." />
        <meta name="twitter:image" content={`${siteUrl}/social-preview.png`} />

        {/* Profile Structured Data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            "mainEntity": {
              "@type": "Person",
              "name": "Alex Welcing",
              "description": "A partial list of what has my attention.",
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
              A partial list of what has my attention right now. Working with a
              portfolio company that leads in legal intelligence, and building AI
              products that survive contact with real users in regulated industries.
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

        {/* Current Role */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="md:col-span-2">
              <h2 className="text-3xl font-bold mb-6">Current Focus</h2>
              <div className="space-y-6 text-slate-300 text-lg leading-relaxed">
                <p>
                  A partial list of what has my attention right now.
                </p>
                <p>
                  Current day work: bridging AI capabilities and the rigorous demands
                  of legal technology. Architecting systems that handle sensitive legal
                  data with precision, developing AI-powered research tools that augment
                  human expertise, and navigating the intersection of innovation and
                  regulatory compliance.
                </p>
                <p>
                  Legal intelligence presents unique challenges: high-stakes decision
                  making, strict accuracy requirements, complex data relationships, and
                  the need for explainable AI in a domain where transparency matters.
                  Building products in this space requires both technical depth and
                  domain sensitivity.
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-sm text-slate-500 mb-2">Role</div>
                <div className="font-semibold text-white">Product Manager</div>
                <div className="text-sm text-cyan-400 mt-1">Portfolio company, legal intelligence</div>
              </div>
              
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-sm text-slate-500 mb-2">Domain</div>
                <div className="font-semibold text-white">Legal Intelligence</div>
                <div className="text-sm text-cyan-400 mt-1">Global market leadership</div>
              </div>
              
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-sm text-slate-500 mb-2">Focus Areas</div>
                <ul className="text-sm text-slate-300 space-y-1 mt-2">
                  <li>• AI-powered legal research</li>
                  <li>• Enterprise data systems</li>
                  <li>• Regulatory compliance</li>
                  <li>• Human-AI collaboration</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Core Competencies */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
          <h2 className="text-3xl font-bold mb-12 text-center">Core Competencies</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Zap,
                title: "LLM Expertise",
                description: "Deep experience with GPT-4, Claude, and open-source models. Built production RAG systems and agent architectures for enterprise contexts."
              },
              {
                icon: Target,
                title: "Product Strategy",
                description: "Translating technical capabilities into market-winning products. Experience across startup and enterprise environments."
              },
              {
                icon: Users,
                title: "Team Leadership",
                description: "Leading cross-functional teams of engineers, designers, and researchers. Building AI products from 0 to 1 in complex domains."
              },
              {
                icon: Lightbulb,
                title: "Technical Depth",
                description: "Former developer turned PM. Can code, architect systems, and communicate effectively with both engineers and executives."
              }
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition">
                <item.icon className="w-10 h-10 text-cyan-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Proof of Work */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
          <h2 className="text-3xl font-bold mb-12 text-center">Proof of Work</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-white/10">
              <div className="text-4xl font-bold text-cyan-400 mb-2">3D</div>
              <p className="text-slate-300 mb-4">Interactive AI Interface</p>
              <p className="text-slate-400 text-sm">Built immersive 3D environment for AI interaction using React Three Fiber, Gaussian Splats, and real-time LLM integration.</p>
            </div>
            
            <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-white/10">
              <div className="text-4xl font-bold text-purple-400 mb-2">RAG</div>
              <p className="text-slate-300 mb-4">Semantic Search System</p>
              <p className="text-slate-400 text-sm">Implemented vector search with OpenAI embeddings, Supabase pgvector, and hybrid lexical+semantic retrieval.</p>
            </div>
            
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-white/10">
              <div className="text-4xl font-bold text-emerald-400 mb-2">AI</div>
              <p className="text-slate-300 mb-4">Agent Architecture</p>
              <p className="text-slate-400 text-sm">Designed multi-modal AI agents with tool use, memory systems, and structured output parsing.</p>
            </div>
          </div>
          
          <div className="text-center mt-8">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition"
            >
              Explore full portfolio <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Dot Dot Dot — Stealth Tech */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="relative p-8 md:p-12 rounded-3xl bg-gradient-to-br from-slate-900/50 via-purple-950/20 to-slate-900/50 border border-white/10 overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20">
                  <Star className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-purple-400 font-medium">In Development</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-white/10">
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-500">Stealth Mode</span>
                </div>
              </div>
              
              <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                <span className="text-slate-600">.</span>
                <span className="text-slate-500">.</span>
                <span className="text-slate-400">.</span>
              </h2>
              
              <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mb-8 leading-relaxed">
                There are projects in development that push beyond current boundaries. 
                Work that explores the edges of what&apos;s possible with emergent intelligence, 
                autonomous systems, and the future of human-AI collaboration.
              </p>
              
              <div className="flex flex-wrap gap-6 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  <span>Autonomous agents</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Temporal reasoning</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  <span>Emergent behaviors</span>
                </div>
              </div>
              
              <div className="mt-12 pt-8 border-t border-white/10">
                <p className="text-slate-400 italic">
                  &ldquo;The most interesting work happens in the spaces between what&apos;s 
                  documented and what&apos;s discovered.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Writing & Research */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
          <h2 className="text-3xl font-bold mb-12">Writing & Research</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <Link 
              href="/articles" 
              className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition group"
            >
              <h3 className="text-xl font-semibold mb-3 group-hover:text-cyan-400 transition">Speculative AI Futures</h3>
              <p className="text-slate-400 mb-4">Exploring the edges of AI possibility through narrative and technical analysis. The Reaching series and research on emergent intelligence.</p>
              <span className="text-cyan-400 text-sm flex items-center gap-2">
                Read articles <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
            
            <Link 
              href="/agent-futures" 
              className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition group"
            >
              <h3 className="text-xl font-semibold mb-3 group-hover:text-cyan-400 transition">Agent Architectures</h3>
              <p className="text-slate-400 mb-4">Technical deep-dives into building autonomous systems, memory architectures, and the infrastructure of agent-based applications.</p>
              <span className="text-cyan-400 text-sm flex items-center gap-2">
                Explore research <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </section>

        {/* Contact */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Let&apos;s Connect</h2>
            <p className="text-slate-400 mb-8">
              Interested in AI product strategy, legal tech, or exploring emergent intelligence? 
              I&apos;m always open to meaningful conversations.
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
