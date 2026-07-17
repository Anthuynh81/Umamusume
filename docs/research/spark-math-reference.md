# Spark Math Reference (Global)

Distilled from two Global-focused community sources: BB's spark math video (Source A, grounded in YA's large-scale empirical sampling and Anoko Pochi's JP testing; primary for rate tables) and Static's legacy/affinity guide (Source B; primary for affinity thresholds, self-lineage rules, and white spark subtype behavior). Conflicts between them are flagged inline. Treat this as the primary rate source for the calculation engine. Every table below should live in typed config with a source comment. Base chances only; affinity handling is layered on top (see Affinity section).

## Terminology: two separate probabilities

Keep these strictly separate in code, UI copy, and variable naming.

| Term | Meaning | Drives which feature |
|---|---|---|
| **Spark chance** (generation) | Chance a trained uma finishes her career with a given spark on her lineage | Expected-runs farming calculator |
| **Proc chance** (inheritance) | Chance an existing lineage spark activates for the trainee during the career | Inheritance rate panel, wishlist aggregation |

## Career activation model

- Career start: blue stat bonuses and starting aptitude raises apply.
- Two inspiration events (April, years 2 and 3): all probabilistic procs roll here.
- Blue sparks effectively activate 3 times (start + both events). White/pink/green procs roll only at the 2 inspiration events.
- Per-career cumulative proc chance for whites/pinks/greens: `1 - (1 - p_event)^2`.
- Combined chance across multiple copies of the same spark within one event: `1 - Π(1 - p_i)` over all copies (rolls are independent; overlap handled by the product of failures).

## Blue sparks (stats)

**Proc effect per activation:** 1★ +5 stat, 2★ +12, 3★ +21. Also raises the stat cap: +4 / +9 / +16 (post stat-cap update).

**Proc chance per event (base):** 1★ 70%, 2★ ~80% (interpolated, verify), 3★ 90%. Multiplied by affinity; reaches 100% at roughly 43+ affinity, which nearly any real parent hits. Default the calculator to guaranteed blues with a low-affinity fallback path.

**Spark chance (generation at career end):** stat is chosen ~uniformly among the 5 stats (empirical skew: speed/power overrepresented by ~0.35%, guts under by ~0.4%; ignore for v1, note in docs). Star distribution is gated by that stat's final visible value:

| Final stat | 1★ | 2★ | 3★ |
|---|---|---|---|
| < 600 | ~90% | ~10% | ~0% |
| 600–1099 | 45% | 50% | 5% |
| 1100+ | 20% | 70% | 10% |

(The <600 row is approximate; the 600+ rows are the sampled values. Verify the <600 split.)

Mental math the tool can surface: each 600 threshold crossed ≈ +1% chance of a 3★ blue overall (5% / 5 stats); 1100 adds another.

**Source conflict on proc values:** Source A (BB/YA) treats each blue activation as a fixed value per star (21 x 3 = 63 total for a 3★). Source B (Static) claims the career-start activation is guaranteed at full value for all six lineage blues, while the two later inspiration procs roll randomly within a star-dependent range. Default the calculator to fixed values (simpler, matches the sampled math) and note the range model as an open question; the difference only affects displayed expected stats, not rankings.

## Pink sparks (aptitudes)

**Spark chance (generation):** the aptitude is chosen uniformly at random from ALL aptitudes at A or S at career end, including aptitudes raised by starting inheritance and procs during the run. This creates the "pace B trap": pace-B characters whose pace gets raised to A can generate unwanted pace sparks that then propagate through a loop. The planner should surface each slot's full A/S pool (post-raise) and the resulting 1/n odds of hitting the desired aptitude, and warn when a lineage raises an unwanted B aptitude into the pool.

Star distribution (not stat-gated): 1★ 20%, 2★ 70%, 3★ 10%.

**Proc chance per event (base):** 1★ 1%, 2★ 3%, 3★ 5%. Affinity-multiplied. A 2★ is roughly 3x the value of a 1★; this is the big jump. 3★ can rarely double-proc; rate unknown, ignore in v1.

**Starting aptitude raises (deterministic):** sum stars of a given aptitude across the 6 ancestors: totals of 1 / 4 / 7 / 10 stars give +1 / +2 / +3 / +4 stages (formula: n stages at 3n-2 stars, max +4). Excess stars are wasted. Starting raises cap at A; reaching S requires an inspiration proc on top.

**Secondary effects worth surfacing in UI tooltips:** surface aptitude procs grant bonus Power, distance aptitude procs grant bonus Speed (community values ~5-10%; verify), running-style procs grant bonus Wit.

## Green sparks (unique skill)

**Spark chance (generation):** 100% if the character is at 3★ rarity or above (1★/2★ characters must be uncapped to 3★ first). Star distribution gated by final rating:

| Final rating | 1★ | 2★ | 3★ |
|---|---|---|---|
| Below SS | 45% | 50% | 5% |
| SS+ | 20% | 70% | 10% |

A further tier exists above UE+ (post-Grand Masters); add when relevant.

Greens only generate from a character's OWN unique. An inherited unique never re-sparks, which is why desirable-unique characters get built as dedicated parents.

**Proc behavior:** parents' greens grant hint levels equal to star count at career start (guaranteed). Proc chance per inspiration event: 1★ 5%, 2★ 10%, 3★ 15%, affinity-multiplied. Planning heuristic the tool can encode: guaranteed/acceleration uniques belong in parent slots, velocity uniques in grandparent slots.

## White sparks (skills, races, scenarios)

Three subtypes with meaningfully different proc effects; model them separately:

- **Skill sparks** (from sparkable non-unique skills held at career end): proc grants a hint/discount on that skill; stars scale the hint level. Unique skills never spark, so the farming UI should remind users not to buy uniques during farming runs (wasted SP).
- **G1 race sparks** (~20% chance per distinct G1 won): proc grants a small stat boost (~3-6) plus a skill hint. **Stars do NOT scale the proc payout, only the proc rate.** Their real planning value is that shared G1 wins build lineage affinity, so the tool should not weight race spark stars in wishlist scoring.
- **Scenario sparks** (from completing the scenario: URA Finale, Unity Cup, Trackblazer on Global; more coming): proc grants two scenario-specific stats, and here stars DO scale the payout: roughly +10 / +20 / +30 stats per proc (reported to land in that range ~80%+ of the time). Stacked scenario sparks across six ancestors explain the big inspiration stat spikes; weight these accordingly in expected-stat displays.

**Proc chance per event (base):** 1★ 3%, 2★ 6%, 3★ 9%. Affinity-multiplied per slot. Stars are close to linearly multiplicative in value: a full 3★ loop across both parents' lineages is ~3x the per-run chance of an all-1★ loop (~16.7% up to ~43% base per career for a single target skill across 6 copies).

**Spark chance (generation) baseline by skill tier:**

| Skill tier | Base rate |
|---|---|
| Normal white skill / G1 race / scenario | 20% |
| ◎ (double-circle) skill | 25% |
| Gold skill | 40% |

**Lineage copy bonus (the reason looping works):** copies of the same spark among the trainee's parents/grandparents raise the generation chance. Three candidate models, in increasing empirical fit; implement as a pluggable strategy so they can be compared:

1. Flat community baseline: +2.5% per lineage copy (white), +5% (gold).
2. Piecewise empirical fit: first two copies +2% each (white) / +4% (gold); copies beyond two +2.75% (white) / +5.5% (gold).
3. Multiplicative empirical fit: `base x 1.1^n` where n = lineage copy count.

**Star distribution:** rating-gated like greens; roughly 50/45/5 below SS with 2★/3★ odds improving meaningfully at SS+. Since a run rolls this table across every held skill, won G1, and the scenario (often 20-50 rolls), the SS threshold compounds heavily. Verify exact SS-tier numbers.

## Affinity

- Base affinity: pairwise data-mined lookup between characters (fixed in-lore relationships; stats/skills/aptitudes contribute nothing).
- +3 per shared G1 win for relevant pairs (parent with other parent; parent with own grandparents). Owning the race spark is NOT required; the shared win history itself is what counts.
- **Tier thresholds (confirmed):** ◎ above 150 points, ○ 50-150, △ below 50. △ is not "one notch worse": proc rates collapse at low affinity, so the UI should visually treat △ as a failure state, not a gradient step.
- **Self-lineage rule:** the trainee cannot be her own parent but CAN appear as her own grandparent; that trainee-grandparent link contributes ZERO affinity. Identity is by base character name: alternate outfits/variants of the same character count as the same uma for this rule. The affinity calculator and optimizer must model both.
- Borrowed legacies: up to 5 per day on Global (verify; older sources said 3).
- First-approximation effect on proc chances: `rate x (1 + affinity/100)`, applied per parent/grandparent with that slot's own affinity value.
- **Open conflict to resolve:** some older EN references state grandparent white proc rates are halved relative to parents. This reference uses identical per-star proc rates for all six slots, with per-slot affinity as the differentiator (grandparent affinities are naturally lower, which reproduces the "grandparents proc worse" observation). Prefer the empirical model but implement position handling behind a config flag and document the choice.

## Farming math (expected-runs calculator)

Because spark-chance rolls for different spark categories are independent, the chance of a specific combined outcome on one trained parent is the product of the individual chances (with a 1/5 factor for a specific blue stat, 1/n for a specific pink among n A/S aptitudes). Worked shape: 2★+ blue in a specific stat at 600+ AND 2★+ pink AND one target white on a fully looped lineage ≈ 55% x 80% x ~35% x (1/5) x (1/n)... expected runs = 1 / P. Surface expected runs and a percentile range (e.g., runs needed for 50% and 90% cumulative success: `ln(0.5)/ln(1-P)` and `ln(0.1)/ln(1-P)`).

Design implication: perfect parents are 1-in-hundreds events. The tool should frame outputs as "expected runs for each tier of acceptable outcome" rather than a single perfection target.

**Spark reroll:** at career end the player can reroll the entire spark result once for 30 TP, effectively giving 2 independent draws per career. The expected-runs calculator needs a "with reroll" toggle: P_career = 1 - (1 - P)^2, roughly halving expected careers for rare targets. Community advice is to reroll even on decent hits when chasing specific combos, so default the toggle on.

## Known gaps / follow-ups

- Detailed affinity interaction (deferred by both sources to follow-ups); revisit when available.
- 3★ pink double-proc rate.
- Exact <600 blue star split, SS-tier white/green star tables, and 2★ blue proc rate.
- Blue proc value model at inspirations: fixed per star vs. random-in-range (source conflict noted above).
- Whether the pink pool includes S-rank aptitudes or strictly "A or higher" as both sources phrase it (functionally the same; confirm S-rank entries roll).
- Current Global daily borrow limit (5 vs 3).
