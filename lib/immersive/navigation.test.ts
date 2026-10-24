import { describe, expect, it } from 'vitest'
import { routeToState, worldFromQuery } from './navigation'

describe('worldFromQuery', () => {
  it('reads a registered world id from a bare search string or a full asPath', () => {
    expect(worldFromQuery('?world=ember')).toBe('ember')
    expect(worldFromQuery('/articles/abundance-fork?world=night-train#top')).toBe('night-train')
    expect(worldFromQuery('/?utm_source=x&world=the-overlook')).toBe('the-overlook')
  })

  it('ignores unknown ids, empty values and the hash', () => {
    expect(worldFromQuery('?world=not-a-world')).toBeUndefined()
    expect(worldFromQuery('?world=')).toBeUndefined()
    expect(worldFromQuery('/#?world=ember')).toBeUndefined()
    expect(worldFromQuery('/')).toBeUndefined()
    expect(worldFromQuery('')).toBeUndefined()
  })
})

describe('routeToState', () => {
  it('keeps the modal mapping and adds a valid ?world=', () => {
    expect(routeToState('/articles/abundance-fork?world=ember')).toEqual({
      modal: { type: 'article', slug: 'abundance-fork' },
      world: 'ember',
    })
    expect(routeToState('/?world=verdant')).toEqual({ modal: null, world: 'verdant' })
    expect(routeToState('/articles?world=meridian')).toEqual({
      modal: null,
      dockTab: 'archive',
      world: 'meridian',
    })
  })

  it('omits world when the query has none (or an unknown one)', () => {
    expect(routeToState('/about')).toEqual({ modal: { type: 'data', panel: 'about' } })
    expect(routeToState('/videos/some-film?world=nope')).toEqual({
      modal: { type: 'video', slug: 'some-film' },
    })
  })
})
