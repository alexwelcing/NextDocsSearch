import React from 'react';
import Image from 'next/image';
import styled from 'styled-components';

const ImageWrapper = styled.div`
  position: relative;
  width: 100%;
  height: auto;
  margin: 2rem 0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);

  span {
    position: unset !important;
  }

  img {
    object-fit: contain;
    width: 100% !important;
    position: relative !important;
    height: unset !important;
  }
`;

interface MarkdownImageProps {
  src?: string;
  alt?: string;
  title?: string;
}

const MarkdownImage: React.FC<MarkdownImageProps> = ({ src, alt, title }) => {
  if (!src) return null;

  // If it's an external URL, we might need to configure domains in next.config.js
  // For now, we assume it's handled or we use unoptimized if needed, 
  // but ideally we want to use next/image optimization.
  
  return (
    <ImageWrapper>
      <Image
        src={src}
        alt={alt || ''}
        title={title}
        width={800}
        height={450}
        style={{
          maxWidth: '100%',
          height: 'auto',
        }}
        sizes="(max-width: 768px) 100vw, 800px"
      />
    </ImageWrapper>
  );
};

export default MarkdownImage;
