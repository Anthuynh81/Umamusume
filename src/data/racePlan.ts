/**
 * Career race-plan data: graded calendar instances + per-character mandatory
 * objectives, produced by scripts/fetch-data.mjs from GameTora's
 * race_instances and ura-objectives files. Based on the URA career program;
 * newer scenarios can shift calendars slightly (documented caveat).
 */
import racePlanJson from './static/race-plan.json'

export interface RaceInstance {
  /** races.json id (instance-level, the id wonRaces uses). */
  raceId: number
  name: string
  /** 100 = G1, 200 = G2, 300 = G3. */
  grade: number
  /** Career year 1-3. */
  year: number
  month: number
  /** 1 = first half, 2 = second half. */
  half: number
  /** (year-1)*24 + (month-1)*2 + half. */
  turn: number
  /** Race length in meters. */
  distance: number
  /** 1 = turf, 2 = dirt. */
  terrain: number
  /**
   * Which server's career program offers this instance. Set by
   * scripts/extract-mdb.mjs against the Global client; absent (legacy data)
   * means 'both'.
   */
  server?: 'both' | 'global' | 'jp'
}

export interface CharRacePlan {
  debutTurn: number
  /** turn → race instance id the objective forces (0 = blocked, non-graded). */
  mandatory: Record<string, number>
}

export interface RacePlanData {
  instances: RaceInstance[]
  chars: Record<string, CharRacePlan>
}

export function loadRacePlan(): RacePlanData {
  return racePlanJson as RacePlanData
}
