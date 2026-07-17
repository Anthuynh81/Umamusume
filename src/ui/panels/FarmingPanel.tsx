import { useEffect, useMemo, useState } from 'react'
import type { CopyBonusStrategy, WhiteTier } from '../../data/config/rates'
import type { GameData } from '../../data/types'
import {
  expectedRuns, farmChancePerDraw, withReroll,
} from '../../engine/generation'
import type { WhiteTargetSpec } from '../../engine/generation'
import { pct } from '../../lib/format'
import { bestHeldTier, heldSkillsOf } from '../../lib/skills'
import type { LibraryUma } from '../../model/library'
import { listLibrary } from '../../store/persist'
import { APTITUDE_KEYS, APTITUDE_LABELS, BLUE_STATS, BLUE_STAT_LABELS } from '../../model/types'
import type { Stars } from '../../model/types'

interface WhiteRow extends WhiteTargetSpec {
  sparkId: number | null
  query: string
  /** Set by tier-from-library: she holds no version of this skill group. */
  notHeld?: boolean
}

const TIER_LABELS: Record<WhiteTier, string> = {
  normal: 'White skill / race / scenario', circle: '◎ skill held', gold: 'Gold skill held',
}

function StarsSelect({ value, onChange, label }: { value: Stars; onChange: (s: Stars) => void; label: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value) as Stars)}
      aria-label={label}
      className="rounded border border-slate-300 px-1 py-0.5"
    >
      {[1, 2, 3].map((s) => (
        <option key={s} value={s}>{'★'.repeat(s)}+</option>
      ))}
    </select>
  )
}

/**
 * Expected-runs farming calculator: chance one career produces the target
 * parent, and how many careers that means. Generation math — not to be
 * confused with the inheritance panel's proc chances.
 */
export function FarmingPanel({ data }: { data: GameData }) {
  const [blueOn, setBlueOn] = useState(true)
  const [blueStat, setBlueStat] = useState<(typeof BLUE_STATS)[number]>('speed')
  const [blueStars, setBlueStars] = useState<Stars>(2)
  const [blueFinal, setBlueFinal] = useState(1100)

  const [pinkOn, setPinkOn] = useState(true)
  const [pinkApt, setPinkApt] = useState<(typeof APTITUDE_KEYS)[number]>('dirt')
  const [pinkStars, setPinkStars] = useState<Stars>(2)
  const [poolSize, setPoolSize] = useState(2)

  const [rating, setRating] = useState(15000)
  const [strategy] = useState<CopyBonusStrategy>('multiplicative')
  const [reroll, setReroll] = useState(true)
  const [whites, setWhites] = useState<WhiteRow[]>([])
  const [umas, setUmas] = useState<LibraryUma[]>([])
  const [tierFrom, setTierFrom] = useState('')

  useEffect(() => {
    void listLibrary().then(setUmas)
  }, [])

  /** Set each skill target's tier from what the chosen library uma holds. */
  const applyTiersFrom = (umaId: string) => {
    setTierFrom(umaId)
    const uma = umas.find((u) => String(u.id) === umaId)
    if (!uma) return
    const held = heldSkillsOf(uma)
    setWhites((ws) =>
      ws.map((w) => {
        if (w.sparkId === null || data.spark(w.sparkId)?.kind !== 'skill') return w
        const tier = bestHeldTier(held, w.sparkId, data)
        return tier ? { ...w, tier, notHeld: false } : { ...w, tier: 'normal', notHeld: true }
      }),
    )
  }

  const perDraw = useMemo(
    () =>
      farmChancePerDraw({
        blue: blueOn ? { finalStat: blueFinal, minStars: blueStars } : undefined,
        pink: pinkOn ? { poolSize, minStars: pinkStars } : undefined,
        whites: whites.filter((w) => w.sparkId !== null).map((w) => ({ ...w, rating, strategy })),
      }),
    [blueOn, blueFinal, blueStars, pinkOn, poolSize, pinkStars, whites, rating, strategy],
  )
  const perCareer = reroll ? withReroll(perDraw) : perDraw
  const runs = expectedRuns(perCareer)

  const sparkSearch = (query: string) =>
    query.trim()
      ? data.sparks.filter((s) => s.global && s.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
      : []

  return (
    <section aria-label="Farming calculator" className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
      <h2 className="text-sm font-bold text-slate-700">
        Farming calculator <span className="text-[10px] font-normal text-slate-400">careers to produce a parent</span>
      </h2>

      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={blueOn} onChange={(e) => setBlueOn(e.target.checked)} />
            Blue
          </label>
          {blueOn && (
            <>
              <select value={blueStat} onChange={(e) => setBlueStat(e.target.value as typeof blueStat)} aria-label="Blue stat" className="rounded border border-slate-300 px-1 py-0.5">
                {BLUE_STATS.map((s) => (
                  <option key={s} value={s}>{BLUE_STAT_LABELS[s]}</option>
                ))}
              </select>
              <StarsSelect value={blueStars} onChange={setBlueStars} label="Blue minimum stars" />
              <label className="flex items-center gap-1 text-slate-500">
                final stat
                <input
                  type="number" min={0} max={2000} step={50} value={blueFinal}
                  onChange={(e) => setBlueFinal(Number(e.target.value))}
                  aria-label="Final stat value"
                  className="w-16 rounded border border-slate-300 px-1 py-0.5"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={pinkOn} onChange={(e) => setPinkOn(e.target.checked)} />
            Pink
          </label>
          {pinkOn && (
            <>
              <select value={pinkApt} onChange={(e) => setPinkApt(e.target.value as typeof pinkApt)} aria-label="Pink aptitude" className="rounded border border-slate-300 px-1 py-0.5">
                {APTITUDE_KEYS.map((k) => (
                  <option key={k} value={k}>{APTITUDE_LABELS[k]}</option>
                ))}
              </select>
              <StarsSelect value={pinkStars} onChange={setPinkStars} label="Pink minimum stars" />
              <label className="flex items-center gap-1 text-slate-500" title="How many aptitudes will be A/S at career end (she rolls one uniformly)">
                A/S pool
                <input
                  type="number" min={1} max={10} value={poolSize}
                  onChange={(e) => setPoolSize(Math.max(1, Number(e.target.value)))}
                  aria-label="A/S pool size"
                  className="w-12 rounded border border-slate-300 px-1 py-0.5"
                />
              </label>
            </>
          )}
        </div>

        {whites.map((w, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1">
            <span className="text-slate-500">White</span>
            {w.sparkId === null ? (
              <span className="relative">
                <input
                  value={w.query}
                  onChange={(e) => setWhites(whites.map((x, j) => (j === i ? { ...x, query: e.target.value } : x)))}
                  placeholder="Search spark…"
                  aria-label="Search white spark target"
                  className="w-40 rounded border border-slate-300 px-1 py-0.5"
                />
                {w.query && (
                  <span className="absolute left-0 top-6 z-10 block w-56 rounded border border-slate-200 bg-white shadow">
                    {sparkSearch(w.query).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setWhites(whites.map((x, j) => (j === i ? { ...x, sparkId: s.id, query: s.name } : x)))}
                        className="block w-full px-2 py-0.5 text-left hover:bg-indigo-50"
                      >
                        {s.name}
                      </button>
                    ))}
                  </span>
                )}
              </span>
            ) : (
              <span className="rounded bg-slate-100 px-1.5 py-0.5">{w.query}</span>
            )}
            <select
              value={w.tier}
              onChange={(e) => setWhites(whites.map((x, j) => (j === i ? { ...x, tier: e.target.value as WhiteTier } : x)))}
              aria-label="Skill tier held"
              className="rounded border border-slate-300 px-1 py-0.5"
            >
              {(Object.keys(TIER_LABELS) as WhiteTier[]).map((t) => (
                <option key={t} value={t}>{TIER_LABELS[t]}</option>
              ))}
            </select>
            {w.notHeld && (
              <span
                className="rounded bg-red-100 px-1 text-[10px] text-red-700"
                title="The selected library uma holds no version of this skill — it cannot generate for her"
              >
                not learned
              </span>
            )}
            <StarsSelect
              value={w.minStars}
              onChange={(s) => setWhites(whites.map((x, j) => (j === i ? { ...x, minStars: s } : x)))}
              label="White minimum stars"
            />
            <label className="flex items-center gap-1 text-slate-500" title="Copies of this spark among the farming uma's own parents+grandparents">
              copies
              <input
                type="number" min={0} max={6} value={w.lineageCopies}
                onChange={(e) => setWhites(whites.map((x, j) => (j === i ? { ...x, lineageCopies: Math.max(0, Number(e.target.value)) } : x)))}
                aria-label="Lineage copies"
                className="w-10 rounded border border-slate-300 px-1 py-0.5"
              />
            </label>
            <button
              type="button"
              onClick={() => setWhites(whites.filter((_, j) => j !== i))}
              aria-label="Remove white target"
              className="text-slate-300 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWhites([...whites, { sparkId: null, query: '', tier: 'normal', lineageCopies: 0, minStars: 2, rating }])}
            className="rounded border border-dashed border-slate-300 px-2 py-0.5 text-slate-500 hover:border-indigo-400"
          >
            + white spark target
          </button>
          {umas.length > 0 && whites.length > 0 && (
            <label className="flex items-center gap-1 text-slate-500" title="Set each skill target's tier (white/◎/gold) from what a saved uma actually holds">
              tier from
              <select
                value={tierFrom}
                onChange={(e) => applyTiersFrom(e.target.value)}
                aria-label="Set tiers from library uma"
                className="max-w-40 rounded border border-slate-300 px-1 py-0.5"
              >
                <option value="">—</option>
                {umas.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2">
          <label className="flex items-center gap-1 text-slate-500" title="Final career rating — star odds jump at 17,500 (SS)">
            rating
            <input
              type="number" min={0} max={40000} step={500} value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              aria-label="Final career rating"
              className="w-20 rounded border border-slate-300 px-1 py-0.5"
            />
          </label>
          <label className="flex items-center gap-1 text-slate-500" title="30 TP reroll = a second independent draw per career">
            <input type="checkbox" checked={reroll} onChange={(e) => setReroll(e.target.checked)} />
            with reroll
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-4 border-t border-slate-100 pt-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Per career</div>
            <div className="text-lg font-bold text-indigo-700">{pct(perCareer, 2)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Expected runs</div>
            <div className="text-lg font-bold">{Number.isFinite(runs.mean) ? runs.mean.toFixed(1) : '∞'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">50% by</div>
            <div className="font-semibold">{Number.isFinite(runs.p50) ? runs.p50 : '—'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">90% by</div>
            <div className="font-semibold">{Number.isFinite(runs.p90) ? runs.p90 : '—'}</div>
          </div>
        </div>
        <p className="text-[10px] text-slate-400">
          Perfect parents are 1-in-hundreds events — plan for tiers of acceptable outcomes, not a single target.
          Copy bonus model: ×1.1 per lineage copy (best empirical fit).
        </p>
      </div>
    </section>
  )
}
