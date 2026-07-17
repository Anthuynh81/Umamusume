import { describe, expect, it } from 'vitest'
import { affinityBreakdown } from './affinity'
import { fixtureData, fixtureTree } from './fixtures'
import { combineWithinEvent, inheritanceRates, perCareerProc, perEventProc, procClassOf } from './proc'

describe('procClassOf', () => {
  it('splits whites by kind', () => {
    expect(procClassOf('white', 'skill')).toBe('whiteSkill')
    expect(procClassOf('white', 'scenario')).toBe('whiteScenario')
    expect(procClassOf('white', 'race')).toBe('whiteRace')
    expect(procClassOf('green', null)).toBe('green')
  })
})

describe('perEventProc', () => {
  it('applies base rates at zero affinity', () => {
    expect(perEventProc('whiteSkill', 1, 0)).toBeCloseTo(0.03)
    expect(perEventProc('whiteRace', 3, 0)).toBeCloseTo(0.03) // race whites are 1/2/3
    expect(perEventProc('pink', 3, 0)).toBeCloseTo(0.05)
    expect(perEventProc('green', 2, 0)).toBeCloseTo(0.10)
  })

  it('applies the patent multiplier rate × (1 + affinity/100)', () => {
    expect(perEventProc('whiteSkill', 1, 100)).toBeCloseTo(0.06)
    expect(perEventProc('whiteSkill', 3, 50)).toBeCloseTo(0.135)
  })

  it('caps at 1 (1★ blues are guaranteed from affinity 43)', () => {
    expect(perEventProc('blue', 1, 43)).toBe(1)
    expect(perEventProc('blue', 3, 12)).toBe(1)
  })

  it('halves grandparent rates only under the legacy comparison model', () => {
    expect(perEventProc('whiteSkill', 3, 0, { isGrandparent: true })).toBeCloseTo(0.09)
    expect(
      perEventProc('whiteSkill', 3, 0, { isGrandparent: true, positionModel: 'grandparent-halved' }),
    ).toBeCloseTo(0.045)
    expect(
      perEventProc('whiteSkill', 3, 0, { isGrandparent: false, positionModel: 'grandparent-halved' }),
    ).toBeCloseTo(0.09)
  })
})

describe('probability composition', () => {
  it('combines copies within one event as 1 − Π(1−p)', () => {
    expect(combineWithinEvent([0.5, 0.5])).toBeCloseTo(0.75)
    expect(combineWithinEvent([])).toBe(0)
  })

  it('computes per-career cumulative over 2 inspiration events', () => {
    expect(perCareerProc(0.09)).toBeCloseTo(1 - 0.91 ** 2)
  })

  it('accepts a custom activation count', () => {
    expect(perCareerProc(0.5, 3)).toBeCloseTo(0.875)
  })
})

describe('inheritanceRates over the fixture tree', () => {
  const data = fixtureData()
  const tree = fixtureTree()
  // perSlot (individual): {1:153, 2:108, 3:13, 4:0, 5:8, 6:0}
  const { perSlot } = affinityBreakdown(tree, 0, data)
  const rows = inheritanceRates(tree, data, perSlot)
  const row = (key: string) => rows.find((r) => r.key === key)!

  it('groups white copies across slots', () => {
    const groundwork = row('white:skill:200342')
    expect(groundwork.copies).toEqual([
      { slot: 1, stars: 2 },
      { slot: 2, stars: 1 },
    ])
    // slot1: 0.06×(1+153/100)=0.1518; slot2: 0.03×2.08=0.0624
    expect(groundwork.perEvent).toBeCloseTo(1 - (1 - 0.1518) * (1 - 0.0624))
    expect(groundwork.perCareer).toBeCloseTo(1 - (1 - groundwork.perEvent) ** 2)
  })

  it('keeps different uniques as separate green rows', () => {
    expect(row('green:9201').copies).toEqual([{ slot: 1, stars: 2 }])
    expect(row('green:9201').perEvent).toBeCloseTo(0.10 * 2.53)
    expect(row('green:9102').copies).toEqual([{ slot: 4, stars: 3 }])
  })

  it('self-lineage grandparent procs collapse to base rate (affinity 0)', () => {
    // Slot 4 is the trainee as her own grandparent: green 3★ at affinity 0.
    expect(row('green:9102').perEvent).toBeCloseTo(0.15)
  })

  it('groups pinks by aptitude across three copies', () => {
    const dirt = row('pink:dirt')
    expect(dirt.copies.map((c) => c.slot)).toEqual([1, 2, 4])
    // slot1 3★ ×2.53, slot2 1★ ×2.08, slot4 2★ ×1 (self-lineage zero)
    expect(dirt.perEvent).toBeCloseTo(1 - (1 - 0.1265) * (1 - 0.0208) * (1 - 0.03))
  })

  it('uses the lower race-white class for race sparks', () => {
    const race = row('white:race:1101')
    expect(race.copies).toEqual([{ slot: 6, stars: 3 }])
    expect(race.perEvent).toBeCloseTo(0.03) // 3★ race white at affinity 0
  })

  it('treats blues as event procs (career-start bonus is guaranteed separately)', () => {
    const speed = row('blue:speed')
    expect(speed.perEvent).toBe(1) // 0.9 × 2.0 capped
    expect(speed.perCareer).toBe(1)
  })

  it('sorts by per-career descending', () => {
    const sorted = [...rows].sort((a, b) => b.perCareer - a.perCareer)
    expect(rows.map((r) => r.key)).toEqual(sorted.map((r) => r.key))
    expect(rows[0]!.key).toBe('blue:speed')
  })
})
