import { detectProfileIntent, queryLocalArchive, resetArchiveDocumentCache } from '@/lib/chat/archiveQuery'

describe('archiveQuery', () => {
  beforeEach(() => {
    resetArchiveDocumentCache()
  })

  it('detects profile intent for first-person bio questions', () => {
    expect(detectProfileIntent('Where do you live?')).toBe(true)
    expect(detectProfileIntent('What do you do for work?')).toBe(true)
    expect(detectProfileIntent('How does RAG work here?')).toBe(false)
  })

  it('surfaces New York profile evidence for location questions', async () => {
    const result = await queryLocalArchive('Where do you live?')

    expect(result.profileIntent).toBe(true)
    expect(result.profileFacts.some((fact) => /new york/i.test(fact))).toBe(true)
  })

  it('surfaces work and purpose evidence for identity questions', async () => {
    const result = await queryLocalArchive('What do you do and what is your purpose?')
    const combined = `${result.profileFacts.join(' ')} ${result.context}`

    expect(/senior ai product manager|writer, technologist, and designer|regulated industries/i.test(combined)).toBe(true)
    expect(/work explores|pass compliance review|legal tech|healthcare|consulting/i.test(combined)).toBe(true)
  })
})