/**
 * Affinity (compatibility) scoring — the exact datamined formula, verified
 * against the Global master.mdb succession tables, GameTora's shipped code,
 * hakuraku, waptia/UmaMusumeAffinityMath, and ChronoGenesis (see
 * docs/research/data-pipeline-plan.md, relations scout 2026-07-16):
 *
 *   total = pair(t,p1) + pair(t,p2) + pair(p1,p2)
 *         + trio(t,p1,g11) + trio(t,p1,g12) + trio(t,p2,g21) + trio(t,p2,g22)
 *         + race-win bonus on the 5 links (p1,p2), (p1,g11), (p1,g12),
 *           (p2,g21), (p2,g22)
 *
 * pair = Σ relation_point over groups containing both charas; trio = groups
 * containing all three. There is NO pair(parent, grandparent) term.
 *
 * Self-lineage: the trainee CAN appear as her own grandparent; that trio term
 * is zeroed (ChronoGenesis behavior). Other duplicates (own parent, both
 * parents equal, parent as her own grandparent, twin grandparents on one
 * side) are configuration errors — see lineageErrors(). Identity is by base
 * character; outfits are the same uma.
 *
 * Race-win bonus rules differ between calculators for Global; see
 * RaceBonusRule in config/rates.ts.
 */
import {
  AFFINITY_TIER_EXCELLENT, AFFINITY_TIER_GOOD, CROWN_TRIPLES,
  DEFAULT_RACE_BONUS_RULE, DEFAULT_SLOT_AFFINITY_MODE, RACE_BONUS_GRADES,
  RACE_BONUS_POINTS,
} from '../data/config/rates'
import type { RaceBonusRule, SlotAffinityMode } from '../data/config/rates'
import type { GameData } from '../data/types'
import { parentsOf } from '../model/tree'
import { TREE_SLOTS, slotPairKey } from '../model/types'
import type { Tree } from '../model/types'

export type AffinityTier = 'excellent' | 'good' | 'poor'

export const TIER_SYMBOLS: Record<AffinityTier, string> = {
  excellent: '◎', good: '○', poor: '△',
}

/** DB thresholds (succession_relation_rank): △ 0–50, ○ 51–150, ◎ 151+. */
export function affinityTier(score: number): AffinityTier {
  if (score >= AFFINITY_TIER_EXCELLENT) return 'excellent'
  if (score >= AFFINITY_TIER_GOOD) return 'good'
  return 'poor'
}

export type LinkKind = 'trainee-parent' | 'parent-parent' | 'parent-grandparent'

export interface AffinityLink {
  a: number
  b: number
  kind: LinkKind
  /** pair points (trainee/parent links) — zero on parent-grandparent links. */
  pairPoints: number
  /** trio points (parent-grandparent links only). */
  trioPoints: number
  /** Shared won races counted under the active rule (+ manual extras). */
  sharedWins: number
  /** Fully-shared crown triples ('global-legacy' only). */
  crownSets: number
  winBonus: number
  total: number
  /** True when zeroed by a duplicate base character on the link. */
  selfLink: boolean
}

export interface AffinityBreakdown {
  rootIndex: number
  links: AffinityLink[]
  total: number
  tier: AffinityTier
  /** Individual affinity feeding each lineage slot's proc multiplier. */
  perSlot: Record<number, number>
}

export interface AffinityOptions {
  raceBonusRule?: RaceBonusRule
  slotAffinityMode?: SlotAffinityMode
}

/** Pair affinity between two base characters (matrix displays, optimizer). */
export function pairAffinity(data: GameData, charaA: number, charaB: number): number {
  if (charaA === charaB) return 0
  return data.relations.pair(charaA, charaB)
}

export interface RaceBonus {
  sharedWins: number
  crownSets: number
  points: number
}

/**
 * Race-win bonus between two won-race lists: shared races filtered to the
 * rule's grades (unknown race ids count — assumed G1), plus crown epithets
 * under 'global-legacy', plus manual extra wins at the rule's per-win value.
 */
export function raceBonusFromWins(
  wonRacesA: number[],
  wonRacesB: number[],
  manualExtra: number,
  data: GameData,
  rule: RaceBonusRule = DEFAULT_RACE_BONUS_RULE,
): RaceBonus {
  const wonB = new Set(wonRacesB)
  const shared = wonRacesA.filter((r) => wonB.has(r))

  const grades = RACE_BONUS_GRADES[rule]
  const counted = shared.filter((r) => {
    const grade = data.race(r)?.grade
    return grade === undefined || grades.includes(grade)
  })

  let crownSets = 0
  if (rule === 'global-legacy') {
    const sharedSet = new Set(shared)
    for (const triple of CROWN_TRIPLES) {
      if (triple.every((r) => sharedSet.has(r))) crownSets++
    }
  }

  const perWin = RACE_BONUS_POINTS[rule]
  return {
    sharedWins: counted.length + manualExtra,
    crownSets,
    points: (counted.length + manualExtra) * perWin + crownSets,
  }
}

/** Race-win bonus between two tree slots (wonRaces + manual extraWins). */
export function raceBonus(
  tree: Tree,
  a: number,
  b: number,
  data: GameData,
  rule: RaceBonusRule = DEFAULT_RACE_BONUS_RULE,
): RaceBonus {
  return raceBonusFromWins(
    tree.slots[a]?.wonRaces ?? [],
    tree.slots[b]?.wonRaces ?? [],
    tree.extraWins[slotPairKey(a, b)] ?? 0,
    data,
    rule,
  )
}

/**
 * Affinity breakdown for the career of the uma at `rootIndex` (0 = the
 * trainee, but parents run careers too — their subtree score matters for
 * factor farming). Links whose slots are empty or beyond the tree edge are
 * omitted.
 */
export function affinityBreakdown(
  tree: Tree,
  rootIndex: number,
  data: GameData,
  opts: AffinityOptions = {},
): AffinityBreakdown {
  const rule = opts.raceBonusRule ?? DEFAULT_RACE_BONUS_RULE
  const mode = opts.slotAffinityMode ?? DEFAULT_SLOT_AFFINITY_MODE

  const charOf = (slot: number): number | null => {
    if (slot >= TREE_SLOTS) return null
    const build = tree.slots[slot]
    if (!build) return null
    return data.charaIdOf(build.variantId) ?? null
  }

  const links: AffinityLink[] = []
  const perSlot: Record<number, number> = {}
  const [p1, p2] = parentsOf(rootIndex)
  const rootChar = charOf(rootIndex)

  const pushPairLink = (a: number, b: number, kind: LinkKind, withWins: boolean): AffinityLink | null => {
    const ca = charOf(a)
    const cb = charOf(b)
    if (ca === null || cb === null) return null
    const selfLink = ca === cb
    const pairPoints = selfLink ? 0 : data.relations.pair(ca, cb)
    const bonus = selfLink || !withWins ? { sharedWins: 0, crownSets: 0, points: 0 } : raceBonus(tree, a, b, data, rule)
    const link: AffinityLink = {
      a, b, kind, pairPoints, trioPoints: 0,
      sharedWins: bonus.sharedWins, crownSets: bonus.crownSets, winBonus: bonus.points,
      total: pairPoints + bonus.points, selfLink,
    }
    links.push(link)
    return link
  }

  const lp1 = pushPairLink(rootIndex, p1, 'trainee-parent', false)
  const lp2 = pushPairLink(rootIndex, p2, 'trainee-parent', false)
  const lpp = pushPairLink(p1, p2, 'parent-parent', true)

  const gpLinkTotals: Record<number, number> = {}
  for (const parent of [p1, p2]) {
    const cp = charOf(parent)
    for (const gp of parentsOf(parent)) {
      const cgp = charOf(gp)
      if (cp === null || cgp === null || rootChar === null) continue
      // The trio is zeroed on ANY duplicate among the three (the legal case
      // being the trainee as her own grandparent).
      const selfLink = cgp === rootChar || cgp === cp || cp === rootChar
      const trioPoints = selfLink ? 0 : data.relations.trio(rootChar, cp, cgp)
      const bonus = selfLink ? { sharedWins: 0, crownSets: 0, points: 0 } : raceBonus(tree, parent, gp, data, rule)
      const link: AffinityLink = {
        a: parent, b: gp, kind: 'parent-grandparent', pairPoints: 0, trioPoints,
        sharedWins: bonus.sharedWins, crownSets: bonus.crownSets, winBonus: bonus.points,
        total: trioPoints + bonus.points, selfLink,
      }
      links.push(link)
      gpLinkTotals[parent] = (gpLinkTotals[parent] ?? 0) + link.total
      // Grandparent individual affinity: trio contribution + race bonus to
      // her parent (identical in both modes except to-trainee's plain pair).
      perSlot[gp] =
        mode === 'individual'
          ? link.total
          : cgp === rootChar ? 0 : pairAffinity(data, rootChar, cgp)
    }
  }

  // Parent individual affinity: pair with trainee + pair with other parent
  // + both grandparent trios + the race bonuses on all those links.
  for (const [parent, lp] of [[p1, lp1], [p2, lp2]] as const) {
    if (!lp) continue
    perSlot[parent] =
      mode === 'individual'
        ? lp.total + (lpp?.total ?? 0) + (gpLinkTotals[parent] ?? 0)
        : lp.total
  }

  const total = links.reduce((sum, l) => sum + l.total, 0)
  return { rootIndex, links, total, tier: affinityTier(total), perSlot }
}

export interface LineageError {
  slots: [number, number]
  message: string
}

/**
 * Illegal duplicate placements (GameTora flags these as errors): a character
 * cannot be her own parent, both parents cannot match, a parent cannot be her
 * own grandparent, and the two grandparents on one side cannot match.
 * (Trainee as a grandparent is LEGAL and not reported.)
 */
export function lineageErrors(tree: Tree, rootIndex: number, data: GameData): LineageError[] {
  const charOf = (slot: number): number | null => {
    if (slot >= TREE_SLOTS) return null
    const build = tree.slots[slot]
    return build ? (data.charaIdOf(build.variantId) ?? null) : null
  }
  const errors: LineageError[] = []
  const same = (a: number, b: number) => {
    const ca = charOf(a)
    return ca !== null && ca === charOf(b)
  }
  const [p1, p2] = parentsOf(rootIndex)
  if (same(rootIndex, p1)) errors.push({ slots: [rootIndex, p1], message: 'A character cannot be her own parent.' })
  if (same(rootIndex, p2)) errors.push({ slots: [rootIndex, p2], message: 'A character cannot be her own parent.' })
  if (same(p1, p2)) errors.push({ slots: [p1, p2], message: 'The two legacies cannot be the same character.' })
  for (const parent of [p1, p2]) {
    const [g1, g2] = parentsOf(parent)
    if (same(parent, g1)) errors.push({ slots: [parent, g1], message: 'A legacy cannot be her own parent.' })
    if (same(parent, g2)) errors.push({ slots: [parent, g2], message: 'A legacy cannot be her own parent.' })
    if (same(g1, g2)) errors.push({ slots: [g1, g2], message: 'The two parents of a legacy cannot be the same character.' })
  }
  return errors
}
