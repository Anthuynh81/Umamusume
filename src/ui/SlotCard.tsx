import type { GameData } from '../data/types'
import { stars as starStr } from '../lib/format'
import { slotLabel } from '../model/tree'
import { APTITUDE_LABELS, BLUE_STAT_LABELS } from '../model/types'
import type { SlotStatus, UmaBuild } from '../model/types'
import { useTreeStore } from '../store/tree'
import { Avatar } from './avatar/Avatar'

const STATUS_BADGES: Record<SlotStatus, { label: string; cls: string } | null> = {
  planned: null,
  farmed: { label: 'Farmed', cls: 'bg-emerald-100 text-emerald-700' },
  borrowed: { label: 'Borrowed', cls: 'bg-sky-100 text-sky-700' },
  rental: { label: 'Rental', cls: 'bg-violet-100 text-violet-700' },
}

const DRAG_TYPE = 'text/x-sparkline-slot'

export function SlotCard({
  index,
  build,
  data,
  affinity,
  warning,
}: {
  index: number
  build: UmaBuild | null
  data: GameData
  /** Individual affinity for lineage slots; null hides the badge. */
  affinity: number | null
  warning?: string
}) {
  const select = useTreeStore((s) => s.select)
  const copySlot = useTreeStore((s) => s.copySlot)
  const setSlot = useTreeStore((s) => s.setSlot)
  const clipboard = useTreeStore((s) => s.clipboard)
  const showMemos = useTreeStore((s) => s.settings.showMemos)
  const showAffinity = useTreeStore((s) => s.settings.showAffinity)

  const variant = build ? data.variant(build.variantId) : undefined
  const chara = variant ? data.character(variant.charaId) : undefined
  const status = build ? STATUS_BADGES[build.status] : null

  return (
    <div
      draggable={!!build}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, String(index))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault()
      }}
      onDrop={(e) => {
        const from = Number(e.dataTransfer.getData(DRAG_TYPE))
        if (!Number.isNaN(from) && from !== index) {
          e.preventDefault()
          copySlot(from, index)
        }
      }}
      className={`group relative flex w-36 shrink-0 flex-col rounded-lg border bg-white p-2 text-left shadow-sm transition-colors sm:w-44 sm:p-2.5 ${
        warning ? 'border-red-400' : 'border-slate-200 hover:border-indigo-400'
      }`}
    >
      {build && (
        <button
          type="button"
          aria-label={`Clear ${slotLabel(index)}`}
          title="Clear this slot"
          onClick={(e) => {
            e.stopPropagation()
            setSlot(index, null)
          }}
          className="pointer-events-none absolute right-1 top-4 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-slate-500/70 text-[10px] leading-none text-white opacity-0 transition-opacity hover:bg-red-500 focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
        >
          ×
        </button>
      )}
      <button
        type="button"
        onClick={() => select(index)}
        aria-label={`Edit ${slotLabel(index)}${chara ? `: ${chara.name}` : ' (empty)'}`}
        className="flex min-w-0 items-start gap-2 text-left"
      >
        <Avatar chara={chara} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {slotLabel(index)}
          </span>
          {chara ? (
            <>
              <span className="block truncate text-[13px] font-semibold leading-tight text-slate-800">{chara.name}</span>
              {variant?.title && <span className="block truncate text-[10px] text-slate-400">{variant.title}</span>}
            </>
          ) : (
            <span className="block text-xs text-slate-400">Empty — tap to add</span>
          )}
        </span>
      </button>

      {build && (
        <div className="mt-1 flex flex-wrap gap-1 text-[10px] leading-4">
          {build.blue && (
            <span className="rounded bg-sky-100 px-1 text-sky-800">
              {BLUE_STAT_LABELS[build.blue.stat]} {starStr(build.blue.stars)}
            </span>
          )}
          {build.pink && (
            <span className="rounded bg-pink-100 px-1 text-pink-800">
              {APTITUDE_LABELS[build.pink.aptitude]} {starStr(build.pink.stars)}
            </span>
          )}
          {build.green && (
            <span className="rounded bg-emerald-100 px-1 text-emerald-800">Unique {starStr(build.green.stars)}</span>
          )}
          {build.whites.length > 0 && (
            <span className="rounded bg-slate-100 px-1 text-slate-600">+{build.whites.length} white</span>
          )}
          {status && <span className={`rounded px-1 ${status.cls}`}>{status.label}</span>}
        </div>
      )}

      {showAffinity && affinity !== null && build && (
        <span
          title="Individual affinity (drives this slot's proc rates)"
          className={`absolute -top-2 right-1 rounded-full px-1.5 text-[10px] font-bold shadow-sm ${
            affinity >= 51 ? 'bg-amber-400 text-white' : affinity > 0 ? 'bg-slate-300 text-slate-700' : 'bg-red-200 text-red-700'
          }`}
        >
          {affinity}
        </span>
      )}

      {warning && (
        <span title={warning} className="absolute -top-2 left-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
          !
        </span>
      )}

      {!build && clipboard && (
        <button
          type="button"
          onClick={() => setSlot(index, structuredClone(clipboard))}
          className="mt-1 rounded border border-dashed border-indigo-300 px-1 py-0.5 text-[10px] text-indigo-600 hover:bg-indigo-50"
        >
          Paste copied uma
        </button>
      )}

      {showMemos && build?.memo && (
        <p className="mt-1 truncate text-[10px] italic text-slate-400" title={build.memo}>
          {build.memo}
        </p>
      )}
    </div>
  )
}
