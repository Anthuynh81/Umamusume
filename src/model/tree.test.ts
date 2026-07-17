import { describe, expect, it } from 'vitest'
import {
  ACTIVE_SLOTS, generationOf, generationSlots, grandparentsOf, hasFullLineage,
  lineageOf, parentsOf, slotLabel,
} from './tree'

describe('heap indexing', () => {
  it('computes generations', () => {
    expect(generationOf(0)).toBe(0)
    expect(generationOf(1)).toBe(1)
    expect(generationOf(2)).toBe(1)
    expect(generationOf(3)).toBe(2)
    expect(generationOf(6)).toBe(2)
    expect(generationOf(7)).toBe(3)
    expect(generationOf(14)).toBe(3)
    expect(generationOf(15)).toBe(4)
    expect(generationOf(30)).toBe(4)
  })

  it('finds parents and grandparents', () => {
    expect(parentsOf(0)).toEqual([1, 2])
    expect(grandparentsOf(0)).toEqual([3, 4, 5, 6])
    expect(parentsOf(6)).toEqual([13, 14])
    expect(grandparentsOf(6)).toEqual([27, 28, 29, 30])
  })

  it('trainee lineage is exactly the six active slots', () => {
    expect(lineageOf(0)).toEqual([...ACTIVE_SLOTS])
  })

  it('clips lineage at the tree edge', () => {
    expect(lineageOf(6)).toEqual([13, 14, 27, 28, 29, 30])
    expect(lineageOf(7)).toEqual([15, 16]) // grandparents fall outside 31 slots
    expect(lineageOf(15)).toEqual([]) // generation 4 has no in-tree ancestors
  })

  it('full lineage exists only for generations 0-2', () => {
    for (let i = 0; i <= 6; i++) expect(hasFullLineage(i), `slot ${i}`).toBe(true)
    for (const i of [7, 14, 15, 30]) expect(hasFullLineage(i), `slot ${i}`).toBe(false)
  })

  it('enumerates generations', () => {
    expect(generationSlots(0)).toEqual([0])
    expect(generationSlots(1)).toEqual([1, 2])
    expect(generationSlots(2)).toEqual([3, 4, 5, 6])
    expect(generationSlots(4)).toHaveLength(16)
    expect(generationSlots(4)[0]).toBe(15)
  })

  it('labels slots from the trainee perspective', () => {
    expect(slotLabel(0)).toBe('Trainee')
    expect(slotLabel(1)).toBe('Legacy 1')
    expect(slotLabel(2)).toBe('Legacy 2')
    expect(slotLabel(3)).toBe('Legacy 1 › 1')
    expect(slotLabel(6)).toBe('Legacy 2 › 2')
    expect(slotLabel(30)).toBe('Legacy 2 › 2 › 2 › 2')
  })
})
