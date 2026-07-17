import { describe, expect, it } from 'vitest'
import { emptyBuild, emptyTree } from '../model/types'
import { fixtureData } from './fixtures'
import { recommendForSlot, scoreRootForSlot } from './recommend'

const data = fixtureData()

describe('scoreRootForSlot', () => {
  it('active slots feed the trainee; deep slots feed their child ancestor', () => {
    expect(scoreRootForSlot(1)).toBe(0)
    expect(scoreRootForSlot(6)).toBe(0)
    expect(scoreRootForSlot(7)).toBe(3)
    expect(scoreRootForSlot(30)).toBe(14)
  })
})

describe('recommendForSlot', () => {
  it('ranks the roster by affinity delta for a parent slot', () => {
    const tree = emptyTree()
    tree.slots[0] = emptyBuild(101) // trainee = chara 1

    const recs = recommendForSlot(tree, 1, data)
    // Chara 1 excluded (cannot be her own parent); chara 5 has no Global variant.
    expect(recs.map((r) => r.charaId)).toEqual([2, 3, 4])
    expect(recs[0]).toMatchObject({ charaId: 2, delta: 100, total: 100 })
    expect(recs[1]).toMatchObject({ charaId: 3, delta: 60 })
  })

  it('includes non-Global characters only when asked', () => {
    const tree = emptyTree()
    tree.slots[0] = emptyBuild(101)
    const recs = recommendForSlot(tree, 1, data, { globalOnly: false })
    expect(recs.map((r) => r.charaId)).toContain(5)
  })

  it('ranks deep slots against their subtree root', () => {
    const tree = emptyTree()
    tree.slots[0] = emptyBuild(101)
    tree.slots[3] = emptyBuild(401) // chara 4; slot 7 parents her

    const recs = recommendForSlot(tree, 7, data)
    expect(recs.map((r) => r.charaId)).toEqual([2, 1, 3]) // pair(4,·) = 25, 20, 15
    expect(recs.map((r) => r.charaId)).not.toContain(4) // own-parent rule
  })

  it('handles an empty tree without crashing', () => {
    const recs = recommendForSlot(emptyTree(), 1, data)
    expect(recs.length).toBeGreaterThan(0)
    expect(recs.every((r) => r.delta === 0)).toBe(true)
  })

  it('honors the limit option', () => {
    const tree = emptyTree()
    tree.slots[0] = emptyBuild(101)
    expect(recommendForSlot(tree, 1, data, { limit: 2 })).toHaveLength(2)
  })
})
