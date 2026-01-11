import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  ArticleMediaWithUrl,
  MediaUploadResponse,
  STORAGE_CONFIG,
  validateMediaFile,
  generateStoragePath,
  MediaType,
} from '@/types/article-media';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Disable Next.js body parser to handle multipart form data
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Parses multipart form data from request
 */
async function parseFormData(req: NextApiRequest): Promise<FormData> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  const boundary = req.headers['content-type']?.split('boundary=')[1];

  if (!boundary) {
    throw new Error('No boundary found in content-type header');
  }

  // Parse manually - for production, consider using formidable library
  const formData = new FormData();
  const parts = buffer.toString('binary').split(`--${boundary}`);

  for (const part of parts) {
    if (!part || part.trim() === '--') continue;

    const [headerSection, ...bodyParts] = part.split('\r\n\r\n');
    if (!headerSection) continue;

    const bodyContent = bodyParts.join('\r\n\r\n').replace(/\r\n--$/, '');
    const nameMatch = headerSection.match(/name="([^"]+)"/);
    const filenameMatch = headerSection.match(/filename="([^"]+)"/);
    const contentTypeMatch = headerSection.match(/Content-Type: (.+)/);

    if (nameMatch) {
      const fieldName = nameMatch[1];

      if (filenameMatch) {
        // This is a file field
        const filename = filenameMatch[1];
        const contentType = contentTypeMatch?.[1] || 'application/octet-stream';

        // Convert binary string back to buffer
        const fileBuffer = Buffer.from(bodyContent, 'binary');
        const blob = new Blob([fileBuffer], { type: contentType });
        const file = new File([blob], filename, { type: contentType });

        formData.append(fieldName, file);
      } else {
        // This is a text field
        formData.append(fieldName, bodyContent.trim());
      }
    }
  }

  return formData;
}

/**
 * POST /api/media/upload
 * Uploads a media file to Supabase Storage and creates database record
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MediaUploadResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    // Validate environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Parse multipart form data
    const formData = await parseFormData(req);

    // Extract fields
    const file = formData.get('file') as File | null;
    const articleSlug = formData.get('article_slug') as string | null;
    const mediaType = formData.get('media_type') as MediaType | null;
    const title = formData.get('title') as string | null;
    const altText = formData.get('alt_text') as string | null;
    const caption = formData.get('caption') as string | null;
    const displayOrder = parseInt(formData.get('display_order') as string) || 0;
    const positionX = parseFloat(formData.get('position_x') as string) || 50;
    const positionY = parseFloat(formData.get('position_y') as string) || 50;
    const scale = parseFloat(formData.get('scale') as string) || 1.0;
    const rotation = parseFloat(formData.get('rotation') as string) || 0;
    const zIndex = parseInt(formData.get('z_index') as string) || 0;

    // Validate required fields
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'File is required',
      });
    }

    if (!articleSlug) {
      return res.status(400).json({
        success: false,
        error: 'Article slug is required',
      });
    }

    if (!mediaType || (mediaType !== 'image' && mediaType !== 'video')) {
      return res.status(400).json({
        success: false,
        error: 'Valid media_type is required (image or video)',
      });
    }

    // Validate file
    const validation = validateMediaFile(file, mediaType);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Generate storage path
    const storagePath = generateStoragePath(articleSlug, file.name, mediaType);
    const bucket =
      mediaType === 'image'
        ? STORAGE_CONFIG.buckets.images
        : STORAGE_CONFIG.buckets.videos;

    // Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload file to storage',
      });
    }

    // Get image dimensions if it's an image
    let width: number | undefined;
    let height: number | undefined;

    if (mediaType === 'image' && typeof window !== 'undefined') {
      // For images, we could use sharp library to get dimensions
      // For now, we'll leave it undefined and can enhance later
    }

    // Create database record
    const { data: mediaRecord, error: dbError } = await supabase
      .from('article_media')
      .insert({
        article_slug: articleSlug,
        media_type: mediaType,
        storage_path: uploadData.path,
        display_order: displayOrder,
        position_x: positionX,
        position_y: positionY,
        scale,
        rotation,
        z_index: zIndex,
        title,
        alt_text: altText,
        caption,
        file_size_bytes: file.size,
        mime_type: file.type,
        width,
        height,
        status: 'ready',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error creating media record:', dbError);

      // Clean up uploaded file
      await supabase.storage.from(bucket).remove([uploadData.path]);

      return res.status(500).json({
        success: false,
        error: 'Failed to create media record',
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    const mediaWithUrl: ArticleMediaWithUrl = {
      ...mediaRecord,
      public_url: urlData.publicUrl,
    };

    return res.status(201).json({
      success: true,
      media: mediaWithUrl,
    });
  } catch (error) {
    console.error('Unexpected error in upload API:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
