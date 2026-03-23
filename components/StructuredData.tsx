import React from 'react';
import Head from 'next/head';
import { SITE_URL } from '@/lib/site-url';

const siteUrl = SITE_URL;

export type StructuredDataType =
  | 'Article'
  | 'Person'
  | 'Website'
  | 'Organization'
  | 'BreadcrumbList'
  | 'WebPage'
  | 'CollectionPage'
  | 'VideoObject';

interface StructuredDataProps {
  type: StructuredDataType;
  data: Record<string, any>;
}

const StructuredData: React.FC<StructuredDataProps> = ({ type, data }) => {
  const jsonLD = {
    '@context': 'https://schema.org',
    '@type': type,
    ...data,
  };

  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLD) }}
      />
    </Head>
  );
};

// Helper to create Article schema (not BlogPosting - Article is more encyclopedic)
export const createArticleSchema = ({
  title,
  description,
  author,
  datePublished,
  dateModified,
  image,
  url,
  articleSection,
}: {
  title: string;
  description: string;
  author: string | string[];
  datePublished: string;
  dateModified?: string;
  image?: string;
  url: string;
  articleSection?: string;
}) => ({
  headline: title,
  description,
  image: image || `${siteUrl}/social-preview.png`,
  datePublished,
  dateModified: dateModified || datePublished,
  url,
  articleSection: articleSection || 'Speculative AI Research',
  author: Array.isArray(author)
    ? author.map((name) => ({
        '@type': 'Person',
        name,
        url: `${siteUrl}/about`,
      }))
    : {
        '@type': 'Person',
        name: author,
        url: `${siteUrl}/about`,
      },
  publisher: {
    '@type': 'Organization',
    name: 'Alex Welcing',
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/logo.png`,
    },
  },
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': url,
  },
});

// Helper to create Person schema
export const createPersonSchema = ({
  name,
  jobTitle,
  description,
  sameAs,
  knowsAbout,
}: {
  name: string;
  jobTitle: string;
  description: string;
  sameAs?: string[];
  knowsAbout?: string[];
}) => ({
  name,
  jobTitle,
  url: siteUrl,
  description,
  sameAs: sameAs || [
    'https://www.linkedin.com/in/alexwelcing',
    'https://github.com/alexwelcing',
    'https://x.com/alexwelcing',
  ],
  knowsAbout: knowsAbout || [
    'Speculative AI Systems',
    'Emergent Intelligence',
    'AI Product Management',
  ],
});

// Helper to create VideoObject schema for Google Video indexing
export const createVideoSchema = ({
  name,
  description,
  thumbnailUrl,
  uploadDate,
  duration,
  watchPageUrl,
  articleUrl,
  contentUrl,
  embedUrl,
}: {
  name: string
  description: string
  thumbnailUrl: string
  uploadDate: string
  duration?: number // seconds
  watchPageUrl: string
  articleUrl?: string
  contentUrl?: string
  embedUrl?: string
}) => ({
  name,
  description,
  thumbnailUrl: [thumbnailUrl],
  uploadDate,
  // Include contentUrl for direct media files and pass through embedUrl when the caller has a known player URL.
  ...(contentUrl && { contentUrl }),
  ...(embedUrl && { embedUrl }),
  ...(duration && { duration: `PT${Math.floor(duration / 60)}M${duration % 60}S` }),
  publisher: {
    '@type': 'Organization',
    name: 'Alex Welcing',
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/logo.png`,
    },
  },
  url: watchPageUrl,
  mainEntityOfPage: watchPageUrl,
  ...(articleUrl && {
    isPartOf: {
      '@type': 'Article',
      '@id': articleUrl,
    },
  }),
  potentialAction: {
    '@type': 'WatchAction',
    target: watchPageUrl,
  },
})

export default StructuredData;
