/**
 * ProGen - Procedural Character Generation System
 * 
 * Main orchestrator for batch generation, quality validation,
 * and character management.
 */

import { 
  CharacterGenerator, SeededRandom 
} from './generators/CharacterGenerator';
import { QualityValidator } from './validators/QualityValidator';
import { CharacterStore } from './CharacterStore';
import {
  ProGenCharacter, GenerationBatch, GenerationConfig, QualityReport,
  CharacterArchetype, StyleTheme, GenerationMetrics, CharacterRequest,
  CharacterResponse
} from './types';

interface ProGenOptions {
  targetQuality?: number;
  maxRetries?: number;
  storeThumbnails?: boolean;
}

interface GenerationProgress {
  batchId: string;
  total: number;
  generated: number;
  validated: number;
  approved: number;
  currentStage: 'generating' | 'validating' | 'complete';
  currentCharacter?: string;
}

type ProgressCallback = (progress: GenerationProgress) => void;

export class ProGen {
  private generator: CharacterGenerator;
  private validator: QualityValidator;
  private store: CharacterStore;
  private options: ProGenOptions;
  
  private batches: Map<string, GenerationBatch> = new Map();
  private isGenerating = false;
  
  constructor(options: ProGenOptions = {}) {
    this.options = {
      targetQuality: 75,
      maxRetries: 5,
      storeThumbnails: true,
      ...options
    };
    
    this.generator = new CharacterGenerator();
    this.validator = new QualityValidator();
    this.store = new CharacterStore();
  }
  
  /**
   * Create and start a new generation batch
   */
  async createBatch(
    name: string,
    config: GenerationConfig,
    onProgress?: ProgressCallback
  ): Promise<GenerationBatch> {
    const batch: GenerationBatch = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      config: {
        ...config,
        qualityThreshold: config.qualityThreshold ?? this.options.targetQuality!
      },
      status: 'pending',
      progress: {
        total: config.count,
        generated: 0,
        validated: 0,
        approved: 0,
        currentStage: 'generating'
      },
      createdAt: new Date()
    };
    
    this.batches.set(batch.id, batch);
    
    // Start generation asynchronously
    this.processBatch(batch.id, onProgress).catch(error => {
      console.error(`[ProGen] Batch ${batch.id} failed:`, error);
      batch.status = 'failed';
    });
    
    return batch;
  }
  
  /**
   * Process a generation batch
   */
  private async processBatch(batchId: string, onProgress?: ProgressCallback): Promise<void> {
    if (this.isGenerating) {
      throw new Error('Another batch is currently being processed');
    }
    
    this.isGenerating = true;
    const batch = this.batches.get(batchId)!;
    batch.status = 'generating';
    
    const approvedCharacters: ProGenCharacter[] = [];
    const reports: QualityReport[] = [];
    
    try {
      // Generate characters with retry logic
      for (let i = 0; i < batch.config.count; i++) {
        const character = await this.generateWithRetry(batch.config);
        
        batch.progress.generated++;
        batch.progress.currentStage = 'generating';
        
        if (onProgress) {
          onProgress({
            batchId,
            ...batch.progress,
            currentStage: 'generating',
            currentCharacter: character.identity.displayName
          });
        }
        
        // Validate
        batch.status = 'validating';
        const report = this.validator.validate(character);
        batch.progress.validated++;
        batch.progress.currentStage = 'validating';
        
        reports.push(report);
        
        if (report.passed) {
          approvedCharacters.push(character);
          batch.progress.approved++;
          
          // Add to store
          this.store.add(character);
        }
        
        if (onProgress) {
          onProgress({
            batchId,
            ...batch.progress,
            currentStage: 'validating',
            currentCharacter: character.identity.displayName
          });
        }
        
        // Small delay to prevent blocking
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      batch.status = 'complete';
      batch.completedAt = new Date();
      
      console.log(`[ProGen] Batch ${batchId} complete: ${approvedCharacters.length}/${batch.config.count} approved`);
      
      if (onProgress) {
        onProgress({
          batchId,
          ...batch.progress,
          currentStage: 'complete'
        });
      }
      
    } finally {
      this.isGenerating = false;
    }
  }
  
  /**
   * Generate a character with retry logic
   */
  private async generateWithRetry(config: GenerationConfig): Promise<ProGenCharacter> {
    let attempts = 0;
    let character: ProGenCharacter;
    
    do {
      const seed = Math.floor(Math.random() * 1000000) + attempts;
      const archetype = config.archetypes?.[attempts % config.archetypes.length];
      const theme = config.styleThemes?.[attempts % config.styleThemes.length];
      
      character = this.generator.generate({ archetype, theme, seed });
      attempts++;
      
      // Quick quality check
      if (character.generation.quality.overall >= config.qualityThreshold) {
        break;
      }
    } while (attempts < (config.maxAttempts ?? this.options.maxRetries!));
    
    return character;
  }
  
  /**
   * Generate a single character immediately
   */
  generateOne(options: {
    archetype?: CharacterArchetype;
    theme?: StyleTheme;
    seed?: number;
    validate?: boolean;
  } = {}): { character: ProGenCharacter; report?: QualityReport } {
    const character = this.generator.generate({
      archetype: options.archetype,
      theme: options.theme,
      seed: options.seed
    });
    
    if (options.validate !== false) {
      const report = this.validator.validate(character);
      if (report.passed) {
        this.store.add(character);
      }
      return { character, report };
    }
    
    return { character };
  }
  
  /**
   * Get batch status
   */
  getBatch(batchId: string): GenerationBatch | undefined {
    return this.batches.get(batchId);
  }
  
  /**
   * Get all batches
   */
  getAllBatches(): GenerationBatch[] {
    return Array.from(this.batches.values());
  }
  
  /**
   * Get character from store
   */
  getCharacter(id: string): CharacterResponse | null {
    return this.store.get(id);
  }
  
  /**
   * Find characters matching criteria
   */
  findCharacters(request: CharacterRequest = {}): CharacterResponse | null {
    return this.store.getRandom(request);
  }
  
  /**
   * Get store stats
   */
  getStoreStats() {
    return this.store.getStats();
  }
  
  /**
   * Get validator stats
   */
  getValidatorStats() {
    return this.validator.getStats();
  }
  
  /**
   * Get overall metrics
   */
  getMetrics(): GenerationMetrics {
    const storeStats = this.store.getStats();
    const validatorStats = this.validator.getStats();
    const batches = Array.from(this.batches.values());
    
    const completedBatches = batches.filter(b => b.status === 'complete');
    const totalGenerated = batches.reduce((sum, b) => sum + b.progress.generated, 0);
    const totalApproved = batches.reduce((sum, b) => sum + b.progress.approved, 0);
    
    const popularArchetypes = {} as Record<CharacterArchetype, number>;
    for (const [archetype, count] of Object.entries(storeStats.byArchetype)) {
      popularArchetypes[archetype as CharacterArchetype] = count;
    }
    
    return {
      totalGenerated,
      totalApproved,
      averageQuality: validatorStats.averageQuality,
      averageGenerationTime: 0, // Would track actual timing
      cacheHitRate: storeStats.cacheHitRate,
      popularArchetypes
    };
  }
  
  /**
   * Pre-generate a library of characters
   */
  async pregenerateLibrary(
    counts: Partial<Record<CharacterArchetype, number>> = {},
    themes: StyleTheme[] = ['cyberpunk', 'solarpunk', 'minimalist', 'vibrant'],
    onProgress?: ProgressCallback
  ): Promise<string[]> {
    const batchIds: string[] = [];
    const archetypes = Object.keys(counts) as CharacterArchetype[];
    
    for (const archetype of archetypes) {
      const count = counts[archetype] ?? 10;
      
      const batch = await this.createBatch(
        `Library: ${archetype}`,
        {
          count,
          archetypes: [archetype],
          styleThemes: themes,
          qualityThreshold: 70,
          variationStrategy: 'clustered',
          allowDuplicates: false,
          maxAttempts: 5
        },
        onProgress
      );
      
      batchIds.push(batch.id);
    }
    
    return batchIds;
  }
  
  /**
   * Export all characters
   */
  exportCharacters(): ProGenCharacter[] {
    return this.store.exportAll();
  }
  
  /**
   * Import characters
   */
  importCharacters(characters: ProGenCharacter[]): void {
    this.store.import(characters);
  }
  
  /**
   * Clear all data
   */
  clear(): void {
    this.batches.clear();
    this.store.clear();
    this.validator.clearHistory();
  }
}

// Singleton instance
let progenInstance: ProGen | null = null;

export function getProGen(options?: ProGenOptions): ProGen {
  if (!progenInstance) {
    progenInstance = new ProGen(options);
  }
  return progenInstance;
}

export function resetProGen(): void {
  progenInstance = null;
}

export default ProGen;
