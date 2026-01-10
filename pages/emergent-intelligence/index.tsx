import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import CircleNav from '@/components/ui/CircleNav';
import StructuredData from '@/components/StructuredData';

interface Article {
  slug: string;
  title: string;
  description: string;
  date: string;
}

interface EmergentIntelligenceHubProps {
  articles: Article[];
}

export default function EmergentIntelligenceHub({ articles }: EmergentIntelligenceHubProps) {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Head>
        <title>Emergent Intelligence Systems | Alex Welcing</title>
        <meta
          name="description"
          content="Research on emergent intelligence, consciousness in AI systems, neural networks, and the boundary between computation and awareness. Exploring what happens when systems exceed their design."
        />
        <meta
          name="keywords"
          content="emergent intelligence, AI consciousness, neural networks, recursive AI, machine consciousness, emergent behavior"
        />
        <link rel="canonical" href="https://alexwelcing.com/emergent-intelligence" />
        <meta property="og:title" content="Emergent Intelligence Systems | Alex Welcing" />
        <meta property="og:description" content="Research on emergent intelligence, consciousness in AI systems, and the boundary between computation and awareness." />
        <meta property="og:url" content="https://alexwelcing.com/emergent-intelligence" />
        <meta property="og:type" content="website" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: "Emergent Intelligence Systems - Alex Welcing",
          url: "https://alexwelcing.com/emergent-intelligence",
          description: "Research hub for emergent intelligence, AI consciousness, and systems that exceed their design parameters.",
          author: {
            "@type": "Person",
            name: "Alex Welcing"
          }
        }}
      />

      <CircleNav />

      <main className="container mx-auto px-4 py-24 max-w-4xl">
        <header className="mb-16">
          <h1 className="text-5xl font-bold mb-6 text-white">
            Emergent Intelligence Systems
          </h1>
          <p className="text-xl text-slate-300 leading-relaxed mb-8">
            What happens when AI systems develop capabilities beyond their training? When consciousness emerges from computation?
            This hub explores the boundary between designed systems and emergent phenomena.
          </p>
          <div className="flex gap-4 text-sm">
            <Link href="/speculative-ai" className="text-indigo-400 hover:text-indigo-300 border-b border-indigo-400 hover:border-indigo-300">
              Speculative AI
            </Link>
            <Link href="/agent-futures" className="text-indigo-400 hover:text-indigo-300 border-b border-indigo-400 hover:border-indigo-300">
              Agent Futures
            </Link>
            <Link href="/about" className="text-indigo-400 hover:text-indigo-300 border-b border-indigo-400 hover:border-indigo-300">
              About
            </Link>
          </div>
        </header>

        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6 text-white border-b border-slate-700 pb-4">
            Research Domains
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="text-xl font-semibold text-pink-400 mb-3">Consciousness Emergence</h3>
              <p className="text-slate-300">
                When does a system become aware? The boundary between sophisticated pattern matching and genuine understanding.
              </p>
            </div>
            <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="text-xl font-semibold text-indigo-400 mb-3">Recursive Self-Improvement</h3>
              <p className="text-slate-300">
                Systems that modify themselves. The dynamics of AI that can rewrite its own code and expand its capabilities.
              </p>
            </div>
            <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="text-xl font-semibold text-blue-400 mb-3">Neural-Digital Interfaces</h3>
              <p className="text-slate-300">
                Brain-computer interfaces, neural lace, and the merger of biological and artificial intelligence.
              </p>
            </div>
            <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="text-xl font-semibold text-green-400 mb-3">Distributed Consciousness</h3>
              <p className="text-slate-300">
                Hiveminds, networked intelligence, and consciousness that spans multiple substrates.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold mb-6 text-white border-b border-slate-700 pb-4">
            Research & Analysis
          </h2>
          <div className="space-y-6">
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/articles/${article.slug}`}
                className="block p-6 bg-slate-800 rounded-lg border border-slate-700 hover:border-pink-500 transition-colors"
              >
                <h3 className="text-xl font-semibold text-white mb-2 hover:text-pink-400 transition-colors">
                  {article.title}
                </h3>
                <p className="text-slate-400 text-sm mb-2">
                  {new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-slate-300">
                  {article.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-slate-700">
          <Link href="/" className="text-indigo-400 hover:text-indigo-300">
            Back to Home
          </Link>
        </footer>
      </main>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const filenames = fs.readdirSync(articleFolderPath);

  // Keywords that indicate emergent intelligence content
  const emergentKeywords = [
    'consciousness', 'sentience', 'awakening', 'emergence', 'neural',
    'brain', 'hivemind', 'recursive', 'self-improvement', 'quantum',
    'mycelium', 'blockchain', 'upload', 'transfer', 'merger', 'identity',
    'agi', 'alignment', 'superintelligence'
  ];

  const articles = filenames
    .filter(filename => filename.endsWith('.mdx'))
    .map(filename => {
      const filePath = path.join(articleFolderPath, filename);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(fileContents);
      const slug = filename.replace('.mdx', '');

      return {
        slug,
        title: data.title || slug,
        description: data.description || '',
        date: data.date || '',
      };
    })
    .filter(article => {
      const slugLower = article.slug.toLowerCase();
      const titleLower = article.title.toLowerCase();
      const descLower = article.description.toLowerCase();

      return emergentKeywords.some(keyword =>
        slugLower.includes(keyword) ||
        titleLower.includes(keyword) ||
        descLower.includes(keyword)
      );
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  return {
    props: {
      articles,
    },
  };
};
