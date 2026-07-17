import { useMemo, useState } from 'react'
import type { GameData } from '../../data/types'
import {
  applyRaise, aptitudeDeficits, effectiveAptitudes, pinkPool, raisedIntoPool,
} from '../../engine/aptitude'
import { slotLabel } from '../../model/tree'
import { APTITUDE_GROUPS, APTITUDE_KEYS, APTITUDE_LABELS } from '../../model/types'
import type { AptitudeKey, Grade, Tree } from '../../model/types'
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

      {slotIndex === 0 && <ReversePlanner tree={tree} data={data} />}
    </section>
  )
}

/**
 * Reverse planner: set target starting grades for the trainee, get the star
 * deficits and the lineage slots that could carry the missing pinks.
 */
function ReversePlanner({ tree, data }: { tree: Tree; data: GameData }) {
  const [targets, setTargets] = useState<Partial<Record<AptitudeKey, Grade>>>({})
  const trainee = tree.slots[0]
  const variant = trainee ? data.variant(trainee.variantId) : undefined

  const deficits = useMemo(
    () => (variant ? aptitudeDeficits(tree, variant.aptitudes, targets) : []),
    [tree, variant, targets],
  )
  if (!variant) return null

  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-bold text-slate-700">
          Targets <span className="text-[10px] font-normal text-slate-400">reverse planner — what pinks does she still need?</span>
        </h3>
        <select
          value=""
          onChange={(e) => {
            const key = e.target.value as AptitudeKey
            if (key) setTargets((t) => ({ ...t, [key]: t[key] ?? 'A' }))
          }}
          aria-label="Add aptitude target"
          className="ml-auto rounded border border-slate-300 px-1 py-0.5 text-[11px]"
        >
          <option value="">+ target…</option>
          {APTITUDE_KEYS.filter((k) => !(k in targets)).map((k) => (
            <option key={k} value={k}>{APTITUDE_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {deficits.length === 0 ? (
        <p className="mt-1 text-[11px] text-slate-400">
          Add a target (e.g. Dirt → A) to see how many pink stars the lineage still needs.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1 text-[11px]">
          {deficits.map((d) => (
            <li key={d.key} className="rounded border border-slate-100 px-2 py-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{APTITUDE_LABELS[d.key]}</span>
                <span className="text-slate-400">{d.base} →</span>
                <select
                  value={d.target}
                  onChange={(e) => setTargets((t) => ({ ...t, [d.key]: e.target.value as Grade }))}
                  aria-label={`${APTITUDE_LABELS[d.key]} target grade`}
                  className="rounded border border-slate-300 px-1 py-0 text-[11px]"
                >
                  {(['S', 'A', 'B', 'C', 'D', 'E'] as Grade[]).map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <span className="ml-auto tabular-nums">
                  {!d.achievable && d.target === 'S' ? (
                    <span className="text-amber-600">needs a proc (start caps at A)</span>
                  ) : !d.achievable ? (
                    <span className="text-red-600">unreachable — +4 from {d.base} is {applyRaise(d.base, 4)}</span>
                  ) : d.deficit === 0 ? (
                    <span className="text-emerald-600">met ✓ ({d.currentStars}★)</span>
                  ) : (
                    <span className="font-semibold text-indigo-600">
                      {d.deficit}★ more ({d.currentStars}/{d.neededStars})
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${APTITUDE_LABELS[d.key]} target`}
                  onClick={() =>
                    setTargets((t) => {
                      const { [d.key]: _drop, ...rest } = t
                      return rest
                    })
                  }
                  className="text-slate-300 hover:text-red-500"
                >
                  ×
                </button>
              </div>
              {d.deficit > 0 && d.achievable && (
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Room for it:{' '}
                  {[
                    d.emptySlots.length > 0 && `${d.emptySlots.length} empty (${d.emptySlots.map(slotLabel).join(', ')})`,
                    d.pinklessSlots.length > 0 && `${d.pinklessSlots.length} without a pink (${d.pinklessSlots.map(slotLabel).join(', ')})`,
                    d.upgradableSlots.length > 0 && `${d.upgradableSlots.length} upgradable ${APTITUDE_LABELS[d.key]} cop${d.upgradableSlots.length > 1 ? 'ies' : 'y'}`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'no open slots — swap a pink somewhere'}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
