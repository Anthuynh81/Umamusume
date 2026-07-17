/**
 * Farming-progress rollup over a blueprint's filled slots.
 * "Ready" = the slot's uma exists somewhere (farmed yourself, borrowed, or
 * covered by a friend rental); "planned" still needs work.
 */
import type { SlotStatus, Tree } from './types'

export interface TreeProgress {
  filled: number
  byStatus: Record<SlotStatus, number>
  /** farmed + borrowed + rental. */
  ready: number
}

export function treeProgress(tree: Tree): TreeProgress {
  const byStatus: Record<SlotStatus, number> = { planned: 0, farmed: 0, borrowed: 0, rental: 0 }
  let filled = 0
  for (const slot of tree.slots) {
    if (!slot) continue
    filled++
    byStatus[slot.status]++
  }
  return {
    filled,
    byStatus,
    ready: byStatus.farmed + byStatus.borrowed + byStatus.rental,
  }
}
