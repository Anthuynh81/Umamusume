/**
 * Shared-race planner: which graded races EVERY uma in a pool can run in her
 * career — the races to target for shared-win affinity bonuses.
 *
 * A character can run a calendar instance iff she has debuted by then and the
 * turn isn't claimed by a different mandatory objective (an objective for
 * that exact race is the best case: a guaranteed entry).
 */
import type { CharRacePlan, RaceInstance, RacePlanData } from '../data/racePlan'
import type { GameData } from '../data/types'
import { applyRaise, gradeIndex } from './aptitude'
import type { Grade } from '../model/types'

export interface SharedRace extends RaceInstance {
  /** Pool members whose career objectives force this exact race. */
  mandatoryFor: number[]
}

export interface RacePlanResult {
  /** Instances runnable by every pool member, in calendar order. */
  races: SharedRace[]
  /** Pool members without career-plan data (new characters). */
  missingData: number[]
}

function canRun(plan: CharRacePlan, race: RaceInstance): boolean {
  if (race.turn <= plan.debutTurn) return false
  const forced = plan.mandatory[String(race.turn)]
  return forced === undefined || forced === race.raceId
}

/** Game distance categories by race length. */
export type DistanceCategory = 'sprint' | 'mile' | 'medium' | 'long'

export function distanceCategory(meters: number): DistanceCategory {
  if (meters <= 1400) return 'sprint'
  if (meters <= 1800) return 'mile'
  if (meters <= 2400) return 'medium'
  return 'long'
}

/** Turf/dirt + the four distance categories, as grades. */
export type SharedAptitudes = Record<'turf' | 'dirt' | DistanceCategory, Grade>

/**
 * The pool's shared BASE aptitudes: each character's best grade across her
 * Global cards, then the minimum across the pool — the ceiling on what the
 * whole pool can run without inheritance raises.
 */
export function poolSharedAptitudes(pool: number[], data: GameData): SharedAptitudes {
  const keys = ['turf', 'dirt', 'sprint', 'mile', 'medium', 'long'] as const
  const result = {} as SharedAptitudes
  for (const key of keys) {
    let min: Grade = 'S'
    for (const charaId of pool) {
      const variants = data.variantsOf(charaId).filter((v) => v.global)
      let best: Grade = 'G'
      for (const v of variants) {
        if (gradeIndex(v.aptitudes[key]) > gradeIndex(best)) best = v.aptitudes[key]
      }
      if (gradeIndex(best) < gradeIndex(min)) min = best
    }
    result[key] = pool.length > 0 ? min : 'G'
  }
  return result
}

/**
 * The pool's aptitudes assuming maximum inheritance raises: pink sparks add
 * up to +4 stages, capped at A (aptitude.ts applyRaise). A base G tops out
 * at C; a base E is "fixable" all the way to A.
 */
export function withRaiseCeilings(shared: SharedAptitudes): SharedAptitudes {
  const result = {} as SharedAptitudes
  for (const key of Object.keys(shared) as (keyof SharedAptitudes)[]) {
    result[key] = applyRaise(shared[key], 4)
  }
  return result
}

/** Keeps races whose surface AND distance the whole pool can run at ≥ minGrade. */
export function filterByAptitude<T extends RaceInstance>(
  races: T[],
  shared: SharedAptitudes,
  minGrade: Grade,
): T[] {
  const min = gradeIndex(minGrade)
  return races.filter((r) => {
    const surface: Grade = r.terrain === 2 ? shared.dirt : shared.turf
    const dist = shared[distanceCategory(r.distance)]
    return gradeIndex(surface) >= min && gradeIndex(dist) >= min
  })
}

export function sharedRunnableRaces(
  pool: number[],
  plan: RacePlanData,
  opts: { grades?: number[]; server?: 'global' | 'jp' } = {},
): RacePlanResult {
  const grades = opts.grades ?? [100]
  const server = opts.server ?? 'global'
  const missingData = pool.filter((c) => !plan.chars[c])
  const active = [...new Set(pool.filter((c) => plan.chars[c]))]

  const races: SharedRace[] = plan.instances
    .filter((r) => grades.includes(r.grade))
    .filter((r) => (r.server ?? 'both') === 'both' || r.server === server)
    .filter((r) => active.length > 0 && active.every((c) => canRun(plan.chars[c]!, r)))
    .map((r) => ({
      ...r,
      mandatoryFor: active.filter((c) => plan.chars[c]!.mandatory[String(r.turn)] === r.raceId),
    }))

  return { races, missingData }
}
