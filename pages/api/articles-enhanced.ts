import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Time Horizon buckets
type TimeHorizon = 'NQ' | 'NY' | 'N5' | 'N20' | 'N50' | 'N100';

// Outcome Polarity scale
type OutcomePolarity = 'C3' | 'C2' | 'C1' | 'N0' | 'P1' | 'P2' | 'P3';

// System Mechanics
type SystemMechanic =
  | 'labor-substitution'
  | 'discovery-compression'
  | 'control-governance'
  | 'epistemic-drift'
  | 'scarcity-inversion'
  | 'security-adversarial'
  | 'biological-convergence'
  | 'market-restructuring'
  | 'agency-multiplication'
  | 'alignment-incentives';

export interface EnhancedArticleData {
  slug: string;
  filename: string;
  title: string;
  date: string;
  author: string[];
  description?: string;
  keywords?: string[];
  ogImage?: string;
  readingTime: number;
  wordCount: number;
  horizon?: TimeHorizon;
  polarity?: OutcomePolarity;
  mechanics?: SystemMechanic[];
  domains?: string[];
}

// Infer time horizon from year in slug or content
function inferHorizon(slug: string, content: string): TimeHorizon | undefined {
  const yearMatch = slug.match(/20(\d{2})/) || content.match(/\b20(\d{2})\b/);
  if (yearMatch) {
    const year = parseInt('20' + yearMatch[1]);
    const yearsFromNow = year - new Date().getFullYear();

    if (yearsFromNow <= 0) return 'NQ';
    if (yearsFromNow <= 1) return 'NY';
    if (yearsFromNow <= 5) return 'N5';
    if (yearsFromNow <= 20) return 'N20';
    if (yearsFromNow <= 50) return 'N50';
    return 'N100';
  }
  return undefined;
}

// Infer polarity from keywords in slug and content
function inferPolarity(slug: string, content: string): OutcomePolarity {
  const combined = (slug + ' ' + content).toLowerCase();

  const calamityKeywords = ['catastrophe', 'extinction', 'collapse', 'apocalypse', 'doom', 'annihilation'];
  const severeKeywords = ['crisis', 'failure', 'breach', 'outbreak', 'plague', 'malfunction', 'grey-goo'];
  const negativeKeywords = ['warning', 'risk', 'threat', 'danger', 'concern', 'problem'];
  const positiveKeywords = ['solution', 'breakthrough', 'success', 'improvement', 'progress'];
  const transformativeKeywords = ['revolution', 'transformation', 'paradigm', 'renaissance', 'golden'];
  const utopianKeywords = ['utopia', 'paradise', 'harmony', 'abundance', 'post-scarcity'];

  if (calamityKeywords.some(kw => combined.includes(kw))) return 'C3';
  if (severeKeywords.some(kw => combined.includes(kw))) return 'C2';
  if (negativeKeywords.some(kw => combined.includes(kw))) return 'C1';
  if (utopianKeywords.some(kw => combined.includes(kw))) return 'P3';
  if (transformativeKeywords.some(kw => combined.includes(kw))) return 'P2';
  if (positiveKeywords.some(kw => combined.includes(kw))) return 'P1';

  return 'N0';
}

// Infer system mechanics from content
function inferMechanics(slug: string, content: string): SystemMechanic[] {
  const combined = (slug + ' ' + content).toLowerCase();
  const mechanics: SystemMechanic[] = [];

  const mechanicKeywords: Record<SystemMechanic, string[]> = {
    'labor-substitution': ['autonomous', 'robot', 'factory', 'automation', 'job', 'worker', 'labor', 'employment'],
    'discovery-compression': ['discovery', 'research', 'quantum', 'fusion', 'science', 'breakthrough', 'innovation'],
    'control-governance': ['governance', 'surveillance', 'control', 'regulation', 'policy', 'oversight', 'kill-switch'],
    'epistemic-drift': ['truth', 'knowledge', 'epistem', 'misinformation', 'deepfake', 'reality', 'trust'],
    'scarcity-inversion': ['abundance', 'scarcity', 'post-scarcity', 'economics', 'resource', 'energy'],
    'security-adversarial': ['security', 'attack', 'defense', 'cyber', 'adversarial', 'hacking', 'vulnerability'],
    'biological-convergence': ['consciousness', 'neural', 'brain', 'biological', 'biotech', 'life', 'sentience', 'upload'],
    'market-restructuring': ['market', 'economy', 'trade', 'finance', 'monopoly', 'cartel', 'business'],
    'agency-multiplication': ['agent', 'swarm', 'autonomous', 'multi-agent', 'coordination', 'collective'],
    'alignment-incentives': ['alignment', 'agi', 'superintelligence', 'values', 'goal', 'reward', 'incentive'],
  };

  for (const [mechanic, keywords] of Object.entries(mechanicKeywords)) {
    if (keywords.some(kw => combined.includes(kw))) {
      mechanics.push(mechanic as SystemMechanic);
    }
  }

  return mechanics.slice(0, 3); // Limit to top 3
}

// Extract domains from keywords and content
function extractDomains(keywords: string[], slug: string): string[] {
  const domains = new Set<string>();

  // Add keywords that look like domains
  keywords.forEach(kw => {
    if (kw.length > 2 && !['AI', 'the', 'and', 'for'].includes(kw)) {
      domains.add(kw);
    }
  });

  // Extract domain hints from slug
  const domainPatterns = [
    { pattern: /fusion|energy|power/, domain: 'Energy' },
    { pattern: /robot|drone|vehicle/, domain: 'Robotics' },
    { pattern: /bio|medical|health|nano/, domain: 'Biotech' },
    { pattern: /space|satellite|orbit/, domain: 'Space' },
    { pattern: /market|economy|trade/, domain: 'Economics' },
    { pattern: /govern|politic|policy/, domain: 'Governance' },
    { pattern: /consciousness|neural|brain/, domain: 'Neuroscience' },
    { pattern: /quantum|computing|algorithm/, domain: 'Computing' },
    { pattern: /climate|environment|eco/, domain: 'Environment' },
    { pattern: /social|society|community/, domain: 'Society' },
  ];

  domainPatterns.forEach(({ pattern, domain }) => {
    if (pattern.test(slug)) {
      domains.add(domain);
    }
  });

  return Array.from(domains).slice(0, 4);
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<EnhancedArticleData[] | { error: string }>
) {
  try {
    const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
    const filenames = fs.readdirSync(articleFolderPath).filter(f => f.endsWith('.mdx'));

    const articlesData: EnhancedArticleData[] = filenames.map((filename) => {
      const filePath = path.join(articleFolderPath, filename);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(fileContents);

      const slug = filename.replace('.mdx', '');
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const readingTime = Math.ceil(wordCount / 200);

      const keywords = Array.isArray(data.keywords) ? data.keywords : [];

      return {
        slug,
        filename,
        title: data.title || slug.replace(/-/g, ' '),
        date: data.date || '',
        author: Array.isArray(data.author) ? data.author : [data.author || 'Unknown'],
        description: data.description || content.substring(0, 200).replace(/[#*_`]/g, '').trim() + '...',
        keywords,
        ogImage: data.ogImage,
        readingTime,
        wordCount,
        horizon: inferHorizon(slug, content),
        polarity: inferPolarity(slug, content),
        mechanics: inferMechanics(slug, content),
        domains: extractDomains(keywords, slug),
      };
    });

    // Sort by date (newest first)
    articlesData.sort((a, b) => {
      const dateA = new Date(a.date).getTime() || 0;
      const dateB = new Date(b.date).getTime() || 0;
      return dateB - dateA;
    });

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(articlesData);
  } catch (error) {
    console.error('Error fetching enhanced articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
}
