/**
 * ProGen Character Store
 * 
 * Manages storage, indexing, and retrieval of generated characters.
 * Optimized for fast runtime access.
 */

import {
  ProGenCharacter, CharacterSummary, FilterOptions, SortOptions,
  CharacterRequest, CharacterResponse, CharacterArchetype, StyleTheme,
  GenerationMetrics
} from './types';

interface StoredCharacter {
  character: ProGenCharacter;
  thumbnailData?: string; // base64 or URL
  tags: string[];
  usageCount: number;
  lastAccessed: Date;
}

export class CharacterStore {
  private characters: Map<string, StoredCharacter> = new Map();
  private indexByArchetype: Map<CharacterArchetype, Set<string>> = new Map();
  private indexByTheme: Map<StyleTheme, Set<string>> = new Map();
  private indexByQuality: Map<string, Set<string>> = new Map(); // 'excellent' (>90), 'good' (>75), 'acceptable' (>60)
  
  private cacheHits = 0;
  private cacheMisses = 0;
  
  /**
   * Add a character to the store
   */
  add(character: ProGenCharacter, thumbnailData?: string): void {
    const stored: StoredCharacter = {
      character,
      thumbnailData,
      tags: this.generateTags(character),
      usageCount: 0,
      lastAccessed: new Date()
    };
    
    this.characters.set(character.identity.id, stored);
    this.updateIndexes(character.identity.id, character);
  }
  
  /**
   * Add multiple characters
   */
  addBatch(characters: ProGenCharacter[], thumbnails?: string[]): void {
    characters.forEach((char, i) => {
      this.add(char, thumbnails?.[i]);
    });
  }
  
  /**
   * Get a character by ID
   */
  get(id: string): CharacterResponse | null {
    const stored = this.characters.get(id);
    
    if (!stored) {
      this.cacheMisses++;
      return null;
    }
    
    // Update access stats
    stored.usageCount++;
    stored.lastAccessed = new Date();
    this.cacheHits++;
    
    return {
      character: stored.character,
      loadTime: 0, // Instant from memory
      cached: true
    };
  }
  
  /**
   * Find characters matching filters
   */
  find(filters: FilterOptions = {}, sort: SortOptions = { by: 'quality', direction: 'desc' }): CharacterSummary[] {
    let candidates = new Set<string>();
    
    // Apply archetype filter
    if (filters.archetypes && filters.archetypes.length > 0) {
      for (const archetype of filters.archetypes) {
        const ids = this.indexByArchetype.get(archetype);
        if (ids) {
          if (candidates.size === 0) {
            candidates = new Set(Array.from(ids));
          } else {
            // Intersection
            candidates = new Set(Array.from(candidates).filter(id => ids.has(id)));
          }
        }
      }
    }
    
    // Apply theme filter
    if (filters.themes && filters.themes.length > 0) {
      for (const theme of filters.themes) {
        const ids = this.indexByTheme.get(theme);
        if (ids) {
          if (candidates.size === 0) {
            candidates = new Set(Array.from(ids));
          } else {
            candidates = new Set(Array.from(candidates).filter(id => ids.has(id)));
          }
        }
      }
    }
    
    // Apply quality filter
    if (filters.qualityMin) {
      const qualityTier = filters.qualityMin >= 90 ? 'excellent' :
                         filters.qualityMin >= 75 ? 'good' : 'acceptable';
      const ids = this.indexByQuality.get(qualityTier);
      if (ids) {
        if (candidates.size === 0) {
          candidates = new Set(Array.from(ids));
        } else {
          candidates = new Set(Array.from(candidates).filter(id => ids.has(id)));
        }
      }
    }
    
    // If no filters applied, use all characters
    if (candidates.size === 0 && !filters.archetypes && !filters.themes && !filters.qualityMin) {
      candidates = new Set(this.characters.keys());
    }
    
    // Convert to summaries
    let summaries = Array.from(candidates)
      .map(id => this.toSummary(this.characters.get(id)!))
      .filter(s => {
        // Apply trait filter if specified
        if (filters.traits && filters.traits.length > 0) {
          return filters.traits.some(t => s.tags.includes(t));
        }
        return true;
      });
    
    // Sort
    summaries = this.sortSummaries(summaries, sort);
    
    return summaries;
  }
  
  /**
   * Get a random character matching criteria
   */
  getRandom(request: CharacterRequest = {}): CharacterResponse | null {
    const { archetype, theme, traitPreferences, excludeIds } = request;
    
    // Build candidate set
    let candidates: string[] = [];
    
    if (archetype) {
      const ids = this.indexByArchetype.get(archetype);
      if (ids) candidates = Array.from(ids);
    } else if (theme) {
      const ids = this.indexByTheme.get(theme);
      if (ids) candidates = Array.from(ids);
    } else {
      candidates = Array.from(this.characters.keys());
    }
    
    // Filter excluded
    if (excludeIds) {
      candidates = candidates.filter(id => !excludeIds.includes(id));
    }
    
    if (candidates.length === 0) {
      return null;
    }
    
    // Score candidates by trait preferences if provided
    if (traitPreferences && Object.keys(traitPreferences).length > 0) {
      const scored = candidates.map(id => {
        const char = this.characters.get(id)!.character;
        let score = 0;
        
        for (const [trait, preference] of Object.entries(traitPreferences)) {
          const charTrait = char.identity.traits.find(t => t.name === trait);
          if (charTrait) {
            score += 1 - Math.abs(charTrait.value - preference);
          }
        }
        
        return { id, score };
      });
      
      scored.sort((a, b) => b.score - a.score);
      candidates = scored.slice(0, Math.min(5, scored.length)).map(s => s.id);
    }
    
    // Pick random from top candidates
    const selectedId = candidates[Math.floor(Math.random() * candidates.length)];
    return this.get(selectedId);
  }
  
  /**
   * Get character thumbnail
   */
  getThumbnail(id: string): string | null {
    const stored = this.characters.get(id);
    return stored?.thumbnailData ?? null;
  }
  
  /**
   * Update character thumbnail
   */
  setThumbnail(id: string, thumbnailData: string): void {
    const stored = this.characters.get(id);
    if (stored) {
      stored.thumbnailData = thumbnailData;
    }
  }
  
  /**
   * Remove a character
   */
  remove(id: string): boolean {
    const stored = this.characters.get(id);
    if (!stored) return false;
    
    // Remove from indexes
    this.removeFromIndexes(id, stored.character);
    
    // Remove from store
    this.characters.delete(id);
    
    return true;
  }
  
  /**
   * Get store statistics
   */
  getStats(): {
    totalCharacters: number;
    byArchetype: Record<CharacterArchetype, number>;
    byQuality: { excellent: number; good: number; acceptable: number };
    cacheHitRate: number;
    mostUsed: CharacterSummary[];
  } {
    const byArchetype = {} as Record<CharacterArchetype, number>;
    for (const [archetype, ids] of Array.from(this.indexByArchetype.entries())) {
      byArchetype[archetype] = ids.size;
    }
    
    const byQuality = {
      excellent: this.indexByQuality.get('excellent')?.size ?? 0,
      good: this.indexByQuality.get('good')?.size ?? 0,
      acceptable: this.indexByQuality.get('acceptable')?.size ?? 0
    };
    
    const totalRequests = this.cacheHits + this.cacheMisses;
    
    const allSummaries = Array.from(this.characters.values())
      .map(s => this.toSummary(s))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);
    
    return {
      totalCharacters: this.characters.size,
      byArchetype,
      byQuality,
      cacheHitRate: totalRequests > 0 ? this.cacheHits / totalRequests : 0,
      mostUsed: allSummaries
    };
  }
  
  /**
   * Export all characters
   */
  exportAll(): ProGenCharacter[] {
    return Array.from(this.characters.values()).map(s => s.character);
  }
  
  /**
   * Import characters
   */
  import(characters: ProGenCharacter[], thumbnails?: string[]): void {
    this.addBatch(characters, thumbnails);
  }
  
  /**
   * Clear all characters
   */
  clear(): void {
    this.characters.clear();
    this.indexByArchetype.clear();
    this.indexByTheme.clear();
    this.indexByQuality.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
  
  // === Private Helpers ===
  
  private generateTags(character: ProGenCharacter): string[] {
    const tags: string[] = [
      character.identity.archetype,
      character.body.build,
      `quality-${character.generation.quality.overall >= 90 ? 'excellent' : character.generation.quality.overall >= 75 ? 'good' : 'standard'}`
    ];
    
    // Add trait tags
    for (const trait of character.identity.traits) {
      if (Math.abs(trait.value) > 0.5) {
        tags.push(`${trait.name}-${trait.value > 0 ? 'high' : 'low'}`);
      }
    }
    
    // Add outfit tags
    for (const layer of character.outfit) {
      tags.push(`outfit-${layer.style}`);
    }
    
    return tags;
  }
  
  private updateIndexes(id: string, character: ProGenCharacter): void {
    // Index by archetype
    const archetypeSet = this.indexByArchetype.get(character.identity.archetype) ?? new Set();
    archetypeSet.add(id);
    this.indexByArchetype.set(character.identity.archetype, archetypeSet);
    
    // Index by quality
    const quality = character.generation.quality.overall;
    const qualityTier = quality >= 90 ? 'excellent' : quality >= 75 ? 'good' : 'acceptable';
    const qualitySet = this.indexByQuality.get(qualityTier) ?? new Set();
    qualitySet.add(id);
    this.indexByQuality.set(qualityTier, qualitySet);
  }
  
  private removeFromIndexes(id: string, character: ProGenCharacter): void {
    const archetypeSet = this.indexByArchetype.get(character.identity.archetype);
    if (archetypeSet) {
      archetypeSet.delete(id);
    }
    
    const quality = character.generation.quality.overall;
    const qualityTier = quality >= 90 ? 'excellent' : quality >= 75 ? 'good' : 'acceptable';
    const qualitySet = this.indexByQuality.get(qualityTier);
    if (qualitySet) {
      qualitySet.delete(id);
    }
  }
  
  private toSummary(stored: StoredCharacter): CharacterSummary {
    return {
      id: stored.character.identity.id,
      name: stored.character.identity.displayName,
      archetype: stored.character.identity.archetype,
      thumbnailUrl: stored.thumbnailData ?? '',
      quality: stored.character.generation.quality,
      tags: stored.tags,
      usageCount: stored.usageCount
    };
  }
  
  private sortSummaries(summaries: CharacterSummary[], sort: SortOptions): CharacterSummary[] {
    return summaries.sort((a, b) => {
      let comparison = 0;
      
      switch (sort.by) {
        case 'quality':
          comparison = a.quality.overall - b.quality.overall;
          break;
        case 'newest':
          comparison = 0; // Would need creation date
          break;
        case 'popular':
          comparison = a.usageCount - b.usageCount;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
      }
      
      return sort.direction === 'desc' ? -comparison : comparison;
    });
  }
}

export default CharacterStore;
