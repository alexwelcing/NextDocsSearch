/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODERN WORKSHOP - SEED DATA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Initial resource data from the provided 83 links, organized by topic.
 */

import type { WorkshopResource } from '@/types/workshop';
import { CATEGORY_IDS } from './mindmap-data';
import { generateResourceId, extractDomain, autoCategorize } from './preprocess';

interface SeedLink {
  title: string;
  url: string;
  categoryHint?: string; // Override auto-categorization
}

// ═══════════════════════════════════════════════════════════════════════════
// RAW LINKS ORGANIZED BY TOPIC
// ═══════════════════════════════════════════════════════════════════════════

const CONTEXT_ENGINEERING_LINKS: SeedLink[] = [
  { title: 'Context Engineering: The New Backbone of Scalable AI Systems', url: 'https://www.qodo.ai/blog/context-engineering/' },
  { title: 'Context Engineering: Complete Guide to Building Smarter AI Systems', url: 'https://www.akira.ai/blog/context-engineering' },
  { title: 'Introduction to AI Engineering', url: 'https://ml-architects.ch/blog_posts/introduction_to_ai_engineering.html' },
  { title: 'Context Engineering: The Invisible Discipline Keeping AI Agents from Drowning', url: 'https://medium.com/@juanc.olamendy/context-engineering-the-invisible-discipline-keeping-ai-agents-from-drowning-in-their-own-memory-c0283ca6a954' },
  { title: 'Effective context engineering for AI agents - Anthropic', url: 'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents', categoryHint: CATEGORY_IDS.CLAUDE_CODE },
  { title: 'Context Engineering: Moving Beyond Prompting in AI - DigitalOcean', url: 'https://www.digitalocean.com/community/tutorials/context-engineering-moving-beyond-prompting-ai' },
  { title: 'Architecting efficient context-aware multi-agent framework for production', url: 'https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/' },
  { title: 'Deep Dive into Context Engineering for Agents - Galileo AI', url: 'https://galileo.ai/blog/context-engineering-for-agents' },
  { title: 'Engineering for AI Agents - Redis', url: 'https://redis.io/blog/engineering-for-ai-agents/' },
  { title: 'Most devs don\'t understand how context windows work (YouTube)', url: 'https://www.youtube.com/watch?v=-uW5-TaVXu4' },
  { title: 'From RAG to Context - A 2025 year-end review of RAG', url: 'https://ragflow.io/blog/rag-review-2025-from-rag-to-context' },
  { title: 'Context Engine vs. RAG: 5 Technical Showdowns for Code AI', url: 'https://www.augmentcode.com/guides/context-engine-vs-rag-5-technical-showdowns-for-code-ai' },
];

const MCP_LINKS: SeedLink[] = [
  { title: '2026: The Year for Enterprise-Ready MCP Adoption', url: 'https://www.cdata.com/blog/2026-year-enterprise-ready-mcp-adoption', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'Code execution with MCP: building more efficient AI agents - Anthropic', url: 'https://www.anthropic.com/engineering/code-execution-with-mcp', categoryHint: CATEGORY_IDS.MCP_INTEGRATION },
  { title: 'Scaling Agents with Code Execution and the Model Context Protocol', url: 'https://medium.com/@madhur.prashant7/scaling-agents-with-code-execution-and-the-model-context-protocol-a4c263fa7f61', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'Code execution with MCP: Building more efficient agents - bagrounds.org', url: 'https://bagrounds.org/articles/code-execution-with-mcp-building-more-efficient-agents', categoryHint: CATEGORY_IDS.MCP_INTEGRATION },
  { title: 'Why the Model Context Protocol Won - The New Stack', url: 'https://thenewstack.io/why-the-model-context-protocol-won/', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'The Model Context Protocol\'s impact on 2025 - Thoughtworks', url: 'https://www.thoughtworks.com/en-us/insights/blog/generative-ai/model-context-protocol-mcp-impact-2025', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'What is Model Context Protocol (MCP)? - Google Cloud', url: 'https://cloud.google.com/discover/what-is-model-context-protocol', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'Model Context Protocol - Wikipedia', url: 'https://en.wikipedia.org/wiki/Model_Context_Protocol', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'What is Model Context Protocol (MCP) - Benefits & Architecture 2026', url: 'https://onereach.ai/blog/what-to-know-about-model-context-protocol/', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'Model Context Protocol (MCP): A comprehensive introduction for developers', url: 'https://stytch.com/blog/model-context-protocol-introduction/', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'Model Context Protocol (MCP): The protocol that powers AI agents', url: 'https://developer.hpe.com/blog/model-context-protocol-mcp-the-protocol-that-powers-ai-agents/', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'Model Context Protocol (MCP) Comprehensive Guide for 2025', url: 'https://dysnix.com/blog/model-context-protocol', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'MCP In 26 Minutes (YouTube)', url: 'https://www.youtube.com/watch?v=kOhLoixrJXo', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'AI Agents and Memory: Privacy and Power in the MCP Era', url: 'https://www.newamerica.org/oti/briefs/ai-agents-and-memory/', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'Model Context Protocol (MCP): The New Standard for Agent Memory Sharing', url: 'https://www.codica.com/blog/model-context-protocol-explained-new-standart-for-ai-agents/', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: '7 Things to Know About MCP (Model Context Protocol) in 2025', url: 'https://www.adskate.com/blogs/mcp-model-context-protocol-2025-guide', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'Model Context Protocol (MCP): AI Awareness guide 2026', url: 'https://sigosoft.com/blog/model-context-protocol-mcp-context-aware-ai/', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'What is the Model Context Protocol (MCP)?', url: 'https://modelcontextprotocol.io/', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
  { title: 'My Predictions for MCP and AI-Assisted Coding in 2026', url: 'https://dev.to/blackgirlbytes/my-predictions-for-mcp-and-ai-assisted-coding-in-2026-16bm', categoryHint: CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL },
];

const AGENTIC_CLI_LINKS: SeedLink[] = [
  { title: 'Agentic CLI Tools Compared: Claude Code vs Cline vs Aider', url: 'https://research.aimultiple.com/agentic-cli/', categoryHint: CATEGORY_IDS.AGENTIC_CLI_TOOLS },
  { title: 'Agentic Coding Tools Explained: Complete Setup Guide', url: 'https://www.ikangai.com/agentic-coding-tools-explained-complete-setup-guide-for-claude-code-aider-and-cli-based-ai-development/', categoryHint: CATEGORY_IDS.AGENTIC_CLI_TOOLS },
  { title: 'AI Agent Benchmark: 80+ agents compared - GitHub', url: 'https://github.com/murataslan1/ai-agent-benchmark', categoryHint: CATEGORY_IDS.AGENTIC_CLI_TOOLS },
  { title: 'Top 10 Vibe Coding Tools in 2026', url: 'https://www.nucamp.co/blog/top-10-vibe-coding-tools-in-2026-cursor-copilot-claude-code-more', categoryHint: CATEGORY_IDS.AI_CODING_ASSISTANTS },
  { title: 'Under the Hood of Claude Code: It\'s Not Magic — It\'s Engineering', url: 'https://medium.com/@yuxiaojian/under-the-hood-of-claude-code-its-not-magic-it-s-engineering-e1336c5669d4', categoryHint: CATEGORY_IDS.CLAUDE_CODE },
  { title: 'Claude Code Agent Architecture: Single-Threaded Master Loop', url: 'https://www.zenml.io/llmops-database/claude-code-agent-architecture-single-threaded-master-loop-for-autonomous-coding', categoryHint: CATEGORY_IDS.CLAUDE_CODE },
  { title: 'Claude Code vs OpenAI Codex: Agentic Planner vs Shell-First Surgeon', url: 'https://blog.ivan.digital/claude-code-vs-openai-codex-agentic-planner-vs-shell-first-surgeon-d6ce988526e8', categoryHint: CATEGORY_IDS.CLAUDE_CODE },
  { title: 'Managing Claude Code\'s Context: a practical handbook', url: 'https://www.cometapi.com/managing-claude-codes-context/', categoryHint: CATEGORY_IDS.CLAUDE_CODE },
  { title: 'Prompting best practices - Claude Docs', url: 'https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices', categoryHint: CATEGORY_IDS.CLAUDE_CODE },
  { title: 'Building Agents with Claude Code\'s SDK - PromptLayer Blog', url: 'https://blog.promptlayer.com/building-agents-with-claude-codes-sdk/', categoryHint: CATEGORY_IDS.CLAUDE_CODE },
  { title: 'Compare the Top 5 Agentic CLI Coding Tools - GetStream.io', url: 'https://getstream.io/blog/agentic-cli-tools/', categoryHint: CATEGORY_IDS.AGENTIC_CLI_TOOLS },
  { title: 'AI Terminal Coding Tools That Actually Work in 2025', url: 'https://www.augmentcode.com/guides/ai-terminal-coding-tools-that-actually-work-in-2025', categoryHint: CATEGORY_IDS.AGENTIC_CLI_TOOLS },
];

const AIDER_LINKS: SeedLink[] = [
  { title: 'Unlocking Agentic Coding: A Deep Dive into Aider MCP Server', url: 'https://skywork.ai/skypage/en/agentic-coding-daniel-isler-aider/1978727593201487872', categoryHint: CATEGORY_IDS.AIDER },
  { title: 'RepoMapper: Your AI\'s GPS for Complex Codebases', url: 'https://skywork.ai/skypage/en/repomapper-ai-gps-codebases/1980849506976722944', categoryHint: CATEGORY_IDS.AIDER },
  { title: 'Building a better repository map with tree sitter - Aider', url: 'https://aider.chat/2023/10/22/repomap.html', categoryHint: CATEGORY_IDS.AIDER },
  { title: 'Repository map - Aider', url: 'https://aider.chat/docs/repomap.html', categoryHint: CATEGORY_IDS.AIDER },
  { title: 'Understanding AI Coding Agents Through Aider\'s Architecture', url: 'https://simranchawla.com/understanding-ai-coding-agents-through-aiders-architecture/', categoryHint: CATEGORY_IDS.AIDER },
];

const CURSOR_AND_IDE_LINKS: SeedLink[] = [
  { title: 'The Power of Context In Cursor and Other Tips', url: 'https://medium.com/@michalstefanow.marek/the-power-of-context-in-cursor-and-other-tips-to-get-the-most-out-of-the-ai-editor-de5ce34e8ecc', categoryHint: CATEGORY_IDS.CURSOR },
  { title: 'Cursor AI Deep Dive: Technical Architecture, Advanced Features', url: 'https://collabnix.com/cursor-ai-deep-dive-technical-architecture-advanced-features-best-practices-2025/', categoryHint: CATEGORY_IDS.CURSOR },
  { title: 'Building an Open-Source Alternative to Cursor with Code Context', url: 'https://milvus.io/blog/build-open-source-alternative-to-cursor-with-code-context.md', categoryHint: CATEGORY_IDS.CURSOR },
  { title: 'Codebase Indexing | Cursor Docs', url: 'https://cursor.com/docs/context/codebase-indexing', categoryHint: CATEGORY_IDS.CURSOR },
  { title: 'How Cursor works – Deep dive into vibe coding', url: 'https://bitpeak.com/how-cursor-works-deep-dive-into-vibe-coding/', categoryHint: CATEGORY_IDS.CURSOR },
  { title: 'Windsurf Editor | Windsurf', url: 'https://codeium.com/windsurf', categoryHint: CATEGORY_IDS.WINDSURF },
  { title: 'Cursor vs Claude Code: Ultimate Comparison Guide', url: 'https://www.builder.io/blog/cursor-vs-claude-code', categoryHint: CATEGORY_IDS.CURSOR },
  { title: 'Claude Code vs Cursor: Deep Comparison for Dev Teams', url: 'https://www.qodo.ai/blog/claude-code-vs-cursor/', categoryHint: CATEGORY_IDS.CURSOR },
];

const GEMINI_AND_GOOGLE_LINKS: SeedLink[] = [
  { title: 'Long context | Gemini API - Google AI for Developers', url: 'https://ai.google.dev/gemini-api/docs/long-context', categoryHint: CATEGORY_IDS.CONTEXT_CACHING },
  { title: 'Claude Code vs Gemini CLI: Which One\'s the Real Dev Co-Pilot?', url: 'https://milvus.io/blog/claude-code-vs-gemini-cli-which-ones-the-real-dev-co-pilot.md', categoryHint: CATEGORY_IDS.AGENTIC_CLI_TOOLS },
  { title: 'Vertex AI context caching | Google Cloud Blog', url: 'https://cloud.google.com/blog/products/ai-machine-learning/vertex-ai-context-caching', categoryHint: CATEGORY_IDS.CONTEXT_CACHING },
  { title: 'Context caching | Gemini API | Google AI for Developers', url: 'https://ai.google.dev/gemini-api/docs/caching', categoryHint: CATEGORY_IDS.CONTEXT_CACHING },
  { title: 'Conductor: Introducing context-driven development for Gemini CLI', url: 'https://developers.googleblog.com/conductor-introducing-context-driven-development-for-gemini-cli/', categoryHint: CATEGORY_IDS.AGENTIC_CLI_TOOLS },
  { title: 'Trying Out the New Conductor Extension in Gemini CLI', url: 'https://medium.com/google-cloud/trying-out-the-new-conductor-extension-in-gemini-cli-0801f892e2db', categoryHint: CATEGORY_IDS.AGENTIC_CLI_TOOLS },
  { title: 'Google Antigravity Launched: Gemini 3 Agent Platform', url: 'https://vertu.com/lifestyle/google-antigravity-launched-gemini-3-agent-platform-vs-cursor-claude-code/', categoryHint: CATEGORY_IDS.AI_CODING_ASSISTANTS },
];

const TOOL_COMPARISON_LINKS: SeedLink[] = [
  { title: 'Introducing advanced tool use on the Claude Developer Platform', url: 'https://www.anthropic.com/engineering/advanced-tool-use', categoryHint: CATEGORY_IDS.CLAUDE_CODE },
  { title: 'Best AI Tools for Coding in 2025 - Pinggy', url: 'https://pinggy.io/blog/best_ai_tools_for_coding/', categoryHint: CATEGORY_IDS.AI_CODING_ASSISTANTS },
  { title: '7 Best AI Code Editors in 2026 - F22 Labs', url: 'https://www.f22labs.com/blogs/7-best-ai-code-editors-in-2025/', categoryHint: CATEGORY_IDS.IDE_BASED_TOOLS },
  { title: 'Best AI developer tools for coding - Codingscape', url: 'https://codingscape.com/blog/best-ai-coding-tools-for-developers', categoryHint: CATEGORY_IDS.AI_CODING_ASSISTANTS },
  { title: 'Best AI Code Editor: Cursor vs Windsurf vs Replit in 2026', url: 'https://research.aimultiple.com/ai-code-editor/', categoryHint: CATEGORY_IDS.IDE_BASED_TOOLS },
  { title: 'Best 10 AI Tools for Coding: A Developer\'s Ultimate Toolkit for 2026', url: 'https://manus.im/blog/best-ai-coding-assistant-tools', categoryHint: CATEGORY_IDS.AI_CODING_ASSISTANTS },
  { title: '8 best AI coding tools for developers: tested & compared!', url: 'https://blog.n8n.io/best-ai-for-coding/', categoryHint: CATEGORY_IDS.AI_CODING_ASSISTANTS },
  { title: 'AI Coding Assistants 2025: Cursor vs GitHub Copilot vs Claude Code vs Windsurf', url: 'https://usama.codes/blog/ai-coding-assistants-2025-comparison', categoryHint: CATEGORY_IDS.AI_CODING_ASSISTANTS },
  { title: 'Top AI Coding Assistants: Claude Code vs Gemini CLI vs Cursor vs Qwen Code', url: 'https://medium.com/@fendylike/top-ai-coding-assistants-claude-code-vs-gemini-cli-vs-cursor-vs-qwen-code-0bc759fc9d45', categoryHint: CATEGORY_IDS.AI_CODING_ASSISTANTS },
  { title: 'Claude, Cursor, Aider, Cline, Copilot: Which Is the Best One?', url: 'https://medium.com/@elisowski/claude-cursor-aider-cline-copilot-which-is-the-best-one-ef1a47eaa1e6', categoryHint: CATEGORY_IDS.AI_CODING_ASSISTANTS },
  { title: '8 Best AI Coding Assistants in 2025 - Augment Code', url: 'https://www.augmentcode.com/guides/8-top-ai-coding-assistants-and-their-best-use-cases', categoryHint: CATEGORY_IDS.AI_CODING_ASSISTANTS },
  { title: 'AI dev tool power rankings & comparison [Dec. 2025]', url: 'https://blog.logrocket.com/ai-dev-tool-power-rankings/', categoryHint: CATEGORY_IDS.AI_CODING_ASSISTANTS },
];

const AGENT_PATTERNS_LINKS: SeedLink[] = [
  { title: 'Claude Code: Best practices for agentic coding - Anthropic', url: 'https://www.anthropic.com/engineering/claude-code-best-practices', categoryHint: CATEGORY_IDS.CLAUDE_CODE },
  { title: 'Building Autonomous AI systems with Looping Agents from Google\'s ADK', url: 'https://medium.com/google-cloud/building-autonomous-ai-systems-with-looping-agents-from-googles-agent-development-kit-adk-cb9d0d4997a5', categoryHint: CATEGORY_IDS.AGENTIC_CLI_TOOLS },
  { title: 'Closed-Loop Development: How AI Agents Build Software While You Sleep', url: 'https://medium.com/@alexzanfir/closed-loop-development-how-ai-agents-build-software-while-you-sleep-6df42cd05a85', categoryHint: CATEGORY_IDS.AGENTIC_CLI_TOOLS },
  { title: 'Top 5 AI Agent Trends for 2026 - USAII', url: 'https://www.usaii.org/ai-insights/top-5-ai-agent-trends-for-2026', categoryHint: CATEGORY_IDS.AGENTIC_CLI_TOOLS },
  { title: 'AI and the OODA Loop: Reimagining Operations - F5', url: 'https://www.f5.com/company/blog/ai-and-the-ooda-loop-reimagining-operations', categoryHint: CATEGORY_IDS.AGENTIC_CLI_TOOLS },
  { title: 'FEATURE REQUEST: Better compaction - Claude Code GitHub', url: 'https://github.com/anthropics/claude-code/issues/6549', categoryHint: CATEGORY_IDS.CLAUDE_CODE },
  { title: 'Technical Performance | The 2025 AI Index Report | Stanford HAI', url: 'https://hai.stanford.edu/ai-index/2025-ai-index-report/technical-performance', categoryHint: CATEGORY_IDS.AI_CODING_ASSISTANTS },
  { title: 'How AI Is Transforming Work at Anthropic', url: 'https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic', categoryHint: CATEGORY_IDS.CLAUDE_CODE },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMBINE ALL LINKS
// ═══════════════════════════════════════════════════════════════════════════

const ALL_SEED_LINKS: SeedLink[] = [
  ...CONTEXT_ENGINEERING_LINKS,
  ...MCP_LINKS,
  ...AGENTIC_CLI_LINKS,
  ...AIDER_LINKS,
  ...CURSOR_AND_IDE_LINKS,
  ...GEMINI_AND_GOOGLE_LINKS,
  ...TOOL_COMPARISON_LINKS,
  ...AGENT_PATTERNS_LINKS,
];

// ═══════════════════════════════════════════════════════════════════════════
// GENERATE WORKSHOP RESOURCES
// ═══════════════════════════════════════════════════════════════════════════

export function generateSeedResources(): WorkshopResource[] {
  const now = new Date().toISOString();

  return ALL_SEED_LINKS.map((link, index) => {
    const domain = extractDomain(link.url);
    const isVideo = link.url.includes('youtube.com') || link.url.includes('youtu.be');

    // Use hint or auto-categorize
    let categoryId = link.categoryHint;
    let subcategoryId: string | undefined;

    if (!categoryId) {
      const auto = autoCategorize(link.title, '', link.url);
      categoryId = auto.categoryId;
      subcategoryId = auto.subcategoryId;
    }

    const resource: WorkshopResource = {
      id: `seed_${index + 1}_${generateResourceId()}`,
      type: isVideo ? 'video' : 'link',
      title: link.title,
      description: '', // Will be enriched via API
      url: link.url,
      categoryId,
      subcategoryId,
      tags: extractTagsFromTitle(link.title),
      source: domain,
      status: 'pending' as const,
      viewCount: 0,
      bookmarked: false,
      createdAt: now,
      updatedAt: now,
    };

    return resource;
  });
}

/**
 * Extract tags from title using common AI/dev keywords
 */
function extractTagsFromTitle(title: string): string[] {
  const lowerTitle = title.toLowerCase();
  const tags: string[] = [];

  const tagKeywords = [
    'context engineering', 'mcp', 'claude code', 'cursor', 'aider',
    'gemini', 'copilot', 'agent', 'cli', 'ide', 'llm',
    'rag', 'vector', 'embedding', 'prompt', 'api',
  ];

  for (const keyword of tagKeywords) {
    if (lowerTitle.includes(keyword)) {
      tags.push(keyword);
    }
  }

  return tags.slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY RESOURCE COUNTS
// ═══════════════════════════════════════════════════════════════════════════

export function calculateResourceCounts(resources: WorkshopResource[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const resource of resources) {
    // Count for primary category
    counts[resource.categoryId] = (counts[resource.categoryId] || 0) + 1;

    // Count for subcategory if exists
    if (resource.subcategoryId) {
      counts[resource.subcategoryId] = (counts[resource.subcategoryId] || 0) + 1;
    }
  }

  return counts;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT SEED DATA
// ═══════════════════════════════════════════════════════════════════════════

export const SEED_RESOURCES = generateSeedResources();
export const SEED_RESOURCE_COUNTS = calculateResourceCounts(SEED_RESOURCES);
