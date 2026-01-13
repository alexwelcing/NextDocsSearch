/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODERN WORKSHOP - LINK PREPROCESSING SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A comprehensive system for verifying, enriching, and categorizing
 * resources (links, PDFs, videos) before adding them to the workshop.
 */

import type {
  WorkshopResource,
  LinkResource,
  VideoResource,
  PDFResource,
  PreprocessInput,
  PreprocessResult,
  EnrichedResourceData,
  QualityScore,
  ResourceType,
  ProcessingStatus,
} from '@/types/workshop';
import { CATEGORY_IDS, MIND_MAP_CATEGORIES } from './mindmap-data';

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a unique ID for resources
 */
export function generateResourceId(): string {
  return `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

/**
 * Detect resource type from URL
 */
export function detectResourceType(url: string): ResourceType {
  const lowerUrl = url.toLowerCase();

  // Video platforms
  if (
    lowerUrl.includes('youtube.com') ||
    lowerUrl.includes('youtu.be') ||
    lowerUrl.includes('vimeo.com')
  ) {
    return 'video';
  }

  // PDF files
  if (lowerUrl.endsWith('.pdf')) {
    return 'pdf';
  }

  // Presentations
  if (
    lowerUrl.includes('docs.google.com/presentation') ||
    lowerUrl.includes('slides.google.com') ||
    lowerUrl.endsWith('.pptx') ||
    lowerUrl.endsWith('.ppt')
  ) {
    return 'presentation';
  }

  return 'link';
}

/**
 * Detect video platform
 */
export function detectVideoPlatform(url: string): 'youtube' | 'vimeo' | 'other' {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'youtube';
  }
  if (lowerUrl.includes('vimeo.com')) {
    return 'vimeo';
  }
  return 'other';
}

/**
 * Extract YouTube video ID
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTHORITATIVE SOURCES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * List of authoritative domains for quality scoring
 */
const AUTHORITATIVE_DOMAINS: Record<string, number> = {
  // Official company blogs
  'anthropic.com': 5,
  'openai.com': 5,
  'google.dev': 5,
  'developers.googleblog.com': 5,
  'ai.google.dev': 5,
  'cloud.google.com': 5,
  'aws.amazon.com': 5,
  'azure.microsoft.com': 5,
  'github.com': 4,
  'vercel.com': 4,
  'supabase.com': 4,

  // Research & Academia
  'arxiv.org': 5,
  'hai.stanford.edu': 5,
  'mit.edu': 5,
  'berkeley.edu': 5,

  // Tech publications
  'thenewstack.io': 4,
  'dev.to': 3,
  'medium.com': 3,
  'logrocket.com': 4,
  'thoughtworks.com': 4,

  // Documentation sites
  'cursor.com': 4,
  'aider.chat': 4,
  'modelcontextprotocol.io': 5,
  'codeium.com': 4,
  'milvus.io': 4,
  'pinecone.io': 4,
  'weaviate.io': 4,

  // Industry resources
  'qodo.ai': 4,
  'augmentcode.com': 4,
  'redis.io': 4,
  'digitalocean.com': 4,
};

/**
 * Calculate quality score based on domain and content indicators
 */
function calculateQualityScore(
  domain: string,
  hasCitations: boolean,
  hasCodeExamples: boolean,
  contentLength: number
): QualityScore {
  let score = AUTHORITATIVE_DOMAINS[domain] || 2;

  // Boost for citations
  if (hasCitations) score += 0.5;

  // Boost for code examples
  if (hasCodeExamples) score += 0.5;

  // Boost for comprehensive content
  if (contentLength > 2000) score += 0.5;

  return Math.min(5, Math.max(1, Math.round(score))) as QualityScore;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-CATEGORIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Keywords to category mapping for auto-categorization
 */
const CATEGORIZATION_RULES: Array<{
  keywords: string[];
  categoryId: string;
  weight: number;
}> = [
  // IDE Tools
  { keywords: ['cursor', 'vs code fork', 'code editor'], categoryId: CATEGORY_IDS.CURSOR, weight: 10 },
  { keywords: ['github copilot', 'copilot'], categoryId: CATEGORY_IDS.GITHUB_COPILOT, weight: 10 },
  { keywords: ['windsurf', 'cascade', 'codeium editor'], categoryId: CATEGORY_IDS.WINDSURF, weight: 10 },
  { keywords: ['jetbrains ai', 'intellij ai'], categoryId: CATEGORY_IDS.JETBRAINS_AI, weight: 10 },

  // CLI Tools
  { keywords: ['claude code', 'anthropic cli', 'claude cli'], categoryId: CATEGORY_IDS.CLAUDE_CODE, weight: 10 },
  { keywords: ['aider', 'ai pair programming', 'aider.chat'], categoryId: CATEGORY_IDS.AIDER, weight: 10 },
  { keywords: ['cline', 'cline extension'], categoryId: CATEGORY_IDS.CLINE, weight: 10 },

  // Web/Prototyping
  { keywords: ['replit agent', 'replit ai'], categoryId: CATEGORY_IDS.REPLIT_AGENT, weight: 10 },
  { keywords: ['bolt.new', 'bolt new'], categoryId: CATEGORY_IDS.BOLT_NEW, weight: 10 },
  { keywords: ['v0.dev', 'v0 dev', 'vercel v0'], categoryId: CATEGORY_IDS.V0_DEV, weight: 10 },
  { keywords: ['lovable', 'lovable.dev'], categoryId: CATEGORY_IDS.LOVABLE, weight: 10 },

  // Vector DBs
  { keywords: ['pinecone'], categoryId: CATEGORY_IDS.PINECONE, weight: 10 },
  { keywords: ['milvus'], categoryId: CATEGORY_IDS.MILVUS, weight: 10 },
  { keywords: ['weaviate'], categoryId: CATEGORY_IDS.WEAVIATE, weight: 10 },
  { keywords: ['pgvector', 'pgvectorscale', 'postgres vector'], categoryId: CATEGORY_IDS.PGVECTOR, weight: 10 },

  // Local LLM
  { keywords: ['ollama'], categoryId: CATEGORY_IDS.OLLAMA, weight: 10 },
  { keywords: ['lm studio', 'lmstudio'], categoryId: CATEGORY_IDS.LM_STUDIO, weight: 10 },
  { keywords: ['jan ai', 'jan app'], categoryId: CATEGORY_IDS.JAN, weight: 10 },
  { keywords: ['gpt4all'], categoryId: CATEGORY_IDS.GPT4ALL, weight: 10 },

  // MCP
  { keywords: ['model context protocol', 'mcp server', 'mcp client'], categoryId: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL, weight: 8 },
  { keywords: ['mcp integration', 'mcp tools'], categoryId: CATEGORY_IDS.MCP_INTEGRATION, weight: 10 },

  // Hardware
  { keywords: ['rtx 5090', 'rtx 5080', 'nvidia consumer'], categoryId: CATEGORY_IDS.RTX_5090, weight: 10 },
  { keywords: ['h100', 'h200', 'nvidia enterprise', 'nvidia datacenter'], categoryId: CATEGORY_IDS.H100_H200, weight: 10 },
  { keywords: ['dgx', 'nvidia dgx'], categoryId: CATEGORY_IDS.DGX_SYSTEMS, weight: 10 },
  { keywords: ['m3 ultra', 'm4 pro', 'apple silicon', 'apple m3', 'apple m4'], categoryId: CATEGORY_IDS.M3_M4_PRO, weight: 10 },
  { keywords: ['unified memory', 'apple memory'], categoryId: CATEGORY_IDS.APPLE_UNIFIED_MEMORY, weight: 8 },

  // Optimization
  { keywords: ['kv cache', 'key value cache', 'kv caching'], categoryId: CATEGORY_IDS.KV_CACHING, weight: 10 },
  { keywords: ['quantization', 'quantize', 'gguf', 'gptq', 'awq'], categoryId: CATEGORY_IDS.MODEL_QUANTIZATION, weight: 10 },
  { keywords: ['context caching', 'gemini cache', 'context cache'], categoryId: CATEGORY_IDS.CONTEXT_CACHING, weight: 10 },

  // Frontend
  { keywords: ['next.js', 'nextjs', 'next 15', 'next 16'], categoryId: CATEGORY_IDS.NEXTJS_16, weight: 10 },
  { keywords: ['tanstack', 'tanstack start', 'tanstack router'], categoryId: CATEGORY_IDS.TANSTACK_START, weight: 10 },
  { keywords: ['react compiler', 'react 19', 'react compiler'], categoryId: CATEGORY_IDS.REACT_COMPILER, weight: 10 },

  // Backend
  { keywords: ['laravel', 'php framework'], categoryId: CATEGORY_IDS.LARAVEL_WORKFLOWS, weight: 10 },
  { keywords: ['rust', 'rust lang', 'polars'], categoryId: CATEGORY_IDS.RUST_HIGH_THROUGHPUT, weight: 8 },
  { keywords: ['typescript', 'ts', 'type safety'], categoryId: CATEGORY_IDS.TYPESCRIPT_STANDARD, weight: 6 },

  // Economic
  { keywords: ['pricing', 'subscription', 'cost'], categoryId: CATEGORY_IDS.PRICING_MODELS, weight: 5 },
  { keywords: ['roi', 'return on investment', 'productivity'], categoryId: CATEGORY_IDS.ROI_DRIVERS, weight: 5 },
  { keywords: ['soc 2', 'soc2', 'compliance'], categoryId: CATEGORY_IDS.SOC2_TYPE_II, weight: 8 },
  { keywords: ['iso 42001', 'ai management'], categoryId: CATEGORY_IDS.ISO_42001, weight: 10 },

  // General categories (lower weight)
  { keywords: ['ide', 'code editor', 'editor'], categoryId: CATEGORY_IDS.IDE_BASED_TOOLS, weight: 3 },
  { keywords: ['cli', 'terminal', 'command line', 'agentic'], categoryId: CATEGORY_IDS.AGENTIC_CLI_TOOLS, weight: 3 },
  { keywords: ['vector database', 'embedding', 'similarity search'], categoryId: CATEGORY_IDS.VECTOR_DATABASES, weight: 4 },
  { keywords: ['local llm', 'run locally', 'on-device'], categoryId: CATEGORY_IDS.LOCAL_LLM_EXECUTION, weight: 4 },
  { keywords: ['gpu', 'nvidia', 'cuda'], categoryId: CATEGORY_IDS.NVIDIA_GPU_ECOSYSTEM, weight: 3 },
  { keywords: ['frontend', 'ui', 'react', 'vue'], categoryId: CATEGORY_IDS.FRONTEND_EVOLUTION, weight: 3 },
  { keywords: ['backend', 'server', 'api'], categoryId: CATEGORY_IDS.BACKEND_SYSTEMS, weight: 3 },
  { keywords: ['context engineering', 'prompt engineering'], categoryId: CATEGORY_IDS.AGENTIC_CLI_TOOLS, weight: 5 },
];

/**
 * Auto-categorize a resource based on its content
 */
export function autoCategorize(
  title: string,
  description: string,
  url: string
): { categoryId: string; subcategoryId?: string; confidence: number } {
  const combined = `${title} ${description} ${url}`.toLowerCase();
  const scores: Map<string, number> = new Map();

  // Score each category based on keyword matches
  for (const rule of CATEGORIZATION_RULES) {
    for (const keyword of rule.keywords) {
      if (combined.includes(keyword.toLowerCase())) {
        const currentScore = scores.get(rule.categoryId) || 0;
        scores.set(rule.categoryId, currentScore + rule.weight);
      }
    }
  }

  // Find the highest scoring category
  let bestCategoryId: string = CATEGORY_IDS.ROOT;
  let bestScore = 0;

  scores.forEach((score, categoryId) => {
    if (score > bestScore) {
      bestScore = score;
      bestCategoryId = categoryId;
    }
  });

  // Calculate confidence (0-1)
  const confidence = Math.min(1, bestScore / 20);

  // Determine if this is a subcategory
  const category = MIND_MAP_CATEGORIES[bestCategoryId];
  if (category && category.depth === 3) {
    // This is a leaf node, set parent as category
    return {
      categoryId: category.parentId || bestCategoryId,
      subcategoryId: bestCategoryId,
      confidence,
    };
  }

  return {
    categoryId: bestCategoryId,
    confidence,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract key topics from content using keyword analysis
 */
export function extractKeyTopics(text: string): string[] {
  const topics = new Set<string>();
  const lowerText = text.toLowerCase();

  // AI/ML topics
  const aiTopics = [
    'large language model', 'llm', 'transformer', 'attention mechanism',
    'fine-tuning', 'prompt engineering', 'context window', 'tokenization',
    'embedding', 'vector search', 'rag', 'retrieval augmented generation',
    'agent', 'multi-agent', 'agentic', 'autonomous',
    'inference', 'training', 'model', 'neural network',
  ];

  // Tool topics
  const toolTopics = [
    'cursor', 'copilot', 'claude code', 'aider', 'windsurf',
    'ollama', 'lm studio', 'mcp', 'model context protocol',
    'pinecone', 'milvus', 'weaviate', 'pgvector',
  ];

  // Framework topics
  const frameworkTopics = [
    'next.js', 'react', 'typescript', 'rust', 'python',
    'laravel', 'tanstack', 'tailwind', 'three.js',
  ];

  // Hardware topics
  const hardwareTopics = [
    'gpu', 'cuda', 'nvidia', 'h100', 'a100', 'rtx',
    'apple silicon', 'm3', 'm4', 'unified memory', 'vram',
    'quantization', 'kv cache',
  ];

  [...aiTopics, ...toolTopics, ...frameworkTopics, ...hardwareTopics].forEach(topic => {
    if (lowerText.includes(topic.toLowerCase())) {
      topics.add(topic);
    }
  });

  return Array.from(topics).slice(0, 10);
}

/**
 * Detect if content has citations
 */
export function hasCitations(text: string): boolean {
  // Look for citation patterns
  const patterns = [
    /\[\d+\]/,                          // [1], [2], etc.
    /\(\d{4}\)/,                        // (2024), etc.
    /et al\./i,                         // et al.
    /source:/i,                         // Source:
    /reference:/i,                      // Reference:
    /bibliography/i,                    // Bibliography
  ];

  return patterns.some(pattern => pattern.test(text));
}

/**
 * Detect if content has code examples
 */
export function hasCodeExamples(text: string): boolean {
  const patterns = [
    /```[\s\S]*?```/,                   // Markdown code blocks
    /<code>[\s\S]*?<\/code>/i,          // HTML code tags
    /function\s+\w+\s*\(/,              // JavaScript functions
    /def\s+\w+\s*\(/,                   // Python functions
    /const\s+\w+\s*=/,                  // JavaScript const
    /import\s+{?\s*\w+/,                // Import statements
  ];

  return patterns.some(pattern => pattern.test(text));
}

// ═══════════════════════════════════════════════════════════════════════════
// RESOURCE CREATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a base resource object
 */
function createBaseResource(
  input: PreprocessInput,
  type: ResourceType,
  status: ProcessingStatus
): Omit<WorkshopResource, 'type'> {
  const now = new Date().toISOString();
  const domain = input.url ? extractDomain(input.url) : 'local';

  return {
    id: generateResourceId(),
    title: input.title || 'Untitled Resource',
    description: '',
    url: input.url,
    filePath: input.filePath,
    categoryId: input.categoryId || CATEGORY_IDS.ROOT,
    tags: input.tags || [],
    source: domain,
    status,
    viewCount: 0,
    bookmarked: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a link resource
 */
export function createLinkResource(
  input: PreprocessInput,
  enrichedData?: EnrichedResourceData
): LinkResource {
  const base = createBaseResource(input, 'link', enrichedData ? 'verified' : 'pending');
  const domain = extractDomain(input.url || '');

  return {
    ...base,
    type: 'link',
    url: input.url!,
    domain,
    title: enrichedData?.ogTitle || input.title || domain,
    description: enrichedData?.ogDescription || '',
    enrichedData,
  } as LinkResource;
}

/**
 * Create a video resource
 */
export function createVideoResource(
  input: PreprocessInput,
  enrichedData?: EnrichedResourceData
): VideoResource {
  const base = createBaseResource(input, 'video', enrichedData ? 'verified' : 'pending');
  const platform = detectVideoPlatform(input.url || '');

  return {
    ...base,
    type: 'video',
    url: input.url!,
    platform,
    title: enrichedData?.ogTitle || input.title || 'Video',
    description: enrichedData?.ogDescription || '',
    thumbnailUrl: enrichedData?.ogImage,
    enrichedData,
  } as VideoResource;
}

/**
 * Create a PDF resource
 */
export function createPDFResource(
  input: PreprocessInput,
  fileSize: number = 0,
  pageCount?: number
): PDFResource {
  const base = createBaseResource(input, 'pdf', 'manual');

  return {
    ...base,
    type: 'pdf',
    filePath: input.filePath!,
    fileSize,
    pageCount,
    title: input.title || input.filePath?.split('/').pop() || 'Document',
  } as PDFResource;
}

// ═══════════════════════════════════════════════════════════════════════════
// PREPROCESSING PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Preprocess a URL input (client-side preparation)
 * Actual verification happens server-side via API
 */
export function preprocessUrlInput(input: PreprocessInput): PreprocessResult {
  if (!input.url) {
    return {
      success: false,
      error: 'URL is required',
    };
  }

  // Validate URL format
  try {
    new URL(input.url);
  } catch {
    return {
      success: false,
      error: 'Invalid URL format',
    };
  }

  // Detect resource type
  const resourceType = detectResourceType(input.url);
  const domain = extractDomain(input.url);

  // Auto-categorize if not specified
  let categorization: { categoryId: string; subcategoryId?: string; confidence: number } = {
    categoryId: CATEGORY_IDS.ROOT,
    confidence: 0,
  };
  if (!input.categoryId) {
    categorization = autoCategorize(
      input.title || '',
      '',
      input.url
    );
  }

  // Create the resource with pending status
  let resource: WorkshopResource;

  if (resourceType === 'video') {
    resource = createVideoResource({
      ...input,
      categoryId: input.categoryId || categorization.categoryId,
    });
  } else {
    resource = createLinkResource({
      ...input,
      categoryId: input.categoryId || categorization.categoryId,
    });
  }

  return {
    success: true,
    resource,
    warnings: categorization.confidence < 0.3
      ? ['Low confidence in auto-categorization. Please verify the category.']
      : undefined,
  };
}

/**
 * Parse a batch of URLs from text (one per line)
 */
export function parseBatchUrls(text: string): PreprocessInput[] {
  const lines = text.split('\n').filter(line => line.trim());
  const inputs: PreprocessInput[] = [];

  for (const line of lines) {
    // Try to parse as "title, url" or just "url"
    const parts = line.split(',').map(p => p.trim());

    if (parts.length >= 2 && parts[1].startsWith('http')) {
      inputs.push({
        title: parts[0],
        url: parts[1],
      });
    } else if (parts[0].startsWith('http')) {
      inputs.push({
        url: parts[0],
      });
    }
  }

  return inputs;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENRICHMENT (for server-side use)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create enriched data from fetched metadata
 */
export function createEnrichedData(params: {
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  content?: string;
  httpStatus?: number;
  responseTime?: number;
  redirectUrl?: string;
}): EnrichedResourceData {
  const content = params.content || '';
  const keyTopics = extractKeyTopics(content + ' ' + (params.ogTitle || '') + ' ' + (params.ogDescription || ''));
  const _hasCitations = hasCitations(content);
  const _hasCodeExamples = hasCodeExamples(content);

  return {
    summary: params.ogDescription?.substring(0, 300),
    keyTopics,
    hasCitations: _hasCitations,
    isAuthoritative: false, // Set based on domain later
    qualityScore: 3, // Default
    ogTitle: params.ogTitle,
    ogDescription: params.ogDescription,
    ogImage: params.ogImage,
    httpStatus: params.httpStatus,
    responseTime: params.responseTime,
    redirectUrl: params.redirectUrl,
    mentionedTools: [],
    mentionedCompanies: [],
    mentionedPeople: [],
    relatedResourceIds: [],
    citedByIds: [],
  };
}

/**
 * Update quality score based on domain
 */
export function updateQualityFromDomain(
  enrichedData: EnrichedResourceData,
  domain: string
): EnrichedResourceData {
  const isAuthoritative = domain in AUTHORITATIVE_DOMAINS;
  const qualityScore = calculateQualityScore(
    domain,
    enrichedData.hasCitations,
    enrichedData.keyTopics.length > 3,
    enrichedData.contentLength || 0
  );

  return {
    ...enrichedData,
    isAuthoritative,
    qualityScore,
  };
}
