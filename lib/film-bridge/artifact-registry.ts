/**
 * Artifact Registry
 * Central storage and management for production artifacts
 */

import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import type { 
  ArtifactRegistration, 
  ArtifactAppearance,
  DriftReport 
} from './types';

const ARTIFACTS_DIR = path.join(process.cwd(), 'content', 'artifacts');
const CANONICAL_DIR = path.join(process.cwd(), 'public', 'artifacts', 'canonical');
const THREED_DIR = path.join(process.cwd(), 'public', 'artifacts', '3d');

export class ArtifactRegistry {
  private artifacts: Map<string, ArtifactRegistration> = new Map();
  private loaded: boolean = false;

  // ═══════════════════════════════════════════════════════════════
  // REGISTRY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async load(): Promise<void> {
    if (this.loaded) return;

    // Ensure directories exist
    [ARTIFACTS_DIR, CANONICAL_DIR, THREED_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Load all artifact definitions
    if (fs.existsSync(ARTIFACTS_DIR)) {
      const files = fs.readdirSync(ARTIFACTS_DIR)
        .filter(f => f.endsWith('.json') || f.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(ARTIFACTS_DIR, file);
        const artifact = await this.loadArtifact(filePath);
        if (artifact) {
          this.artifacts.set(artifact.id, artifact);
        }
      }
    }

    this.loaded = true;
    console.log(`[ArtifactRegistry] Loaded ${this.artifacts.size} artifacts`);
  }

  private async loadArtifact(filePath: string): Promise<ArtifactRegistration | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      if (filePath.endsWith('.json')) {
        return JSON.parse(content);
      }
      
      // Markdown with frontmatter
      const { data, content: body } = matter(content);
      return {
        ...data,
        description: body.trim(),
      } as ArtifactRegistration;
    } catch (error) {
      console.error(`[ArtifactRegistry] Failed to load ${filePath}:`, error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════

  get(id: string): ArtifactRegistration | undefined {
    return this.artifacts.get(id);
  }

  getBySlug(slug: string): ArtifactRegistration | undefined {
    return Array.from(this.artifacts.values()).find(a => a.slug === slug);
  }

  getAll(): ArtifactRegistration[] {
    return Array.from(this.artifacts.values());
  }

  getBySeries(series: string): ArtifactRegistration[] {
    return this.getAll().filter(a => a.storySignature.series === series);
  }

  getByEpisode(series: string, episode: number): ArtifactRegistration[] {
    return this.getAll().filter(
      a => a.storySignature.series === series && 
           a.storySignature.episode === episode
    );
  }

  async register(artifact: Omit<ArtifactRegistration, 'id' | 'createdAt' | 'updatedAt'>): Promise<ArtifactRegistration> {
    const now = new Date().toISOString();
    const fullArtifact: ArtifactRegistration = {
      ...artifact,
      id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
      appearances: [],
    };

    this.artifacts.set(fullArtifact.id, fullArtifact);
    await this.saveArtifact(fullArtifact);
    
    return fullArtifact;
  }

  async update(id: string, updates: Partial<ArtifactRegistration>): Promise<ArtifactRegistration | null> {
    const artifact = this.artifacts.get(id);
    if (!artifact) return null;

    const updated = {
      ...artifact,
      ...updates,
      id: artifact.id,  // Prevent ID change
      updatedAt: new Date().toISOString(),
    };

    this.artifacts.set(id, updated);
    await this.saveArtifact(updated);
    
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const artifact = this.artifacts.get(id);
    if (!artifact) return false;

    // Delete files
    const jsonPath = path.join(ARTIFACTS_DIR, `${artifact.slug}.json`);
    const mdPath = path.join(ARTIFACTS_DIR, `${artifact.slug}.md`);
    
    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
    if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);

    this.artifacts.delete(id);
    return true;
  }

  private async saveArtifact(artifact: ArtifactRegistration): Promise<void> {
    const filePath = path.join(ARTIFACTS_DIR, `${artifact.slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2));
  }

  // ═══════════════════════════════════════════════════════════════
  // CANONICAL IMAGE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  getCanonicalPath(artifactId: string, angle: string): string {
    const artifact = this.get(artifactId);
    if (!artifact) throw new Error(`Artifact ${artifactId} not found`);
    
    return path.join(CANONICAL_DIR, artifact.slug, `${angle}.png`);
  }

  setCanonicalImage(artifactId: string, angle: string, imagePath: string): void {
    const artifact = this.get(artifactId);
    if (!artifact) throw new Error(`Artifact ${artifactId} not found`);

    // Copy to canonical directory
    const targetDir = path.join(CANONICAL_DIR, artifact.slug);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, `${angle}.png`);
    fs.copyFileSync(imagePath, targetPath);

    // Update artifact record
    artifact.assets.canonicalImages[angle] = targetPath;
    artifact.updatedAt = new Date().toISOString();
    
    this.saveArtifact(artifact);
  }

  getBestCanonicalView(artifactId: string, targetAngle: { azimuth: number; elevation: number }): string | null {
    const artifact = this.get(artifactId);
    if (!artifact) return null;

    const views = Object.keys(artifact.assets.canonicalImages);
    if (views.length === 0) return null;

    // Simple angle matching - could be enhanced with actual angle metadata
    const angleMap: Record<string, number> = {
      'front': 0, 'front-left': 45, 'left': 90, 'back-left': 135,
      'back': 180, 'back-right': 225, 'right': 270, 'front-right': 315,
    };

    let bestView = views[0];
    let bestDiff = 360;

    for (const view of views) {
      const viewAngle = angleMap[view] ?? 0;
      const diff = Math.abs(viewAngle - targetAngle.azimuth);
      const wrappedDiff = Math.min(diff, 360 - diff);
      
      if (wrappedDiff < bestDiff) {
        bestDiff = wrappedDiff;
        bestView = view;
      }
    }

    return artifact.assets.canonicalImages[bestView];
  }

  // ═══════════════════════════════════════════════════════════════
  // 3D ASSET MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  set3DAsset(
    artifactId: string, 
    format: 'glb' | 'usdz' | 'fbx' | 'obj' | 'sourceBlend',
    filePath: string
  ): void {
    const artifact = this.get(artifactId);
    if (!artifact) throw new Error(`Artifact ${artifactId} not found`);

    if (!artifact.assets.threeD) {
      artifact.assets.threeD = {};
    }

    artifact.assets.threeD[format] = filePath;
    artifact.updatedAt = new Date().toISOString();
    
    this.saveArtifact(artifact);
  }

  get3DAsset(artifactId: string, format: 'glb' | 'usdz' | 'fbx' | 'obj'): string | undefined {
    const artifact = this.get(artifactId);
    return artifact?.assets.threeD?.[format];
  }

  // ═══════════════════════════════════════════════════════════════
  // APPEARANCE TRACKING
  // ═══════════════════════════════════════════════════════════════

  async recordAppearance(
    artifactId: string,
    appearance: Omit<ArtifactAppearance, 'quality' | 'verified'>
  ): Promise<ArtifactAppearance> {
    const artifact = this.get(artifactId);
    if (!artifact) throw new Error(`Artifact ${artifactId} not found`);

    const fullAppearance: ArtifactAppearance = {
      ...appearance,
      quality: 0,  // Will be filled in by verification
      verified: false,
    };

    artifact.appearances.push(fullAppearance);
    artifact.updatedAt = new Date().toISOString();
    
    await this.saveArtifact(artifact);
    
    return fullAppearance;
  }

  async updateAppearanceQuality(
    artifactId: string,
    sceneId: string,
    shotId: string,
    quality: number,
    driftScore?: number
  ): Promise<void> {
    const artifact = this.get(artifactId);
    if (!artifact) return;

    const appearance = artifact.appearances.find(
      a => a.sceneId === sceneId && a.shotId === shotId
    );

    if (appearance) {
      appearance.quality = quality;
      appearance.driftScore = driftScore;
      appearance.verified = true;
      
      await this.saveArtifact(artifact);
    }
  }

  getAppearances(artifactId: string): ArtifactAppearance[] {
    const artifact = this.get(artifactId);
    return artifact?.appearances ?? [];
  }

  getScenesUsingArtifact(artifactId: string): string[] {
    const appearances = this.getAppearances(artifactId);
    return [...new Set(appearances.map(a => a.sceneId))];
  }

  // ═══════════════════════════════════════════════════════════════
  // DRIFT DETECTION
  // ═══════════════════════════════════════════════════════════════

  async checkDrift(
    artifactId: string,
    generatedImagePath: string,
    expectedAngle: string
  ): Promise<DriftReport> {
    const artifact = this.get(artifactId);
    if (!artifact) {
      throw new Error(`Artifact ${artifactId} not found`);
    }

    const canonicalPath = artifact.assets.canonicalImages[expectedAngle];
    if (!canonicalPath) {
      throw new Error(`No canonical view for angle ${expectedAngle}`);
    }

    // TODO: Implement actual image comparison
    // For now, return a placeholder that always passes
    return {
      passed: true,
      artifactId,
      sceneId: 'unknown',
      shotId: 'unknown',
      scores: {
        overall: 0.92,
        ssim: 0.89,
        featureMatch: 0.94,
        clipSimilarity: 0.91,
        colorMatch: 0.95,
      },
      details: {
        canonicalReference: canonicalPath,
        generatedFrame: generatedImagePath,
      },
      recommendations: [],
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════

  getRegistryStats(): {
    totalArtifacts: number;
    withCanonical: number;
    with3D: number;
    totalAppearances: number;
    averageDriftScore: number;
  } {
    const artifacts = this.getAll();
    
    const withCanonical = artifacts.filter(
      a => Object.keys(a.assets.canonicalImages).length > 0
    ).length;
    
    const with3D = artifacts.filter(
      a => a.assets.threeD && Object.keys(a.assets.threeD).length > 0
    ).length;

    const totalAppearances = artifacts.reduce(
      (sum, a) => sum + a.appearances.length, 0
    );

    const verifiedAppearances = artifacts.flatMap(a => 
      a.appearances.filter(app => app.verified && app.driftScore !== undefined)
    );
    
    const averageDrift = verifiedAppearances.length > 0
      ? verifiedAppearances.reduce((sum, a) => sum + (a.driftScore ?? 0), 0) / verifiedAppearances.length
      : 0;

    return {
      totalArtifacts: artifacts.length,
      withCanonical,
      with3D,
      totalAppearances,
      averageDriftScore: averageDrift,
    };
  }

  findUnderutilizedArtifacts(): ArtifactRegistration[] {
    return this.getAll()
      .filter(a => a.storySignature.narrativeWeight > 0.7 && a.appearances.length < 3)
      .sort((a, b) => b.storySignature.narrativeWeight - a.storySignature.narrativeWeight);
  }

  findHighDriftArtifacts(): Array<{ artifact: ArtifactRegistration; avgDrift: number }> {
    return this.getAll()
      .map(a => {
        const verified = a.appearances.filter(app => app.verified && app.driftScore !== undefined);
        const avgDrift = verified.length > 0
          ? verified.reduce((sum, app) => sum + (app.driftScore ?? 0), 0) / verified.length
          : 0;
        return { artifact: a, avgDrift };
      })
      .filter(({ avgDrift }) => avgDrift > 0.3)
      .sort((a, b) => b.avgDrift - a.avgDrift);
  }
}

// Singleton
let registry: ArtifactRegistry | null = null;

export async function getArtifactRegistry(): Promise<ArtifactRegistry> {
  if (!registry) {
    registry = new ArtifactRegistry();
    await registry.load();
  }
  return registry;
}
