import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { SITE_URL } from '@/lib/site-url';
import { Mail, Linkedin, Github, MapPin, Briefcase, GraduationCap, Award, ArrowRight } from 'lucide-react';

export default function About() {
  const siteUrl = SITE_URL;
  
  return (
    <>
      <Head>
        <title>About Alex Welcing | AI Product Leader & Technical Strategist</title>
        <meta name="description" content="Alex Welcing is an AI product leader with 10+ years experience building enterprise AI products, LLM applications, and agent systems. Former technical product manager at leading tech companies." />
        <meta name="keywords" content="Alex Welcing, AI product manager, technical product manager, AI product leader, product strategy, machine learning product, LLM product, AI portfolio" />
        <link rel="canonical" href={`${siteUrl}/about`} />
        
        <meta property="og:title" content="About Alex Welcing | AI Product Leader" />
        <meta property="og:description" content="AI product leader specializing in LLMs, agent systems, and enterprise AI strategy. View my background and experience." />
        <meta property="og:url" content={`${siteUrl}/about`} />
        <meta property="og:type" content="profile" />
        
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            "name": "Alex Welcing",
            "url": siteUrl,
            "jobTitle": "AI Product Leader",
            "description": "AI product leader building intelligent systems at the intersection of LLMs, agent architectures, and enterprise AI.",
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
              "Technical Product Leadership",
              "Machine Learning"
            ]
          })
        }} />
      </Head>

      <div className="min-h-screen bg-slate-950 text-white">
        {/* Navigation */}
        <nav className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Alex Welcing
            </Link>
            <div className="flex gap-6 text-sm">
              <Link href="/" className="text-slate-400 hover:text-white transition">Portfolio</Link>
              <Link href="/articles" className="text-slate-400 hover:text-white transition">Writing</Link>
              <Link href="/about" className="text-cyan-400 font-medium">About</Link>
              <Link href="/current-work" className="text-purple-400 font-medium">Current Work</Link>
            </div>
          </div>
        </nav>

        <main className="max-w-4xl mx-auto px-6 py-16">
          {/* Header */}
          <div className="flex flex-col md:flex-row gap-8 items-start mb-16">
            <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-4xl font-bold">
              AW
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">Alex Welcing</h1>
              <p className="text-xl text-slate-400 mb-4">AI Product Leader & Technical Strategist</p>
              <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> New York, NY</span>
                <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> TPM — Legal Intelligence</span>
              </div>
              <div className="flex gap-4 mt-6">
                <a href="mailto:alexwelcing@gmail.com" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
                  <Mail className="w-5 h-5" />
                </a>
                <a href="https://linkedin.com/in/alexwelcing" target="_blank" rel="noopener" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href="https://github.com/alexwelcing" target="_blank" rel="noopener" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition">
                  <Github className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          {/* Summary */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span className="w-8 h-px bg-cyan-500"></span>
              Summary
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              I&apos;m a product leader with deep technical expertise in AI/ML. I&apos;ve spent the last decade 
              translating complex technical capabilities into market-winning products. My sweet spot is 
              the intersection of LLMs, agent architectures, and enterprise software—where I bridge 
              the gap between what AI can do and what businesses need.
            </p>
            <p className="text-lg text-slate-300 leading-relaxed mt-4">
              Previously, I&apos;ve led product teams at startups and enterprises, shipping AI-powered 
              features that moved key metrics. I&apos;m hands-on: I can code, architect systems, and 
              communicate effectively with both engineers and executives.
            </p>
          </section>

          {/* Key Skills */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span className="w-8 h-px bg-cyan-500"></span>
              Key Skills
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { category: "AI/ML", skills: "LLMs (GPT-4, Claude, Llama), RAG, Agent Systems, Vector Search, Fine-tuning" },
                { category: "Product", skills: "Strategy, Roadmapping, User Research, Data Analysis, A/B Testing" },
                { category: "Technical", skills: "React, TypeScript, Python, Node.js, SQL, Cloud Infrastructure" },
                { category: "Leadership", skills: "Team Building, Cross-functional Collaboration, Stakeholder Management" }
              ].map((item, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h3 className="font-semibold text-cyan-400 mb-2">{item.category}</h3>
                  <p className="text-sm text-slate-400">{item.skills}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Experience */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-cyan-400" />
              Experience
            </h2>
            <div className="space-y-8">
              <div className="border-l-2 border-white/10 pl-6">
                <div className="flex flex-wrap justify-between items-baseline mb-2">
                  <h3 className="text-xl font-semibold">AI Product Lead</h3>
                  <span className="text-sm text-slate-500">2021 — Present</span>
                </div>
                <p className="text-cyan-400 text-sm mb-2">Independent Consultant</p>
                <ul className="text-slate-400 space-y-1 list-disc list-inside">
                  <li>Advising startups on AI product strategy and LLM implementation</li>
                  <li>Building proof-of-concept agent systems and RAG applications</li>
                  <li>Leading technical workshops on AI product development</li>
                </ul>
              </div>

              <div className="border-l-2 border-white/10 pl-6">
                <div className="flex flex-wrap justify-between items-baseline mb-2">
                  <h3 className="text-xl font-semibold">Senior Product Manager</h3>
                  <span className="text-sm text-slate-500">2018 — 2021</span>
                </div>
                <p className="text-cyan-400 text-sm mb-2">Enterprise Technology</p>
                <ul className="text-slate-400 space-y-1 list-disc list-inside">
                  <li>Led AI-powered feature development serving 10M+ users</li>
                  <li>Managed roadmap for machine learning infrastructure</li>
                  <li>Grew team from 3 to 12 engineers and designers</li>
                </ul>
              </div>

              <div className="border-l-2 border-white/10 pl-6">
                <div className="flex flex-wrap justify-between items-baseline mb-2">
                  <h3 className="text-xl font-semibold">Technical Product Manager</h3>
                  <span className="text-sm text-slate-500">2015 — 2018</span>
                </div>
                <p className="text-cyan-400 text-sm mb-2">B2B SaaS Platform</p>
                <ul className="text-slate-400 space-y-1 list-disc list-inside">
                  <li>Shipped 0-to-1 products generating $2M+ ARR</li>
                  <li>Transitioned from engineering to product management</li>
                  <li>Built data pipeline processing 1B+ events daily</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Education */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-cyan-400" />
              Education
            </h2>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <h3 className="font-semibold">BS Computer Science</h3>
              <p className="text-slate-400">University focus on AI and distributed systems</p>
            </div>
          </section>

          {/* Featured Writing */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Award className="w-6 h-6 text-cyan-400" />
              Featured Writing
            </h2>
            <div className="space-y-4">
              <Link href="/articles" className="block p-4 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition">
                <h3 className="font-semibold mb-1">The Reaching</h3>
                <p className="text-sm text-slate-400 mb-2">A speculative fiction series exploring AI futures and human-machine collaboration.</p>
                <span className="text-xs text-cyan-400 flex items-center gap-1">Read articles <ArrowRight className="w-3 h-3" /></span>
              </Link>
              <Link href="/articles" className="block p-4 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/30 transition">
                <h3 className="font-semibold mb-1">AI Product Strategy</h3>
                <p className="text-sm text-slate-400 mb-2">Practical frameworks for shipping LLM-powered products in enterprise environments.</p>
                <span className="text-xs text-cyan-400 flex items-center gap-1">Read articles <ArrowRight className="w-3 h-3" /></span>
              </Link>
            </div>
          </section>

          {/* CTA */}
          <section className="p-8 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-white/10 text-center">
            <h2 className="text-2xl font-bold mb-4">Explore my work</h2>
            <p className="text-slate-400 mb-6">Currently focused on AI product leadership in legal intelligence. Always open to meaningful conversations.</p>
            <Link 
              href="/current-work" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg transition"
            >
              View Current Work
              <ArrowRight className="w-5 h-5" />
            </Link>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/10 py-8">
          <div className="max-w-4xl mx-auto px-6 text-center text-slate-500 text-sm">
            <p>© {new Date().getFullYear()} Alex Welcing. Built with Next.js and AI.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
