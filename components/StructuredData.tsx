import React from 'react';
import Head from 'next/head';

export type StructuredDataType = 'Article' | 'Person' | 'Website' | 'Organization' | 'BreadcrumbList';

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

export default StructuredData;
