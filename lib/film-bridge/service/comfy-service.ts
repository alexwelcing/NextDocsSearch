/**
 * ComfyUI Service Manager
 * Handles startup, shutdown, VRAM monitoring, and model lifecycle
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import type { ExecutionStatus } from '../types';

export interface ComfyServiceConfig {
  // Paths
  comfyDir: string;
  pythonPath: string;
  
  // GPU settings
  gpuType: 'nvidia' | 'amd' | 'cpu';
  vramLimitGB: number;
  vramCircuitThreshold: number; // Percentage at which to open circuit breaker (default 95)
  
  // Port (default 8188)
  port: number;
  
  // Startup options
  autoStart: boolean;
  maxRetries: number;
  healthCheckInterval: number;
  
  // Model management
  aggressiveUnload: boolean;  // Unload models between jobs
  keepModelsInMemory: string[];  // Models to keep loaded
}

export interface VRAMStatus {
  totalMB: number;
  usedMB: number;
  freeMB: number;
  percentUsed: number;
  timestamp: number;
}

export interface ComfyHealth {
  status: 'starting' | 'healthy' | 'unhealthy' | 'stopped' | 'crashed';
  uptime: number;
  lastResponse: number;
  queueDepth: number;
  currentJob?: string;
  vram: VRAMStatus;
  loadedModels: string[];
}

export interface ModelLoadRequest {
  type: 'checkpoint' | 'unet' | 'vae' | 'clip' | 'lora';
  name: string;
  priority: number;
  estimatedVRAM_MB: number;
}

export class ComfyService extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: ComfyServiceConfig;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private vramMonitorTimer: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private retryCount: number = 0;
  private currentVRAM: VRAMStatus = { totalMB: 0, usedMB: 0, freeMB: 0, percentUsed: 0, timestamp: 0 };
  private loadedModels: Set<string> = new Set();
  private modelQueue: ModelLoadRequest[] = [];
  private isShuttingDown: boolean = false;
  private circuitOpen: boolean = false;

  constructor(config: Partial<ComfyServiceConfig> = {}) {
    super();
    
    this.config = {
      comfyDir: process.env.COMFY_DIR || 'C:/Users/alexw/Downloads/USE_THIS_COMFY/ComfyUI_windows_portable/ComfyUI',
      pythonPath: process.env.COMFY_PYTHON || 'C:/Users/alexw/Downloads/USE_THIS_COMFY/ComfyUI_windows_portable/python_embeded/python.exe',
      gpuType: 'nvidia',
      vramLimitGB: 18,  // Leave 2GB headroom on 20GB card
      vramCircuitThreshold: 95,
      port: 8188,
      autoStart: false,
      maxRetries: 3,
      healthCheckInterval: 5000,
      aggressiveUnload: true,
      keepModelsInMemory: [],
      ...config,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async start(): Promise<void> {
    if (this.process) {
      throw new Error('ComfyUI is already running');
    }

    this.isShuttingDown = false;
    this.emit('status', { status: 'starting', message: 'Initializing ComfyUI...' });

    // Check if already running on port
    const isRunning = await this.checkIfRunning();
    if (isRunning) {
      this.emit('status', { status: 'healthy', message: 'ComfyUI already running' });
      this.startMonitoring();
      return;
    }

    // Build command
    const mainPy = path.join(this.config.comfyDir, 'main.py');
    const args = [
      mainPy,
      '--port', this.config.port.toString(),
      '--listen', '127.0.0.1',
    ];

    // GPU-specific args
    if (this.config.gpuType === 'nvidia') {
      args.push('--cuda-device', '0');
    }

    // VRAM management args
    if (this.config.aggressiveUnload) {
      args.push('--normalvram');  // More aggressive unloading
    }

    this.emit('log', `Starting: ${this.config.pythonPath} ${args.join(' ')}`);

    // Spawn process
    this.process = spawn(this.config.pythonPath, args, {
      cwd: this.config.comfyDir,
      env: {
        ...process.env,
        PYTHONPATH: this.config.comfyDir,
        CUDA_VISIBLE_DEVICES: '0',
      },
    });

    this.startTime = Date.now();

    // Handle process events
    this.process.stdout?.on('data', (data) => {
      const line = data.toString();
      this.emit('log', line);
      this.parseLogLine(line);
    });

    this.process.stderr?.on('data', (data) => {
      this.emit('error', data.toString());
    });

    this.process.on('close', (code) => {
      this.handleExit(code);
    });

    this.process.on('error', (err) => {
      this.emit('error', `Process error: ${err.message}`);
      this.handleExit(1);
    });

    // Wait for healthy
    await this.waitForHealthy();
    this.startMonitoring();
  }

  async stop(): Promise<void> {
    this.isShuttingDown = true;
    this.stopMonitoring();

    if (!this.process) {
      return;
    }

    this.emit('status', { status: 'stopping', message: 'Shutting down ComfyUI...' });

    // Graceful shutdown
    this.process.kill('SIGTERM');

    // Force kill after timeout
    setTimeout(() => {
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
      }
    }, 10000);

    return new Promise((resolve) => {
      this.process?.on('close', () => {
        this.process = null;
        resolve();
      });
    });

  }

  async restart(): Promise<void> {
    await this.stop();
    await new Promise(r => setTimeout(r, 2000));
    await this.start();
  }

  // ═══════════════════════════════════════════════════════════════
  // HEALTH MONITORING
  // ═══════════════════════════════════════════════════════════════

  private async checkIfRunning(): Promise<boolean> {
    try {
      const response = await fetch(`http://127.0.0.1:${this.config.port}/system_stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async waitForHealthy(timeout: number = 60000): Promise<void> {
    const start = Date.now();
    
    return new Promise((resolve, reject) => {
      const check = async () => {
        const healthy = await this.checkIfRunning();
        
        if (healthy) {
          this.retryCount = 0;
          this.emit('status', { status: 'healthy', message: 'ComfyUI ready' });
          resolve();
          return;
        }

        if (Date.now() - start > timeout) {
          reject(new Error('Timeout waiting for ComfyUI to start'));
          return;
        }

        setTimeout(check, 1000);
      };

      check();
    });
  }

  private startMonitoring(): void {
    // Health check
    this.healthCheckTimer = setInterval(async () => {
      const healthy = await this.checkIfRunning();
      
      if (!healthy && !this.isShuttingDown) {
        this.emit('status', { status: 'unhealthy', message: 'ComfyUI not responding' });
        this.handleUnhealthy();
      }
    }, this.config.healthCheckInterval);

    // VRAM monitoring (NVIDIA only for now)
    if (this.config.gpuType === 'nvidia') {
      this.vramMonitorTimer = setInterval(() => {
        this.updateVRAMStatus();
      }, 2000);
    }
  }

  private stopMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    if (this.vramMonitorTimer) {
      clearInterval(this.vramMonitorTimer);
      this.vramMonitorTimer = null;
    }
  }

  private async updateVRAMStatus(): Promise<void> {
    try {
      // Query nvidia-smi
      const { exec } = await import('child_process');
      
      exec('nvidia-smi --query-gpu=memory.total,memory.used --format=csv,noheader,nounits', (err, stdout) => {
        if (err) return;
        
        const [total, used] = stdout.trim().split(',').map(Number);
        this.currentVRAM = {
          totalMB: total,
          usedMB: used,
          freeMB: total - used,
          percentUsed: (used / total) * 100,
          timestamp: Date.now(),
        };

        this.emit('vram', this.currentVRAM);

        // Circuit breaker logic
        const threshold = this.config.vramCircuitThreshold;
        const hysteresis = 10; // Close circuit when 10% below threshold
        if (this.currentVRAM.percentUsed >= threshold && !this.circuitOpen) {
          this.circuitOpen = true;
          this.emit('circuit_open', {
            type: 'vram_circuit_open',
            message: `VRAM circuit breaker OPEN at ${this.currentVRAM.percentUsed.toFixed(1)}% (threshold: ${threshold}%)`,
            vram: this.currentVRAM,
          });
          this.emergencyUnload();
        } else if (this.circuitOpen && this.currentVRAM.percentUsed <= threshold - hysteresis) {
          this.circuitOpen = false;
          this.emit('circuit_closed', {
            type: 'vram_circuit_closed',
            message: `VRAM circuit breaker CLOSED at ${this.currentVRAM.percentUsed.toFixed(1)}%`,
            vram: this.currentVRAM,
          });
        }

        // Check if approaching limit
        const limitMB = this.config.vramLimitGB * 1024;
        if (this.currentVRAM.usedMB > limitMB) {
          this.emit('warning', {
            type: 'vram_critical',
            message: `VRAM at ${this.currentVRAM.percentUsed.toFixed(1)}%`,
            vram: this.currentVRAM,
          });
          
          // Trigger emergency unload
          this.emergencyUnload();
        }
      });
    } catch (error) {
      // nvidia-smi not available
    }
  }

  private async emergencyUnload(): Promise<void> {
    this.emit('action', { type: 'emergency_unload', message: 'Freeing VRAM...' });
    
    try {
      // Call ComfyUI's free memory endpoint
      await fetch(`http://127.0.0.1:${this.config.port}/free`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unload_models: true, free_memory: true }),
      });
      
      this.loadedModels.clear();
    } catch (error) {
      this.emit('error', `Emergency unload failed: ${error}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MODEL LIFECYCLE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async requestModelLoad(request: ModelLoadRequest): Promise<boolean> {
    const vramLimit = this.config.vramLimitGB * 1024;
    const projectedVRAM = this.currentVRAM.usedMB + request.estimatedVRAM_MB;

    // Check if we need to unload first
    if (projectedVRAM > vramLimit * 0.9) {
      this.emit('action', {
        type: 'model_unload',
        message: `Unloading models to make room for ${request.name}`,
      });
      
      await this.unloadNonEssentialModels();
    }

    // Add to queue
    this.modelQueue.push(request);
    this.modelQueue.sort((a, b) => b.priority - a.priority);

    // Try to load
    return this.processModelQueue();
  }

  private async processModelQueue(): Promise<boolean> {
    while (this.modelQueue.length > 0) {
      const request = this.modelQueue[0];
      
      // Check VRAM again
      const vramLimit = this.config.vramLimitGB * 1024;
      const projectedVRAM = this.currentVRAM.usedMB + request.estimatedVRAM_MB;
      
      if (projectedVRAM > vramLimit) {
        this.emit('warning', {
          type: 'vram_insufficient',
          message: `Cannot load ${request.name}: insufficient VRAM`,
        });
        return false;
      }

      // Load the model
      this.modelQueue.shift();
      this.loadedModels.add(`${request.type}:${request.name}`);
      
      this.emit('model_loaded', {
        type: request.type,
        name: request.name,
        vramAfter: this.currentVRAM.usedMB + request.estimatedVRAM_MB,
      });
    }

    return true;
  }

  private async unloadNonEssentialModels(): Promise<void> {
    const toKeep = new Set(this.config.keepModelsInMemory);
    
    for (const model of this.loadedModels) {
      if (!toKeep.has(model)) {
        // Request ComfyUI to unload
        this.loadedModels.delete(model);
      }
    }

    // Trigger garbage collection in Comfy
    try {
      await fetch(`http://127.0.0.1:${this.config.port}/free`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unload_models: false, free_memory: true }),
      });
    } catch (error) {
      // Ignore
    }
  }

  async unloadAllModels(): Promise<void> {
    this.loadedModels.clear();
    await this.emergencyUnload();
  }

  // ═══════════════════════════════════════════════════════════════
  // WORKFLOW EXECUTION WITH RESOURCE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async executeWorkflowWithResources(
    workflow: Record<string, unknown>,
    options: {
      estimatedVRAM_MB: number;
      requiredModels: ModelLoadRequest[];
      timeout?: number;
      onProgress?: (progress: number) => void;
    }
  ): Promise<ExecutionStatus> {
    // Pre-flight checks
    const vramLimit = this.config.vramLimitGB * 1024;
    
    if (this.currentVRAM.usedMB + options.estimatedVRAM_MB > vramLimit) {
      // Try to free up space
      await this.unloadNonEssentialModels();
      await new Promise(r => setTimeout(r, 1000));  // Wait for GC
      
      // Check again
      if (this.currentVRAM.usedMB + options.estimatedVRAM_MB > vramLimit) {
        throw new Error(
          `Insufficient VRAM: need ${options.estimatedVRAM_MB}MB, ` +
          `have ${vramLimit - this.currentVRAM.usedMB}MB free`
        );
      }
    }

    // Load required models
    for (const model of options.requiredModels) {
      const loaded = await this.requestModelLoad(model);
      if (!loaded) {
        throw new Error(`Failed to load required model: ${model.name}`);
      }
    }

    // Execute workflow via Comfy API
    const client = await import('../comfy-client');
    const comfy = client.getComfyClient({ baseUrl: `http://127.0.0.1:${this.config.port}` });

    try {
      const result = await comfy.executeWorkflow(workflow as import('../types').ComfyWorkflow, {
        waitTimeout: options.timeout,
        onProgress: options.onProgress,
      });

      // Post-execution cleanup
      if (this.config.aggressiveUnload) {
        // Keep only explicitly configured models
        const toUnload = Array.from(this.loadedModels).filter(
          m => !this.config.keepModelsInMemory.includes(m)
        );
        
        for (const model of toUnload) {
          this.loadedModels.delete(model);
        }

        if (toUnload.length > 0) {
          await this.emergencyUnload();
        }
      }

      return result;
    } catch (error) {
      // Always try to free VRAM on error
      await this.emergencyUnload();
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════

  private parseLogLine(line: string): void {
    // Parse model loading
    const modelMatch = line.match(/Loading (\w+): (.+)$/);
    if (modelMatch) {
      const [, type, name] = modelMatch;
      this.loadedModels.add(`${type}:${name}`);
      this.emit('model_loaded', { type, name });
    }

    // Parse VRAM usage
    const vramMatch = line.match(/VRAM used: (\d+\.?\d*) MB/);
    if (vramMatch) {
      const usedMB = parseFloat(vramMatch[1]);
      this.currentVRAM.usedMB = usedMB;
      this.currentVRAM.percentUsed = (usedMB / this.currentVRAM.totalMB) * 100;
    }

    // Parse job start
    const jobMatch = line.match(/Prompt executed in ([\d.]+)s/);
    if (jobMatch) {
      this.emit('job_complete', { duration: parseFloat(jobMatch[1]) });
    }
  }

  private handleExit(code: number | null): void {
    this.process = null;
    this.stopMonitoring();

    if (this.isShuttingDown) {
      this.emit('status', { status: 'stopped', message: 'ComfyUI stopped' });
      return;
    }

    if (code !== 0) {
      this.emit('status', { status: 'crashed', message: `ComfyUI crashed (code ${code})` });
      
      // Auto-retry
      if (this.retryCount < this.config.maxRetries) {
        this.retryCount++;
        this.emit('action', { 
          type: 'restart', 
          message: `Restarting (attempt ${this.retryCount}/${this.config.maxRetries})...` 
        });
        
        setTimeout(() => this.start(), 5000);
      }
    }
  }

  private handleUnhealthy(): void {
    if (this.retryCount < this.config.maxRetries) {
      this.restart();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  getHealth(): ComfyHealth {
    return {
      status: this.process ? 'healthy' : 'stopped',
      uptime: this.process ? Date.now() - this.startTime : 0,
      lastResponse: Date.now(),
      queueDepth: 0,  // TODO: Query from ComfyUI
      vram: this.currentVRAM,
      loadedModels: Array.from(this.loadedModels),
    };
  }

  isCircuitOpen(): boolean {
    return this.circuitOpen;
  }

  async waitForCircuitClose(timeoutMs: number = 120000): Promise<void> {
    if (!this.circuitOpen) return;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (!this.circuitOpen) return;
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('Timeout waiting for VRAM circuit breaker to close');
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  getConfig(): ComfyServiceConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<ComfyServiceConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Singleton
let service: ComfyService | null = null;

export function getComfyService(config?: Partial<ComfyServiceConfig>): ComfyService {
  if (!service) {
    service = new ComfyService(config);
  }
  return service;
}
