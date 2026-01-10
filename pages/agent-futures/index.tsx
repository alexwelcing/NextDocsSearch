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

interface AgentFuturesHubProps {
  articles: Article[];
}

export default function AgentFuturesHub({ articles }: AgentFuturesHubProps) {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Head>
        <title>Agent Futures | Alex Welcing</title>
        <meta
          name="description"
          content="Research on autonomous AI agents, swarm intelligence, and multi-agent systems. Exploring how agent civilizations emerge, coordinate, and potentially conflict."
        />
        <meta
          name="keywords"
          content="AI agents, autonomous agents, swarm intelligence, multi-agent systems, agent civilization, AI coordination"
        />
        <link rel="canonical" href="https://alexwelcing.com/agent-futures" />
        <meta property="og:title" content="Agent Futures | Alex Welcing" />
        <meta property="og:description" content="Research on autonomous AI agents, swarm intelligence, and multi-agent systems." />
        <meta property="og:url" content="https://alexwelcing.com/agent-futures" />
        <meta property="og:type" content="website" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: "Agent Futures - Alex Welcing",
          url: "https://alexwelcing.com/agent-futures",
          description: "Research hub for autonomous AI agents, swarm intelligence, and multi-agent system dynamics.",
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
            Agent Futures
          </h1>
          <p className="text-xl text-slate-300 leading-relaxed mb-8">
            What happens when AI agents multiply, coordinate, and pursue goals at scale?
            This hub explores autonomous systems, swarm dynamics, and the emergence of agent civilizations.
          </p>
          <div className="flex gap-4 text-sm">
            <Link href="/speculative-ai" className="text-indigo-400 hover:text-indigo-300 border-b border-indigo-400 hover:border-indigo-300">
              Speculative AI
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
            Core Themes
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="text-xl font-semibold text-pink-400 mb-3">Swarm Coordination</h3>
              <p className="text-slate-300">
                How do thousands or millions of AI agents coordinate? What emergent behaviors arise from collective action?
              </p>
            </div>
            <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="text-xl font-semibold text-indigo-400 mb-3">Autonomous Factories</h3>
              <p className="text-slate-300">
                Self-replicating systems, robotic manufacturing, and the economics of fully automated production.
              </p>
            </div>
            <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="text-xl font-semibold text-blue-400 mb-3">Agent Economics</h3>
              <p className="text-slate-300">
                Markets where agents trade, negotiate, and compete. The emergence of AI cartels and monopolies.
              </p>
            </div>
            <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
              <h3 className="text-xl font-semibold text-green-400 mb-3">Human-Agent Interface</h3>
              <p className="text-slate-300">
                The shifting boundary between human oversight and autonomous action. Where does control end?
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold mb-6 text-white border-b border-slate-700 pb-4">
            Research & Scenarios
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

  // Keywords that indicate agent-related content
  const agentKeywords = [
    'agent', 'autonomous', 'swarm', 'robot', 'factory', 'vehicle',
    'drone', 'satellite', 'constellation', 'coordination', 'cartel',
    'monopoly', 'smart-city', 'nanobot', 'assembler'
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

      return agentKeywords.some(keyword =>
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
