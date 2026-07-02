/**
 * API: Get Artifact Registry Status
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getArtifactRegistry } from '../../../lib/film-bridge/artifact-registry';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const registry = await getArtifactRegistry();
      const artifacts = registry.getAll();

      const mapped = artifacts.map(a => ({
        id: a.id,
        name: a.name,
        hasCanonical: Object.keys(a.assets.canonicalImages).length >= 8,
        has3D: a.assets.threeD && Object.keys(a.assets.threeD).length > 0,
        appearances: a.appearances.length,
        avgDrift: a.appearances.length > 0
          ? a.appearances.reduce((sum, app) => sum + (app.driftScore || 0), 0) / a.appearances.length
          : 0,
      }));

      res.status(200).json(mapped);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get artifacts',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  } else if (req.method === 'POST') {
    // Create new artifact
    try {
      const registry = await getArtifactRegistry();
      const artifact = await registry.register(req.body);
      res.status(201).json(artifact);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to create artifact',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
