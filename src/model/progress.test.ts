import { describe, expect, it } from 'vitest'
import { fixtureTree } from '../engine/fixtures'
import { treeProgress } from './progress'
import { emptyTree } from './types'

describe('treeProgress', () => {
  it('counts an empty tree as zero', () => {
    expect(treeProgress(emptyTree())).toEqual({
      filled: 0,
      byStatus: { planned: 0, farmed: 0, borrowed: 0, rental: 0 },
      ready: 0,
    })
  })

  it('rolls up statuses across filled slots', () => {
    const tree = fixtureTree() // 7 filled, all planned by default
    tree.slots[1]!.status = 'farmed'
    tree.slots[2]!.status = 'borrowed'
    tree.slots[3]!.status = 'rental'
    const p = treeProgress(tree)
    expect(p.filled).toBe(7)
    expect(p.byStatus).toEqual({ planned: 4, farmed: 1, borrowed: 1, rental: 1 })
    expect(p.ready).toBe(3)
  })
})
