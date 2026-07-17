import { describe, expect, it } from 'vitest'
import { affinityBreakdown, affinityTier, lineageErrors, pairAffinity, raceBonus } from './affinity'
import { fixtureData, fixtureTree } from './fixtures'

const data = fixtureData()

describe('affinityTier (succession_relation_rank thresholds)', () => {
  it('applies △ 0-50 / ○ 51-150 / ◎ 151+', () => {
    expect(affinityTier(151)).toBe('excellent')
    expect(affinityTier(150)).toBe('good')
    expect(affinityTier(51)).toBe('good')
    expect(affinityTier(50)).toBe('poor')
  })
})

describe('pairAffinity', () => {
  it('reads the relation backend', () => {
    expect(pairAffinity(data, 1, 2)).toBe(100)
  })

  it('is zero for the same base character', () => {
    expect(pairAffinity(data, 3, 3)).toBe(0)
  })
})

describe('raceBonus', () => {
  it('counts the won-race intersection under global-legacy (+1 each)', () => {
    expect(raceBonus(fixtureTree(), 1, 3, data)).toEqual({ sharedWins: 1, crownSets: 0, points: 1 })
    expect(raceBonus(fixtureTree(), 1, 2, data).points).toBe(0)
  })

  it('applies +3 per shared G1 under jp-modern', () => {
    expect(raceBonus(fixtureTree(), 1, 3, data, 'jp-modern').points).toBe(3)
  })

  it('filters non-G1 wins under jp-modern but counts them under legacy', () => {
    const tree = fixtureTree()
    tree.slots[1]!.wonRaces.push(2201) // shared G2
    tree.slots[3]!.wonRaces.push(2201)
    expect(raceBonus(tree, 1, 3, data, 'global-legacy').points).toBe(2)
    expect(raceBonus(tree, 1, 3, data, 'jp-modern').points).toBe(3) // G1 only
  })

  it('adds manual extra wins at the rule value', () => {
    const tree = fixtureTree()
    tree.extraWins['1-2'] = 2
    expect(raceBonus(tree, 1, 2, data, 'global-legacy').points).toBe(2)
    expect(raceBonus(tree, 1, 2, data, 'jp-modern').points).toBe(6)
  })
})

describe('affinityBreakdown (3 pairs + 4 trios, verified formula)', () => {
  it('scores the fixture tree', () => {
    const b = affinityBreakdown(fixtureTree(), 0, data)
    const link = (a: number, bIdx: number) => b.links.find((l) => l.a === a && l.b === bIdx)!

    expect(link(0, 1)).toMatchObject({ kind: 'trainee-parent', pairPoints: 100, winBonus: 0, total: 100 })
    expect(link(0, 2).total).toBe(60)
    expect(link(1, 2)).toMatchObject({ kind: 'parent-parent', pairPoints: 40, winBonus: 0, total: 40 })
    // Grandparent links are trio-only + win bonus: trio(1,2,4)=12, 1 shared G1 (+1).
    expect(link(1, 3)).toMatchObject({ pairPoints: 0, trioPoints: 12, sharedWins: 1, winBonus: 1, total: 13 })
    // Trainee (chara 1) as own grandparent via alt outfit: whole trio zeroed — legal but worthless.
    expect(link(1, 4)).toMatchObject({ selfLink: true, trioPoints: 0, winBonus: 0, total: 0 })
    expect(link(2, 5)).toMatchObject({ trioPoints: 8, total: 8 })
    expect(link(2, 6)).toMatchObject({ trioPoints: 0, total: 0 }) // no 1:3:4 trio group

    expect(b.total).toBe(221)
    expect(b.tier).toBe('excellent')
  })

  it('computes per-slot individual affinity (hakuraku model, default)', () => {
    const b = affinityBreakdown(fixtureTree(), 0, data)
    // Parent = pair(t,p) + pair(p1,p2)+bonus + own gp links.
    expect(b.perSlot[1]).toBe(100 + 40 + 13 + 0)
    expect(b.perSlot[2]).toBe(60 + 40 + 8 + 0)
    // Grandparent = trio + race bonus to her parent.
    expect(b.perSlot[3]).toBe(13)
    expect(b.perSlot[4]).toBe(0) // self-lineage collapse
    expect(b.perSlot[5]).toBe(8)
    expect(b.perSlot[6]).toBe(0)
  })

  it('supports to-trainee per-slot mode', () => {
    const b = affinityBreakdown(fixtureTree(), 0, data, { slotAffinityMode: 'to-trainee' })
    expect(b.perSlot[3]).toBe(20) // pair(chara1, chara4)
    expect(b.perSlot[4]).toBe(0)
    expect(b.perSlot[5]).toBe(10)
    expect(b.perSlot[6]).toBe(20)
  })

  it('applies the jp-modern rule when asked', () => {
    const b = affinityBreakdown(fixtureTree(), 0, data, { raceBonusRule: 'jp-modern' })
    expect(b.links.find((l) => l.a === 1 && l.b === 3)!.total).toBe(15) // 12 + 3
    expect(b.total).toBe(223)
  })

  it('applies manual extra wins to eligible links', () => {
    const tree = fixtureTree()
    tree.extraWins['1-2'] = 2
    const b = affinityBreakdown(tree, 0, data)
    expect(b.links.find((l) => l.a === 1 && l.b === 2)!.total).toBe(42)
    expect(b.total).toBe(223)
  })

  it('omits links for empty slots', () => {
    const tree = fixtureTree()
    tree.slots[3] = null
    const b = affinityBreakdown(tree, 0, data)
    expect(b.links).toHaveLength(6)
    expect(b.total).toBe(221 - 13)
    expect(b.perSlot[3]).toBeUndefined()
  })

  it('scores a parent subtree career (deep slots)', () => {
    // Slot 1 (chara 2) as root: her parents are slots 3 (chara 4) and 4 (chara 1).
    const b = affinityBreakdown(fixtureTree(), 1, data)
    expect(b.links.find((l) => l.a === 1 && l.b === 3)).toMatchObject({ kind: 'trainee-parent', pairPoints: 25, winBonus: 0 })
    expect(b.links.find((l) => l.a === 1 && l.b === 4)).toMatchObject({ pairPoints: 100 })
    expect(b.links.find((l) => l.a === 3 && l.b === 4)).toMatchObject({ kind: 'parent-parent', pairPoints: 20 })
    expect(b.total).toBe(145)
  })
})

describe('crown epithet bonus', () => {
  it('grants +1 per fully-shared crown triple under global-legacy', () => {
    const tree = fixtureTree()
    const crown = [101601, 101901, 102301] // Autumn Senior Triple
    tree.slots[1]!.wonRaces.push(...crown)
    tree.slots[3]!.wonRaces.push(...crown)
    const bonus = raceBonus(tree, 1, 3, data, 'global-legacy')
    // 1 (Japan Cup fixture id 1101) + 3 crown races shared + 1 epithet
    expect(bonus.sharedWins).toBe(4)
    expect(bonus.crownSets).toBe(1)
    expect(bonus.points).toBe(5)
  })
})

describe('lineageErrors', () => {
  it('accepts the fixture tree (trainee-as-grandparent is legal)', () => {
    expect(lineageErrors(fixtureTree(), 0, data)).toEqual([])
  })

  it('flags a character as her own parent', () => {
    const tree = fixtureTree()
    tree.slots[2] = { ...tree.slots[2]!, variantId: 102 } // chara 1 = trainee
    expect(lineageErrors(tree, 0, data)).toHaveLength(1)
  })

  it('flags a legacy as her own parent (deeper duplicate)', () => {
    const tree = fixtureTree()
    tree.slots[1] = { ...tree.slots[1]!, variantId: 102 } // slot 1 = chara 1
    // Two errors: own-parent of the trainee AND own-parent of slot 4 (chara 1).
    expect(lineageErrors(tree, 0, data)).toHaveLength(2)
  })

  it('flags twin grandparents on one side', () => {
    const tree = fixtureTree()
    tree.slots[4] = { ...tree.slots[4]!, variantId: 401 } // both gps chara 4
    expect(lineageErrors(tree, 0, data)).toHaveLength(1)
  })
})
