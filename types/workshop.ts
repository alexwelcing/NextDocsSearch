/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODERN WORKSHOP - TYPE DEFINITIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A comprehensive type system for organizing PDFs, Links, Videos, and Reports
 * into a hierarchical mind map structure with 3D visualization support.
 */

// ═══════════════════════════════════════════════════════════════════════════
// RESOURCE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ResourceType = 'link' | 'pdf' | 'video' | 'report' | 'presentation';

export type ProcessingStatus =
  | 'pending'      // Not yet processed
  | 'processing'   // Currently being verified/enriched
  | 'verified'     // Successfully verified and enriched
  | 'failed'       // Processing failed (broken link, etc.)
  | 'manual';      // Manually added without verification

export type QualityScore = 1 | 2 | 3 | 4 | 5; // 1=low, 5=authoritative

/**
 * Base resource interface - common fields for all resources
 */
export interface WorkshopResource {
  id: string;
  type: ResourceType;

  // Core metadata
  title: string;
  description: string;
  url?: string;              // For links/videos
  filePath?: string;         // For PDFs/presentations

  // Organization
  categoryId: string;        // Primary category
  subcategoryId?: string;    // Optional subcategory
  tags: string[];            // Freeform tags

  // Source info
  source: string;            // Domain or publisher
  author?: string;
  publishedDate?: string;

  // Processing info
  status: ProcessingStatus;
  processedAt?: string;
  lastVerifiedAt?: string;

  // Enriched metadata (from preprocessing)
  enrichedData?: EnrichedResourceData;

  // Visualization
  position3D?: [number, number, number];  // Pre-calculated 3D position
  visualWeight?: number;     // Size/prominence in visualization

  // User engagement
  viewCount: number;
  bookmarked: boolean;
  notes?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Enriched data from preprocessing
 */
export interface EnrichedResourceData {
  // Content analysis
  summary?: string;          // AI-generated summary
  keyTopics: string[];       // Extracted key topics
  readingTime?: number;      // Estimated reading time (minutes)
  contentLength?: number;    // Word count or video duration

  // Quality indicators
  qualityScore: QualityScore;
  isAuthoritative: boolean;  // From authoritative source
  hasCitations: boolean;
  lastUpdated?: string;      // Content last updated date

  // Link health
  httpStatus?: number;
  responseTime?: number;     // ms
  redirectUrl?: string;

  // SEO/OG metadata
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  favicon?: string;

  // Extracted entities
  mentionedTools?: string[];      // AI tools mentioned
  mentionedCompanies?: string[];  // Companies mentioned
  mentionedPeople?: string[];     // People mentioned

  // Relationships
  relatedResourceIds: string[];
  citedByIds: string[];
}

/**
 * Link-specific resource
 */
export interface LinkResource extends WorkshopResource {
  type: 'link';
  url: string;
  domain: string;
}

/**
 * PDF-specific resource
 */
export interface PDFResource extends WorkshopResource {
  type: 'pdf' | 'presentation';
  filePath: string;
  fileSize: number;          // bytes
  pageCount?: number;
  isPresentation?: boolean;
}

/**
 * Video-specific resource
 */
export interface VideoResource extends WorkshopResource {
  type: 'video';
  url: string;
  platform: 'youtube' | 'vimeo' | 'other';
  duration?: number;         // seconds
  thumbnailUrl?: string;
  channelName?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MIND MAP CATEGORY STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Represents a category in the mind map hierarchy
 */
export interface MindMapCategory {
  id: string;
  name: string;
  description: string;

  // Hierarchy
  parentId: string | null;   // null = root node
  children: string[];        // Child category IDs
  depth: number;             // 0 = root, 1 = main branch, etc.

  // Visual styling
  color: string;             // Hex color for visualization
  icon?: string;             // Lucide icon name

  // Position in 3D space
  position3D?: [number, number, number];
  orbitRadius?: number;      // Distance from parent
  orbitAngle?: number;       // Angle around parent

  // Metadata
  resourceCount: number;     // Number of resources in this category
  isExpanded: boolean;       // UI state - is expanded
}

/**
 * Root structure of the mind map
 */
export interface MindMapStructure {
  rootId: string;
  categories: Record<string, MindMapCategory>;
  // Flat list of all category IDs for traversal
  allCategoryIds: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKSHOP STATE
// ═══════════════════════════════════════════════════════════════════════════

export interface WorkshopState {
  // Mind map structure
  mindMap: MindMapStructure;

  // All resources
  resources: Record<string, WorkshopResource>;

  // UI state
  selectedCategoryId: string | null;
  selectedResourceId: string | null;
  expandedCategories: Set<string>;

  // Filters
  activeFilters: WorkshopFilters;

  // Search
  searchQuery: string;
  searchResults: string[];   // Resource IDs

  // View mode
  viewMode: 'mindmap' | 'list' | 'grid' | 'timeline';

  // Loading states
  isLoading: boolean;
  processingResourceIds: Set<string>;
}

export interface WorkshopFilters {
  types: ResourceType[];
  statuses: ProcessingStatus[];
  minQuality: QualityScore;
  dateRange?: {
    start: string;
    end: string;
  };
  tags: string[];
  sources: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// PREPROCESSING TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Input for the preprocessing system
 */
export interface PreprocessInput {
  url?: string;
  filePath?: string;
  title?: string;            // Optional override
  categoryId?: string;       // Optional category assignment
  tags?: string[];           // Optional tags
}

/**
 * Result from the preprocessing pipeline
 */
export interface PreprocessResult {
  success: boolean;
  resource?: WorkshopResource;
  error?: string;
  warnings?: string[];
}

/**
 * Batch preprocessing request
 */
export interface BatchPreprocessRequest {
  items: PreprocessInput[];
  options?: {
    skipVerification?: boolean;
    skipEnrichment?: boolean;
    autoCategorize?: boolean;
  };
}

/**
 * Batch preprocessing result
 */
export interface BatchPreprocessResult {
  total: number;
  succeeded: number;
  failed: number;
  results: PreprocessResult[];
}

// ═══════════════════════════════════════════════════════════════════════════
// API TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface WorkshopAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface ResourceListResponse {
  resources: WorkshopResource[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CategoryTreeResponse {
  mindMap: MindMapStructure;
  resourceCounts: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3D VISUALIZATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration for the 3D mind map visualization
 */
export interface MindMap3DConfig {
  // Layout
  rootPosition: [number, number, number];
  branchSpread: number;      // Angular spread between main branches
  levelDistance: number;     // Distance between hierarchy levels
  nodeSpacing: number;       // Min spacing between nodes at same level

  // Animation
  expandAnimationDuration: number;
  nodeEnterAnimation: 'fade' | 'scale' | 'slide';
  connectionAnimationSpeed: number;

  // Visual style
  connectionStyle: 'straight' | 'curved' | 'organic';
  nodeStyle: 'sphere' | 'cube' | 'card' | 'icon';
  showLabels: boolean;
  labelScale: number;

  // Interaction
  clickToExpand: boolean;
  hoverHighlight: boolean;
  focusZoomLevel: number;
}

/**
 * Node data for 3D rendering
 */
export interface MindMapNode3D {
  id: string;
  type: 'category' | 'resource';
  label: string;
  position: [number, number, number];

  // Visual properties
  color: string;
  size: number;
  opacity: number;

  // State
  isVisible: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  isHovered: boolean;

  // Relationships
  parentId: string | null;
  childIds: string[];
  connectionStrength: number;
}

/**
 * Connection between nodes
 */
export interface MindMapConnection3D {
  id: string;
  fromId: string;
  toId: string;
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  opacity: number;
  width: number;
  animated: boolean;
}

export const DEFAULT_MINDMAP_3D_CONFIG: MindMap3DConfig = {
  rootPosition: [0, 0, 0],
  branchSpread: Math.PI * 2 / 6,  // 60 degrees
  levelDistance: 8,
  nodeSpacing: 3,

  expandAnimationDuration: 0.5,
  nodeEnterAnimation: 'scale',
  connectionAnimationSpeed: 1,

  connectionStyle: 'curved',
  nodeStyle: 'sphere',
  showLabels: true,
  labelScale: 1,

  clickToExpand: true,
  hoverHighlight: true,
  focusZoomLevel: 15,
};
