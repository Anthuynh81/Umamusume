import { useMemo } from 'react'
import type { GameData } from '../../data/types'
import { TIER_SYMBOLS, affinityBreakdown } from '../../engine/affinity'
import { slotLabel } from '../../model/tree'
import { slotPairKey } from '../../model/types'
import { useTreeStore } from '../../store/tree'

function linkLabel(a: number, b: number): string {
  return `${slotLabel(a)} × ${slotLabel(b)}`
}

/** Affinity total, per-link breakdown, and manual shared-win entry. */
export function AffinityPanel({ data }: { data: GameData }) {
  const tree = useTreeStore((s) => s.tree)
  const rule = useTreeStore((s) => s.settings.raceBonusRule)
  const setSetting = useTreeStore((s) => s.setSetting)
  const setExtraWins = useTreeStore((s) => s.setExtraWins)

  const breakdown = useMemo(
    () => affinityBreakdown(tree, 0, data, { raceBonusRule: rule }),
    [tree, data, rule],
  )

  if (breakdown.links.length === 0) {
    return (
      <section aria-label="Affinity" className="rounded-lg border border-slate-200 bg-white p-3">
        <h2 className="text-sm font-bold text-slate-700">Affinity</h2>
        <p className="mt-2 text-xs text-slate-400">Fill the trainee and legacies to see compatibility.</p>
      </section>
    )
  }

  return (
    <section aria-label="Affinity" className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-slate-700">Affinity</h2>
        <span
          className={`rounded px-2 py-0.5 text-sm font-bold ${
            breakdown.tier === 'excellent'
              ? 'bg-amber-100 text-amber-700'
              : breakdown.tier === 'good'
                ? 'bg-slate-100 text-slate-700'
                : 'bg-red-100 text-red-700'
          }`}
        >
          {TIER_SYMBOLS[breakdown.tier]} {breakdown.total}
        </span>
        <label className="ml-auto flex items-center gap-1 text-[11px] text-slate-500" title="The two big calculators disagree for Global; see docs/research/rate-verification-report.md">
          Win bonus rule
          <select
            value={rule}
            onChange={(e) => setSetting('raceBonusRule', e.target.value as typeof rule)}
            className="rounded border border-slate-300 px-1 py-0.5"
          >
            <option value="global-legacy">Global (GameTora): +1/G1–G3 + crowns</option>
            <option value="jp-modern">JP rule: +3/G1</option>
          </select>
        </label>
      </div>

      {breakdown.tier === 'poor' && (
        <p role="alert" className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
          △ compatibility — proc rates collapse at this level. Treat this as a failure state, not a lower grade.
        </p>
      )}

      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
            <th className="py-1 font-semibold">Link</th>
            <th className="text-right font-semibold">Base</th>
            <th className="text-right font-semibold" title="Shared won races (+ manual extras)">Wins</th>
            <th className="text-right font-semibold">Bonus</th>
            <th className="text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.links.map((l) => {
            const eligible = l.kind !== 'trainee-parent'
            return (
              <tr key={`${l.a}-${l.b}`} className={`border-t border-slate-100 ${l.selfLink ? 'text-slate-400' : ''}`}>
                <td className="py-1 pr-1">
                  {linkLabel(l.a, l.b)}
                  {l.selfLink && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px]">self — zero</span>}
                  {l.crownSets > 0 && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">+{l.crownSets} crown</span>}
                </td>
                <td className="text-right tabular-nums">{l.pairPoints + l.trioPoints}</td>
                <td className="text-right">
                  {eligible && !l.selfLink ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="tabular-nums">{l.sharedWins}</span>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={tree.extraWins[slotPairKey(l.a, l.b)] ?? 0}
                        onChange={(e) => setExtraWins(slotPairKey(l.a, l.b), Math.max(0, Number(e.target.value)))}
                        aria-label={`Manual extra shared wins for ${linkLabel(l.a, l.b)}`}
                        title="Manual extra shared wins (if you know the count without picking races)"
                        className="w-10 rounded border border-slate-200 px-1 py-0 text-right text-[11px]"
                      />
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="text-right tabular-nums">{l.winBonus > 0 ? `+${l.winBonus}` : ''}</td>
                <td className="text-right font-semibold tabular-nums">{l.total}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-slate-400">
        Grandparent links score trio(trainee, parent, grandparent) — the trainee as her own grandparent is legal
        but contributes zero.
      </p>
    </section>
  )
}
