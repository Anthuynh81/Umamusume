/**
 * Affinity optimizer: given a trainee and the user's saved uma library,
 * search arrangements of library umas into the 2 parent + 4 grandparent
 * slots and rank by total affinity.
 *
 * The search is exact and fast because the score decomposes: for a fixed
 * parent pair, each side's grandparent-pair score is independent of the
 * other side except that a library uma can occupy only one slot. We
 * precompute per-parent sorted grandparent-pair lists once, then resolve
 * the cross-side overlap by scanning the top of both lists.
 *
 * Rules mirrored from affinityBreakdown/lineageErrors:
 *  - a parent cannot be the trainee's character, nor her own grandparent's;
 *  - the two parents and the two grandparents on one side must differ;
 *  - the trainee's character IS legal as a grandparent — its trio term is
 *    simply zero, so such arrangements rank low naturally;
 *  - each library uma (by id) is used at most once across the six slots.
 */
import { DEFAULT_RACE_BONUS_RULE } from '../data/config/rates'
import type { RaceBonusRule } from '../data/config/rates'
import type { GameData } from '../data/types'
import { affinityTier, raceBonusFromWins } from './affinity'
import type { AffinityTier } from './affinity'

export interface OptimizerCandidate {
  /** Unique id (library uma id). */
  id: number
  variantId: number
  name: string
  wonRaces: number[]
}

export interface Arrangement {
  score: number
  tier: AffinityTier
  /** Parent slots 1 and 2. */
  parents: [OptimizerCandidate, OptimizerCandidate]
  /** gps[0] under parents[0] (slots 3,4); gps[1] under parents[1] (slots 5,6). */
  gps: [OptimizerCandidate[], OptimizerCandidate[]]
}

export interface OptimizeOptions {
  /** Top N arrangements to return (default 5). */
  limit?: number
  /** Candidate ids that must occupy parent slots (0-2 entries). */
  requiredParentIds?: number[]
  raceBonusRule?: RaceBonusRule
}

/** How many top gp-pairs per side to scan when resolving cross-side overlap. */
const OVERLAP_SCAN = 50

export function optimizeArrangements(
  traineeCharaId: number,
  candidates: OptimizerCandidate[],
  data: GameData,
  opts: OptimizeOptions = {},
): Arrangement[] {
  const limit = opts.limit ?? 5
  const rule = opts.raceBonusRule ?? DEFAULT_RACE_BONUS_RULE
  const required = opts.requiredParentIds ?? []

  const charaOf = new Map<number, number>()
  for (const c of candidates) {
    const chara = data.charaIdOf(c.variantId)
    if (chara !== undefined) charaOf.set(c.id, chara)
  }
  const pool = candidates.filter((c) => charaOf.has(c.id))

  const pair = memo2((a: number, b: number) => {
    const ca = charaOf.get(a)!
    const cb = charaOf.get(b)!
    return ca === cb ? 0 : data.relations.pair(ca, cb)
  })
  const bonus = memo2((a: number, b: number) => {
    const ca = charaOf.get(a)!
    const cb = charaOf.get(b)!
    if (ca === cb) return 0
    const A = pool.find((c) => c.id === a)!
    const B = pool.find((c) => c.id === b)!
    return raceBonusFromWins(A.wonRaces, B.wonRaces, 0, data, rule).points
  })

  /** Full contribution of grandparent x under parent p: trio + race bonus. */
  const gpTerm = (p: OptimizerCandidate, x: OptimizerCandidate): number => {
    const cp = charaOf.get(p.id)!
    const cx = charaOf.get(x.id)!
    if (cx === traineeCharaId || cx === cp) return 0 // zeroed trio, no bonus
    return data.relations.trio(traineeCharaId, cp, cx) + bonus(p.id, x.id)
  }

  // Per-parent sorted grandparent-pair lists (pool minus the parent herself
  // and umas sharing her character — the own-parent rule).
  interface SideOption {
    gps: OptimizerCandidate[]
    ids: number[]
    score: number
  }
  const sideOptions = new Map<number, SideOption[]>()
  for (const p of pool) {
    const cp = charaOf.get(p.id)!
    const eligible = pool.filter((x) => x.id !== p.id && charaOf.get(x.id) !== cp)
    const options: SideOption[] = []
    for (let i = 0; i < eligible.length; i++) {
      const x = eligible[i]!
      for (let j = i + 1; j < eligible.length; j++) {
        const y = eligible[j]!
        if (charaOf.get(x.id) === charaOf.get(y.id)) continue // sibling-gp rule
        options.push({ gps: [x, y], ids: [x.id, y.id], score: gpTerm(p, x) + gpTerm(p, y) })
      }
    }
    // Fallbacks so tiny libraries still produce (partial) arrangements.
    if (options.length === 0) {
      for (const x of eligible) options.push({ gps: [x], ids: [x.id], score: gpTerm(p, x) })
      options.push({ gps: [], ids: [], score: 0 })
    }
    options.sort((a, b) => b.score - a.score)
    sideOptions.set(p.id, options)
  }

  /** Best non-overlapping combination of the two sides' top options. */
  const bestSides = (
    a: OptimizerCandidate,
    b: OptimizerCandidate,
  ): { scoreA: number; scoreB: number; gpsA: OptimizerCandidate[]; gpsB: OptimizerCandidate[] } | null => {
    const listA = sideOptions.get(a.id)!.filter((o) => !o.ids.includes(b.id)).slice(0, OVERLAP_SCAN)
    const listB = sideOptions.get(b.id)!.filter((o) => !o.ids.includes(a.id)).slice(0, OVERLAP_SCAN)
    if (listA.length === 0 || listB.length === 0) return null
    let best: { total: number; oa: SideOption; ob: SideOption } | null = null
    for (const oa of listA) {
      if (best && oa.score + listB[0]!.score <= best.total) break // lists are sorted
      for (const ob of listB) {
        if (best && oa.score + ob.score <= best.total) break
        if (oa.ids.some((id) => ob.ids.includes(id))) continue
        best = { total: oa.score + ob.score, oa, ob }
        break
      }
    }
    if (!best) return null
    return { scoreA: best.oa.score, scoreB: best.ob.score, gpsA: best.oa.gps, gpsB: best.ob.gps }
  }

  const parents = pool.filter((c) => charaOf.get(c.id) !== traineeCharaId)
  const results: Arrangement[] = []

  for (let i = 0; i < parents.length; i++) {
    const a = parents[i]!
    for (let j = i + 1; j < parents.length; j++) {
      const b = parents[j]!
      if (charaOf.get(a.id) === charaOf.get(b.id)) continue
      if (required.length > 0 && !required.every((id) => id === a.id || id === b.id)) continue

      const sides = bestSides(a, b)
      if (!sides) continue

      const base =
        traineePair(a) + traineePair(b) + pair(a.id, b.id) + bonus(a.id, b.id)
      const score = base + sides.scoreA + sides.scoreB
      results.push({
        score,
        tier: affinityTier(score),
        parents: [a, b],
        gps: [sides.gpsA, sides.gpsB],
      })
    }
  }

  function traineePair(c: OptimizerCandidate): number {
    const chara = charaOf.get(c.id)!
    return chara === traineeCharaId ? 0 : data.relations.pair(traineeCharaId, chara)
  }

  results.sort((x, y) => y.score - x.score)
  return results.slice(0, limit)
}

/** Two-key memo helper (order-insensitive). */
function memo2(fn: (a: number, b: number) => number): (a: number, b: number) => number {
  const cache = new Map<string, number>()
  return (a, b) => {
    const key = a <= b ? `${a}:${b}` : `${b}:${a}`
    let v = cache.get(key)
    if (v === undefined) {
      v = fn(a, b)
      cache.set(key, v)
    }
    return v
  }
}
