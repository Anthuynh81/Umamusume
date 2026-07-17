/**
 * Heap-index arithmetic for the ancestry tree.
 *
 * Naming follows GAME semantics, not heap semantics: `parentsOf(i)` returns
 * the two legacies that raised slot i's uma — which are i's CHILDREN in heap
 * terms (2i+1, 2i+2). The trainee (slot 0) is the tree root.
 */
import { TREE_SLOTS } from './types'

/** Generation of a slot: 0 = trainee, 1 = parents, 2 = grandparents, ... */
export function generationOf(i: number): number {
  return Math.floor(Math.log2(i + 1))
}

/** The two legacy (parent) slots of slot i, whether or not they fit the tree. */
export function parentsOf(i: number): [number, number] {
  return [2 * i + 1, 2 * i + 2]
}

/** The four grandparent slots of slot i. */
export function grandparentsOf(i: number): [number, number, number, number] {
  const [a, b] = parentsOf(i)
  return [...parentsOf(a), ...parentsOf(b)]
}

/** The slot whose lineage slot i belongs to (heap parent), or null for the trainee. */
export function childOf(i: number): number | null {
  return i === 0 ? null : Math.floor((i - 1) / 2)
}

/**
 * The six ancestors whose sparks affect slot i's career: 2 parents + 4
 * grandparents, filtered to slots that exist in the tree. Slots in
 * generations 0-2 have all six; generation-3 slots have only their two
 * parents in-tree; generation-4 slots have none.
 */
export function lineageOf(i: number, treeSlots: number = TREE_SLOTS): number[] {
  return [...parentsOf(i), ...grandparentsOf(i)].filter((s) => s < treeSlots)
}

/** True if all six lineage slots of i exist in the tree (generations 0-2). */
export function hasFullLineage(i: number, treeSlots: number = TREE_SLOTS): boolean {
  const gp = grandparentsOf(i)
  return (gp[3] ?? Infinity) < treeSlots
}

/** Slot indices of a whole generation (gen 0 → [0], gen 1 → [1,2], ...). */
export function generationSlots(gen: number): number[] {
  const start = 2 ** gen - 1
  return Array.from({ length: 2 ** gen }, (_, k) => start + k)
}

/** Slots that directly affect the trainee on Global: parents + grandparents. */
export const ACTIVE_SLOTS: readonly number[] = [1, 2, 3, 4, 5, 6]

/** Parent slots relative to the trainee. */
export const PARENT_SLOTS: readonly number[] = [1, 2]

/** Grandparent slots relative to the trainee. */
export const GRANDPARENT_SLOTS: readonly number[] = [3, 4, 5, 6]

/** All slot indices, ascending. */
export const ALL_SLOTS: readonly number[] = Array.from({ length: TREE_SLOTS }, (_, i) => i)

/**
 * Human label for a slot from the trainee's perspective, e.g. "Trainee",
 * "Legacy 1", "Legacy 1 › 2", "Legacy 2 › 1 › 1".
 */
export function slotLabel(i: number): string {
  if (i === 0) return 'Trainee'
  const path: number[] = []
  let cur = i
  while (cur !== 0) {
    path.unshift(cur % 2 === 1 ? 1 : 2) // odd index = first legacy of its child
    cur = childOf(cur)!
  }
  return `Legacy ${path.join(' › ')}`
}
