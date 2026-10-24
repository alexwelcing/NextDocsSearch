import { describe, expect, it } from 'vitest'
import { detectProfileIntent as archiveDetectProfileIntent } from '../chat/archiveQuery'
import { PROFILE_SLUG, detectProfileIntent } from './profile'

describe('detectProfileIntent', () => {
  it.each([
    'who is alex',
    'Who are you?',
    'what do you do',
    'where is alex based',
    'tell me about yourself',
    "what's this site for",
    'what is alex welcing',
    'quantum key distribution',
    'alex wrote about agents',
    '',
  ])('matches the lib/chat/archiveQuery copy for %j', (query) => {
    expect(detectProfileIntent(query)).toBe(archiveDetectProfileIntent(query))
  })
})

it('pulls profile facts from the about operator doc', () => {
  expect(PROFILE_SLUG).toBe('about')
})
