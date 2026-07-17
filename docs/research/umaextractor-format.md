# UmaExtractor import format — 2026-07-16 analysis

Source: github.com/xancia/UmaExtractor (fork of rockisch/umadump). Reads the
running game client's memory (Frida / /proc mem) for the msgpack
`trained_chara_array` and writes `data.json` — an array of veteran records.
No license file in either repo; the exported data is the user's own game
data. Server-agnostic (raw master-DB ids, shared across regions).

Importer: `src/data/importers/umaExtractor.ts` (+ tests). UI: "Import
UmaExtractor" in the library panel.

## Field mapping

| UmaExtractor | Sparkline | Notes |
|---|---|---|
| `card_id` (e.g. 100101) | `build.variantId` | identical id space (card ids) |
| `factor_id_array` | blue/pink/green/whites | see decoding below |
| `skill_array[].skill_id` | `skillIds` | skill ids, distinct from factor ids |
| `rank_score` | `score` | the rating number our star-band math uses |
| `create_time` | `trainedAt` | naive local timestamp → ISO-ish |
| `win_saddle_id_array`, `race_result_list` | **not imported** | win-saddle/program ids; no mapping shipped — users add key races manually for shared-win affinity |
| `succession_chara_array`, `succession_history_array` | **not imported** | contains other players' viewer ids/usernames; privacy |

## Export format versions

Older exports (the rockisch/umadump sample) carry `factor_id_array:
number[]`. **Current exports (seen 2026-07-17) instead carry
`factor_info_array: [{factor_id, level}]`** (level observed always 0), on
veterans AND succession entries; the id encoding is unchanged. The importer
accepts both, and trips a loud warning if no record decodes any spark
(format-drift alarm).

## Factor id decoding (identity + star in one integer)

| Digits | Class | Decode |
|---|---|---|
| 3 | Blue | `floor(id/100)` = stat (1 Speed, 2 Stamina, 3 Power, 4 Guts, 5 Wit); `id%100` = ★ |
| 4 | Pink | `floor(id/100)` = aptitude: 11 Turf, 12 Dirt, 21 Front, 22 Pace, 23 Late, 24 End, 31 Sprint, 32 Mile, 33 Medium, 34 Long; `id%100` = ★ |
| 7 | White | `floor(id/100)` = factor group id — exactly our SparkDef ids (2xxxx skill, 1xxxx race, 3xxxx scenario); `id%100` = ★ |
| 8 | Green | `floor(id/100)` = generating card id; `id%100` = ★ |

The pink prefix table comes from the game's factor table via GameTora's
`factors.json` pink category (id → name), which corrected an initial guess:
2x is running STYLE and 3x is DISTANCE. Cross-checked against the umadump
sample (an uma with Pace A carrying factor 2201 = Pace ★1).

## Possible future work

- Ship a win-saddle → race-id mapping (from the local Global master.mdb) so
  won races import too.
- Import each veteran's `succession_chara_array` ancestors as separate
  (borrowed) library entries — their factor arrays are present per ancestor.
