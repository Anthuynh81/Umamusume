import { describe, expect, it } from 'vitest'
import { layoutTree } from './treeImage'

describe('layoutTree', () => {
  it('lays out the active scope (7 slots, 3 generations)', () => {
    const l = layoutTree('active')
    expect(l.generations).toBe(3)
    expect(l.cards).toHaveLength(7)
    expect(l.links).toHaveLength(6)
    // Width fits the widest generation (4 grandparents).
    expect(l.width).toBe(24 * 2 + 4 * 208 + 3 * 14)
  })

  it('lays out the full scope (31 slots)', () => {
    const l = layoutTree('full')
    expect(l.cards).toHaveLength(31)
    expect(l.links).toHaveLength(30)
  })

  it('centers the trainee and keeps rows non-overlapping', () => {
    const l = layoutTree('full')
    const trainee = l.cards.find((c) => c.slot === 0)!
    expect(trainee.x).toBeCloseTo((l.width - 208) / 2)

    const byGen = new Map<number, number[]>()
    for (const c of l.cards) {
      const gen = Math.floor(Math.log2(c.slot + 1))
      byGen.set(gen, [...(byGen.get(gen) ?? []), c.x])
    }
    for (const xs of byGen.values()) {
      const sorted = [...xs].sort((a, b) => a - b)
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(208)
      }
    }
  })

  it('links every non-leaf slot to its two parents', () => {
    const l = layoutTree('active')
    expect(l.links).toContainEqual([0, 1])
    expect(l.links).toContainEqual([0, 2])
    expect(l.links).toContainEqual([2, 6])
    // Grandparents (leaf generation in this scope) have no outgoing links.
    expect(l.links.some(([child]) => child >= 3)).toBe(false)
  })
})
