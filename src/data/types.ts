/**
 * Static game-data shapes. JSON produced by scripts/fetch-data.mjs conforms
 * to these; the engine consumes them through the GameData lookup wrapper so
 * UI and engine never touch raw arrays.
 *
 * Id spaces (all stable game ids, safe for share URLs):
 *  - character id  = base chara id (1001 = Special Week)
 *  - variant id    = card id (100101 = Special Week [Special Dreamer])
 *  - spark id      = factor id (2xxxx skill, 1xxxx race, 3xxxx scenario)
 *  - race id       = race id (1001 = February Stakes), used in wonRaces
 */
import type { Aptitudes, WhiteKind } from '../model/types'
import type { WhiteTier } from './config/rates'

export interface CharacterDef {
  id: number
  name: string
  /** Theme color for the silhouette avatar layer, "#rrggbb" if known. */
  color: string | null
  /**
   * Official thumbnail URL (hotlinked from the game's CDN via umapyoi, ©
   * Cygames — never vendored). Null → silhouette avatar.
   */
  image: string | null
  /** Playable on Global. */
  global: boolean
}

export interface VariantDef {
  /** Card/outfit id — the id stored in tree slots and share URLs. */
  id: number
  charaId: number
  /** Outfit/variant title, e.g. "Special Dreamer". */
  title: string
  /** Card rarity 1-3; greens generate only at 3★+ (uncapped). */
  rarity: number
  aptitudes: Aptitudes
  /** Unique skill id (green spark identity). */
  uniqueSkillId: number | null
  /** Released on Global. */
  global: boolean
}

/**
 * A white-sparkable entity: skill, G1 race, or scenario (factor table).
 * A skill spark exists once per skill GROUP, named after the ○/white
 * version; holding the ◎/gold version only raises the GENERATION chance
 * (WhiteTier is a farming-calculator input, not a spark property).
 */
export interface SparkDef {
  /** Factor id — the WhiteSpark.refId. */
  id: number
  kind: WhiteKind
  name: string
  /** For race sparks: the race id this factor corresponds to. */
  raceId: number | null
  global: boolean
}

/**
 * Graded race for the won-races picker feeding shared-win affinity.
 * Ids are the race-calendar ids GameTora uses (crown triples reference
 * these). grade: 100 = G1, 200 = G2, 300 = G3.
 */
export interface RaceDef {
  id: number
  name: string
  grade: number
  global: boolean
}

/** Unique skill names, for labeling green sparks. */
export interface UniqueSkillDef {
  id: number
  name: string
}

/**
 * Full skill table (every learnable skill, all versions). `tier` is the
 * version this id represents; `factorId` links the skill's group to its
 * white-spark factor (null for skills that never spark, e.g. uniques).
 */
export interface SkillDef {
  id: number
  name: string
  tier: WhiteTier | 'unique' | 'other'
  factorId: number | null
}

/** Support card: which skills a card can teach during a training run. */
export interface SupportCardDef {
  id: number
  name: string
  rarity: number
  type: string | null
  /** Hint + event skill ids. */
  skillIds: number[]
  global: boolean
}

/**
 * Base-affinity backend. The primary implementation derives points from the
 * Global succession_relation tables; a manual-entry fallback lets the tool
 * work without that data (brief: never block the tree builder on affinity).
 */
export interface RelationBackend {
  /** Base relation points between two BASE characters (not variants). */
  pair(charaA: number, charaB: number): number
  /** Points from relation groups shared by all three, when data supports it. */
  trio(a: number, b: number, c: number): number
}

export interface GameDataInput {
  characters: CharacterDef[]
  variants: VariantDef[]
  sparks: SparkDef[]
  races: RaceDef[]
  uniqueSkills: UniqueSkillDef[]
  skills: SkillDef[]
  supportCards: SupportCardDef[]
  relations: RelationBackend
}

export class GameData {
  readonly characters: CharacterDef[]
  readonly variants: VariantDef[]
  readonly sparks: SparkDef[]
  readonly races: RaceDef[]
  readonly uniqueSkills: UniqueSkillDef[]
  readonly skills: SkillDef[]
  readonly supportCards: SupportCardDef[]
  readonly relations: RelationBackend

  private charaById: Map<number, CharacterDef>
  private variantById: Map<number, VariantDef>
  private sparkById: Map<number, SparkDef>
  private raceById: Map<number, RaceDef>
  private uniqueById: Map<number, UniqueSkillDef>
  private skillById: Map<number, SkillDef>

  constructor(input: GameDataInput) {
    this.characters = input.characters
    this.variants = input.variants
    this.sparks = input.sparks
    this.races = input.races
    this.uniqueSkills = input.uniqueSkills
    this.skills = input.skills
    this.supportCards = input.supportCards
    this.relations = input.relations
    this.charaById = new Map(this.characters.map((c) => [c.id, c]))
    this.variantById = new Map(this.variants.map((v) => [v.id, v]))
    this.sparkById = new Map(this.sparks.map((s) => [s.id, s]))
    this.raceById = new Map(this.races.map((r) => [r.id, r]))
    this.uniqueById = new Map(this.uniqueSkills.map((u) => [u.id, u]))
    this.skillById = new Map(this.skills.map((s) => [s.id, s]))
  }

  skill(id: number): SkillDef | undefined {
    return this.skillById.get(id)
  }

  character(id: number): CharacterDef | undefined {
    return this.charaById.get(id)
  }

  variant(id: number): VariantDef | undefined {
    return this.variantById.get(id)
  }

  /** Base character id for a variant — affinity/self-lineage identity. */
  charaIdOf(variantId: number): number | undefined {
    return this.variantById.get(variantId)?.charaId
  }

  spark(id: number): SparkDef | undefined {
    return this.sparkById.get(id)
  }

  race(id: number): RaceDef | undefined {
    return this.raceById.get(id)
  }

  uniqueSkill(id: number): UniqueSkillDef | undefined {
    return this.uniqueById.get(id)
  }

  variantsOf(charaId: number): VariantDef[] {
    return this.variants.filter((v) => v.charaId === charaId)
  }
}

/** Fallback backend: user-entered pair values; unknown pairs are 0. */
export class ManualRelationBackend implements RelationBackend {
  private entries: ReadonlyMap<string, number>

  constructor(entries: ReadonlyMap<string, number> = new Map()) {
    this.entries = entries
  }

  static key(a: number, b: number): string {
    return a <= b ? `${a}:${b}` : `${b}:${a}`
  }

  pair(a: number, b: number): number {
    return this.entries.get(ManualRelationBackend.key(a, b)) ?? 0
  }

  trio(): number {
    return 0
  }
}
