import { describe, expect, it } from 'vitest'
import { emptyBuild, emptyTree } from '../model/types'
import { affinityBreakdown } from './affinity'
import { fixtureData } from './fixtures'
import { optimizeArrangements } from './optimizer'
import { planArrangements } from './planner'
import type { PlannerCandidate } from './planner'
import { inheritanceRates } from './proc'

const data = fixtureData()
const GROUNDWORK = 200342 // fixture skill spark

function lib(): PlannerCandidate[] {
  return [
    { id: 11, variantId: 201, name: 'Bravo', wonRaces: [], owned: true, whites: [{ kind: 'skill', refId: GROUNDWORK, stars: 2 }] },
    { id: 12, variantId: 301, name: 'Charlie', wonRaces: [], owned: true, whites: [] },
    { id: 13, variantId: 401, name: 'Delta', wonRaces: [], owned: true, whites: [{ kind: 'skill', refId: GROUNDWORK, stars: 1 }] },
    { id: 14, variantId: 501, name: 'Echo', wonRaces: [], owned: true, whites: [] },
    { id: 15, variantId: 102, name: 'Alfa alt', wonRaces: [], owned: true, whites: [] },
    { id: 16, variantId: 101, name: 'Alfa', wonRaces: [], owned: true, whites: [] },
  ]
}

describe('planArrangements', () => {
  it('puts the carriers into the best-odds arrangement', () => {
    const [best] = planArrangements(1, lib(), [GROUNDWORK], data, { limit: 1 })
    expect(best).toBeDefined()
    expect(best!.covered).toBe(1)
    const everyone = [...best!.parents, ...best!.gps.flat()].map((c) => c.id)
    expect(everyone).toContain(11)
    expect(everyone).toContain(13)
    expect(best!.perTarget[0]).toMatchObject({ refId: GROUNDWORK, copies: 2 })
    expect(best!.perTarget[0]!.perCareer).toBeGreaterThan(0)
  })

  it('agrees with the inheritance panel math for its own arrangement', () => {
    const [best] = planArrangements(1, lib(), [GROUNDWORK], data, { limit: 1 })
    const byId = new Map(lib().map((c) => [c.id, c]))
    const tree = emptyTree()
    tree.slots[0] = emptyBuild(101)
    const place = (slot: number, cand?: { id: number }) => {
      if (!cand) return
      const src = byId.get(cand.id)!
      const build = emptyBuild(src.variantId)
      build.whites = [...src.whites]
      tree.slots[slot] = build
    }
    place(1, best!.parents[0])
    place(2, best!.parents[1])
    place(3, best!.gps[0][0])
    place(4, best!.gps[0][1])
    place(5, best!.gps[1][0])
    place(6, best!.gps[1][1])

    const { perSlot, total } = affinityBreakdown(tree, 0, data)
    expect(total).toBe(best!.affinity)
    const row = inheritanceRates(tree, data, perSlot).find((r) => r.refId === GROUNDWORK)!
    expect(row.perCareer).toBeCloseTo(best!.perTarget[0]!.perCareer, 10)
  })

  it('prefers covering a target over raw affinity', () => {
    // Only Echo (worst trainee affinity: pair(1,5)=10) carries the target.
    const candidates = lib().map((c) => ({
      ...c,
      whites: c.id === 14 ? [{ kind: 'skill' as const, refId: GROUNDWORK, stars: 3 as const }] : [],
    }))
    const [best] = planArrangements(1, candidates, [GROUNDWORK], data, { limit: 1 })
    expect(best!.covered).toBe(1)
    expect([...best!.parents, ...best!.gps.flat()].some((c) => c.id === 14)).toBe(true)
  })

  it('falls back to affinity ranking with no targets', () => {
    const [planned] = planArrangements(1, lib(), [], data, { limit: 1 })
    const [optimized] = optimizeArrangements(
      1,
      lib().map(({ whites: _w, ...c }) => c),
      data,
      { limit: 1 },
    )
    expect(planned!.affinity).toBe(optimized!.score)
  })

  it('respects the one-borrow rule', () => {
    const candidates = lib().map((c) => (c.id === 11 || c.id === 12 ? { ...c, owned: false } : c))
    for (const arr of planArrangements(1, candidates, [GROUNDWORK], data, { limit: 20 })) {
      const borrowed = [...arr.parents, ...arr.gps.flat()].filter((c) => !c.owned)
      expect(borrowed.length).toBeLessThanOrEqual(1)
      for (const gp of arr.gps.flat()) expect(gp.owned).toBe(true)
    }
  })

  it('reports uncovered targets as zero-probability', () => {
    const [best] = planArrangements(1, lib(), [GROUNDWORK, 999999], data, { limit: 1 })
    expect(best!.covered).toBe(1)
    const missing = best!.perTarget.find((t) => t.refId === 999999)!
    expect(missing).toMatchObject({ copies: 0, perCareer: 0 })
  })
})
