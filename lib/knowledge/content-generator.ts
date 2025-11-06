/**
 * CONTENT GENERATION ACCELERATOR
 *
 * Generates tech horror stories about R3F topics for SEO and brand building
 */

import type { R3FTopic } from './r3f-taxonomy';
import {
  generateStoryMetadata,
  generateSEOTitle,
  type StoryMetadata,
  TECH_HORROR_TROPES,
} from './narrative-framework';

export interface GeneratedArticle {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  category: string;
  tags: string[];
  keywords: string[];
  seoScore: number;
  content: string;
  metadata: StoryMetadata;
}

/**
 * Generate article slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Generate article description for SEO
 */
function generateDescription(topic: R3FTopic, metadata: StoryMetadata): string {
  const templates = [
    `A cautionary tale from ${metadata.date.split('-')[0]} about ${topic.title.toLowerCase()} and the technical debt that refused to die.`,
    `Join ${metadata.protagonist.name} as they navigate the horrors of legacy ${topic.title.toLowerCase()} in this chilling incident report from the future.`,
    `What happens when ${topic.title.toLowerCase()} implementations from 2025 collide with the demands of ${metadata.date.split('-')[0]}? This IT professional found out the hard way.`,
    `A gripping account of ${topic.title.toLowerCase()} gone wrong, preserved in the archives of ${metadata.setting}.`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate comprehensive tags for article
 */
function generateTags(topic: R3FTopic, metadata: StoryMetadata): string[] {
  const baseTags = [
    'React Three Fiber',
    'R3F',
    'WebGL',
    'Three.js',
    topic.category,
    topic.difficulty,
    'legacy systems',
    'tech horror',
    'IT stories',
    'developer stories',
  ];

  const specificTags = [
    ...topic.keywords,
    metadata.template.tone,
    'technical debt',
    'software maintenance',
  ];

  return [...new Set([...baseTags, ...specificTags])];
}

/**
 * Generate story content structure
 */
function generateStoryContent(topic: R3FTopic, metadata: StoryMetadata): string {
  const { template, protagonist, setting, date, horrorElements } = metadata;

  // Replace placeholders in opening
  let opening = template.exampleOpening
    .replace('[FUTURE_DATE]', date)
    .replace('[SETTING]', setting)
    .replace('[PROTAGONIST_NAME]', protagonist.name)
    .replace('[ROLE]', protagonist.role)
    .replace('[NAME]', protagonist.name)
    .replace(/\[TECHNOLOGY\]/g, topic.title)
    .replace(/\[XX\]/g, Math.floor(Math.random() * 99).toString().padStart(2, '0'))
    .replace('[ID]', Math.floor(Math.random() * 9999).toString().padStart(4, '0'))
    .replace('[NUMBER]', Math.floor(Math.random() * 999).toString())
    .replace('[FUTURE_YEAR]', date.split('-')[0])
    .replace('[CURRENT_YEAR]', date.split('-')[0])
    .replace('[FACILITY_NAME]', setting)
    .replace('[TECHNICAL_DECISION]', topic.keywords[0]);

  const selectedTrope = TECH_HORROR_TROPES[Math.floor(Math.random() * TECH_HORROR_TROPES.length)];

  return `
${opening}

## The Discovery

${generateDiscoverySection(topic, protagonist, setting)}

## Technical Analysis

${generateTechnicalSection(topic, selectedTrope)}

## The Incident

${generateIncidentSection(topic, horrorElements)}

## Resolution and Lessons Learned

${generateResolutionSection(topic, protagonist, date)}

## Modern Implementation Guide

${generateModernGuideSection(topic)}

---

*This story is a work of speculative fiction. Any resemblance to actual codebases, living or deprecated, is entirely coincidental but probably accurate.*

**Tags:** ${topic.keywords.join(', ')}

**Related Topics:** ${topic.category}, WebGL Development, Performance Optimization, Modern React Patterns
`;
}

/**
 * Generate discovery section
 */
function generateDiscoverySection(topic: R3FTopic, protagonist: { name: string; role: string }, setting: string): string {
  return `The system logs showed anomalies dating back to the original deployment in early 2025. As a ${protagonist.role} stationed at ${setting}, I've seen my share of questionable implementations, but this ${topic.title.toLowerCase()} setup was something special.

The codebase had all the hallmarks of "early adoption syndrome" - enthusiastic implementation of bleeding-edge features, minimal documentation, and comments like "TODO: Optimize this later" that were never addressed. The "later" is now. And "later" is terrifying.

### Initial Assessment

The ${topic.keywords[0]} implementation appeared functional on the surface. But deeper inspection revealed patterns that violated every best practice we've established in the intervening decades. The original developers weren't incompetent - they were pioneers working with tools that were brand new. But pioneers don't always survive to see their discoveries become mainstream.`;
}

/**
 * Generate technical section with actual R3F knowledge
 */
function generateTechnicalSection(topic: R3FTopic, trope: string): string {
  const technicalInsights: Record<string, string> = {
    beginner: `### What They Knew in 2025

The ${topic.title.toLowerCase()} was considered a fundamental building block. The documentation was clear, the examples were plentiful, and developers implemented it with confidence. What they didn't know - what they *couldn't* know - was how these patterns would scale (or fail to scale) over the next 20 years.

### What We Know Now

Modern implementations have evolved significantly. We've learned that ${topic.keywords[0]} requires careful consideration of:

- **Performance implications** under sustained load
- **Memory management** in long-running applications
- **Compatibility** with emerging hardware capabilities
- **Maintainability** when team members change
- **Scalability** beyond initial use cases

The 2025 approach worked for its time. But time is ruthless to code.`,

    intermediate: `### The Technical Debt Compounding

The ${topic.title.toLowerCase()} implementation followed patterns that were cutting-edge in 2025. But here's what they didn't account for:

1. **Evolution of the React reconciler** - The way React handles 3D scene graphs changed significantly after 2025
2. **WebGL context limitations** - Hardware evolved faster than anyone predicted
3. **Browser rendering pipeline changes** - Chrome 487 doesn't work like Chrome 87
4. **Performance expectations** - Users in 2045 won't accept what users in 2025 tolerated

This is classic ${trope}. It worked perfectly in isolation, on the developer's machine, in 2025. But software doesn't exist in isolation, and time is the ultimate integration test.

### The Real Problem

The issue wasn't the ${topic.keywords[0]} itself. The issue was the assumptions baked into its implementation - assumptions about hardware, browser behavior, user expectations, and the stability of the ecosystem.`,

    advanced: `### Deep Technical Analysis

The ${topic.title.toLowerCase()} implementation revealed fundamental misunderstandings about how ${topic.keywords[0]} would evolve. Let me be clear: the original developers were brilliant. They were working at the bleeding edge of what was possible in 2025.

But brilliance doesn't age well in codebases.

#### The Core Issue

The implementation relied on patterns that were optimal in 2025:

\`\`\`typescript
// DON'T DO THIS (2025 pattern that breaks in modern contexts)
// This actually worked fine in 2025, which is the scary part
useFrame(() => {
  // Pattern that seemed innocent
  // But became a maintenance nightmare
});
\`\`\`

The problem? This pattern makes assumptions about:
- Frame timing consistency
- Garbage collection behavior
- Browser event loop scheduling
- Hardware capabilities

All of these changed. Dramatically.

#### Modern Replacement

\`\`\`typescript
// Modern approach (2045 best practice)
// This is what 20 years of hard lessons taught us
useFrame((state, delta) => {
  // Patterns that account for reality
  // Reality is harsh
});
\`\`\``,

    expert: `### Post-Mortem Technical Analysis

The ${topic.title.toLowerCase()} implementation represents a fascinating case study in how expert-level optimizations can become expert-level liabilities.

#### What Made This Code "Expert" in 2025

1. **Cutting-edge techniques** that pushed the boundaries of what R3F could do
2. **Performance optimizations** that squeezed every millisecond from the rendering pipeline
3. **Clever abstractions** that seemed to anticipate future needs
4. **Deep integration** with Three.js internals

#### Why It's Now a Liability

That same expertise created code that:
- Relied on undocumented Three.js behavior that changed
- Optimized for hardware that no longer exists
- Made assumptions about JavaScript engine internals
- Created coupling that prevented necessary updates

This is ${trope} taken to its logical extreme. The code is so clever that maintaining it requires archaeological-level expertise in both 2025 technology AND modern practices.

### The Uncomfortable Truth

The developers weren't wrong. They were *too right* for their specific context. They solved 2025 problems with 2025 solutions. We're the ones trying to run 2025 solutions in 2045 contexts. That's not a technical problem. That's a time travel paradox.`,
  };

  return technicalInsights[topic.difficulty] || technicalInsights.intermediate;
}

/**
 * Generate incident section
 */
function generateIncidentSection(topic: R3FTopic, horrorElements: string[]): string {
  return `The incident occurred during what should have been routine maintenance. ${horrorElements[0]}. The ${topic.keywords[0]} implementation, stable for years, suddenly exhibited behavior that the documentation said was impossible.

### Timeline of Events

**T-0:00** - Initiated standard update procedure
**T+0:15** - First anomalous readings
**T+0:47** - ${horrorElements[1]}
**T+1:23** - System behavior diverged from expected parameters
**T+2:01** - Emergency protocols initiated
**T+2:34** - ${horrorElements[2]}

The logs showed the ${topic.title.toLowerCase()} implementation doing exactly what it was coded to do. That was the problem. What it was coded to do in 2025 was not what we needed it to do in ${new Date().getFullYear() + 20}.

### The Horror of Working Code

This wasn't a bug. This was worse than a bug. This was **correct behavior in the wrong context**. The code was functioning perfectly according to its 2025 specifications. But specifications age poorly.`;
}

/**
 * Generate resolution section
 */
function generateResolutionSection(topic: R3FTopic, protagonist: { name: string; role: string }, date: string): string {
  return `### The Fix

The resolution required rewriting the ${topic.title.toLowerCase()} implementation using modern patterns. This wasn't a patch. This was archaeological reconstruction.

We had to:

1. **Understand the original intent** - What were they trying to achieve?
2. **Identify the modern equivalent** - How do we achieve this in ${date.split('-')[0]}?
3. **Migrate without breaking existing integrations** - Other systems depend on this
4. **Document for the next ${protagonist.role}** - Because we won't be the last

### Lessons Learned

- **Document your assumptions** - The code you write today will be the legacy code someone maintains in 2045
- **Prepare for evolution** - Every abstraction you create should expect the ground to shift beneath it
- **Version your patterns** - What works today might not work tomorrow
- **Have empathy for your future maintainer** - It might be you

This incident report serves as a reminder: we're all writing legacy code. We're all creating tomorrow's technical debt. The question is whether we're creating it *consciously*.

---

*Report filed by: ${protagonist.name}, ${protagonist.role}*
*Date: ${date}*
*Status: Resolved - Monitoring Required*`;
}

/**
 * Generate modern implementation guide
 */
function generateModernGuideSection(topic: R3FTopic): string {
  const guides: Record<string, string> = {
    beginner: `### For Modern Developers

If you're implementing ${topic.title.toLowerCase()} today, here's what you need to know:

**Do:**
- Follow current R3F documentation (not 2025 tutorials)
- Test on modern browsers and hardware
- Consider mobile performance from the start
- Use TypeScript for better maintainability
- Profile performance before optimizing

**Don't:**
- Copy code from old tutorials without understanding it
- Assume patterns that worked in 2025 still work today
- Over-optimize prematurely
- Skip documentation because "the code is self-explanatory"
- Ignore deprecation warnings

**Resources:**
- [Official R3F Documentation](https://docs.pmnd.rs/react-three-fiber)
- [Three.js Journey](https://threejs-journey.com/)
- [Poimandres Discord](https://discord.gg/poimandres) - Active community support`,

    intermediate: `### Modern Implementation Patterns

The ${topic.title.toLowerCase()} of 2045 looks different from 2025. Here's what's changed:

**Architecture:**
\`\`\`typescript
// Modern pattern - resilient and maintainable
// Accounts for the lessons learned from incidents like this one
\`\`\`

**Performance Considerations:**
- Modern GPUs handle ${topic.keywords[0]} differently
- Browser scheduling has evolved
- User expectations have increased
- Mobile devices are more powerful but battery-constrained

**Best Practices:**
1. **Separation of concerns** - Keep rendering logic separate from business logic
2. **State management** - Use modern state libraries designed for 3D contexts
3. **Testing** - Write tests that verify behavior, not implementation
4. **Monitoring** - Instrument your code for observability

**Common Pitfalls:**
- Following outdated tutorials
- Not accounting for browser differences
- Ignoring performance budgets
- Premature abstraction`,

    advanced: `### Advanced Implementation Strategy

For ${topic.title.toLowerCase()}, modern best practices require a sophisticated approach:

**System Design:**

\`\`\`typescript
/**
 * Modern architecture for ${topic.keywords[0]}
 * Designed with evolution in mind
 *
 * Key principles:
 * - Abstraction boundaries that can evolve
 * - Performance monitoring built-in
 * - Graceful degradation strategies
 * - Forward compatibility considerations
 */
\`\`\`

**Performance Engineering:**

The ${topic.keywords[0]} implementation must account for:
- **Variable refresh rates** (60Hz to 240Hz+ displays)
- **Dynamic resolution** (4K to mobile screens)
- **Hardware diversity** (integrated to discrete GPUs)
- **Network latency** (local to cloud rendering)

**Scalability Patterns:**

1. **Horizontal scaling** - How does this work with multiple instances?
2. **Vertical scaling** - What happens with increased complexity?
3. **Degradation strategy** - What's the fallback when hardware can't keep up?
4. **Future-proofing** - What assumptions are we making that might not hold?

**Monitoring and Observability:**

\`\`\`typescript
// Instrument everything
// Your future self will thank you
// Or at least curse you less
\`\`\``,

    expert: `### Expert-Level Considerations

The ${topic.title.toLowerCase()} at expert level requires understanding not just how to implement it, but *why* certain approaches were chosen and *when* to deviate.

**Theoretical Foundations:**

Understanding ${topic.keywords[0]} requires knowledge of:
- WebGL rendering pipeline internals
- JavaScript engine optimization strategies
- Browser compositing behavior
- GPU architecture evolution
- React reconciliation algorithms

**Implementation Trade-offs:**

Every decision is a trade-off:
- **Performance vs. Maintainability** - Faster code is often harder to understand
- **Abstraction vs. Control** - Higher-level APIs hide important details
- **Flexibility vs. Simplicity** - Generic solutions are complex
- **Innovation vs. Stability** - Bleeding edge cuts both ways

**Future-Proofing Strategy:**

\`\`\`typescript
/**
 * Code for 2045, written in ${new Date().getFullYear()}
 *
 * Assumptions (document these!):
 * - [ ] Browser behavior assumption
 * - [ ] Hardware capability assumption
 * - [ ] Framework stability assumption
 * - [ ] User expectation assumption
 *
 * When these assumptions break (not if, when),
 * this is where you start your investigation.
 */
\`\`\`

**The Meta-Lesson:**

Expert code isn't code that solves today's problems perfectly. Expert code is code that *admits* it's solving today's problems and provides handholds for tomorrow's developers.

The experts of 2025 wrote code that was too perfect for its context. Don't make the same mistake.`,
  };

  return guides[topic.difficulty] || guides.intermediate;
}

/**
 * Generate complete article
 */
export function generateArticle(topic: R3FTopic): GeneratedArticle {
  const metadata = generateStoryMetadata();
  const title = generateSEOTitle(topic.title);
  const content = generateStoryContent(topic, metadata);

  return {
    slug: generateSlug(title),
    title,
    description: generateDescription(topic, metadata),
    date: metadata.date,
    author: metadata.protagonist.name,
    category: topic.category,
    tags: generateTags(topic, metadata),
    keywords: [...topic.keywords, 'legacy systems', 'technical debt', 'IT horror stories'],
    seoScore: topic.seoValue,
    content,
    metadata,
  };
}

/**
 * Generate MDX file content
 */
export function generateMDX(article: GeneratedArticle): string {
  return `---
title: "${article.title}"
description: "${article.description}"
date: "${article.date}"
author: "${article.author}"
category: "${article.category}"
tags: ${JSON.stringify(article.tags)}
keywords: ${JSON.stringify(article.keywords)}
seo_score: ${article.seoScore}
narrative_type: "${article.metadata.template.name}"
setting: "${article.metadata.setting}"
difficulty: "technical"
---

${article.content}
`;
}

/**
 * Batch generate articles for multiple topics
 */
export function batchGenerateArticles(topics: R3FTopic[]): GeneratedArticle[] {
  return topics.map(generateArticle);
}
