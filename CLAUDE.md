# Sparkline — Umamusume Legacy Planner (unofficial fan tool)

English inheritance/legacy planner for Umamusume: Pretty Derby, targeting the **Global (EN)** game version. Full product spec: `docs/project-brief.md`. Rate-table source of truth: `docs/research/spark-math-reference.md` (empirical community data; every number is provisional).

## Architecture rules

- **Engine is pure TypeScript** (`src/engine/`), zero React imports, unit-tested with Vitest. UI consumes it; never put probability/aptitude/affinity math in components.
- **All rate tables, thresholds, and affinity constants live in `src/data/config/`** as typed constants, each with a source citation comment. Never hardcode a rate in a component or engine function body — community understanding of server-side rates changes.
- **Two distinct probabilities, never conflated** (in code, UI copy, and variable names): *spark chance* = generation (does a trained uma end her career with a spark) vs *proc chance* = inheritance (does an existing lineage spark activate for the trainee).
- **Serialization is a public contract.** `src/model/serialize.ts` implements versioned binary + base64url share URLs (spec: `docs/serialization-v1.md`). Old links must keep decoding forever; add versions, never mutate v1.
- Tree slots are heap-indexed (0 = trainee, children of i at 2i+1 / 2i+2, 31 slots = 4 ancestor generations). On Global only generations 1–2 (parents + grandparents) affect the trainee; deeper slots are planning slots. A future "JP mode" (genes system) must slot in behind a version toggle.
- Identity is by **base character** — outfits/variants of the same character are the same uma for affinity and the self-lineage rule.
- UI labels use official Global terms: Legacy / Sparks / Inspiration / Trainee / Aptitude. Keep JP-derived synonyms (factors, inheritance) only in searchable text.
- No official game assets. Placeholder art = tinted generic silhouettes behind a swappable asset layer (`src/ui/avatar/`).
- Mobile-first; tree is keyboard-navigable; drag-and-drop always has a click-to-copy fallback.
- Dark mode = palette inversion in `src/index.css` (`.dark` flips each hue's CSS variables end-for-end), NOT per-component `dark:` variants. If you introduce a new color hue, add its flip block there; don't hand-write dark: classes.

## Commands

- `npm run dev` / `npm run build` / `npm test` / `npm run typecheck`
- Static deploy only; no backend. Persistence = IndexedDB (Dexie) + localStorage (settings) + share URLs.
