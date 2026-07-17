import { describe, expect, it } from 'vitest'
import { countDistribution, expectedCount, pAtLeast } from './wishlist'

describe('Poisson-binomial wishlist math', () => {
  it('computes the exact count distribution', () => {
    expect(countDistribution([0.5, 0.5]).map((x) => +x.toFixed(10))).toEqual([0.25, 0.5, 0.25])
  })

  it('distributions sum to 1', () => {
    const dist = countDistribution([0.03, 0.12, 0.4, 0.9, 0.007])
    expect(dist.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })

  it('P(at least n)', () => {
    expect(pAtLeast([0.5, 0.5], 1)).toBeCloseTo(0.75)
    expect(pAtLeast([0.5, 0.5], 2)).toBeCloseTo(0.25)
    expect(pAtLeast([0.5, 0.5], 3)).toBeCloseTo(0)
    expect(pAtLeast([0.1], 0)).toBe(1)
  })

  it('expected count is the sum of probabilities', () => {
    expect(expectedCount([0.1, 0.2, 0.3])).toBeCloseTo(0.6)
    expect(expectedCount([])).toBe(0)
  })
})
