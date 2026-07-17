import { describe, expect, it } from 'vitest'
import { affinityBreakdown } from '../engine/affinity'
import { emptyBuild, emptyTree } from '../model/types'
import { loadGameData } from './load'

/** Smoke tests over the real static snapshots produced by fetch-data.mjs. */
describe('static game data', () => {
  const data = loadGameData()

  it('carries the Global roster', () => {
    expect(data.characters.filter((c) => c.global).length).toBeGreaterThanOrEqual(60)
    expect(data.character(1001)?.name).toBe('Special Week')
  })

  it('maps variants with correct aptitude order', () => {
    const sw = data.variant(100101)!
    expect(sw.charaId).toBe(1001)
    expect(sw.aptitudes.turf).toBe('A')
    expect(sw.aptitudes.dirt).toBe('G')
    expect(sw.uniqueSkillId).not.toBeNull()
  })

  it('computes real relation points (Special Week × Silence Suzuka = 27)', () => {
    expect(data.relations.pair(1001, 1002)).toBe(27)
  })

  it('relation trios are computable and bounded by pairs', () => {
    const pair = data.relations.pair(1001, 1003)
    const trio = data.relations.trio(1001, 1002, 1003)
    expect(trio).toBeGreaterThanOrEqual(0)
    expect(trio).toBeLessThanOrEqual(pair)
  })

  it('ships graded races including the crown-triple ids', () => {
    for (const id of [100501, 101001, 101501, 101601, 101901, 102301]) {
      expect(data.race(id)?.grade).toBe(100)
    }
    expect(data.races.some((r) => r.grade === 200)).toBe(true)
  })

  it('ships skill, race, and scenario sparks', () => {
    const kinds = new Set(data.sparks.map((s) => s.kind))
    expect(kinds).toEqual(new Set(['skill', 'race', 'scenario']))
    expect(data.sparks.filter((s) => s.kind === 'scenario' && s.global).length).toBeGreaterThanOrEqual(3)
  })

  it('scores a real tree end to end', () => {
    const tree = emptyTree()
    const firstVariantOf = (charaId: number) =>
      data.variants.find((v) => v.charaId === charaId && v.global)!.id
    tree.slots[0] = emptyBuild(firstVariantOf(1001)) // Special Week
    tree.slots[1] = emptyBuild(firstVariantOf(1002)) // Silence Suzuka
    tree.slots[2] = emptyBuild(firstVariantOf(1003)) // Tokai Teio

    const b = affinityBreakdown(tree, 0, data)
    expect(b.links.find((l) => l.a === 0 && l.b === 1)?.pairPoints).toBe(27)
    expect(b.total).toBeGreaterThan(0)
  })
})
