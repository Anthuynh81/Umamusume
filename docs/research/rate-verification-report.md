# Rate verification report — 2026-07-16 research run

Verification of the flagged gaps in `spark-math-reference.md` plus the affinity
formula, via a multi-agent web research pass (independent cross-checks where
the session allowed). Everything below is implemented in `src/data/config/rates.ts`
unless marked OPEN. **Bold** = correction to the reference doc.

Empirical source chain (who the community numbers actually trace to):
- **BourBon_Polaris** (@BourBon_Polaris) — controlled 0-affinity JP proc sampling
  (~1,000-trial baselines; 100-trial model validation), the base-rate source.
- **Aya** (hakuraku.moe/notes) — Global CM10–12 mega-samples for generation
  (n=511,839 white / 168,666 gold at 0 lineage), model fits, individual
  inheritance theory.
- **aoneko_pochi / aoneko_uma** — JP sampling: ×1.1ⁿ lineage model, SS/UE star
  gates. (The reference doc's "Anoko Pochi" is this researcher; "YA" ≈ Aya;
  "BB's video" collates these.)
- **umamusustation** — n=22,411 scraped blue/pink factor dataset (JP).
- **Cygames patent JP2022018121A** — the affinity multiplier formula itself,
  surfaced by しょっぽ (@shoppo_ura), validated empirically by Polaris.
- **crazyfellow's guide** (Google Doc) — EN collation of the above.
- **Global master.mdb + GameTora/hakuraku/ChronoGenesis code** — datamined
  affinity structure (exact, not statistical).

## Proc chances (per inspiration event, 0-affinity base)

| Class | 1★ | 2★ | 3★ | Verdict |
|---|---|---|---|---|
| Blue | 70% | 80% | 90% | Confirmed (Polaris ~1,000 trials; 2★ 80% is sampled, med. confidence) |
| Pink | 1% | 3% | 5% | Confirmed (Polaris; verified vs independent sources) |
| Green | 5% | 10% | 15% | Confirmed (Polaris) |
| White skill / scenario | 3% | 6% | 9% | Confirmed |
| **White RACE (G1)** | **1%** | **2%** | **3%** | **CORRECTION: race sparks proc at a third of skill whites** (Polaris via hakuraku; reference doc lumped them with skill whites) |

- Multiplier: `rate × (1 + individual_affinity/100)`, cap at 100% — from
  Cygames patent JP2022018121A, Polaris-validated. 1★ blue guaranteed at
  affinity ≥ 43 (42.86 exact), 2★ at 25, 3★ at 12. Confirmed.
- Per-career cumulative over the 2 events: `1 − (1 − p)²`. Confirmed.

## Grandparent "halving" conflict — RESOLVED

No separate halving rule exists. Per-star base rates are identical for all six
slots; grandparents observably proc at ~half rate because their **individual
affinity** is lower (hakuraku "individual inheritance theory", validated by
Polaris's 100-trial follow-up, all 47 test cells consistent). Implemented as
`DEFAULT_POSITION_MODEL = 'affinity-only'`; `'grandparent-halved'` kept only
as a comparison mode.

**Individual affinity definition** (crazyfellow via hakuraku, implemented as
`SlotAffinityMode 'individual'`):
- grandparent: her trio contribution `trio(t, parent, gp)` + race bonus on the
  (parent, gp) link;
- parent: `pair(t,p)` + `pair(p1,p2)` + both her grandparent trios + race
  bonuses on all those links.

## Blue spark model — CORRECTED (two-part)

- **Career start: guaranteed**, deterministic +5/+12/+21 per star, additive
  across all six lineage blues (the parent-select screen previews exact gains).
- **Inspiration events: proc-gated** (70/80/90 × affinity), and the payout is
  a **random roll in 1–10 / 1–16 / 1–28** by star (distribution unverified;
  uniform placeholder). The reference doc's fixed-value model applies only to
  career start.
- Stat-cap raises +4/+9/+16 per star confirmed; live on **Global since
  2026-07-01**; applies at start and both events.

## Generation star odds

- Blue (gated by that stat's final value; umamusustation n=22,411):
  - <600: **90.2 / 9.8 / 0.0** — 3★ literally 0/9,770. (Reference's ~90/10/0 confirmed.)
  - 600–1099: **50 / 45 / 5** — **CORRECTION: the reference doc's 45/50/5 is
    transposed** (sampled 49.0/45.2/5.8).
  - 1100+: 20 / 70 / 10 confirmed (20.2/69.1/10.6).
- White & green (gated by final career rating, same bands for both;
  Aya n=725k Global + uma.moe ~22M):
  - <6500: 90/10/0 · 6500–17499: **50/45/5** · ≥17500 (SS): 20/70/10 ·
    ≥28800 (UE): 17.5/70/12.5 (whites JP-sampled; green UE band extrapolated).
    **CORRECTION: reference doc's green below-SS 45/50/5 → 50/45/5.**
  - Green star roll is independent of unique-skill level (Famitsu claim debunked).
- Pink: 20/70/10 flat, ungated. Confirmed (n=22,411 + 200-uma manual sample).
- Pink pool: uniform over ALL aptitudes at A or S **at career end**, including
  aptitudes raised by inheritance; S gets no extra weight; unraced aptitudes
  eligible. Confirmed.

## White generation base + lineage copy bonus

- Base at 0 copies: white 20.08% / ◎ 24.92% / gold 39.96% (n≈732k) — the
  20/25/40 table confirmed. Race ~20%, scenario 19.89%. The generated spark is
  the white version's factor regardless of held tier.
- Copy bonus: **flat +2.5%/+5% REJECTED** (χ² p≈3.6e-14 white / 3.1e-19 gold).
  Default = **multiplicative `base × 1.1ⁿ`** (aoneko_pochi; fits all classes,
  p≥0.84, corroborated on uma.moe N=26.5M). Aya's piecewise fit retained as an
  alternative strategy (white 20+2/+2.75, ◎ 25+2.5/+3.4375, gold 40+4/+5.5).

## Race & scenario spark payouts

- **CORRECTION: race spark procs grant +3/+6/+9 stat by star (DATAMINED from
  the factor effect table)** — the reference doc claimed stars don't scale the
  race payout. Stars scale both payout and (low) proc rate.
- Scenario procs: two stats × +10/+20/+30 by star — confirmed by the datamine.

## Affinity — exact structure (DATAMINED, not statistical)

- `total = pair(t,p1) + pair(t,p2) + pair(p1,p2) + trio(t,p1,g11) +
  trio(t,p1,g12) + trio(t,p2,g21) + trio(t,p2,g22)` — verified identically in
  GameTora's shipped JS, hakuraku, waptia's Python, and ChronoGenesis. **There
  is no pair(parent, grandparent) term.**
- pair/trio = Σ relation_point over succession_relation groups containing
  both/all three charas (Global tables: 1,616 groups / 3,014 memberships).
- Tiers from `succession_relation_rank`: **△ 0–50, ○ 51–150, ◎ 151+**
  (reference doc's "○ 50–150" boundary corrected to 51).
- Trainee as her own grandparent: legal; that trio term is zeroed. Other
  duplicates are configuration errors.
- **Race-win bonus — OPEN DISPUTE between calculators (config switch):**
  - `'global-legacy'` (DEFAULT — GameTora's shipped EN rule, corroborated by
    fdaytalk/Steam guides): **+1 per shared won race counting G1+G2+G3**, plus
    **+1 per fully-shared crown triple** (Triple Crown, Triple Tiara, Spring
    and Autumn Senior Triples).
  - `'jp-modern'` (current JP rule; ChronoGenesis also applies it to Global):
    +3 per shared G1 only.
  - Applies on 5 links: (p1,p2), (p1,g11), (p1,g12), (p2,g21), (p2,g22); the
    trainee has no race history. The reference doc's "+3 per shared G1" is the
    JP rule.

## Misc

- Daily borrow limit: **5/day since 2026-01-16** (first free) — official notice
  + Steam threads. Reference doc's "verify 5 vs 3" resolved.
- Global scenarios as of 2026-07-16: URA Finale, Unity Cup, Trackblazer.
  **Grand Live ("Brighter Together! Our Grand Concert") releases 2026-07-22**;
  its scenario factor (30004 "Our Grand Concert") is included in static data.
  2026-07-14 update added 4 dirt G1s + 3 courses (already in our race data).
- Aptitude raise thresholds 1/4/7/10 → +1..+4, cap A at start, S only via
  event procs: confirmed twice independently (Game8 JP, GameWith JP).
- 3★ pink double-procs: exist (2-stage single-event jumps observed); no
  sampled rate anywhere; model procs as independent per-copy rolls (a separate
  double-proc constant is NOT needed). Low confidence, matches our engine.

## Still open

1. **Race-win bonus rule for Global** (+1 G1–G3 + crowns vs +3 G1-only) — the
   two biggest calculators disagree; we default to GameTora's shipped rule
   behind `RaceBonusRule`. Watch for an official-adjacent resolution.
2. Blue inspiration-roll distribution within 1–10/1–16/1–28 (uniform assumed).
3. Green UE+ star band is extrapolated (17.5/70/12.5), unsampled on Global.
4. Whether career-start green hint levels degrade at very low individual
   affinity (crazyfellow reports they can; not yet modeled — we grant
   hint = stars).
5. Verification agents for the blue/white/green groups were lost to session
   limits twice; those findings rest on the primary agents' multi-source
   citations rather than an independent adversarial pass.
