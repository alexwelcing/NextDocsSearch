/**
 * AI-POWERED ARTICLE GENERATOR
 * 
 * Uses OpenAI API to generate high-quality articles for both
 * present and future timelines with convergence narratives
 */

import OpenAI from 'openai';
import matter from 'gray-matter';
import {
  type TimelineType,
  type TimelineState,
  PRESENT_TOPICS,
  FUTURE_TOPICS,
  selectNextTimeline,
  calculateConvergence,
  getNextConvergencePoint,
  getTimelineMetadata,
  generateConvergenceTitle,
  generateConvergenceFooter,
} from './timeline-convergence';
import { generateStoryMetadata, generateSEOTitle } from './narrative-framework';

export interface GeneratedArticle {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string[];
  content: string;
  timeline: TimelineType;
  keywords: string[];
  convergence: number;
}

/**
 * Initialize OpenAI client
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_KEY environment variable is required');
  }
  return new OpenAI({ apiKey });
}

/**
 * Generate article content using OpenAI
 */
async function generateArticleContent(
  topic: string,
  timeline: TimelineType,
  convergence: number
): Promise<{ content: string; description: string; keywords: string[] }> {
  const openai = getOpenAIClient();
  const metadata = getTimelineMetadata(timeline);
  const nextPoint = getNextConvergencePoint();

  const systemPrompt = `You are an expert technical writer creating articles for NextDocsSearch, a platform exploring AI, emerging technologies, and their long-term implications.

Timeline: ${timeline === 'present' ? 'Present Day (2024-2026)' : 'Future Archives (2045-2058)'}
Tone: ${metadata.tone}
Convergence: ${convergence.toFixed(1)}% - timelines are ${convergence > 50 ? 'approaching convergence' : 'still distant'}

${
  timeline === 'present'
    ? 'Write as a current technologist/researcher documenting cutting-edge developments in AI, quantum computing, nanotechnology, space tech, and emerging technologies. Focus on technical depth, real science, and practical implications.'
    : 'Write as a future researcher/survivor documenting incidents, failures, and lessons from 2025-era technologies. Use incident report style with detailed timelines, technical post-mortems, and first-person accounts. Think "hard sci-fi meets technical documentation."'
}

CRITICAL REQUIREMENTS:
- Length: 5,000-15,000 words (this is ESSENTIAL - go deep!)
- Technical depth: Include detailed explanations, specifications, code blocks, timelines
- Structure: Multiple H2 sections (6-10), each with 3-5 H3 subsections
- Scientific accuracy: Base concepts on real research/technology
- Narrative richness: ${timeline === 'future' ? 'Detailed incident timelines, hour-by-hour breakdowns, multiple perspectives, technical specifications' : 'Deep technical tutorials, real-world examples, architectural decisions, implementation details'}
- Code examples: ${timeline === 'future' ? 'Show the "legacy code" that caused problems with modern annotations' : 'Provide complete, working examples with explanations'}
- SEO optimization: Use clear headers, keyword-rich content, structured data

${
  nextPoint
    ? `Connect to upcoming convergence point: ${nextPoint.technology} - ${timeline === 'present' ? nextPoint.presentEvent : nextPoint.futureEvent}`
    : ''
}

Style guide:
- Use markdown formatting (headers, lists, code blocks, tables)
- Include technical specifications in structured format
- ${timeline === 'future' ? 'Add timestamps, incident IDs, classification levels' : 'Add version numbers, compatibility notes, performance metrics'}
- Break complex topics into digestible subsections
- Use concrete examples and specific details`;

  const userPrompt = `Write a comprehensive ${timeline === 'future' ? 'incident report / technical post-mortem' : 'technical deep-dive article'} about: ${topic}

${timeline === 'future' ? `
Structure (Incident Report Style):
1. Title & Classification (Hook with dramatic title)
2. Executive Summary (What happened, why it matters)
3. Background/Context (The technology, the promise)
4. The Incident (Detailed timeline - hour by hour or day by day)
5. Technical Analysis (Deep dive into what went wrong)
6. Root Cause Analysis (Why 2025 design decisions failed)
7. Aftermath & Consequences (Casualties, damages, ongoing impacts)
8. Lessons Learned (What we know now that we didn't know then)
9. Modern Safety Protocols (How we prevent this now)
10. Conclusion (Final thoughts, warnings)

Include:
- Specific dates, times, locations
- Technical specifications and diagrams
- Code examples showing the problematic 2025 implementations
- Multiple perspectives (engineers, victims, investigators)
- Official classification/incident numbers
- Casualty/impact statistics
- Scientific explanations of failure modes
` : `
Structure (Technical Tutorial Style):
1. Introduction (Hook - why this matters)
2. Background & Context (Historical development, current state)
3. Core Concepts (Detailed technical explanations)
4. Architecture & Design (How it works, design decisions)
5. Implementation Deep Dive (Step-by-step with code)
6. Advanced Techniques (Optimization, scaling, edge cases)
7. Real-World Applications (Case studies, examples)
8. Performance Considerations (Benchmarks, profiling)
9. Best Practices & Pitfalls (What to do, what to avoid)
10. Future Directions (What's coming next)

Include:
- Complete code examples with explanations
- Architecture diagrams and flowcharts
- Performance metrics and benchmarks
- Compatibility notes and requirements
- Real-world use cases and case studies
- Troubleshooting guides
`}

CRITICAL: This must be 5,000-15,000 words. Go deep into every section. Include multiple subsections. Provide extensive detail, examples, and explanations. Don't summarize - elaborate!`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 16000, // Increased for longer articles
    });

    const content = completion.choices[0]?.message?.content || '';

    // Generate description using AI
    const descCompletion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Create a compelling 150-160 character SEO meta description.',
        },
        { role: 'user', content: `Article: ${topic}\n\nContent summary: ${content.slice(0, 500)}` },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const description = descCompletion.choices[0]?.message?.content || '';

    // Extract keywords
    const keywords = extractKeywords(topic, content, timeline);

    return { content, description, keywords };
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate article content');
  }
}

/**
 * Extract keywords from topic and content
 * Generates 15-20 detailed keywords for SEO
 */
function extractKeywords(topic: string, content: string, timeline: TimelineType): string[] {
  const baseKeywords = [
    'artificial intelligence',
    'AI safety',
    'emerging technology',
    'future technology',
  ];

  const timelineKeywords =
    timeline === 'present'
      ? [
          'modern tech',
          'cutting-edge research',
          'technical tutorial',
          'implementation guide',
          'best practices',
          'architecture',
        ]
      : [
          'tech fiction',
          'incident report',
          'technical post-mortem',
          'AI disasters',
          'legacy systems',
          'lessons learned',
          'tech horror',
          'cautionary tale',
        ];

  // Extract technology-specific keywords from topic
  const techKeywords: string[] = [];
  const techTerms = [
    'AGI', 'quantum', 'nanotech', 'fusion', 'autonomous', 'neural', 'CRISPR',
    'machine learning', 'blockchain', 'space', 'robotics', 'biotech', 'crypto',
    'WebGL', 'Three.js', 'React', 'optimization', 'algorithm', 'simulation',
  ];
  
  techTerms.forEach(term => {
    if (topic.toLowerCase().includes(term.toLowerCase()) || 
        content.toLowerCase().includes(term.toLowerCase())) {
      techKeywords.push(term);
    }
  });

  // Extract key phrases from topic (convert to question format for SEO)
  const topicLower = topic.toLowerCase();
  const seoQuestions: string[] = [];
  
  if (topicLower.includes('what') || topicLower.includes('how') || topicLower.includes('why')) {
    seoQuestions.push(topic);
  } else {
    seoQuestions.push(`what is ${topic.toLowerCase()}`);
    seoQuestions.push(`how ${topic.toLowerCase()} works`);
  }

  // Combine and deduplicate
  const allKeywords = [
    ...baseKeywords,
    ...timelineKeywords,
    ...techKeywords,
    ...seoQuestions.slice(0, 2),
  ];

  // Return unique keywords, limited to 20
  return Array.from(new Set(allKeywords)).slice(0, 20);
}

/**
 * Generate slug from title
 */
function generateSlug(title: string, timeline: TimelineType): string {
  const prefix = timeline === 'present' ? 'present' : 'future';
  // Use crypto for unique ID to avoid collisions
  const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return `${prefix}-${slug}-${uniqueId}`;
}

/**
 * Generate publication date
 */
function generateDate(timeline: TimelineType): string {
  const now = new Date();
  if (timeline === 'present') {
    return now.toISOString().split('T')[0];
  } else {
    // Random future date between 2045-2058
    const futureYear = 2045 + Math.floor(Math.random() * 13);
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    return `${futureYear}-${month}-${day}`;
  }
}

/**
 * Generate a complete article with AI
 */
export async function generateArticle(
  state: TimelineState
): Promise<GeneratedArticle> {
  // Determine which timeline to use
  const timeline = selectNextTimeline(state);
  const convergence = calculateConvergence(state);
  const nextPoint = getNextConvergencePoint();

  // Select topic
  const topics = timeline === 'present' ? PRESENT_TOPICS : FUTURE_TOPICS;
  const baseTopic = topics[Math.floor(Math.random() * topics.length)];

  // Generate convergence-aware title
  const title = generateConvergenceTitle(baseTopic, timeline, convergence, nextPoint);

  // Generate content with AI
  const { content, description, keywords } = await generateArticleContent(
    title,
    timeline,
    convergence
  );

  // Add convergence footer
  const fullContent =
    content + '\n\n' + generateConvergenceFooter(timeline, convergence, nextPoint);

  // Get timeline metadata
  const metadata = getTimelineMetadata(timeline);
  const date = generateDate(timeline);
  const slug = generateSlug(title, timeline);

  return {
    slug,
    title,
    description,
    date,
    author: metadata.author,
    content: fullContent,
    timeline,
    keywords,
    convergence,
  };
}

/**
 * Convert article to MDX format
 */
export function articleToMDX(article: GeneratedArticle): string {
  const frontmatter = {
    title: article.title,
    author: article.author,
    date: article.date,
    description: article.description,
    keywords: article.keywords,
    articleType: article.timeline === 'future' ? 'fiction' : 'tutorial',
    timeline: article.timeline,
    convergence: article.convergence,
    ogImage: `/images/og/${article.slug}.jpg`,
  };

  return matter.stringify(article.content, frontmatter);
}

/**
 * Generate article filename
 */
export function generateFilename(article: GeneratedArticle): string {
  return `${article.slug}.mdx`;
}

/**
 * Estimate cost for article generation
 * Note: Pricing based on OpenAI rates as of November 2024
 * GPT-4-turbo: $0.01/1K input, $0.03/1K output
 * Check https://openai.com/pricing for current rates
 * 
 * Updated for longer articles (5K-15K words)
 */
export function estimateGenerationCost(): { tokens: number; cost: number } {
  const estimatedInputTokens = 2000; // System + user prompt (longer prompts)
  const estimatedOutputTokens = 15000; // Article content (5-7x longer)
  const inputCost = (estimatedInputTokens / 1000) * 0.01;
  const outputCost = (estimatedOutputTokens / 1000) * 0.03;

  return {
    tokens: estimatedInputTokens + estimatedOutputTokens,
    cost: inputCost + outputCost,
  };
}

/**
 * Validate article quality
 * Updated for longer, more detailed articles
 */
export function validateArticle(article: GeneratedArticle): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!article.title || article.title.length < 20) {
    errors.push('Title too short (minimum 20 characters)');
  }

  if (!article.description || article.description.length < 100) {
    errors.push('Description too short (minimum 100 characters)');
  }

  if (!article.content || article.content.length < 5000) {
    errors.push('Content too short (minimum 5000 characters for quality articles)');
  }

  if (!article.keywords || article.keywords.length < 10) {
    errors.push('Not enough keywords (minimum 10 for SEO)');
  }

  if (!article.author || article.author.length === 0) {
    errors.push('Missing author');
  }

  // Check for minimum section headers (should have at least 6 H2 sections)
  const h2Count = (article.content.match(/^## /gm) || []).length;
  if (h2Count < 6) {
    errors.push(`Not enough main sections (found ${h2Count}, need at least 6)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
