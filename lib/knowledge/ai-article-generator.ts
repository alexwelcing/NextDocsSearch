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

  const systemPrompt = `You are an expert technical writer creating articles for NextDocsSearch, a platform exploring React Three Fiber, WebGL, and 3D web technologies.

Timeline: ${timeline === 'present' ? 'Present Day (2024-2026)' : 'Future Archives (2045-2058)'}
Tone: ${metadata.tone}
Convergence: ${convergence.toFixed(1)}% - timelines are ${convergence > 50 ? 'approaching convergence' : 'still distant'}

${
  timeline === 'present'
    ? 'Write as a current developer sharing best practices, tutorials, and insights about modern 3D web development.'
    : 'Write as a future IT professional documenting legacy systems from 2025, exploring technical debt, maintenance challenges, and lessons learned.'
}

The article should be:
- Technically accurate and detailed
- SEO-optimized with clear structure
- Engaging and story-driven ${timeline === 'future' ? 'with dark humor and cautionary tales' : 'with practical examples'}
- 1500-2500 words
- Include code examples where relevant
- Use markdown formatting (headers, lists, code blocks)

${
  nextPoint
    ? `Connect to upcoming convergence point: ${nextPoint.technology} - ${timeline === 'present' ? nextPoint.presentEvent : nextPoint.futureEvent}`
    : ''
}`;

  const userPrompt = `Write a comprehensive technical article about: ${topic}

Structure:
1. Introduction (hook the reader)
2. Technical Deep Dive (3-4 sections)
3. ${timeline === 'present' ? 'Implementation Guide' : 'Lessons Learned'}
4. ${timeline === 'present' ? 'Best Practices' : 'Modern Implications'}
5. Conclusion

${timeline === 'future' ? 'Include specific incident details, dates, and protagonist perspectives as if documenting real events.' : 'Include practical code examples and real-world use cases.'}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 3500,
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
 */
function extractKeywords(topic: string, content: string, timeline: TimelineType): string[] {
  const baseKeywords = [
    'React Three Fiber',
    'Three.js',
    'WebGL',
    '3D web development',
  ];

  const timelineKeywords =
    timeline === 'present'
      ? ['modern web', 'best practices', 'tutorial', 'guide']
      : ['legacy systems', 'technical debt', 'maintenance', 'lessons learned'];

  // Extract key terms from topic
  const topicWords = topic
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 4);

  return [...new Set([...baseKeywords, ...timelineKeywords, ...topicWords])];
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
    timeline: article.timeline,
    convergence: article.convergence,
    ogImage: `/images/timeline-${article.timeline}.jpg`,
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
 */
export function estimateGenerationCost(): { tokens: number; cost: number } {
  const estimatedInputTokens = 1500; // System + user prompt
  const estimatedOutputTokens = 3000; // Article content
  const inputCost = (estimatedInputTokens / 1000) * 0.01;
  const outputCost = (estimatedOutputTokens / 1000) * 0.03;

  return {
    tokens: estimatedInputTokens + estimatedOutputTokens,
    cost: inputCost + outputCost,
  };
}

/**
 * Validate article quality
 */
export function validateArticle(article: GeneratedArticle): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!article.title || article.title.length < 10) {
    errors.push('Title too short');
  }

  if (!article.description || article.description.length < 100) {
    errors.push('Description too short');
  }

  if (!article.content || article.content.length < 1000) {
    errors.push('Content too short (minimum 1000 characters)');
  }

  if (!article.keywords || article.keywords.length < 3) {
    errors.push('Not enough keywords');
  }

  if (!article.author || article.author.length === 0) {
    errors.push('Missing author');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
