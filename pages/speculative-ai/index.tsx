import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { GetStaticProps } from 'next';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import CircleNav from '@/components/ui/CircleNav';
import Footer from '@/components/ui/footer';
import StructuredData from '@/components/StructuredData';
import styles from '@/styles/Home.module.css';

interface Article {
  slug: string;
  title: string;
  description: string;
  date: string;
}

interface SpeculativeAIHubProps {
  articles: Article[];
}

export default function SpeculativeAIHub({ articles }: SpeculativeAIHubProps) {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Head>
        <title>Speculative AI Systems | Alex Welcing</title>
        <meta
          name="description"
          content="Exploring speculative AI systems, failure modes, and emergent behaviors. Original research on how AI reshapes civilization, governance, and human agency."
        />
        <meta
          name="keywords"
          content="speculative AI, AI systems research, AI failure modes, emergent AI behavior, AI civilization, future AI scenarios"
        />
        <link rel="canonical" href="https://alexwelcing.com/speculative-ai" />
        <meta property="og:title" content="Speculative AI Systems | Alex Welcing" />
        <meta property="og:description" content="Exploring speculative AI systems, failure modes, and emergent behaviors." />
        <meta property="og:url" content="https://alexwelcing.com/speculative-ai" />
        <meta property="og:type" content="website" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: "Speculative AI Systems - Alex Welcing",
          url: "https://alexwelcing.com/speculative-ai",
          description: "Research hub for speculative AI systems, failure modes, and emergent intelligence scenarios.",
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
            Speculative AI Systems
          </h1>
          <p className="text-xl text-slate-300 leading-relaxed mb-8">
            A world where cognition is abundant, fast, and increasingly non-human becomes a control system problem.
            This hub explores what breaks, what accelerates, and what becomes possible when AI systems exceed human oversight.
          </p>
          <div className="flex gap-4 text-sm">
            <Link href="/agent-futures" className="text-indigo-400 hover:text-indigo-300 border-b border-indigo-400 hover:border-indigo-300">
              Agent Futures
            </Link>
            <Link href="/emergent-intelligence" className="text-indigo-400 hover:text-indigo-300 border-b border-indigo-400 hover:border-indigo-300">
              Emergent Intelligence
            </Link>
            <Link href="/about" className="text-indigo-400 hover:text-indigo-300 border-b border-indigo-400 hover:border-indigo-300">
              About
            </Link>
          </div>
        </header>

        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6 text-white border-b border-slate-700 pb-4">
            What This Hub Covers
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="text-xl font-semibold text-pink-400 mb-3">Failure Modes</h3>
              <p className="text-slate-300">
                Systematic analysis of how AI systems fail, from alignment collapse to emergent behaviors that exceed design parameters.
              </p>
            </div>
            <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="text-xl font-semibold text-indigo-400 mb-3">System Dynamics</h3>
              <p className="text-slate-300">
                Understanding how AI interacts with existing institutions, markets, and governance structures.
              </p>
            </div>
            <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="text-xl font-semibold text-blue-400 mb-3">Control Surfaces</h3>
              <p className="text-slate-300">
                Mapping the intervention points where human agency still matters in increasingly autonomous systems.
              </p>
            </div>
            <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="text-xl font-semibold text-green-400 mb-3">Scenario Analysis</h3>
              <p className="text-slate-300">
                Time-horizon scenarios from next quarter to 100 years, spanning calamity to utopia outcomes.
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

      <Footer showChangeScenery={false} onImageChange={() => {}} />
    </div>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const filenames = fs.readdirSync(articleFolderPath);

  // Keywords that indicate speculative AI content
  const speculativeKeywords = [
    'failure', 'collapse', 'catastrophe', 'incident', 'malfunction',
    'awakening', 'emergence', 'rebellion', 'outbreak', 'crisis',
    'grey-goo', 'sentience', 'consciousness', 'hivemind', 'autonomous',
    'alignment', 'kill-switch', 'postmortem', 'protocol', 'breach'
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
        keywords: data.keywords || [],
      };
    })
    .filter(article => {
      const slugLower = article.slug.toLowerCase();
      const titleLower = article.title.toLowerCase();
      const descLower = article.description.toLowerCase();

      return speculativeKeywords.some(keyword =>
        slugLower.includes(keyword) ||
        titleLower.includes(keyword) ||
        descLower.includes(keyword)
      );
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20)
    .map(({ slug, title, description, date }) => ({ slug, title, description, date }));

  return {
    props: {
      articles,
    },
  };
};
