# Cross-validation vs GameTora Inheritance Chances beta — 2026-07-16

GameTora's compatibility page computes inheritance chances client-side; we
extracted the exact logic from their shipped chunk
(`/_next/static/chunks/2464-722aa62831d0d8bc.js`) and executed it to produce
test vectors. Our engine reproduces them exactly —
`src/engine/crossvalidation.test.ts` pins the vectors permanently.

## Verified agreement (code-level)

| Aspect | GameTora (extracted) | Sparkline |
|---|---|---|
| Blue base | 70/80/90% | same (`PROC_BASE.blue`) |
| Pink base | 1/3/5% | same |
| Green base | 5/10/15% | same |
| White skill/scenario | 3/6/9% | same |
| **White race** | **1/2/3%** | same — confirms our correction |
| Multiplier | `min(base × (1 + slotAffinity/100), 1)` | identical |
| Slot affinity | parent = pair(t,p)+pair(p1,p2)+her 2 trios+race/epithet bonuses; gp = trio+race bonuses | identical (`SlotAffinityMode 'individual'`) |
| Grandparent handling | no halving; position acts only through affinity | identical (`'affinity-only'`) |
| Self-lineage | trainee-as-gp: trio = 0, not an error | identical |
| Events/copies | 2 events; copies combine 1−Π(1−p) | identical |

Numeric vectors (trainee Special Week; Suzuka + Teio parents; Vodka/Oguri and
McQueen/Rice Shower grandparents; no won races): tree total 149; slot
affinities 85/84/18/20/21/18; white skill 3★ on parent1 = 16.65%/event,
30.53%/career; on Vodka = 10.62%/20.11%; white race 3★ on parent1 =
5.55%/10.79%. All reproduced to 8+ decimal places.

## Known intentional differences

1. **Per-type event cap:** GameTora caps pink ("red") and scenario procs at 3
   per inspiration event across all sparks of that type, redistributing
   hypergeometrically. We do not model it: with base rates of 1–5%, joint
   4-proc events are ~1e-5 territory, far below the empirical uncertainty of
   the base rates themselves. Revisit if we ever display joint distributions.
2. **"Other" factor types 8/10/11** (special aptitude-like factors) are
   reclassified to pink rates by GameTora; our data pipeline doesn't ship the
   `other` factor category at all yet.
3. Blues: neither tool models the guaranteed career-start application inside
   the % rows; both show 2-event proc chances. We additionally document the
   start bonus (+5/+12/+21) as deterministic in the aptitude/stat displays.

## Race-win bonus rule

Their race bonus for EN remains the 'legacy' rule (+1 per shared G1/G2/G3 +
crown epithets) — unchanged from the relations scout's finding, and still in
disagreement with ChronoGenesis (+3 per G1). Our config default follows
GameTora (`DEFAULT_RACE_BONUS_RULE = 'global-legacy'`) with the JP rule a
toggle away.
