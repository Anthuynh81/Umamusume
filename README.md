# Sparkline

An unofficial fan-made **legacy (inheritance) planner for Umamusume: Pretty Derby**, targeting the Global (EN) version. Plan family trees before grinding careers: live starting-aptitude math, the exact datamined affinity formula, per-spark inheritance chances, an uma library, blueprint saves, and compact share links.

Not affiliated with Cygames. No official assets are used. See `docs/ATTRIBUTION.md`.

## Develop

```sh
npm install
npm run dev        # local dev server
npm test           # engine + codec + app smoke tests (vitest)
npm run build      # typecheck + static production build (dist/)
node scripts/fetch-data.mjs   # refresh game-data snapshots after a game update
```

Fully static — deploy `dist/` anywhere (GitHub Pages, Cloudflare Pages, …). All persistence is in the browser (IndexedDB + localStorage) plus shareable URLs.

## Architecture

- `src/engine/` — pure TypeScript calculation engine (aptitude raises, affinity, proc rates, generation/farming math, wishlist, recommendations). No React. Unit-tested.
- `src/data/config/rates.ts` — every rate/threshold as a typed constant with a source citation. Rates are empirical community estimates; see `docs/research/rate-verification-report.md` for the evidence per number.
- `src/data/static/` — game-data snapshots produced by `scripts/fetch-data.mjs` (characters, cards, spark/factor tables, races, Global succession-relation tables).
- `src/model/` — tree/spark domain types and the versioned share-URL codec (`docs/serialization-v1.md`; the format is a public contract).
- `src/store/`, `src/ui/` — Zustand state + React/Tailwind UI. The silhouette avatars in `src/ui/avatar/` are the swappable asset layer.

Project brief: `docs/project-brief.md` · agent guide: `CLAUDE.md`.
