import type { ArticleChunk, TextBlockVariant } from './EsotericLayout';
import type { MultiArtOption } from '@/lib/article-images';

/* ---------------------------------------------------------------------------
   SEMANTIC MEDIA ANCHORING SYSTEM

   Images are placed at the most semantically relevant location in the article
   based on frontmatter annotations. This creates contextual image-text bonds.

   Frontmatter format (in article .mdx):
   ---
   title: 'Article Title'
   mediaAnchors:
     - section: '## The Compliance Shortcut That Backfired'
       image: 0
       position: right
       variant: offset-right
     - section: '## What Article 13 Actually Says'
       image: 1
       position: left
       variant: standard
   ---

   The parser extracts section boundaries and maps images to their
   closest corresponding content section.
   --------------------------------------------------------------------------- */

interface MediaAnchor {
  section: string;
  imageIndex: number;
  position: 'left' | 'right' | 'above' | 'below';
  variant: TextBlockVariant;
}

interface ParsedSection {
  heading: string;
  headingId: string;
  level: 2 | 3;
  content: string;
  mediaAnchor?: MediaAnchor;
  pullQuote?: string;
  marginalia?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractHeadingId(heading: string): string {
  const clean = heading.replace(/^##+\s*/, '').trim();
  return slugify(clean);
}

function extractPullQuotes(content: string): { cleaned: string; pullQuote?: string } {
  const pullQuoteRegex = /^\s*>\s\*"([^"]+)"\s*$/gm;
  const match = pullQuoteRegex.exec(content);
  if (match) {
    const pullQuote = match[1];
    const cleaned = content.replace(pullQuoteRegex, '').trim();
    return { cleaned, pullQuote };
  }
  return { cleaned: content, pullQuote: undefined };
}

function extractMarginalia(content: string): { cleaned: string; marginalia?: string } {
  const marginaliaRegex = /^\s*---\s*([\s\S]+?)\s*---\s*$/gm;
  const match = marginaliaRegex.exec(content);
  if (match) {
    const marginalia = match[1].trim();
    const cleaned = content.replace(marginaliaRegex, '').trim();
    return { cleaned, marginalia };
  }
  return { cleaned: content, marginalia: undefined };
}

function determineVariant(section: ParsedSection, index: number, total: number): TextBlockVariant {
  const variants: TextBlockVariant[] = ['standard', 'offset-left', 'offset-right', 'inset-left', 'inset-right'];

  if (index === 0) return 'standard';
  if (index === total - 1) return 'offset-right';

  const v = index % 5;
  return variants[v];
}

export interface ArticleParseResult {
  title: string;
  chunks: ArticleChunk[];
  heroImage: string | null;
  mediaAnchors: MediaAnchor[];
}

/* ---------------------------------------------------------------------------
   Parse Markdown into semantic chunks with variant-based layout hints
   --------------------------------------------------------------------------- */

export function parseArticleContent(
  markdown: string,
  mediaImages: MultiArtOption[],
  frontmatterAnchors: MediaAnchor[] = []
): ArticleParseResult {
  const lines = markdown.split('\n');
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;
  let currentContent: string[] = [];

  const frontmatterMap = new Map<string, MediaAnchor>();
  for (const anchor of frontmatterAnchors) {
    const key = slugify(anchor.section);
    frontmatterMap.set(key, anchor);
  }

  function flushSection() {
    if (!currentSection && currentContent.length === 0) return;

    if (currentSection) {
      const rawContent = currentContent.join('\n').trim();
      const { cleaned: contentWithPull, pullQuote } = extractPullQuotes(rawContent);
      const { cleaned: finalContent, marginalia } = extractMarginalia(contentWithPull);

      currentSection.content = finalContent;
      currentSection.pullQuote = pullQuote;
      currentSection.marginalia = marginalia;

      const headingKey = currentSection.headingId;
      const anchor = frontmatterMap.get(headingKey);
      if (anchor && mediaImages[anchor.imageIndex]) {
        currentSection.mediaAnchor = anchor;
      }
    } else if (currentContent.length > 0) {
      const rawContent = currentContent.join('\n').trim();
      const { cleaned, pullQuote } = extractPullQuotes(rawContent);
      const { cleaned: finalContent, marginalia } = extractMarginalia(cleaned);

      sections.push({
        heading: '',
        headingId: 'intro',
        level: 2,
        content: finalContent,
        pullQuote,
        marginalia,
      });
    }

    currentContent = [];
    currentSection = null;
  }

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);

    if (h2Match) {
      flushSection();
      const heading = h2Match[1];
      currentSection = {
        heading,
        headingId: extractHeadingId(heading),
        level: 2,
        content: '',
      };
    } else if (h3Match) {
      flushSection();
      const heading = h3Match[1];
      currentSection = {
        heading,
        headingId: extractHeadingId(heading),
        level: 3,
        content: '',
      };
    } else {
      if (currentSection || currentContent.length > 0) {
        currentContent.push(line);
      }
    }
  }

  flushSection();

  const chunks: ArticleChunk[] = sections.map((section, idx) => ({
    id: section.headingId || `section-${idx}`,
    content: section.content || (idx === 0 ? section.content : ''),
    variant: determineVariant(section, idx, sections.length),
    mediaAnchor: section.mediaAnchor?.imageIndex !== undefined
      ? mediaImages[section.mediaAnchor.imageIndex]
      : undefined,
    pullQuote: section.pullQuote,
    marginalia: section.marginalia,
  }));

  return {
    title: '',
    chunks,
    heroImage: mediaImages[0]?.path || null,
    mediaAnchors: frontmatterAnchors,
  };
}

/* ---------------------------------------------------------------------------
   Frontmatter anchor parser — reads mediaAnchors from parsed frontmatter
   --------------------------------------------------------------------------- */

export function parseMediaAnchors(frontmatter: Record<string, unknown>): MediaAnchor[] {
  const anchors = frontmatter.mediaAnchors as unknown[] | undefined;
  if (!Array.isArray(anchors)) return [];

  return anchors.map((anchor: unknown) => {
    const a = anchor as Record<string, unknown>;
    return {
      section: String(a.section || ''),
      imageIndex: Number(a.imageIndex ?? 0),
      position: (a.position as 'left' | 'right' | 'above' | 'below') || 'right',
      variant: (a.variant as TextBlockVariant) || 'standard',
    };
  });
}

/* ---------------------------------------------------------------------------
   Chunk generator for markdown with inline annotations

   Use markdown comments to control layout per-section:
   <!-- layout: offset-left -->
   <!-- pull-quote: "The key insight" -->
   <!-- marginalia: Side note text -->
   --------------------------------------------------------------------------- */

export function parseInlineAnchors(
  markdown: string,
  mediaImages: MultiArtOption[]
): ArticleParseResult {
  const lines = markdown.split('\n');
  const chunks: ArticleChunk[] = [];
  let currentVariant: TextBlockVariant = 'standard';
  let currentPullQuote: string | undefined;
  let currentMarginalia: string | undefined;
  let currentSectionLines: string[] = [];
  let sectionIndex = 0;

  for (const line of lines) {
    const layoutMatch = line.match(/<!--\s*layout:\s*(\w+)\s*-->/);
    const pullMatch = line.match(/<!--\s*pull-quote:\s*"([^"]+)"\s*-->/);
    const marginaliaMatch = line.match(/<!--\s*marginalia:\s*([\s\S]+?)\s*-->/);

    if (layoutMatch) {
      currentVariant = layoutMatch[1] as TextBlockVariant;
      continue;
    }

    if (pullMatch) {
      currentPullQuote = pullMatch[1];
      continue;
    }

    if (marginaliaMatch) {
      currentMarginalia = marginaliaMatch[1].trim();
      continue;
    }

    if (line.startsWith('## ')) {
      if (currentSectionLines.length > 0) {
        chunks.push({
          id: `section-${sectionIndex}`,
          content: currentSectionLines.join('\n').trim(),
          variant: currentVariant,
          mediaAnchor: mediaImages[sectionIndex],
          pullQuote: currentPullQuote,
          marginalia: currentMarginalia,
        });
        sectionIndex++;
        currentVariant = 'standard';
        currentPullQuote = undefined;
        currentMarginalia = undefined;
        currentSectionLines = [];
      }
      currentSectionLines.push(line);
    } else {
      currentSectionLines.push(line);
    }
  }

  if (currentSectionLines.length > 0) {
    chunks.push({
      id: `section-${sectionIndex}`,
      content: currentSectionLines.join('\n').trim(),
      variant: currentVariant,
      mediaAnchor: mediaImages[sectionIndex],
      pullQuote: currentPullQuote,
      marginalia: currentMarginalia,
    });
  }

  const title = chunks[0]?.content?.match(/^#\s+(.+)$/m)?.[1] || '';

  return {
    title,
    chunks,
    heroImage: mediaImages[0]?.path || null,
    mediaAnchors: [],
  };
}

/* ---------------------------------------------------------------------------
   Chunk combiners — Group smaller sections for cleaner layout
   --------------------------------------------------------------------------- */

export function combineShortSections(chunks: ArticleChunk[], minWords = 150): ArticleChunk[] {
  const combined: ArticleChunk[] = [];
  let buffer: ArticleChunk | null = null;

  for (const chunk of chunks) {
    const wordCount = chunk.content.split(/\s+/).length;

    if (!buffer) {
      buffer = chunk;
      continue;
    }

    if (wordCount < minWords) {
      buffer = {
        ...buffer,
        content: buffer.content + '\n\n' + chunk.content,
      };
    } else {
      combined.push(buffer);
      buffer = chunk;
    }
  }

  if (buffer) {
    combined.push(buffer);
  }

  return combined;
}

export default parseArticleContent;