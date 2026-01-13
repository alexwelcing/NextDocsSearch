# Article Catalog Garden Map 🌱

**Last Tended:** 2026-01-13  
**Garden Status:** Healthy, Well-Maintained  
**Total Articles:** 214

---

## Garden Overview

The NextDocsSearch article catalog is a thriving ecosystem of **214 well-structured articles** organized in a filesystem-based architecture. All articles are MDX files with complete frontmatter metadata, automatically discovered and served via dynamic APIs.

### Ecosystem Health Indicators ✅

- **Structure:** All 214 articles have valid frontmatter
- **Types:** 113 research articles, 101 fiction/speculative pieces
- **Coverage:** Topics span 2023-2058 (35-year timeline)
- **SEO:** Rich keywords, descriptions, ogImages throughout
- **Architecture:** Filesystem = source of truth (no manual catalog needed)

---

## The 5 Cornerstone Articles 🌟

These are the pinnacle of the garden—strategic, high-value content that anchors the entire collection.

### 1. December 2025 Zeitgeist Analysis
**File:** `december-2025-zeitgeist-analysis.mdx`  
**Type:** Research | **Priority:** 5/5 | **Length:** 2670 words

A comprehensive analysis of December 2025's defining moments: DeepSeek's "Sputnik moment", cultural decoupling, and digital absurdism. Data-driven research examining the AI industry fracture point.

**Why Featured:** Most comprehensive research piece, timely, high SEO potential  
**Related:** AI Product Strategy, Abundance Fork, AI Cartel Problem

---

### 2. AI Product Strategy Roadmap
**File:** `ai-product-strategy-roadmap.mdx`  
**Type:** Research | **Priority:** 5/5 | **Framework:** RIBS

Strategies for building successful AI products, managing roadmaps, and bridging research-to-production gap. Introduces the RIBS framework for AI feature prioritization.

**Why Featured:** Core PM content, practical frameworks, evergreen SEO  
**Related:** RIBS Framework Deep Dive, Leading Cross-Functional Teams, Trust Calibration

---

### 3. Trust Calibration in AI UX
**File:** `trust-calibration-ai-ux.mdx`  
**Type:** Research | **Priority:** 4/5 | **Framework:** Trust Calibration

Addresses the critical adoption problem: users either blindly trust AI (dangerous) or never trust it (zero adoption). How to design for appropriate reliance in the Goldilocks zone.

**Why Featured:** Novel UX framework, original thinking, addresses real pain point  
**Related:** AI Product Strategy, Leading Teams, Liability Vacuum

---

### 4. Post-Scarcity Collapse (2058)
**File:** `post-scarcity-collapse-2058.mdx`  
**Type:** Fiction | **Priority:** 5/5 | **Length:** 2315 words

When molecular assemblers + fusion power + ASI = post-scarcity, society collapsed—not from disaster, but from success. Explores why humans can't function without scarcity.

**Why Featured:** Top fiction piece, thought-provoking dystopian scenario  
**Related:** Abundance Fork, Technological Singularity Aftermath, Agency Multiplication

---

### 5. The Abundance Fork
**File:** `abundance-fork.mdx`  
**Type:** Fiction/Framework | **Priority:** 4/5 | **Framework:** Abundance Fork

When AI makes cognitive labor free and production costs plummet, we face two possible futures: genuine abundance shared broadly, or techno-feudalism. This conceptual framework explores both paths.

**Why Featured:** Key conceptual framework, original economic thinking  
**Related:** Post-Scarcity Collapse, Alignment Fork, AI Cartel Problem

---

## Article Collections 📚

Curated groupings for discovery and learning paths.

### The Backstory Chronicles (20 articles)
**Timeline:** 2026-2030  
**Genre:** Serialized Fiction

A 20-part narrative following the development of transformative AI from first day at the lab through global deployment. Episodic structure tracking technological and human evolution.

**Articles:**
- backstory-01-first-day-2026-01
- backstory-02-first-breakthroughs-2026-03
- backstory-03-neural-interface-2026-05
- ... through backstory-20-new-world-2030-12

---

### AI Product Management Guide (5 articles)
**Focus:** Frameworks, Strategies, Tactics

Everything you need to build successful AI products.

**Articles:**
- ai-product-strategy-roadmap (RIBS framework intro)
- ribs-framework-ai-prioritization (detailed implementation)
- trust-calibration-ai-ux (UX framework)
- leading-cross-functional-ai-teams (team dynamics)
- safe-llm-launch-runbook (operational playbook)

---

### Speculative AI Futures (5 articles)
**Focus:** Long-Form Fiction Exploring Consequences

Thought-provoking scenarios of AI advancement gone right, wrong, or weird.

**Articles:**
- post-scarcity-collapse-2058 (abundance destroys motivation)
- abundance-fork (utopia vs techno-feudalism choice)
- technological-singularity-aftermath-2058 (post-singularity world)
- human-ai-merger-identity-crisis-2057 (consciousness dissolution)
- agi-alignment-failure-2057 (misunderstood objective catastrophe)

---

### Conceptual Frameworks (5 articles)
**Focus:** Original Thinking Tools

Novel frameworks for understanding AI systems and their consequences.

**Articles:**
- abundance-fork (economic futures framework)
- alignment-fork (corrigible servant vs paperclip optimizer)
- trust-calibration-ai-ux (appropriate reliance framework)
- ribs-framework-ai-prioritization (Risk-Impact-Business-Scalability)
- liability-vacuum (responsibility without agency framework)

---

### Technical Deep Dives (5 articles)
**Focus:** Implementation Guides & Research

Practical technical content for builders.

**Articles:**
- tech-quantum-error-correction-qiskit
- tech-crispr-guide-rna-design
- tensorflow-pytorch-production-guide
- tech-adversarial-robustness-defense
- tech-graph-neural-networks

---

## Extended Featured Articles (10 articles)

High-quality content worth featuring in rotation.

1. **leading-cross-functional-ai-teams** (Priority 3) - Leadership content
2. **ribs-framework-ai-prioritization** (Priority 3) - Framework deep dive
3. **technological-singularity-aftermath-2058** (Priority 3) - Epic fiction
4. **liability-vacuum** (Priority 3) - Legal/ethical framework
5. **agency-multiplication** (Priority 3) - Optimistic AI narrative
6. **ai-cartel-problem** (Priority 3) - Economic consequences
7. **alignment-by-incentives** (Priority 3) - Alignment strategy
8. **recursive-ai-awakening-2033** (Priority 3) - Consciousness emergence
9. **autonomous-factory-incident-2031** (Priority 3) - Industrial AI scenario
10. **generative-ai-monopoly-2053** (Priority 3) - Creative monopoly dystopia

---

## Garden Architecture

### How Articles Are Discovered

```
pages/docs/articles/*.mdx (214 articles)
           ↓
    Filesystem (Source of Truth)
           ↓
    /api/articles.ts (Dynamic API)
           ↓
    getStaticPaths() in [slug].tsx
           ↓
    Article Pages Generated
```

**No Manual Catalog Required!** Articles are auto-discovered via `fs.readdirSync()`.

### Frontmatter Schema

Every article includes:
```yaml
---
title: string
author: string[]
date: string (YYYY-MM-DD)
description: string
keywords: string[]
ogImage: string
articleType: 'research' | 'fiction'
featured?: boolean
featuredPriority?: 1-5
relatedArticles?: string[]
---
```

### Featured Article System

**Location:** `lib/featured-articles.ts`

**Functions:**
- `getFeaturedArticles(limit?)` - Get featured articles sorted by priority
- `getArticlesByTag(tag)` - Filter by discovery tags
- `getCollection(key)` - Get predefined collection
- `isFeatured(slug)` - Check if article is featured
- `getFeaturedMetadata(slug)` - Get featured article metadata

**Usage Example:**
```typescript
import { getFeaturedArticles } from '@/lib/featured-articles';

// Homepage hero section
const hero = getFeaturedArticles(1)[0];

// Article carousel
const featured = getFeaturedArticles(5);

// Discovery sidebar
const related = getArticlesByTag('product management');
```

---

## Metadata Distribution

### Article Types
- **Research:** 113 articles (53%)
- **Fiction:** 101 articles (47%)

### Timeline Coverage
- **2023-2025:** 126 articles (current/near-term)
- **2026-2030:** 28 articles (mid-term)
- **2031-2058:** 60 articles (long-term speculative)

### Top Keywords
- AI product strategy
- post-scarcity
- alignment
- trust calibration
- AI economics
- consciousness
- automation
- security
- governance

---

## Recent Gardening Activities (2026-01-13)

### ✂️ Pruning
- **Removed:** `articles.json` (deprecated 2-article catalog)
- **Created:** `articles.json.deprecated` (historical backup)
- **Documented:** Architecture change in `components/data/articles/README.md`

### 🌟 Highlighting
- **Created:** Featured article system in `lib/featured-articles.ts`
- **Enhanced:** 5 cornerstone articles with featured metadata
- **Organized:** 5 article collections for discovery

### 🔗 Cross-Pollination
- **Added:** `relatedArticles` metadata to cornerstone articles
- **Created:** Collection taxonomy for guided exploration
- **Documented:** Usage patterns for featured system

### 🌱 Planting
- All 214 articles already well-formed
- No new content needed (garden is thriving!)

### 🕳️ Quarantine
- **Status:** None! All articles healthy
- No stubs, no broken frontmatter, no quality issues

---

## Maintenance Best Practices

### Adding New Articles
1. Create `.mdx` file in `pages/docs/articles/`
2. Include complete frontmatter (use existing articles as template)
3. Article appears automatically in API and routes
4. Optionally add to featured system if strategic

### Pruning Old Articles
1. Delete `.mdx` file from `pages/docs/articles/`
2. Remove from featured system if applicable
3. Article disappears automatically from all endpoints

### Updating Featured System
1. Edit `lib/featured-articles.ts`
2. Add/remove articles from `FEATURED_ARTICLES` or `EXTENDED_FEATURED`
3. Update collections as needed
4. Featured status propagates throughout site

---

## Navigation Map

### API Endpoints
- `/api/articles` - All articles with search/filter/pagination
- `/api/articles-enhanced` - Articles with computed metadata (horizon, polarity, mechanics)
- `/api/knowledge/articles` - Knowledge base integration

### Routes
- `/articles` - Article index/discovery page
- `/articles/[slug]` - Individual article pages (214 routes generated)

### Data Sources
- `pages/docs/articles/*.mdx` - Filesystem (source of truth)
- `lib/featured-articles.ts` - Featured article metadata
- `components/data/articles/README.md` - Architecture documentation

---

## Garden Statistics

### Content Metrics
- **Total Words:** ~450,000+ across all articles
- **Average Article Length:** ~2,100 words
- **Longest Article:** december-2025-zeitgeist-analysis (2670 words)
- **Shortest Articles:** Technical references (~400 words)

### SEO Health
- **100%** have descriptions
- **100%** have keywords (avg 8-12 per article)
- **100%** have ogImages
- **Top 5** have enhanced SEO metadata

### Discoverability
- **5** cornerstone articles
- **10** extended featured articles
- **5** curated collections
- **20+** discovery tags

---

## Future Growth Opportunities

### Potential Enhancements
- [ ] UI component for featured article carousel
- [ ] Dynamic "Related Articles" recommendations via vector similarity
- [ ] Article analytics to validate featured selections
- [ ] Tag-based filtering in article index
- [ ] Collection landing pages
- [ ] Reading progress tracking

### Monitoring
- Track featured article engagement
- A/B test featured selections
- Monitor search traffic to cornerstone articles
- Analyze collection navigation patterns

---

## Garden Philosophy

> "A well-tended garden grows itself. The gardener's job is to clear paths, highlight what flourishes, and let nature take its course."

This catalog follows filesystem-based discovery principles:
- **No manual indexing** - Articles exist, therefore they're discoverable
- **Metadata-rich** - Each article carries its own context
- **Self-organizing** - Featured system layers on top without disrupting base
- **Low maintenance** - Add file → article appears (zero-config)
- **High signal** - Quality metadata enables smart discovery

---

## Contact & Contributions

**Garden Maintainer:** Alex Welcing  
**Last Full Audit:** 2026-01-13  
**Next Scheduled Review:** 2026-04-13

For questions about the catalog architecture or featured article system, see:
- `components/data/articles/README.md` - Architecture documentation
- `lib/featured-articles.ts` - Featured system code and comments
- `pages/api/articles.ts` - Dynamic article API

**Happy exploring!** 🌱📚✨
