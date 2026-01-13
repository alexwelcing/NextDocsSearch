/**
 * Featured Articles Configuration
 * 
 * Curated list of strategic articles for homepage rotation,
 * discovery features, and SEO optimization.
 * 
 * Selection Criteria:
 * - High-quality research or compelling fiction
 * - Strong SEO keywords and search intent
 * - Comprehensive coverage (1500+ words)
 * - Strategic business/technical value
 * - Timely or evergreen relevance
 */

export interface FeaturedArticle {
  slug: string;
  priority: number; // 1-5, higher = more prominent
  category: 'research' | 'fiction' | 'framework';
  reason: string; // Why this article is featured
  tags: string[]; // Discovery tags
}

/**
 * The 5 Cornerstone Articles
 * 
 * These represent the pinnacle of NextDocsSearch's content library.
 * They should be prominently featured across the site.
 */
export const FEATURED_ARTICLES: FeaturedArticle[] = [
  {
    slug: 'december-2025-zeitgeist-analysis',
    priority: 5,
    category: 'research',
    reason: 'Most comprehensive research piece (2670 words). Timely analysis of DeepSeek, AI arms race, cultural shifts. High SEO potential for "December 2025", "DeepSeek", "AI Sputnik moment".',
    tags: ['zeitgeist', 'AI industry', 'geopolitical', 'market analysis', 'trending'],
  },
  {
    slug: 'ai-product-strategy-roadmap',
    priority: 5,
    category: 'research',
    reason: 'Core product management content. RIBS framework introduction. High practical value for AI PMs. Evergreen SEO for "AI product strategy", "AI roadmap", "AI product management".',
    tags: ['product management', 'strategy', 'frameworks', 'practical', 'evergreen'],
  },
  {
    slug: 'trust-calibration-ai-ux',
    priority: 4,
    category: 'research',
    reason: 'Novel UX framework addressing critical adoption problem. Original thinking on trust calibration. Strong SEO for "AI UX", "AI trust", "appropriate reliance".',
    tags: ['UX', 'design', 'trust', 'adoption', 'frameworks'],
  },
  {
    slug: 'post-scarcity-collapse-2058',
    priority: 5,
    category: 'fiction',
    reason: 'Top speculative fiction piece (2315 words). Explores societal consequences of abundance. Thought-provoking dystopian scenario. High engagement potential.',
    tags: ['post-scarcity', 'dystopian', 'societal impact', 'long-form', 'speculative'],
  },
  {
    slug: 'abundance-fork',
    priority: 4,
    category: 'framework',
    reason: 'Key conceptual framework. Explores post-scarcity utopia vs techno-feudalism fork. Original thinking on AI economics. SEO for "abundance", "post-scarcity", "AI economics".',
    tags: ['frameworks', 'economics', 'futures', 'utopia', 'dystopia'],
  },
];

/**
 * Extended Featured Articles (Next Tier)
 * 
 * High-quality articles worth featuring in rotation or discovery.
 */
export const EXTENDED_FEATURED: FeaturedArticle[] = [
  {
    slug: 'leading-cross-functional-ai-teams',
    priority: 3,
    category: 'research',
    reason: 'Practical leadership content for AI teams. Addresses real pain points in cross-functional collaboration.',
    tags: ['leadership', 'teams', 'management', 'practical'],
  },
  {
    slug: 'ribs-framework-ai-prioritization',
    priority: 3,
    category: 'framework',
    reason: 'Detailed RIBS framework implementation. Actionable prioritization methodology.',
    tags: ['frameworks', 'prioritization', 'product management'],
  },
  {
    slug: 'technological-singularity-aftermath-2058',
    priority: 3,
    category: 'fiction',
    reason: 'Epic long-form fiction exploring post-singularity world. High engagement for sci-fi audience.',
    tags: ['singularity', 'long-form', 'speculative', 'futurism'],
  },
  {
    slug: 'liability-vacuum',
    priority: 3,
    category: 'research',
    reason: 'Critical legal/ethical framework. Addresses responsibility gap in autonomous systems.',
    tags: ['legal', 'ethics', 'liability', 'frameworks'],
  },
  {
    slug: 'agency-multiplication',
    priority: 3,
    category: 'fiction',
    reason: 'Explores individual empowerment through AI agents. Optimistic counter-narrative to doom scenarios.',
    tags: ['agents', 'empowerment', 'optimistic', 'futures'],
  },
];

/**
 * Article Collections/Series
 * 
 * Grouped articles that form coherent narratives or learning paths.
 */
export const ARTICLE_COLLECTIONS = {
  backstory: {
    title: 'The Backstory Chronicles',
    description: 'A 20-part narrative following the development of transformative AI from 2026-2030.',
    slugPattern: /^backstory-\d{2}-/,
    articles: [
      'backstory-01-first-day-2026-01',
      'backstory-02-first-breakthroughs-2026-03',
      'backstory-03-neural-interface-2026-05',
      'backstory-04-year-one-complete-2026-12',
      'backstory-05-scaling-up-2027-02',
      'backstory-06-ai-awakening-2027-05',
      'backstory-07-fusion-nanotech-2027-09',
      'backstory-08-year-two-reflections-2027-12',
      'backstory-09-the-race-begins-2028-02',
      'backstory-10-alien-code-2028-05',
      'backstory-11-quantum-crypto-break-2028-08',
      'backstory-12-year-three-2028-12',
      'backstory-13-production-planning-2029-02',
      'backstory-14-bidirectional-bci-2029-05',
      'backstory-15-shutdown-protocols-2029-08',
      'backstory-16-point-of-no-return-2029-11',
      'backstory-17-launch-day-2030-01',
      'backstory-18-first-contact-2030-03',
      'backstory-19-global-deployment-2030-06',
      'backstory-20-new-world-2030-12',
    ],
  },
  productManagement: {
    title: 'AI Product Management Guide',
    description: 'Frameworks, strategies, and tactics for building successful AI products.',
    articles: [
      'ai-product-strategy-roadmap',
      'ribs-framework-ai-prioritization',
      'trust-calibration-ai-ux',
      'leading-cross-functional-ai-teams',
      'safe-llm-launch-runbook',
    ],
  },
  speculativeFutures: {
    title: 'Speculative AI Futures',
    description: 'Fiction exploring plausible consequences of AI advancement.',
    articles: [
      'post-scarcity-collapse-2058',
      'abundance-fork',
      'technological-singularity-aftermath-2058',
      'human-ai-merger-identity-crisis-2057',
      'agi-alignment-failure-2057',
    ],
  },
  frameworks: {
    title: 'Conceptual Frameworks',
    description: 'Original frameworks for understanding AI systems and their consequences.',
    articles: [
      'abundance-fork',
      'alignment-fork',
      'trust-calibration-ai-ux',
      'ribs-framework-ai-prioritization',
      'liability-vacuum',
    ],
  },
  techDeep: {
    title: 'Technical Deep Dives',
    description: 'Implementation guides and technical research.',
    articles: [
      'tech-quantum-error-correction-qiskit',
      'tech-crispr-guide-rna-design',
      'tensorflow-pytorch-production-guide',
      'tech-adversarial-robustness-defense',
      'tech-graph-neural-networks',
    ],
  },
};

/**
 * Get featured articles sorted by priority
 */
export function getFeaturedArticles(limit?: number): FeaturedArticle[] {
  const all = [...FEATURED_ARTICLES, ...EXTENDED_FEATURED].sort(
    (a, b) => b.priority - a.priority
  );
  return limit ? all.slice(0, limit) : all;
}

/**
 * Get articles by tag
 */
export function getArticlesByTag(tag: string): FeaturedArticle[] {
  const all = [...FEATURED_ARTICLES, ...EXTENDED_FEATURED];
  return all.filter((article) => {
    // Compatible with ES5
    return article.tags.indexOf(tag) !== -1;
  });
}

/**
 * Get collection by key
 */
export function getCollection(key: keyof typeof ARTICLE_COLLECTIONS) {
  return ARTICLE_COLLECTIONS[key];
}

/**
 * Check if an article is featured
 */
export function isFeatured(slug: string): boolean {
  const all = [...FEATURED_ARTICLES, ...EXTENDED_FEATURED];
  for (let i = 0; i < all.length; i++) {
    if (all[i].slug === slug) {
      return true;
    }
  }
  return false;
}

/**
 * Get featured article metadata
 */
export function getFeaturedMetadata(slug: string): FeaturedArticle | undefined {
  const all = [...FEATURED_ARTICLES, ...EXTENDED_FEATURED];
  for (let i = 0; i < all.length; i++) {
    if (all[i].slug === slug) {
      return all[i];
    }
  }
  return undefined;
}
