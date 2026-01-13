import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import ArticleDiscovery from '@/components/ui/ArticleDiscovery';
import CircleNav from '@/components/ui/CircleNav';
import StructuredData from '@/components/StructuredData';

export default function ArticlesIndex() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#e5e5e5',
    }}>
      <Head>
        <title>Research & Analysis | Alex Welcing</title>
        <meta
          name="description"
          content="Research on speculative AI futures, emergent intelligence, and systemic consequences of abundant cognition. Original frameworks and scenario analysis."
        />
        <meta
          name="keywords"
          content="speculative AI, AI research, emergent intelligence, AI futures, AI systems analysis"
        />
        <link rel="canonical" href="https://alexwelcing.com/articles" />
        <meta property="og:title" content="Research & Analysis | Alex Welcing" />
        <meta property="og:description" content="Research on speculative AI futures, emergent intelligence, and systemic consequences of abundant cognition." />
        <meta property="og:url" content="https://alexwelcing.com/articles" />
        <meta property="og:type" content="website" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: "Speculative AI Research - Alex Welcing",
          url: "https://alexwelcing.com/articles",
          description: "Research on speculative AI futures, emergent intelligence, and systemic consequences.",
          author: {
            "@type": "Person",
            name: "Alex Welcing"
          }
        }}
      />

      <CircleNav />

      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '80px 24px 48px',
      }}>
        {/* Header */}
        <header style={{
          marginBottom: '48px',
          borderBottom: '1px solid #222',
          paddingBottom: '32px',
        }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            fontFamily: 'monospace',
            color: '#fff',
            margin: '0 0 16px 0',
            letterSpacing: '-0.02em',
          }}>
            RESEARCH
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: '#888',
            fontFamily: 'monospace',
            margin: 0,
            maxWidth: '600px',
            lineHeight: 1.6,
          }}>
            Exploring how reality reorganizes when intelligence becomes abundant.
          </p>
        </header>

        {/* Navigation Tags */}
        <nav style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '40px',
        }}>
          {[
            { href: '/speculative-ai', label: 'Speculative AI' },
            { href: '/agent-futures', label: 'Agent Futures' },
            { href: '/emergent-intelligence', label: 'Emergent Intelligence' },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid #333',
                color: '#888',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                textDecoration: 'none',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                transition: 'all 0.15s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#fff';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#333';
                e.currentTarget.style.color = '#888';
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Articles */}
        <section>
          <ArticleDiscovery />
        </section>

        {/* Footer Navigation */}
        <footer style={{
          marginTop: '64px',
          paddingTop: '32px',
          borderTop: '1px solid #222',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <Link
            href="/"
            style={{
              padding: '12px 24px',
              background: '#fff',
              color: '#000',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              textDecoration: 'none',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Back to Home
          </Link>
          <span style={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: '#555',
          }}>
            alexwelcing.com
          </span>
        </footer>
      </main>
    </div>
  );
}
