/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WORKSHOP API - RESOURCES ENDPOINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Handles CRUD operations for workshop resources.
 *
 * GET    /api/workshop/resources         - List all resources
 * GET    /api/workshop/resources?id=xxx  - Get single resource
 * POST   /api/workshop/resources         - Create new resource
 * PUT    /api/workshop/resources         - Update resource
 * DELETE /api/workshop/resources?id=xxx  - Delete resource
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import type { WorkshopResource, WorkshopAPIResponse, ResourceListResponse } from '@/types/workshop';
import { SEED_RESOURCES } from '@/lib/workshop/seed-data';

// In-memory store (in production, use a database)
let resourceStore: Map<string, WorkshopResource> = new Map();
let initialized = false;

function initializeStore() {
  if (!initialized) {
    for (const resource of SEED_RESOURCES) {
      resourceStore.set(resource.id, resource);
    }
    initialized = true;
  }
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<WorkshopAPIResponse<WorkshopResource | ResourceListResponse | { deleted: boolean }>>
) {
  initializeStore();

  const { method } = req;
  const timestamp = new Date().toISOString();

  try {
    switch (method) {
      case 'GET': {
        const { id, categoryId, page = '1', pageSize = '50' } = req.query;

        // Get single resource
        if (id && typeof id === 'string') {
          const resource = resourceStore.get(id);
          if (!resource) {
            return res.status(404).json({
              success: false,
              error: 'Resource not found',
              timestamp,
            });
          }
          return res.status(200).json({
            success: true,
            data: resource,
            timestamp,
          });
        }

        // List resources with optional filtering
        let resources = Array.from(resourceStore.values());

        // Filter by category
        if (categoryId && typeof categoryId === 'string') {
          resources = resources.filter(
            r => r.categoryId === categoryId || r.subcategoryId === categoryId
          );
        }

        // Pagination
        const pageNum = parseInt(page as string, 10);
        const size = parseInt(pageSize as string, 10);
        const start = (pageNum - 1) * size;
        const paginatedResources = resources.slice(start, start + size);

        return res.status(200).json({
          success: true,
          data: {
            resources: paginatedResources,
            total: resources.length,
            page: pageNum,
            pageSize: size,
          },
          timestamp,
        });
      }

      case 'POST': {
        const resourceData = req.body as Partial<WorkshopResource>;

        if (!resourceData.title || !resourceData.categoryId) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: title, categoryId',
            timestamp,
          });
        }

        const now = new Date().toISOString();
        const newResource: WorkshopResource = {
          id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: resourceData.type || 'link',
          title: resourceData.title,
          description: resourceData.description || '',
          url: resourceData.url,
          filePath: resourceData.filePath,
          categoryId: resourceData.categoryId,
          subcategoryId: resourceData.subcategoryId,
          tags: resourceData.tags || [],
          source: resourceData.source || 'manual',
          status: 'pending',
          viewCount: 0,
          bookmarked: false,
          createdAt: now,
          updatedAt: now,
        };

        resourceStore.set(newResource.id, newResource);

        // Set cache headers
        res.setHeader('Cache-Control', 'no-store');

        return res.status(201).json({
          success: true,
          data: newResource,
          timestamp,
        });
      }

      case 'PUT': {
        const { id, ...updates } = req.body;

        if (!id) {
          return res.status(400).json({
            success: false,
            error: 'Resource ID is required',
            timestamp,
          });
        }

        const existing = resourceStore.get(id);
        if (!existing) {
          return res.status(404).json({
            success: false,
            error: 'Resource not found',
            timestamp,
          });
        }

        const updatedResource: WorkshopResource = {
          ...existing,
          ...updates,
          id: existing.id, // Prevent ID change
          createdAt: existing.createdAt, // Preserve creation date
          updatedAt: new Date().toISOString(),
        };

        resourceStore.set(id, updatedResource);

        return res.status(200).json({
          success: true,
          data: updatedResource,
          timestamp,
        });
      }

      case 'DELETE': {
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Resource ID is required',
            timestamp,
          });
        }

        if (!resourceStore.has(id)) {
          return res.status(404).json({
            success: false,
            error: 'Resource not found',
            timestamp,
          });
        }

        resourceStore.delete(id);

        return res.status(200).json({
          success: true,
          data: { deleted: true },
          timestamp,
        });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({
          success: false,
          error: `Method ${method} Not Allowed`,
          timestamp,
        });
    }
  } catch (error) {
    console.error('Workshop API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp,
    });
  }
}
