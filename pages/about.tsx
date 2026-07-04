// About page: crawlable bio as semantic HTML. The immersive app resolves /about in-scene.

import Head from 'next/head'
import Link from 'next/link'
import StructuredData from '@/components/StructuredData'
import { SITE_URL } from '@/lib/site-url'

export default function AboutPage() {
  const url = `${SITE_URL}/about`
  const title = 'Alex Welcing — Northeast AI Product Leader in New York'
  const description =
    'Alex Welcing is a New York-based Northeast AI product leader with 15 years of experience shipping enterprise AI, LegalTech, HealthTech, SaaS, and immersive product systems.'
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={`${SITE_URL}/social-preview.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
      </Head>
      <StructuredData
        type="Person"
        data={{
          name: 'Alex Welcing',
          url: SITE_URL,
          jobTitle: 'Northeast AI Product Leader',
          worksFor: { '@type': 'Organization', name: 'ALM' },
          description:
            'New York-based Northeast AI product leader with 15 years of experience shipping enterprise AI, LegalTech AI, HealthTech AI, regulated SaaS, and immersive product systems.',
          sameAs: ['https://www.linkedin.com/in/alexwelcing', 'https://github.com/alexwelcing'],
        }}
      />
      <main className="arc-feed">
        <nav aria-label="Breadcrumb">
          <Link href="/">Alex Welcing</Link> / About
        </nav>
        <header>
          <h1>Alex Welcing</h1>
          <p>
            Northeast AI product leader with 15 years of experience shipping enterprise AI,
            regulated SaaS, and immersive product systems. Based in New York, NY. Currently at ALM.
          </p>
        </header>
        <section>
          <h2>About</h2>
          <p>
            15 years of experience shipping AI features, enterprise SaaS platforms, and regulated
            product systems across New York and the Northeast. Currently at ALM, an integrated
            media company serving the legal and commercial real estate sectors.
          </p>
          <p>
            My background spans both technical development and marketing strategy, with a track
            record of translating complex customer needs into measurable outcomes. I have hands-on
            experience building secure SaaS platforms, optimizing data pipelines, and launching
            AI-driven features in regulated industries.
          </p>
        </section>
        <section>
          <h2>Experience</h2>
          <h3>Product Manager — ALM (Jan 2024 — Present)</h3>
          <p>
            Steer product strategy and delivery for an integrated media company providing
            specialized business information to the legal and commercial real estate sectors.
            Translate complex customer needs into measurable outcomes.
          </p>
          <h3>Product Manager — Obsess</h3>
          <ul>
            <li>Launched cutting-edge SaaS platforms and immersive VR capabilities</li>
            <li>Optimized data pipelines with Google Analytics 4 integration</li>
            <li>Enabled real-time 3D rendering across mobile, headset, and desktop</li>
          </ul>
          <h3>Developer — Manatt, Phelps &amp; Phillips, LLP</h3>
          <ul>
            <li>Built a secure client SaaS platform for legal and regulatory analysis</li>
            <li>Implemented AI-driven document scanning capabilities</li>
            <li>Developed knowledge/training portal that delivered strong ROI</li>
          </ul>
          <h3>Developer — Arkadium</h3>
          <p>
            Drove business development in artificial intelligence and built NLP-powered interactive
            content partnerships.
          </p>
        </section>
        <section>
          <h2>Expertise</h2>
          <ul>
            <li>SaaS platforms: product strategy, platform development, and scaling B2B solutions</li>
            <li>VR and 3D: immersive experiences, real-time rendering across mobile/headset/desktop</li>
            <li>Data and analytics: pipeline optimization, GA4 integration, data-driven decisions</li>
            <li>
              Legal tech: secure client platforms, regulatory analysis tools, AI-driven document
              processing
            </li>
          </ul>
        </section>
        <section>
          <h2>Education</h2>
          <p>
            BS in Marketing, Naveen Jindal School of Management, UT Dallas. Combined technical
            development expertise with marketing strategy and business fundamentals.
          </p>
        </section>
        <section>
          <h2>Technical background</h2>
          <p>
            With 15 years of experience across product, coding, software development, and
            AI-enabled platform work, I bring hands-on technical depth to product leadership. This
            site itself demonstrates those capabilities. Working stack: React, TypeScript, Node.js,
            Python, Next.js, Three.js, SQL, AWS.
          </p>
        </section>
        <section>
          <h2>Connect</h2>
          <ul>
            <li>
              <a href="mailto:alexwelcing@gmail.com">alexwelcing@gmail.com</a>
            </li>
            <li>
              <a href="https://linkedin.com/in/alexwelcing">LinkedIn</a>
            </li>
            <li>
              <a href="https://github.com/alexwelcing">GitHub</a>
            </li>
            <li>
              <Link href="/articles">Read the archive</Link>
            </li>
          </ul>
        </section>
      </main>
    </>
  )
}
