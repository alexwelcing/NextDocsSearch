# Archive contract (issue #189, first slice)

`ArchiveRecord` is the complete normalized record for lexical search. `ArcRecordSlim`
is a display projection with the dock's existing six fields and 220-character
description. Never cast a slim payload to `ArchiveRecord` or fill missing search
metadata with empty values on the client.

Server consumers use the server entrypoint, which supplies a filesystem source by
default and only reads the generated manifest:

```ts
import { listRecords } from '@/lib/archive/server'
import { searchRecords, toSlim } from '@/lib/archive'

const records = await listRecords()
const hits = searchRecords(records, 'delegation')
const dockRecords = records.map(toSlim)
```

The browser entrypoint has no Node dependencies and requires an explicit source:

```ts
import { HttpIndexSource, listRecords, searchRecords } from '@/lib/archive'

const source = new HttpIndexSource() // reuse the instance to reuse its cached load
const records = await listRecords(source)
const hits = searchRecords(records, 'delegation')
```

The build writes the index as static files (`scripts/generate-archive-index.ts`):
`/arc/archive.json` holds the dock response `{ records, total }` with the slim
field names, description truncation and reading-time fallback, and
`/arc/archive-full.json` the same envelope with complete records, including full
descriptions, searchText, keywords, domains, mechanics, and hero. Both list records
in `archiveOrder` (newest date first, equal dates by slug). `GET /api/arc/archive`
(`?view=full`) remains as an alias serving the same records from a bundled manifest.
The HTTP source fetches its URL verbatim (default `/arc/archive-full.json`) and
rejects incomplete payloads.
No raw MDX, author details, or internal manifest filenames are serialized.

`listRecords` sorts newest first and caches successful loads per source instance.
It coalesces concurrent requests and returns an empty list on failure, evicting
failed loads so a missing manifest or failed request can recover. Interactive
consumers use `listRecords(source, { throwOnError: true })` to distinguish a failed
request from a successful empty index. Both error policies share the same cache.
Returned list arrays can be reordered independently; treat the records themselves
as read-only.

`searchRecords` uses shared lexical weights and English stopwords, deduplicates
query terms and result slugs, and returns `{ record, score, snippet }` hits.
Its vocabulary is `lib/retrieval/tokenize.ts`: text is NFKD-folded with diacritics
stripped, so 'Solène' and 'solene' match alike. Two-character terms such as AI,
VR, and 3D match whole words; longer terms match word prefixes as the user types.
Matches inside unrelated words are excluded. Title phrase bonuses use the same
normalization, so punctuation and repeated terms do not change ranking. Snippets
use matching body text, descriptions, or metadata. Equal scores order by title,
then slug, never by date (the archive's dates are largely diegetic). It ranks only
the manifest's `searchText` preview of each body.

`searchFullText` ranks the same records over the full-text chunk BM25F index
(`public/search/`, built by `scripts/generate-search-index.ts`): each record ranks
by its best chunk, anywhere in the article, and the snippet comes from that chunk.
Record cards also index articleType, mechanics, slug words and the year at a low
weight, so every record `searchRecords` finds on metadata alone is still found.
This engine does not perform semantic retrieval.

The landing-page preload, archive list, and collections keep the compact slim
view. FIND loads the full view only when active, and the full-text index the first
time it opens; it ranks with `searchFullText` once the index is ready and with
`searchRecords` until then or if the index cannot load. Its stable source reuses
successful and in-flight loads across tab visits. It shows loading, failure/retry, and empty-index
states separately from no matching results, and previews the selected hit's
excerpt. Native touch input and desktop typing share the same query; numeric
queries do not trigger dock tab shortcuts. Hub-page, article-page, and Ship
retrieval migrations remain separate work under #189.

Run the boundary and FIND interaction tests with `pnpm test`; they use fixtures,
temporary manifests, and a simulated browser without network or generated-data
dependencies.
