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
import { useMemo } from 'react'
import { APTITUDE_KEYS, BLUE_STATS } from '../model/types'
import type { AptitudeKey, BlueStat, Stars } from '../model/types'

type SourceFilter = 'all' | 'mine' | 'ancestors'
type SortKey = 'newest' | 'name' | 'score' | 'sparks'

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
  const [blueFilter, setBlueFilter] = useState<BlueStat | ''>('')
  const [blueMin, setBlueMin] = useState<Stars>(1)
  const [pinkFilter, setPinkFilter] = useState<AptitudeKey | ''>('')
  const [pinkMin, setPinkMin] = useState<Stars>(1)
  const [source, setSource] = useState<SourceFilter>('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const importRef = useRef<HTMLInputElement>(null)
  const setClipboard = useTreeStore((s) => s.setClipboard)
  const setOwnedSupports = useTreeStore((s) => s.setOwnedSupports)
  const tree = useTreeStore((s) => s.tree)

  const refresh = useCallback(() => {
    void listLibrary().then(setUmas)
  }, [])
  useEffect(refresh, [refresh, tree]) // refresh when tree changes (saves from the editor)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sparkCount = (u: LibraryUma) =>
      (u.build.blue ? 1 : 0) + (u.build.pink ? 1 : 0) + (u.build.green ? 1 : 0) + u.build.whites.length
    const filtered = umas.filter((u) => {
      // Text: uma name OR any white-spark name.
      if (
        q &&
        !u.name.toLowerCase().includes(q) &&
        !u.build.whites.some((w) => (data.spark(w.refId)?.name ?? '').toLowerCase().includes(q))
      ) {
        return false
      }
      if (blueFilter && !(u.build.blue?.stat === blueFilter && u.build.blue.stars >= blueMin)) return false
      if (pinkFilter && !(u.build.pink?.aptitude === pinkFilter && u.build.pink.stars >= pinkMin)) return false
      const isAncestor = u.tags.includes('ancestor')
      if (source === 'mine' && isAncestor) return false
      if (source === 'ancestors' && !isAncestor) return false
      return true
    })
    const sorted = [...filtered]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'score') sorted.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    else if (sort === 'sparks') sorted.sort((a, b) => sparkCount(b) - sparkCount(a))
    // 'newest' keeps listLibrary's updatedAt-desc order.
    return sorted
  }, [umas, query, blueFilter, blueMin, pinkFilter, pinkMin, source, sort, data])

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
                setOwnedSupports(result.supportCards)
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
            placeholder="Search by name or white spark (e.g. Groundwork)…"
            aria-label="Search library"
            className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
          />
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <label className="flex items-center gap-1">
              Blue
              <select value={blueFilter} onChange={(e) => setBlueFilter(e.target.value as BlueStat | '')} aria-label="Filter by blue spark" className="rounded border border-slate-300 px-1 py-0.5">
                <option value="">any</option>
                {BLUE_STATS.map((s) => (
                  <option key={s} value={s}>{BLUE_STAT_LABELS[s]}</option>
                ))}
              </select>
              {blueFilter && (
                <select value={blueMin} onChange={(e) => setBlueMin(Number(e.target.value) as Stars)} aria-label="Minimum blue stars" className="rounded border border-slate-300 px-1 py-0.5">
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>{'★'.repeat(n)}+</option>
                  ))}
                </select>
              )}
            </label>
            <label className="flex items-center gap-1">
              Pink
              <select value={pinkFilter} onChange={(e) => setPinkFilter(e.target.value as AptitudeKey | '')} aria-label="Filter by pink spark" className="rounded border border-slate-300 px-1 py-0.5">
                <option value="">any</option>
                {APTITUDE_KEYS.map((k) => (
                  <option key={k} value={k}>{APTITUDE_LABELS[k]}</option>
                ))}
              </select>
              {pinkFilter && (
                <select value={pinkMin} onChange={(e) => setPinkMin(Number(e.target.value) as Stars)} aria-label="Minimum pink stars" className="rounded border border-slate-300 px-1 py-0.5">
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>{'★'.repeat(n)}+</option>
                  ))}
                </select>
              )}
            </label>
            <label className="flex items-center gap-1">
              Show
              <select value={source} onChange={(e) => setSource(e.target.value as SourceFilter)} aria-label="Filter by source" className="rounded border border-slate-300 px-1 py-0.5">
                <option value="all">all</option>
                <option value="mine">my umas</option>
                <option value="ancestors">ancestors</option>
              </select>
            </label>
            <label className="ml-auto flex items-center gap-1">
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort library" className="rounded border border-slate-300 px-1 py-0.5">
                <option value="newest">newest</option>
                <option value="name">name</option>
                <option value="score">score</option>
                <option value="sparks">most sparks</option>
              </select>
            </label>
            <span className="tabular-nums text-slate-400">{shown.length}/{umas.length}</span>
          </div>
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
