/**
 * Importer for UmaExtractor (github.com/xancia/UmaExtractor, a fork of
 * rockisch/umadump) `data.json` exports — trained-uma ("veteran") dumps read
 * from the game client's memory.
 *
 * Id spaces (verified against the game's single_mode factor tables and the
 * parent repo's 180-record sample; see docs/research/umaextractor-format.md):
 *  - card_id: 6-digit card/outfit id — identical to our variant ids.
 *  - factor_id_array entries encode identity AND star level:
 *      3-digit  BLUE   floor(id/100) = stat (1 Speed … 5 Wit), id%100 = ★
 *      4-digit  PINK   floor(id/100) = aptitude prefix (table below), id%100 = ★
 *      7-digit  WHITE  floor(id/100) = factor group id (our SparkDef id), id%100 = ★
 *      8-digit  GREEN  floor(id/100) = card_id, id%100 = ★
 *  - skill_array[].skill_id: skill ids (a different space from factors).
 *  - win_saddle_id_array: single_mode_wins_saddle ids → race instance ids via
 *    the win-saddles.json snapshot (extracted from the local master.mdb by
 *    scripts/extract-mdb.mjs). Only races in our graded table are kept,
 *    matching the affinity engine's allowed set.
 *
 * Ancestors: each veteran's succession_chara_array carries the full spark
 * loadout of her 2 parents + 4 grandparents; these can optionally be imported
 * as separate (deduplicated) library entries. Other players' identifiers in
 * those arrays are never stored — owner_viewer_id is read only as a
 * borrowed/own boolean.
 */
import type { LibraryUma } from '../../model/library'
import { BLUE_STATS } from '../../model/types'
import type { AptitudeKey, Stars, UmaBuild } from '../../model/types'
import winSaddlesJson from '../static/win-saddles.json'
import type { GameData } from '../types'

/** Pink factor prefixes, from the game's factor table (11 Turf … 34 Long). */
const PINK_PREFIX: Readonly<Record<number, AptitudeKey>> = {
  11: 'turf', 12: 'dirt',
  21: 'front', 22: 'pace', 23: 'late', 24: 'end',
  31: 'sprint', 32: 'mile', 33: 'medium', 34: 'long',
}

const WIN_SADDLES = winSaddlesJson as Record<string, number[]>

/** Newer client exports wrap factor ids in objects (level is unused). */
export interface FactorInfo {
  factor_id: number
  level?: number
}

export interface SuccessionEntry {
  card_id: number
  factor_id_array?: number[]
  factor_info_array?: FactorInfo[]
  win_saddle_id_array?: number[]
  position_id?: number
  owner_viewer_id?: number
}

export interface UmaExtractorRecord {
  card_id: number
  /** Legacy exports: plain factor id array. */
  factor_id_array?: number[]
  /** Current exports: {factor_id, level} objects. */
  factor_info_array?: FactorInfo[]
  skill_array?: { skill_id: number; level: number }[]
  support_card_list?: { support_card_id: number; limit_break_count?: number }[]
  win_saddle_id_array?: number[]
  rank_score?: number
  fans?: number
  create_time?: string
  trained_chara_id?: number
  succession_trained_chara_id_1?: number
  succession_trained_chara_id_2?: number
  succession_chara_array?: SuccessionEntry[]
}

/** Factor ids from either export format (same id encoding in both). */
function factorIdsOf(source: { factor_id_array?: number[]; factor_info_array?: FactorInfo[] }): number[] {
  if (source.factor_id_array && source.factor_id_array.length > 0) return source.factor_id_array
  return (source.factor_info_array ?? []).map((f) => f.factor_id).filter((id) => typeof id === 'number')
}

export interface ImportedUma {
  entry: Omit<LibraryUma, 'id' | 'createdAt' | 'updatedAt'>
  warnings: string[]
}

export interface ImportResult {
  umas: ImportedUma[]
  /** Distinct pedigree ancestors, deduplicated and not among `umas`. */
  ancestors: ImportedUma[]
  /**
   * Support cards seen across the veterans' runs (a practical ownership
   * proxy) with the highest limit-break observed.
   */
  supportCards: { id: number; limitBreak: number }[]
  skipped: number
  warnings: string[]
}

function parseStars(raw: number, factorId: number, warnings: string[]): Stars | null {
  if (raw >= 1 && raw <= 3) return raw as Stars
  warnings.push(`factor ${factorId}: star level ${raw} out of range`)
  return null
}

/** Decodes one factor id into the build; returns false if unrecognized. */
function applyFactor(build: UmaBuild, id: number, data: GameData, warnings: string[]): boolean {
  if (id >= 100 && id < 600) {
    const stat = BLUE_STATS[Math.floor(id / 100) - 1]
    const stars = parseStars(id % 100, id, warnings)
    if (!stat || stars === null) return false
    if (build.blue) warnings.push(`multiple blue factors; keeping ${build.blue.stat}`)
    else build.blue = { stat, stars }
    return true
  }
  if (id >= 1000 && id < 10000) {
    const aptitude = PINK_PREFIX[Math.floor(id / 100)]
    const stars = parseStars(id % 100, id, warnings)
    if (!aptitude || stars === null) {
      if (!aptitude) warnings.push(`unknown pink factor prefix in ${id}`)
      return false
    }
    if (build.pink) warnings.push(`multiple pink factors; keeping ${build.pink.aptitude}`)
    else build.pink = { aptitude, stars }
    return true
  }
  if (id >= 1_000_000 && id < 10_000_000) {
    const groupId = Math.floor(id / 100)
    const stars = parseStars(id % 100, id, warnings)
    if (stars === null) return false
    const spark = data.spark(groupId)
    if (!spark) {
      warnings.push(`unknown white factor group ${groupId} (id ${id})`)
      return false
    }
    build.whites.push({ kind: spark.kind, refId: groupId, stars })
    return true
  }
  if (id >= 10_000_000) {
    const stars = parseStars(id % 100, id, warnings)
    if (stars === null) return false
    // Green factor: floor(id/100) is the generating card id — the uma's own
    // card in her own factor array; stars are all we store.
    if (build.green) warnings.push('multiple green factors; keeping the first')
    else build.green = { stars }
    return true
  }
  warnings.push(`unrecognized factor id ${id}`)
  return false
}

/** Won races from win-saddle ids, kept to races our graded table knows. */
function wonRacesFromSaddles(saddleIds: number[] | undefined, data: GameData): number[] {
  const races = new Set<number>()
  for (const saddle of saddleIds ?? []) {
    for (const raceId of WIN_SADDLES[saddle] ?? []) {
      if (data.race(raceId)) races.add(raceId)
    }
  }
  return [...races].sort((a, b) => a - b)
}

function buildFrom(
  cardId: number,
  factors: number[],
  saddles: number[] | undefined,
  data: GameData,
  warnings: string[],
): UmaBuild {
  const build: UmaBuild = {
    variantId: cardId,
    blue: null,
    pink: null,
    green: null,
    whites: [],
    wonRaces: wonRacesFromSaddles(saddles, data),
    memo: '',
    status: 'farmed',
  }
  for (const id of factors) applyFactor(build, id, data, warnings)
  build.whites.sort((a, b) => a.refId - b.refId)
  return build
}

function displayName(cardId: number, data: GameData, suffix = ''): string {
  const variant = data.variant(cardId)
  const chara = variant ? data.character(variant.charaId) : undefined
  return [
    chara?.name ?? `Card ${cardId}`,
    variant?.title ? `(${variant.title})` : '',
    suffix,
  ].filter(Boolean).join(' ')
}

function importRecord(record: UmaExtractorRecord, data: GameData): ImportedUma | null {
  if (!data.variant(record.card_id)) return null
  const warnings: string[] = []
  const build = buildFrom(record.card_id, factorIdsOf(record), record.win_saddle_id_array, data, warnings)

  return {
    entry: {
      name: displayName(record.card_id, data, record.rank_score ? `· ${record.rank_score}` : ''),
      build,
      score: record.rank_score ?? null,
      rank: null,
      skillIds: (record.skill_array ?? []).map((s) => s.skill_id),
      heldSkills: (record.skill_array ?? []).map((s) => ({ id: s.skill_id, level: s.level ?? 1 })),
      trainedAt: record.create_time ? record.create_time.replace(' ', 'T') : null,
      tags: ['umaextractor'],
      owned: true,
      loopIds: [],
    },
    warnings,
  }
}

/** Content key for ancestor deduplication (and against main veterans). */
function contentKey(cardId: number, factors: number[], saddles: number[] | undefined): string {
  return `${cardId}|${[...factors].sort((a, b) => a - b).join(',')}|${[...(saddles ?? [])].sort((a, b) => a - b).join(',')}`
}

/**
 * Parses a full UmaExtractor data.json (array of trained-chara records).
 * Veterans are always parsed; pedigree ancestors are returned separately so
 * the caller can offer them as an optional second import.
 */
export function importUmaExtractor(raw: unknown, data: GameData): ImportResult {
  if (!Array.isArray(raw)) throw new Error('Not an UmaExtractor export (expected a JSON array of trained umas).')

  const umas: ImportedUma[] = []
  let skipped = 0
  const warnings: string[] = []
  const records: UmaExtractorRecord[] = []
  const seenKeys = new Set<string>()
  const exportedTrainedIds = new Set<number>()

  for (const item of raw) {
    if (!item || typeof item !== 'object' || typeof (item as UmaExtractorRecord).card_id !== 'number') {
      skipped++
      continue
    }
    const record = item as UmaExtractorRecord
    const imported = importRecord(record, data)
    if (!imported) {
      skipped++
      warnings.push(`card ${record.card_id}: unknown card id — skipped (data snapshot may be older than the game)`)
      continue
    }
    records.push(record)
    umas.push(imported)
    seenKeys.add(contentKey(record.card_id, factorIdsOf(record), record.win_saddle_id_array))
    if (record.trained_chara_id !== undefined) exportedTrainedIds.add(record.trained_chara_id)
  }

  // Ancestors: dedupe by content; skip parent entries whose trained uma is
  // itself in the export (positions 10/20 link via succession_trained_chara_id).
  const ancestors: ImportedUma[] = []
  for (const record of records) {
    for (const anc of record.succession_chara_array ?? []) {
      if (typeof anc.card_id !== 'number' || !data.variant(anc.card_id)) continue
      const isParentSlot = anc.position_id === 10 || anc.position_id === 20
      if (isParentSlot) {
        const linked = anc.position_id === 10 ? record.succession_trained_chara_id_1 : record.succession_trained_chara_id_2
        if (linked !== undefined && exportedTrainedIds.has(linked)) continue
      }
      const key = contentKey(anc.card_id, factorIdsOf(anc), anc.win_saddle_id_array)
      if (seenKeys.has(key)) continue
      seenKeys.add(key)

      const ancWarnings: string[] = []
      const build = buildFrom(anc.card_id, factorIdsOf(anc), anc.win_saddle_id_array, data, ancWarnings)
      const borrowed = (anc.owner_viewer_id ?? 0) !== 0
      build.status = borrowed ? 'borrowed' : 'farmed'
      ancestors.push({
        entry: {
          name: displayName(anc.card_id, data, '· ancestor'),
          build,
          score: null,
          rank: null,
          skillIds: [],
          trainedAt: null,
          tags: borrowed ? ['umaextractor', 'ancestor', 'borrowed'] : ['umaextractor', 'ancestor'],
          owned: !borrowed,
          loopIds: [],
        },
        warnings: ancWarnings,
      })
    }
  }

  // Tripwire: if nothing decoded any sparks, the export format has probably
  // changed again — say so loudly instead of importing empty umas.
  if (
    umas.length > 0 &&
    umas.every(({ entry: { build } }) => !build.blue && !build.pink && !build.green && build.whites.length === 0)
  ) {
    warnings.push(
      'No sparks could be decoded from any record — the UmaExtractor export format may have changed. Please report this.',
    )
  }

  const supportMax = new Map<number, number>()
  for (const record of records) {
    for (const sc of record.support_card_list ?? []) {
      if (typeof sc.support_card_id !== 'number') continue
      supportMax.set(sc.support_card_id, Math.max(supportMax.get(sc.support_card_id) ?? 0, sc.limit_break_count ?? 0))
    }
  }
  const supportCards = [...supportMax.entries()]
    .map(([id, limitBreak]) => ({ id, limitBreak }))
    .sort((a, b) => a.id - b.id)

  return { umas, ancestors, supportCards, skipped, warnings }
}
