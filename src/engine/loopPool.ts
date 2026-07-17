/**
 * Loop-pool recommender: find sets of mutually compatible characters for a
 * rotating legacy loop (each career's trainee becomes the next career's
 * parent, so EVERY pair in the pool eventually breeds — the metric is the
 * sum of base affinity over all pairs).
 *
 * Exhaustive search over the roster completing the user's seed characters.
 * C(61,4) ≈ 520k pools scores instantly off a precomputed pair matrix;
 * size-5 pools (~5.9M) take a moment but stay interactive.
 */
import type { GameData } from '../data/types'

export interface LoopPoolResult {
  /** Base-character ids, seeds first. */
  members: number[]
  /** Σ pairwise base affinity over all pairs in the pool. */
  total: number
  /** The weakest pair — a loop is only as strong as its worst rotation. */
  minPair: number
}

export interface LoopPoolOptions {
  /** Pool size including seeds (default 4 — the standard rotation). */
  size?: number
  /** Top N pools to return (default 5). */
  limit?: number
  /** Candidate chara ids (default: the Global roster). */
  candidates?: number[]
}

export function recommendLoopPools(
  seeds: number[],
  data: GameData,
  opts: LoopPoolOptions = {},
): LoopPoolResult[] {
  const size = opts.size ?? 4
  const limit = opts.limit ?? 5
  const uniqueSeeds = [...new Set(seeds)]
  if (uniqueSeeds.length > size) return []

  const candidatePool = (opts.candidates ?? data.characters.filter((c) => c.global).map((c) => c.id))
    .filter((id) => !uniqueSeeds.includes(id))
  const all = [...uniqueSeeds, ...candidatePool]

  // Symmetric pair matrix over local indices.
  const n = all.length
  const P: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = all[i] === all[j] ? 0 : data.relations.pair(all[i]!, all[j]!)
      P[i]![j] = v
      P[j]![i] = v
    }
  }

  const seedCount = uniqueSeeds.length
  let seedBase = 0
  for (let i = 0; i < seedCount; i++) {
    for (let j = i + 1; j < seedCount; j++) seedBase += P[i]![j]!
  }

  const need = size - seedCount
  const top: { members: number[]; total: number }[] = []
  const consider = (members: number[], total: number) => {
    if (top.length === limit && total <= top[top.length - 1]!.total) return
    top.push({ members, total })
    top.sort((a, b) => b.total - a.total)
    if (top.length > limit) top.pop()
  }

  if (need === 0) {
    consider([...uniqueSeeds], seedBase)
  } else {
    const chosen: number[] = []
    const walk = (startIdx: number, score: number) => {
      if (chosen.length === need) {
        consider([...uniqueSeeds, ...chosen.map((i) => all[i]!)], score)
        return
      }
      for (let i = startIdx; i <= n - (need - chosen.length); i++) {
        let added = score
        for (let s = 0; s < seedCount; s++) added += P[s]![i]!
        for (const c of chosen) added += P[c]![i]!
        chosen.push(i)
        walk(i + 1, added)
        chosen.pop()
      }
    }
    walk(seedCount, seedBase)
  }

  const idxOf = new Map(all.map((id, i) => [id, i]))
  return top.map(({ members, total }) => {
    let minPair = Infinity
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        minPair = Math.min(minPair, P[idxOf.get(members[i]!)!]![idxOf.get(members[j]!)!]!)
      }
    }
    return { members, total, minPair: Number.isFinite(minPair) ? minPair : 0 }
  })
}
