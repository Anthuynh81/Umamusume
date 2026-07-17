import { useCallback, useEffect, useRef, useState } from 'react'
import { importUmaExtractor } from '../data/importers/umaExtractor'
import type { GameData } from '../data/types'
import { stars as starStr, formatDate } from '../lib/format'
import { heldSkillsOf } from '../lib/skills'
import type { LibraryUma } from '../model/library'
import { APTITUDE_LABELS, BLUE_STAT_LABELS } from '../model/types'
import { clearLibrary, deleteLibraryUma, listLibrary, saveUmaToLibrary } from '../store/persist'
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
  const [expanded, setExpanded] = useState<number | null>(null)
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
        {umas.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete ALL ${umas.length} umas from the library? This cannot be undone (blueprints are untouched).`)) {
                void clearLibrary().then(() => {
                  setImportNote('Library cleared.')
                  refresh()
                })
              }
            }}
            title="Delete every saved uma (e.g. before a fresh UmaExtractor import)"
            className="rounded border border-red-200 px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-50"
          >
            Clear all
          </button>
        )}
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
                const perUmaWarnings = result.umas.flatMap((u) => u.warnings)
                const allWarnings = [...result.warnings, ...perUmaWarnings]
                if (allWarnings.length > 0) console.warn('Sparkline import warnings:', allWarnings)
                setImportNote(
                  `Imported ${result.umas.length} umas${ancestorNote}${result.skipped ? `, skipped ${result.skipped}` : ''}.` +
                    (allWarnings.length > 0 ? ` ⚠ ${allWarnings.length} warning${allWarnings.length > 1 ? 's' : ''}: ${allWarnings[0]}` : ''),
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
              const held = heldSkillsOf(u)
              return (
                <li key={u.id} className="py-1.5">
                  <div className="flex items-center gap-2">
                  <Avatar chara={chara} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{u.name}</div>
                    <div className="truncate text-[10px] text-slate-400">
                      {u.build.blue && `${BLUE_STAT_LABELS[u.build.blue.stat]} ${starStr(u.build.blue.stars)} · `}
                      {u.build.pink && `${APTITUDE_LABELS[u.build.pink.aptitude]} ${starStr(u.build.pink.stars)} · `}
                      {u.build.whites.length} whites
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === u.id ? null : (u.id ?? null))}
                        aria-expanded={expanded === u.id}
                        className="ml-1 text-indigo-500 hover:underline"
                      >
                        {expanded === u.id ? '▾ hide' : '▸ sparks'}
                        {held.length > 0 ? ` & ${held.length} skills` : ''}
                      </button>
                      {' · '}
                      {formatDate(u.updatedAt)}
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
                  </div>
                  {expanded === u.id && (
                    <div className="mt-1 space-y-1 pl-9">
                      <div className="flex flex-wrap gap-1">
                        {u.build.blue && (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-800">
                            {BLUE_STAT_LABELS[u.build.blue.stat]} {starStr(u.build.blue.stars)}
                          </span>
                        )}
                        {u.build.pink && (
                          <span className="rounded bg-pink-100 px-1.5 py-0.5 text-[10px] text-pink-800">
                            {APTITUDE_LABELS[u.build.pink.aptitude]} {starStr(u.build.pink.stars)}
                          </span>
                        )}
                        {u.build.green && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">
                            {(variant?.uniqueSkillId != null && data.uniqueSkill(variant.uniqueSkillId)?.name) || 'Unique'}{' '}
                            {starStr(u.build.green.stars)}
                          </span>
                        )}
                        {u.build.whites.map((w) => (
                          <span key={`${w.kind}:${w.refId}`} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                            {data.spark(w.refId)?.name ?? `#${w.refId}`} {starStr(w.stars)}
                          </span>
                        ))}
                        {u.build.wonRaces.length > 0 && (
                          <span
                            className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-800"
                            title={u.build.wonRaces.map((id) => data.race(id)?.name ?? id).join(', ')}
                          >
                            {u.build.wonRaces.length} wins
                          </span>
                        )}
                      </div>
                      {held.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {held.map((h) => {
                            const skill = data.skill(h.id)
                            const cls =
                              skill?.tier === 'gold' ? 'bg-amber-100 text-amber-800'
                              : skill?.tier === 'circle' ? 'bg-sky-100 text-sky-800'
                              : skill?.tier === 'unique' ? 'bg-violet-100 text-violet-800'
                              : 'bg-slate-100 text-slate-600'
                            return (
                              <span key={h.id} className={`rounded px-1.5 py-0.5 text-[10px] ${cls}`}>
                                {skill?.name ?? `#${h.id}`}
                                {h.level > 1 && <span className="ml-0.5 opacity-70">Lv{h.level}</span>}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
