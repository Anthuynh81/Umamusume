import { useCallback, useEffect, useRef, useState } from 'react'
import { importUmaExtractor } from '../data/importers/umaExtractor'
import type { GameData } from '../data/types'
import { stars as starStr, formatDate } from '../lib/format'
import type { LibraryUma } from '../model/library'
import { APTITUDE_LABELS, BLUE_STAT_LABELS } from '../model/types'
import { deleteLibraryUma, listLibrary, saveUmaToLibrary } from '../store/persist'
import { useTreeStore } from '../store/tree'
import { Avatar } from './avatar/Avatar'

/**
 * The uma library: trained umas saved for reuse. "Copy to tree" puts the uma
 * on the clipboard; empty slots then offer one-tap paste (the click fallback
 * for drag-and-drop).
 */
export function LibraryView({ data }: { data: GameData }) {
  const [umas, setUmas] = useState<LibraryUma[]>([])
  const [query, setQuery] = useState('')
  const [importNote, setImportNote] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const setClipboard = useTreeStore((s) => s.setClipboard)
  const tree = useTreeStore((s) => s.tree)

  const refresh = useCallback(() => {
    void listLibrary().then(setUmas)
  }, [])
  useEffect(refresh, [refresh, tree]) // refresh when tree changes (saves from the editor)

  const shown = umas.filter((u) => !query || u.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <section aria-label="Uma library" className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-slate-700">Uma library</h2>
        <span className="text-[10px] text-slate-400">{umas.length} saved</span>
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          title="Import a data.json produced by UmaExtractor (memory dump of your veteran list)"
          className="ml-auto rounded border border-slate-300 px-2 py-0.5 text-[11px] hover:border-indigo-500"
        >
          Import UmaExtractor
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            void file.text().then(async (text) => {
              try {
                const result = importUmaExtractor(JSON.parse(text), data)
                for (const { entry } of result.umas) await saveUmaToLibrary(entry)
                let ancestorNote = ''
                if (
                  result.ancestors.length > 0 &&
                  confirm(
                    `Also import ${result.ancestors.length} distinct pedigree ancestors (parents/grandparents with their own sparks)?`,
                  )
                ) {
                  for (const { entry } of result.ancestors) await saveUmaToLibrary(entry)
                  ancestorNote = ` + ${result.ancestors.length} ancestors`
                }
                setImportNote(
                  `Imported ${result.umas.length} umas${ancestorNote}${result.skipped ? `, skipped ${result.skipped}` : ''}.`,
                )
                refresh()
              } catch (err) {
                setImportNote(err instanceof Error ? err.message : 'Import failed.')
              }
            })
            e.target.value = ''
          }}
        />
      </div>
      {importNote && <p className="mt-1 text-[11px] text-emerald-700">{importNote}</p>}

      {umas.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">
          Save trained umas from the slot editor — they're reusable assets across every blueprint.
        </p>
      ) : (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search library…"
            aria-label="Search library"
            className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
          />
          <ul className="mt-1 max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {shown.map((u) => {
              const variant = data.variant(u.build.variantId)
              const chara = variant ? data.character(variant.charaId) : undefined
              return (
                <li key={u.id} className="flex items-center gap-2 py-1.5">
                  <Avatar chara={chara} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{u.name}</div>
                    <div className="truncate text-[10px] text-slate-400">
                      {u.build.blue && `${BLUE_STAT_LABELS[u.build.blue.stat]} ${starStr(u.build.blue.stars)} · `}
                      {u.build.pink && `${APTITUDE_LABELS[u.build.pink.aptitude]} ${starStr(u.build.pink.stars)} · `}
                      {u.build.whites.length} whites · {formatDate(u.updatedAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClipboard(u.build)}
                    className="rounded border border-slate-300 px-2 py-0.5 text-[11px] hover:border-indigo-500"
                    title="Copy to clipboard, then paste into any empty slot"
                  >
                    Copy to tree
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${u.name}`}
                    onClick={() => {
                      if (u.id !== undefined && confirm(`Delete "${u.name}" from the library?`)) {
                        void deleteLibraryUma(u.id).then(refresh)
                      }
                    }}
                    className="rounded px-1 text-slate-300 hover:text-red-500"
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
