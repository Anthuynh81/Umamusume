/**
 * Core domain types for Sparkline.
 *
 * Terminology (see docs/project-brief.md): UI-facing names use Global (EN)
 * terms — Legacy, Sparks, Inspiration, Trainee, Aptitude. Code identifiers
 * follow the same convention.
 *
 * Two distinct probabilities exist in this domain and must never be conflated:
 *  - "spark chance"  = generation: does a trained uma END her career with a spark
 *  - "proc chance"   = inheritance: does an existing lineage spark ACTIVATE for the trainee
 */

// ---------------------------------------------------------------------------
// Aptitudes
// ---------------------------------------------------------------------------

export const APTITUDE_KEYS = [
  'turf', 'dirt',
  'sprint', 'mile', 'medium', 'long',
  'front', 'pace', 'late', 'end',
] as const
export type AptitudeKey = (typeof APTITUDE_KEYS)[number]

export const APTITUDE_GROUPS = {
  surface: ['turf', 'dirt'],
  distance: ['sprint', 'mile', 'medium', 'long'],
  style: ['front', 'pace', 'late', 'end'],
} as const satisfies Record<string, readonly AptitudeKey[]>

/** Display labels (Global terms). Running styles per EN release. */
export const APTITUDE_LABELS: Record<AptitudeKey, string> = {
  turf: 'Turf', dirt: 'Dirt',
  sprint: 'Sprint', mile: 'Mile', medium: 'Medium', long: 'Long',
  front: 'Front Runner', pace: 'Pace Chaser', late: 'Late Surger', end: 'End Closer',
}

/** Worst → best. Index in this array is the numeric stage used for raise math. */
export const GRADES = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'] as const
export type Grade = (typeof GRADES)[number]

export type Aptitudes = Record<AptitudeKey, Grade>

// ---------------------------------------------------------------------------
// Stats (blue sparks)
// ---------------------------------------------------------------------------

export const BLUE_STATS = ['speed', 'stamina', 'power', 'guts', 'wit'] as const
export type BlueStat = (typeof BLUE_STATS)[number]

export const BLUE_STAT_LABELS: Record<BlueStat, string> = {
  speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit',
}

// ---------------------------------------------------------------------------
// Sparks
// ---------------------------------------------------------------------------

export type Stars = 1 | 2 | 3

export interface BlueSpark { stat: BlueStat; stars: Stars }
export interface PinkSpark { aptitude: AptitudeKey; stars: Stars }

/**
 * Green spark = the uma's OWN unique skill (inherited uniques never re-spark),
 * so its identity is implied by the slot's variant; only stars are stored.
 */
export interface GreenSpark { stars: Stars }

export const WHITE_KINDS = ['skill', 'race', 'scenario'] as const
export type WhiteKind = (typeof WHITE_KINDS)[number]

/**
 * White spark. `refId` meaning depends on `kind`:
 *  - skill:    game skill id (static skill table)
 *  - race:     game race id (static G1 race table)
 *  - scenario: scenario id (static scenario table)
 */
export interface WhiteSpark { kind: WhiteKind; refId: number; stars: Stars }

// ---------------------------------------------------------------------------
// Uma build (contents of one tree slot / one library entry's spark loadout)
// ---------------------------------------------------------------------------

/** Farming-checklist status of a tree slot (phase 2, modeled from day one). */
export const SLOT_STATUSES = ['planned', 'farmed', 'borrowed', 'rental'] as const
export type SlotStatus = (typeof SLOT_STATUSES)[number]

export interface UmaBuild {
  /** Card/outfit id from static data. Base character = variant's charaId. */
  variantId: number
  /** Sparks may be partially planned; null = not decided yet. */
  blue: BlueSpark | null
  pink: PinkSpark | null
  green: GreenSpark | null
  whites: WhiteSpark[]
  /** G1 race ids won during her career — drives shared-win affinity bonuses. */
  wonRaces: number[]
  memo: string
  status: SlotStatus
}

export function emptyBuild(variantId: number): UmaBuild {
  return { variantId, blue: null, pink: null, green: null, whites: [], wonRaces: [], memo: '', status: 'planned' }
}

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------

/**
 * Heap-indexed ancestry tree, trainee at 0; the two legacies (game "parents")
 * of slot i sit at 2i+1 and 2i+2. Four ancestor generations = 31 slots, which
 * matches the JP planner's depth. On Global only generations 1-2 (parents +
 * grandparents, slots 1..6) affect the trainee; deeper slots are planning
 * slots for building those grandparents.
 */
export const TREE_SLOTS = 31

/** Key for a pair of slot indices, lower index first: "1-2". */
export type SlotPairKey = `${number}-${number}`

export function slotPairKey(a: number, b: number): SlotPairKey {
  return a <= b ? `${a}-${b}` : `${b}-${a}`
}

export interface Tree {
  /** length TREE_SLOTS; null = empty slot. */
  slots: (UmaBuild | null)[]
  /**
   * Manual shared-G1-win counts per slot pair, ADDED to the computed
   * intersection of the two slots' wonRaces. Lets users who just know
   * "these two share 4 wins" skip the race picker.
   */
  extraWins: Partial<Record<SlotPairKey, number>>
}

export function emptyTree(): Tree {
  return { slots: Array.from({ length: TREE_SLOTS }, () => null), extraWins: {} }
}
