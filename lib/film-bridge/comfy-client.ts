/**
 * ComfyUI API Client
 * Handles all communication with the local ComfyUI instance
 */

import type {
  ComfyUIConfig,
  ComfyWorkflow,
  QueuedPromptResponse,
  ExecutionStatus,
  ComfyOutput,
} from './types';

const DEFAULT_CONFIG: ComfyUIConfig = {
  baseUrl: 'http://127.0.0.1:8188',
  apiPath: '/api',
  wsPath: '/ws',
  timeout: 300000,  // 5 minutes for initial queue
};

export class ComfyClient {
  private config: ComfyUIConfig;
  private ws: WebSocket | null = null;
  private pendingPromises: Map<string, {
    resolve: (value: ExecutionStatus) => void;
    reject: (reason: Error) => void;
  }> = new Map();

  constructor(config: Partial<ComfyUIConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ═══════════════════════════════════════════════════════════════
  // HTTP API METHODS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Queue a workflow for execution
   */
  async queueWorkflow(
    workflow: ComfyWorkflow,
    clientId: string = `film-bridge-${Date.now()}`
  ): Promise<QueuedPromptResponse> {
    const url = `${this.config.baseUrl}${this.config.apiPath}/prompt`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: workflow,
        client_id: clientId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to queue workflow: ${error}`);
    }

    return response.json();
  }

  /**
   * Get current queue status
   */
  async getQueue(): Promise<{ queue_running: string[]; queue_pending: string[] }> {
    const url = `${this.config.baseUrl}${this.config.apiPath}/queue`;
    const response = await fetch(url);
    return response.json();
  }

  /**
   * Get execution history
   */
  async getHistory(promptId?: string): Promise<Record<string, unknown>> {
    const url = promptId 
      ? `${this.config.baseUrl}${this.config.apiPath}/history/${promptId}`
      : `${this.config.baseUrl}${this.config.apiPath}/history`;
    const response = await fetch(url);
    return response.json();
  }

  /**
   * Get output file
   */
  getOutputUrl(filename: string, subfolder: string = '', type: 'output' | 'temp' = 'output'): string {
    const params = new URLSearchParams({
      filename,
      subfolder,
      type,
    });
    return `${this.config.baseUrl}${this.config.apiPath}/view?${params}`;
  }

  /**
   * Download output file
   */
  async downloadOutput(
    filename: string,
    subfolder: string = '',
    type: 'output' | 'temp' = 'output'
  ): Promise<Buffer> {
    const url = this.getOutputUrl(filename, subfolder, type);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download ${filename}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Upload input image
   */
  async uploadImage(
    imageBuffer: Buffer,
    filename: string,
    overwrite: boolean = true
  ): Promise<{ name: string; subfolder: string }> {
    const url = `${this.config.baseUrl}${this.config.apiPath}/upload/image`;
    
    const formData = new FormData();
    formData.append('image', new Blob([imageBuffer]), filename);
    formData.append('overwrite', overwrite.toString());

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload image: ${await response.text()}`);
    }

    return response.json();
  }

  // ═══════════════════════════════════════════════════════════════
  // WEBSOCKET METHODS (Real-time progress)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket(clientId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.config.baseUrl.replace('http', 'ws')}${this.config.wsPath}?clientId=${clientId}`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[ComfyClient] WebSocket connected');
        resolve();
      };
      
      this.ws.onerror = (error) => {
        console.error('[ComfyClient] WebSocket error:', error);
        reject(error);
      };
      
      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event.data);
      };
      
      this.ws.onclose = () => {
        console.log('[ComfyClient] WebSocket disconnected');
        this.ws = null;
      };
    });
  }

  /**
   * Wait for a specific prompt to complete
   */
  async waitForCompletion(promptId: string, timeout: number = 600000): Promise<ExecutionStatus> {
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        this.pendingPromises.delete(promptId);
        reject(new Error(`Timeout waiting for prompt ${promptId}`));
      }, timeout);

      // Store promise handlers
      this.pendingPromises.set(promptId, {
        resolve: (status) => {
          clearTimeout(timeoutId);
          resolve(status);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      });
    });
  }

  private handleWebSocketMessage(data: string) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'progress': {
          // Update progress for running prompt
          const { prompt_id, value, max } = message.data;
          const progress = max > 0 ? (value / max) * 100 : 0;
          console.log(`[ComfyClient] Progress ${prompt_id}: ${progress.toFixed(1)}%`);
          break;
        }
        
        case 'execution_start': {
          console.log(`[ComfyClient] Execution started: ${message.data.prompt_id}`);
          break;
        }
        
        case 'executing': {
          console.log(`[ComfyClient] Executing node: ${message.data.node}`);
          break;
        }
        
        case 'execution_success': {
          const promptId = message.data.prompt_id;
          const promise = this.pendingPromises.get(promptId);
          if (promise) {
            promise.resolve({
              status: 'completed',
              prompt_id: promptId,
              outputs: message.data.outputs,
            });
            this.pendingPromises.delete(promptId);
          }
          break;
        }
        
        case 'execution_error': {
          const promptId = message.data.prompt_id;
          const promise = this.pendingPromises.get(promptId);
          if (promise) {
            promise.reject(new Error(`Execution error: ${message.data.error}`));
            this.pendingPromises.delete(promptId);
          }
          break;
        }
        
        default: {
          // console.log('[ComfyClient] Unknown message type:', message.type);
        }
      }
    } catch (error) {
      console.error('[ComfyClient] Failed to parse WebSocket message:', error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // HIGH-LEVEL WORKFLOW METHODS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Execute a workflow and wait for completion
   */
  async executeWorkflow(
    workflow: ComfyWorkflow,
    options: {
      clientId?: string;
      waitTimeout?: number;
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<ExecutionStatus> {
    const clientId = options.clientId || `film-bridge-${Date.now()}`;
    
    // Connect WebSocket for real-time updates
    await this.connectWebSocket(clientId);
    
    try {
      // Queue the workflow
      const queued = await this.queueWorkflow(workflow, clientId);
      console.log(`[ComfyClient] Queued prompt: ${queued.prompt_id}`);
      
      // Wait for completion
      const status = await this.waitForCompletion(queued.prompt_id, options.waitTimeout);
      
      // Fetch full history for outputs
      const history = await this.getHistory(queued.prompt_id);
      const promptHistory = history[queued.prompt_id];
      
      if (promptHistory) {
        status.outputs = (promptHistory as Record<string, unknown>).outputs as Record<string, ComfyOutput>;
      }
      
      return status;
    } finally {
      this.disconnect();
    }
  }

  /**
   * Check system status
   */
  async getSystemStats(): Promise<{
    queue_pending: number;
    queue_running: number;
    device: string;
    vram_used: number;
    vram_total: number;
  }> {
    const url = `${this.config.baseUrl}${this.config.apiPath}/system_stats`;
    const response = await fetch(url);
    return response.json();
  }
}

// Singleton instance
let defaultClient: ComfyClient | null = null;

export function getComfyClient(config?: Partial<ComfyUIConfig>): ComfyClient {
  if (!defaultClient) {
    defaultClient = new ComfyClient(config);
  }
  return defaultClient;
}
