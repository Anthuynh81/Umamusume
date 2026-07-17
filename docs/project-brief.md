# Project Brief: English Umamusume Inheritance Planner

> Decisions made 2026-07-16: name = **Sparkline**; placeholder art = **colored silhouettes** (original generic tinted SVG silhouettes, swappable asset layer). Shared-G1-win affinity bonuses: manual/race-picker entry for MVP (per brief recommendation).

## What we're building

A fan-made web tool for Umamusume: Pretty Derby that lets players plan inheritance ("legacy") family trees before spending hours grinding careers. It is an English-language equivalent of the Japanese tool at https://design.u-ma.org/ ("ウマ娘設計図" / Umamusume Blueprint), with an integrated skill inheritance rate calculator inspired by https://chronogenesis.net/, plus save/load for both individual umas and entire trees.

This is an unofficial fan tool. Do not use official game assets (character portraits, logos) in the initial build; use placeholder avatars or community-licensed assets and design the asset layer so images can be swapped in later.

## Target game version

Target the **Global (EN) version** of the game by default. Important context:

- The Global version launched June 2025 and runs years behind JP in content and mechanics.
- The JP version added a "genes" (遺伝子) system in late 2025 that makes great-grandparents and beyond influence factor generation. **Global does not have this yet.** On Global, only the trainee's 2 parents and 4 grandparents directly affect a career.
- Despite that, the deep tree is still the core value of the tool: players plan multi-generation factor farming, where today's trainee becomes tomorrow's parent. The tree lets them design the whole pipeline.
- Architect the mechanics layer so a "JP mode" (genes system, different scenario list, different rate tables) can be added later behind a version toggle. Keep all rate tables and thresholds in data/config files, never hardcoded in components, because the community's understanding of server-side rates gets refined over time.

Use Global (English) terminology in the UI: Legacy/Sparks/Inspiration/Trainee/Aptitude. Many EN community sites also use JP-derived terms (factors, inheritance); include both in searchable text where cheap, but UI labels use official EN terms.

## Reference tool 1: design.u-ma.org (the tree planner)

Feature set to replicate, verified against the live site:

1. **Family tree canvas.** The trainee at the root, 2 parents, 4 grandparents, and further ancestor generations (the JP tool goes 4 generations deep). For our Global build: trainee + parents + grandparents are the "active" generations that affect the trainee; deeper generations are planning slots for building those grandparents. Render the tree vertically by default with an optional horizontal layout for desktop.
2. **Per-slot uma editor.** Each slot holds: character (and outfit/variant, since the same character has multiple versions), aptitude spark assignments with star counts (1-3 stars each), and a free-text memo. The JP tool shows compact aptitude rows: Turf/Dirt, Sprint/Mile/Medium/Long, Front/Pace/Late/End.
3. **Live aptitude calculation.** As pink (aptitude) sparks are filled in, the tool computes the trainee's effective starting aptitudes, showing base aptitude plus the boost from ancestor sparks. This is the killer feature: players fill stars and watch a G dirt aptitude climb to D or C. Also compute effective aptitudes for the parents themselves, since parents need runnable aptitudes for factor farming.
4. **Affinity display.** Show pairwise affinity/compatibility (the ◎/○/△ rating and underlying score) between trainee and legacies, since affinity multiplies inheritance rates.
5. **Drag and drop.** Copy an uma from one slot to another by dragging (the same trained uma is frequently reused across the tree).
6. **Save slots.** Multiple named save slots organized in pages (JP tool has 5 pages x 5 slots), stored in the browser.
7. **Share via URL.** Entire tree state serialized into a compact URL parameter (the JP tool uses something like `?d=AgAA...`). Use a compact binary encoding + base64url, versioned so old links keep working.
8. **Image export.** Render the tree to a shareable PNG, with a choice of scope (full tree vs. trainee+parents+grandparents only). This is how players share blueprints on Discord/Twitter, so make it look good.
9. **Settings toggles.** Show/hide memos, horizontal layout, show/hide affinity.

## Reference tool 2: chronogenesis.net (inheritance rate calculator)

ChronoGenesis is a trainer/friend database for Global whose standout feature computes, for a given trainee + legacy setup, the probability that each individual spark is inherited during inspiration events. Key facts about how it works:

- Actual inheritance rolls happen server-side; the base rates used by the community come from large-scale inheritance sampling done on JP. Treat every rate as an empirical estimate stored in a config table with a source comment, and make them easy to update.
- It offers per-inspiration-event and per-career (cumulative across the 3 activations) rate views.

Our version: given the filled tree, for every spark on a parent or grandparent, display the % chance the trainee receives it (per event and per full career), factoring in star count, spark type, parent vs. grandparent position, and affinity. Sort/filter so a player can ask "what's the real chance my trainee gets Groundwork from this setup?"

## Reference tool 3: gametora.com/umamusume/compatibility (affinity calculator)

The current standard EN affinity tool. Features to replicate and improve on:

1. **Quick calculator layout:** 7 slots (Main Char, Legacy 1/2, sub-legacies 1-1, 1-2, 2-1, 2-2) with live affinity calculation as slots fill. This is a lighter-weight entry point than our full tree; implement it as a "quick check" mode that reuses the same slot components and calculation engine, with a one-click "expand into full tree" that carries the 7 slots over.
2. **Recommend button:** given the trainee (and any filled slots), rank ALL characters as candidates for the empty slots by base affinity. Note GameTora's recommendations only count base compatibility, not shared G1 wins; ours should state that explicitly and let the user add expected shared wins. This is distinct from our library optimizer (which arranges owned umas); slot recommendations search the whole character roster.
3. **Race selection for shared wins:** pick won races per slot to feed the +3 bonuses into the score.
4. **Inheritance Chances panel (beta):** GameTora recently added spark selection + inheritance probability output to this page, so a rate calculator alone is no longer a unique EN feature. Ours goes deeper (full tree, wishlist aggregation, farming math, optimizer), but use their beta as a cross-validation target: for identical setups, our per-spark numbers should match theirs or the difference should be explainable via our config model choices.
5. **Collection tracker integration:** an "owned" flag per character and an "only show owned" filter in every character picker.
6. **Saved veterans:** their library entries store trainee, score, trained-at date, won races, sparks with stars, skills, notes, and custom emoji tags. Adopt this as the baseline schema for our uma library, plus our own fields: loop membership and slot status for the farming checklist.

Their tool confirms that multiple versions/outfits of a character provide identical compatibility (the base-character identity rule).

## Game mechanics primer (encode this into the calculation engine)

**Primary rate source: `docs/research/spark-math-reference.md` in this repo** (distilled from BB's Global spark math video, grounded in YA's empirical sampling and Anoko Pochi's JP testing). Where it conflicts with wiki-style sources (GameTora, uma.guide, umareference), prefer the empirical reference, but keep every number in typed config with a source comment so it can be revised. The summary below is the structure; the reference doc has the full tables.

### Two distinct probabilities (keep separate in code, UI, and naming)
- **Spark chance (generation):** chance a trained uma ends her career with a given spark. Drives the expected-runs farming calculator.
- **Proc chance (inheritance):** chance an existing lineage spark activates for the trainee. Drives the inheritance rate panel and wishlist aggregation.

### Tree structure and activation
- A career uses 2 parents; each brings 2 grandparents. 6 ancestors affect the trainee.
- Career start applies blue stat bonuses and starting aptitude raises. All probabilistic procs roll at the 2 inspiration events (April of years 2 and 3). Blues effectively activate 3 times; white/pink/green procs get 2 rolls, so per-career cumulative proc = 1 - (1 - p_event)^2, and multiple copies of the same spark within one event combine as 1 - product of failure chances.
- A character cannot be her own parent but can be her own grandparent.

### Spark types (full tables in the reference doc)
- **Blue (stats):** +5/+12/+21 stat per activation by star, plus stat cap raises. Proc chance is 70-90% base by star but reaches 100% at ~43 affinity; default the calc to guaranteed with a low-affinity fallback. Generation: stat chosen ~uniformly among the 5; star odds gated by that stat's final value at 600 and 1100 thresholds.
- **Pink (aptitudes):** generation picks uniformly from ALL A/S aptitudes at career end, including aptitudes raised during the run (the "pace B trap"; the planner should show each slot's post-raise A/S pool, the 1/n odds of the desired aptitude, and warn when a lineage raises an unwanted B into the pool). Star split 20/70/10. Proc per event: 1%/3%/5% by star.
- **Green (unique):** generation is 100% for 3★+ rarity characters; star odds gated by final rating with a jump at SS. Only an owned character's own unique generates; inherited uniques never re-spark. Parents' greens give guaranteed hint levels = stars at career start; proc per event 5%/10%/15%. Encode the placement heuristic: must-have (acceleration) uniques in parent slots, nice-to-have (velocity) in grandparent slots.
- **White (skills/races/scenarios):** proc per event 3%/6%/9% by star. Generation baseline 20% (normal white/G1/scenario), 25% (◎ skills), 40% (gold), boosted by copies of the same spark in the parent's own lineage; implement the lineage bonus as a pluggable strategy (flat +2.5%/copy vs. the empirical piecewise or base x 1.1^n fits; see reference doc). Star odds are rating-gated with a meaningful SS jump.

### Aptitude raising (deterministic pink math)
- Sum a given aptitude's pink stars across the 6 ancestors. Totals of 1 / 4 / 7 / 10 raise it +1..+4 stages (n stages at 3n-2 stars, max +4). Excess stars are wasted; surface that as a warning. Starting raises cap at A; S requires an inspiration proc.
- Aptitude scale: G F E D C B A S. Show before/after per aptitude.
- Compute for the trainee AND for each parent (from their own parents/grandparents in the tree), since parents need runnable aptitudes for factor farming.

### Affinity (compatibility)
- Base affinity: pairwise data-mined lookup between characters. Stats, skills, and aptitudes contribute nothing.
- +3 affinity per shared G1 win for relevant pairs (parent with other parent, parent with own grandparents). Owning the race spark is not required; the shared win history is what counts.
- Tier thresholds: ◎ above 150, ○ 50-150, △ below 50. Treat △ as a failure state in the UI (proc rates collapse), not just a lower grade.
- Self-lineage rule: the trainee can appear as her own grandparent, but that link contributes zero affinity, and identity is by base character (alternate outfits count as the same uma). The affinity display AND the optimizer must model this.
- Affinity multiplies proc chances, first approximation rate x (1 + affinity/100), applied per slot with that slot's own affinity. **Known source conflict:** older EN references claim grandparent white proc rates are halved; the empirical reference uses identical per-star rates for all six slots with per-slot affinity producing the observed parent/grandparent gap. Prefer the empirical model, keep position handling behind a config flag, document the choice.

### Farming math
- Combined spark-chance outcomes multiply across independent categories (with 1/5 for a specific blue stat, 1/n for a specific pink). Expected runs = 1/P; also show runs to 50% and 90% cumulative success. Frame outputs as tiers of acceptable outcomes, not a single perfection target, since perfect parents are 1-in-hundreds events.

## Feature list

### MVP
1. Tree builder with the slot editor (character picker with search and an "only show owned" filter, spark editor, memo)
2. Quick affinity calculator mode: the 7-slot GameTora-style layout sharing components and engine with the tree, with one-click expansion into the full tree
3. Live aptitude calculation for trainee and parents
4. Affinity score + tier display, with per-slot character recommendations for empty slots (ranked by base affinity, clearly labeled as excluding shared-win bonuses)
5. Inheritance rate calculator panel: per-spark % (per event and per career) for every white/green spark in the tree
6. Save/load individual umas to a personal "uma library" (a trained uma with her sparks is an asset players reuse constantly). Library entry schema: character/outfit, sparks with stars, skills, score, trained-at date, won races, notes, custom tags, owned/loop-membership flags
7. Save/load entire trees, multiple slots, named, with timestamps
8. URL sharing of full tree state
9. LocalStorage/IndexedDB persistence, plus JSON export/import for backup

### Phase 2 (high-value differentiators; design the data model to support these from day one)
- **Affinity optimizer.** Given a chosen trainee and the user's saved uma library, exhaustively search arrangements of library umas into the parent/grandparent slots and rank by total affinity (optionally constrained: "must include this uma as a parent," "prefer arrangements containing these sparks"). Must correctly model the self-lineage zero-affinity rule and base-character identity (outfits are the same uma). Library sizes make brute force fine; add memoized pairwise scoring. This is the headline feature no English tool has.
- **Legacy loop planner.** The core community workflow is a rotating pool of ~4 mutually compatible umas where each career's trainee becomes the next career's parent and grandparents age out. Given a candidate pool, show the pairwise affinity matrix, the rotation sequence, per-rotation-step total affinity (accounting for the self-link zero at the steps where the trainee appears in her own lineage), and a warning when the pool's distance aptitudes can't share a G1 race calendar. Encode the heuristic: build loops around a shared running style rather than a shared distance.
- **Skill wishlist aggregation.** Let the user flag must-have sparks across the tree; on top of per-spark rates, compute expected inherited-skill count and P(at least N of the flagged skills) per career. Straight probability math over the existing rate engine (treat sparks as independent unless community data says otherwise; document the assumption). Weight by subtype: G1 race spark stars affect proc rate only, scenario spark stars scale stat payout (see reference doc).
- **Reverse aptitude planner.** User sets target trainee aptitudes; tool computes star deficits per aptitude and highlights which empty/underfilled slots could cover them.
- **Expected-runs farming calculator.** Using the spark generation odds (skill/race/scenario spark chance, star distribution, rank gating), estimate careers needed to produce a desired parent (e.g., "dirt 3★ + Groundwork"). Show expected value and a percentile range, not just the mean. Include a "with spark reroll" toggle (30 TP reroll = 2 independent draws per career; default on).
- **Farming progress checklist.** Toggle per tree slot: planned / farmed / borrowed. Show completion progress on saved blueprints.
- **Rental slot support.** Mark a slot as "rental"; generate a copyable text summary of the required character/sparks/stars for finding a friend rental (formatted to paste into Discord or ChronoGenesis search).
- **"Fill from library" drag and drop** of saved umas into tree slots.
- PNG image export of the tree (with optional inheritance-rate overlay).

### Phase 3 / later
- **Shared G1 win planner.** Compute affinity race bonuses from actual per-character race availability data instead of manual entry: for each relevant pair, show G1s both can run and a running +3-per-race total. Requires career race schedule data; keep manual entry as fallback.
- **Champions Meeting presets.** Event pages with the current CM course and recommended target aptitudes preloaded into the reverse aptitude planner. Note: recurring data maintenance burden; design as editable JSON presets.
- JP mode toggle (genes system, deeper active inheritance, JP scenario list and rate tables)
- Uma library import from shared formats (e.g., ChronoGenesis-style factor listings)
- Localization framework (keep strings externalized from day one)

### Explicitly out of scope (for now)
- Community blueprint gallery/ranking with a backend, accounts, or moderation; URL sharing covers this
- Screenshot OCR import of factor pages
- Full Monte Carlo career simulation; expected values and wishlist probabilities answer the same player questions more cheaply

## Data requirements

The app needs static game data. Candidate sources, in rough order of preference; check licensing/attribution requirements for each before use since this is a public fan tool:

- **umapyoi.net API** - open Umamusume data API (characters, outfits)
- **GameTora** (gametora.com/umamusume) - characters, skills, legacy mechanics documentation; scraping may not be permitted, use as reference documentation
- **uma-tools / uma-skill-tools GitHub repos (alpha123 and similar)** - open-source repos containing affinity data and skill data extracted from the game
- **master.mdb community extracts** (e.g., UmaMusumeAPI project) - full data-mined DB including the character affinity (relation) tables
- Community-maintained spreadsheets for the JP-sampled inheritance rate tables

Required datasets: character list with variants/outfits and base aptitudes; pairwise affinity/relation data; skill list (names EN/JP, rarity, white-sparkable flag); G1 race list per character's career availability (for affinity win bonuses, can be manual entry in MVP: just let the user input "shared G1 wins" as a number per pair); scenario list for Global (URA Finale, Unity Cup, Trackblazer as of mid-2026).

If clean affinity data can't be sourced immediately, ship MVP with manual affinity entry per pair and a big TODO; do not block the tree builder on it.

## Technical direction

- **Stack:** React + TypeScript + Vite. Zustand or similar for state. Tailwind for styling. No backend for MVP; fully static deploy (GitHub Pages / Cloudflare Pages / Vercel).
- **State model first:** design the tree/uma/spark data model and the URL serialization format before UI. The serialized format is a public contract once share links exist; version it from v1.
- **Calculation engine as a pure TypeScript module** with unit tests, fully separated from React. Test cases: aptitude raise thresholds (0/1/3/4/6/7/9/10 stars), affinity multiplier math, per-career cumulative probability, grandparent halving.
- All rate tables, thresholds, and affinity constants in `/src/data/config` as typed constants with source citations in comments.
- Mobile-first responsive layout; JP tool users are heavily mobile. Horizontal tree layout is the desktop enhancement.
- IndexedDB (via idb or Dexie) for the uma library and tree saves; localStorage acceptable for settings.
- Accessibility: the tree must be keyboard-navigable; drag and drop needs a click-to-copy fallback.

## Build order

1. Data model + serialization format + calculation engine with tests
2. Static data pipeline (character/skill/affinity data loading)
3. Tree UI + slot editor
4. Live aptitude + affinity display
5. Inheritance rate panel
6. Uma library (save/load individual umas)
7. Tree save slots + JSON export/import
8. URL sharing
9. Polish: settings, memos, mobile layout pass

## Companion document

`docs/research/spark-math-reference.md` is the source of truth for rate tables. When implementing config constants, cite the section of that doc each number came from. Its "Known gaps / follow-ups" section lists what still needs verification.

## Open questions

1. ~~Verify the flagged gaps in the spark math reference~~ → research run 2026-07-16, see `docs/research/rate-verification-report.md`.
2. ~~Character art placeholder strategy~~ → colored silhouettes (decided 2026-07-16).
3. ~~Shared-G1-win bonuses~~ → manual entry / race picker for MVP (decided 2026-07-16).
4. ~~Site name~~ → Sparkline (decided 2026-07-16). Domain still open.
