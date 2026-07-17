import { useMemo } from 'react'
import type { GameData } from '../../data/types'
import { affinityBreakdown } from '../../engine/affinity'
import { inheritanceRates } from '../../engine/proc'
import { countDistribution, expectedCount } from '../../engine/wishlist'
import { pct } from '../../lib/format'
import { useTreeStore } from '../../store/tree'
import { rowName } from './sparkNames'

/**
 * Wishlist aggregation: expected inherited count and P(at least N) over the
 * sparks flagged (★) in the rate panel. Sparks are treated as independent —
 * community data has not shown correlated rolls.
 */
export function WishlistPanel({ data }: { data: GameData }) {
  const tree = useTreeStore((s) => s.tree)
  const rule = useTreeStore((s) => s.settings.raceBonusRule)
  const wishlist = useTreeStore((s) => s.wishlist)
  const toggleWishlist = useTreeStore((s) => s.toggleWishlist)

  const flagged = useMemo(() => {
    const { perSlot } = affinityBreakdown(tree, 0, data, { raceBonusRule: rule })
    return inheritanceRates(tree, data, perSlot).filter((r) => wishlist.includes(r.key))
  }, [tree, data, rule, wishlist])

  const ps = flagged.map((r) => r.perCareer)
  const dist = useMemo(() => countDistribution(ps), [ps])
  const atLeast = (n: number) => dist.slice(n).reduce((a, b) => a + b, 0)

  return (
    <section aria-label="Wishlist" className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="text-sm font-bold text-slate-700">
        Wishlist <span className="text-[10px] font-normal text-slate-400">must-have sparks per career</span>
      </h2>

      {flagged.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">
          Flag sparks with the ★ in the Inheritance chances panel to see combined odds here.
        </p>
      ) : (
        <>
          <ul className="mt-2 space-y-0.5 text-xs">
            {flagged.map((r) => (
              <li key={r.key} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleWishlist(r.key)}
                  aria-label={`Unflag ${rowName(r, data)}`}
                  className="text-amber-500"
                >
                  ★
                </button>
                <span className="flex-1 truncate">{rowName(r, data)}</span>
                <span className="tabular-nums text-slate-500">{pct(r.perCareer)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Expected</div>
              <div className="text-lg font-bold text-indigo-700">{expectedCount(ps).toFixed(2)}</div>
            </div>
            {Array.from({ length: Math.min(flagged.length, 4) }, (_, k) => k + 1).map((n) => (
              <div key={n}>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">≥ {n}</div>
                <div className="font-semibold tabular-nums">{pct(atLeast(n))}</div>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Per career (both Inspirations). Rolls treated as independent.
          </p>
        </>
      )}
    </section>
  )
}
