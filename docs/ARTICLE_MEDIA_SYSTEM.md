# Article Media Storage System

A comprehensive system for storing and displaying images and videos on article pages with an interactive "desk surface" experience.

## Overview

This system allows you to:
- Upload 5-20 media assets (images/videos) per article
- Store them in Supabase Storage buckets
- Display them as interactive, draggable documents on a desk-like surface behind article text
- Position, scale, and rotate each media item individually

## Architecture

### Components

1. **Supabase Storage Buckets**
   - `article-images`: Stores image files
   - `article-videos`: Stores video files

2. **Database Table: `article_media`**
   - Links media files to articles
   - Stores position, rotation, scale, z-index
   - Includes metadata (title, alt text, caption, dimensions)

3. **API Routes**
   - `GET /api/media/[slug]`: Fetch all media for an article
   - `POST /api/media/upload`: Upload new media file

4. **UI Components**
   - `DeskSurface`: Interactive background component with draggable media
   - `MediaUploadPage`: Admin interface for uploading media

## Setup Instructions

### 1. Run Database Migration

Apply the Supabase migration to create the `article_media` table:

```bash
# Using Supabase CLI
supabase db push

# Or apply the migration file directly
supabase migration up 20260111000000_article_media_storage
```

### 2. Create Storage Buckets

In your Supabase Dashboard:

1. Go to **Storage** → **New Bucket**
2. Create bucket: `article-images`
   - Make it **Public**
   - Set file size limit: **10MB**
   - Allowed MIME types: `image/webp`, `image/jpeg`, `image/png`, `image/gif`

3. Create bucket: `article-videos`
   - Make it **Public**
   - Set file size limit: **50MB**
   - Allowed MIME types: `video/mp4`, `video/webm`

Alternatively, use the Supabase JavaScript client:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create image bucket
await supabase.storage.createBucket('article-images', {
  public: true,
  fileSizeLimit: 10485760, // 10MB in bytes
  allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png', 'image/gif'],
});

// Create video bucket
await supabase.storage.createBucket('article-videos', {
  public: true,
  fileSizeLimit: 52428800, // 50MB in bytes
  allowedMimeTypes: ['video/mp4', 'video/webm'],
});
```

### 3. Environment Variables

Ensure these environment variables are set in your `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Admin Authentication (REQUIRED for uploading media)
ADMIN_API_KEY=your_secure_random_key_here
```

**⚠️ SECURITY: Setting up ADMIN_API_KEY**

The `ADMIN_API_KEY` is required to protect the media upload endpoint. Generate a strong random key:

```bash
# Generate a secure random key (macOS/Linux)
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Example `.env.local`:
```bash
ADMIN_API_KEY=AbC123XyZ789RaNdOmKeY+SeCuRe/PaSsWoRd==
```

**Never commit this key to version control!**

## Media Requirements

### Images
- **Formats**: WebP (preferred), JPEG, PNG, GIF
- **Max File Size**: 10MB
- **Recommended Dimensions**:
  - Full size: 2400x1600px
  - Medium: 800x600px
  - Thumbnail: 400x300px
- **Naming**: Use descriptive kebab-case names (e.g., `neural-network-diagram.webp`)

### Videos
- **Formats**: MP4 (H.264 codec), WebM
- **Max File Size**: 50MB
- **Max Resolution**: 1920x1080 (1080p)
- **Recommended Duration**: 30 seconds - 2 minutes
- **Optimization**: Ensure videos are web-optimized (fast start enabled)
- **Poster Image**: Include a thumbnail in the video metadata

## Usage

### Uploading Media (Admin Interface)

1. **Set up authentication** (first time only):
   - Generate a secure API key (see above)
   - Add `ADMIN_API_KEY` to your `.env.local`
   - Restart your development server

2. Navigate to `/admin/media-upload`
3. Enter your admin API key (stored locally in browser)
4. Enter the article slug (e.g., `ai-future-predictions`)
5. Select media type (Image or Video)
6. Drag & drop or select your file
7. Fill in metadata:
   - **Title**: Optional display title
   - **Alt Text**: Accessibility description (recommended for images)
   - **Caption**: Text shown on hover
8. Configure positioning:
   - **Display Order**: Render order (0-n)
   - **Position X/Y**: Percentage-based position (0-100)
   - **Scale**: Size multiplier (0.3-2.5)
   - **Rotation**: Degrees (-180 to 180)
   - **Z-Index**: Stacking order (0-100, higher = on top)
9. Click "Upload Media"

### Uploading Media (API)

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('article_slug', 'my-article-slug');
formData.append('media_type', 'image');
formData.append('title', 'Neural Network Diagram');
formData.append('alt_text', 'Diagram showing neural network architecture');
formData.append('caption', 'Figure 1: Deep Learning Architecture');
formData.append('position_x', '30');
formData.append('position_y', '40');
formData.append('scale', '1.2');
formData.append('rotation', '-5');
formData.append('z_index', '5');

const response = await fetch('/api/media/upload', {
  method: 'POST',
  headers: {
    'X-Admin-API-Key': 'your-admin-api-key-here',
  },
  body: formData,
});

const data = await response.json();
```

**⚠️ Security Note:** Never expose your admin API key in client-side code in production. The API upload should only be called from secure server-side code or the admin interface.

### Displaying Media (Automatic)

Media automatically displays on article pages via the `DeskSurface` component integrated into `/pages/articles/[slug].tsx`.

No additional code needed - just upload media with the correct article slug!

### Interactive Features

Users can:
- **View** media floating behind article text
- **Hover** to see captions and enhanced shadows
- **Click** media items (can be customized with `onMediaClick` callback)

## Desk Surface Physics

The desk surface uses realistic physics constants defined in `/types/article-media.ts`:

```typescript
export const DESK_PHYSICS = {
  friction: 0.95,           // Velocity damping
  dragResistance: 0.85,     // Drag resistance
  snapThreshold: 10,        // Pixels to snap to grid
  minScale: 0.3,            // Minimum scale
  maxScale: 2.5,            // Maximum scale
  rotationSnap: 15,         // Degrees to snap rotation
  zIndexRange: [0, 100],    // Min/max z-index
};
```

## Customization

### Custom Desk Surface Styling

Modify the desk texture in `/components/ui/DeskSurface.tsx`:

```typescript
const DeskSurfaceContainer = styled.div`
  // Change background gradient
  background: linear-gradient(
    135deg,
    rgba(30, 30, 35, 0.97) 0%,
    rgba(20, 20, 25, 0.97) 100%
  );

  // Adjust perspective
  perspective: 1200px;
`;
```

### Position Media Programmatically

```typescript
// Update media position
const updatePosition = async (mediaId: number) => {
  const response = await fetch(`/api/media/update/${mediaId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      position_x: 60,
      position_y: 70,
      scale: 1.5,
      rotation: 15,
      z_index: 10,
    }),
  });
};
```

### Enable Editable Mode

Make media draggable and save positions:

```tsx
<DeskSurface
  articleSlug={slug}
  editable={true}
  onPositionUpdate={(mediaId, position) => {
    // Save position to database
    console.log(`Media ${mediaId} moved to:`, position);
  }}
  onMediaClick={(media) => {
    // Handle media click
    console.log('Clicked:', media.title);
  }}
/>
```

## Database Schema

### `article_media` Table

```sql
CREATE TABLE article_media (
  id BIGSERIAL PRIMARY KEY,
  article_slug TEXT NOT NULL,
  media_type media_type NOT NULL,  -- 'image' | 'video'
  storage_path TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,

  -- Position & transform
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  scale FLOAT DEFAULT 1.0,
  rotation FLOAT DEFAULT 0,
  z_index INTEGER DEFAULT 0,

  -- Metadata
  title TEXT,
  alt_text TEXT,
  caption TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  duration_seconds FLOAT,
  thumbnail_path TEXT,

  -- Status
  status media_status DEFAULT 'ready',  -- 'pending' | 'processing' | 'ready' | 'error'
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## TypeScript Types

All types are defined in `/types/article-media.ts`:

```typescript
import {
  MediaType,
  ArticleMedia,
  ArticleMediaWithUrl,
  CreateArticleMedia,
  UpdateArticleMedia,
  STORAGE_CONFIG,
  validateMediaFile,
  generateStoragePath,
} from '@/types/article-media';
```

## API Reference

### GET /api/media/[slug]

Fetch all media for an article.

**Response:**
```json
{
  "success": true,
  "media": [
    {
      "id": 1,
      "article_slug": "my-article",
      "media_type": "image",
      "storage_path": "my-article/1673456789-diagram.webp",
      "public_url": "https://your-supabase-url.supabase.co/storage/v1/object/public/article-images/my-article/1673456789-diagram.webp",
      "position_x": 30,
      "position_y": 40,
      "scale": 1.2,
      "rotation": -5,
      "z_index": 5,
      "title": "Neural Network Diagram",
      "alt_text": "Architecture diagram",
      "caption": "Figure 1: Deep Learning",
      "created_at": "2026-01-11T10:00:00Z"
    }
  ],
  "count": 1
}
```

### POST /api/media/upload

Upload new media file.

**Request:** `multipart/form-data`
- `file`: File (required)
- `article_slug`: string (required)
- `media_type`: "image" | "video" (required)
- `title`: string (optional)
- `alt_text`: string (optional)
- `caption`: string (optional)
- `display_order`: number (optional, default: 0)
- `position_x`: number (optional, default: 50)
- `position_y`: number (optional, default: 50)
- `scale`: number (optional, default: 1.0)
- `rotation`: number (optional, default: 0)
- `z_index`: number (optional, default: 0)

**Response:**
```json
{
  "success": true,
  "media": { /* ArticleMediaWithUrl object */ }
}
```

## Troubleshooting

### Media Not Displaying

1. Check browser console for errors
2. Verify article slug matches exactly
3. Ensure storage buckets are public
4. Check media status in database: `SELECT * FROM article_media WHERE article_slug = 'your-slug'`

### Upload Fails

1. Verify file meets size/type requirements
2. Check Supabase service role key is set
3. Ensure storage buckets exist
4. Check browser console and server logs

### Positioning Issues

- Position X/Y are percentages (0-100)
- Z-index determines stacking (higher = on top)
- Rotation is in degrees (-180 to 180)
- Scale range is 0.3 to 2.5

## Future Enhancements

Possible improvements:
- [ ] Batch upload multiple files
- [ ] Drag-to-reorder in admin interface
- [ ] Video thumbnail auto-generation
- [ ] Image optimization pipeline (WebP conversion, responsive sizes)
- [ ] Media library browser
- [ ] Search/filter media by article
- [ ] Analytics on media engagement
- [ ] CDN integration for faster delivery

## Support

For issues or questions, please refer to:
- Database schema: `/supabase/migrations/20260111000000_article_media_storage.sql`
- TypeScript types: `/types/article-media.ts`
- Components: `/components/ui/DeskSurface.tsx`
- API routes: `/pages/api/media/`
