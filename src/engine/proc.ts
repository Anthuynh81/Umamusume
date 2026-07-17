/**
 * Proc (inheritance activation) probabilities: per inspiration event and per
 * career. NOT to be confused with generation "spark chances" (generation.ts).
 *
 * Model (VERIFY white-proc / blue-proc-value): all probabilistic procs roll
 * at the two inspiration events; proc = base(class, stars) × (1 + individual
 * affinity/100), identical for all six slots. Blues additionally apply a
 * GUARANTEED career-start bonus (+5/+12/+21) that is not part of these rolls.
 */
import {
  DEFAULT_POSITION_MODEL, INSPIRATION_EVENTS, PROC_BASE, affinityMultiplier,
} from '../data/config/rates'
import type { PositionModel, ProcClass } from '../data/config/rates'
import type { GameData } from '../data/types'
import { GRANDPARENT_SLOTS, PARENT_SLOTS } from '../model/tree'
import type { AptitudeKey, BlueStat, Stars, Tree, WhiteKind } from '../model/types'

export type SparkColor = 'blue' | 'pink' | 'green' | 'white'

/** Proc class for a spark (race whites proc lower than skill whites). */
export function procClassOf(color: SparkColor, kind: WhiteKind | null): ProcClass {
  if (color !== 'white') return color
  if (kind === 'race') return 'whiteRace'
  if (kind === 'scenario') return 'whiteScenario'
  return 'whiteSkill'
}

/**
 * Chance one spark copy activates at ONE inspiration event.
 * The 'grandparent-halved' legacy model halves the affinity-adjusted rate for
 * grandparent slots; the default (verified) model treats all six slots alike
 * and lets per-slot individual affinity produce the observed gap.
 */
export function perEventProc(
  cls: ProcClass,
  stars: Stars,
  affinity: number,
  opts: { isGrandparent?: boolean; positionModel?: PositionModel } = {},
): number {
  const model = opts.positionModel ?? DEFAULT_POSITION_MODEL
  let p = PROC_BASE[cls][stars] * affinityMultiplier(affinity)
  if (model === 'grandparent-halved' && opts.isGrandparent) p /= 2
  return Math.min(1, p)
}

/** Combined chance that at least one of several copies procs in one event. */
export function combineWithinEvent(ps: number[]): number {
  return 1 - ps.reduce((acc, p) => acc * (1 - p), 1)
}

/** Cumulative chance across the career's inspiration events. */
export function perCareerProc(pEvent: number, events: number = INSPIRATION_EVENTS): number {
  return 1 - (1 - pEvent) ** events
}

/** One row of the inheritance-rate panel: a spark identity across the tree. */
export interface SparkRateRow {
  /** Stable grouping key, e.g. "white:skill:20034", "green:900541", "pink:turf". */
  key: string
  color: SparkColor
  kind: WhiteKind | null
  /** Factor id for whites; unique skill id for greens; null otherwise. */
  refId: number | null
  /** For pink/blue rows: which aptitude/stat. */
  aptitude: AptitudeKey | null
  stat: BlueStat | null
  /** Contributing copies: slot index + stars, one per copy in the lineage. */
  copies: { slot: number; stars: Stars }[]
  perEvent: number
  perCareer: number
}

/**
 * Per-spark inheritance rates for the trainee across the six active slots.
 * `slotAffinity` comes from affinityBreakdown().perSlot. Identical sparks are
 * grouped (whites by kind+refId; greens by unique skill so a character
 * appearing twice combines; pinks by aptitude; blues by stat).
 *
 * Blue rows describe the EVENT procs only — the career-start blue bonus is
 * guaranteed and reported by the aptitude/stat displays instead.
 */
export function inheritanceRates(
  tree: Tree,
  data: GameData,
  slotAffinity: Record<number, number>,
  opts: { positionModel?: PositionModel } = {},
): SparkRateRow[] {
  const rows = new Map<string, SparkRateRow>()

  const add = (
    key: string,
    fields: Pick<SparkRateRow, 'color' | 'kind' | 'refId' | 'aptitude' | 'stat'>,
    slot: number,
    stars: Stars,
  ) => {
    let row = rows.get(key)
    if (!row) {
      row = { key, ...fields, copies: [], perEvent: 0, perCareer: 0 }
      rows.set(key, row)
    }
    row.copies.push({ slot, stars })
  }

  for (const slot of [...PARENT_SLOTS, ...GRANDPARENT_SLOTS]) {
    const build = tree.slots[slot]
    if (!build) continue

    for (const w of build.whites) {
      add(`white:${w.kind}:${w.refId}`, { color: 'white', kind: w.kind, refId: w.refId, aptitude: null, stat: null }, slot, w.stars)
    }
    if (build.green) {
      const uniqueId = data.variant(build.variantId)?.uniqueSkillId ?? null
      const key = uniqueId !== null ? `green:${uniqueId}` : `green:slot${slot}`
      add(key, { color: 'green', kind: null, refId: uniqueId, aptitude: null, stat: null }, slot, build.green.stars)
    }
    if (build.pink) {
      add(`pink:${build.pink.aptitude}`, { color: 'pink', kind: null, refId: null, aptitude: build.pink.aptitude, stat: null }, slot, build.pink.stars)
    }
    if (build.blue) {
      add(`blue:${build.blue.stat}`, { color: 'blue', kind: null, refId: null, aptitude: null, stat: build.blue.stat }, slot, build.blue.stars)
    }
  }

  for (const row of rows.values()) {
    const cls = procClassOf(row.color, row.kind)
    const perCopy = row.copies.map(({ slot, stars }) =>
      perEventProc(cls, stars, slotAffinity[slot] ?? 0, {
        isGrandparent: GRANDPARENT_SLOTS.includes(slot),
        positionModel: opts.positionModel,
      }),
    )
    row.perEvent = combineWithinEvent(perCopy)
    row.perCareer = perCareerProc(row.perEvent)
  }

  return [...rows.values()].sort((a, b) => b.perCareer - a.perCareer)
}
