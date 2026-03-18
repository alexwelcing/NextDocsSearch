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
  contentUrl,
  uploadDate,
  duration,
  articleUrl,
}: {
  name: string
  description: string
  thumbnailUrl: string
  contentUrl: string
  uploadDate: string
  duration?: number // seconds
  articleUrl: string
}) => ({
  name,
  description,
  thumbnailUrl: [thumbnailUrl],
  contentUrl,
  uploadDate,
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
  url: articleUrl,
  embedUrl: articleUrl,
  mainEntityOfPage: articleUrl,
  interactionStatistic: {
    '@type': 'InteractionCounter',
    interactionType: { '@type': 'WatchAction' },
    userInteractionCount: 0,
  },
})

export default StructuredData;
