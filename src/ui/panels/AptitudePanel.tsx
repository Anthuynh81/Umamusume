import { useMemo, useState } from 'react'
import type { GameData } from '../../data/types'
import { effectiveAptitudes, pinkPool, raisedIntoPool } from '../../engine/aptitude'
import { slotLabel } from '../../model/tree'
import { APTITUDE_GROUPS, APTITUDE_KEYS, APTITUDE_LABELS } from '../../model/types'
import type { AptitudeKey, Grade } from '../../model/types'
import { useTreeStore } from '../../store/tree'

const GRADE_COLORS: Record<Grade, string> = {
  S: 'text-amber-500', A: 'text-orange-500', B: 'text-rose-500', C: 'text-emerald-600',
  D: 'text-sky-600', E: 'text-indigo-500', F: 'text-slate-500', G: 'text-slate-400',
}

/**
 * Live starting aptitudes: base → effective from lineage pink stars, for the
 * trainee AND any parent (parents need runnable aptitudes for farming).
 */
export function AptitudePanel({ data }: { data: GameData }) {
  const tree = useTreeStore((s) => s.tree)
  const [subject, setSubject] = useState(0)

  const candidates = [0, 1, 2].filter((i) => tree.slots[i])
  const slotIndex = candidates.includes(subject) ? subject : (candidates[0] ?? 0)
  const build = tree.slots[slotIndex]
  const variant = build ? data.variant(build.variantId) : undefined

  const report = useMemo(
    () => (variant ? effectiveAptitudes(tree, slotIndex, variant.aptitudes) : null),
    [tree, slotIndex, variant],
  )

  if (!report || !variant) {
    return (
      <section aria-label="Aptitudes" className="rounded-lg border border-slate-200 bg-white p-3">
        <h2 className="text-sm font-bold text-slate-700">Starting aptitudes</h2>
        <p className="mt-2 text-xs text-slate-400">Pick a trainee to see live aptitude raises.</p>
      </section>
    )
  }

  const effective = Object.fromEntries(
    APTITUDE_KEYS.map((k) => [k, report[k].effective]),
  ) as Record<AptitudeKey, Grade>
  const pool = pinkPool(effective)
  const raised = raisedIntoPool(report)

  const warnings: string[] = []
  for (const k of APTITUDE_KEYS) {
    const r = report[k]
    if (r.excess > 0 && r.totalStars >= 1) {
      warnings.push(
        r.toNext === null
          ? `${APTITUDE_LABELS[k]}: ${r.excess}★ wasted (already at the cap).`
          : `${APTITUDE_LABELS[k]}: ${r.excess}★ doing nothing — ${r.toNext}★ more for the next raise.`,
      )
    }
  }

  return (
    <section aria-label="Aptitudes" className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-slate-700">Starting aptitudes</h2>
        {candidates.length > 1 && (
          <select
            value={slotIndex}
            onChange={(e) => setSubject(Number(e.target.value))}
            aria-label="Whose aptitudes"
            className="ml-auto rounded border border-slate-300 px-1 py-0.5 text-xs"
          >
            {candidates.map((i) => (
              <option key={i} value={i}>
                {slotLabel(i)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(Object.entries(APTITUDE_GROUPS) as [string, readonly AptitudeKey[]][]).map(([group, keys]) => (
          <div key={group}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group}</div>
            <table className="w-full text-xs">
              <tbody>
                {keys.map((k) => {
                  const r = report[k]
                  const changed = r.effective !== r.base
                  return (
                    <tr key={k} className="border-b border-slate-50 last:border-0">
                      <td className="py-0.5 pr-1 text-slate-600">{APTITUDE_LABELS[k]}</td>
                      <td className={`w-5 text-right font-bold ${GRADE_COLORS[r.base]}`}>{r.base}</td>
                      <td className="w-8 text-center text-slate-300">{changed ? '→' : ''}</td>
                      <td className={`w-5 font-bold ${changed ? GRADE_COLORS[r.effective] : 'text-transparent'}`}>
                        {changed ? r.effective : r.base}
                      </td>
                      <td className="w-8 text-right text-[10px] text-slate-400">
                        {r.totalStars > 0 ? `${r.totalStars}★` : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="mt-2 space-y-1 text-[11px]">
        <p className="text-slate-500">
          Pink pool at career end: {pool.length > 0 ? pool.map((k) => APTITUDE_LABELS[k]).join(', ') : '—'}
          {pool.length > 0 && (
            <span className="text-slate-400"> · a specific pink is 1/{pool.length} ({(100 / pool.length).toFixed(0)}%)</span>
          )}
        </p>
        {raised.length > 0 && (
          <p className="rounded bg-pink-50 px-2 py-1 text-pink-700">
            Raised into the pool: {raised.map((k) => APTITUDE_LABELS[k]).join(', ')} — she can now roll these as
            pinks (the “pace B trap” if unwanted).
          </p>
        )}
        {warnings.map((w) => (
          <p key={w} className="rounded bg-amber-50 px-2 py-1 text-amber-700">{w}</p>
        ))}
        <p className="text-slate-400">Starting raises cap at A; S needs an Inspiration proc.</p>
      </div>
    </section>
  )
}
