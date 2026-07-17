import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { loadGameData } from './data/load'
import { SHARE_PARAM, decodeTree } from './model/serialize'
import { useTreeStore } from './store/tree'
import type { ToolKey } from './store/tree'
import { LibraryView } from './ui/LibraryView'
import { SavesView } from './ui/SavesView'
import { ShareBar } from './ui/ShareBar'
import { SlotEditor } from './ui/SlotEditor'
import { TreeView } from './ui/TreeView'
import { AffinityPanel } from './ui/panels/AffinityPanel'
import { AptitudePanel } from './ui/panels/AptitudePanel'
import { FarmingPanel } from './ui/panels/FarmingPanel'
import { OptimizerPanel } from './ui/panels/OptimizerPanel'
import { RacePlannerPanel } from './ui/panels/RacePlannerPanel'
import { RatePanel } from './ui/panels/RatePanel'
import { RecommendPanel } from './ui/panels/RecommendPanel'
import { WishlistPanel } from './ui/panels/WishlistPanel'

const data = loadGameData()

const TOOLS: { key: ToolKey; label: string; render: () => ReactNode }[] = [
  { key: 'affinity', label: 'Affinity', render: () => <AffinityPanel data={data} /> },
  { key: 'aptitudes', label: 'Aptitudes', render: () => <AptitudePanel data={data} /> },
  { key: 'chances', label: 'Chances', render: () => <RatePanel data={data} /> },
  { key: 'wishlist', label: 'Wishlist', render: () => <WishlistPanel data={data} /> },
  { key: 'recommend', label: 'Recommend', render: () => <RecommendPanel data={data} /> },
  { key: 'optimizer', label: 'Optimizer', render: () => <OptimizerPanel data={data} /> },
  { key: 'farming', label: 'Farming', render: () => <FarmingPanel data={data} /> },
  { key: 'races', label: 'Races', render: () => <RacePlannerPanel data={data} /> },
  { key: 'library', label: 'Library', render: () => <LibraryView data={data} /> },
  { key: 'blueprints', label: 'Blueprints', render: () => <SavesView /> },
]

export default function App() {
  const loadTree = useTreeStore((s) => s.loadTree)
  const theme = useTreeStore((s) => s.settings.theme)
  const activeTool = useTreeStore((s) => s.settings.activeTool)
  const setSetting = useTreeStore((s) => s.setSetting)
  const wishlistCount = useTreeStore((s) => s.wishlist.length)
  const [shareError, setShareError] = useState<string | null>(null)

  // Theme: toggle the .dark class (palette flip in index.css). 'system'
  // follows the OS preference live.
  useEffect(() => {
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && !!mq?.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    mq?.addEventListener('change', apply)
    return () => mq?.removeEventListener('change', apply)
  }, [theme])

  // Decode a shared tree from ?d=… once on boot, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get(SHARE_PARAM)
    if (!encoded) return
    try {
      loadTree(decodeTree(encoded))
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not read the shared link.')
    }
    params.delete(SHARE_PARAM)
    const rest = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''))
  }, [loadTree])

  const active = TOOLS.find((t) => t.key === activeTool) ?? TOOLS[0]!

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <h1 className="text-lg font-black tracking-tight text-indigo-700">Sparkline</h1>
          <p className="hidden text-[11px] text-slate-400 sm:block">
            Umamusume legacy planner · unofficial fan tool · Global
          </p>
          <div className="ml-auto">
            <ShareBar />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-3 p-3 sm:p-4">
        {shareError && (
          <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Shared link problem: {shareError}
          </p>
        )}

        <TreeView data={data} />

        <div>
          <div
            role="tablist"
            aria-label="Tools"
            className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px"
          >
            {TOOLS.map((tool) => (
              <button
                key={tool.key}
                type="button"
                role="tab"
                aria-selected={tool.key === active.key}
                aria-controls={`tool-${tool.key}`}
                onClick={() => setSetting('activeTool', tool.key)}
                className={`shrink-0 rounded-t-md border-x border-t px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tool.key === active.key
                    ? '-mb-px border-slate-200 border-b-white bg-white text-indigo-700'
                    : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {tool.label}
                {tool.key === 'wishlist' && wishlistCount > 0 && (
                  <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-[10px] text-white">{wishlistCount}</span>
                )}
              </button>
            ))}
          </div>
          <div id={`tool-${active.key}`} role="tabpanel" className="pt-3">
            {active.render()}
          </div>
        </div>

        <footer className="pb-6 pt-2 text-center text-[10px] leading-relaxed text-slate-400">
          Sparkline is an unofficial fan tool; not affiliated with Cygames. Umamusume: Pretty Derby © Cygames.
          <br />
          Rates are community estimates — see the project's ATTRIBUTION and research docs for sources.
        </footer>
      </main>

      <SlotEditor data={data} />
    </div>
  )
}
