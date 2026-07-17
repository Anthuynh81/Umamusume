/**
 * Rate tables and thresholds for the calculation engine — Global (EN) version.
 *
 * EVERY number here is an empirical community estimate (inheritance rolls are
 * server-side) unless marked DATAMINED (from master.mdb tables, exact).
 * Sources: "REF §…" = docs/research/spark-math-reference.md; "VERIFY …" =
 * docs/research/rate-verification-report.md (2026-07-16 research run).
 * Primary empirical chain: BourBon_Polaris's 0-affinity controlled JP tests,
 * Aya's Global CM10-12 mega-samples (hakuraku.moe/notes), aoneko_pochi's JP
 * sampling, the uma.moe ~22M team-trials dataset, and Cygames patent
 * JP2022018121A for the affinity multiplier.
 *
 * Terminology reminder: "proc" = inheritance activation chance for the
 * trainee; "gen" = spark generation chance at a trained uma's career end.
 */
import type { Stars } from '../../model/types'

export type PerStarRate = Readonly<Record<Stars, number>>
/** Probabilities of generating a 1/2/3-star spark; rows sum to 1. */
export type StarOdds = Readonly<Record<Stars, number>>

// ---------------------------------------------------------------------------
// Career activation model — REF §Career activation model, VERIFY blue-proc-value
// ---------------------------------------------------------------------------

/** Inspiration events per career (April year 2, April year 3). */
export const INSPIRATION_EVENTS = 2

// ---------------------------------------------------------------------------
// Proc chances per inspiration event, base (0-affinity), multiplied by
// (1 + individual affinity / 100) — Cygames patent JP2022018121A, validated
// by Polaris. VERIFY white-proc: grandparents have NO separate halving rule;
// they proc worse purely because their individual affinity is lower
// (hakuraku.moe "individual inheritance theory").
// ---------------------------------------------------------------------------

/** How a spark's proc rate is classed. Race whites are LOWER than skill whites. */
export type ProcClass = 'blue' | 'pink' | 'green' | 'whiteSkill' | 'whiteScenario' | 'whiteRace'

export const PROC_BASE: Readonly<Record<ProcClass, PerStarRate>> = {
  /** VERIFY blue-2star-proc: 70/80/90 (Polaris ~1,000-trial baseline). */
  blue: { 1: 0.70, 2: 0.80, 3: 0.90 },
  /** VERIFY pink-proc: 1/3/5 (Polaris 1,000-trial, corroborated). */
  pink: { 1: 0.01, 2: 0.03, 3: 0.05 },
  /** VERIFY green-proc: 5/10/15 (Polaris <20-affinity tests). */
  green: { 1: 0.05, 2: 0.10, 3: 0.15 },
  /** VERIFY white-proc: skill & scenario whites 3/6/9. */
  whiteSkill: { 1: 0.03, 2: 0.06, 3: 0.09 },
  whiteScenario: { 1: 0.03, 2: 0.06, 3: 0.09 },
  /** VERIFY white-proc: G1 race sparks are 1/2/3, NOT 3/6/9. */
  whiteRace: { 1: 0.01, 2: 0.02, 3: 0.03 },
}

// ---------------------------------------------------------------------------
// Proc effects
// ---------------------------------------------------------------------------

/**
 * Blue career-start bonus: guaranteed, deterministic, +5/+12/+21 per star,
 * additive across all six lineage blues. VERIFY blue-proc-value.
 */
export const BLUE_START_STAT: PerStarRate = { 1: 5, 2: 12, 3: 21 }

/**
 * Blue inspiration-event procs roll a RANDOM stat amount in these ranges
 * (distribution unverified; treat as uniform placeholder). VERIFY blue-proc-value.
 */
export const BLUE_EVENT_STAT_RANGE: Readonly<Record<Stars, readonly [number, number]>> = {
  1: [1, 10], 2: [1, 16], 3: [1, 28],
}

/**
 * Stat-cap raise per activation: +4/+9/+16 by star, at career start and both
 * events. Live on Global since 2026-07-01. VERIFY blue-thresholds.
 */
export const BLUE_CAP_RAISE: PerStarRate = { 1: 4, 2: 9, 3: 16 }

/**
 * Scenario procs grant two scenario stats, star-scaled +10/+20/+30 —
 * DATAMINED (factors table effects [10,20,30]).
 */
export const SCENARIO_PROC_STAT: PerStarRate = { 1: 10, 2: 20, 3: 30 }

/**
 * Race-spark procs grant a small stat boost, star-scaled +3/+6/+9 —
 * DATAMINED (factors table effects [3,6,9]); REF §White claimed non-scaling,
 * superseded by the datamine.
 */
export const RACE_PROC_STAT: PerStarRate = { 1: 3, 2: 6, 3: 9 }

// ---------------------------------------------------------------------------
// Affinity — DATAMINED (succession_relation_rank) + VERIFY relations scout
// ---------------------------------------------------------------------------

/**
 * Tier thresholds from succession_relation_rank: △ 0–50, ○ 51–150, ◎ 151+.
 * △ is a failure state (proc rates collapse), not just a lower grade.
 */
export const AFFINITY_TIER_EXCELLENT = 151 // score ≥ this ⇒ ◎
export const AFFINITY_TIER_GOOD = 51 // score ≥ this ⇒ ○, else △

/**
 * Shared-win race bonus rules. The two biggest calculators DISAGREE for
 * Global (VERIFY relations scout, both code-verified 2026-07-16):
 *  - 'global-legacy' (GameTora's shipped EN rule): +1 per shared won race
 *    among G1/G2/G3, plus +1 per fully-shared crown triple (epithet bonus).
 *  - 'jp-modern' (current JP; also what ChronoGenesis applies to Global):
 *    +3 per shared G1 win only.
 * Applied on exactly 5 links: (p1,p2), (p1,g11), (p1,g12), (p2,g21), (p2,g22).
 * The trainee has no race history and contributes no bonus.
 */
export type RaceBonusRule = 'global-legacy' | 'jp-modern'
export const DEFAULT_RACE_BONUS_RULE: RaceBonusRule = 'global-legacy'

export const RACE_BONUS_POINTS: Readonly<Record<RaceBonusRule, number>> = {
  'global-legacy': 1,
  'jp-modern': 3,
}

/** Race grades whose shared wins count under each rule (100=G1,200=G2,300=G3). */
export const RACE_BONUS_GRADES: Readonly<Record<RaceBonusRule, readonly number[]>> = {
  'global-legacy': [100, 200, 300],
  'jp-modern': [100],
}

/**
 * Crown-set epithet triples (race ids): fully sharing a set grants +1 per
 * link under 'global-legacy'. DATAMINED from GameTora chunk 2464:
 * Triple Crown, Autumn Senior Triple, Triple Tiara, Spring Senior Triple.
 */
export const CROWN_TRIPLES: ReadonlyArray<readonly number[]> = [
  [100501, 101001, 101501], // Satsuki Sho / Tokyo Yushun / Kikuka Sho
  [101601, 101901, 102301], // Tenno Sho (Autumn) / Japan Cup / Arima Kinen
  [100401, 100901, 101401], // Oka Sho / Japanese Oaks / Shuka Sho
  [100301, 100601, 101201], // Osaka Hai / Tenno Sho (Spring) / Takarazuka Kinen
]

/**
 * Proc multiplier: rate × (1 + individual affinity / 100), capped at p = 1.
 * Cygames patent JP2022018121A; Polaris-validated. 1★ blues hit 100% at
 * affinity ≥ 43 (42.86 exact), 2★ at 25, 3★ at 12.
 */
export function affinityMultiplier(affinity: number): number {
  return 1 + Math.max(0, affinity) / 100
}

/**
 * Position handling for grandparent slots. VERIFY white-proc RESOLVED the
 * source conflict: there is NO separate halving rule — identical per-star
 * base rates for all six slots, with per-slot individual affinity producing
 * the observed ~half gap. 'grandparent-halved' is kept only as a legacy
 * comparison mode.
 */
export type PositionModel = 'affinity-only' | 'grandparent-halved'
export const DEFAULT_POSITION_MODEL: PositionModel = 'affinity-only'

/**
 * Which affinity value feeds a slot's proc multiplier. 'individual' =
 * crazyfellow's individual-affinity model, validated by Polaris's 100-trial
 * follow-up and implemented by hakuraku's veterans page
 * (hakuraku.moe/notes/sparks): a grandparent's individual affinity is her
 * trio contribution + the race bonus to her parent; a parent's is her pair
 * with the trainee + pair with the other parent + both of her grandparent
 * trios + the race bonuses on all those links. Reproduces the self-lineage
 * collapse (trainee as her own grandparent ⇒ zero for that slot).
 * 'to-trainee' = plain pair(trainee, slot), kept for comparison only.
 */
export type SlotAffinityMode = 'individual' | 'to-trainee'
export const DEFAULT_SLOT_AFFINITY_MODE: SlotAffinityMode = 'individual'

// ---------------------------------------------------------------------------
// Aptitude raises (deterministic pink math) — VERIFY apt-raise (corroborated)
// ---------------------------------------------------------------------------

/** Cumulative same-aptitude stars for +1..+4 stages (1 then +3 per stage). */
export const APTITUDE_RAISE_THRESHOLDS = [1, 4, 7, 10] as const

/** Starting raises cap at A; S requires an inspiration proc. */
export const APTITUDE_RAISE_CAP_GRADE = 'A' as const

// ---------------------------------------------------------------------------
// Generation: blue — VERIFY blue-sub600-split, blue-thresholds
// (umamusustation n=22,411; owadablog ~3,000)
// ---------------------------------------------------------------------------

/**
 * Star odds gated by the stat's final visible value. Sampled: <600 =
 * 90.2/9.8/0.0 (3★ literally 0/9,770); 600–1099 = 49.0/45.2/5.8;
 * 1100+ = 20.2/69.1/10.6.
 */
export const BLUE_GEN_STAR_ODDS: ReadonlyArray<{ minStat: number; odds: StarOdds }> = [
  { minStat: 1100, odds: { 1: 0.20, 2: 0.70, 3: 0.10 } },
  { minStat: 600, odds: { 1: 0.50, 2: 0.45, 3: 0.05 } },
  { minStat: 0, odds: { 1: 0.90, 2: 0.10, 3: 0.00 } },
]

/** Stat choice is ~uniform among the 5 (known small skew ignored for v1). */
export const BLUE_GEN_STAT_CHANCE = 1 / 5

// ---------------------------------------------------------------------------
// Generation: pink — VERIFY pink-split (n=22,411), pink-pool
// ---------------------------------------------------------------------------

/** Star split 20/70/10, ungated by stats/rank/races. */
export const PINK_GEN_STAR_ODDS: StarOdds = { 1: 0.20, 2: 0.70, 3: 0.10 }

// ---------------------------------------------------------------------------
// Generation: white/green star odds by final career RATING —
// VERIFY star-tables-ss (Aya n=725k Global; uma.moe ~22M for green)
// ---------------------------------------------------------------------------

export interface RatingBand {
  minRating: number
  odds: StarOdds
  /** True where the band is extrapolated rather than sampled. */
  extrapolated?: boolean
}

/**
 * Same bands apply to white AND green sparks. Rating thresholds: 6500 (~B),
 * 17500 (SS), 28800 (UE). The UE+ band is JP-sampled for whites and
 * extrapolated for greens; Global careers rarely reach it today.
 */
export const RATING_STAR_BANDS: ReadonlyArray<RatingBand> = [
  { minRating: 28800, odds: { 1: 0.175, 2: 0.70, 3: 0.125 }, extrapolated: true },
  { minRating: 17500, odds: { 1: 0.20, 2: 0.70, 3: 0.10 } },
  { minRating: 6500, odds: { 1: 0.50, 2: 0.45, 3: 0.05 } },
  { minRating: 0, odds: { 1: 0.90, 2: 0.10, 3: 0.00 } },
]

/** Rating threshold names for UI ("reach SS for the 3★ jump"). */
export const RATING_SS = 17500
export const RATING_UE = 28800

// ---------------------------------------------------------------------------
// Generation: white base rates and lineage copy bonus —
// VERIFY white-gen-base (n=511,839 white / 168,666 gold), white-copy-bonus
// ---------------------------------------------------------------------------

export type WhiteTier = 'normal' | 'circle' | 'gold'

/**
 * Base generation chance by the tier of the skill HELD at career end.
 * Sampled at 0 lineage copies: 20.08% / 24.92% / 39.96%. Races and
 * scenarios behave as 'normal' (~20%). Note: the generated spark is the
 * white (base) version's factor regardless of held tier.
 */
export const WHITE_GEN_BASE: Readonly<Record<WhiteTier, number>> = {
  normal: 0.20,
  circle: 0.25, // skill learned as ◎
  gold: 0.40,
}

/**
 * Lineage copy bonus strategies. VERIFY white-copy-bonus: flat +2.5%/+5% is
 * REJECTED (χ² p≈1e-14/1e-19); default = multiplicative base × 1.1ⁿ
 * (aoneko_pochi, corroborated by Aya's fits p≥0.84 and uma.moe N=26.5M).
 * Piecewise is Aya's descriptive fit, kept for comparison.
 */
export type CopyBonusStrategy = 'flat' | 'piecewise' | 'multiplicative'
export const DEFAULT_COPY_BONUS_STRATEGY: CopyBonusStrategy = 'multiplicative'

export function whiteGenChance(
  tier: WhiteTier,
  lineageCopies: number,
  strategy: CopyBonusStrategy = DEFAULT_COPY_BONUS_STRATEGY,
): number {
  const base = WHITE_GEN_BASE[tier]
  switch (strategy) {
    case 'flat': {
      // Rejected community baseline, kept for comparison displays only.
      const per = tier === 'gold' ? 0.05 : 0.025
      return Math.min(1, base + lineageCopies * per)
    }
    case 'piecewise': {
      // Aya's fits: white 20 +2/+2.75, circle 25 +2.5/+3.4375, gold 40 +4/+5.5.
      const [early, late] =
        tier === 'gold' ? [0.04, 0.055]
        : tier === 'circle' ? [0.025, 0.034375]
        : [0.02, 0.0275]
      const first = Math.min(lineageCopies, 2)
      const rest = Math.max(lineageCopies - 2, 0)
      return Math.min(1, base + first * early + rest * late)
    }
    case 'multiplicative':
      return Math.min(1, base * 1.1 ** lineageCopies)
  }
}

// ---------------------------------------------------------------------------
// Generation: green — VERIFY green-proc
// ---------------------------------------------------------------------------

/**
 * Greens generate at 100% for characters at 3★+ rarity at career start
 * (upgraded 1-2★ characters qualify once uncapped); never below 3★.
 * Star odds follow RATING_STAR_BANDS; independent of unique skill level.
 */
export const GREEN_GEN_MIN_RARITY = 3

// ---------------------------------------------------------------------------
// Farming — REF §Farming math
// ---------------------------------------------------------------------------

/** Spark reroll: 30 TP buys one full re-draw ⇒ 2 independent draws/career. */
export const REROLL_DRAWS = 2
