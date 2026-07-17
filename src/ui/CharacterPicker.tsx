import { useMemo, useState } from 'react'
import type { GameData, VariantDef } from '../data/types'
import { useTreeStore } from '../store/tree'
import { Avatar } from './avatar/Avatar'

/**
 * Character + outfit picker with search and the owned-only filter.
 * Search matches EN names; JP-derived terms live in the data layer only.
 */
export function CharacterPicker({
  data,
  onPick,
  autoFocus = true,
}: {
  data: GameData
  onPick: (variant: VariantDef) => void
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState('')
  const ownedOnly = useTreeStore((s) => s.settings.ownedOnly)
  const setSetting = useTreeStore((s) => s.setSetting)
  const ownedChars = useTreeStore((s) => s.ownedChars)
  const toggleOwned = useTreeStore((s) => s.toggleOwned)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.characters
      .filter((c) => c.global)
      .filter((c) => !ownedOnly || ownedChars.includes(c.id))
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .map((c) => ({ chara: c, variants: data.variantsOf(c.id).filter((v) => v.global) }))
      .filter((e) => e.variants.length > 0)
  }, [data, query, ownedOnly, ownedChars])

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search characters…"
          autoFocus={autoFocus}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          aria-label="Search characters"
        />
        <label className="flex shrink-0 items-center gap-1 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={ownedOnly}
            onChange={(e) => setSetting('ownedOnly', e.target.checked)}
          />
          Owned
        </label>
      </div>

      <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
        {results.map(({ chara, variants }) => (
          <li key={chara.id} className="py-2">
            <div className="flex items-center gap-2">
              <Avatar chara={chara} size={32} />
              <span className="text-sm font-medium">{chara.name}</span>
              <button
                type="button"
                onClick={() => toggleOwned(chara.id)}
                title={ownedChars.includes(chara.id) ? 'Owned — click to unmark' : 'Mark as owned'}
                aria-label={`Toggle owned: ${chara.name}`}
                className={`ml-auto text-lg leading-none ${ownedChars.includes(chara.id) ? 'text-amber-500' : 'text-slate-300 hover:text-slate-400'}`}
              >
                ★
              </button>
            </div>
            <div className="mt-1 flex flex-wrap gap-1 pl-10">
              {variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onPick(v)}
                  className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:border-indigo-500 hover:text-indigo-600"
                >
                  {v.title || 'Original'}
                </button>
              ))}
            </div>
          </li>
        ))}
        {results.length === 0 && (
          <li className="py-6 text-center text-sm text-slate-400">No characters match.</li>
        )}
      </ul>
    </div>
  )
}
