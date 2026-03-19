import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { SITE_URL } from '@/lib/site-url';
import { Zap, Target, Users, Lightbulb, ArrowRight, Mail, Linkedin, Github, Calendar } from 'lucide-react';

export default function HireMe() {
  const siteUrl = SITE_URL;
  
  return (
    <>
      <Head>
        <title>Hire Alex Welcing | AI Product Leader & Technical Strategist</title>
        <meta name="description" content="Looking for an AI product leader? Alex Welcing specializes in LLM applications, agent architectures, and AI strategy. Former product lead with enterprise AI experience. Available for full-time roles and advisory positions." />
        <meta name="keywords" content="hire AI product manager, AI product leader, technical product manager, LLM product, AI strategy consultant, Alex Welcing, AI product hire, machine learning product manager" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${siteUrl}/hire-me`} />
        
        {/* Open Graph */}
        <meta property="og:title" content="Hire Alex Welcing | AI Product Leader" />
        <meta property="og:description" content="AI product leader specializing in LLMs, agent systems, and enterprise AI strategy. Available for hire." />
        <meta property="og:url" content={`${siteUrl}/hire-me`} />
        <meta property="og:type" content="profile" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Hire Alex Welcing | AI Product Leader" />
        <meta name="twitter:description" content="AI product leader specializing in LLMs and enterprise AI. Available for full-time roles." />
        
        {/* Job Posting Structured Data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            "mainEntity": {
              "@type": "Person",
              "name": "Alex Welcing",
              "jobTitle": "AI Product Leader",
              "description": "AI product leader specializing in LLM applications, agent architectures, and enterprise AI strategy.",
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
                "Technical Product Leadership"
              ],
              "seeks": {
                "@type": "JobPosting",
                "title": "AI Product Leader / Technical Product Manager",
                "description": "Seeking full-time or advisory roles in AI/ML product management",
                "employmentType": ["FULL_TIME", "CONTRACT"],
                "industry": ["Artificial Intelligence", "Technology", "Enterprise Software"]
              }
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
              <Link href="/hire-me" className="text-cyan-400 font-medium">Hire Me</Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-6 py-20 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Available for opportunities
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Hire an{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                AI Product Leader
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-400 mb-8 leading-relaxed">
              I bridge the gap between cutting-edge AI capabilities and enterprise product strategy. 
              Former product lead with proven results shipping LLM-powered applications.
            </p>

            <div className="flex flex-wrap gap-4">
              <a 
                href="mailto:alexwelcing@gmail.com" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg transition"
              >
                <Mail className="w-5 h-5" />
                Get in Touch
              </a>
              <a 
                href="https://calendly.com/alexwelcing" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 border border-white/20 hover:border-white/40 rounded-lg transition"
              >
                <Calendar className="w-5 h-5" />
                Schedule a Call
              </a>
            </div>
          </div>
        </section>

        {/* What I Bring */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
          <h2 className="text-3xl font-bold mb-12 text-center">What I Bring to Your Team</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Zap,
                title: "LLM Expertise",
                description: "Deep experience with GPT-4, Claude, and open-source models. Built production RAG systems and agent architectures."
              },
              {
                icon: Target,
                title: "Product Strategy",
                description: "10+ years translating technical capabilities into market-winning products. Enterprise and startup experience."
              },
              {
                icon: Users,
                title: "Team Leadership",
                description: "Led cross-functional teams of engineers, designers, and researchers. Built AI products from 0 to 1."
              },
              {
                icon: Lightbulb,
                title: "Technical Depth",
                description: "Former developer turned PM. Can code, architect systems, and communicate with technical teams."
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

        {/* Roles I&apos;m Seeking */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
          <h2 className="text-3xl font-bold mb-12 text-center">Roles I&apos;m Seeking</h2>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                title: "Senior/Staff AI Product Manager",
                type: "Full-time",
                description: "Leading AI product initiatives, from LLM applications to agent systems. Looking for Series B+ or enterprise."
              },
              {
                title: "Technical Product Lead",
                type: "Full-time",
                description: "Hands-on product leadership for technical teams. Architecture decisions, roadmap, and execution."
              },
              {
                title: "AI Strategy Consultant",
                type: "Advisory/Contract",
                description: "Helping companies navigate AI adoption, from use case identification to implementation strategy."
              },
              {
                title: "Founding Product",
                type: "Full-time",
                description: "Early-stage startup building AI-native products. Equity + salary. Ready to wear many hats."
              }
            ].map((role, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold">{role.title}</h3>
                  <span className="text-xs px-3 py-1 rounded-full bg-white/10 text-slate-300">{role.type}</span>
                </div>
                <p className="text-slate-400 text-sm">{role.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/10">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Let&apos;s Build Something Amazing</h2>
            <p className="text-slate-400 mb-8">
              I&apos;m actively interviewing and excited about teams pushing the boundaries of what&apos;s possible with AI.
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

            <div className="p-6 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-white/10">
              <p className="text-slate-300 mb-4">Prefer to schedule directly?</p>
              <a 
                href="https://calendly.com/alexwelcing" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg transition"
              >
                <Calendar className="w-5 h-5" />
                Book a 30-min intro call
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
