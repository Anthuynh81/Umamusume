import { useState } from 'react'
import { SHARE_PARAM, encodeTree } from '../model/serialize'
import { useTreeStore } from '../store/tree'
import type { Theme } from '../store/tree'

const THEME_CYCLE: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
const THEME_LABELS: Record<Theme, string> = { system: '◐ Auto', light: '☀ Light', dark: '● Dark' }

/** Share-link generation + display settings. */
export function ShareBar() {
  const tree = useTreeStore((s) => s.tree)
  const settings = useTreeStore((s) => s.settings)
  const setSetting = useTreeStore((s) => s.setSetting)
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = new URL(window.location.href)
    url.search = `?${SHARE_PARAM}=${encodeTree(tree)}`
    try {
      await navigator.clipboard.writeText(url.toString())
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      prompt('Copy this share link:', url.toString())
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <button
        type="button"
        onClick={() => void share()}
        className="rounded bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500"
      >
        {copied ? 'Link copied ✓' : 'Share link'}
      </button>
      <label className="flex items-center gap-1 text-slate-500">
        <input type="checkbox" checked={settings.showAffinity} onChange={(e) => setSetting('showAffinity', e.target.checked)} />
        Affinity badges
      </label>
      <label className="flex items-center gap-1 text-slate-500">
        <input type="checkbox" checked={settings.showMemos} onChange={(e) => setSetting('showMemos', e.target.checked)} />
        Memos
      </label>
      <button
        type="button"
        onClick={() => setSetting('theme', THEME_CYCLE[settings.theme])}
        title="Theme: follows your system by default"
        aria-label={`Theme: ${settings.theme}. Click to change.`}
        className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:border-indigo-500"
      >
        {THEME_LABELS[settings.theme]}
      </button>
    </div>
  )
}
