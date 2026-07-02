/**
 * ACC (Agent Command Center) Integration
 * Bridge between film generation jobs and ACC task queue
 */

import type { 
  VideoGenerationJob, 
  MeshGenerationJob, 
  ACCTaskMetadata,
  ArtifactRegistration 
} from './types';

// Local type definitions for ACC Task (external ACC project not in this repo)
type TaskStatus = 'pending' | 'queued' | 'executing' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
interface Task {
  id: string;
  status: TaskStatus;
  content: string;
  category: string;
  priority: number;
  metadata?: Record<string, unknown>;
  dependencies?: string[];
  created_at: string;
  updated_at?: string;
}

// ACC Server endpoint (configurable)
// Elixir ACC runs on port 4000 by default
const ACC_BASE_URL = process.env.ACC_SERVER_URL || 'http://localhost:4000';

// Category routing for film-specific tasks
export const FILM_CATEGORY_ROUTING = {
  // Artifact tasks
  'artifact-canonical': 'multimodal-looker',
  'artifact-3d': 'atlas',
  'artifact-inject': 'sisyphus',
  'artifact-verify': 'momus',
  
  // Video tasks
  'video-generate': 'sisyphus',        // Heavy GPU work
  'video-postprocess': 'atlas',        // Frame interpolation, etc.
  
  // Quality tasks
  'drift-verify': 'momus',
  'extract-texture': 'atlas',
};

/**
 * ACC Client for film bridge
 */
export class ACCFilmClient {
  private baseUrl: string;

  constructor(baseUrl: string = ACC_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // ═══════════════════════════════════════════════════════════════
  // TASK CRUD
  // ═══════════════════════════════════════════════════════════════

  async createTask(
    content: string,
    metadata: ACCTaskMetadata
  ): Promise<Task> {
    const response = await fetch(`${this.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        category: metadata.category,
        priority: metadata.priority,
        dependencies: metadata.dependencies,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create ACC task: ${await response.text()}`);
    }

    return response.json();
  }

  async getTask(taskId: string): Promise<Task | null> {
    const response = await fetch(`${this.baseUrl}/api/tasks/${taskId}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Failed to get task: ${await response.text()}`);
    return response.json();
  }

  async updateTaskStatus(
    taskId: string, 
    status: TaskStatus,
    updates?: Partial<Task>
  ): Promise<Task> {
    const response = await fetch(`${this.baseUrl}/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...updates }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update task: ${await response.text()}`);
    }

    return response.json();
  }

  async getTasksForCategory(category: string): Promise<Task[]> {
    const response = await fetch(`${this.baseUrl}/api/tasks?category=${category}`);
    if (!response.ok) return [];
    return response.json();
  }

  // ═══════════════════════════════════════════════════════════════
  // FILM-SPECIFIC TASK CREATORS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Queue canonical image generation for an artifact
   */
  async queueArtifactCanonical(
    artifact: ArtifactRegistration,
    angles: string[]
  ): Promise<Task> {
    const content = `Generate canonical views for artifact "${artifact.name}" (${artifact.slug}): ${angles.join(', ')}`;
    
    return this.createTask(content, {
      category: 'artifact-canonical',
      filmJobId: artifact.id,
      priority: artifact.storySignature.narrativeWeight > 0.7 ? 8 : 5,
      dependencies: [],
      estimatedDuration: angles.length * 2,  // ~2 min per angle
      estimatedVRAM: 8,
      estimatedComfyLoad: 'medium',
    });
  }

  /**
   * Queue 3D mesh generation for an artifact
   */
  async queueArtifact3D(
    artifact: ArtifactRegistration
  ): Promise<Task> {
    // Must have canonical images first
    const hasCanonical = Object.keys(artifact.assets.canonicalImages).length > 0;
    const dependencies: string[] = [];
    
    const content = `Generate 3D mesh for artifact "${artifact.name}" (${artifact.slug})`;
    
    const task = await this.createTask(content, {
      category: 'artifact-3d',
      filmJobId: artifact.id,
      priority: artifact.storySignature.narrativeWeight > 0.7 ? 9 : 6,
      dependencies,
      estimatedDuration: 15,  // 3D generation takes longer
      estimatedVRAM: 10,
      estimatedComfyLoad: 'heavy',
    });

    // Store the mapping for later lookup
    await this.storeJobMapping(artifact.id, '3d-generation', task.id);
    
    return task;
  }

  /**
   * Queue video generation with artifact injection
   */
  async queueVideoGeneration(
    job: VideoGenerationJob
  ): Promise<Task> {
    // Build dependencies based on artifact readiness
    const dependencies: string[] = [];
    
    if (job.artifacts) {
      for (const artifactRef of job.artifacts) {
        // Check if canonical images exist
        const mapping = await this.getJobMapping(artifactRef.artifactId, 'canonical');
        if (mapping) {
          dependencies.push(mapping.taskId);
        }
      }
    }

    const content = `Generate ${job.type} video for scene ${job.sceneId}, shot ${job.shotId}` +
      (job.artifacts ? ` with ${job.artifacts.length} artifacts` : '');

    const task = await this.createTask(content, {
      category: 'video-generate',
      filmJobId: job.id,
      priority: 7,
      dependencies,
      estimatedDuration: job.params.duration * 2,  // Rough estimate: 2x real-time
      estimatedVRAM: job.params.model.includes('14b') ? 16 : 10,
      estimatedComfyLoad: 'heavy',
    });

    // Update job with ACC task ID
    await this.storeJobMapping(job.id, 'video', task.id);
    
    return task;
  }

  /**
   * Queue drift verification for an artifact appearance
   */
  async queueDriftVerification(
    artifactId: string,
    sceneId: string,
    shotId: string,
    generatedImagePath: string
  ): Promise<Task> {
    const content = `Verify artifact ${artifactId} consistency in scene ${sceneId}, shot ${shotId}`;

    return this.createTask(content, {
      category: 'drift-verify',
      filmJobId: `${artifactId}-${sceneId}-${shotId}`,
      priority: 6,
      dependencies: [],  // Can run immediately
      estimatedDuration: 2,
      estimatedVRAM: 4,
      estimatedComfyLoad: 'light',
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // QUEUE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get current queue status for film jobs
   */
  async getFilmQueueStatus(): Promise<{
    pending: number;
    inProgress: number;
    byCategory: Record<string, { pending: number; inProgress: number }>;
  }> {
    const allTasks = await this.getAllTasks();
    const filmTasks = allTasks.filter(t => 
      t.category && Object.keys(FILM_CATEGORY_ROUTING).includes(t.category)
    );

    const byCategory: Record<string, { pending: number; inProgress: number }> = {};

    for (const task of filmTasks) {
      if (!task.category) continue;
      
      if (!byCategory[task.category]) {
        byCategory[task.category] = { pending: 0, inProgress: 0 };
      }

      if (task.status === 'pending') {
        byCategory[task.category].pending++;
      } else if (task.status === 'in_progress') {
        byCategory[task.category].inProgress++;
      }
    }

    return {
      pending: filmTasks.filter(t => t.status === 'pending').length,
      inProgress: filmTasks.filter(t => t.status === 'in_progress').length,
      byCategory,
    };
  }

  /**
   * Wait for a task to complete
   */
  async waitForTask(
    taskId: string,
    options: {
      pollInterval?: number;
      timeout?: number;
      onProgress?: (task: Task) => void;
    } = {}
  ): Promise<Task> {
    const { pollInterval = 5000, timeout = 600000 } = options;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const check = async () => {
        try {
          const task = await this.getTask(taskId);
          
          if (!task) {
            reject(new Error(`Task ${taskId} not found`));
            return;
          }

          options.onProgress?.(task);

          if (task.status === 'completed') {
            resolve(task);
            return;
          }

          if (task.status === 'failed') {
            reject(new Error(`Task ${taskId} failed`));
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error(`Timeout waiting for task ${taskId}`));
            return;
          }

          setTimeout(check, pollInterval);
        } catch (error) {
          reject(error);
        }
      };

      check();
    });
  }

  /**
   * Bulk queue multiple jobs with dependency ordering
   */
  async queueProductionBatch(
    jobs: Array<VideoGenerationJob & { dependencies?: string[] }>
  ): Promise<Task[]> {
    const createdTasks: Task[] = [];
    const jobToTaskMap = new Map<string, string>();

    // Sort jobs by dependency depth
    const sortedJobs = this.topologicalSort(jobs);

    for (const job of sortedJobs) {
      // Map job dependencies to task dependencies
      const taskDependencies = (job.dependencies || [])
        .map(depId => jobToTaskMap.get(depId))
        .filter((id): id is string => !!id);

      // Create the task
      const task = await this.queueVideoGeneration({
        ...job,
        // Dependencies will be handled by the queue system
      });

      createdTasks.push(task);
      jobToTaskMap.set(job.id, task.id);

      // Update with proper dependencies if any
      if (taskDependencies.length > 0) {
        await this.updateTaskStatus(task.id, 'pending', {
          dependencies: taskDependencies,
        });
      }
    }

    return createdTasks;
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  private async getAllTasks(): Promise<Task[]> {
    const response = await fetch(`${this.baseUrl}/api/tasks`);
    if (!response.ok) return [];
    return response.json();
  }

  private async storeJobMapping(
    filmJobId: string,
    jobType: string,
    accTaskId: string
  ): Promise<void> {
    // Store in local JSON file for persistence
    // In production, this should be a database
    const mappingPath = `${process.cwd()}/.film-bridge/job-mappings.json`;
    
    let mappings: Record<string, Record<string, { taskId: string; createdAt: string }>> = {};
    
    try {
      const fs = await import('fs');
      if (fs.existsSync(mappingPath)) {
        mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
      }
    } catch {
      // File doesn't exist yet
    }

    if (!mappings[filmJobId]) {
      mappings[filmJobId] = {};
    }

    mappings[filmJobId][jobType] = {
      taskId: accTaskId,
      createdAt: new Date().toISOString(),
    };

    const fs = await import('fs');
    fs.mkdirSync(mappingPath.split('/').slice(0, -1).join('/'), { recursive: true });
    fs.writeFileSync(mappingPath, JSON.stringify(mappings, null, 2));
  }

  private async getJobMapping(
    filmJobId: string,
    jobType: string
  ): Promise<{ taskId: string; createdAt: string } | null> {
    try {
      const fs = await import('fs');
      const mappingPath = `${process.cwd()}/.film-bridge/job-mappings.json`;
      
      if (!fs.existsSync(mappingPath)) return null;
      
      const mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
      return mappings[filmJobId]?.[jobType] ?? null;
    } catch {
      return null;
    }
  }

  private topologicalSort<T extends { id: string; dependencies?: string[] }>(
    items: T[]
  ): T[] {
    const visited = new Set<string>();
    const result: T[] = [];
    const itemMap = new Map(items.map(i => [i.id, i]));

    const visit = (item: T) => {
      if (visited.has(item.id)) return;
      visited.add(item.id);

      for (const depId of item.dependencies || []) {
        const dep = itemMap.get(depId);
        if (dep) visit(dep);
      }

      result.push(item);
    };

    for (const item of items) {
      visit(item);
    }

    return result;
  }
}

// Singleton
let client: ACCFilmClient | null = null;

export function getACCFilmClient(): ACCFilmClient {
  if (!client) {
    client = new ACCFilmClient();
  }
  return client;
}
