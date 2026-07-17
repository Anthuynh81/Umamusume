import { useMemo, useState } from 'react'
import type { GameData } from '../../data/types'
import { recommendLoopPools } from '../../engine/loopPool'
import type { LoopPoolResult } from '../../engine/loopPool'
import { recommendForSlot } from '../../engine/recommend'
import { slotLabel } from '../../model/tree'
import { emptyBuild } from '../../model/types'
import { useTreeStore } from '../../store/tree'
import { Avatar } from '../avatar/Avatar'

/** Slot recommendations over the whole roster, ranked by affinity delta. */
export function RecommendPanel({ data }: { data: GameData }) {
  const tree = useTreeStore((s) => s.tree)
  const depth = useTreeStore((s) => s.settings.depth)
  const setSlot = useTreeStore((s) => s.setSlot)
  const [target, setTarget] = useState<number | null>(null)

  const maxSlot = 2 ** (depth + 1) - 2
  const emptySlots = useMemo(
    () => Array.from({ length: maxSlot }, (_, k) => k + 1).filter((i) => !tree.slots[i]),
    [tree, maxSlot],
  )
  const slot = target !== null && emptySlots.includes(target) ? target : (emptySlots[0] ?? null)

  const recs = useMemo(
    () => (slot !== null && tree.slots[0] ? recommendForSlot(tree, slot, data, { limit: 10 }) : []),
    [tree, slot, data],
  )

  return (
    <section aria-label="Recommendations" className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-slate-700">Recommend</h2>
        {emptySlots.length > 0 && (
          <select
            value={slot ?? ''}
            onChange={(e) => setTarget(Number(e.target.value))}
            aria-label="Slot to fill"
            className="ml-auto rounded border border-slate-300 px-1 py-0.5 text-xs"
          >
            {emptySlots.map((i) => (
              <option key={i} value={i}>{slotLabel(i)}</option>
            ))}
          </select>
        )}
      </div>

      {!tree.slots[0] ? (
        <p className="mt-2 text-xs text-slate-400">Pick a trainee first.</p>
      ) : emptySlots.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">No empty slots at this depth.</p>
      ) : (
        <>
          <ol className="mt-2 space-y-1">
            {recs.map((r, i) => (
              <li key={r.charaId}>
                <button
                  type="button"
                  onClick={() => slot !== null && setSlot(slot, emptyBuild(r.variantId))}
                  title={`Place ${r.name} in ${slot !== null ? slotLabel(slot) : ''}`}
                  className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-indigo-50"
                >
                  <span className="w-4 text-right text-[10px] text-slate-400">{i + 1}</span>
                  <Avatar chara={data.character(r.charaId)} size={22} />
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="font-semibold tabular-nums text-indigo-600">+{r.delta}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-1 text-[10px] text-slate-400">
            Base affinity only — shared-win bonuses are not included. Add expected wins on the Affinity panel.
          </p>
        </>
      )}

      <LoopPoolBuilder data={data} />
    </section>
  )
}

/**
 * Loop-pool builder: seed any number of characters and search the roster for
 * the pools with the best MUTUAL affinity (Σ over all pairs) — the metric
 * for a rotating legacy loop where every member eventually breeds with every
 * other.
 */
function LoopPoolBuilder({ data }: { data: GameData }) {
  const setRacePool = useTreeStore((s) => s.setRacePool)
  const setSetting = useTreeStore((s) => s.setSetting)
  const [seeds, setSeeds] = useState<number[]>([])
  const [size, setSize] = useState(4)
  const [query, setQuery] = useState('')
  const [pools, setPools] = useState<LoopPoolResult[] | null>(null)

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return data.characters
      .filter((c) => c.global && !seeds.includes(c.id) && c.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [data, query, seeds])

  const run = () => setPools(recommendLoopPools(seeds, data, { size, limit: 5 }))

  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-bold text-slate-700">
          Loop pool builder{' '}
          <span className="text-[10px] font-normal text-slate-400">best mutually compatible rotation pool</span>
        </h3>
        <label className="ml-auto flex items-center gap-1 text-[11px] text-slate-500">
          Size
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            aria-label="Pool size"
            className="rounded border border-slate-300 px-1 py-0.5"
          >
            {[3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={run}
          disabled={seeds.length > size}
          className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          Find pools
        </button>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {seeds.map((id) => (
          <span key={id} className="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-1 pr-2 text-xs">
            <Avatar chara={data.character(id)} size={18} />
            {data.character(id)?.name}
            <button
              type="button"
              aria-label={`Remove seed ${data.character(id)?.name}`}
              onClick={() => setSeeds(seeds.filter((x) => x !== id))}
              className="text-slate-400 hover:text-red-500"
            >
              ×
            </button>
          </span>
        ))}
        <span className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={seeds.length === 0 ? 'Seed characters you want in the loop (optional)…' : 'Add seed…'}
            aria-label="Add seed character"
            className="w-56 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
          />
          {candidates.length > 0 && (
            <span className="absolute left-0 top-8 z-10 block w-56 rounded border border-slate-200 bg-white text-xs shadow">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSeeds([...seeds, c.id])
                    setQuery('')
                  }}
                  className="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-indigo-50"
                >
                  <Avatar chara={c} size={18} /> {c.name}
                </button>
              ))}
            </span>
          )}
        </span>
      </div>

      {pools && (
        <ol className="mt-2 space-y-1.5">
          {pools.map((pool, i) => (
            <li key={pool.members.join('-')} className="rounded border border-slate-100 p-1.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-4 text-right text-[10px] text-slate-400">{i + 1}</span>
                {pool.members.map((id) => (
                  <span key={id} className="flex items-center gap-1">
                    <Avatar chara={data.character(id)} size={20} />
                    <span className="truncate">{data.character(id)?.name}</span>
                  </span>
                ))}
                <span className="ml-auto font-bold tabular-nums text-indigo-600" title="Sum of base affinity over every pair in the pool">
                  Σ {pool.total}
                </span>
                <span
                  className={`tabular-nums ${pool.minPair < 25 ? 'text-red-600' : 'text-slate-400'}`}
                  title="The weakest pair in the pool — a loop is only as strong as its worst rotation"
                >
                  min {pool.minPair}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRacePool(pool.members)
                    setSetting('activeTool', 'races')
                  }}
                  className="rounded border border-indigo-300 px-2 py-0.5 text-[11px] text-indigo-600 hover:bg-indigo-50"
                  title="Open this pool in the race planner"
                >
                  Plan races →
                </button>
              </div>
            </li>
          ))}
          {pools.length === 0 && <li className="text-xs text-slate-400">No pools found (too many seeds for the size?).</li>}
        </ol>
      )}
      <p className="mt-1 text-[10px] text-slate-400">
        Base affinity only (shared wins come on top — check the pool in the race planner). Build loops around a
        shared running style; distance can be raised with pinks.
      </p>
    </div>
  )
}
