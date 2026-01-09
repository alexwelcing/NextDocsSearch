/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WORKSHOP API - PREPROCESS ENDPOINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Verifies links, fetches metadata, and enriches resources.
 *
 * POST /api/workshop/preprocess
 * Body: { url: string, title?: string }
 *
 * Returns enriched resource data with:
 * - HTTP status verification
 * - OG metadata extraction
 * - Auto-categorization
 * - Quality scoring
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import type { WorkshopAPIResponse, PreprocessResult, EnrichedResourceData } from '@/types/workshop';
import {
  preprocessUrlInput,
  autoCategorize,
  extractDomain,
  detectResourceType,
  extractKeyTopics,
  createEnrichedData,
  updateQualityFromDomain,
} from '@/lib/workshop/preprocess';

interface PreprocessRequest {
  url: string;
  title?: string;
  categoryId?: string;
  tags?: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WorkshopAPIResponse<PreprocessResult>>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`,
      timestamp: new Date().toISOString(),
    });
  }

  const { url, title, categoryId, tags } = req.body as PreprocessRequest;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Validate URL
    let validUrl: URL;
    try {
      validUrl = new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch the URL to verify and get metadata
    const startTime = Date.now();
    let httpStatus = 200;
    let redirectUrl: string | undefined;
    let ogData: { title?: string; description?: string; image?: string } = {};

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ModernWorkshopBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });

      httpStatus = response.status;

      // Check for redirects
      if (response.url !== url) {
        redirectUrl = response.url;
      }

      // Parse HTML for OG tags if successful
      if (response.ok) {
        const html = await response.text();

        // Extract OG metadata using regex (simple parser)
        const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i);
        const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
        const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);

        // Fallback to standard meta tags
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);

        ogData = {
          title: ogTitleMatch?.[1] || titleMatch?.[1] || undefined,
          description: ogDescMatch?.[1] || descMatch?.[1] || undefined,
          image: ogImageMatch?.[1] || undefined,
        };

        // Extract key topics from content
        const textContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const keyTopics = extractKeyTopics(textContent.substring(0, 5000));
        ogData = { ...ogData };
      }
    } catch (fetchError) {
      // Network error - URL might be unreachable
      httpStatus = 0;
    }

    const responseTime = Date.now() - startTime;
    const domain = extractDomain(url);
    const resourceType = detectResourceType(url);

    // Create enriched data
    let enrichedData = createEnrichedData({
      ogTitle: ogData.title,
      ogDescription: ogData.description,
      ogImage: ogData.image,
      httpStatus,
      responseTime,
      redirectUrl,
    });

    // Update quality based on domain
    enrichedData = updateQualityFromDomain(enrichedData, domain);

    // Auto-categorize
    const categorization = autoCategorize(
      title || ogData.title || '',
      ogData.description || '',
      url
    );

    // Build the preprocessed resource
    const result = preprocessUrlInput({
      url,
      title: title || ogData.title,
      categoryId: categoryId || categorization.categoryId,
      tags,
    });

    if (result.success && result.resource) {
      result.resource.enrichedData = enrichedData;
      result.resource.description = ogData.description || '';
      result.resource.status = httpStatus >= 200 && httpStatus < 400 ? 'verified' : 'failed';

      if (categorization.subcategoryId) {
        result.resource.subcategoryId = categorization.subcategoryId;
      }
    }

    // Add warnings
    const warnings: string[] = result.warnings || [];

    if (httpStatus === 0) {
      warnings.push('URL could not be reached. It may be blocked or offline.');
    } else if (httpStatus >= 400) {
      warnings.push(`URL returned HTTP ${httpStatus}. It may be broken or require authentication.`);
    }

    if (redirectUrl) {
      warnings.push(`URL redirects to: ${redirectUrl}`);
    }

    if (categorization.confidence < 0.3) {
      warnings.push('Low confidence in auto-categorization. Please verify the category.');
    }

    return res.status(200).json({
      success: true,
      data: {
        ...result,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Preprocess error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to preprocess URL',
      timestamp: new Date().toISOString(),
    });
  }
}
