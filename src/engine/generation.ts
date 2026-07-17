/**
 * Generation ("spark chance") math and the expected-runs farming calculator.
 * These are chances that a TRAINED uma ends her career with given sparks —
 * not to be confused with proc (inheritance) chances in proc.ts.
 */
import {
  BLUE_GEN_STAR_ODDS, BLUE_GEN_STAT_CHANCE, DEFAULT_COPY_BONUS_STRATEGY,
  PINK_GEN_STAR_ODDS, RATING_STAR_BANDS, REROLL_DRAWS, whiteGenChance,
} from '../data/config/rates'
import type { CopyBonusStrategy, StarOdds, WhiteTier } from '../data/config/rates'
import type { Stars } from '../model/types'

/** Star odds for a blue spark on a stat with this final visible value. */
export function blueStarOdds(finalStat: number): StarOdds {
  const band = BLUE_GEN_STAR_ODDS.find((b) => finalStat >= b.minStat)
  return (band ?? BLUE_GEN_STAR_ODDS[BLUE_GEN_STAR_ODDS.length - 1]!).odds
}

/**
 * Star odds for white AND green sparks, gated by final career rating
 * (bands at 6500 / 17500 (SS) / 28800 (UE)).
 */
export function starOddsForRating(rating: number): StarOdds {
  const band = RATING_STAR_BANDS.find((b) => rating >= b.minRating)
  return (band ?? RATING_STAR_BANDS[RATING_STAR_BANDS.length - 1]!).odds
}

/** P(stars ≥ min) under a star-odds row. */
export function atLeastStars(odds: StarOdds, min: Stars): number {
  let p = 0
  for (const s of [1, 2, 3] as const) if (s >= min) p += odds[s]
  return p
}

/**
 * Chance one career ends with a specific-stat blue at ≥ minStars:
 * uniform 1/5 stat choice × star gate from the stat's final value.
 */
export function specificBlueChance(stat: { finalStat: number; minStars: Stars }): number {
  return BLUE_GEN_STAT_CHANCE * atLeastStars(blueStarOdds(stat.finalStat), stat.minStars)
}

/**
 * Chance of a specific pink at ≥ minStars: uniform 1/poolSize choice over the
 * A/S pool (see aptitude.ts pinkPool) × the flat 20/70/10 star split.
 */
export function specificPinkChance(pool: { poolSize: number; minStars: Stars }): number {
  if (pool.poolSize <= 0) return 0
  return (1 / pool.poolSize) * atLeastStars(PINK_GEN_STAR_ODDS, pool.minStars)
}

export interface WhiteTargetSpec {
  /** Tier of the skill version HELD at career end (races/scenarios: normal). */
  tier: WhiteTier
  /** Copies of this spark among the trained uma's own parents+grandparents. */
  lineageCopies: number
  minStars: Stars
  /** Final career rating (star odds band). */
  rating: number
  strategy?: CopyBonusStrategy
}

/** Chance one career generates this white spark at ≥ minStars. */
export function specificWhiteChance(spec: WhiteTargetSpec): number {
  const gen = whiteGenChance(spec.tier, spec.lineageCopies, spec.strategy ?? DEFAULT_COPY_BONUS_STRATEGY)
  return gen * atLeastStars(starOddsForRating(spec.rating), spec.minStars)
}

/**
 * Combined chance a single career hits ALL components of a farming target.
 * Spark categories roll independently (REF §Farming math), so multiply.
 */
export interface FarmTarget {
  blue?: { finalStat: number; minStars: Stars }
  pink?: { poolSize: number; minStars: Stars }
  whites?: WhiteTargetSpec[]
}

export function farmChancePerDraw(target: FarmTarget): number {
  let p = 1
  if (target.blue) p *= specificBlueChance(target.blue)
  if (target.pink) p *= specificPinkChance(target.pink)
  for (const w of target.whites ?? []) p *= specificWhiteChance(w)
  return p
}

/** Spark reroll (30 TP) = 2 independent draws per career. Default on. */
export function withReroll(pPerDraw: number, draws: number = REROLL_DRAWS): number {
  return 1 - (1 - pPerDraw) ** draws
}

export interface RunEstimate {
  pPerCareer: number
  /** Expected careers (mean of the geometric distribution). */
  mean: number
  /** Careers for 50% / 90% cumulative chance of at least one success. */
  p50: number
  p90: number
}

export function expectedRuns(pPerCareer: number): RunEstimate {
  if (pPerCareer <= 0) return { pPerCareer: 0, mean: Infinity, p50: Infinity, p90: Infinity }
  if (pPerCareer >= 1) return { pPerCareer: 1, mean: 1, p50: 1, p90: 1 }
  const runsFor = (cum: number) => Math.ceil(Math.log(1 - cum) / Math.log(1 - pPerCareer))
  return { pPerCareer, mean: 1 / pPerCareer, p50: runsFor(0.5), p90: runsFor(0.9) }
}
