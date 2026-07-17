import { useEffect, useMemo, useState } from 'react'
import type { GameData } from '../../data/types'
import { TIER_SYMBOLS, affinityTier } from '../../engine/affinity'
import { planArrangements } from '../../engine/planner'
import type { PlannedArrangement, PlannerCandidate } from '../../engine/planner'
import { pct } from '../../lib/format'
import type { LibraryUma } from '../../model/library'
import { listLibrary } from '../../store/persist'
import { useTreeStore } from '../../store/tree'

/**
 * The full planner: arrange saved umas into the 6 legacy slots. With no
 * targets it maximizes affinity; with target sparks chosen it maximizes the
 * odds of inheriting them (coverage → P(all) → affinity), respecting the
 * one-borrow rule. Owned support cards that can TEACH a target skill during
 * the run are surfaced per target — a spark only generates if the skill is
 * actually learned.
 */
export function OptimizerPanel({ data }: { data: GameData }) {
  const tree = useTreeStore((s) => s.tree)
  const rule = useTreeStore((s) => s.settings.raceBonusRule)
  const setSlot = useTreeStore((s) => s.setSlot)
  const ownedSupports = useTreeStore((s) => s.ownedSupports)
  const [umas, setUmas] = useState<LibraryUma[]>([])
  const [required, setRequired] = useState<number[]>([])
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [targets, setTargets] = useState<number[]>([])
  const [targetQuery, setTargetQuery] = useState('')
  const [results, setResults] = useState<PlannedArrangement[] | null>(null)

  useEffect(() => {
    void listLibrary().then(setUmas)
  }, [tree])

  const traineeChara = useMemo(() => {
    const build = tree.slots[0]
    return build ? data.charaIdOf(build.variantId) : undefined
  }, [tree, data])

  const candidates: PlannerCandidate[] = useMemo(
    () =>
      umas
        .filter((u) => u.id !== undefined)
        .filter((u) => !ownedOnly || u.owned)
        .map((u) => ({
          id: u.id!,
          variantId: u.build.variantId,
          name: u.name,
          wonRaces: u.build.wonRaces,
          owned: u.owned,
          whites: u.build.whites,
        })),
    [umas, ownedOnly],
  )

  const targetCandidates = useMemo(() => {
    const q = targetQuery.trim().toLowerCase()
    if (!q) return []
    return data.sparks
      .filter((s) => s.global && !targets.includes(s.id) && s.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [data, targetQuery, targets])

  /** Owned Global support cards able to teach any version of the target's skill group. */
  const cardSources = (refId: number) => {
    const groupSkillIds = new Set(data.skills.filter((s) => s.factorId === refId).map((s) => s.id))
    return data.supportCards.filter(
      (c) => c.global && ownedSupports[c.id] !== undefined && c.skillIds.some((id) => groupSkillIds.has(id)),
    )
  }

  const run = () => {
    if (traineeChara === undefined) return
    setResults(
      planArrangements(traineeChara, candidates, targets, data, {
        limit: 10,
        requiredParentIds: required,
        raceBonusRule: rule,
        maxBorrowed: ownedOnly ? 0 : 1,
      }),
    )
  }

  const apply = (arr: PlannedArrangement) => {
    const byId = new Map(umas.map((u) => [u.id, u]))
    const place = (slot: number, cand: { id: number } | undefined) => {
      const uma = cand ? byId.get(cand.id) : undefined
      setSlot(slot, uma ? structuredClone(uma.build) : null)
    }
    place(1, arr.parents[0])
    place(2, arr.parents[1])
    place(3, arr.gps[0][0])
    place(4, arr.gps[0][1])
    place(5, arr.gps[1][0])
    place(6, arr.gps[1][1])
  }

  return (
    <section aria-label="Planner" className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-slate-700">Planner</h2>
        <span className="text-[10px] text-slate-400">{candidates.length} umas</span>
        <label
          className="flex items-center gap-1 text-[11px] text-slate-500"
          title="Exclude rentals/borrowed ancestors entirely (otherwise at most ONE non-owned uma is allowed, as a parent — the game's one-borrow rule)"
        >
          <input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} />
          only my umas
        </label>
        <button
          type="button"
          onClick={run}
          disabled={traineeChara === undefined || candidates.length < 2}
          className="ml-auto rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {targets.length > 0 ? 'Find best odds' : 'Optimize affinity'}
        </button>
      </div>

      {traineeChara === undefined ? (
        <p className="mt-2 text-xs text-slate-400">Pick a trainee first — the planner arranges your library around her.</p>
      ) : candidates.length < 2 ? (
        <p className="mt-2 text-xs text-slate-400">Save at least two umas to the library (or import from UmaExtractor).</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-slate-500">Target sparks:</span>
            {targets.map((refId) => {
              const spark = data.spark(refId)
              const sources = spark?.kind === 'skill' ? cardSources(refId) : null
              return (
                <span key={refId} className="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2 pr-1 text-[11px]">
                  {spark?.name ?? `#${refId}`}
                  {sources && sources.length > 0 && (
                    <span
                      className="rounded bg-emerald-100 px-1 text-[10px] text-emerald-700"
                      title={`Your cards that can teach it: ${sources.map((c) => `${c.name} (LB${ownedSupports[c.id]})`).join(', ')}`}
                    >
                      {sources.length} card{sources.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {sources && sources.length === 0 && (
                    <span
                      className="rounded bg-amber-100 px-1 text-[10px] text-amber-700"
                      title="No support card seen in your runs teaches this skill — she'd need the hint from the inherited sparks themselves or an unrecorded card"
                    >
                      no card
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove target ${spark?.name ?? refId}`}
                    onClick={() => setTargets(targets.filter((t) => t !== refId))}
                    className="text-slate-400 hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              )
            })}
            <span className="relative">
              <input
                type="search"
                value={targetQuery}
                onChange={(e) => setTargetQuery(e.target.value)}
                placeholder={targets.length === 0 ? 'Add skills you want (e.g. Groundwork)…' : 'Add…'}
                aria-label="Add target spark"
                className="w-48 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
              />
              {targetCandidates.length > 0 && (
                <span className="absolute left-0 top-8 z-10 block w-56 rounded border border-slate-200 bg-white text-xs shadow">
                  {targetCandidates.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setTargets([...targets, s.id])
                        setTargetQuery('')
                      }}
                      className="block w-full px-2 py-1 text-left hover:bg-indigo-50"
                    >
                      {s.name}
                      {s.kind !== 'skill' && <span className="ml-1 text-[10px] text-slate-400">{s.kind}</span>}
                    </button>
                  ))}
                </span>
              )}
            </span>
          </div>

          <label className="mt-2 block text-[11px] text-slate-500">
            Must include as parent
            <select
              multiple
              value={required.map(String)}
              onChange={(e) => setRequired([...e.target.selectedOptions].map((o) => Number(o.value)).slice(0, 2))}
              className="mt-1 h-16 w-full rounded border border-slate-300 px-1 py-0.5 text-xs"
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          {results && (
            <ol className="mt-2 space-y-1.5">
              {results.map((arr, i) => (
                <li key={i} className="rounded border border-slate-100 p-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-amber-600">
                      {TIER_SYMBOLS[affinityTier(arr.affinity)]} {arr.affinity}
                    </span>
                    <span className="truncate text-slate-600">
                      {arr.parents.map((p) => (
                        <span key={p.id}>
                          {p !== arr.parents[0] && ' + '}
                          {p.name}
                          {!p.owned && (
                            <span className="ml-0.5 rounded bg-violet-100 px-1 text-[10px] text-violet-700" title="Not in your roster — this is the career's one allowed borrow">
                              rental
                            </span>
                          )}
                        </span>
                      ))}
                    </span>
                    {targets.length > 0 && (
                      <span className="font-bold tabular-nums text-indigo-600" title="Chance every covered target is inherited in one career">
                        P {pct(arr.pAllCovered)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => apply(arr)}
                      className="ml-auto rounded border border-indigo-300 px-2 py-0.5 text-[11px] text-indigo-600 hover:bg-indigo-50"
                    >
                      Apply
                    </button>
                  </div>
                  {targets.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1 text-[10px]">
                      {arr.perTarget.map((t) => (
                        <span
                          key={t.refId}
                          className={`rounded px-1 ${t.copies > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-600'}`}
                          title={`${t.copies} cop${t.copies === 1 ? 'y' : 'ies'} in this arrangement`}
                        >
                          {data.spark(t.refId)?.name ?? t.refId}: {t.copies > 0 ? pct(t.perCareer) : 'no copies'}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-0.5 truncate text-[10px] text-slate-400">
                    {arr.parents[0].name} ← {arr.gps[0].map((g) => g.name).join(', ') || '—'} ·{' '}
                    {arr.parents[1].name} ← {arr.gps[1].map((g) => g.name).join(', ') || '—'}
                  </div>
                </li>
              ))}
              {results.length === 0 && <li className="text-xs text-slate-400">No legal arrangement found.</li>}
            </ol>
          )}
          <p className="mt-1 text-[10px] text-slate-400">
            Odds are per-career inheritance chances at each slot's individual affinity; ranking is targets covered →
            P(all) → affinity. One borrow max, parents only. Card badges use the support cards seen in your imported
            runs. Applying replaces the six legacy slots with the full saved builds.
          </p>
        </>
      )}
    </section>
  )
}
