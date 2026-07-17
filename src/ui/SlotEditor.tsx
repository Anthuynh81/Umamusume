import { useEffect, useState } from 'react'
import type { GameData } from '../data/types'
import { slotLabel } from '../model/tree'
import { SLOT_STATUSES, emptyBuild } from '../model/types'
import type { SlotStatus } from '../model/types'
import { saveUmaToLibrary } from '../store/persist'
import { useTreeStore } from '../store/tree'
import { Avatar } from './avatar/Avatar'
import { CharacterPicker } from './CharacterPicker'
import { RacePicker } from './RacePicker'
import { BlueSparkEditor, GreenSparkEditor, PinkSparkEditor, WhiteSparksEditor } from './SparkEditors'

const STATUS_LABELS: Record<SlotStatus, string> = {
  planned: 'Planned', farmed: 'Farmed', borrowed: 'Borrowed', rental: 'Rental (friend)',
}

/** Drawer editor for the selected slot. */
export function SlotEditor({ data }: { data: GameData }) {
  const slotIndex = useTreeStore((s) => s.selectedSlot)
  const tree = useTreeStore((s) => s.tree)
  const select = useTreeStore((s) => s.select)
  const setSlot = useTreeStore((s) => s.setSlot)
  const updateSlot = useTreeStore((s) => s.updateSlot)
  const setClipboard = useTreeStore((s) => s.setClipboard)

  const build = slotIndex !== null ? tree.slots[slotIndex] : null
  const [picking, setPicking] = useState(false)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  useEffect(() => {
    setPicking(slotIndex !== null && !build)
    setSavedNote(null)
  }, [slotIndex, build])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [select])

  if (slotIndex === null) return null
  const variant = build ? data.variant(build.variantId) : undefined
  const chara = variant ? data.character(variant.charaId) : undefined

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => select(null)}>
      <aside
        role="dialog"
        aria-label={`Edit ${slotLabel(slotIndex)}`}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col gap-3 overflow-y-auto bg-white p-4 shadow-xl"
      >
        <header className="flex items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{slotLabel(slotIndex)}</h2>
          <button
            type="button"
            onClick={() => select(null)}
            aria-label="Close editor"
            className="ml-auto rounded px-2 py-1 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </header>

        {picking || !build ? (
          <div className="min-h-0 flex-1">
            <CharacterPicker
              data={data}
              onPick={(v) => {
                if (build && variant?.charaId === v.charaId) {
                  updateSlot(slotIndex, { variantId: v.id })
                } else {
                  setSlot(slotIndex, { ...emptyBuild(v.id), ...(build ? { memo: build.memo, status: build.status } : {}) })
                }
                setPicking(false)
              }}
            />
            {build && (
              <button type="button" onClick={() => setPicking(false)} className="mt-2 text-xs text-indigo-600 hover:underline">
                Keep {chara?.name}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar chara={chara} size={48} />
              <div>
                <div className="font-semibold">{chara?.name}</div>
                <div className="text-xs text-slate-500">{variant?.title || 'Original'}</div>
              </div>
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="ml-auto rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-indigo-500"
              >
                Change
              </button>
            </div>

            <BlueSparkEditor value={build.blue} onChange={(blue) => updateSlot(slotIndex, { blue })} />
            <PinkSparkEditor value={build.pink} onChange={(pink) => updateSlot(slotIndex, { pink })} />
            <GreenSparkEditor
              value={build.green}
              onChange={(green) => updateSlot(slotIndex, { green })}
              uniqueName={variant?.uniqueSkillId != null ? (data.uniqueSkill(variant.uniqueSkillId)?.name ?? null) : null}
            />
            <WhiteSparksEditor data={data} value={build.whites} onChange={(whites) => updateSlot(slotIndex, { whites })} />
            <RacePicker data={data} value={build.wonRaces} onChange={(wonRaces) => updateSlot(slotIndex, { wonRaces })} />

            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Memo
              <textarea
                value={build.memo}
                onChange={(e) => updateSlot(slotIndex, { memo: e.target.value })}
                rows={2}
                maxLength={500}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm font-normal focus:border-indigo-500 focus:outline-none"
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Farming status
              <select
                value={build.status}
                onChange={(e) => updateSlot(slotIndex, { status: e.target.value as SlotStatus })}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm font-normal"
              >
                {SLOT_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </label>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setClipboard(build)
                  setSavedNote('Copied — click an empty slot to paste.')
                }}
                className="rounded border border-slate-300 px-3 py-1 text-xs hover:border-indigo-500"
              >
                Copy uma
              </button>
              <button
                type="button"
                onClick={async () => {
                  await saveUmaToLibrary({
                    name: `${chara?.name ?? 'Uma'}${variant?.title ? ` (${variant.title})` : ''}`,
                    build: structuredClone(build),
                    score: null, rank: null, skillIds: [], trainedAt: null,
                    tags: [], owned: build.status === 'farmed', loopIds: [],
                  })
                  setSavedNote('Saved to library.')
                }}
                className="rounded border border-slate-300 px-3 py-1 text-xs hover:border-indigo-500"
              >
                Save to library
              </button>
              <button
                type="button"
                onClick={() => {
                  setSlot(slotIndex, null)
                  select(null)
                }}
                className="ml-auto rounded border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Clear slot
              </button>
            </div>
            {savedNote && <p className="text-xs text-emerald-600">{savedNote}</p>}
          </>
        )}
      </aside>
    </div>
  )
}
