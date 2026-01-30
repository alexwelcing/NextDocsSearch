import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import ArticleDiscovery from '@/components/ui/ArticleDiscovery';
import StructuredData from '@/components/StructuredData';

export default function ArticlesIndex() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#e5e5e5',
    }}>
      <Head>
        <title>Articles | Alex Welcing - AI Strategy & Product Leadership</title>
        <meta
          name="description"
          content="Research on AI strategy, product management, speculative futures, and emergent intelligence systems. Expert insights and practical frameworks."
        />
        <meta
          name="keywords"
          content="AI strategy, product management, speculative AI, emergent intelligence, ML systems, AI research"
        />
        <link rel="canonical" href="https://alexwelcing.com/articles" />
        
        {/* Open Graph */}
        <meta property="og:title" content="Articles | Alex Welcing" />
        <meta property="og:description" content="Research on AI strategy, product management, and speculative futures." />
        <meta property="og:url" content="https://alexwelcing.com/articles" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://alexwelcing.com/social-preview.png" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Articles | Alex Welcing" />
        <meta name="twitter:description" content="Research on AI strategy, product management, and speculative futures." />
        
        {/* RSS */}
        <link rel="alternate" type="application/rss+xml" title="Alex Welcing Articles" href="https://alexwelcing.com/api/rss" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: "Alex Welcing - Articles",
          url: "https://alexwelcing.com/articles",
          description: "Research on AI strategy, product management, and speculative futures.",
          author: {
            "@type": "Person",
            name: "Alex Welcing",
            url: "https://alexwelcing.com/about"
          }
        }}
      />

      {/* Simple Header */}
      <header style={{
        borderBottom: '1px solid #222',
        padding: '16px 0',
      }}>
        <nav style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Link href="/" style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: '#fff',
            textDecoration: 'none',
          }}>
            ALEX WELCING
          </Link>
          <div style={{
            display: 'flex',
            gap: '24px',
            fontSize: '0.9rem',
          }}>
            <Link href="/" style={{ color: '#888', textDecoration: 'none' }}>Home</Link>
            <Link href="/about" style={{ color: '#888', textDecoration: 'none' }}>About</Link>
            <Link href="/chat" style={{ color: '#888', textDecoration: 'none' }}>Chat</Link>
            <a href="/api/rss" style={{ color: '#888', textDecoration: 'none' }}>RSS</a>
          </div>
        </nav>
      </header>

      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '60px 24px 48px',
      }}>
        {/* Header */}
        <header style={{
          marginBottom: '48px',
          paddingBottom: '32px',
          borderBottom: '1px solid #222',
        }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            color: '#fff',
            margin: '0 0 16px 0',
            letterSpacing: '-0.02em',
          }}>
            Articles
          </h1>
          <p style={{
            fontSize: '1.1rem',
            color: '#888',
            margin: 0,
            maxWidth: '600px',
            lineHeight: 1.6,
          }}>
            Exploring AI strategy, product leadership, and speculative futures. 
            New articles published every 4 hours.
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
