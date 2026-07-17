/**
 * Wishlist aggregation: given per-career inheritance chances for flagged
 * sparks, the distribution of how many the trainee actually receives.
 * Sparks are treated as independent (documented assumption — community data
 * has not shown correlated rolls; revisit if that changes).
 */

/**
 * Poisson-binomial distribution over success counts. Returns dist where
 * dist[k] = P(exactly k of the sparks inherited). O(n²) DP — n is tiny.
 */
export function countDistribution(ps: number[]): number[] {
  let dist = [1]
  for (const p of ps) {
    const next = new Array<number>(dist.length + 1).fill(0)
    for (let k = 0; k < dist.length; k++) {
      const cur = dist[k]!
      next[k] = next[k]! + cur * (1 - p)
      next[k + 1] = next[k + 1]! + cur * p
    }
    dist = next
  }
  return dist
}

/** P(at least n of the flagged sparks are inherited in one career). */
export function pAtLeast(ps: number[], n: number): number {
  if (n <= 0) return 1
  const dist = countDistribution(ps)
  let p = 0
  for (let k = n; k < dist.length; k++) p += dist[k]!
  return p
}

/** Expected number of flagged sparks inherited per career. */
export function expectedCount(ps: number[]): number {
  return ps.reduce((a, b) => a + b, 0)
}
