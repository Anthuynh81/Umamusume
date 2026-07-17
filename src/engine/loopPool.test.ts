import { describe, expect, it } from 'vitest'
import { fixtureData } from './fixtures'
import { recommendLoopPools } from './loopPool'

const data = fixtureData()
// Fixture pairs: 1:2=100, 1:3=60, 1:4=20, 1:5=10, 2:3=40, 2:4=25, 2:5=30, 3:4=15, 3:5=55, 4:5=5

describe('recommendLoopPools', () => {
  it('finds the best pool of the requested size (Global roster)', () => {
    const [best] = recommendLoopPools([], data, { size: 3 })
    // Chara 5 is not Global; best trio of {1,2,3,4} is {1,2,3} = 100+60+40.
    expect(best!.members.sort()).toEqual([1, 2, 3])
    expect(best!.total).toBe(200)
    expect(best!.minPair).toBe(40)
  })

  it('completes seed characters', () => {
    const [best] = recommendLoopPools([4], data, { size: 3 })
    expect(best!.members[0]).toBe(4)
    expect(best!.members.slice(1).sort()).toEqual([1, 2]) // 20+25+100 = 145
    expect(best!.total).toBe(145)
  })

  it('ranks pools descending and respects the limit', () => {
    const pools = recommendLoopPools([], data, { size: 3, limit: 3 })
    expect(pools).toHaveLength(3)
    for (let i = 1; i < pools.length; i++) {
      expect(pools[i]!.total).toBeLessThanOrEqual(pools[i - 1]!.total)
    }
  })

  it('scores a full seed set without searching', () => {
    const pools = recommendLoopPools([1, 2, 3, 4], data, { size: 4 })
    expect(pools).toHaveLength(1)
    expect(pools[0]!.total).toBe(100 + 60 + 20 + 40 + 25 + 15)
  })

  it('honors a custom candidate list (e.g. including non-Global)', () => {
    const [best] = recommendLoopPools([3], data, { size: 2, candidates: [5] })
    expect(best!.members).toEqual([3, 5])
    expect(best!.total).toBe(55)
  })

  it('returns empty when seeds exceed the size', () => {
    expect(recommendLoopPools([1, 2, 3], data, { size: 2 })).toEqual([])
  })
})
