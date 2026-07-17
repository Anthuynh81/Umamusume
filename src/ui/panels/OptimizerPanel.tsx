import { useEffect, useMemo, useState } from 'react'
import type { GameData } from '../../data/types'
import { TIER_SYMBOLS } from '../../engine/affinity'
import { optimizeArrangements } from '../../engine/optimizer'
import type { Arrangement, OptimizerCandidate } from '../../engine/optimizer'
import type { LibraryUma } from '../../model/library'
import { listLibrary } from '../../store/persist'
import { useTreeStore } from '../../store/tree'

/**
 * The library optimizer: arrange saved umas into the 6 legacy slots for
 * maximum affinity. Applying an arrangement copies the full builds (sparks,
 * won races) into the tree.
 */
export function OptimizerPanel({ data }: { data: GameData }) {
  const tree = useTreeStore((s) => s.tree)
  const rule = useTreeStore((s) => s.settings.raceBonusRule)
  const setSlot = useTreeStore((s) => s.setSlot)
  const [umas, setUmas] = useState<LibraryUma[]>([])
  const [required, setRequired] = useState<number[]>([])
  const [results, setResults] = useState<Arrangement[] | null>(null)

  useEffect(() => {
    void listLibrary().then(setUmas)
  }, [tree]) // refresh when the tree changes (library saves happen via the editor)

  const traineeChara = useMemo(() => {
    const build = tree.slots[0]
    return build ? data.charaIdOf(build.variantId) : undefined
  }, [tree, data])

  const candidates: OptimizerCandidate[] = useMemo(
    () =>
      umas
        .filter((u) => u.id !== undefined)
        .map((u) => ({ id: u.id!, variantId: u.build.variantId, name: u.name, wonRaces: u.build.wonRaces })),
    [umas],
  )

  const run = () => {
    if (traineeChara === undefined) return
    setResults(
      optimizeArrangements(traineeChara, candidates, data, {
        limit: 10,
        requiredParentIds: required,
        raceBonusRule: rule,
      }),
    )
  }

  const apply = (arr: Arrangement) => {
    const byId = new Map(umas.map((u) => [u.id, u]))
    const place = (slot: number, cand: OptimizerCandidate | undefined) => {
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
    <section aria-label="Library optimizer" className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-slate-700">Library optimizer</h2>
        <span className="text-[10px] text-slate-400">{candidates.length} umas</span>
        <button
          type="button"
          onClick={run}
          disabled={traineeChara === undefined || candidates.length < 2}
          className="ml-auto rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          Optimize
        </button>
      </div>

      {traineeChara === undefined ? (
        <p className="mt-2 text-xs text-slate-400">Pick a trainee first — the optimizer arranges your library around her.</p>
      ) : candidates.length < 2 ? (
        <p className="mt-2 text-xs text-slate-400">Save at least two umas to the library to optimize.</p>
      ) : (
        <>
          <label className="mt-2 block text-[11px] text-slate-500">
            Must include as parent
            <select
              multiple
              value={required.map(String)}
              onChange={(e) =>
                setRequired([...e.target.selectedOptions].map((o) => Number(o.value)).slice(0, 2))
              }
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
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-600">
                      {TIER_SYMBOLS[arr.tier]} {arr.score}
                    </span>
                    <span className="truncate text-slate-600">
                      {arr.parents.map((p) => p.name).join(' + ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => apply(arr)}
                      className="ml-auto rounded border border-indigo-300 px-2 py-0.5 text-[11px] text-indigo-600 hover:bg-indigo-50"
                    >
                      Apply
                    </button>
                  </div>
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
            Scores include base affinity + shared-win bonuses from each uma's won races ({rule === 'global-legacy' ? 'Global rule' : 'JP rule'}).
            Applying replaces the six legacy slots with the full saved builds.
          </p>
        </>
      )}
    </section>
  )
}
