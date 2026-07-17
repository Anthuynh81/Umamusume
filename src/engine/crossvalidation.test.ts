import { describe, expect, it } from 'vitest'
import { loadGameData } from '../data/load'
import { emptyBuild, emptyTree } from '../model/types'
import type { Tree } from '../model/types'
import { affinityBreakdown } from './affinity'
import { perCareerProc, perEventProc } from './proc'

/**
 * Cross-validation against GameTora's Inheritance Chances beta
 * (gametora.com/umamusume/compatibility). Test vectors were computed by
 * executing GameTora's own extracted code (chunk 2464-722aa62831d0d8bc.js,
 * fetched 2026-07-16) — see docs/research/cross-validation.md.
 *
 * Setup: trainee Special Week (1001); parent1 Silence Suzuka (1002) with
 * grandparents Vodka (1008) and Oguri Cap (1006); parent2 Tokai Teio (1003)
 * with grandparents Mejiro McQueen (1013) and Rice Shower (1030). Base
 * outfits, no won races.
 */
const data = loadGameData()

function setup(): Tree {
  const tree = emptyTree()
  const variantOf = (charaId: number) => {
    const v = data.variants.find((x) => x.charaId === charaId)
    if (!v) throw new Error(`no variant for chara ${charaId}`)
    return v.id
  }
  tree.slots[0] = emptyBuild(variantOf(1001))
  tree.slots[1] = emptyBuild(variantOf(1002))
  tree.slots[2] = emptyBuild(variantOf(1003))
  tree.slots[3] = emptyBuild(variantOf(1008))
  tree.slots[4] = emptyBuild(variantOf(1006))
  tree.slots[5] = emptyBuild(variantOf(1013))
  tree.slots[6] = emptyBuild(variantOf(1030))
  return tree
}

describe('cross-validation vs GameTora (2026-07-16 vectors)', () => {
  const breakdown = affinityBreakdown(setup(), 0, data)

  it('reproduces their pair/trio sums and tree total (149)', () => {
    const link = (a: number, b: number) => breakdown.links.find((l) => l.a === a && l.b === b)!
    expect(link(0, 1).pairPoints).toBe(27)
    expect(link(0, 2).pairPoints).toBe(25)
    expect(link(1, 2).pairPoints).toBe(20)
    expect(link(1, 3).trioPoints).toBe(18)
    expect(link(1, 4).trioPoints).toBe(20)
    expect(link(2, 5).trioPoints).toBe(21)
    expect(link(2, 6).trioPoints).toBe(18)
    expect(breakdown.total).toBe(149)
  })

  it('reproduces their per-slot individual affinities', () => {
    expect(breakdown.perSlot[1]).toBe(85) // 27 + 20 + 18 + 20
    expect(breakdown.perSlot[2]).toBe(84) // 25 + 20 + 21 + 18
    expect(breakdown.perSlot[3]).toBe(18)
    expect(breakdown.perSlot[4]).toBe(20)
    expect(breakdown.perSlot[5]).toBe(21)
    expect(breakdown.perSlot[6]).toBe(18)
  })

  it('reproduces their white SKILL spark chances', () => {
    const onParent = perEventProc('whiteSkill', 3, 85)
    expect(onParent).toBeCloseTo(0.1665, 10)
    expect(perCareerProc(onParent)).toBeCloseTo(0.30527775, 8)

    const onGp = perEventProc('whiteSkill', 3, 18)
    expect(onGp).toBeCloseTo(0.1062, 10)
    expect(perCareerProc(onGp)).toBeCloseTo(0.20112156, 8)
  })

  it('reproduces their white RACE spark chances (1/2/3% class)', () => {
    const onParent = perEventProc('whiteRace', 3, 85)
    expect(onParent).toBeCloseTo(0.0555, 10)
    expect(perCareerProc(onParent)).toBeCloseTo(0.10791975, 8)
  })
})
