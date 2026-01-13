# Articles Data Directory

## Architecture Change (January 2026)

This directory previously contained `articles.json` - a manual catalog of 2 articles that was deprecated and no longer used by the application.

### Current Architecture (Dynamic, Filesystem-Based)

The modern NextDocsSearch architecture reads articles **directly from the filesystem** at build time and runtime:

- **Source of Truth**: `pages/docs/articles/*.mdx` (214 articles)
- **API Endpoint**: `/api/articles.ts` - Dynamically serves all articles with search, filter, pagination
- **Routing**: `/articles/[slug].tsx` - Uses `getStaticPaths` to generate routes from filesystem
- **No Manual Catalog Required**: Articles are auto-discovered via `fs.readdirSync()`

### Why This Is Better

1. **Single Source of Truth**: Filesystem = catalog (no sync issues)
2. **Zero Maintenance**: Add `.mdx` → article appears automatically
3. **Scalable**: Handles 214+ articles without manual JSON editing
4. **Rich Metadata**: Frontmatter contains all needed data (title, author, date, description, keywords, ogImage, articleType)
5. **Type-Safe**: TypeScript interfaces enforce structure via gray-matter parsing

### Historical Context

`articles.json` (deprecated 2026-01-13):
- Contained only 2 manually-cataloged articles
- Not referenced by any active code
- Replaced by filesystem-based discovery

If you need to query articles, use:
- `/api/articles` - Returns all articles with optional filters
- `/api/articles-enhanced` - Returns articles with computed metadata (horizon, polarity, mechanics)

### Migration Path

**Old Way (Deprecated)**:
```typescript
import articles from '@/components/data/articles/articles.json'
```

**New Way (Current)**:
```typescript
// In API routes or getStaticProps
const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
const filenames = fs.readdirSync(articleFolderPath);
const articlesData = filenames.map(filename => {
  const { data } = matter(fs.readFileSync(path.join(articleFolderPath, filename), 'utf8'));
  return {
    slug: filename.replace('.mdx', ''),
    title: data.title,
    date: data.date,
    // ... etc
  };
});
```

### Directory Contents

- `README.md` (this file) - Architecture documentation
- `articles.json.deprecated` - Historical artifact (2 articles from legacy system)

**No other files needed.** Articles live in `pages/docs/articles/`.
