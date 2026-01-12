import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import styled from 'styled-components';
import { ArticleMediaWithUrl, DESK_PHYSICS } from '@/types/article-media';

/**
 * Props for DeskSurface component
 */
interface DeskSurfaceProps {
  articleSlug: string;
  className?: string;
  onMediaClick?: (media: ArticleMediaWithUrl) => void;
  editable?: boolean; // If true, positions can be saved back to DB
  onPositionUpdate?: (mediaId: number, position: {
    position_x: number;
    position_y: number;
    rotation: number;
    scale: number;
    z_index: number;
  }) => void;
}

/**
 * Individual media item on the desk
 */
interface DeskMediaItemProps {
  media: ArticleMediaWithUrl;
  containerWidth: number;
  containerHeight: number;
  onDragEnd: (mediaId: number, x: number, y: number) => void;
  onClick?: () => void;
  editable?: boolean;
}

const DeskSurfaceContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;

  /* Desk surface with subtle texture */
  background: linear-gradient(
      135deg,
      rgba(30, 30, 35, 0.97) 0%,
      rgba(20, 20, 25, 0.97) 100%
    ),
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.02) 0px,
      transparent 1px,
      transparent 40px,
      rgba(255, 255, 255, 0.02) 41px
    ),
    repeating-linear-gradient(
      0deg,
      rgba(255, 255, 255, 0.02) 0px,
      transparent 1px,
      transparent 40px,
      rgba(255, 255, 255, 0.02) 41px
    );

  /* Perspective for 3D effect */
  perspective: 1200px;
  perspective-origin: 50% 50%;
`;

const MediaItem = styled(motion.div)<{ $zIndex: number; $editable: boolean }>`
  position: absolute;
  pointer-events: auto;
  cursor: ${props => props.$editable ? 'grab' : 'pointer'};
  z-index: ${props => props.$zIndex};

  /* 3D transform styles */
  transform-style: preserve-3d;
  will-change: transform;

  /* Shadow for depth */
  filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.5))
    drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3));

  &:hover {
    filter: drop-shadow(0 15px 40px rgba(0, 174, 239, 0.3))
      drop-shadow(0 2px 5px rgba(0, 0, 0, 0.4));
    z-index: 999;
  }

  &:active {
    cursor: ${props => props.$editable ? 'grabbing' : 'pointer'};
    filter: drop-shadow(0 20px 50px rgba(0, 174, 239, 0.4))
      drop-shadow(0 3px 8px rgba(0, 0, 0, 0.5));
  }
`;

const MediaImage = styled.img`
  max-width: 300px;
  max-height: 250px;
  width: auto;
  height: auto;
  border-radius: 4px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);

  /* Slight aging effect */
  filter: contrast(1.05) saturate(0.95);
`;

const MediaVideo = styled.video`
  max-width: 350px;
  max-height: 280px;
  width: auto;
  height: auto;
  border-radius: 4px;
  border: 2px solid rgba(0, 174, 239, 0.2);
  background: rgba(0, 0, 0, 0.5);
`;

const MediaCaption = styled.div`
  position: absolute;
  bottom: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: rgba(255, 255, 255, 0.9);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 11px;
  font-family: 'Courier New', monospace;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;

  ${MediaItem}:hover & {
    opacity: 1;
  }
`;

/**
 * Individual draggable media item
 */
const DeskMediaItem: React.FC<DeskMediaItemProps> = ({
  media,
  containerWidth,
  containerHeight,
  onDragEnd,
  onClick,
  editable = false,
}) => {
  const controls = useAnimation();
  const [isDragging, setIsDragging] = useState(false);

  // Convert percentage position to pixels
  const initialX = (media.position_x / 100) * containerWidth;
  const initialY = (media.position_y / 100) * containerHeight;

  // Handle drag end
  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);

    // Convert pixel position back to percentage
    const percentX = (info.point.x / containerWidth) * 100;
    const percentY = (info.point.y / containerHeight) * 100;

    onDragEnd(media.id, percentX, percentY);

    // Bounce animation on release
    controls.start({
      scale: media.scale,
      transition: { type: 'spring', stiffness: 300, damping: 20 },
    });
  }, [media.id, media.scale, containerWidth, containerHeight, onDragEnd, controls]);

  return (
    <MediaItem
      drag={editable}
      dragMomentum={true}
      dragElastic={0.1}
      dragConstraints={{ left: 0, right: containerWidth, top: 0, bottom: containerHeight }}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      onClick={!editable ? onClick : undefined}
      animate={controls}
      initial={{
        x: initialX,
        y: initialY,
        scale: media.scale,
        rotate: media.rotation,
        rotateX: -2, // Slight tilt for 3D effect
        rotateY: 0,
      }}
      whileHover={{
        scale: media.scale * 1.05,
        rotateX: -5,
        transition: { duration: 0.2 },
      }}
      $zIndex={media.z_index}
      $editable={editable}
    >
      {media.media_type === 'image' ? (
        <MediaImage
          src={media.public_url}
          alt={media.alt_text || media.title || 'Article media'}
          loading="lazy"
          draggable={false}
        />
      ) : (
        <MediaVideo
          src={media.public_url}
          poster={media.thumbnail_url}
          loop
          muted
          playsInline
          autoPlay={false}
          draggable={false}
        />
      )}

      {(media.caption || media.title) && (
        <MediaCaption>
          {media.caption || media.title}
        </MediaCaption>
      )}
    </MediaItem>
  );
};

/**
 * DeskSurface component - displays article media as documents on a desk
 */
export const DeskSurface: React.FC<DeskSurfaceProps> = ({
  articleSlug,
  className,
  onMediaClick,
  editable = false,
  onPositionUpdate,
}) => {
  const [media, setMedia] = useState<ArticleMediaWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Fetch media for article
  useEffect(() => {
    const fetchMedia = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/media/${encodeURIComponent(articleSlug)}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch media');
        }

        setMedia(data.media);
      } catch (err) {
        console.error('Error fetching article media:', err);
        setError(err instanceof Error ? err.message : 'Failed to load media');
      } finally {
        setLoading(false);
      }
    };

    if (articleSlug) {
      fetchMedia();
    }
  }, [articleSlug]);

  // Track container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Handle drag end - update position
  const handleDragEnd = useCallback((mediaId: number, percentX: number, percentY: number) => {
    if (editable && onPositionUpdate) {
      const mediaItem = media.find(m => m.id === mediaId);
      if (mediaItem) {
        onPositionUpdate(mediaId, {
          position_x: percentX,
          position_y: percentY,
          rotation: mediaItem.rotation,
          scale: mediaItem.scale,
          z_index: mediaItem.z_index,
        });
      }
    }

    // Update local state
    setMedia(prevMedia =>
      prevMedia.map(m =>
        m.id === mediaId
          ? { ...m, position_x: percentX, position_y: percentY }
          : m
      )
    );
  }, [editable, onPositionUpdate, media]);

  // Don't render if no media
  if (!loading && media.length === 0) {
    return null;
  }

  return (
    <DeskSurfaceContainer ref={containerRef} className={className}>
      {!loading && !error && dimensions.width > 0 && media.map(mediaItem => (
        <DeskMediaItem
          key={mediaItem.id}
          media={mediaItem}
          containerWidth={dimensions.width}
          containerHeight={dimensions.height}
          onDragEnd={handleDragEnd}
          onClick={() => onMediaClick?.(mediaItem)}
          editable={editable}
        />
      ))}
    </DeskSurfaceContainer>
  );
};

export default DeskSurface;
