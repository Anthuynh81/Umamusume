import { describe, expect, it } from 'vitest'
import { whiteGenChance } from '../data/config/rates'
import {
  atLeastStars, blueStarOdds, expectedRuns, farmChancePerDraw,
  specificBlueChance, specificPinkChance, specificWhiteChance,
  starOddsForRating, withReroll,
} from './generation'

describe('blue star odds bands (600/1100 gates)', () => {
  it('selects the right band (mid band is 50/45/5)', () => {
    expect(blueStarOdds(599)).toEqual({ 1: 0.90, 2: 0.10, 3: 0.00 })
    expect(blueStarOdds(600)).toEqual({ 1: 0.50, 2: 0.45, 3: 0.05 })
    expect(blueStarOdds(1099)).toEqual({ 1: 0.50, 2: 0.45, 3: 0.05 })
    expect(blueStarOdds(1100)).toEqual({ 1: 0.20, 2: 0.70, 3: 0.10 })
  })
})

describe('rating star bands (white & green)', () => {
  it('applies the 6500/17500/28800 thresholds', () => {
    expect(starOddsForRating(6499)).toEqual({ 1: 0.90, 2: 0.10, 3: 0.00 })
    expect(starOddsForRating(6500)).toEqual({ 1: 0.50, 2: 0.45, 3: 0.05 })
    expect(starOddsForRating(17500)).toEqual({ 1: 0.20, 2: 0.70, 3: 0.10 }) // SS jump
    expect(starOddsForRating(28800)).toEqual({ 1: 0.175, 2: 0.70, 3: 0.125 }) // UE ceiling
  })
})

describe('atLeastStars', () => {
  it('sums the tail of the distribution', () => {
    expect(atLeastStars({ 1: 0.5, 2: 0.45, 3: 0.05 }, 2)).toBeCloseTo(0.5)
    expect(atLeastStars({ 1: 0.2, 2: 0.7, 3: 0.1 }, 1)).toBeCloseTo(1)
    expect(atLeastStars({ 1: 0.2, 2: 0.7, 3: 0.1 }, 3)).toBeCloseTo(0.1)
  })
})

describe('whiteGenChance copy-bonus strategies', () => {
  it('multiplicative (default): base × 1.1^n', () => {
    expect(whiteGenChance('normal', 0)).toBeCloseTo(0.20)
    expect(whiteGenChance('normal', 2)).toBeCloseTo(0.242)
    expect(whiteGenChance('gold', 6)).toBeCloseTo(0.4 * 1.1 ** 6)
  })

  it('piecewise: white 2/2/2.75, circle 2.5/3.4375, gold 4/5.5', () => {
    expect(whiteGenChance('normal', 3, 'piecewise')).toBeCloseTo(0.2675)
    expect(whiteGenChance('circle', 3, 'piecewise')).toBeCloseTo(0.25 + 0.05 + 0.034375)
    expect(whiteGenChance('gold', 4, 'piecewise')).toBeCloseTo(0.59)
  })

  it('flat (rejected, comparison only): +2.5% white / +5% gold per copy', () => {
    expect(whiteGenChance('normal', 4, 'flat')).toBeCloseTo(0.30)
    expect(whiteGenChance('gold', 2, 'flat')).toBeCloseTo(0.50)
  })

  it('zero copies is the base rate under every strategy', () => {
    for (const s of ['flat', 'piecewise', 'multiplicative'] as const) {
      expect(whiteGenChance('circle', 0, s)).toBeCloseTo(0.25)
    }
  })
})

describe('specific-spark chances', () => {
  it('blue: 1/5 stat pick × star gate', () => {
    expect(specificBlueChance({ finalStat: 1100, minStars: 2 })).toBeCloseTo(0.16)
    expect(specificBlueChance({ finalStat: 599, minStars: 3 })).toBeCloseTo(0)
  })

  it('pink: 1/pool × star gate', () => {
    expect(specificPinkChance({ poolSize: 4, minStars: 2 })).toBeCloseTo(0.2)
    expect(specificPinkChance({ poolSize: 0, minStars: 1 })).toBe(0)
  })

  it('white: gen chance × rating star gate', () => {
    expect(
      specificWhiteChance({ tier: 'gold', lineageCopies: 4, minStars: 2, rating: 20000, strategy: 'piecewise' }),
    ).toBeCloseTo(0.59 * 0.8)
  })
})

describe('farming composition', () => {
  it('multiplies independent components', () => {
    const target = {
      blue: { finalStat: 1100, minStars: 2 as const },
      pink: { poolSize: 4, minStars: 2 as const },
      whites: [{ tier: 'gold' as const, lineageCopies: 4, minStars: 2 as const, rating: 20000 }],
    }
    const expected =
      specificBlueChance(target.blue) *
      specificPinkChance(target.pink) *
      specificWhiteChance(target.whites[0]!)
    expect(farmChancePerDraw(target)).toBeCloseTo(expected)
  })

  it('reroll doubles the draws', () => {
    expect(withReroll(0.2)).toBeCloseTo(0.36)
  })

  it('estimates expected runs and 50/90 percentiles', () => {
    const est = expectedRuns(0.05)
    expect(est.mean).toBeCloseTo(20)
    expect(est.p50).toBe(14)
    expect(est.p90).toBe(45)
  })

  it('handles degenerate probabilities', () => {
    expect(expectedRuns(0).mean).toBe(Infinity)
    expect(expectedRuns(1)).toEqual({ pPerCareer: 1, mean: 1, p50: 1, p90: 1 })
  })
})
