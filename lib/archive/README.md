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

`GET /api/arc/archive` retains the dock response `{ records, total }`, cache policy,
field names, description truncation, reading-time fallback, and ordering.
`GET /api/arc/archive?view=full` returns the same envelope with complete records,
including full descriptions, searchText, keywords, domains, mechanics, and hero.
The HTTP source always requests this full view and rejects incomplete payloads.
No raw MDX, author details, or internal manifest filenames are serialized.

`listRecords` sorts newest first and caches successful loads per source instance.
It coalesces concurrent requests and returns an empty list on failure, evicting
failed loads so a missing manifest or failed request can recover. `source.load()`
itself rejects on failure when a caller needs an explicit error. Returned list
arrays can be reordered independently; treat the records themselves as read-only.

`searchRecords` uses Ship-derived lexical weights and stopwords, deduplicates
query terms and result slugs, and returns `{ record, score, snippet }` hits. It
uses slug order to break equal-score/equal-date ties consistently across sources.
It does not perform semantic retrieval.

The existing dock continues fetching the slim view and retains its current search
ranking, cache/retry behavior, and collection predicates. Its index is eagerly
loaded on the landing page; replacing that with the much larger full index would
increase initial transfer for every visit. Migrating dock ranking, hub pages,
article pages, and Ship retrieval remains separate work under #189. Only the slim
type is shared with the dock in this slice.

Run the boundary tests with `pnpm test`; they use fixtures and temporary manifests
without network or generated-data dependencies.
