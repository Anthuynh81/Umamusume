import { describe, expect, it } from 'vitest'
import { emptyBuild, emptyTree } from '../model/types'
import { affinityBreakdown } from './affinity'
import { fixtureData } from './fixtures'
import { optimizeArrangements } from './optimizer'
import type { OptimizerCandidate } from './optimizer'

const data = fixtureData()

/** Library: charas 2,3,4,5 plus TWO copies of the trainee's chara 1. */
function library(): OptimizerCandidate[] {
  return [
    { id: 11, variantId: 201, name: 'Bravo (trained)', wonRaces: [1101, 1105] },
    { id: 12, variantId: 301, name: 'Charlie (trained)', wonRaces: [] },
    { id: 13, variantId: 401, name: 'Delta (trained)', wonRaces: [1101] },
    { id: 14, variantId: 501, name: 'Echo (trained)', wonRaces: [] },
    { id: 15, variantId: 102, name: 'Alfa alt (trained)', wonRaces: [] },
    { id: 16, variantId: 101, name: 'Alfa (trained)', wonRaces: [] },
  ]
}

describe('optimizeArrangements', () => {
  it('finds the best arrangement (hand-verified)', () => {
    const [best] = optimizeArrangements(1, library(), data, { limit: 1 })
    expect(best).toBeDefined()
    // Parents chara 2 + chara 3; Delta (trio 12 + shared Japan Cup +1) under
    // Bravo; Echo (trio 8) under Charlie; the two Alfas fill for zero.
    expect(best!.parents.map((p) => p.id).sort()).toEqual([11, 12])
    expect(best!.score).toBe(221)
    expect(best!.tier).toBe('excellent')
  })

  it('agrees with affinityBreakdown when the arrangement is placed in a tree', () => {
    const [best] = optimizeArrangements(1, library(), data, { limit: 1 })
    const tree = emptyTree()
    tree.slots[0] = emptyBuild(101)
    const place = (slot: number, cand: OptimizerCandidate | undefined) => {
      if (!cand) return
      const build = emptyBuild(cand.variantId)
      build.wonRaces = [...cand.wonRaces]
      tree.slots[slot] = build
    }
    place(1, best!.parents[0])
    place(2, best!.parents[1])
    place(3, best!.gps[0][0])
    place(4, best!.gps[0][1])
    place(5, best!.gps[1][0])
    place(6, best!.gps[1][1])

    expect(affinityBreakdown(tree, 0, data).total).toBe(best!.score)
  })

  it('never places the trainee character as a parent', () => {
    for (const arr of optimizeArrangements(1, library(), data, { limit: 50 })) {
      for (const p of arr.parents) {
        expect(data.charaIdOf(p.variantId)).not.toBe(1)
      }
    }
  })

  it('never puts the same character twice on one side', () => {
    for (const arr of optimizeArrangements(1, library(), data, { limit: 50 })) {
      for (const side of arr.gps) {
        const charas = side.map((c) => data.charaIdOf(c.variantId))
        expect(new Set(charas).size).toBe(charas.length)
      }
    }
  })

  it('never reuses a library uma across slots', () => {
    for (const arr of optimizeArrangements(1, library(), data, { limit: 50 })) {
      const ids = [...arr.parents, ...arr.gps.flat()].map((c) => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('honors required parents', () => {
    const results = optimizeArrangements(1, library(), data, { limit: 10, requiredParentIds: [13] })
    expect(results.length).toBeGreaterThan(0)
    for (const arr of results) {
      expect(arr.parents.some((p) => p.id === 13)).toBe(true)
    }
  })

  it('produces partial arrangements from tiny libraries', () => {
    const tiny = library().slice(0, 2) // just two parents, no gps left
    const [best] = optimizeArrangements(1, tiny, data, { limit: 1 })
    expect(best).toBeDefined()
    expect(best!.parents).toHaveLength(2)
    expect(best!.gps.flat()).toHaveLength(0)
    expect(best!.score).toBe(100 + 60 + 40) // pairs only
  })

  it('applies the jp-modern win rule when asked', () => {
    const [legacy] = optimizeArrangements(1, library(), data, { limit: 1 })
    const [modern] = optimizeArrangements(1, library(), data, { limit: 1, raceBonusRule: 'jp-modern' })
    expect(modern!.score).toBe(legacy!.score + 2) // the shared Japan Cup: +3 instead of +1
  })

  it('returns empty for an empty library', () => {
    expect(optimizeArrangements(1, [], data)).toEqual([])
  })
})
