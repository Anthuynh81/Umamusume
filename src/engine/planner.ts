/**
 * Full planner: given a trainee and TARGET white sparks, search the library
 * for legal arrangements (one-borrow rule, own-parent rules) with the best
 * odds of inheriting the targets.
 *
 * Probability model (proc.ts semantics): a copy's per-event proc is
 * base(stars) × (1 + individual affinity/100) capped at 1; copies combine
 * within an event; two events per career. Equivalently, per target t:
 *   q(t) = Π over all copies (1 − p_copy)        — one-event miss chance
 *   P(t inherited) = 1 − q(t)²
 * q factors across slots, which the search exploits: per parent pair, each
 * side's options are ranked locally (parent affinity is side-determined up
 * to the fixed parent-pair terms), the top options are crossed under the
 * uma-uniqueness constraint, and the survivors are scored exactly.
 *
 * Ranking: targets covered (a target with zero copies can never proc) →
 * P(all covered targets) → total affinity.
 *
 * Bounded search: parents are limited to target carriers plus the
 * best-affinity subset; grandparents per parent likewise. Exact within
 * those bounds — the caps only ever drop umas that neither carry a target
 * nor rank near the top on affinity.
 */
import { DEFAULT_RACE_BONUS_RULE, PROC_BASE } from '../data/config/rates'
import type { RaceBonusRule } from '../data/config/rates'
import type { GameData } from '../data/types'
import type { Stars, WhiteSpark } from '../model/types'
import { raceBonusFromWins } from './affinity'
import { procClassOf } from './proc'
import type { OptimizerCandidate } from './optimizer'

export interface PlannerCandidate extends OptimizerCandidate {
  whites: WhiteSpark[]
}

export interface PlannedTargetOdds {
  refId: number
  /** Copies of the target in this arrangement (slot-independent count). */
  copies: number
  /** Per-career inheritance chance. */
  perCareer: number
}

export interface PlannedArrangement {
  parents: [PlannerCandidate, PlannerCandidate]
  gps: [PlannerCandidate[], PlannerCandidate[]]
  /** Targets with at least one copy in the arrangement. */
  covered: number
  /** P(every covered target inherited in one career). */
  pAllCovered: number
  perTarget: PlannedTargetOdds[]
  affinity: number
}

export interface PlanOptions {
  limit?: number
  requiredParentIds?: number[]
  raceBonusRule?: RaceBonusRule
  /** Non-owned umas allowed (parent slots only). Default 1. */
  maxBorrowed?: number
  /** Affinity-ranked non-carriers kept as parent / grandparent candidates. */
  parentAffinityKeep?: number
  gpAffinityKeep?: number
  /** Side options crossed per parent pair. */
  sideKeep?: number
}

interface SideOption {
  gps: PlannerCandidate[]
  ids: number[]
  /** Σ gp links (trio + race bonus) — the side's affinity contribution. */
  contrib: number
  /** Per-target one-event miss product over gp copies only. */
  gpMiss: Map<number, number>
}

export function planArrangements(
  traineeCharaId: number,
  candidates: PlannerCandidate[],
  targetRefIds: number[],
  data: GameData,
  opts: PlanOptions = {},
): PlannedArrangement[] {
  const limit = opts.limit ?? 5
  const rule = opts.raceBonusRule ?? DEFAULT_RACE_BONUS_RULE
  const maxBorrowed = opts.maxBorrowed ?? 1
  const required = opts.requiredParentIds ?? []
  const targets = [...new Set(targetRefIds)]
  const sideKeep = opts.sideKeep ?? 10

  const charaOf = new Map<number, number>()
  for (const c of candidates) {
    const chara = data.charaIdOf(c.variantId)
    if (chara !== undefined) charaOf.set(c.id, chara)
  }
  const pool = candidates.filter((c) => charaOf.has(c.id))

  const targetStars = (c: PlannerCandidate): Map<number, Stars[]> => {
    const m = new Map<number, Stars[]>()
    for (const w of c.whites) {
      if (targets.includes(w.refId)) m.set(w.refId, [...(m.get(w.refId) ?? []), w.stars])
    }
    return m
  }
  const carriers = new Set(pool.filter((c) => targetStars(c).size > 0).map((c) => c.id))

  const procBase = (refId: number, stars: Stars): number => {
    const kind = data.spark(refId)?.kind ?? 'skill'
    return PROC_BASE[procClassOf('white', kind)][stars]
  }
  const copyProc = (refId: number, stars: Stars, affinity: number): number =>
    Math.min(1, procBase(refId, stars) * (1 + Math.max(0, affinity) / 100))

  /** Miss-product over one candidate's target copies at the given affinity. */
  const missAt = (c: PlannerCandidate, affinity: number): Map<number, number> => {
    const m = new Map<number, number>()
    for (const [refId, starsList] of targetStars(c)) {
      let q = 1
      for (const s of starsList) q *= 1 - copyProc(refId, s, affinity)
      m.set(refId, q)
    }
    return m
  }

  const pairPts = (a: number, b: number): number => (a === b ? 0 : data.relations.pair(a, b))
  const bonus = (a: PlannerCandidate, b: PlannerCandidate): number =>
    charaOf.get(a.id) === charaOf.get(b.id) ? 0 : raceBonusFromWins(a.wonRaces, b.wonRaces, 0, data, rule).points

  // Parent candidates: carriers ∪ top-affinity ∪ required.
  const parentKeep = opts.parentAffinityKeep ?? 40
  const parentEligible = pool.filter((c) => charaOf.get(c.id) !== traineeCharaId)
  const byTraineePair = [...parentEligible].sort(
    (a, b) => pairPts(traineeCharaId, charaOf.get(b.id)!) - pairPts(traineeCharaId, charaOf.get(a.id)!),
  )
  const parentSet = new Set<PlannerCandidate>([
    ...byTraineePair.slice(0, parentKeep),
    ...parentEligible.filter((c) => carriers.has(c.id) || required.includes(c.id)),
  ])
  const parents = [...parentSet]

  // Per-parent grandparent-pair options (owned only; carriers ∪ top by trio).
  const gpKeep = opts.gpAffinityKeep ?? 14
  const sideOptionsFor = new Map<number, SideOption[]>()
  for (const p of parents) {
    const cp = charaOf.get(p.id)!
    const gpEligible = pool.filter((x) => x.owned && x.id !== p.id && charaOf.get(x.id) !== cp)
    const gpLink = (x: PlannerCandidate): number => {
      const cx = charaOf.get(x.id)!
      if (cx === traineeCharaId || cx === cp) return 0
      return data.relations.trio(traineeCharaId, cp, cx) + bonus(p, x)
    }
    const ranked = [...gpEligible].sort((a, b) => gpLink(b) - gpLink(a))
    const kept = [
      ...ranked.slice(0, gpKeep),
      ...gpEligible.filter((x) => carriers.has(x.id)),
    ]
    const uniq = [...new Map(kept.map((x) => [x.id, x])).values()]

    const options: SideOption[] = []
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        const x = uniq[i]!
        const y = uniq[j]!
        if (charaOf.get(x.id) === charaOf.get(y.id)) continue
        const contrib = gpLink(x) + gpLink(y)
        const gpMiss = new Map<number, number>()
        for (const [refId, q] of missAt(x, gpLink(x))) gpMiss.set(refId, q)
        for (const [refId, q] of missAt(y, gpLink(y))) gpMiss.set(refId, (gpMiss.get(refId) ?? 1) * q)
        options.push({ gps: [x, y], ids: [x.id, y.id], contrib, gpMiss })
      }
    }
    if (options.length === 0) {
      for (const x of uniq) {
        options.push({ gps: [x], ids: [x.id], contrib: gpLink(x), gpMiss: missAt(x, gpLink(x)) })
      }
      options.push({ gps: [], ids: [], contrib: 0, gpMiss: new Map() })
    }
    // Side-local rank: better target odds first (approximating the parent's
    // affinity without the parent-pair terms), then affinity contribution.
    const parentApprox = pairPts(traineeCharaId, cp)
    const heur = (o: SideOption): number => {
      let logMiss = 0
      const pm = missAt(p, parentApprox + o.contrib)
      for (const t of targets) {
        const q = (o.gpMiss.get(t) ?? 1) * (pm.get(t) ?? 1)
        logMiss += Math.log(Math.max(q, 1e-12))
      }
      return logMiss // lower (more negative) = better odds
    }
    options.sort((a, b) => heur(a) - heur(b) || b.contrib - a.contrib)
    sideOptionsFor.set(p.id, options.slice(0, Math.max(sideKeep, 1)))
  }

  const results: PlannedArrangement[] = []
  const consider = (arr: PlannedArrangement) => {
    results.push(arr)
    results.sort(
      (a, b) => b.covered - a.covered || b.pAllCovered - a.pAllCovered || b.affinity - a.affinity,
    )
    if (results.length > limit) results.pop()
  }

  for (let i = 0; i < parents.length; i++) {
    const a = parents[i]!
    for (let j = i + 1; j < parents.length; j++) {
      const b = parents[j]!
      if (charaOf.get(a.id) === charaOf.get(b.id)) continue
      if (required.length > 0 && !required.every((id) => id === a.id || id === b.id)) continue
      if ((a.owned ? 0 : 1) + (b.owned ? 0 : 1) > maxBorrowed) continue

      const pairAB = pairPts(charaOf.get(a.id)!, charaOf.get(b.id)!) + bonus(a, b)
      const fixedAff =
        pairPts(traineeCharaId, charaOf.get(a.id)!) + pairPts(traineeCharaId, charaOf.get(b.id)!) + pairAB

      const optsA = (sideOptionsFor.get(a.id) ?? []).filter((o) => !o.ids.includes(b.id))
      const optsB = (sideOptionsFor.get(b.id) ?? []).filter((o) => !o.ids.includes(a.id))
      for (const oa of optsA) {
        for (const ob of optsB) {
          if (oa.ids.some((id) => ob.ids.includes(id))) continue

          // Exact parent affinities for this full arrangement.
          const affA = pairPts(traineeCharaId, charaOf.get(a.id)!) + pairAB + oa.contrib
          const affB = pairPts(traineeCharaId, charaOf.get(b.id)!) + pairAB + ob.contrib
          const missA = missAt(a, affA)
          const missB = missAt(b, affB)

          const perTarget: PlannedTargetOdds[] = []
          let covered = 0
          let pAll = 1
          for (const t of targets) {
            const q =
              (missA.get(t) ?? 1) * (missB.get(t) ?? 1) * (oa.gpMiss.get(t) ?? 1) * (ob.gpMiss.get(t) ?? 1)
            const copies =
              (targetStars(a).get(t)?.length ?? 0) +
              (targetStars(b).get(t)?.length ?? 0) +
              oa.gps.reduce((n, g) => n + (targetStars(g).get(t)?.length ?? 0), 0) +
              ob.gps.reduce((n, g) => n + (targetStars(g).get(t)?.length ?? 0), 0)
            const perCareer = copies > 0 ? 1 - q * q : 0
            if (copies > 0) {
              covered++
              pAll *= perCareer
            }
            perTarget.push({ refId: t, copies, perCareer })
          }

          consider({
            parents: [a, b],
            gps: [oa.gps, ob.gps],
            covered,
            pAllCovered: covered > 0 ? pAll : 0,
            perTarget,
            affinity: fixedAff + oa.contrib + ob.contrib,
          })
        }
      }
    }
  }

  return results
}
