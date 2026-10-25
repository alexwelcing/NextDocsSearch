import { describe, expect, it } from 'vitest'
import www from './index'

const hit = (url: string) => www.fetch(new Request(url))

describe('www redirect Worker', () => {
  it('sends www to the apex with path and query kept', () => {
    const res = hit('https://www.alexwelcing.com/articles/the-last-handshake?ref=x')
    expect(res.status).toBe(301)
    expect(res.headers.get('Location')).toBe(
      'https://alexwelcing.com/articles/the-last-handshake?ref=x'
    )
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=63072000')
  })

  it('upgrades plain http and drops any port', () => {
    expect(hit('http://www.alexwelcing.com:8080/').headers.get('Location')).toBe(
      'https://alexwelcing.com/'
    )
  })
})
