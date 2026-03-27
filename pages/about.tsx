import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { SITE_URL } from '@/lib/site-url';
import { Mail, Linkedin, Github, MapPin, Briefcase, GraduationCap, ArrowRight, Code, BarChart3, Layers } from 'lucide-react';

export default function About() {
  const siteUrl = SITE_URL;
  
  return (
    <>
      <Head>
        <title>About Alex Welcing | Technical Product Manager</title>
        <meta name="description" content="Alex Welcing is a Technical Product Manager at ALM with 9+ years experience in SaaS, publishing tech, VR solutions, and legal technology." />
        <meta name="keywords" content="Alex Welcing, Technical Product Manager, ALM, SaaS, VR, legal technology, Obsess, Manatt" />
        <link rel="canonical" href={`${siteUrl}/about`} />
        
        <meta property="og:title" content="About Alex Welcing | Technical Product Manager" />
        <meta property="og:description" content="Technical Product Manager with expertise in SaaS platforms, immersive VR, and legal technology." />
        <meta property="og:url" content={`${siteUrl}/about`} />
        <meta property="og:type" content="profile" />
        
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            "name": "Alex Welcing",
            "url": siteUrl,
            "jobTitle": "Technical Product Manager",
            "worksFor": {
              "@type": "Organization",
              "name": "ALM"
            },
            "description": "Technical Product Manager with 9+ years experience delivering scalable SaaS, publishing tech, and immersive VR solutions.",
            "sameAs": [
              "https://www.linkedin.com/in/alexwelcing",
              "https://github.com/alexwelcing"
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
              <p className="text-xl text-slate-400 mb-4">Technical Product Manager</p>
              <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> New York, NY</span>
                <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> ALM</span>
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
              About
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              I&apos;m a Technical Product Manager with 9+ years of experience delivering scalable SaaS, 
              publishing technology, and immersive VR solutions. I currently steer product strategy 
              and delivery at ALM, an integrated media company serving the legal and commercial real 
              estate sectors.
            </p>
            <p className="text-lg text-slate-300 leading-relaxed mt-4">
              My background spans both technical development and marketing strategy, with a track 
              record of translating complex customer needs into measurable outcomes. I have 
              hands-on experience building secure SaaS platforms, optimizing data pipelines, 
              and launching AI-driven features in regulated industries.
            </p>
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
                  <h3 className="text-xl font-semibold">Technical Product Manager</h3>
                  <span className="text-sm text-slate-500">Jan 2024 — Present</span>
                </div>
                <p className="text-cyan-400 text-sm mb-3">ALM</p>
                <p className="text-slate-400 leading-relaxed">
                  Steer product strategy and delivery for an integrated media company providing 
                  specialized business information to the legal and commercial real estate sectors. 
                  Translate complex customer needs into measurable outcomes.
                </p>
              </div>

              <div className="border-l-2 border-white/10 pl-6">
                <div className="flex flex-wrap justify-between items-baseline mb-2">
                  <h3 className="text-xl font-semibold">Product Manager</h3>
                  <span className="text-sm text-slate-500">Previous</span>
                </div>
                <p className="text-cyan-400 text-sm mb-3">Obsess</p>
                <ul className="text-slate-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span>Launched cutting-edge SaaS platforms and immersive VR capabilities</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span>Optimized data pipelines with Google Analytics 4 integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span>Enabled real-time 3D rendering across mobile, headset, and desktop</span>
                  </li>
                </ul>
              </div>

              <div className="border-l-2 border-white/10 pl-6">
                <div className="flex flex-wrap justify-between items-baseline mb-2">
                  <h3 className="text-xl font-semibold">Developer</h3>
                  <span className="text-sm text-slate-500">Previous</span>
                </div>
                <p className="text-cyan-400 text-sm mb-3">Manatt, Phelps & Phillips, LLP</p>
                <ul className="text-slate-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span>Built a secure client SaaS platform for legal and regulatory analysis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span>Implemented AI-driven document scanning capabilities</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 mt-1">•</span>
                    <span>Developed knowledge/training portal that delivered strong ROI</span>
                  </li>
                </ul>
              </div>

              <div className="border-l-2 border-white/10 pl-6">
                <div className="flex flex-wrap justify-between items-baseline mb-2">
                  <h3 className="text-xl font-semibold">Developer</h3>
                  <span className="text-sm text-slate-500">Previous</span>
                </div>
                <p className="text-cyan-400 text-sm mb-3">Arkadium</p>
                <p className="text-slate-400">
                  Drove business development in artificial intelligence and built NLP-powered 
                  interactive content partnerships.
                </p>
              </div>
            </div>
          </section>

          {/* Skills */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span className="w-8 h-px bg-cyan-500"></span>
              Expertise
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold text-white">SaaS Platforms</h3>
                </div>
                <p className="text-sm text-slate-400">Product strategy, platform development, and scaling B2B solutions</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Code className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold text-white">VR & 3D</h3>
                </div>
                <p className="text-sm text-slate-400">Immersive experiences, real-time rendering across mobile/headset/desktop</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold text-white">Data & Analytics</h3>
                </div>
                <p className="text-sm text-slate-400">Pipeline optimization, GA4 integration, data-driven product decisions</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold text-white">Legal Tech</h3>
                </div>
                <p className="text-sm text-slate-400">Secure client platforms, regulatory analysis tools, AI-driven document processing</p>
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
              <h3 className="font-semibold">BS in Marketing</h3>
              <p className="text-slate-400">Naveen Jindal School of Management, UT Dallas</p>
              <p className="text-slate-500 text-sm mt-2">
                Combined technical development expertise with marketing strategy and business fundamentals.
              </p>
            </div>
          </section>

          {/* Technical Background */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Code className="w-6 h-6 text-cyan-400" />
              Technical Background
            </h2>
            <p className="text-slate-300 leading-relaxed mb-4">
              With 10+ years of coding experience and 8+ years as a software developer, I bring 
              hands-on technical depth to product management. This site itself demonstrates my 
              technical capabilities—built with Next.js, React Three Fiber, and AI integrations.
            </p>
            <div className="flex flex-wrap gap-2">
              {['React', 'TypeScript', 'Node.js', 'Python', 'Next.js', 'Three.js', 'SQL', 'AWS'].map((skill) => (
                <span key={skill} className="px-3 py-1 rounded-full bg-white/5 text-slate-400 text-sm">
                  {skill}
                </span>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="p-8 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-white/10 text-center">
            <h2 className="text-2xl font-bold mb-4">Let&apos;s Connect</h2>
            <p className="text-slate-400 mb-6">
              Interested in product management, SaaS platforms, or immersive technology? 
              I&apos;m always open to meaningful conversations.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="mailto:alexwelcing@gmail.com" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg transition"
              >
                Get in Touch
                <ArrowRight className="w-5 h-5" />
              </a>
              <Link 
                href="/articles" 
                className="inline-flex items-center gap-2 px-8 py-4 border border-white/20 hover:border-white/40 rounded-lg transition"
              >
                Read Articles
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/10 py-8">
          <div className="max-w-4xl mx-auto px-6 text-center text-slate-500 text-sm">
            <p>© {new Date().getFullYear()} Alex Welcing. Built with Next.js.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
