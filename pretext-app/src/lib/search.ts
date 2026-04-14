import FlexSearch from 'flexsearch'

type SearchDoc = {
  slug: string
  title: string
  description: string
  keywords: string[]
  body: string
}

export class OfflineSearch {
  private index = new FlexSearch.Index({ tokenize: 'forward', cache: true, resolution: 9 })
  private docs: SearchDoc[] = []

  hydrate(docs: SearchDoc[]) {
    this.docs = docs
    docs.forEach((doc, idx) => {
      this.index.add(idx, `${doc.title} ${doc.description} ${doc.keywords.join(' ')} ${doc.body}`)
    })
  }

  query(term: string) {
    if (!term.trim()) return []
    const ids = this.index.search(term, { limit: 40 }) as number[]
    return ids.map((id) => this.docs[id]).filter(Boolean)
  }
}
