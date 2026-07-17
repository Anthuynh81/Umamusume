import { describe, expect, it } from 'vitest'
import {
  applyRaise, effectiveAptitudes, excessStars, pinkPool, raiseStages,
  raisedIntoPool, starsToNextStage,
} from './aptitude'
import { apts, fixtureTree } from './fixtures'

describe('raiseStages thresholds (1/4/7/10)', () => {
  it('matches the brief test cases 0/1/3/4/6/7/9/10', () => {
    expect(raiseStages(0)).toBe(0)
    expect(raiseStages(1)).toBe(1)
    expect(raiseStages(3)).toBe(1)
    expect(raiseStages(4)).toBe(2)
    expect(raiseStages(6)).toBe(2)
    expect(raiseStages(7)).toBe(3)
    expect(raiseStages(9)).toBe(3)
    expect(raiseStages(10)).toBe(4)
  })

  it('caps at +4', () => {
    expect(raiseStages(30)).toBe(4)
  })
})

describe('star accounting', () => {
  it('reports excess stars beyond the last threshold', () => {
    expect(excessStars(0)).toBe(0)
    expect(excessStars(2)).toBe(1)
    expect(excessStars(5)).toBe(1)
    expect(excessStars(10)).toBe(0)
    expect(excessStars(12)).toBe(2)
  })

  it('reports stars to the next stage', () => {
    expect(starsToNextStage(0)).toBe(1)
    expect(starsToNextStage(1)).toBe(3)
    expect(starsToNextStage(5)).toBe(2)
    expect(starsToNextStage(10)).toBeNull()
  })
})

describe('applyRaise', () => {
  it('raises within the scale', () => {
    expect(applyRaise('G', 4)).toBe('C')
    expect(applyRaise('B', 1)).toBe('A')
  })

  it('caps starting raises at A', () => {
    expect(applyRaise('B', 4)).toBe('A')
    expect(applyRaise('A', 3)).toBe('A')
  })

  it('never touches grades at or above the cap', () => {
    expect(applyRaise('S', 2)).toBe('S')
  })
})

describe('effectiveAptitudes over the fixture tree', () => {
  // Fixture pinks: dirt 3★(slot1) + 1★(slot2) + 2★(slot4), turf 2★(slot3),
  // pace 1★(slot5).
  it('computes the trainee report', () => {
    const report = effectiveAptitudes(fixtureTree(), 0, apts())

    expect(report.dirt).toEqual({
      base: 'G', effective: 'E', totalStars: 6, stages: 2, excess: 2, toNext: 1,
    })
    // Base A: stars raise nothing, toNext is null (already at cap).
    expect(report.turf).toMatchObject({ base: 'A', effective: 'A', totalStars: 2, toNext: null })
    // Pace B + 1 star → A (the pace-B trap in action).
    expect(report.pace).toMatchObject({ base: 'B', effective: 'A', stages: 1 })
    expect(report.sprint).toMatchObject({ base: 'F', effective: 'F', totalStars: 0 })
  })

  it('computes a parent report from HER OWN in-tree lineage', () => {
    // Slot 1's lineage = slots 3,4 (+ out-of-tree 7-10): turf 2★, dirt 2★.
    const report = effectiveAptitudes(fixtureTree(), 1, apts({ pace: 'A' }))
    expect(report.dirt).toMatchObject({ base: 'G', effective: 'F', totalStars: 2, stages: 1 })
    expect(report.turf).toMatchObject({ base: 'A', effective: 'A', totalStars: 2 })
    expect(report.pace).toMatchObject({ base: 'A', effective: 'A', totalStars: 0 })
  })
})

describe('pink pool (generation)', () => {
  it('collects A/S aptitudes including raised ones', () => {
    const report = effectiveAptitudes(fixtureTree(), 0, apts())
    const effective = Object.fromEntries(
      Object.entries(report).map(([k, v]) => [k, v.effective]),
    ) as Parameters<typeof pinkPool>[0]
    expect(pinkPool(effective)).toEqual(['turf', 'medium', 'pace', 'late'])
  })

  it('flags aptitudes raised INTO the pool (pace-B trap)', () => {
    expect(raisedIntoPool(effectiveAptitudes(fixtureTree(), 0, apts()))).toEqual(['pace'])
  })

  it('includes S grades in the pool', () => {
    expect(pinkPool({ ...apts(), turf: 'S' })).toContain('turf')
  })
})
