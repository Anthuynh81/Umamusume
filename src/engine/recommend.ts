/**
 * Slot recommendations: rank every base character in the roster as a
 * candidate for an empty slot by the affinity gained. Searches the whole
 * roster (distinct from the phase-2 library optimizer, which arranges the
 * user's saved umas). Base-affinity only — shared-win bonuses depend on race
 * plans the roster can't know; the UI must label that.
 */
import type { GameData } from '../data/types'
import { childOf } from '../model/tree'
import { emptyBuild } from '../model/types'
import type { Tree } from '../model/types'
import { affinityBreakdown } from './affinity'

export interface SlotRecommendation {
  charaId: number
  /** Representative variant (recommendations are per base character). */
  variantId: number
  name: string
  /** Score of the relevant subtree with this character in the slot. */
  total: number
  /** Gain over the current (empty-slot) score. */
  delta: number
}

/**
 * The career whose score a slot contributes to: slots 1-6 feed the trainee;
 * deeper slots exist to build their child ancestor, so they're ranked
 * against that subtree's score.
 */
export function scoreRootForSlot(slotIndex: number): number {
  if (slotIndex <= 6) return 0
  return childOf(slotIndex)!
}

export function recommendForSlot(
  tree: Tree,
  slotIndex: number,
  data: GameData,
  opts: { limit?: number; globalOnly?: boolean } = {},
): SlotRecommendation[] {
  const root = scoreRootForSlot(slotIndex)
  const baseline = affinityBreakdown(tree, root, data).total

  // One representative variant per base character (identity rule: outfits
  // share affinity). Prefer a Global-released variant.
  const repVariant = new Map<number, number>()
  for (const v of data.variants) {
    if (opts.globalOnly !== false && !v.global) continue
    if (!repVariant.has(v.charaId) || v.global) {
      const existing = repVariant.get(v.charaId)
      const existingGlobal = existing !== undefined ? data.variant(existing)?.global : false
      if (existing === undefined || (!existingGlobal && v.global)) repVariant.set(v.charaId, v.id)
    }
  }

  // A character cannot be her own parent: exclude the candidate slot's
  // direct child's character. (Self-as-grandparent is legal; the zeroed
  // link simply ranks such candidates low.)
  const child = childOf(slotIndex)
  const childBuild = child === null ? null : tree.slots[child]
  const forbidden = childBuild ? data.charaIdOf(childBuild.variantId) : null

  const results: SlotRecommendation[] = []
  for (const [charaId, variantId] of repVariant) {
    if (charaId === forbidden) continue
    const name = data.character(charaId)?.name
    if (!name) continue

    const candidate: Tree = { ...tree, slots: [...tree.slots] }
    candidate.slots[slotIndex] = emptyBuild(variantId)
    const total = affinityBreakdown(candidate, root, data).total
    results.push({ charaId, variantId, name, total, delta: total - baseline })
  }

  results.sort((a, b) => b.delta - a.delta || a.name.localeCompare(b.name))
  return opts.limit ? results.slice(0, opts.limit) : results
}
