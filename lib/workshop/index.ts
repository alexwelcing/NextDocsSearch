/**
 * MODERN WORKSHOP - LIBRARY INDEX
 *
 * Re-exports all workshop utilities for cleaner imports.
 */

// Mind Map Data
export {
  CATEGORY_IDS,
  BRANCH_COLORS,
  MIND_MAP_CATEGORIES,
  WORKSHOP_MIND_MAP,
  getDescendants,
  getAncestorPath,
  getCategoriesAtDepth,
  searchCategories,
} from './mindmap-data';

// Preprocessing
export {
  generateResourceId,
  extractDomain,
  detectResourceType,
  detectVideoPlatform,
  extractYouTubeId,
  autoCategorize,
  extractKeyTopics,
  hasCitations,
  hasCodeExamples,
  createLinkResource,
  createVideoResource,
  createPDFResource,
  preprocessUrlInput,
  parseBatchUrls,
  createEnrichedData,
  updateQualityFromDomain,
} from './preprocess';

// Seed Data
export {
  SEED_RESOURCES,
  SEED_RESOURCE_COUNTS,
  generateSeedResources,
  calculateResourceCounts,
} from './seed-data';
