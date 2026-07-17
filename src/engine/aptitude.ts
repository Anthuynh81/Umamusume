/**
 * Deterministic pink math: starting aptitude raises, wasted stars, and the
 * post-raise A/S pool that drives pink generation odds (the "pace B trap").
 * Pure functions; no game-data lookups except through the injected accessor.
 */
import {
  APTITUDE_RAISE_CAP_GRADE, APTITUDE_RAISE_THRESHOLDS,
} from '../data/config/rates'
import { lineageOf } from '../model/tree'
import { APTITUDE_KEYS, GRADES } from '../model/types'
import type { AptitudeKey, Aptitudes, Grade, Tree } from '../model/types'

export function gradeIndex(g: Grade): number {
  return GRADES.indexOf(g)
}

/** Raise stages granted by a cumulative star total (1/4/7/10 → +1..+4). */
export function raiseStages(totalStars: number): 0 | 1 | 2 | 3 | 4 {
  let stages = 0
  for (const t of APTITUDE_RAISE_THRESHOLDS) if (totalStars >= t) stages++
  return stages as 0 | 1 | 2 | 3 | 4
}

/** Stars still needed for the next stage, or null if already at +4. */
export function starsToNextStage(totalStars: number): number | null {
  const next = APTITUDE_RAISE_THRESHOLDS.find((t) => totalStars < t)
  return next === undefined ? null : next - totalStars
}

/** Stars beyond the last threshold reached — they currently do nothing. */
export function excessStars(totalStars: number): number {
  let lastReached = 0
  for (const t of APTITUDE_RAISE_THRESHOLDS) if (totalStars >= t) lastReached = t
  return totalStars - lastReached
}

/**
 * Apply starting raises: +stages capped at A. Grades already at or above the
 * cap are untouched (a base S stays S; starting raises never reach S).
 */
export function applyRaise(base: Grade, stages: number): Grade {
  const capIdx = gradeIndex(APTITUDE_RAISE_CAP_GRADE)
  const baseIdx = gradeIndex(base)
  if (baseIdx >= capIdx) return base
  return GRADES[Math.min(baseIdx + stages, capIdx)]!
}

export interface AptitudeRaise {
  base: Grade
  effective: Grade
  totalStars: number
  stages: number
  /** Stars doing nothing at the current total. */
  excess: number
  /** Stars to the next stage; null when maxed (+4) or effective grade capped. */
  toNext: number | null
}

export type AptitudeReport = Record<AptitudeKey, AptitudeRaise>

/**
 * Effective starting aptitudes for the uma in `slotIndex`, from pink stars
 * across her in-tree lineage (2 parents + 4 grandparents, clipped at the tree
 * edge for deep slots). Works for the trainee AND for parents — parents need
 * runnable aptitudes for factor farming.
 */
export function effectiveAptitudes(
  tree: Tree,
  slotIndex: number,
  baseAptitudes: Aptitudes,
): AptitudeReport {
  const stars: Record<AptitudeKey, number> = Object.fromEntries(
    APTITUDE_KEYS.map((k) => [k, 0]),
  ) as Record<AptitudeKey, number>

  for (const ancestor of lineageOf(slotIndex)) {
    const pink = tree.slots[ancestor]?.pink
    if (pink) stars[pink.aptitude] += pink.stars
  }

  const report = {} as AptitudeReport
  for (const key of APTITUDE_KEYS) {
    const total = stars[key]
    const stages = raiseStages(total)
    const base = baseAptitudes[key]
    const effective = applyRaise(base, stages)
    report[key] = {
      base,
      effective,
      totalStars: total,
      stages,
      excess: excessStars(total),
      toNext: gradeIndex(effective) >= gradeIndex(APTITUDE_RAISE_CAP_GRADE) ? null : starsToNextStage(total),
    }
  }
  return report
}

/**
 * The A/S pool a career ending with these aptitudes rolls its pink spark
 * from — uniform choice, so the chance of a specific aptitude is 1/pool size.
 * Includes S: both "A or higher" phrasings agree S-rank entries roll.
 */
export function pinkPool(aptitudes: Record<AptitudeKey, Grade>): AptitudeKey[] {
  const aIdx = gradeIndex('A')
  return APTITUDE_KEYS.filter((k) => gradeIndex(aptitudes[k]) >= aIdx)
}

/**
 * Pool entries the planner should flag: aptitudes raised INTO the pool by
 * lineage stars (base below A, effective A) — candidates for the pace-B trap
 * when the raised aptitude isn't the farming target.
 */
export function raisedIntoPool(report: AptitudeReport): AptitudeKey[] {
  const aIdx = gradeIndex('A')
  return APTITUDE_KEYS.filter(
    (k) => gradeIndex(report[k].base) < aIdx && gradeIndex(report[k].effective) >= aIdx,
  )
}

// ---------------------------------------------------------------------------
// Reverse planner: from target grades to star deficits
// ---------------------------------------------------------------------------

export interface AptitudeDeficit {
  key: AptitudeKey
  target: Grade
  base: Grade
  /** Total same-aptitude stars the lineage must carry to reach the target. */
  neededStars: number
  currentStars: number
  /** Stars still missing (0 = target already met). */
  deficit: number
  /**
   * False when starting raises cannot reach the target (above A — S needs an
   * Inspiration proc on top of an A start).
   */
  achievable: boolean
  /** Trainee-lineage slots that could carry the missing pinks: empty ones. */
  emptySlots: number[]
  /** Filled lineage slots with no pink assigned yet. */
  pinklessSlots: number[]
  /** Filled lineage slots already carrying this pink below 3★ (upgradable). */
  upgradableSlots: number[]
}

/**
 * Star deficits to reach target starting grades on the trainee, with the
 * slots that could cover them. Thresholds: n stages need 3n−2 stars.
 */
export function aptitudeDeficits(
  tree: Tree,
  baseAptitudes: Aptitudes,
  targets: Partial<Record<AptitudeKey, Grade>>,
): AptitudeDeficit[] {
  const report = effectiveAptitudes(tree, 0, baseAptitudes)
  const capIdx = gradeIndex(APTITUDE_RAISE_CAP_GRADE)

  const results: AptitudeDeficit[] = []
  for (const [key, target] of Object.entries(targets) as [AptitudeKey, Grade][]) {
    const base = baseAptitudes[key]
    const baseIdx = gradeIndex(base)
    const targetIdx = gradeIndex(target)
    // Starting raises cap at A and at +4 stages; anything beyond is
    // unreachable from this base (S additionally needs an Inspiration proc).
    const stagesWanted = Math.max(0, Math.min(targetIdx, capIdx) - baseIdx)
    const achievable = baseIdx >= targetIdx || (targetIdx <= capIdx && stagesWanted <= 4)
    const stages = Math.min(stagesWanted, 4)
    const neededStars = stages === 0 ? 0 : APTITUDE_RAISE_THRESHOLDS[stages - 1]!
    const currentStars = report[key].totalStars

    const emptySlots: number[] = []
    const pinklessSlots: number[] = []
    const upgradableSlots: number[] = []
    for (const slot of lineageOf(0)) {
      const build = tree.slots[slot]
      if (!build) emptySlots.push(slot)
      else if (!build.pink) pinklessSlots.push(slot)
      else if (build.pink.aptitude === key && build.pink.stars < 3) upgradableSlots.push(slot)
    }

    results.push({
      key,
      target,
      base,
      neededStars,
      currentStars,
      deficit: Math.max(0, neededStars - currentStars),
      achievable,
      emptySlots,
      pinklessSlots,
      upgradableSlots,
    })
  }
  return results
}
