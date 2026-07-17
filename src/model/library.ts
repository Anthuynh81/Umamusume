/**
 * Uma library entry: a trained (or planned) uma saved for reuse across trees.
 * Schema baseline follows GameTora's "saved veterans" (character/outfit,
 * sparks, skills, score, trained-at date, won races, notes, custom tags) plus
 * Sparkline's own fields: owned flag and loop membership / farming status.
 */
import type { UmaBuild } from './types'

export interface LibraryUma {
  /** Dexie auto-increment primary key. */
  id?: number
  name: string
  /** Variant + sparks + won races; memo doubles as the notes field. */
  build: UmaBuild
  /** Career rating points (e.g. 12345), if recorded. */
  score: number | null
  /** Rating rank letter shown in game (e.g. "A+", "SS") — gates star tables. */
  rank: string | null
  /** Skill ids the uma holds (context for planning; whites capture sparks). */
  skillIds: number[]
  /** ISO date the career finished. */
  trainedAt: string | null
  /** Custom text/emoji tags for filtering. */
  tags: string[]
  /** True if this uma exists in the user's account (vs. aspirational/borrowed). */
  owned: boolean
  /** Legacy-loop ids this uma belongs to (phase 2 loop planner). */
  loopIds: number[]
  createdAt: string
  updatedAt: string
}

/** JSON backup envelope for export/import. */
export interface LibraryExport {
  app: 'sparkline'
  format: 'library'
  version: 1
  exportedAt: string
  umas: LibraryUma[]
}
