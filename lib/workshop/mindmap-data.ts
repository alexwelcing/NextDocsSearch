/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODERN WORKSHOP - MIND MAP DATA STRUCTURE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * AI Development Landscape 2025-2026
 *
 * This file defines the hierarchical structure of the Modern Workshop,
 * organized as a mind map that can be visualized in 3D space.
 */

import type { MindMapCategory, MindMapStructure, WorkshopResource } from '@/types/workshop';

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY IDS - For easy reference
// ═══════════════════════════════════════════════════════════════════════════

export const CATEGORY_IDS = {
  // Root
  ROOT: 'ai-dev-landscape',

  // Main branches
  AI_CODING_ASSISTANTS: 'ai-coding-assistants',
  INFRASTRUCTURE_DATA: 'infrastructure-data',
  HARDWARE_PERFORMANCE: 'hardware-performance',
  DEVELOPMENT_FRAMEWORKS: 'development-frameworks',
  ECONOMIC_OPERATIONAL: 'economic-operational',

  // AI Coding Assistants sub-branches
  IDE_BASED_TOOLS: 'ide-based-tools',
  AGENTIC_CLI_TOOLS: 'agentic-cli-tools',
  WEB_PROTOTYPING_TOOLS: 'web-prototyping-tools',

  // Infrastructure and Data sub-branches
  VECTOR_DATABASES: 'vector-databases',
  LOCAL_LLM_EXECUTION: 'local-llm-execution',
  MODEL_CONTEXT_PROTOCOL: 'model-context-protocol',

  // Hardware and Performance sub-branches
  NVIDIA_GPU_ECOSYSTEM: 'nvidia-gpu-ecosystem',
  APPLE_UNIFIED_MEMORY: 'apple-unified-memory',
  OPTIMIZATION_TECHNIQUES: 'optimization-techniques',

  // Development Frameworks sub-branches
  FRONTEND_EVOLUTION: 'frontend-evolution',
  BACKEND_SYSTEMS: 'backend-systems',

  // Economic and Operational sub-branches
  PRICING_MODELS: 'pricing-models',
  ROI_DRIVERS: 'roi-drivers',
  COMPLIANCE_SECURITY: 'compliance-security',

  // Leaf nodes - IDE Tools
  CURSOR: 'cursor',
  GITHUB_COPILOT: 'github-copilot',
  WINDSURF: 'windsurf',
  JETBRAINS_AI: 'jetbrains-ai',

  // Leaf nodes - CLI Tools
  CLAUDE_CODE: 'claude-code',
  AIDER: 'aider',
  CLINE: 'cline',
  GIDER: 'gider',

  // Leaf nodes - Web/Prototyping
  REPLIT_AGENT: 'replit-agent',
  BOLT_NEW: 'bolt-new',
  V0_DEV: 'v0-dev',
  LOVABLE: 'lovable',

  // Leaf nodes - Vector DBs
  PINECONE: 'pinecone',
  MILVUS: 'milvus',
  WEAVIATE: 'weaviate',
  PGVECTOR: 'pgvector',

  // Leaf nodes - Local LLM
  OLLAMA: 'ollama',
  LM_STUDIO: 'lm-studio',
  JAN: 'jan',
  GPT4ALL: 'gpt4all',

  // Leaf nodes - MCP
  MCP_INTEGRATION: 'mcp-integration',
  MCP_RESOURCE_ACCESS: 'mcp-resource-access',
  MCP_TOOL_DISCOVERY: 'mcp-tool-discovery',

  // Leaf nodes - NVIDIA
  RTX_5090: 'rtx-5090',
  H100_H200: 'h100-h200',
  DGX_SYSTEMS: 'dgx-systems',

  // Leaf nodes - Apple
  M3_M4_PRO: 'm3-m4-pro',
  HIGH_VRAM_CAPACITY: 'high-vram-capacity',
  BUDGET_SCALABILITY: 'budget-scalability',

  // Leaf nodes - Optimization
  KV_CACHING: 'kv-caching',
  MODEL_QUANTIZATION: 'model-quantization',
  CONTEXT_CACHING: 'context-caching',

  // Leaf nodes - Frontend
  NEXTJS_16: 'nextjs-16',
  TANSTACK_START: 'tanstack-start',
  REACT_COMPILER: 'react-compiler',

  // Leaf nodes - Backend
  LARAVEL_WORKFLOWS: 'laravel-workflows',
  RUST_HIGH_THROUGHPUT: 'rust-high-throughput',
  TYPESCRIPT_STANDARD: 'typescript-standard',

  // Leaf nodes - Pricing
  FLAT_RATE_SUBS: 'flat-rate-subscriptions',
  CREDIT_BASED_USAGE: 'credit-based-usage',
  BYOK_API_KEY: 'byok-api-key',

  // Leaf nodes - ROI
  PROTOTYPING_SPEED: 'prototyping-speed',
  CODE_QUALITY_TESTING: 'code-quality-testing',
  INFRASTRUCTURE_TCO: 'infrastructure-tco',

  // Leaf nodes - Compliance
  SOC2_TYPE_II: 'soc2-type-ii',
  ISO_42001: 'iso-42001',
  SELF_HOSTED_PRIVACY: 'self-hosted-privacy',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// COLOR PALETTE - Mind Map Branch Colors
// ═══════════════════════════════════════════════════════════════════════════

export const BRANCH_COLORS = {
  root: '#6366f1',           // Indigo - Root
  aiCoding: '#10b981',       // Emerald - AI Coding Assistants
  infrastructure: '#3b82f6', // Blue - Infrastructure & Data
  hardware: '#f59e0b',       // Amber - Hardware & Performance
  frameworks: '#8b5cf6',     // Purple - Development Frameworks
  economic: '#ec4899',       // Pink - Economic & Operational
};

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const createCategory = (
  id: string,
  name: string,
  description: string,
  parentId: string | null,
  depth: number,
  color: string,
  icon?: string
): MindMapCategory => ({
  id,
  name,
  description,
  parentId,
  children: [],
  depth,
  color,
  icon,
  resourceCount: 0,
  isExpanded: depth <= 1,
});

export const MIND_MAP_CATEGORIES: Record<string, MindMapCategory> = {
  // ═══════════════════════════════════════════════════════════════════════
  // ROOT NODE
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.ROOT]: createCategory(
    CATEGORY_IDS.ROOT,
    'AI Development Landscape 2025-2026',
    'A comprehensive map of the modern AI development ecosystem, covering tools, infrastructure, hardware, and business considerations.',
    null,
    0,
    BRANCH_COLORS.root,
    'brain'
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN BRANCHES (Level 1)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.AI_CODING_ASSISTANTS]: createCategory(
    CATEGORY_IDS.AI_CODING_ASSISTANTS,
    'AI Coding Assistants',
    'Tools that help developers write, review, and debug code using AI capabilities.',
    CATEGORY_IDS.ROOT,
    1,
    BRANCH_COLORS.aiCoding,
    'code'
  ),

  [CATEGORY_IDS.INFRASTRUCTURE_DATA]: createCategory(
    CATEGORY_IDS.INFRASTRUCTURE_DATA,
    'Infrastructure and Data',
    'Backend systems, databases, and protocols that power AI applications.',
    CATEGORY_IDS.ROOT,
    1,
    BRANCH_COLORS.infrastructure,
    'database'
  ),

  [CATEGORY_IDS.HARDWARE_PERFORMANCE]: createCategory(
    CATEGORY_IDS.HARDWARE_PERFORMANCE,
    'Hardware and Performance',
    'Physical computing resources and optimization techniques for AI workloads.',
    CATEGORY_IDS.ROOT,
    1,
    BRANCH_COLORS.hardware,
    'cpu'
  ),

  [CATEGORY_IDS.DEVELOPMENT_FRAMEWORKS]: createCategory(
    CATEGORY_IDS.DEVELOPMENT_FRAMEWORKS,
    'Development Frameworks',
    'Software frameworks and languages used to build AI-powered applications.',
    CATEGORY_IDS.ROOT,
    1,
    BRANCH_COLORS.frameworks,
    'layers'
  ),

  [CATEGORY_IDS.ECONOMIC_OPERATIONAL]: createCategory(
    CATEGORY_IDS.ECONOMIC_OPERATIONAL,
    'Economic and Operational Factors',
    'Business considerations including pricing, ROI, and regulatory compliance.',
    CATEGORY_IDS.ROOT,
    1,
    BRANCH_COLORS.economic,
    'trending-up'
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // AI CODING ASSISTANTS SUB-BRANCHES (Level 2)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.IDE_BASED_TOOLS]: createCategory(
    CATEGORY_IDS.IDE_BASED_TOOLS,
    'IDE-Based Tools',
    'AI assistants integrated directly into code editors and IDEs.',
    CATEGORY_IDS.AI_CODING_ASSISTANTS,
    2,
    BRANCH_COLORS.aiCoding,
    'layout'
  ),

  [CATEGORY_IDS.AGENTIC_CLI_TOOLS]: createCategory(
    CATEGORY_IDS.AGENTIC_CLI_TOOLS,
    'Agentic CLI Tools',
    'Command-line AI agents that can autonomously execute multi-step coding tasks.',
    CATEGORY_IDS.AI_CODING_ASSISTANTS,
    2,
    BRANCH_COLORS.aiCoding,
    'terminal'
  ),

  [CATEGORY_IDS.WEB_PROTOTYPING_TOOLS]: createCategory(
    CATEGORY_IDS.WEB_PROTOTYPING_TOOLS,
    'Web/Prototyping Tools',
    'Browser-based AI tools for rapid application prototyping.',
    CATEGORY_IDS.AI_CODING_ASSISTANTS,
    2,
    BRANCH_COLORS.aiCoding,
    'globe'
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // INFRASTRUCTURE SUB-BRANCHES (Level 2)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.VECTOR_DATABASES]: createCategory(
    CATEGORY_IDS.VECTOR_DATABASES,
    'Vector Databases',
    'Specialized databases for storing and querying high-dimensional embeddings.',
    CATEGORY_IDS.INFRASTRUCTURE_DATA,
    2,
    BRANCH_COLORS.infrastructure,
    'boxes'
  ),

  [CATEGORY_IDS.LOCAL_LLM_EXECUTION]: createCategory(
    CATEGORY_IDS.LOCAL_LLM_EXECUTION,
    'Local LLM Execution',
    'Tools for running large language models on local hardware.',
    CATEGORY_IDS.INFRASTRUCTURE_DATA,
    2,
    BRANCH_COLORS.infrastructure,
    'hard-drive'
  ),

  [CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL]: createCategory(
    CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL,
    'Model Context Protocol (MCP)',
    'Standardized protocol for AI agents to interact with external tools and data.',
    CATEGORY_IDS.INFRASTRUCTURE_DATA,
    2,
    BRANCH_COLORS.infrastructure,
    'plug'
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // HARDWARE SUB-BRANCHES (Level 2)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.NVIDIA_GPU_ECOSYSTEM]: createCategory(
    CATEGORY_IDS.NVIDIA_GPU_ECOSYSTEM,
    'NVIDIA GPU Ecosystem',
    'NVIDIA graphics cards and enterprise systems for AI training and inference.',
    CATEGORY_IDS.HARDWARE_PERFORMANCE,
    2,
    BRANCH_COLORS.hardware,
    'monitor'
  ),

  [CATEGORY_IDS.APPLE_UNIFIED_MEMORY]: createCategory(
    CATEGORY_IDS.APPLE_UNIFIED_MEMORY,
    'Apple Unified Memory',
    'Apple Silicon systems with unified memory architecture for local AI workloads.',
    CATEGORY_IDS.HARDWARE_PERFORMANCE,
    2,
    BRANCH_COLORS.hardware,
    'apple'
  ),

  [CATEGORY_IDS.OPTIMIZATION_TECHNIQUES]: createCategory(
    CATEGORY_IDS.OPTIMIZATION_TECHNIQUES,
    'Optimization Techniques',
    'Methods to improve inference speed and reduce computational costs.',
    CATEGORY_IDS.HARDWARE_PERFORMANCE,
    2,
    BRANCH_COLORS.hardware,
    'zap'
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // FRAMEWORKS SUB-BRANCHES (Level 2)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.FRONTEND_EVOLUTION]: createCategory(
    CATEGORY_IDS.FRONTEND_EVOLUTION,
    'Frontend Evolution',
    'Modern frontend frameworks and tools optimized for AI-powered applications.',
    CATEGORY_IDS.DEVELOPMENT_FRAMEWORKS,
    2,
    BRANCH_COLORS.frameworks,
    'palette'
  ),

  [CATEGORY_IDS.BACKEND_SYSTEMS]: createCategory(
    CATEGORY_IDS.BACKEND_SYSTEMS,
    'Backend and Systems',
    'Server-side frameworks and languages for building AI infrastructure.',
    CATEGORY_IDS.DEVELOPMENT_FRAMEWORKS,
    2,
    BRANCH_COLORS.frameworks,
    'server'
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // ECONOMIC SUB-BRANCHES (Level 2)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.PRICING_MODELS]: createCategory(
    CATEGORY_IDS.PRICING_MODELS,
    'Pricing Models',
    'Different approaches to pricing AI tools and services.',
    CATEGORY_IDS.ECONOMIC_OPERATIONAL,
    2,
    BRANCH_COLORS.economic,
    'credit-card'
  ),

  [CATEGORY_IDS.ROI_DRIVERS]: createCategory(
    CATEGORY_IDS.ROI_DRIVERS,
    'ROI Drivers',
    'Key factors that drive return on investment for AI adoption.',
    CATEGORY_IDS.ECONOMIC_OPERATIONAL,
    2,
    BRANCH_COLORS.economic,
    'bar-chart'
  ),

  [CATEGORY_IDS.COMPLIANCE_SECURITY]: createCategory(
    CATEGORY_IDS.COMPLIANCE_SECURITY,
    'Compliance and Security',
    'Regulatory requirements and security certifications for AI systems.',
    CATEGORY_IDS.ECONOMIC_OPERATIONAL,
    2,
    BRANCH_COLORS.economic,
    'shield'
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // LEAF NODES - IDE TOOLS (Level 3)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.CURSOR]: createCategory(
    CATEGORY_IDS.CURSOR,
    'Cursor (VS Code Fork)',
    'AI-first code editor built on VS Code with deep AI integration.',
    CATEGORY_IDS.IDE_BASED_TOOLS,
    3,
    BRANCH_COLORS.aiCoding
  ),

  [CATEGORY_IDS.GITHUB_COPILOT]: createCategory(
    CATEGORY_IDS.GITHUB_COPILOT,
    'GitHub Copilot',
    'GitHub\'s AI pair programmer powered by OpenAI models.',
    CATEGORY_IDS.IDE_BASED_TOOLS,
    3,
    BRANCH_COLORS.aiCoding
  ),

  [CATEGORY_IDS.WINDSURF]: createCategory(
    CATEGORY_IDS.WINDSURF,
    'Windsurf (Cascade Agent)',
    'Codeium\'s agentic IDE with parallel work capabilities.',
    CATEGORY_IDS.IDE_BASED_TOOLS,
    3,
    BRANCH_COLORS.aiCoding
  ),

  [CATEGORY_IDS.JETBRAINS_AI]: createCategory(
    CATEGORY_IDS.JETBRAINS_AI,
    'JetBrains AI Assistant',
    'AI assistant integrated across all JetBrains IDEs.',
    CATEGORY_IDS.IDE_BASED_TOOLS,
    3,
    BRANCH_COLORS.aiCoding
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // LEAF NODES - CLI TOOLS (Level 3)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.CLAUDE_CODE]: createCategory(
    CATEGORY_IDS.CLAUDE_CODE,
    'Claude Code (Anthropic)',
    'Anthropic\'s agentic CLI for autonomous coding tasks.',
    CATEGORY_IDS.AGENTIC_CLI_TOOLS,
    3,
    BRANCH_COLORS.aiCoding
  ),

  [CATEGORY_IDS.AIDER]: createCategory(
    CATEGORY_IDS.AIDER,
    'Aider (Open Source)',
    'Open-source AI pair programming tool with multi-model support.',
    CATEGORY_IDS.AGENTIC_CLI_TOOLS,
    3,
    BRANCH_COLORS.aiCoding
  ),

  [CATEGORY_IDS.CLINE]: createCategory(
    CATEGORY_IDS.CLINE,
    'Cline (VS Code Extension)',
    'VS Code extension for agentic coding workflows.',
    CATEGORY_IDS.AGENTIC_CLI_TOOLS,
    3,
    BRANCH_COLORS.aiCoding
  ),

  [CATEGORY_IDS.GIDER]: createCategory(
    CATEGORY_IDS.GIDER,
    'gider (Git-centric)',
    'Git-centric AI coding assistant focused on version control.',
    CATEGORY_IDS.AGENTIC_CLI_TOOLS,
    3,
    BRANCH_COLORS.aiCoding
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // LEAF NODES - WEB TOOLS (Level 3)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.REPLIT_AGENT]: createCategory(
    CATEGORY_IDS.REPLIT_AGENT,
    'Replit Agent',
    'Autonomous agent for building and deploying applications.',
    CATEGORY_IDS.WEB_PROTOTYPING_TOOLS,
    3,
    BRANCH_COLORS.aiCoding
  ),

  [CATEGORY_IDS.BOLT_NEW]: createCategory(
    CATEGORY_IDS.BOLT_NEW,
    'Bolt.new',
    'Rapid web application prototyping with AI.',
    CATEGORY_IDS.WEB_PROTOTYPING_TOOLS,
    3,
    BRANCH_COLORS.aiCoding
  ),

  [CATEGORY_IDS.V0_DEV]: createCategory(
    CATEGORY_IDS.V0_DEV,
    'v0.dev',
    'Vercel\'s AI-powered UI component generator.',
    CATEGORY_IDS.WEB_PROTOTYPING_TOOLS,
    3,
    BRANCH_COLORS.aiCoding
  ),

  [CATEGORY_IDS.LOVABLE]: createCategory(
    CATEGORY_IDS.LOVABLE,
    'Lovable',
    'AI tool for creating lovable user experiences.',
    CATEGORY_IDS.WEB_PROTOTYPING_TOOLS,
    3,
    BRANCH_COLORS.aiCoding
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // LEAF NODES - VECTOR DATABASES (Level 3)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.PINECONE]: createCategory(
    CATEGORY_IDS.PINECONE,
    'Pinecone (Managed)',
    'Fully managed vector database for production AI applications.',
    CATEGORY_IDS.VECTOR_DATABASES,
    3,
    BRANCH_COLORS.infrastructure
  ),

  [CATEGORY_IDS.MILVUS]: createCategory(
    CATEGORY_IDS.MILVUS,
    'Milvus (Open Source)',
    'Open-source vector database for scalable similarity search.',
    CATEGORY_IDS.VECTOR_DATABASES,
    3,
    BRANCH_COLORS.infrastructure
  ),

  [CATEGORY_IDS.WEAVIATE]: createCategory(
    CATEGORY_IDS.WEAVIATE,
    'Weaviate (Hybrid Search)',
    'Vector database with built-in hybrid search capabilities.',
    CATEGORY_IDS.VECTOR_DATABASES,
    3,
    BRANCH_COLORS.infrastructure
  ),

  [CATEGORY_IDS.PGVECTOR]: createCategory(
    CATEGORY_IDS.PGVECTOR,
    'pgvector/pgvectorscale (PostgreSQL)',
    'Vector similarity search extension for PostgreSQL.',
    CATEGORY_IDS.VECTOR_DATABASES,
    3,
    BRANCH_COLORS.infrastructure
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // LEAF NODES - LOCAL LLM (Level 3)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.OLLAMA]: createCategory(
    CATEGORY_IDS.OLLAMA,
    'Ollama',
    'Run open-source LLMs locally with simple CLI.',
    CATEGORY_IDS.LOCAL_LLM_EXECUTION,
    3,
    BRANCH_COLORS.infrastructure
  ),

  [CATEGORY_IDS.LM_STUDIO]: createCategory(
    CATEGORY_IDS.LM_STUDIO,
    'LM Studio',
    'Desktop application for running local LLMs with GUI.',
    CATEGORY_IDS.LOCAL_LLM_EXECUTION,
    3,
    BRANCH_COLORS.infrastructure
  ),

  [CATEGORY_IDS.JAN]: createCategory(
    CATEGORY_IDS.JAN,
    'Jan',
    'Open-source alternative to ChatGPT that runs offline.',
    CATEGORY_IDS.LOCAL_LLM_EXECUTION,
    3,
    BRANCH_COLORS.infrastructure
  ),

  [CATEGORY_IDS.GPT4ALL]: createCategory(
    CATEGORY_IDS.GPT4ALL,
    'GPT4All',
    'Ecosystem of open-source chatbots trained on assistant interactions.',
    CATEGORY_IDS.LOCAL_LLM_EXECUTION,
    3,
    BRANCH_COLORS.infrastructure
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // LEAF NODES - MCP (Level 3)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.MCP_INTEGRATION]: createCategory(
    CATEGORY_IDS.MCP_INTEGRATION,
    'Standardized Integration',
    'Standard protocol for connecting AI agents to external systems.',
    CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL,
    3,
    BRANCH_COLORS.infrastructure
  ),

  [CATEGORY_IDS.MCP_RESOURCE_ACCESS]: createCategory(
    CATEGORY_IDS.MCP_RESOURCE_ACCESS,
    'Resource Access',
    'Secure access to databases, files, and APIs through MCP.',
    CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL,
    3,
    BRANCH_COLORS.infrastructure
  ),

  [CATEGORY_IDS.MCP_TOOL_DISCOVERY]: createCategory(
    CATEGORY_IDS.MCP_TOOL_DISCOVERY,
    'Dynamic Tool Discovery',
    'Automatic discovery and registration of available tools.',
    CATEGORY_IDS.MODEL_CONTEXT_PROTOCOL,
    3,
    BRANCH_COLORS.infrastructure
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // LEAF NODES - NVIDIA (Level 3)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.RTX_5090]: createCategory(
    CATEGORY_IDS.RTX_5090,
    'RTX 5090 (Consumer)',
    'High-end consumer GPU for local AI inference.',
    CATEGORY_IDS.NVIDIA_GPU_ECOSYSTEM,
    3,
    BRANCH_COLORS.hardware
  ),

  [CATEGORY_IDS.H100_H200]: createCategory(
    CATEGORY_IDS.H100_H200,
    'H100 / H200 (Enterprise)',
    'Enterprise-grade GPUs for large-scale AI training.',
    CATEGORY_IDS.NVIDIA_GPU_ECOSYSTEM,
    3,
    BRANCH_COLORS.hardware
  ),

  [CATEGORY_IDS.DGX_SYSTEMS]: createCategory(
    CATEGORY_IDS.DGX_SYSTEMS,
    'DGX Systems',
    'Integrated AI supercomputing platforms.',
    CATEGORY_IDS.NVIDIA_GPU_ECOSYSTEM,
    3,
    BRANCH_COLORS.hardware
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // LEAF NODES - APPLE (Level 3)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.M3_M4_PRO]: createCategory(
    CATEGORY_IDS.M3_M4_PRO,
    'M3 Ultra / M4 Pro',
    'Latest Apple Silicon chips with neural engine.',
    CATEGORY_IDS.APPLE_UNIFIED_MEMORY,
    3,
    BRANCH_COLORS.hardware
  ),

  [CATEGORY_IDS.HIGH_VRAM_CAPACITY]: createCategory(
    CATEGORY_IDS.HIGH_VRAM_CAPACITY,
    'High VRAM Capacity',
    'Up to 512GB unified memory for large models.',
    CATEGORY_IDS.APPLE_UNIFIED_MEMORY,
    3,
    BRANCH_COLORS.hardware
  ),

  [CATEGORY_IDS.BUDGET_SCALABILITY]: createCategory(
    CATEGORY_IDS.BUDGET_SCALABILITY,
    'Budget Scalability',
    'Cost-effective scaling options for different budgets.',
    CATEGORY_IDS.APPLE_UNIFIED_MEMORY,
    3,
    BRANCH_COLORS.hardware
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // LEAF NODES - OPTIMIZATION (Level 3)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.KV_CACHING]: createCategory(
    CATEGORY_IDS.KV_CACHING,
    'KV Caching',
    'Key-Value cache optimization for faster inference.',
    CATEGORY_IDS.OPTIMIZATION_TECHNIQUES,
    3,
    BRANCH_COLORS.hardware
  ),

  [CATEGORY_IDS.MODEL_QUANTIZATION]: createCategory(
    CATEGORY_IDS.MODEL_QUANTIZATION,
    'Model Quantization',
    'Reduce model precision to decrease memory and compute requirements.',
    CATEGORY_IDS.OPTIMIZATION_TECHNIQUES,
    3,
    BRANCH_COLORS.hardware
  ),

  [CATEGORY_IDS.CONTEXT_CACHING]: createCategory(
    CATEGORY_IDS.CONTEXT_CACHING,
    'Context Caching (Gemini API)',
    'Cache conversation context for reduced token usage.',
    CATEGORY_IDS.OPTIMIZATION_TECHNIQUES,
    3,
    BRANCH_COLORS.hardware
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // LEAF NODES - FRONTEND (Level 3)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.NEXTJS_16]: createCategory(
    CATEGORY_IDS.NEXTJS_16,
    'Next.js 16',
    'Latest Next.js with enhanced AI streaming support.',
    CATEGORY_IDS.FRONTEND_EVOLUTION,
    3,
    BRANCH_COLORS.frameworks
  ),

  [CATEGORY_IDS.TANSTACK_START]: createCategory(
    CATEGORY_IDS.TANSTACK_START,
    'TanStack Start',
    'Full-stack meta-framework with AI-optimized patterns.',
    CATEGORY_IDS.FRONTEND_EVOLUTION,
    3,
    BRANCH_COLORS.frameworks
  ),

  [CATEGORY_IDS.REACT_COMPILER]: createCategory(
    CATEGORY_IDS.REACT_COMPILER,
    'React Compiler',
    'Automatic optimization for React applications.',
    CATEGORY_IDS.FRONTEND_EVOLUTION,
    3,
    BRANCH_COLORS.frameworks
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // LEAF NODES - BACKEND (Level 3)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.LARAVEL_WORKFLOWS]: createCategory(
    CATEGORY_IDS.LARAVEL_WORKFLOWS,
    'Laravel (Durable Workflows)',
    'PHP framework with durable workflow support for AI tasks.',
    CATEGORY_IDS.BACKEND_SYSTEMS,
    3,
    BRANCH_COLORS.frameworks
  ),

  [CATEGORY_IDS.RUST_HIGH_THROUGHPUT]: createCategory(
    CATEGORY_IDS.RUST_HIGH_THROUGHPUT,
    'Rust (High Throughput)',
    'Systems programming for performance-critical AI infrastructure.',
    CATEGORY_IDS.BACKEND_SYSTEMS,
    3,
    BRANCH_COLORS.frameworks
  ),

  [CATEGORY_IDS.TYPESCRIPT_STANDARD]: createCategory(
    CATEGORY_IDS.TYPESCRIPT_STANDARD,
    'TypeScript (Industry Standard)',
    'Industry-standard typed JavaScript for AI applications.',
    CATEGORY_IDS.BACKEND_SYSTEMS,
    3,
    BRANCH_COLORS.frameworks
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // LEAF NODES - PRICING (Level 3)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.FLAT_RATE_SUBS]: createCategory(
    CATEGORY_IDS.FLAT_RATE_SUBS,
    'Flat-rate Subscriptions',
    'Fixed monthly pricing for unlimited or high usage.',
    CATEGORY_IDS.PRICING_MODELS,
    3,
    BRANCH_COLORS.economic
  ),

  [CATEGORY_IDS.CREDIT_BASED_USAGE]: createCategory(
    CATEGORY_IDS.CREDIT_BASED_USAGE,
    'Credit-based Usage',
    'Pay-per-use model with prepaid credits.',
    CATEGORY_IDS.PRICING_MODELS,
    3,
    BRANCH_COLORS.economic
  ),

  [CATEGORY_IDS.BYOK_API_KEY]: createCategory(
    CATEGORY_IDS.BYOK_API_KEY,
    'Bring-Your-Own-API-Key',
    'Use your own API keys with tool interfaces.',
    CATEGORY_IDS.PRICING_MODELS,
    3,
    BRANCH_COLORS.economic
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // LEAF NODES - ROI (Level 3)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.PROTOTYPING_SPEED]: createCategory(
    CATEGORY_IDS.PROTOTYPING_SPEED,
    'Prototyping Speed (50-60% reduction)',
    'Dramatically reduced time from idea to working prototype.',
    CATEGORY_IDS.ROI_DRIVERS,
    3,
    BRANCH_COLORS.economic
  ),

  [CATEGORY_IDS.CODE_QUALITY_TESTING]: createCategory(
    CATEGORY_IDS.CODE_QUALITY_TESTING,
    'Code Quality and Testing',
    'Improved code quality through AI-assisted review and testing.',
    CATEGORY_IDS.ROI_DRIVERS,
    3,
    BRANCH_COLORS.economic
  ),

  [CATEGORY_IDS.INFRASTRUCTURE_TCO]: createCategory(
    CATEGORY_IDS.INFRASTRUCTURE_TCO,
    'Lowering Infrastructure TCO',
    'Reduced total cost of ownership through optimization.',
    CATEGORY_IDS.ROI_DRIVERS,
    3,
    BRANCH_COLORS.economic
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // LEAF NODES - COMPLIANCE (Level 3)
  // ═══════════════════════════════════════════════════════════════════════
  [CATEGORY_IDS.SOC2_TYPE_II]: createCategory(
    CATEGORY_IDS.SOC2_TYPE_II,
    'SOC 2 Type II',
    'Service organization control certification for security.',
    CATEGORY_IDS.COMPLIANCE_SECURITY,
    3,
    BRANCH_COLORS.economic
  ),

  [CATEGORY_IDS.ISO_42001]: createCategory(
    CATEGORY_IDS.ISO_42001,
    'ISO 42001',
    'International standard for AI management systems.',
    CATEGORY_IDS.COMPLIANCE_SECURITY,
    3,
    BRANCH_COLORS.economic
  ),

  [CATEGORY_IDS.SELF_HOSTED_PRIVACY]: createCategory(
    CATEGORY_IDS.SELF_HOSTED_PRIVACY,
    'Self-hosted Privacy (Tabnine)',
    'On-premise deployment for maximum data privacy.',
    CATEGORY_IDS.COMPLIANCE_SECURITY,
    3,
    BRANCH_COLORS.economic
  ),
};

// ═══════════════════════════════════════════════════════════════════════════
// BUILD PARENT-CHILD RELATIONSHIPS
// ═══════════════════════════════════════════════════════════════════════════

// Populate children arrays
Object.values(MIND_MAP_CATEGORIES).forEach(category => {
  if (category.parentId) {
    const parent = MIND_MAP_CATEGORIES[category.parentId];
    if (parent && !parent.children.includes(category.id)) {
      parent.children.push(category.id);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTED MIND MAP STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

export const WORKSHOP_MIND_MAP: MindMapStructure = {
  rootId: CATEGORY_IDS.ROOT,
  categories: MIND_MAP_CATEGORIES,
  allCategoryIds: Object.keys(MIND_MAP_CATEGORIES),
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all descendant category IDs for a given category
 */
export function getDescendants(categoryId: string): string[] {
  const category = MIND_MAP_CATEGORIES[categoryId];
  if (!category) return [];

  const descendants: string[] = [];
  const queue = [...category.children];

  while (queue.length > 0) {
    const childId = queue.shift()!;
    descendants.push(childId);

    const child = MIND_MAP_CATEGORIES[childId];
    if (child) {
      queue.push(...child.children);
    }
  }

  return descendants;
}

/**
 * Get the path from root to a category
 */
export function getAncestorPath(categoryId: string): string[] {
  const path: string[] = [];
  let current = MIND_MAP_CATEGORIES[categoryId];

  while (current) {
    path.unshift(current.id);
    if (current.parentId) {
      current = MIND_MAP_CATEGORIES[current.parentId];
    } else {
      break;
    }
  }

  return path;
}

/**
 * Get categories at a specific depth level
 */
export function getCategoriesAtDepth(depth: number): MindMapCategory[] {
  return Object.values(MIND_MAP_CATEGORIES).filter(c => c.depth === depth);
}

/**
 * Search categories by name or description
 */
export function searchCategories(query: string): MindMapCategory[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(MIND_MAP_CATEGORIES).filter(
    c =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.description.toLowerCase().includes(lowerQuery)
  );
}
