# Static data pipeline — sources and plan (2026-07-16 scouting run)

Implemented in `scripts/fetch-data.mjs`; snapshots land in `src/data/static/`
and ship with the app (the deployed site never fetches third parties at
runtime). Run `node scripts/fetch-data.mjs` to refresh after game updates.

## Primary source: GameTora hash-manifest JSON (all core datasets)

Entry point: `https://gametora.com/data/manifests/umamusume.json` → maps
dataset keys to 8-hex hashes; files live at
`https://gametora.com/data/umamusume/{key}.{hash}.json`. Hashes rotate on
every game update — always resolve via the manifest. These are GameTora's own
frontend files (undocumented, may change shape); send a browser User-Agent.

| Dataset | Key | What we take |
|---|---|---|
| Characters | `characters` | char_id, en_name, playable/playable_en (157 chars, 61+ Global) |
| Trainee cards | `character-cards` | card_id, char_id, title_en_gl, rarity, aptitude[10] (order [Turf,Dirt,Sprint,Mile,Medium,Long,Front,Pace,Late,End], verified vs Special Week), skills_unique, release_en (259 cards, 91+ Global) |
| Skills | `skills` + unversioned `/loc/umamusume/skills.json` | EN names; presence of `name_en_global` = exists on Global |
| Spark tables | `factors` | skill(433)/race(37)/scenario(34) factor ids + names — these ARE the white sparks; ids are our WhiteSpark refIds |
| Races | `races` | G1/G2/G3 (grade 100/200/300, group 1) calendar ids for the won-race picker; crown-triple ids reference these |
| Affinity | `en/db-files/succession_relation` + `_member` | The Global server's relation tables (1,616 groups / 3,014 members), verified byte-identical to the local Global client's master.mdb |
| Race plan | `race_instances` + `ura-objectives` | Graded calendar instances (year/month/half → turn = (y−1)·24+(m−1)·2+half) and per-character mandatory objectives → `race-plan.json` for the shared-race planner. URA program baseline. |

Additionally, `scripts/extract-mdb.mjs` (run AFTER fetch-data) reads the
LOCAL Global client's master.mdb and:
- snapshots `single_mode_wins_saddle` → `win-saddles.json` (UmaExtractor won-race import);
- merges the Global career program (`single_mode_program` ⋈ `race_instance` ⋈
  `race`/`race_course_set`; race_permission 1/2/3/4 = junior/classic/
  classic+senior/senior) into `race-plan.json`, tagging each instance
  `server: both|global|jp`. Verified 2026-07-16: GameTora's shared calendar
  was missing 21 Global slots (the new-venue JBC instances from the July 14
  dirt update + the rebalanced Satsuki/Tenno-Spring/Takarazuka instance ids)
  and included 2 JP-only slots (Prix Niel/Foy);
- patches `races.json` with missing Global races and sets `global:false` on
  entries absent from the Global career program (L'Arc/US-series/story
  variants).

## Secondary: umapyoi.net API (best-effort)

`/api/v1/character` (game_id↔web_id) + `/api/v1/character/list`
(color_main/color_sub) → per-character theme colors for the silhouette
avatars. Free public API by KevinVG207; 403s non-browser UAs; rate limits
10/s, 500/min. No aptitude/game-stat data, so it stays optional — the
pipeline continues without it.

## Cross-check / fallback sources (not fetched by default)

- `alpha123/uma-tools` (GPL-3.0, `umalator-global/` dir): Global umas.json,
  skill data, skill names — regenerated from the Global client's master.mdb;
  good independent cross-check for aptitudes and skills.
- `Kuroiel/UmaMusumeRacePlanner` (MIT): per-character career objectives +
  EN race calendar — the phase-3 shared-G1-win planner's likely source.
- Local Global client master.mdb (plain SQLite at
  `%USERPROFILE%\AppData\LocalLow\Cygames\Umamusume\master\master.mdb`) —
  ground truth for everything if GameTora's internals ever break.
- hakuraku (`SSHZ-ORG/hakuraku`), `waptia/UmaMusumeAffinityMath` — affinity
  reference implementations used to verify our formula.

## Licensing / attribution posture

See `docs/ATTRIBUTION.md`. All underlying game data is © Cygames; this is an
unofficial fan tool with no official assets. GameTora files carry no explicit
license — community norm is attribution + local caching + not hammering the
endpoints (we fetch ~9 files per refresh, manually). umapyoi has no stated
license; credit KevinVG207. Do not vendor GPL code from uma-tools without
GPL-compliance; we only cross-check against its JSON.

## Refresh checklist (per banner / game update)

1. `node scripts/fetch-data.mjs` — sanity checks assert aptitude order,
   Special Week's grades, roster size, crown-triple race ids, relation pairs.
2. `npm test` — `src/data/load.test.ts` smoke-tests the snapshots.
3. Watch for: new scenario factor ids (extend GLOBAL_SCENARIO_IDS), the JP
   genes system arriving on Global (needs the JP-mode toggle), relation-table
   growth (automatic).
