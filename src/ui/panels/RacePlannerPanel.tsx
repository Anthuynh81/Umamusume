import { useEffect, useMemo, useState } from 'react'
import { RACE_BONUS_POINTS } from '../../data/config/rates'
import { loadRacePlan } from '../../data/racePlan'
import type { GameData } from '../../data/types'
import {
  distanceCategory, filterByAptitude, poolSharedAptitudes, sharedRunnableRaces,
  withRaiseCeilings,
} from '../../engine/racePlanner'
import type { SharedAptitudes, SharedRace } from '../../engine/racePlanner'
import type { Grade } from '../../model/types'
import { useTreeStore } from '../../store/tree'
import { Avatar } from '../avatar/Avatar'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const GRADE_LABELS: Record<number, string> = { 100: 'G1', 200: 'G2', 300: 'G3' }
const YEAR_LABELS = ['Junior', 'Classic', 'Senior']
const APT_LABELS = { turf: 'Turf', dirt: 'Dirt', sprint: 'Sprint', mile: 'Mile', medium: 'Medium', long: 'Long' } as const

/** In-game race grade colors: G1 blue, G2 rose, G3 emerald. */
const GRADE_CHIP: Record<number, string> = {
  100: 'bg-sky-100 text-sky-800 border-sky-300',
  200: 'bg-rose-100 text-rose-800 border-rose-300',
  300: 'bg-emerald-100 text-emerald-800 border-emerald-300',
}

const plan = loadRacePlan()

function gradeChipClass(g: Grade): string {
  if (g === 'A' || g === 'S') return 'bg-emerald-100 text-emerald-700'
  if (g === 'B') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-400'
}

function cellTooltip(cell: SharedRace[], data: GameData): string {
  return cell
    .map(
      (r) =>
        `${r.name} — ${r.terrain === 2 ? 'Dirt' : 'Turf'} ${r.distance}m (${APT_LABELS[distanceCategory(r.distance)]})${
          r.mandatoryFor.length > 0
            ? ` · career goal for ${r.mandatoryFor.map((id) => data.character(id)?.name ?? id).join(', ')}`
            : ''
        }`,
    )
    .join('\n')
}

/**
 * Career-calendar view in the agenda-planner format: three year columns,
 * each a 4×6 grid of square half-month cells. Empty turns are dimmed;
 * cells with shared races are highlighted in the race's grade color, with
 * an amber ring when it's a mutual career goal. Clicking a filled cell opens
 * a picker to choose which of that turn's races the square shows.
 */
function CalendarGrid({ races, data }: { races: SharedRace[]; data: GameData }) {
  const [picks, setPicks] = useState<Record<number, number>>({})
  const [openTurn, setOpenTurn] = useState<number | null>(null)

  useEffect(() => {
    if (openTurn === null) return
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenTurn(null)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [openTurn])

  const byTurn = new Map<number, SharedRace[]>()
  for (const r of races) byTurn.set(r.turn, [...(byTurn.get(r.turn) ?? []), r])

  return (
    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
      {openTurn !== null && (
        <div className="fixed inset-0 z-10" aria-hidden onClick={() => setOpenTurn(null)} />
      )}
      {[1, 2, 3].map((year) => (
        <div key={year} className="rounded-md border border-slate-200 bg-slate-50">
          <div className="rounded-t-[5px] bg-indigo-600 py-1 text-center text-[11px] font-bold text-white">
            {YEAR_LABELS[year - 1]}
          </div>
          <div className="grid grid-cols-4 gap-[3px] p-[3px]">
            {Array.from({ length: 24 }, (_, i) => {
              const turn = (year - 1) * 24 + i + 1
              const month = Math.floor(i / 2)
              const half = (i % 2) + 1
              const cell = byTurn.get(turn) ?? []
              const shown = cell.find((r) => r.raceId === picks[turn]) ?? cell[0]
              const isGoal = cell.some((r) => r.mandatoryFor.length > 0)
              const label = `${MONTHS[month]} ${half === 1 ? '¹' : '²'}`
              return (
                <div key={turn} className="relative">
                  <button
                    type="button"
                    disabled={cell.length === 0}
                    onClick={() => setOpenTurn(openTurn === turn ? null : turn)}
                    title={cell.length > 0 ? cellTooltip(cell, data) : undefined}
                    aria-label={
                      shown
                        ? `${label}: ${shown.name}${cell.length > 1 ? ` and ${cell.length - 1} more — click to pick` : ''}`
                        : `${label}: no shared race`
                    }
                    className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded border-[1.5px] p-0.5 text-center ${
                      shown
                        ? `${GRADE_CHIP[shown.grade]} ${isGoal ? 'ring-1 ring-amber-400' : ''} cursor-pointer hover:brightness-95`
                        : 'cursor-default border-slate-200 bg-white opacity-40'
                    }`}
                  >
                    <span className={`text-[9px] leading-none ${shown ? 'font-semibold opacity-70' : 'text-slate-400'}`}>
                      {label}
                    </span>
                    {shown && (
                      <span
                        className="text-[9px] font-semibold leading-tight"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}
                      >
                        {shown.name}
                      </span>
                    )}
                    {cell.length > 1 && (
                      <span className="rounded bg-white/60 px-1 text-[8px] font-bold leading-none">+{cell.length - 1}</span>
                    )}
                    {isGoal && <span className="text-[8px] font-bold leading-none text-amber-600">goal</span>}
                  </button>

                  {openTurn === turn && cell.length > 0 && (
                    <div
                      role="listbox"
                      aria-label={`Races in ${label}`}
                      className={`absolute z-20 mt-1 w-48 rounded-md border border-slate-200 bg-white p-1 text-left shadow-lg ${
                        i % 4 >= 2 ? 'right-0' : 'left-0'
                      }`}
                    >
                      {cell.map((r) => (
                        <button
                          key={r.raceId}
                          type="button"
                          role="option"
                          aria-selected={r.raceId === (shown?.raceId ?? -1)}
                          onClick={() => {
                            setPicks((p) => ({ ...p, [turn]: r.raceId }))
                            setOpenTurn(null)
                          }}
                          className={`block w-full rounded px-1.5 py-1 text-left hover:bg-indigo-50 ${
                            r.raceId === shown?.raceId ? 'bg-indigo-50' : ''
                          }`}
                        >
                          <span className={`mr-1 rounded border px-1 text-[9px] font-bold ${GRADE_CHIP[r.grade]}`}>
                            {GRADE_LABELS[r.grade]}
                          </span>
                          <span className="text-[11px] font-medium">{r.name}</span>
                          <span className="block text-[9px] text-slate-400">
                            {r.terrain === 2 ? 'Dirt' : 'Turf'} {r.distance}m ({APT_LABELS[distanceCategory(r.distance)]})
                            {r.mandatoryFor.length > 0 &&
                              ` · goal: ${r.mandatoryFor.map((id) => data.character(id)?.name?.split(' ')[0] ?? id).join(', ')}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Race planner: pick a pool of characters and see every graded race ALL of
 * them can run — the calendar for building shared-win affinity bonuses.
 */
export function RacePlannerPanel({ data }: { data: GameData }) {
  const rule = useTreeStore((s) => s.settings.raceBonusRule)
  const pool = useTreeStore((s) => s.racePool)
  const setPool = useTreeStore((s) => s.setRacePool)
  const [query, setQuery] = useState('')
  const [grades, setGrades] = useState<number[]>([100])
  const [minApt, setMinApt] = useState<Grade | 'off'>('B')
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [withRaises, setWithRaises] = useState(false)
  const [overrides, setOverrides] = useState<Partial<SharedAptitudes>>({})
  const [server, setServer] = useState<'global' | 'jp'>('global')

  const results = useMemo(
    () => (pool.length >= 2 ? sharedRunnableRaces(pool, plan, { grades, server }) : null),
    [pool, grades, server],
  )
  const baseApt = useMemo(
    () => (pool.length >= 2 ? poolSharedAptitudes(pool, data) : null),
    [pool, data],
  )
  /** base → optional raise ceilings → manual overrides. */
  const effectiveApt = useMemo(() => {
    if (!baseApt) return null
    const auto = withRaises ? withRaiseCeilings(baseApt) : baseApt
    return { ...auto, ...overrides }
  }, [baseApt, withRaises, overrides])

  const shownRaces = useMemo(() => {
    if (!results) return []
    const filtered = minApt === 'off' || !effectiveApt ? results.races : filterByAptitude(results.races, effectiveApt, minApt)
    // Venue-variant instances of the same race share a name and turn (e.g.
    // the JBC races across four tracks) — a run can win it only once, so
    // collapse them for planning, merging goal info.
    const byKey = new Map<string, SharedRace>()
    for (const r of filtered) {
      const key = `${r.name}:${r.turn}`
      const existing = byKey.get(key)
      if (!existing) byKey.set(key, { ...r, mandatoryFor: [...r.mandatoryFor] })
      else existing.mandatoryFor = [...new Set([...existing.mandatoryFor, ...r.mandatoryFor])]
    }
    return [...byKey.values()]
  }, [results, effectiveApt, minApt])

  /** Click a chip: cycle auto → A → B → C → auto. */
  const cycleOverride = (key: keyof SharedAptitudes) => {
    const cycle: (Grade | undefined)[] = ['A', 'B', 'C', undefined]
    const current = overrides[key]
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length]
    setOverrides((prev) => {
      const out = { ...prev }
      if (next === undefined) delete out[key]
      else out[key] = next
      return out
    })
  }

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return data.characters
      .filter((c) => c.global && !pool.includes(c.id) && c.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [data, query, pool])

  const perWin = RACE_BONUS_POINTS[rule]

  return (
    <section aria-label="Race planner" className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="text-sm font-bold text-slate-700">
        Race planner{' '}
        <span className="text-[10px] font-normal text-slate-400">races the whole pool can run together</span>
      </h2>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {pool.map((id) => (
          <span key={id} className="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-1 pr-2 text-xs">
            <Avatar chara={data.character(id)} size={18} />
            {data.character(id)?.name}
            <button
              type="button"
              aria-label={`Remove ${data.character(id)?.name}`}
              onClick={() => setPool(pool.filter((x) => x !== id))}
              className="text-slate-400 hover:text-red-500"
            >
              ×
            </button>
          </span>
        ))}
        <span className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={pool.length === 0 ? 'Add characters (e.g. a legacy loop pool)…' : 'Add…'}
            aria-label="Add character to pool"
            className="w-44 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
          />
          {candidates.length > 0 && (
            <span className="absolute left-0 top-8 z-10 block w-56 rounded border border-slate-200 bg-white text-xs shadow">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setPool([...pool, c.id])
                    setQuery('')
                  }}
                  className="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-indigo-50"
                >
                  <Avatar chara={c} size={18} /> {c.name}
                </button>
              ))}
            </span>
          )}
        </span>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
          {[100, 200, 300].map((g) => (
            <label key={g} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={grades.includes(g)}
                onChange={(e) =>
                  setGrades(e.target.checked ? [...grades, g] : grades.filter((x) => x !== g))
                }
              />
              {GRADE_LABELS[g]}
            </label>
          ))}
          <span
            className="inline-flex overflow-hidden rounded border border-slate-300"
            role="group"
            aria-label="Server calendar"
            title="Which server's career race program to use"
          >
            <button
              type="button"
              aria-pressed={server === 'global'}
              onClick={() => setServer('global')}
              className={server === 'global' ? 'bg-slate-700 px-2 py-0.5 text-white' : 'px-2 py-0.5 hover:bg-slate-100'}
            >
              Global
            </button>
            <button
              type="button"
              aria-pressed={server === 'jp'}
              onClick={() => setServer('jp')}
              className={server === 'jp' ? 'bg-slate-700 px-2 py-0.5 text-white' : 'px-2 py-0.5 hover:bg-slate-100'}
            >
              JP
            </button>
          </span>
        </span>
      </div>

      {pool.length < 2 ? (
        <p className="mt-3 text-xs text-slate-400">
          Add at least two characters. Wins they share add +{perWin} affinity per win on each eligible link
          ({rule === 'global-legacy' ? 'Global rule: G1–G3 count, crown sets +1' : 'JP rule: G1 only'}).
        </p>
      ) : results && (
        <>
          {results.missingData.length > 0 && (
            <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              No career data for {results.missingData.map((id) => data.character(id)?.name ?? id).join(', ')} —
              they are ignored in the results.
            </p>
          )}

          {baseApt && effectiveApt && (
            <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
              <span className="text-slate-400" title="Each character's best grade across her cards, minimum over the pool. Click a chip to override the grade you plan to reach.">
                Pool aptitudes:
              </span>
              {(Object.keys(APT_LABELS) as (keyof typeof APT_LABELS)[]).map((k) => {
                const changed = effectiveApt[k] !== baseApt[k]
                const manual = overrides[k] !== undefined
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => cycleOverride(k)}
                    title={
                      manual
                        ? `Manual override (base ${baseApt[k]}) — click to cycle A/B/C/auto`
                        : `Base ${baseApt[k]}${withRaises ? `, raise ceiling ${effectiveApt[k]}` : ''} — click to override`
                    }
                    aria-label={`${APT_LABELS[k]} aptitude ${effectiveApt[k]}${manual ? ' (manual override)' : ''}`}
                    className={`rounded px-1.5 py-0.5 font-semibold ${gradeChipClass(effectiveApt[k])} ${
                      manual ? 'ring-1 ring-indigo-400' : ''
                    }`}
                  >
                    {APT_LABELS[k]} {changed ? `${baseApt[k]}→${effectiveApt[k]}` : effectiveApt[k]}
                  </button>
                )
              })}
              <label
                className="ml-2 flex items-center gap-1 text-slate-500"
                title="Count aptitudes at their inheritance ceiling: pink sparks raise up to +4 stages, capped at A (base G tops out at C)"
              >
                <input type="checkbox" checked={withRaises} onChange={(e) => setWithRaises(e.target.checked)} />
                with pink raises
              </label>
              <label className="ml-auto flex items-center gap-1 text-slate-500">
                Filter ≥
                <select
                  value={minApt}
                  onChange={(e) => setMinApt(e.target.value as Grade | 'off')}
                  aria-label="Minimum shared aptitude"
                  className="rounded border border-slate-300 px-1 py-0.5"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="off">off</option>
                </select>
              </label>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <p>
              <strong>{shownRaces.length}</strong> shared races
              {minApt !== 'off' && results.races.length !== shownRaces.length && (
                <span className="text-slate-400"> ({results.races.length - shownRaces.length} hidden by aptitude)</span>
              )}{' '}
              · winning all = <strong>+{shownRaces.length * perWin}</strong> affinity per eligible link
            </p>
            <span className="ml-auto inline-flex overflow-hidden rounded border border-slate-300 text-[11px]" role="group" aria-label="Result view">
              <button
                type="button"
                aria-pressed={view === 'calendar'}
                onClick={() => setView('calendar')}
                className={view === 'calendar' ? 'bg-slate-700 px-2 py-0.5 text-white' : 'px-2 py-0.5 text-slate-500 hover:bg-slate-100'}
              >
                Calendar
              </button>
              <button
                type="button"
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
                className={view === 'list' ? 'bg-slate-700 px-2 py-0.5 text-white' : 'px-2 py-0.5 text-slate-500 hover:bg-slate-100'}
              >
                List
              </button>
            </span>
          </div>

          {view === 'calendar' ? (
            <CalendarGrid races={shownRaces} data={data} />
          ) : (
            <div className="mt-1 max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="py-1 font-semibold">Race</th>
                    <th className="font-semibold">Grade</th>
                    <th className="font-semibold">Course</th>
                    <th className="font-semibold">When</th>
                    <th className="font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {shownRaces.map((r) => (
                    <tr key={`${r.raceId}:${r.turn}`} className="border-t border-slate-100">
                      <td className="py-1 pr-2">{r.name}</td>
                      <td className="text-slate-500">{GRADE_LABELS[r.grade]}</td>
                      <td className="whitespace-nowrap text-slate-500">
                        {r.terrain === 2 ? 'Dirt' : 'Turf'} {r.distance}m
                        <span className="ml-1 text-slate-400">
                          ({APT_LABELS[distanceCategory(r.distance)]})
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-slate-500">
                        {YEAR_LABELS[r.year - 1]} · {MONTHS[r.month - 1]} {r.half === 1 ? '1st' : '2nd'} half
                      </td>
                      <td>
                        {r.mandatoryFor.length > 0 && (
                          <span
                            className="rounded bg-emerald-100 px-1 text-[10px] text-emerald-700"
                            title="A career objective forces this race for these characters — a guaranteed shared entry"
                          >
                            goal: {r.mandatoryFor.map((id) => data.character(id)?.name?.split(' ')[0] ?? id).join(', ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-1 text-[10px] text-slate-400">
            Based on the URA career program (newer scenarios can shift dates slightly). "With pink raises" counts
            aptitudes at their inheritance ceiling (+4 stages, cap A — reaching it needs up to 10★ of that pink);
            click a chip to set your own target instead. Fan requirements are ignored. Loops still want a shared
            running style — that isn't race-gated, so it's not filtered here.
          </p>
        </>
      )}
    </section>
  )
}
