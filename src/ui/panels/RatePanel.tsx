import { useMemo, useState } from 'react'
import type { GameData } from '../../data/types'
import { affinityBreakdown } from '../../engine/affinity'
import { inheritanceRates } from '../../engine/proc'
import type { SparkColor } from '../../engine/proc'
import { pct, stars as starStr } from '../../lib/format'
import { slotLabel } from '../../model/tree'
import { useTreeStore } from '../../store/tree'
import { rowName } from './sparkNames'

const COLOR_FILTERS: { key: SparkColor | 'all'; label: string; cls: string }[] = [
  { key: 'all', label: 'All', cls: 'bg-slate-700 text-white' },
  { key: 'white', label: 'White', cls: 'bg-slate-200 text-slate-700' },
  { key: 'green', label: 'Green', cls: 'bg-emerald-200 text-emerald-800' },
  { key: 'pink', label: 'Pink', cls: 'bg-pink-200 text-pink-800' },
  { key: 'blue', label: 'Blue', cls: 'bg-sky-200 text-sky-800' },
]

/**
 * Inheritance rate panel: per-spark % the trainee receives it, per Inspiration
 * event and per career, grouped across copies in the lineage.
 */
export function RatePanel({ data }: { data: GameData }) {
  const tree = useTreeStore((s) => s.tree)
  const rule = useTreeStore((s) => s.settings.raceBonusRule)
  const wishlist = useTreeStore((s) => s.wishlist)
  const toggleWishlist = useTreeStore((s) => s.toggleWishlist)
  const [filter, setFilter] = useState<SparkColor | 'all'>('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const { perSlot } = affinityBreakdown(tree, 0, data, { raceBonusRule: rule })
    return inheritanceRates(tree, data, perSlot)
  }, [tree, data, rule])

  const shown = rows
    .filter((r) => filter === 'all' || r.color === filter)
    .filter((r) => !query || rowName(r, data).toLowerCase().includes(query.toLowerCase()))

  return (
    <section aria-label="Inheritance rates" className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-slate-700">Inheritance chances</h2>
        <div className="ml-auto flex gap-1">
          {COLOR_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded px-2 py-0.5 text-[11px] ${filter === f.key ? f.cls : 'bg-slate-100 text-slate-400'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">Add sparks to parents and grandparents to see proc chances.</p>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter sparks… (e.g. Groundwork)"
            aria-label="Filter sparks"
            className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
          />
          <div className="mt-1 max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="w-6" aria-label="Wishlist" />
                  <th className="py-1 font-semibold">Spark</th>
                  <th className="font-semibold">Copies</th>
                  <th className="text-right font-semibold" title="Chance at one Inspiration event">Event</th>
                  <th className="text-right font-semibold" title="Cumulative across both Inspirations">Career</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100">
                    <td>
                      <button
                        type="button"
                        onClick={() => toggleWishlist(row.key)}
                        aria-pressed={wishlist.includes(row.key)}
                        aria-label={`Wishlist ${rowName(row, data)}`}
                        title="Flag as must-have (wishlist)"
                        className={wishlist.includes(row.key) ? 'text-amber-500' : 'text-slate-300 hover:text-slate-400'}
                      >
                        ★
                      </button>
                    </td>
                    <td className="py-1 pr-1">
                      <span
                        className={`mr-1 inline-block h-2 w-2 rounded-full align-middle ${
                          row.color === 'white' ? 'bg-slate-300' : row.color === 'green' ? 'bg-emerald-400' : row.color === 'pink' ? 'bg-pink-400' : 'bg-sky-400'
                        }`}
                      />
                      {rowName(row, data)}
                      {row.kind && row.kind !== 'skill' && (
                        <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">{row.kind}</span>
                      )}
                    </td>
                    <td className="text-[10px] text-slate-500">
                      {row.copies.map((c) => `${slotLabel(c.slot)} ${starStr(c.stars)}`).join(', ')}
                    </td>
                    <td className="text-right tabular-nums">{pct(row.perEvent)}</td>
                    <td className="text-right font-semibold tabular-nums">{pct(row.perCareer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Blue career-start bonuses (+5/+12/+21 per star) are guaranteed and not listed; blue rows show the extra
            event procs. Copies of the same spark combine within an event.
          </p>
        </>
      )}
    </section>
  )
}
