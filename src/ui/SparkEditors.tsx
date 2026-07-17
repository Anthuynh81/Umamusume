import { useMemo, useState } from 'react'
import type { GameData } from '../data/types'
import {
  APTITUDE_KEYS, APTITUDE_LABELS, BLUE_STATS, BLUE_STAT_LABELS,
} from '../model/types'
import type {
  BlueSpark, GreenSpark, PinkSpark, Stars, WhiteKind, WhiteSpark,
} from '../model/types'
import { stars as starStr } from '../lib/format'

export const SPARK_COLORS = {
  blue: 'bg-sky-100 text-sky-800 border-sky-300',
  pink: 'bg-pink-100 text-pink-800 border-pink-300',
  green: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  white: 'bg-slate-100 text-slate-700 border-slate-300',
} as const

function StarSelect({
  value,
  onChange,
  label,
}: {
  value: Stars
  onChange: (s: Stars) => void
  label: string
}) {
  return (
    <span role="radiogroup" aria-label={`${label} stars`} className="inline-flex gap-0.5">
      {([1, 2, 3] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(s)}
          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
            value === s ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
          }`}
        >
          {starStr(s)}
        </button>
      ))}
    </span>
  )
}

export function BlueSparkEditor({
  value,
  onChange,
}: {
  value: BlueSpark | null
  onChange: (b: BlueSpark | null) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700">Blue (stat)</legend>
      <div className="flex flex-wrap items-center gap-1">
        {BLUE_STATS.map((stat) => (
          <button
            key={stat}
            type="button"
            aria-pressed={value?.stat === stat}
            onClick={() => onChange(value?.stat === stat ? null : { stat, stars: value?.stars ?? 3 })}
            className={`rounded-full border px-2 py-0.5 text-xs ${
              value?.stat === stat ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 text-slate-600 hover:border-sky-400'
            }`}
          >
            {BLUE_STAT_LABELS[stat]}
          </button>
        ))}
        {value && <StarSelect label="Blue spark" value={value.stars} onChange={(s) => onChange({ ...value, stars: s })} />}
      </div>
    </fieldset>
  )
}

export function PinkSparkEditor({
  value,
  onChange,
}: {
  value: PinkSpark | null
  onChange: (p: PinkSpark | null) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-pink-700">Pink (aptitude)</legend>
      <div className="flex flex-wrap items-center gap-1">
        {APTITUDE_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value?.aptitude === k}
            onClick={() => onChange(value?.aptitude === k ? null : { aptitude: k, stars: value?.stars ?? 3 })}
            className={`rounded-full border px-2 py-0.5 text-xs ${
              value?.aptitude === k ? 'border-pink-500 bg-pink-500 text-white' : 'border-slate-300 text-slate-600 hover:border-pink-400'
            }`}
          >
            {APTITUDE_LABELS[k]}
          </button>
        ))}
        {value && <StarSelect label="Pink spark" value={value.stars} onChange={(s) => onChange({ ...value, stars: s })} />}
      </div>
    </fieldset>
  )
}

export function GreenSparkEditor({
  value,
  onChange,
  uniqueName,
}: {
  value: GreenSpark | null
  onChange: (g: GreenSpark | null) => void
  uniqueName: string | null
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Green (unique{uniqueName ? `: ${uniqueName}` : ''})
      </legend>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={value !== null}
          onClick={() => onChange(value ? null : { stars: 3 })}
          className={`rounded-full border px-2 py-0.5 text-xs ${
            value ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-slate-600 hover:border-emerald-400'
          }`}
        >
          {value ? 'Has green spark' : 'No green spark'}
        </button>
        {value && <StarSelect label="Green spark" value={value.stars} onChange={(s) => onChange({ stars: s })} />}
      </div>
    </fieldset>
  )
}

const KIND_LABELS: Record<WhiteKind, string> = { skill: 'Skill', race: 'Race', scenario: 'Scenario' }

export function WhiteSparksEditor({
  data,
  value,
  onChange,
}: {
  data: GameData
  value: WhiteSpark[]
  onChange: (whites: WhiteSpark[]) => void
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<WhiteKind>('skill')

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    const chosen = new Set(value.map((w) => `${w.kind}:${w.refId}`))
    return data.sparks
      .filter((s) => s.kind === kind && s.global && !chosen.has(`${s.kind}:${s.id}`))
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .slice(0, 30)
  }, [data, query, kind, value])

  const nameOf = (w: WhiteSpark) => data.spark(w.refId)?.name ?? `#${w.refId}`

  return (
    <fieldset>
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
        White sparks (skills / races / scenarios)
      </legend>

      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1">
          {value.map((w, i) => (
            <li key={`${w.kind}:${w.refId}`} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${SPARK_COLORS.white}`}>
              <span>{nameOf(w)}</span>
              <StarSelect
                label={nameOf(w)}
                value={w.stars}
                onChange={(s) => onChange(value.map((x, j) => (j === i ? { ...x, stars: s } : x)))}
              />
              <button
                type="button"
                aria-label={`Remove ${nameOf(w)}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="text-slate-400 hover:text-red-500"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-1">
        {(Object.keys(KIND_LABELS) as WhiteKind[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`rounded px-2 py-0.5 text-xs ${kind === k ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-600'}`}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Add ${KIND_LABELS[kind].toLowerCase()} spark…`}
          aria-label="Search white sparks"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
        />
      </div>
      {query && (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded border border-slate-200 bg-white text-xs shadow-sm">
          {candidates.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onChange([...value, { kind: s.kind, refId: s.id, stars: 3 }])
                  setQuery('')
                }}
                className="block w-full px-2 py-1 text-left hover:bg-indigo-50"
              >
                {s.name}
              </button>
            </li>
          ))}
          {candidates.length === 0 && <li className="px-2 py-1 text-slate-400">No matches.</li>}
        </ul>
      )}
    </fieldset>
  )
}
