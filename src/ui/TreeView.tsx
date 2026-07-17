import { useMemo, useState } from 'react'
import type { GameData } from '../data/types'
import { affinityBreakdown, lineageErrors } from '../engine/affinity'
import { TIER_SYMBOLS } from '../engine/affinity'
import { downloadBlob, exportTreePng } from '../export/treeImage'
import { generationOf } from '../model/tree'
import { treeProgress } from '../model/progress'
import { useTreeStore } from '../store/tree'
import { SlotCard } from './SlotCard'

export function TreeView({ data }: { data: GameData }) {
  const tree = useTreeStore((s) => s.tree)
  const depth = useTreeStore((s) => s.settings.depth)
  const horizontal = useTreeStore((s) => s.settings.horizontal)
  const raceBonusRule = useTreeStore((s) => s.settings.raceBonusRule)
  const setSetting = useTreeStore((s) => s.setSetting)
  const resetTree = useTreeStore((s) => s.resetTree)

  const breakdown = useMemo(
    () => affinityBreakdown(tree, 0, data, { raceBonusRule }),
    [tree, data, raceBonusRule],
  )
  const errors = useMemo(() => lineageErrors(tree, 0, data), [tree, data])
  const warningFor = (i: number) =>
    errors.find((e) => e.slots.includes(i))?.message

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
          {(() => {
            const p = treeProgress(tree)
            if (p.filled === 0) return null
            return (
              <span
                title={`Farming progress — farmed ${p.byStatus.farmed} · borrowed ${p.byStatus.borrowed} · rental ${p.byStatus.rental} · still planned ${p.byStatus.planned} (set per slot in the editor)`}
                className={`ml-1 rounded px-1.5 py-0.5 text-xs font-bold ${
                  p.ready === p.filled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {p.ready}/{p.filled} ready
              </span>
            )
          })()}
        </h2>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              if (confirm('Clear the whole tree? (Saved blueprints are untouched.)')) resetTree()
            }}
            title="Clear every slot and start fresh"
            className="rounded border border-red-200 px-2 py-0.5 text-red-600 hover:bg-red-50"
          >
            Clear
          </button>
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

      <div className={`overflow-x-auto pb-2 ${horizontal ? 'ftree-h' : ''}`}>
        <div className={`flex min-w-max px-1 ${horizontal ? '' : 'justify-center'}`}>
          <TreeNode
            index={0}
            maxGen={depth}
            tree={tree}
            data={data}
            breakdown={breakdown}
            warningFor={warningFor}
          />
        </div>
      </div>
    </section>
  )
}

function TreeNode({
  index,
  maxGen,
  tree,
  data,
  breakdown,
  warningFor,
}: {
  index: number
  maxGen: number
  tree: ReturnType<typeof useTreeStore.getState>['tree']
  data: GameData
  breakdown: ReturnType<typeof affinityBreakdown>
  warningFor: (i: number) => string | undefined
}) {
  const gen = generationOf(index)
  return (
    <div className="ftree-node">
      <SlotCard
        index={index}
        build={tree.slots[index] ?? null}
        data={data}
        affinity={index >= 1 && index <= 6 ? (breakdown.perSlot[index] ?? null) : null}
        warning={warningFor(index)}
      />
      {gen < maxGen && (
        <div className="ftree-kids">
          {[2 * index + 1, 2 * index + 2].map((parent) => (
            <div key={parent} className="ftree-kid">
              <TreeNode
                index={parent}
                maxGen={maxGen}
                tree={tree}
                data={data}
                breakdown={breakdown}
                warningFor={warningFor}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
