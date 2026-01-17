/**
 * FAL AI Client with Queue Support
 *
 * Handles both synchronous and asynchronous (queue-based) requests
 * to FAL AI image generation models.
 */

import { FalImageModel, getModelById } from '../fal-models';

const FAL_BASE_URL = 'https://fal.run';
const FAL_QUEUE_URL = 'https://queue.fal.run';

export interface FalGenerationRequest {
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  params?: Record<string, unknown>;
  useQueue?: boolean;
}

export interface FalQueueStatus {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  queue_position?: number;
  logs?: Array<{ message: string; timestamp: string }>;
}

export interface FalGenerationResult {
  success: boolean;
  imageUrl?: string;
  videoUrl?: string;
  seed?: number;
  width?: number;
  height?: number;
  generationTimeMs?: number;
  cost?: number;
  error?: string;
  requestId?: string;
}

export class FalClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FAL_KEY || '';
    if (!this.apiKey) {
      throw new Error('FAL_KEY is required');
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Key ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Generate image synchronously (for fast models)
   */
  async generateSync(request: FalGenerationRequest): Promise<FalGenerationResult> {
    const model = getModelById(request.modelId);
    const endpoint = `${FAL_BASE_URL}/${request.modelId}`;

    const payload = this.buildPayload(request, model);

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `FAL API error (${response.status}): ${errorText}`,
        };
      }

      const data = await response.json() as Record<string, unknown>;
      const generationTimeMs = Date.now() - startTime;

      return this.parseResponse(data, generationTimeMs);

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, error: 'Request timed out after 2 minutes' };
      }
      return { success: false, error: String(err) };
    }
  }

  /**
   * Submit to queue (for slower models)
   */
  async submitToQueue(request: FalGenerationRequest): Promise<{ requestId: string } | { error: string }> {
    const model = getModelById(request.modelId);
    const endpoint = `${FAL_QUEUE_URL}/${request.modelId}`;

    const payload = this.buildPayload(request, model);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { error: `Queue submission failed (${response.status}): ${errorText}` };
      }

      const data = await response.json() as { request_id: string };
      return { requestId: data.request_id };

    } catch (err) {
      return { error: String(err) };
    }
  }

  /**
   * Check queue status
   */
  async checkQueueStatus(modelId: string, requestId: string): Promise<FalQueueStatus> {
    const endpoint = `${FAL_QUEUE_URL}/${modelId}/requests/${requestId}/status`;

    try {
      const response = await fetch(endpoint, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return { status: 'FAILED' };
      }

      return await response.json() as FalQueueStatus;

    } catch {
      return { status: 'FAILED' };
    }
  }

  /**
   * Get result from queue
   */
  async getQueueResult(modelId: string, requestId: string): Promise<FalGenerationResult> {
    const endpoint = `${FAL_QUEUE_URL}/${modelId}/requests/${requestId}`;

    try {
      const response = await fetch(endpoint, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Failed to get result: ${errorText}` };
      }

      const data = await response.json() as Record<string, unknown>;
      return this.parseResponse(data, 0);

    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Wait for queue completion with polling
   */
  async waitForCompletion(
    modelId: string,
    requestId: string,
    options?: { maxWaitMs?: number; pollIntervalMs?: number }
  ): Promise<FalGenerationResult> {
    const maxWaitMs = options?.maxWaitMs || 300000; // 5 minutes default
    const pollIntervalMs = options?.pollIntervalMs || 2000; // 2 seconds

    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkQueueStatus(modelId, requestId);

      if (status.status === 'COMPLETED') {
        const result = await this.getQueueResult(modelId, requestId);
        result.generationTimeMs = Date.now() - startTime;
        return result;
      }

      if (status.status === 'FAILED') {
        return { success: false, error: 'Generation failed in queue', requestId };
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    return { success: false, error: 'Queue timeout exceeded', requestId };
  }

  /**
   * Smart generate - uses sync for fast models, queue for slow ones
   */
  async generate(request: FalGenerationRequest): Promise<FalGenerationResult> {
    const model = getModelById(request.modelId);

    // Use queue for slow models or if explicitly requested
    const useQueue = request.useQueue || model?.speedTier === 'slow';

    if (useQueue) {
      const submitResult = await this.submitToQueue(request);

      if ('error' in submitResult) {
        return { success: false, error: submitResult.error };
      }

      return this.waitForCompletion(request.modelId, submitResult.requestId);
    }

    return this.generateSync(request);
  }

  private buildPayload(
    request: FalGenerationRequest,
    model?: FalImageModel
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      prompt: request.prompt,
      ...(model?.defaultParams || {}),
      ...(request.params || {}),
    };

    // Add negative prompt if supported
    if (request.negativePrompt && model?.supportsNegativePrompt) {
      payload.negative_prompt = request.negativePrompt;
    }

    return payload;
  }

  private parseResponse(
    data: Record<string, unknown>,
    generationTimeMs: number
  ): FalGenerationResult {
    // Extract image/video URL from various response formats
    const images = data.images as Array<{ url: string; width?: number; height?: number }> | undefined;
    const image = data.image as { url: string; width?: number; height?: number } | undefined;
    const video = data.video as Array<{ url: string }> | { url: string } | undefined;
    const output = data.output as { url: string } | undefined;

    const imageData = images?.[0] || image;
    const videoData = Array.isArray(video) ? video[0] : video;
    const outputData = output;

    const mainUrl = imageData?.url || videoData?.url || outputData?.url;

    if (!mainUrl) {
      return {
        success: false,
        error: 'No media URL in response',
      };
    }

    return {
      success: true,
      imageUrl: imageData?.url || outputData?.url, // fallback if video
      videoUrl: videoData?.url,
      seed: data.seed as number | undefined,
      width: imageData?.width || (data.width as number | undefined),
      height: imageData?.height || (data.height as number | undefined),
      generationTimeMs,
      cost: this.extractCost(data),
    };
  }

  private extractCost(data: Record<string, unknown>): number | undefined {
    const cost = data.cost as { total?: number } | undefined;
    const billing = data.billing as { total?: number } | undefined;
    const usage = data.usage as { total?: number } | undefined;

    return cost?.total || billing?.total || usage?.total;
  }
}

// Export singleton instance
let clientInstance: FalClient | null = null;

export function getFalClient(): FalClient {
  if (!clientInstance) {
    clientInstance = new FalClient();
  }
  return clientInstance;
}
