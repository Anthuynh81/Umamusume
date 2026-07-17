/**
 * Builds the GameData instance from the static JSON snapshots produced by
 * scripts/fetch-data.mjs. This is the only module that touches the raw files.
 */
import charactersJson from './static/characters.json'
import racesJson from './static/races.json'
import relationsJson from './static/relations.json'
import skillsJson from './static/skills.json'
import sparksJson from './static/sparks.json'
import uniqueSkillsJson from './static/unique-skills.json'
import variantsJson from './static/variants.json'
import { RelationTableBackend } from './relations'
import type { RelationTables } from './relations'
import { GameData } from './types'
import type { CharacterDef, RaceDef, SkillDef, SparkDef, UniqueSkillDef, VariantDef } from './types'

let cached: GameData | null = null

export function loadGameData(): GameData {
  if (!cached) {
    cached = new GameData({
      characters: charactersJson as CharacterDef[],
      variants: variantsJson as VariantDef[],
      sparks: sparksJson as SparkDef[],
      races: racesJson as RaceDef[],
      uniqueSkills: uniqueSkillsJson as UniqueSkillDef[],
      skills: skillsJson as SkillDef[],
      relations: new RelationTableBackend(relationsJson as RelationTables),
    })
  }
  return cached
}
