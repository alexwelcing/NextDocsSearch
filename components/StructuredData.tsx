import React from 'react';

const StructuredData: React.FC = () => {
  const jsonLD = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    // ... other structured data properties
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLD) }}></script>
  );
};

export default StructuredData;
