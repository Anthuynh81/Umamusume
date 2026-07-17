/**
 * Relation-table affinity backend, built from the Global server's
 * succession_relation / succession_relation_member tables (via GameTora's
 * data pipeline — see scripts/fetch-data.mjs and docs/research/
 * data-pipeline-plan.md).
 *
 * pair(A,B)   = Σ relation_point over relation groups containing both.
 * trio(A,B,C) = Σ relation_point over relation groups containing all three.
 */
import type { RelationBackend } from './types'

export interface RelationTables {
  /** relation_type → relation_point. */
  points: Record<string, number>
  /** chara id → relation_types the character belongs to. */
  members: Record<string, number[]>
}

export class RelationTableBackend implements RelationBackend {
  private points: Map<number, number>
  private memberSets: Map<number, Set<number>>
  private pairCache = new Map<number, number>()

  constructor(tables: RelationTables) {
    this.points = new Map(Object.entries(tables.points).map(([t, p]) => [Number(t), p]))
    this.memberSets = new Map(
      Object.entries(tables.members).map(([c, types]) => [Number(c), new Set(types)]),
    )
  }

  private sumShared(base: Set<number> | undefined, others: Set<number>[]): number {
    if (!base) return 0
    let sum = 0
    for (const t of base) {
      if (others.every((s) => s.has(t))) sum += this.points.get(t) ?? 0
    }
    return sum
  }

  pair(a: number, b: number): number {
    const key = a <= b ? a * 100000 + b : b * 100000 + a
    const cached = this.pairCache.get(key)
    if (cached !== undefined) return cached
    const sb = this.memberSets.get(b)
    const value = sb ? this.sumShared(this.memberSets.get(a), [sb]) : 0
    this.pairCache.set(key, value)
    return value
  }

  trio(a: number, b: number, c: number): number {
    const sb = this.memberSets.get(b)
    const sc = this.memberSets.get(c)
    if (!sb || !sc) return 0
    return this.sumShared(this.memberSets.get(a), [sb, sc])
  }

  /** True if the character appears in the relation tables at all. */
  has(charaId: number): boolean {
    return this.memberSets.has(charaId)
  }
}
