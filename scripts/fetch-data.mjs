/**
 * Static data pipeline: fetches game data and transforms it into the typed
 * JSON consumed by src/data/load.ts. Run: `node scripts/fetch-data.mjs`.
 *
 * Sources (see docs/research/data-pipeline-plan.md and docs/ATTRIBUTION.md):
 *  - GameTora hash-manifest JSON (characters, cards, skills, factors, races,
 *    Global succession relation tables). Undocumented frontend files — always
 *    resolve hashes from the manifest, never hardcode them.
 *  - umapyoi.net API (character theme colors for silhouette avatars),
 *    best-effort; the build works without it.
 *
 * Everything is snapshotted into src/data/static/ so the deployed site never
 * fetches third parties at runtime.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'static')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 (Sparkline data pipeline; fan tool)'

// Aptitude array order in GameTora cards, verified against Special Week
// (100101: turf A, dirt G, sprint F, mile C, medium A, long A, front G,
// pace A, late A, end C).
const APTITUDE_ORDER = ['turf', 'dirt', 'sprint', 'mile', 'medium', 'long', 'front', 'pace', 'late', 'end']

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.json()
}

const gametora = (file) => fetchJson(`https://gametora.com/data/umamusume/${file}.json`)

function assert(cond, message) {
  if (!cond) throw new Error(`sanity check failed: ${message}`)
}

async function main() {
  console.log('Resolving GameTora manifest…')
  const manifest = await fetchJson('https://gametora.com/data/manifests/umamusume.json')
  const versioned = (key) => {
    const hash = manifest[key]
    assert(hash, `manifest key missing: ${key}`)
    return gametora(`${key}.${hash}`)
  }

  const [charactersRaw, cardsRaw, skillsRaw, factorsRaw, racesRaw, relRaw, relMemberRaw, skillsLoc, raceInstancesRaw, uraObjectivesRaw, supportCardsRaw] =
    await Promise.all([
      versioned('characters'),
      versioned('character-cards'),
      versioned('skills'),
      versioned('factors'),
      versioned('races'),
      versioned('en/db-files/succession_relation'),
      versioned('en/db-files/succession_relation_member'),
      fetchJson('https://gametora.com/loc/umamusume/skills.json'),
      versioned('race_instances'),
      versioned('ura-objectives'),
      versioned('support-cards'),
    ])

  // --- characters + theme colors/thumbnails (umapyoi, best effort) ---------
  // Thumbnails are HOTLINKED official CDN URLs (© Cygames) — never vendored
  // into the repo; the Avatar component falls back to silhouettes when a
  // URL is missing or fails to load.
  let colorByCharaId = new Map()
  let thumbByCharaId = new Map()
  try {
    console.log('Fetching umapyoi colors + thumbnails…')
    const idMap = await fetchJson('https://umapyoi.net/api/v1/character') // [{game_id, web_id}]
    const list = await fetchJson('https://umapyoi.net/api/v1/character/list') // [{id(web), color_main, thumb_img,…}]
    const webToGame = new Map(idMap.map((x) => [x.web_id, x.game_id]))
    for (const c of list) {
      const gameId = webToGame.get(c.id)
      if (!gameId) continue
      if (c.color_main) {
        colorByCharaId.set(gameId, c.color_main.startsWith('#') ? c.color_main : `#${c.color_main}`)
      }
      if (c.thumb_img && /^https:\/\//.test(c.thumb_img)) thumbByCharaId.set(gameId, c.thumb_img)
    }
    console.log(`  colors for ${colorByCharaId.size}, thumbnails for ${thumbByCharaId.size} characters`)
  } catch (err) {
    console.warn(`  umapyoi data unavailable (${err.message}) — continuing without`)
  }

  const characters = charactersRaw
    .filter((c) => c.playable)
    .map((c) => ({
      id: c.char_id,
      name: c.en_name,
      color: colorByCharaId.get(c.char_id) ?? null,
      image: thumbByCharaId.get(c.char_id) ?? null,
      global: Boolean(c.playable_en),
    }))
    .sort((a, b) => a.id - b.id)

  // --- variants (trainee cards) --------------------------------------------
  const variants = cardsRaw
    .map((card) => ({
      id: card.card_id,
      charaId: card.char_id,
      title: String(card.title_en_gl || card.title || '').replace(/^\[|\]$/g, ''),
      rarity: card.rarity,
      aptitudes: Object.fromEntries(APTITUDE_ORDER.map((k, i) => [k, card.aptitude[i]])),
      uniqueSkillId: card.skills_unique?.[0] ?? null,
      global: card.release_en != null,
    }))
    .sort((a, b) => a.id - b.id)

  // --- sparks (white factor tables: skill / race / scenario) ----------------
  const skillById = new Map(skillsRaw.map((s) => [s.id, s]))
  const locById = new Map(skillsLoc.map((s) => [s.id, s]))
  const grantedSkillId = (factor) =>
    factor.effects?.find((e) => e.type === 41)?.value_1?.[0] ?? null

  const factorName = (f) => String(f.name_en_gl || f.name_en || f.name_ja || `Factor ${f.id}`)

  const skillSparks = factorsRaw.skill.map((f) => {
    const skillId = grantedSkillId(f)
    // A skill spark exists on Global iff its granted skill has an official
    // Global localization entry. (Tier — white/◎/gold — is a property of
    // the version HELD when farming, not of the spark; see SparkDef.)
    const loc = skillId != null ? locById.get(skillId) : undefined
    return {
      id: Number(f.id),
      kind: 'skill',
      name: factorName(f),
      raceId: null,
      global: Boolean(loc?.name_en_global),
    }
  })

  const raceSparks = factorsRaw.race.map((f) => ({
    id: Number(f.id),
    kind: 'race',
    name: factorName(f),
    raceId: Number(f.race_id),
    global: true, // races.json carries no Global flag; revisit if needed
  }))

  // Global scenario factors by id: 30001 URA Finale, 30002 Unity Cup,
  // 30003 "TS Climax Scenario" (Trackblazer's finale spark), 30004 "Our
  // Grand Concert" (Grand Live, Global release 2026-07-22 — included so
  // blueprints made this week stay valid). 31xxx entries are JP-only
  // scenario sub-factors.
  const GLOBAL_SCENARIO_IDS = new Set([30001, 30002, 30003, 30004])
  const scenarioSparks = factorsRaw.scenario.map((f) => ({
    id: Number(f.id),
    kind: 'scenario',
    name: factorName(f),
    raceId: null,
    global: GLOBAL_SCENARIO_IDS.has(Number(f.id)),
  }))

  const sparks = [...skillSparks, ...raceSparks, ...scenarioSparks].sort((a, b) => a.id - b.id)

  // --- graded races (won-race picker; G1/G2/G3 count for shared-win bonuses
  // under the Global 'legacy' rule; ids are the calendar ids the crown
  // triples reference) --------------------------------------------------------
  const seenRaceIds = new Set()
  const races = racesRaw
    .filter((r) => [100, 200, 300].includes(r.grade) && r.group === 1)
    .filter((r) => (seenRaceIds.has(r.id) ? false : seenRaceIds.add(r.id)))
    .map((r) => ({ id: r.id, name: r.name_en, grade: r.grade, global: true }))
    .sort((a, b) => a.grade - b.grade || a.id - b.id)

  // --- full skill table (names, tier, spark-group linkage) ------------------
  // A spark factor grants the ○/white version of its skill group; every
  // variant (○ / ◎ / gold) shares floor(skillId/10) with the granted skill,
  // which is how a HELD skill maps back to its spark factor and how the
  // farming calculator knows which generation tier applies.
  const factorBySkillGroup = new Map()
  for (const f of factorsRaw.skill) {
    const granted = grantedSkillId(f)
    if (granted != null) factorBySkillGroup.set(Math.floor(granted / 10), Number(f.id))
  }
  const skillsOut = skillsRaw
    .map((s) => {
      const loc = locById.get(s.id)
      const name = String(loc?.name_en_global || loc?.name_en || s.name_en || s.enname || `Skill ${s.id}`)
      const tier =
        s.rarity === 2 ? 'gold'
        : s.rarity === 1 ? (name.includes('◎') ? 'circle' : 'normal')
        : s.rarity >= 3 && s.rarity <= 5 ? 'unique'
        : 'other' // evolved etc.
      return { id: s.id, name, tier, factorId: factorBySkillGroup.get(Math.floor(s.id / 10)) ?? null }
    })
    .sort((a, b) => a.id - b.id)

  // --- support cards (which cards can teach a skill during a run) -----------
  const supportsOut = supportCardsRaw
    .map((c) => ({
      id: c.support_id,
      name: [c.title_en, c.char_name].filter(Boolean).join(' '),
      rarity: c.rarity,
      type: c.type ?? null,
      skillIds: [...new Set([...(c.hints?.hint_skills ?? []), ...(c.event_skills ?? [])])],
      global: c.release_en != null,
    }))
    .sort((a, b) => a.id - b.id)

  // --- unique skills (green spark labels) -----------------------------------
  const uniqueIds = [...new Set(variants.map((v) => v.uniqueSkillId).filter((x) => x != null))]
  const uniqueSkills = uniqueIds
    .map((id) => {
      const loc = locById.get(id)
      const skill = skillById.get(id)
      return { id, name: loc?.name_en_global || loc?.name_en || skill?.name_en || `Unique ${id}` }
    })
    .sort((a, b) => a.id - b.id)

  // --- race plan (calendar instances + per-character career blocks) ---------
  // Turn number = (year-1)*24 + (month-1)*2 + half, verified against known
  // career schedules (Tokyo Yushun = turn 34, Arima Kinen = turn 72).
  const turnOf = (r) => (r.year - 1) * 24 + (r.month - 1) * 2 + r.half

  const gradedInstances = raceInstancesRaw
    .filter((r) => r.details && [100, 200, 300].includes(r.details.grade) && r.details.group === 1)
    .map((r) => ({
      raceId: r.details.id, // races.json id
      name: r.details.name_en,
      grade: r.details.grade,
      year: r.year,
      month: r.month,
      half: r.half,
      turn: turnOf(r),
      distance: r.details.distance, // meters
      terrain: r.details.terrain, // 1 = turf, 2 = dirt
    }))
    .sort((a, b) => a.turn - b.turn || a.raceId - b.raceId)

  // Resolve an objective race (race_id + turn) to the calendar instance.
  const instanceByRaceIdTurn = new Map()
  for (const r of raceInstancesRaw) {
    if (r.details?.race_id != null) instanceByRaceIdTurn.set(`${r.details.race_id}:${turnOf(r)}`, r.details.id)
  }

  const racePlanChars = {}
  for (const entry of uraObjectivesRaw) {
    const mandatory = {}
    let debutTurn = 12
    for (const obj of entry.objectives ?? []) {
      const raceIds = (obj.races ?? []).map((x) => x.id)
      if (raceIds.length === 0) continue
      if ((obj.races ?? []).some((x) => x.grade === 900)) {
        debutTurn = obj.turn // Make Debut
        continue
      }
      // Multi-choice objectives leave the runner a pick; only single-race
      // objectives hard-block the turn. Resolve to the calendar instance id
      // (0 = turn blocked by a non-graded or unresolvable race).
      if (raceIds.length === 1) {
        mandatory[obj.turn] = instanceByRaceIdTurn.get(`${raceIds[0]}:${obj.turn}`) ?? 0
      }
    }
    racePlanChars[entry.char_id] = { debutTurn, mandatory }
  }

  const racePlan = { instances: gradedInstances, chars: racePlanChars }

  // --- relations (Global succession tables) ---------------------------------
  const points = {}
  for (const r of relRaw) points[r.relation_type] = r.relation_point
  const members = {}
  for (const m of relMemberRaw) (members[m.chara_id] ??= []).push(m.relation_type)
  const relations = { points, members }

  // --- sanity checks ---------------------------------------------------------
  const sw = variants.find((v) => v.id === 100101)
  assert(sw, 'Special Week card 100101 present')
  assert(sw.aptitudes.turf === 'A' && sw.aptitudes.dirt === 'G', 'aptitude order (Special Week turf/dirt)')
  assert(characters.some((c) => c.id === 1001 && c.name === 'Special Week'), 'character names')
  assert(characters.filter((c) => c.global).length >= 60, 'Global roster ≥ 60 characters')
  assert(sparks.filter((s) => s.kind === 'skill' && s.global).length >= 200, 'Global skill sparks')
  assert(races.filter((r) => r.grade === 100).length >= 50, 'G1 race list')
  const crownIds = [100501, 101001, 101501, 101601, 101901, 102301]
  assert(crownIds.every((id) => races.some((r) => r.id === id)), 'crown-triple race ids present')
  assert(racePlan.instances.length >= 100, 'graded race instances')
  assert(Object.keys(racePlan.chars).length >= 100, 'per-character race plans')
  const swPlan = racePlan.chars[1001]
  assert(swPlan && swPlan.mandatory[34] === 101001, 'Special Week Tokyo Yushun at turn 34')
  assert(swPlan.mandatory[72] === 102301, 'Special Week Arima Kinen at turn 72')
  assert(Object.keys(relations.members).length >= 70, 'relation members')
  const pairPoints = (a, b) => {
    const sa = new Set(members[a] ?? [])
    return (members[b] ?? []).filter((t) => sa.has(t)).reduce((s, t) => s + points[t], 0)
  }
  assert(pairPoints(1001, 1002) > 0, 'relation points computable (1001×1002)')
  assert(skillsOut.length >= 1500, 'full skill table')
  assert(supportsOut.length >= 400 && supportsOut.some((c) => c.skillIds.length > 0), 'support cards with hint skills')
  assert(skillsOut.some((s) => s.tier === 'gold' && s.factorId !== null), 'gold skills linked to spark factors')
  const cornerAdept = skillsOut.find((s) => s.id === 200332)
  assert(cornerAdept && cornerAdept.factorId === 20033, 'skill→factor linkage (Corner Adept ○ → factor 20033)')

  // --- write -----------------------------------------------------------------
  await mkdir(OUT_DIR, { recursive: true })
  const write = async (file, data) => {
    await writeFile(path.join(OUT_DIR, file), JSON.stringify(data), 'utf8')
    console.log(`  wrote ${file}`)
  }
  await write('characters.json', characters)
  await write('variants.json', variants)
  await write('sparks.json', sparks)
  await write('races.json', races)
  await write('unique-skills.json', uniqueSkills)
  await write('skills.json', skillsOut)
  await write('support-cards.json', supportsOut)
  await write('relations.json', relations)
  await write('race-plan.json', racePlan)
  await write('meta.json', {
    fetchedAt: new Date().toISOString(),
    sources: {
      gametora: Object.fromEntries(
        ['characters', 'character-cards', 'skills', 'factors', 'races', 'en/db-files/succession_relation', 'en/db-files/succession_relation_member']
          .map((k) => [k, manifest[k]]),
      ),
      umapyoiColors: colorByCharaId.size > 0,
    },
    counts: {
      characters: characters.length,
      globalCharacters: characters.filter((c) => c.global).length,
      variants: variants.length,
      globalVariants: variants.filter((v) => v.global).length,
      sparks: sparks.length,
      races: races.length,
    },
  })
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
