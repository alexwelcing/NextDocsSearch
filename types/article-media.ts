/**
 * Type definitions for Article Media Storage System
 * Handles images and videos that appear on the desk surface interface
 */

export type MediaType = 'image' | 'video';
export type MediaStatus = 'pending' | 'processing' | 'ready' | 'error';

/**
 * Position and transform properties for media items on desk surface
 */
export interface MediaTransform {
  position_x: number;  // X coordinate (0-100, percentage of viewport width)
  position_y: number;  // Y coordinate (0-100, percentage of viewport height)
  scale: number;       // Scale factor (0.5 - 2.0)
  rotation: number;    // Rotation in degrees (-180 to 180)
  z_index: number;     // Stacking order (higher = on top)
}

/**
 * Media metadata
 */
export interface MediaMetadata {
  title?: string;
  alt_text?: string;
  caption?: string;
  file_size_bytes?: number;
  mime_type?: string;
  width?: number;
  height?: number;
  duration_seconds?: number;  // For videos
  thumbnail_path?: string;    // For videos
}

/**
 * Complete article media record from database
 */
export interface ArticleMedia extends MediaTransform, MediaMetadata {
  id: number;
  article_slug: string;
  media_type: MediaType;
  storage_path: string;
  display_order: number;
  status: MediaStatus;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Public URL for accessing media from Supabase Storage
 */
export interface ArticleMediaWithUrl extends ArticleMedia {
  public_url: string;
  thumbnail_url?: string;  // For videos
}

/**
 * Data required to create a new media item
 */
export interface CreateArticleMedia {
  article_slug: string;
  media_type: MediaType;
  file: File;
  display_order?: number;
  position_x?: number;
  position_y?: number;
  scale?: number;
  rotation?: number;
  z_index?: number;
  title?: string;
  alt_text?: string;
  caption?: string;
}

/**
 * Data for updating media item (excluding file)
 */
export interface UpdateArticleMedia extends Partial<MediaTransform> {
  id: number;
  display_order?: number;
  title?: string;
  alt_text?: string;
  caption?: string;
  status?: MediaStatus;
}

/**
 * Upload response from media API
 */
export interface MediaUploadResponse {
  success: boolean;
  media?: ArticleMediaWithUrl;
  error?: string;
}

/**
 * Batch media retrieval response
 */
export interface ArticleMediaResponse {
  success: boolean;
  media: ArticleMediaWithUrl[];
  count: number;
  error?: string;
}

/**
 * Storage bucket configuration
 */
export const STORAGE_CONFIG = {
  buckets: {
    images: 'article-images',
    videos: 'article-videos',
  },
  limits: {
    image: {
      maxSizeMB: 10,
      maxWidth: 2400,
      maxHeight: 1600,
      allowedTypes: ['image/webp', 'image/jpeg', 'image/png', 'image/gif'],
    },
    video: {
      maxSizeMB: 50,
      maxDurationSeconds: 120,
      maxWidth: 1920,
      maxHeight: 1080,
      allowedTypes: ['video/mp4', 'video/webm'],
    },
  },
  defaultTransform: {
    position_x: 50,
    position_y: 50,
    scale: 1.0,
    rotation: 0,
    z_index: 0,
  },
} as const;

/**
 * Validates file against media type constraints
 */
export function validateMediaFile(
  file: File,
  mediaType: MediaType
): { valid: boolean; error?: string } {
  const config = STORAGE_CONFIG.limits[mediaType];

  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > config.maxSizeMB) {
    return {
      valid: false,
      error: `File size ${fileSizeMB.toFixed(2)}MB exceeds maximum ${config.maxSizeMB}MB for ${mediaType}`,
    };
  }

  // Check MIME type
  const allowedTypes = config.allowedTypes as readonly string[];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Generates a storage path for media file
 */
export function generateStoragePath(
  articleSlug: string,
  fileName: string,
  mediaType: MediaType
): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-');

  return `${articleSlug}/${timestamp}-${sanitizedFileName}`;
}

/**
 * Physics constants for desk surface interaction
 */
export const DESK_PHYSICS = {
  friction: 0.95,           // Velocity damping
  dragResistance: 0.85,     // Drag resistance
  snapThreshold: 10,        // Pixels to snap to grid
  minScale: 0.3,            // Minimum scale
  maxScale: 2.5,            // Maximum scale
  rotationSnap: 15,         // Degrees to snap rotation
  zIndexRange: [0, 100],    // Min/max z-index
} as const;
