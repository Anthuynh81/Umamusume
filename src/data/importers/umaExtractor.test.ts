import { describe, expect, it } from 'vitest'
import { loadGameData } from '../load'
import { importUmaExtractor } from './umaExtractor'

const data = loadGameData()

/** Realistic record shaped like rockisch/umadump sample data (real ids). */
function record(overrides: Record<string, unknown> = {}) {
  return {
    trained_chara_id: 203,
    card_id: 100101, // Special Week
    factor_id_array: [
      203, //      blue: Stamina ★3
      2201, //     pink: Pace Chaser ★1
      2000103, //  white skill: factor group 20001 ★3
      1000302, //  white race: factor group 10003 ★2
      3000102, //  white scenario: URA Finale ★2
      10010101, // green: card 100101 ★1
    ],
    // Saddle 1 = Triple Crown (100501, 101001, 101501); saddle 10 = Arima Kinen.
    win_saddle_id_array: [1, 10],
    skill_array: [{ skill_id: 200332, level: 1 }],
    rank_score: 12345,
    fans: 116228,
    create_time: '2025-07-05 18:27:57',
    ...overrides,
  }
}

describe('importUmaExtractor', () => {
  it('decodes every factor class into a build', () => {
    const result = importUmaExtractor([record()], data)
    expect(result.umas).toHaveLength(1)
    const { entry, warnings } = result.umas[0]!

    expect(entry.build.variantId).toBe(100101)
    expect(entry.build.blue).toEqual({ stat: 'stamina', stars: 3 })
    expect(entry.build.pink).toEqual({ aptitude: 'pace', stars: 1 })
    expect(entry.build.green).toEqual({ stars: 1 })
    expect(entry.build.whites).toEqual([
      { kind: 'race', refId: 10003, stars: 2 },
      { kind: 'skill', refId: 20001, stars: 3 },
      { kind: 'scenario', refId: 30001, stars: 2 },
    ])
    expect(entry.build.status).toBe('farmed')
    expect(warnings).toEqual([])
  })

  it('maps win saddles to won races (union, graded races only)', () => {
    const { entry } = importUmaExtractor([record()], data).umas[0]!
    expect(entry.build.wonRaces).toEqual([100501, 101001, 101501, 102301])
  })

  it('maps metadata fields', () => {
    const { entry } = importUmaExtractor([record()], data).umas[0]!
    expect(entry.name).toContain('Special Week')
    expect(entry.score).toBe(12345)
    expect(entry.skillIds).toEqual([200332])
    expect(entry.heldSkills).toEqual([{ id: 200332, level: 1 }])
    expect(entry.trainedAt).toBe('2025-07-05T18:27:57')
    expect(entry.owned).toBe(true)
    expect(entry.tags).toContain('umaextractor')
  })

  it('warns on unknown factors without failing the record', () => {
    const result = importUmaExtractor(
      [record({ factor_id_array: [203, 4501, 999, 2000103] })],
      data,
    )
    const { entry, warnings } = result.umas[0]!
    expect(entry.build.blue).toEqual({ stat: 'stamina', stars: 3 })
    expect(entry.build.whites).toHaveLength(1)
    expect(warnings.some((w) => w.includes('unknown pink factor prefix'))).toBe(true)
    expect(warnings.some((w) => w.includes('unrecognized factor id 999'))).toBe(true)
  })

  it('skips unknown card ids with a warning', () => {
    const result = importUmaExtractor([record({ card_id: 999999 })], data)
    expect(result.umas).toHaveLength(0)
    expect(result.skipped).toBe(1)
    expect(result.warnings.some((w) => w.includes('999999'))).toBe(true)
  })

  it('rejects non-array input', () => {
    expect(() => importUmaExtractor({ not: 'an array' }, data)).toThrow(/UmaExtractor/)
  })
})

describe('ancestor import', () => {
  const suzukaVariant = data.variants.find((v) => v.charaId === 1002)!.id

  function withAncestors() {
    return [
      record({
        succession_trained_chara_id_1: 166, // in the export → parent copy skipped
        succession_trained_chara_id_2: 999888, // NOT in the export → imported
        succession_chara_array: [
          { card_id: suzukaVariant, position_id: 10, factor_id_array: [101], owner_viewer_id: 0 },
          { card_id: suzukaVariant, position_id: 20, factor_id_array: [102, 1103], owner_viewer_id: 12345 },
          { card_id: suzukaVariant, position_id: 11, factor_id_array: [301], win_saddle_id_array: [10], owner_viewer_id: 0 },
          { card_id: suzukaVariant, position_id: 12, factor_id_array: [301], win_saddle_id_array: [10], owner_viewer_id: 0 }, // duplicate content
        ],
      }),
      record({ trained_chara_id: 166, card_id: suzukaVariant, factor_id_array: [101] }),
    ]
  }

  it('imports distinct ancestors, skipping exported parents and duplicates', () => {
    const result = importUmaExtractor(withAncestors(), data)
    expect(result.umas).toHaveLength(2)
    // position 10 skipped (trained id 166 exported); 11/12 dedupe to one;
    // position 20 imported (linked id not in export).
    expect(result.ancestors).toHaveLength(2)
    const names = result.ancestors.map((a) => a.entry.name)
    for (const n of names) expect(n).toContain('ancestor')
  })

  it('marks rental ancestors as borrowed and never stores owner ids', () => {
    const result = importUmaExtractor(withAncestors(), data)
    const borrowed = result.ancestors.find((a) => a.entry.build.status === 'borrowed')!
    expect(borrowed.entry.owned).toBe(false)
    expect(borrowed.entry.tags).toContain('borrowed')
    expect(JSON.stringify(borrowed.entry)).not.toContain('12345')

    const own = result.ancestors.find((a) => a.entry.build.status === 'farmed')!
    expect(own.entry.owned).toBe(true)
    expect(own.entry.build.wonRaces).toEqual([102301]) // saddle 10 = Arima Kinen
  })
})
