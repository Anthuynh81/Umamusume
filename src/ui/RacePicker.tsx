import { useMemo, useState } from 'react'
import type { GameData } from '../data/types'

const GRADE_LABELS: Record<number, string> = { 100: 'G1', 200: 'G2', 300: 'G3' }

/**
 * Won-races multi-select. Shared wins between linked slots feed the affinity
 * race bonus (G2/G3 count under the Global 'legacy' rule; G1 always counts).
 */
export function RacePicker({
  data,
  value,
  onChange,
}: {
  data: GameData
  value: number[]
  onChange: (raceIds: number[]) => void
}) {
  const [query, setQuery] = useState('')
  const selected = useMemo(() => new Set(value), [value])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return data.races.filter((r) => !selected.has(r.id) && r.name.toLowerCase().includes(q)).slice(0, 20)
  }, [data, query, selected])

  const nameOf = (id: number) => data.race(id)?.name ?? `#${id}`
  const gradeOf = (id: number) => GRADE_LABELS[data.race(id)?.grade ?? 0] ?? '?'

  return (
    <fieldset>
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
        Won races <span className="font-normal normal-case text-slate-400">(shared wins add affinity)</span>
      </legend>

      {value.length > 0 && (
        <ul className="mb-1 flex flex-wrap gap-1">
          {value.map((id) => (
            <li key={id} className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-800">
              <span className="font-semibold">{gradeOf(id)}</span> {nameOf(id)}
              <button
                type="button"
                aria-label={`Remove ${nameOf(id)}`}
                onClick={() => onChange(value.filter((x) => x !== id))}
                className="text-violet-400 hover:text-red-500"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Add a won race…"
        aria-label="Search races"
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
      />
      {query && (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded border border-slate-200 bg-white text-xs shadow-sm">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onChange([...value, r.id])
                  setQuery('')
                }}
                className="block w-full px-2 py-1 text-left hover:bg-indigo-50"
              >
                <span className="font-semibold text-slate-500">{GRADE_LABELS[r.grade]}</span> {r.name}
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-2 py-1 text-slate-400">No matches.</li>}
        </ul>
      )}
    </fieldset>
  )
}
