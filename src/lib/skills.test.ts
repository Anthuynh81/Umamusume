import { describe, expect, it } from 'vitest'
import { fixtureData } from '../engine/fixtures'
import type { LibraryUma } from '../model/library'
import { bestHeldTier, heldSkillsOf } from './skills'

const data = fixtureData()

function uma(partial: Partial<LibraryUma>): LibraryUma {
  return {
    name: 'Test', build: null as never, score: null, rank: null, skillIds: [],
    trainedAt: null, tags: [], owned: true, loopIds: [],
    createdAt: '', updatedAt: '', ...partial,
  }
}

describe('heldSkillsOf', () => {
  it('prefers heldSkills with levels', () => {
    const u = uma({ skillIds: [1], heldSkills: [{ id: 2003421, level: 2 }] })
    expect(heldSkillsOf(u)).toEqual([{ id: 2003421, level: 2 }])
  })

  it('falls back to legacy skillIds at level 1', () => {
    const u = uma({ skillIds: [2003422] })
    expect(heldSkillsOf(u)).toEqual([{ id: 2003422, level: 1 }])
  })
})

describe('bestHeldTier', () => {
  it('maps a held skill to its spark factor tier', () => {
    expect(bestHeldTier([{ id: 2003422, level: 1 }], 200342, data)).toBe('normal')
    expect(bestHeldTier([{ id: 2003423, level: 1 }], 200342, data)).toBe('circle')
  })

  it('picks the best version when several are held', () => {
    const held = [
      { id: 2003422, level: 1 },
      { id: 2003421, level: 2 }, // gold
    ]
    expect(bestHeldTier(held, 200342, data)).toBe('gold')
  })

  it('returns null when no version of the group is held', () => {
    expect(bestHeldTier([{ id: 9101, level: 1 }], 200342, data)).toBeNull()
    expect(bestHeldTier([], 200342, data)).toBeNull()
  })
})
