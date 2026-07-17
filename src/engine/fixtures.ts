/**
 * Deterministic fixture data for engine tests. Not real game data — small,
 * hand-picked values chosen to make expected results easy to verify by hand.
 */
import { GameData } from '../data/types'
import type { RelationBackend } from '../data/types'
import { emptyBuild, emptyTree } from '../model/types'
import type { Aptitudes, Tree, UmaBuild } from '../model/types'

export function apts(overrides: Partial<Aptitudes> = {}): Aptitudes {
  return {
    turf: 'A', dirt: 'G',
    sprint: 'F', mile: 'C', medium: 'A', long: 'B',
    front: 'G', pace: 'B', late: 'A', end: 'E',
    ...overrides,
  }
}

class StubRelations implements RelationBackend {
  private pairs: Record<string, number>
  private trios: Record<string, number>

  constructor(pairs: Record<string, number>, trios: Record<string, number> = {}) {
    this.pairs = pairs
    this.trios = trios
  }

  pair(a: number, b: number): number {
    return this.pairs[[a, b].sort((x, y) => x - y).join(':')] ?? 0
  }

  trio(a: number, b: number, c: number): number {
    return this.trios[[a, b, c].sort((x, y) => x - y).join(':')] ?? 0
  }
}

/**
 * Five characters; chara 1 has two outfits (101 base, 102 alt) to exercise
 * the base-character identity rule. Pair/trio points are arbitrary but fixed.
 */
export function fixtureData(): GameData {
  return new GameData({
    characters: [
      { id: 1, name: 'Alfa Wing', color: '#7ec4ef', image: null, global: true },
      { id: 2, name: 'Bravo Heart', color: null, image: null, global: true },
      { id: 3, name: 'Charlie Dash', color: null, image: null, global: true },
      { id: 4, name: 'Delta Storm', color: null, image: null, global: true },
      { id: 5, name: 'Echo Flash', color: null, image: null, global: false },
    ],
    variants: [
      { id: 101, charaId: 1, title: 'Original', rarity: 3, aptitudes: apts(), uniqueSkillId: 9101, global: true },
      { id: 102, charaId: 1, title: 'Alternate', rarity: 3, aptitudes: apts({ dirt: 'B' }), uniqueSkillId: 9102, global: true },
      { id: 201, charaId: 2, title: 'Original', rarity: 3, aptitudes: apts({ pace: 'A' }), uniqueSkillId: 9201, global: true },
      { id: 301, charaId: 3, title: 'Original', rarity: 2, aptitudes: apts(), uniqueSkillId: 9301, global: true },
      { id: 401, charaId: 4, title: 'Original', rarity: 3, aptitudes: apts(), uniqueSkillId: 9401, global: true },
      { id: 501, charaId: 5, title: 'Original', rarity: 1, aptitudes: apts(), uniqueSkillId: 9501, global: false },
    ],
    sparks: [
      { id: 200342, kind: 'skill', name: 'Groundwork', raceId: null, global: true },
      { id: 200500, kind: 'skill', name: 'Golden Gait', raceId: null, global: true },
      { id: 1101, kind: 'race', name: 'Japan Cup', raceId: 1101, global: true },
      { id: 30001, kind: 'scenario', name: 'URA Finale', raceId: null, global: true },
    ],
    races: [
      { id: 1101, name: 'Japan Cup', grade: 100, global: true },
      { id: 1105, name: 'Arima Kinen', grade: 100, global: true },
      { id: 1301, name: 'February Stakes', grade: 100, global: true },
      { id: 2201, name: 'Nakayama Kinen', grade: 200, global: true },
    ],
    uniqueSkills: [
      { id: 9101, name: 'Unique One' },
      { id: 9102, name: 'Unique One Alt' },
      { id: 9201, name: 'Unique Two' },
      { id: 9301, name: 'Unique Three' },
      { id: 9401, name: 'Unique Four' },
      { id: 9501, name: 'Unique Five' },
    ],
    relations: new StubRelations(
      { '1:2': 100, '1:3': 60, '1:4': 20, '1:5': 10, '2:3': 40, '2:4': 25, '2:5': 30, '3:4': 15, '3:5': 55, '4:5': 5 },
      { '1:2:4': 12, '1:3:5': 8 },
    ),
  })
}

/**
 * Standard test tree:
 *   0 trainee  = chara 1 (variant 101)
 *   1 parent   = chara 2, won Japan Cup + Arima
 *   2 parent   = chara 3
 *   3 gp (of 1)= chara 4, won Japan Cup
 *   4 gp (of 1)= chara 1 via ALT outfit 102 — trainee as her own grandparent
 *   5 gp (of 2)= chara 5
 *   6 gp (of 2)= chara 4
 */
export function fixtureTree(): Tree {
  const tree = emptyTree()
  const put = (slot: number, variantId: number, fill?: (b: UmaBuild) => void) => {
    const b = emptyBuild(variantId)
    fill?.(b)
    tree.slots[slot] = b
  }
  put(0, 101)
  put(1, 201, (b) => {
    b.blue = { stat: 'speed', stars: 3 }
    b.pink = { aptitude: 'dirt', stars: 3 }
    b.green = { stars: 2 }
    b.whites = [{ kind: 'skill', refId: 200342, stars: 2 }]
    b.wonRaces = [1101, 1105]
  })
  put(2, 301, (b) => {
    b.pink = { aptitude: 'dirt', stars: 1 }
    b.whites = [{ kind: 'skill', refId: 200342, stars: 1 }]
  })
  put(3, 401, (b) => {
    b.pink = { aptitude: 'turf', stars: 2 }
    b.wonRaces = [1101]
  })
  put(4, 102, (b) => {
    b.pink = { aptitude: 'dirt', stars: 2 }
    b.green = { stars: 3 }
  })
  put(5, 501, (b) => {
    b.pink = { aptitude: 'pace', stars: 1 }
  })
  put(6, 401, (b) => {
    b.whites = [{ kind: 'race', refId: 1101, stars: 3 }]
  })
  return tree
}
