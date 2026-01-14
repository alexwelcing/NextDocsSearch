import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import styled from 'styled-components';
import { ChevronLeft, ChevronRight, X, Image as ImageIcon, Zap } from 'lucide-react';
import { ArticleImage, AllImagesResponse } from '@/pages/api/media/all-images';

interface ArticleImageSlideshowProps {
  articleSlug: string;
}

const SlideshowWrapper = styled.div<{ $hasImages: boolean }>`
  position: relative;
  width: 100%;
  margin: 40px 0;
  display: ${props => props.$hasImages ? 'block' : 'none'};
`;

const SlideshowHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
`;

const SlideshowTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: #00d4ff;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;

  svg {
    width: 20px;
    height: 20px;
  }
`;

const ImageCounter = styled.span`
  font-size: 0.9rem;
  color: #9ca3af;
`;

const SlideshowContainer = styled.div`
  position: relative;
  width: 100%;
  height: 500px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(0, 212, 255, 0.2);

  @media (max-width: 768px) {
    height: 300px;
  }
`;

const SlideImage = styled.div<{ $isActive: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: ${props => props.$isActive ? 1 : 0};
  transition: opacity 0.5s ease-in-out;
  pointer-events: ${props => props.$isActive ? 'auto' : 'none'};
`;

const ImageWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  cursor: pointer;
`;

const ImageOverlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  color: white;
`;

const ImageTitle = styled.div`
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;

  svg {
    width: 16px;
    height: 16px;
    color: #ffd700;
  }
`;

const ImageCaption = styled.div`
  font-size: 0.85rem;
  color: #d1d5db;
`;

const NavButton = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(0, 212, 255, 0.4);
  color: #00d4ff;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 10;

  &:hover {
    background: rgba(0, 212, 255, 0.2);
    border-color: #00d4ff;
    transform: translateY(-50%) scale(1.1);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  svg {
    width: 24px;
    height: 24px;
  }

  @media (max-width: 768px) {
    width: 40px;
    height: 40px;

    svg {
      width: 20px;
      height: 20px;
    }
  }
`;

const PrevButton = styled(NavButton)`
  left: 20px;
`;

const NextButton = styled(NavButton)`
  right: 20px;
`;

const ThumbnailStrip = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 20px;
  overflow-x: auto;
  padding: 10px 0;

  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 212, 255, 0.4);
    border-radius: 3px;

    &:hover {
      background: rgba(0, 212, 255, 0.6);
    }
  }
`;

const Thumbnail = styled.button<{ $isActive: boolean }>`
  flex-shrink: 0;
  width: 100px;
  height: 70px;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid ${props => props.$isActive ? '#00d4ff' : 'rgba(0, 212, 255, 0.2)'};
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  background: rgba(0, 0, 0, 0.3);

  &:hover {
    border-color: #00d4ff;
    transform: scale(1.05);
  }

  @media (max-width: 768px) {
    width: 80px;
    height: 56px;
  }
`;

const TypeBadge = styled.div<{ $type: 'media' | 'artwork' }>`
  position: absolute;
  top: 4px;
  right: 4px;
  background: ${props => props.$type === 'artwork' ? 'rgba(255, 215, 0, 0.9)' : 'rgba(0, 212, 255, 0.9)'};
  color: #000;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 2px;

  svg {
    width: 10px;
    height: 10px;
  }
`;

const FullscreenModal = styled.div<{ $isOpen: boolean }>`
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 9999;
  align-items: center;
  justify-content: center;
  padding: 40px;

  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const FullscreenImage = styled.div`
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  width: auto;
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(0, 212, 255, 0.4);
  color: #00d4ff;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 10000;

  &:hover {
    background: rgba(0, 212, 255, 0.2);
    border-color: #00d4ff;
  }

  svg {
    width: 24px;
    height: 24px;
  }
`;

const LoadingState = styled.div`
  width: 100%;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  border: 1px solid rgba(0, 212, 255, 0.2);
  color: #9ca3af;
  font-size: 1rem;
`;

const ArticleImageSlideshow: React.FC<ArticleImageSlideshowProps> = ({ articleSlug }) => {
  const [images, setImages] = useState<ArticleImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debugMode, setDebugMode] = useState(false); // Toggle with keyboard shortcut

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const response = await fetch(`/api/media/all-images?slug=${articleSlug}`);
        const data: AllImagesResponse = await response.json();

        console.log(`[ArticleImageSlideshow] Fetched ${data.count} images for article: ${articleSlug}`);

        if (data.success && data.images.length > 0) {
          console.log('[ArticleImageSlideshow] Images:', data.images.map(img => ({
            id: img.id,
            type: img.type,
            url: img.url.substring(0, 80) + '...',
            hasStorage: img.url.includes('supabase.co'),
          })));

          setImages(data.images);

          // If there's a selected image, show it first
          if (data.selectedImage) {
            console.log('[ArticleImageSlideshow] Selected image:', data.selectedImage.id);
            const selectedIndex = data.images.findIndex(img => img.id === data.selectedImage?.id);
            if (selectedIndex !== -1) {
              setCurrentIndex(selectedIndex);
            }
          }
        } else {
          console.log('[ArticleImageSlideshow] No images found or API returned error:', data.error);
        }
      } catch (error) {
        console.error('[ArticleImageSlideshow] Error fetching images:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [articleSlug]);

  const goToPrevious = React.useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const goToNext = React.useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  const goToImage = (index: number) => {
    setCurrentIndex(index);
  };

  const openFullscreen = () => {
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  // Keyboard navigation and debug toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Debug mode toggle (Shift+D)
      if (e.shiftKey && e.key === 'D') {
        setDebugMode(prev => !prev);
        console.log('[ArticleImageSlideshow] Debug mode:', !debugMode);
        return;
      }

      if (!isFullscreen || images.length === 0) return;

      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'Escape') closeFullscreen();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, images.length, goToPrevious, goToNext, debugMode]);

  if (loading) {
    return <LoadingState>Loading images...</LoadingState>;
  }

  if (images.length === 0) {
    return null;
  }

  const currentImage = images[currentIndex];

  return (
    <>
      <SlideshowWrapper $hasImages={images.length > 0}>
        <SlideshowHeader>
          <SlideshowTitle>
            <ImageIcon />
            Article Gallery {debugMode && '🔍'}
          </SlideshowTitle>
          <ImageCounter>
            {currentIndex + 1} / {images.length}
          </ImageCounter>
        </SlideshowHeader>

        {debugMode && (
          <div style={{
            background: 'rgba(255, 215, 0, 0.1)',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            padding: '12px',
            marginBottom: '16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: '#ffd700'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Debug Info (Press Shift+D to toggle):</div>
            <div>Total images: {images.length}</div>
            <div>Article slug: {articleSlug}</div>
            {images.map((img, i) => (
              <div key={img.id} style={{ marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
                <div>#{i + 1} - {img.type.toUpperCase()} - {img.id}</div>
                <div style={{ wordBreak: 'break-all', fontSize: '0.75rem', color: '#9ca3af' }}>
                  {img.url}
                </div>
              </div>
            ))}
          </div>
        )}

        <SlideshowContainer>
          {images.map((image, index) => (
            <SlideImage key={image.id} $isActive={index === currentIndex}>
              <ImageWrapper onClick={openFullscreen}>
                {/* Using regular img tag for better debugging */}
                <img
                  src={image.url}
                  alt={image.alt_text || image.title || 'Article image'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                  onError={(e) => {
                    console.error('[ArticleImageSlideshow] Failed to load image:', image.url);
                    console.error('[ArticleImageSlideshow] Error event:', e);
                  }}
                  onLoad={() => {
                    console.log('[ArticleImageSlideshow] Successfully loaded image:', image.url);
                  }}
                />
                <ImageOverlay>
                  <ImageTitle>
                    {image.type === 'artwork' && <Zap />}
                    {image.title || 'Untitled'}
                  </ImageTitle>
                  {image.caption && <ImageCaption>{image.caption}</ImageCaption>}
                  {debugMode && (
                    <ImageCaption style={{ marginTop: '8px', fontSize: '0.7rem', wordBreak: 'break-all' }}>
                      URL: {image.url}
                    </ImageCaption>
                  )}
                </ImageOverlay>
              </ImageWrapper>
            </SlideImage>
          ))}

          {images.length > 1 && (
            <>
              <PrevButton onClick={goToPrevious}>
                <ChevronLeft />
              </PrevButton>
              <NextButton onClick={goToNext}>
                <ChevronRight />
              </NextButton>
            </>
          )}
        </SlideshowContainer>

        {images.length > 1 && (
          <ThumbnailStrip>
            {images.map((image, index) => (
              <Thumbnail
                key={image.id}
                $isActive={index === currentIndex}
                onClick={() => goToImage(index)}
              >
                <img
                  src={image.url}
                  alt={image.title || 'Thumbnail'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                  onError={(e) => {
                    console.error('[ArticleImageSlideshow] Failed to load thumbnail:', image.url);
                  }}
                />
                <TypeBadge $type={image.type}>
                  {image.type === 'artwork' ? <Zap /> : <ImageIcon />}
                  {image.type === 'artwork' ? 'AI' : 'IMG'}
                </TypeBadge>
              </Thumbnail>
            ))}
          </ThumbnailStrip>
        )}
      </SlideshowWrapper>

      <FullscreenModal $isOpen={isFullscreen} onClick={closeFullscreen}>
        <CloseButton onClick={closeFullscreen}>
          <X />
        </CloseButton>
        <FullscreenImage onClick={(e) => e.stopPropagation()}>
          {currentImage && (
            <img
              src={currentImage.url}
              alt={currentImage.alt_text || currentImage.title || 'Fullscreen image'}
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                display: 'block'
              }}
              onError={(e) => {
                console.error('[ArticleImageSlideshow] Failed to load fullscreen image:', currentImage.url);
              }}
            />
          )}
        </FullscreenImage>
        {images.length > 1 && (
          <>
            <PrevButton onClick={(e) => { e.stopPropagation(); goToPrevious(); }} style={{ left: '40px' }}>
              <ChevronLeft />
            </PrevButton>
            <NextButton onClick={(e) => { e.stopPropagation(); goToNext(); }} style={{ right: '40px' }}>
              <ChevronRight />
            </NextButton>
          </>
        )}
      </FullscreenModal>
    </>
  );
};

export default ArticleImageSlideshow;
