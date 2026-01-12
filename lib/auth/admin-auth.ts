/**
 * Simple authentication middleware for admin routes
 * Uses an API key from environment variables
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

/**
 * Validates admin API key from request headers
 */
export function validateAdminAuth(req: NextApiRequest): boolean {
  if (!ADMIN_API_KEY) {
    console.error('ADMIN_API_KEY not set in environment variables');
    return false;
  }

  const authHeader = req.headers['x-admin-api-key'];

  if (!authHeader) {
    return false;
  }

  return authHeader === ADMIN_API_KEY;
}

/**
 * Middleware to protect API routes with admin authentication
 */
export function withAdminAuth<T = any>(
  handler: (req: NextApiRequest, res: NextApiResponse<T>) => Promise<void | NextApiResponse<T>>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Validate authentication
    if (!validateAdminAuth(req)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Valid admin API key required.',
      } as any);
    }

    // Call the handler if authenticated
    return handler(req, res);
  };
}

/**
 * Response type for authentication errors
 */
export interface AuthErrorResponse {
  success: false;
  error: string;
}
