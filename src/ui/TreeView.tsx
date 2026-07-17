import { useMemo, useState } from 'react'
import type { GameData } from '../data/types'
import { affinityBreakdown, lineageErrors } from '../engine/affinity'
import { TIER_SYMBOLS } from '../engine/affinity'
import { downloadBlob, exportTreePng } from '../export/treeImage'
import { generationSlots } from '../model/tree'
import { useTreeStore } from '../store/tree'
import { SlotCard } from './SlotCard'

const GEN_LABELS = ['Trainee', 'Parents', 'Grandparents', 'Gen 3 (planning)', 'Gen 4 (planning)']

export function TreeView({ data }: { data: GameData }) {
  const tree = useTreeStore((s) => s.tree)
  const depth = useTreeStore((s) => s.settings.depth)
  const horizontal = useTreeStore((s) => s.settings.horizontal)
  const raceBonusRule = useTreeStore((s) => s.settings.raceBonusRule)
  const setSetting = useTreeStore((s) => s.setSetting)

  const breakdown = useMemo(
    () => affinityBreakdown(tree, 0, data, { raceBonusRule }),
    [tree, data, raceBonusRule],
  )
  const errors = useMemo(() => lineageErrors(tree, 0, data), [tree, data])
  const warningFor = (i: number) =>
    errors.find((e) => e.slots.includes(i))?.message

  const generations = Array.from({ length: depth + 1 }, (_, g) => generationSlots(g))

  const [exporting, setExporting] = useState(false)
  const exportPng = async (scope: 'active' | 'full') => {
    setExporting(true)
    try {
      const blob = await exportTreePng(tree, data, {
        scope,
        showAffinity: useTreeStore.getState().settings.showAffinity,
        dark: document.documentElement.classList.contains('dark'),
      })
      downloadBlob(blob, `sparkline-${scope}-${new Date().toISOString().slice(0, 10)}.png`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <section aria-label="Legacy tree">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-sm font-bold text-slate-700">
          Tree{' '}
          <span title="Total affinity" className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-700">
            {TIER_SYMBOLS[breakdown.tier]} {breakdown.total}
          </span>
        </h2>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1" role="group" aria-label="Export as image">
            <button
              type="button"
              disabled={exporting}
              onClick={() => void exportPng('active')}
              title="Export the trainee + parents + grandparents as a PNG"
              className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 hover:border-indigo-500 disabled:opacity-40"
            >
              PNG
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void exportPng('full')}
              title="Export the full 31-slot tree as a PNG"
              className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 hover:border-indigo-500 disabled:opacity-40"
            >
              PNG (full)
            </button>
          </span>
          <label className="flex items-center gap-1 text-slate-500">
            Depth
            <select
              value={depth}
              onChange={(e) => setSetting('depth', Number(e.target.value) as 2 | 3 | 4)}
              className="rounded border border-slate-300 px-1 py-0.5"
            >
              <option value={2}>Quick (7 slots)</option>
              <option value={3}>3 generations</option>
              <option value={4}>Full (31 slots)</option>
            </select>
          </label>
          <label className="hidden items-center gap-1 text-slate-500 md:flex">
            <input
              type="checkbox"
              checked={horizontal}
              onChange={(e) => setSetting('horizontal', e.target.checked)}
            />
            Horizontal
          </label>
        </div>
      </div>

      {errors.length > 0 && (
        <div role="alert" className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          {errors.map((e) => (
            <div key={e.slots.join('-')}>{e.message}</div>
          ))}
        </div>
      )}

      <div className={horizontal ? 'flex gap-3 overflow-x-auto pb-2' : 'flex flex-col gap-3'}>
        {generations.map((slots, gen) => (
          <div key={gen} className={horizontal ? 'flex min-w-40 shrink-0 flex-col justify-around gap-2' : ''}>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {GEN_LABELS[gen]}
            </div>
            <div
              className={horizontal ? 'flex flex-col gap-2' : 'grid gap-2 overflow-x-auto pb-1'}
              style={
                horizontal
                  ? undefined
                  : { gridTemplateColumns: `repeat(${slots.length}, minmax(${slots.length > 4 ? '8.5rem' : '0'}, 1fr))` }
              }
            >
              {slots.map((i) => (
                <SlotCard
                  key={i}
                  index={i}
                  build={tree.slots[i] ?? null}
                  data={data}
                  affinity={i >= 1 && i <= 6 ? (breakdown.perSlot[i] ?? null) : null}
                  warning={warningFor(i)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
