import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import styled from 'styled-components';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MultiArtOption } from '@/lib/article-images';

interface ArticleImageGalleryProps {
  images: MultiArtOption[];
  articleTitle: string;
}

const GallerySection = styled.section`
  margin: 60px 0;
  padding: 30px;
  background: rgba(0, 212, 255, 0.03);
  border: 1px solid rgba(0, 212, 255, 0.15);
  border-radius: 12px;
`;

const GalleryHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  font-family: 'Monaco', 'Courier New', monospace;
  color: #00d4ff;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;

  &::before {
    content: '>';
    color: #00d4ff;
  }
`;

const GalleryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }
`;

const GalleryItem = styled.button`
  position: relative;
  aspect-ratio: 16 / 10;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(0, 212, 255, 0.2);
  background: #0a0a0a;
  cursor: pointer;
  padding: 0;
  transition: all 0.3s ease;

  &:hover {
    border-color: #00d4ff;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 212, 255, 0.15);
  }

  &:focus-visible {
    outline: 2px solid #00d4ff;
    outline-offset: 2px;
  }
`;

const ModelLabel = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20px 12px 8px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.7rem;
  color: #00d4ff;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left;
  pointer-events: none;
  z-index: 1;
`;

const LightboxOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
`;

const LightboxContent = styled.div`
  position: relative;
  width: 90vw;
  height: 80vh;
  max-width: 1200px;
`;

const LightboxImageWrapper = styled.div`
  position: relative;
  width: 100%;
  height: calc(100% - 48px);
  border-radius: 8px;
  overflow: hidden;
`;

const LightboxMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 48px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.8rem;
  color: #888;
`;

const LightboxModelName = styled.span`
  color: #00d4ff;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const LightboxNav = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(0, 212, 255, 0.3);
  color: #00d4ff;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 2;

  &:hover {
    background: rgba(0, 212, 255, 0.15);
    border-color: #00d4ff;
  }
`;

const LightboxClose = styled.button`
  position: absolute;
  top: -48px;
  right: 0;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 8px;
  transition: color 0.2s;

  &:hover {
    color: #fff;
  }
`;

export default function ArticleImageGallery({ images, articleTitle }: ArticleImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const goNext = useCallback(() => {
    setLightboxIndex(prev => prev !== null ? (prev + 1) % images.length : null);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setLightboxIndex(prev => prev !== null ? (prev - 1 + images.length) % images.length : null);
  }, [images.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };

    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, closeLightbox, goNext, goPrev]);

  if (images.length === 0) return null;

  const formatModel = (model: string) => model.replace(/-/g, ' ');

  return (
    <>
      <GallerySection>
        <GalleryHeader>AI Art Variations ({images.length})</GalleryHeader>
        <GalleryGrid>
          {images.map((img, i) => (
            <GalleryItem
              key={img.path}
              onClick={() => setLightboxIndex(i)}
              aria-label={`View ${formatModel(img.model)} variation`}
            >
              <Image
                src={img.path}
                alt={`${articleTitle} - ${formatModel(img.model)}`}
                fill
                style={{ objectFit: 'cover' }}
                sizes="(max-width: 768px) 50vw, 300px"
              />
              <ModelLabel>{formatModel(img.model)}</ModelLabel>
            </GalleryItem>
          ))}
        </GalleryGrid>
      </GallerySection>

      {lightboxIndex !== null && (
        <LightboxOverlay onClick={closeLightbox}>
          <LightboxContent onClick={e => e.stopPropagation()}>
            <LightboxClose onClick={closeLightbox} aria-label="Close">
              <X size={24} />
            </LightboxClose>

            <LightboxImageWrapper>
              <Image
                src={images[lightboxIndex].path}
                alt={`${articleTitle} - ${formatModel(images[lightboxIndex].model)}`}
                fill
                style={{ objectFit: 'contain' }}
                sizes="90vw"
                priority
              />
            </LightboxImageWrapper>

            <LightboxMeta>
              <span>{lightboxIndex + 1} / {images.length}</span>
              <LightboxModelName>{formatModel(images[lightboxIndex].model)}</LightboxModelName>
            </LightboxMeta>

            {images.length > 1 && (
              <>
                <LightboxNav style={{ left: -56 }} onClick={goPrev} aria-label="Previous">
                  <ChevronLeft size={20} />
                </LightboxNav>
                <LightboxNav style={{ right: -56 }} onClick={goNext} aria-label="Next">
                  <ChevronRight size={20} />
                </LightboxNav>
              </>
            )}
          </LightboxContent>
        </LightboxOverlay>
      )}
    </>
  );
}
