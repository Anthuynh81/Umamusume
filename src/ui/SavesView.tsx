import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDate } from '../lib/format'
import {
  deleteTreeSave, downloadJson, exportBackup, importBackup, listTreeSaves, saveTree,
} from '../store/persist'
import type { TreeSave } from '../store/persist'
import { useTreeStore } from '../store/tree'

/** Named tree saves + JSON backup of everything. */
export function SavesView() {
  const [saves, setSaves] = useState<TreeSave[]>([])
  const [name, setName] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const tree = useTreeStore((s) => s.tree)
  const loadTree = useTreeStore((s) => s.loadTree)
  const resetTree = useTreeStore((s) => s.resetTree)

  const refresh = useCallback(() => {
    void listTreeSaves().then(setSaves)
  }, [])
  useEffect(refresh, [refresh])

  return (
    <section aria-label="Saved blueprints" className="rounded-lg border border-slate-200 bg-white p-3">
      <h2 className="text-sm font-bold text-slate-700">Blueprints</h2>

      <form
        className="mt-2 flex gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          const trimmed = name.trim() || `Blueprint ${new Date().toLocaleDateString()}`
          void saveTree(trimmed, tree).then(() => {
            setName('')
            setNote(`Saved "${trimmed}".`)
            refresh()
          })
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this blueprint…"
          aria-label="Blueprint name"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
        />
        <button type="submit" className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500">
          Save
        </button>
      </form>

      <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto">
        {saves.map((s) => (
          <li key={s.id} className="flex items-center gap-2 py-1.5 text-xs">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{s.name}</div>
              <div className="text-[10px] text-slate-400">{formatDate(s.updatedAt)}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                loadTree(s.tree)
                setNote(`Loaded "${s.name}".`)
              }}
              className="rounded border border-slate-300 px-2 py-0.5 text-[11px] hover:border-indigo-500"
            >
              Load
            </button>
            <button
              type="button"
              onClick={() => {
                if (s.id !== undefined) void saveTree(s.name, tree, s.id).then(() => {
                  setNote(`Overwrote "${s.name}".`)
                  refresh()
                })
              }}
              className="rounded border border-slate-300 px-2 py-0.5 text-[11px] hover:border-amber-500"
              title="Overwrite this save with the current tree"
            >
              Overwrite
            </button>
            <button
              type="button"
              aria-label={`Delete ${s.name}`}
              onClick={() => {
                if (s.id !== undefined && confirm(`Delete blueprint "${s.name}"?`)) {
                  void deleteTreeSave(s.id).then(refresh)
                }
              }}
              className="rounded px-1 text-slate-300 hover:text-red-500"
            >
              ✕
            </button>
          </li>
        ))}
        {saves.length === 0 && <li className="py-2 text-xs text-slate-400">No saved blueprints yet.</li>}
      </ul>

      <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={() => void exportBackup().then((b) => downloadJson(`sparkline-backup-${new Date().toISOString().slice(0, 10)}.json`, b))}
          className="rounded border border-slate-300 px-2 py-1 text-[11px] hover:border-indigo-500"
        >
          Export backup (JSON)
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded border border-slate-300 px-2 py-1 text-[11px] hover:border-indigo-500"
        >
          Import backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            void file.text().then((text) => {
              try {
                void importBackup(JSON.parse(text)).then(({ umas, trees }) => {
                  setNote(`Imported ${umas} umas, ${trees} blueprints.`)
                  refresh()
                })
              } catch (err) {
                setNote(err instanceof Error ? err.message : 'Import failed.')
              }
            })
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (confirm('Clear the current tree? (Saved blueprints are untouched.)')) resetTree()
          }}
          className="ml-auto rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
        >
          New tree
        </button>
      </div>
      {note && <p className="mt-1 text-[11px] text-emerald-600">{note}</p>}
    </section>
  )
}
