import { describe, expect, it } from 'vitest'
import { loadGameData } from '../data/load'
import { loadRacePlan } from '../data/racePlan'
import {
  distanceCategory, filterByAptitude, poolSharedAptitudes, sharedRunnableRaces,
  withRaiseCeilings,
} from './racePlanner'

/** Runs over the real race-plan snapshot. */
const plan = loadRacePlan()
const data = loadGameData()

describe('sharedRunnableRaces', () => {
  it('includes mandatory races as guaranteed entries (Special Week solo)', () => {
    const { races } = sharedRunnableRaces([1001], plan)
    const derby = races.find((r) => r.raceId === 101001)! // Tokyo Yushun, turn 34
    expect(derby).toBeDefined()
    expect(derby.mandatoryFor).toEqual([1001])
    const arima = races.find((r) => r.raceId === 102301 && r.turn === 72)!
    expect(arima.mandatoryFor).toEqual([1001])
  })

  it('excludes races before debut and on blocked turns', () => {
    const { races } = sharedRunnableRaces([1001], plan)
    for (const r of races) {
      expect(r.turn).toBeGreaterThan(plan.chars['1001']!.debutTurn)
      const forced = plan.chars['1001']!.mandatory[String(r.turn)]
      if (forced !== undefined) expect(forced).toBe(r.raceId)
    }
  })

  it('a pool intersects the solo sets', () => {
    const solo1 = new Set(sharedRunnableRaces([1001], plan).races.map((r) => `${r.raceId}:${r.turn}`))
    const solo2 = new Set(sharedRunnableRaces([1002], plan).races.map((r) => `${r.raceId}:${r.turn}`))
    const both = sharedRunnableRaces([1001, 1002], plan).races
    expect(both.length).toBeGreaterThan(0)
    for (const r of both) {
      const key = `${r.raceId}:${r.turn}`
      expect(solo1.has(key)).toBe(true)
      expect(solo2.has(key)).toBe(true)
    }
  })

  it('defaults to G1 only and honors the grade filter', () => {
    const g1 = sharedRunnableRaces([1001], plan)
    expect(g1.races.every((r) => r.grade === 100)).toBe(true)
    const all = sharedRunnableRaces([1001], plan, { grades: [100, 200, 300] })
    expect(all.races.length).toBeGreaterThan(g1.races.length)
  })

  it('reports characters without plan data', () => {
    const { races, missingData } = sharedRunnableRaces([1001, 999999], plan)
    expect(missingData).toEqual([999999])
    expect(races.length).toBeGreaterThan(0) // computed over the rest
  })

  it('returns races in calendar order', () => {
    const { races } = sharedRunnableRaces([1001, 1002, 1003], plan)
    for (let i = 1; i < races.length; i++) {
      expect(races[i]!.turn).toBeGreaterThanOrEqual(races[i - 1]!.turn)
    }
  })

  it('defaults to the Global career program (verified against the client)', () => {
    const { races } = sharedRunnableRaces([1001, 1002], plan)
    // JP-only L'Arc trials are excluded…
    expect(races.some((r) => r.raceId === 931201 || r.raceId === 931202)).toBe(false)
    // …and the Global-only new-venue JBC instances are available (grade filter permitting).
    const withG1 = sharedRunnableRaces([1002, 1003], plan, { grades: [100] })
    expect(withG1.races.some((r) => r.raceId === 111101)).toBe(true)
  })

  it('the JP toggle swaps the calendars', () => {
    const jp = sharedRunnableRaces([1001, 1002], plan, { grades: [100, 200, 300], server: 'jp' })
    expect(jp.races.some((r) => r.raceId === 931201)).toBe(true) // Prix Niel
    expect(jp.races.some((r) => r.raceId === 111101)).toBe(false) // new-venue JBC
  })
})

describe('distanceCategory', () => {
  it('uses the game boundaries', () => {
    expect(distanceCategory(1200)).toBe('sprint')
    expect(distanceCategory(1400)).toBe('sprint')
    expect(distanceCategory(1401)).toBe('mile')
    expect(distanceCategory(1800)).toBe('mile')
    expect(distanceCategory(1801)).toBe('medium')
    expect(distanceCategory(2400)).toBe('medium')
    expect(distanceCategory(2401)).toBe('long')
    expect(distanceCategory(3200)).toBe('long')
  })
})

describe('pool aptitudes', () => {
  it('takes the minimum over the pool of each character\'s best card', () => {
    // Special Week: turf A, dirt G on every card — the pool minimum
    // can never exceed her grades.
    const apt = poolSharedAptitudes([1001, 1003], data)
    expect(apt.turf).toBe('A')
    expect(apt.dirt).toBe('G')
  })

  it('filters races by surface and distance category', () => {
    const { races } = sharedRunnableRaces([1001, 1003], plan)
    const apt = poolSharedAptitudes([1001, 1003], data)
    const filtered = filterByAptitude(races, apt, 'B')
    // Dirt G ⇒ every dirt race drops at threshold B.
    expect(races.some((r) => r.terrain === 2)).toBe(true)
    expect(filtered.some((r) => r.terrain === 2)).toBe(false)
    // Turf A ⇒ turf races within runnable distances survive.
    expect(filtered.some((r) => r.raceId === 101901)).toBe(true) // Japan Cup
    expect(filtered.length).toBeLessThan(races.length)
  })

  it('threshold off is a no-op via caller convention (grade G passes everything)', () => {
    const { races } = sharedRunnableRaces([1001, 1003], plan)
    const apt = poolSharedAptitudes([1001, 1003], data)
    expect(filterByAptitude(races, apt, 'G')).toHaveLength(races.length)
  })

  it('raise ceilings add +4 stages capped at A', () => {
    const raised = withRaiseCeilings({
      turf: 'A', dirt: 'G', sprint: 'F', mile: 'E', medium: 'B', long: 'S',
    })
    expect(raised).toEqual({
      turf: 'A', // already at cap
      dirt: 'C', // G +4
      sprint: 'B', // F +4
      mile: 'A', // E +4
      medium: 'A', // B +1 hits the cap
      long: 'S', // above the cap, untouched
    })
  })

  it('raise ceilings unlock fixable races but not hopeless ones', () => {
    const { races } = sharedRunnableRaces([1001, 1003], plan)
    const base = poolSharedAptitudes([1001, 1003], data) // dirt G, sprint F, mile E
    const raised = withRaiseCeilings(base)
    const before = filterByAptitude(races, base, 'B')
    const after = filterByAptitude(races, raised, 'B')
    // Mile E→A and sprint F→B unlock turf mile/sprint G1s…
    expect(after.length).toBeGreaterThan(before.length)
    expect(after.some((r) => r.terrain === 1 && distanceCategory(r.distance) === 'mile')).toBe(true)
    // …but dirt G only reaches C: dirt races stay hidden at ≥B.
    expect(after.some((r) => r.terrain === 2)).toBe(false)
  })
})
