/**
 * World Configuration for Content Exploration
 *
 * Each world is a themed collection of articles with a unique 360 background.
 * Articles are positioned in 2D space and 3D 360 view for fog reveal mechanics.
 */

export interface ArticlePosition {
  slug: string;
  // Position in 2D space view (normalized 0-1)
  spaceX: number;
  spaceY: number;
  // Position in 360 view (spherical coordinates)
  phi: number;   // vertical angle (0 = top, Math.PI = bottom)
  theta: number; // horizontal angle (0-2π)
  radius: number; // distance from center (fog reveal radius)
}

export interface World {
  id: number;
  name: string;
  theme: string;
  description: string;
  color: string; // Primary color for nebula/UI
  backgroundImage: string; // 360 background path
  // Position of world in 2D space navigation
  spaceX: number;
  spaceY: number;
  articles: ArticlePosition[];
}

export const WORLDS: World[] = [
  {
    id: 1,
    name: "XR Frontier",
    theme: "Virtual & Mixed Reality",
    description: "Explore the cutting edge of spatial computing and immersive technologies",
    color: "#a855f7", // Purple
    backgroundImage: "/backgrounds/world-1-xr.jpg",
    spaceX: 0.25,
    spaceY: 0.3,
    articles: [
      {
        slug: "meta-quest-3",
        spaceX: 0.22,
        spaceY: 0.28,
        phi: Math.PI * 0.4,
        theta: Math.PI * 0.3,
        radius: 0.3,
      },
      {
        slug: "top-announcements-next-23",
        spaceX: 0.28,
        spaceY: 0.32,
        phi: Math.PI * 0.5,
        theta: Math.PI * 0.6,
        radius: 0.35,
      },
      {
        slug: "next-23-tech-to-watch",
        spaceX: 0.25,
        spaceY: 0.35,
        phi: Math.PI * 0.6,
        theta: Math.PI * 0.9,
        radius: 0.3,
      },
    ],
  },
  {
    id: 2,
    name: "Compliance Nexus",
    theme: "AI Governance & Regulation",
    description: "Navigate the complex landscape of AI compliance and regulatory frameworks",
    color: "#3b82f6", // Blue
    backgroundImage: "/backgrounds/world-2-governance.jpg",
    spaceX: 0.7,
    spaceY: 0.25,
    articles: [
      {
        slug: "eu-ai-act-article-13-exemption",
        spaceX: 0.68,
        spaceY: 0.22,
        phi: Math.PI * 0.35,
        theta: Math.PI * 1.2,
        radius: 0.25,
      },
      {
        slug: "eu-ai-act-deadlines-for-us-pms",
        spaceX: 0.72,
        spaceY: 0.24,
        phi: Math.PI * 0.4,
        theta: Math.PI * 1.4,
        radius: 0.3,
      },
      {
        slug: "laws-legal-ai-checklist",
        spaceX: 0.7,
        spaceY: 0.28,
        phi: Math.PI * 0.5,
        theta: Math.PI * 1.6,
        radius: 0.28,
      },
      {
        slug: "nist-ai-risk-framework-for-pms",
        spaceX: 0.74,
        spaceY: 0.26,
        phi: Math.PI * 0.45,
        theta: Math.PI * 1.8,
        radius: 0.32,
      },
      {
        slug: "september-ai-compliance-checklist",
        spaceX: 0.68,
        spaceY: 0.3,
        phi: Math.PI * 0.55,
        theta: Math.PI * 1.1,
        radius: 0.27,
      },
      {
        slug: "fda-model-card-template",
        spaceX: 0.72,
        spaceY: 0.28,
        phi: Math.PI * 0.6,
        theta: Math.PI * 1.3,
        radius: 0.3,
      },
      {
        slug: "nih-brain-initiative-data-standard",
        spaceX: 0.69,
        spaceY: 0.26,
        phi: Math.PI * 0.5,
        theta: Math.PI * 1.5,
        radius: 0.29,
      },
      {
        slug: "nih-data-management-policy-ai-pms",
        spaceX: 0.71,
        spaceY: 0.23,
        phi: Math.PI * 0.42,
        theta: Math.PI * 1.7,
        radius: 0.31,
      },
    ],
  },
  {
    id: 3,
    name: "Strategy Core",
    theme: "AI Product Management",
    description: "Master the art of shipping AI products with resilience and strategy",
    color: "#f97316", // Orange
    backgroundImage: "/backgrounds/world-3-strategy.jpg",
    spaceX: 0.5,
    spaceY: 0.7,
    articles: [
      {
        slug: "ai-kill-switch-postmortem",
        spaceX: 0.48,
        spaceY: 0.68,
        phi: Math.PI * 0.4,
        theta: Math.PI * 0.5,
        radius: 0.32,
      },
      {
        slug: "ribs-framework-ai-prioritization",
        spaceX: 0.52,
        spaceY: 0.72,
        phi: Math.PI * 0.5,
        theta: Math.PI * 0.8,
        radius: 0.3,
      },
      {
        slug: "feature-flag-hierarchy-ai",
        spaceX: 0.5,
        spaceY: 0.74,
        phi: Math.PI * 0.6,
        theta: Math.PI * 0.6,
        radius: 0.28,
      },
      {
        slug: "safe-llm-launch-runbook",
        spaceX: 0.54,
        spaceY: 0.69,
        phi: Math.PI * 0.45,
        theta: Math.PI * 1.0,
        radius: 0.31,
      },
      {
        slug: "improve-the-feature",
        spaceX: 0.47,
        spaceY: 0.71,
        phi: Math.PI * 0.55,
        theta: Math.PI * 0.4,
        radius: 0.29,
      },
    ],
  },
  {
    id: 4,
    name: "Data Forge",
    theme: "ML Engineering & Testing",
    description: "Build reproducible, testable AI systems with rigorous data science",
    color: "#22c55e", // Green
    backgroundImage: "/backgrounds/world-4-data.jpg",
    spaceX: 0.3,
    spaceY: 0.65,
    articles: [
      {
        slug: "reproducible-ai-evals-version-control",
        spaceX: 0.28,
        spaceY: 0.63,
        phi: Math.PI * 0.45,
        theta: Math.PI * 0.2,
        radius: 0.3,
      },
      {
        slug: "why-ab-test-failed-ai",
        spaceX: 0.32,
        spaceY: 0.67,
        phi: Math.PI * 0.55,
        theta: Math.PI * 0.5,
        radius: 0.32,
      },
      {
        slug: "benchmark-to-business-metric",
        spaceX: 0.3,
        spaceY: 0.69,
        phi: Math.PI * 0.5,
        theta: Math.PI * 0.35,
        radius: 0.28,
      },
      {
        slug: "confidence-interval-exec-communication",
        spaceX: 0.34,
        spaceY: 0.64,
        phi: Math.PI * 0.4,
        theta: Math.PI * 0.65,
        radius: 0.31,
      },
    ],
  },
  {
    id: 5,
    name: "Security Vault",
    theme: "Trust, Security & UX",
    description: "Design secure, trustworthy AI experiences users can rely on",
    color: "#ef4444", // Red
    backgroundImage: "/backgrounds/world-5-security.jpg",
    spaceX: 0.75,
    spaceY: 0.7,
    articles: [
      {
        slug: "red-team-report-ciso-template",
        spaceX: 0.73,
        spaceY: 0.68,
        phi: Math.PI * 0.4,
        theta: Math.PI * 1.3,
        radius: 0.32,
      },
      {
        slug: "data-security-AI-next-23",
        spaceX: 0.77,
        spaceY: 0.72,
        phi: Math.PI * 0.5,
        theta: Math.PI * 1.5,
        radius: 0.3,
      },
      {
        slug: "trust-calibration-ai-ux",
        spaceX: 0.75,
        spaceY: 0.74,
        phi: Math.PI * 0.6,
        theta: Math.PI * 1.4,
        radius: 0.29,
      },
    ],
  },
  {
    id: 6,
    name: "Legal Archives",
    theme: "Legal Tech & eDiscovery",
    description: "Dive into the technical foundations of legal AI and document review",
    color: "#06b6d4", // Cyan
    backgroundImage: "/backgrounds/world-6-legal.jpg",
    spaceX: 0.2,
    spaceY: 0.2,
    articles: [
      {
        slug: "ediscovery-tar-protocol-defensible",
        spaceX: 0.18,
        spaceY: 0.18,
        phi: Math.PI * 0.35,
        theta: Math.PI * 0.1,
        radius: 0.3,
      },
      {
        slug: "trec-legal-precision-recall-lessons",
        spaceX: 0.22,
        spaceY: 0.22,
        phi: Math.PI * 0.45,
        theta: Math.PI * 0.3,
        radius: 0.32,
      },
      {
        slug: "september-retro-q3-ai-team",
        spaceX: 0.2,
        spaceY: 0.24,
        phi: Math.PI * 0.55,
        theta: Math.PI * 0.2,
        radius: 0.28,
      },
      {
        slug: "retrospective18to23",
        spaceX: 0.24,
        spaceY: 0.19,
        phi: Math.PI * 0.4,
        theta: Math.PI * 0.4,
        radius: 0.31,
      },
    ],
  },
];

// Helper function to get world by ID
export const getWorldById = (id: number): World | undefined => {
  return WORLDS.find((world) => world.id === id);
};

// Helper function to get world containing an article
export const getWorldByArticle = (slug: string): World | undefined => {
  return WORLDS.find((world) =>
    world.articles.some((article) => article.slug === slug)
  );
};

// Helper function to get total article count
export const getTotalArticleCount = (): number => {
  return WORLDS.reduce((sum, world) => sum + world.articles.length, 0);
};

// Helper function to get article position
export const getArticlePosition = (
  slug: string
): { world: World; position: ArticlePosition } | undefined => {
  const world = getWorldByArticle(slug);
  if (!world) return undefined;

  const position = world.articles.find((a) => a.slug === slug);
  if (!position) return undefined;

  return { world, position };
};
