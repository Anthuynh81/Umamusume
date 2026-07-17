/**
 * Extracts Global-authoritative data from the LOCAL game client's master.mdb
 * (plain SQLite). Run AFTER scripts/fetch-data.mjs — this script corrects the
 * web-sourced snapshots with the Global client's ground truth:
 *
 *  1. win-saddles.json — win-saddle id → race ids (for UmaExtractor imports).
 *  2. race-plan.json — merges the Global career program (single_mode_program)
 *     into the GameTora-derived calendar, tagging every instance
 *     server: 'both' | 'global' | 'jp'. Catches Global-only instances the
 *     shared web data lacks (e.g. the JBC races at the new dirt venues) and
 *     JP-only races (e.g. the L'Arc trials).
 *  3. races.json — adds Global races missing from the web data and flags
 *     JP-only entries global:false.
 *
 * Best-effort: requires the Steam Global client. Outputs are committed, so
 * the app works without the game; re-run after game updates.
 */
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const STATIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'static')
const MDB = path.join(process.env.USERPROFILE ?? '', 'AppData', 'LocalLow', 'Cygames', 'Umamusume', 'master', 'master.mdb')

function assert(cond, message) {
  if (!cond) throw new Error(`sanity check failed: ${message}`)
}

if (!existsSync(MDB)) {
  console.error(`master.mdb not found at ${MDB} — is the Global client installed? Keeping existing snapshots.`)
  process.exit(1)
}

// Work on a copy: never open the live DB the game may be using.
const tmp = mkdtempSync(path.join(tmpdir(), 'sparkline-mdb-'))
const copy = path.join(tmp, 'master.mdb')
copyFileSync(MDB, copy)

try {
  const db = new DatabaseSync(copy, { readOnly: true })

  // --- 1. win saddles --------------------------------------------------------
  const saddleRows = db.prepare('SELECT * FROM single_mode_wins_saddle').all()
  const saddles = {}
  for (const row of saddleRows) {
    const races = []
    for (let i = 1; i <= 8; i++) {
      const id = row[`race_instance_id_${i}`]
      if (id) races.push(id)
    }
    if (races.length > 0) saddles[row.id] = races
  }
  assert(Object.keys(saddles).length >= 100, `suspiciously few win saddles (${Object.keys(saddles).length})`)
  assert([100501, 101001, 101501].every((r) => (saddles['1'] ?? []).includes(r)), 'win saddle 1 is not the Triple Crown')
  writeFileSync(path.join(STATIC_DIR, 'win-saddles.json'), JSON.stringify(saddles), 'utf8')
  console.log(`wrote ${Object.keys(saddles).length} win-saddle mappings`)

  // --- 2. Global career race program ----------------------------------------
  // race_permission → career years: 1 junior, 2 classic, 3 classic+senior,
  // 4 senior (5 = EX races, never graded). All program groups count — big
  // races live in scenario-variant groups, not group 0.
  const PERM_YEARS = { 1: [1], 2: [2], 3: [2, 3], 4: [3] }
  const programRows = db.prepare(`
    SELECT DISTINCT p.race_instance_id AS id, p.month, p.half, p.race_permission AS perm,
           r.grade, r.id AS raceKindId, cs.distance, cs.ground
    FROM single_mode_program p
    JOIN race_instance ri ON ri.id = p.race_instance_id
    JOIN race r ON r.id = ri.race_id
    JOIN race_course_set cs ON cs.id = r.course_set
    WHERE r.grade IN (100, 200, 300) AND r."group" = 1
  `).all()

  const raceName = (raceKindId) => {
    for (const cat of [28, 32, 33]) {
      const t = db.prepare('SELECT text FROM text_data WHERE category=? AND "index"=?').get(cat, raceKindId)
      if (t?.text) return t.text
    }
    return null
  }

  /** key "raceId:year:month:half" → global instance record */
  const globalSlots = new Map()
  for (const row of programRows) {
    for (const year of PERM_YEARS[row.perm] ?? []) {
      const key = `${row.id}:${year}:${row.month}:${row.half}`
      if (!globalSlots.has(key)) {
        globalSlots.set(key, {
          raceId: row.id,
          name: raceName(row.raceKindId) ?? `Race ${row.id}`,
          grade: row.grade,
          year,
          month: row.month,
          half: row.half,
          turn: (year - 1) * 24 + (row.month - 1) * 2 + row.half,
          distance: row.distance,
          terrain: row.ground,
        })
      }
    }
  }
  assert(globalSlots.size >= 150, `suspiciously few Global race slots (${globalSlots.size})`)

  // --- merge into race-plan.json ---------------------------------------------
  const planPath = path.join(STATIC_DIR, 'race-plan.json')
  const plan = JSON.parse(readFileSync(planPath, 'utf8'))
  const merged = new Map()
  for (const inst of plan.instances) {
    const key = `${inst.raceId}:${inst.year}:${inst.month}:${inst.half}`
    merged.set(key, { ...inst, server: globalSlots.has(key) ? 'both' : 'jp' })
  }
  for (const [key, inst] of globalSlots) {
    if (!merged.has(key)) merged.set(key, { ...inst, server: 'global' })
  }
  plan.instances = [...merged.values()].sort((a, b) => a.turn - b.turn || a.raceId - b.raceId)

  assert(plan.instances.some((i) => i.raceId === 111101 && i.server === 'global'), 'new-venue JBC instances tagged global')
  assert(plan.instances.filter((i) => i.server === 'jp').length < 20, 'jp-only instance count sane')
  writeFileSync(planPath, JSON.stringify(plan), 'utf8')
  const counts = plan.instances.reduce((acc, i) => ((acc[i.server] = (acc[i.server] ?? 0) + 1), acc), {})
  console.log(`wrote race-plan.json (${JSON.stringify(counts)})`)

  // --- patch races.json -------------------------------------------------------
  const racesPath = path.join(STATIC_DIR, 'races.json')
  const races = JSON.parse(readFileSync(racesPath, 'utf8'))
  const globalRaceIds = new Set([...globalSlots.values()].map((i) => i.raceId))
  const knownIds = new Set(races.map((r) => r.id))
  let added = 0
  for (const inst of globalSlots.values()) {
    if (!knownIds.has(inst.raceId)) {
      races.push({ id: inst.raceId, name: inst.name, grade: inst.grade, global: true })
      knownIds.add(inst.raceId)
      added++
    }
  }
  for (const r of races) r.global = globalRaceIds.has(r.id)
  races.sort((a, b) => a.grade - b.grade || a.id - b.id)
  assert(races.find((r) => r.id === 931201)?.global === false, 'Prix Niel flagged JP-only')
  writeFileSync(racesPath, JSON.stringify(races), 'utf8')
  console.log(`wrote races.json (+${added} Global races, ${races.filter((r) => !r.global).length} JP-only)`)

  db.close()
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
