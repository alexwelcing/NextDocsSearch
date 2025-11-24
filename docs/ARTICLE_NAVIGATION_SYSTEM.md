# Article Navigation System - Documentation

## Overview

The article navigation system has been significantly enhanced to handle the growing number of articles (168+) with improved browsing, filtering, searching, and knowledge graph navigation capabilities.

## Components

### 1. ArticleBrowser

**Location:** `components/ArticleBrowser.tsx`

**Purpose:** Provides advanced article browsing with pagination, search, filtering, and multiple view modes.

**Features:**
- **Pagination:** 12 articles per page (configurable)
- **Search:** Filter by title, author, or keywords
- **Filters:**
  - Author dropdown (all unique authors)
  - Year dropdown (all available years)
  - Sort by: Date (newest/oldest), Title (A-Z/Z-A)
- **View Modes:**
  - Grid view (cards in responsive grid)
  - List view (compact rows)
- **Responsive Design:** Adapts to mobile and desktop
- **Empty States:** Helpful messages when no articles match filters

**Usage:**
```tsx
import ArticleBrowser from '@/components/ArticleBrowser';

<ArticleBrowser
  articles={articles}
  onArticleSelect={(article, index) => {
    // Handle article selection
  }}
  itemsPerPage={12}
/>
```

**Props:**
```typescript
interface ArticleBrowserProps {
  articles: ArticleData[];
  onArticleSelect?: (article: ArticleData, index: number) => void;
  itemsPerPage?: number; // Default: 12
}
```

---

### 2. KnowledgeGraph

**Location:** `components/KnowledgeGraph.tsx`

**Purpose:** Visual knowledge graph for navigating R3F topics and their relationships.

**Features:**
- **Category Organization:** Topics grouped by category (Core, Hooks, Components, etc.)
- **Subcategory Grouping:** Topics within categories grouped by subcategory
- **Difficulty Filtering:** Filter by beginner, intermediate, advanced, expert
- **Search:** Real-time search across topics, keywords, and subcategories
- **Expand/Collapse:** Individual categories or all at once
- **Visual Indicators:**
  - 🟢 Beginner | 🔵 Intermediate | 🟡 Advanced | 🔴 Expert
  - SEO badge for high-value topics (SEO score ≥ 8)
- **Statistics:** Shows total topics and filtered count

**Usage:**
```tsx
import KnowledgeGraph from '@/components/KnowledgeGraph';

<KnowledgeGraph
  selectedTopic={selectedTopic}
  onTopicSelect={(topic) => {
    // Handle topic selection
  }}
/>
```

**Props:**
```typescript
interface KnowledgeGraphProps {
  onTopicSelect?: (topic: R3FTopic) => void;
  selectedTopic?: R3FTopic | null;
}
```

---

### 3. RelatedArticles

**Location:** `components/RelatedArticles.tsx`

**Purpose:** Display articles related to the current article based on multiple similarity criteria.

**Features:**
- **Smart Scoring Algorithm:**
  - Shared authors: 3 points each
  - Shared keywords: 2 points each
  - Same category: 2 points
  - Same year: 1 point, same month: +1 point
  - Shared title words (>3 chars): 1 point each
- **Relevance Badges:**
  - Highly Related (score ≥ 8)
  - Related (score ≥ 4)
  - Possibly Related (score < 4)
- **Configurable Limit:** Default 5 results, adjustable
- **Empty State:** Helpful message when no related articles found

**Usage:**
```tsx
import RelatedArticles from '@/components/RelatedArticles';

<RelatedArticles
  currentArticle={article}
  allArticles={articles}
  onArticleSelect={(article, index) => {
    // Handle related article selection
  }}
  maxResults={5}
/>
```

**Props:**
```typescript
interface RelatedArticlesProps {
  currentArticle: ArticleData;
  allArticles: ArticleData[];
  maxResults?: number; // Default: 5
  onArticleSelect?: (article: ArticleData, index: number) => void;
}
```

---

## API Endpoints

### 1. GET /api/articles

**Purpose:** Fetch articles with pagination, filtering, and sorting.

**Query Parameters:**
- `page` (optional): Page number (1-indexed)
- `perPage` (optional): Items per page (1-100)
- `search` (optional): Search query (title, author, keywords)
- `author` (optional): Filter by specific author
- `year` (optional): Filter by publication year
- `sortBy` (optional): `date` | `title` | `author` (default: `date`)
- `sortOrder` (optional): `asc` | `desc` (default: `desc`)

**Response (with pagination):**
```typescript
{
  articles: ArticleData[],
  total: number,
  page: number,
  perPage: number,
  totalPages: number
}
```

**Response (without pagination - backward compatible):**
```typescript
ArticleData[]
```

**Example Usage:**
```typescript
// Paginated
const response = await fetch('/api/articles?page=1&perPage=12&sortBy=date&sortOrder=desc');

// With filters
const response = await fetch('/api/articles?search=AI&author=Team&year=2024');

// Legacy (all articles)
const response = await fetch('/api/articles');
```

---

### 2. GET /api/articles/related

**Purpose:** Find articles related to a specific article.

**Query Parameters:**
- `filename` (required): Filename of the target article (e.g., `my-article.mdx`)
- `limit` (optional): Maximum number of related articles to return (default: 5)

**Response:**
```typescript
Array<{
  article: ArticleData,
  score: number
}>
```

**Example Usage:**
```typescript
const response = await fetch('/api/articles/related?filename=agi-alignment-failure-2057.mdx&limit=5');
const relatedArticles = await response.json();

// Sort by relevance (already sorted by API)
relatedArticles.forEach(({ article, score }) => {
  console.log(`${article.title} - Relevance: ${score}`);
});
```

**Error Responses:**
- `400 Bad Request`: Missing or invalid filename
- `404 Not Found`: Article not found

---

### 3. GET /api/knowledge/graph

**Purpose:** Retrieve knowledge graph data with topic relationships.

**Query Parameters:**
- `category` (optional): Filter by category (e.g., "Core Concepts", "Hooks & APIs")
- `difficulty` (optional): Filter by difficulty (`beginner` | `intermediate` | `advanced` | `expert`)

**Response:**
```typescript
{
  nodes: TopicNode[],
  edges: TopicEdge[],
  categories: typeof R3F_CATEGORIES,
  stats: {
    totalTopics: number,
    totalCategories: number,
    avgSeoValue: number,
    difficultyDistribution: Record<Difficulty, number>
  }
}
```

**Edge Relationships:**
- `category`: Topics in the same category
- `keyword`: Topics with shared keywords
- `difficulty`: Topics at the same difficulty level
- `prerequisite`: Prerequisite relationships (beginner → intermediate → advanced → expert)

**Example Usage:**
```typescript
// All topics
const response = await fetch('/api/knowledge/graph');
const graph = await response.json();

// Filtered by category
const response = await fetch('/api/knowledge/graph?category=Core%20Concepts');

// Filtered by difficulty
const response = await fetch('/api/knowledge/graph?difficulty=beginner');

// Visualize graph
graph.nodes.forEach(node => {
  console.log(`${node.title} - ${node.difficulty}`);
});

graph.edges.forEach(edge => {
  console.log(`${edge.source} → ${edge.target} (${edge.relationship})`);
});
```

---

## Integration in TerminalInterface

The TerminalInterface component has been updated to integrate all new features:

### New Tab: "GRAPH"

- Located between "ARTICLES" and "QUIZ" tabs
- Displays the KnowledgeGraph component
- Allows topic exploration and navigation
- Requires "articles" feature to be unlocked (same as ARTICLES tab)

### Updated "ARTICLES" Tab

**Two Modes:**

1. **Browse Mode (default):**
   - Shows ArticleBrowser with all articles
   - Pagination, search, filtering, sorting
   - Grid/List view toggle
   - Click article to view details

2. **Detail Mode:**
   - Shows selected article information
   - "Back to List" button
   - "Read Full Article" button (opens in new tab)
   - Related Articles section below

**Navigation Flow:**
```
Articles Tab → ArticleBrowser → Select Article → Detail View
                                                      ↓
                                              Related Articles
                                                      ↓
                                              Select Related → Detail View (loop)
```

### ESC Key Behavior

Enhanced ESC key handling:
1. If in article detail view: Return to browse mode
2. If in browse mode: Close terminal

---

## Data Types

### ArticleData

```typescript
interface ArticleData {
  title: string;
  date: string;
  author: string[];
  filename?: string;
  length?: number;
  category?: string;
  keywords?: string[];
}
```

### R3FTopic

```typescript
interface R3FTopic {
  id: string;
  category: string;
  subcategory: string;
  title: string;
  keywords: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  seoValue: number; // 1-10 rating
}
```

---

## Performance Considerations

### ArticleBrowser
- Uses `useMemo` for expensive filtering/sorting operations
- Only renders visible articles (pagination)
- Efficient re-renders on filter changes
- Responsive grid uses CSS (no JS calculations)

### KnowledgeGraph
- Category expansion controlled by Set (O(1) lookup)
- Topics filtered once using `useMemo`
- No re-renders when expanding/collapsing categories

### RelatedArticles
- Score calculation cached with `useMemo`
- Only calculates when article changes
- Limits results to prevent overwhelming UI

### API Performance
- `/api/articles`: O(n log n) for sorting, O(n) for filtering
- `/api/articles/related`: O(n²) worst case for similarity, but limited by small article counts
- `/api/knowledge/graph`: O(n²) for edge generation, but topics are small dataset (~100)

---

## Future Enhancements

### Potential Improvements
1. **Graph Visualization:** D3.js or similar for visual knowledge graph
2. **Article Tagging:** Add topic tags to articles for better knowledge graph integration
3. **Reading Progress:** Track which articles user has read
4. **Bookmarks:** Allow users to bookmark articles
5. **Advanced Search:** Full-text search with highlighting
6. **Recommendations:** ML-based article recommendations
7. **Export:** Export article lists or knowledge graph as JSON/PDF

### Compatibility with Ancillary Branch
The system is designed to be:
- **Backward compatible:** Old article list still works
- **Additive:** New features don't break existing functionality
- **Extensible:** Easy to add new filters, sorting options, or relationship types
- **Modular:** Components can be used independently

---

## Troubleshooting

### Articles not loading
- Check `/api/articles` endpoint is accessible
- Verify `pages/docs/articles/` directory exists and contains .mdx files
- Check browser console for errors

### Filters not working
- Ensure article metadata includes required fields (author, date)
- Check that articles have proper frontmatter in .mdx files

### Knowledge graph empty
- Verify `lib/knowledge/r3f-taxonomy.ts` is properly imported
- Check that R3F_KNOWLEDGE_INDEX is populated
- Ensure category filtering is not too restrictive

### Related articles not showing
- Check that articles have shared authors, keywords, or categories
- Lower relevance threshold if no articles appear
- Ensure at least 2 articles exist for comparison

---

## Testing

### Manual Testing Checklist
- [ ] ArticleBrowser pagination works
- [ ] Search filters articles correctly
- [ ] Author and year filters work
- [ ] Sort by date ascending/descending works
- [ ] Sort by title ascending/descending works
- [ ] Grid/List view toggle works
- [ ] Knowledge graph categories expand/collapse
- [ ] Difficulty filter works in knowledge graph
- [ ] Topic selection highlights in graph
- [ ] Related articles show for selected article
- [ ] Related articles are relevant (check scores)
- [ ] Navigation between articles works
- [ ] ESC key closes terminal/returns to list
- [ ] Mobile responsive layout works

### API Testing
```bash
# Test articles endpoint
curl "http://localhost:3000/api/articles"
curl "http://localhost:3000/api/articles?page=1&perPage=10"
curl "http://localhost:3000/api/articles?search=AI"

# Test related articles
curl "http://localhost:3000/api/articles/related?filename=some-article.mdx"

# Test knowledge graph
curl "http://localhost:3000/api/knowledge/graph"
curl "http://localhost:3000/api/knowledge/graph?category=Core%20Concepts"
```

---

## Support

For issues or questions:
1. Check this documentation
2. Review component source code
3. Check browser console for errors
4. Verify API responses in Network tab
5. Create GitHub issue with details

---

**Last Updated:** 2024-11-24
**Version:** 1.0.0
**Author:** GitHub Copilot
