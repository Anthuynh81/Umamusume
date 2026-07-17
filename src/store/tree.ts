/**
 * Working-tree state + user settings. The working tree autosaves to
 * localStorage; named saves and the uma library live in IndexedDB
 * (store/persist.ts). Settings persist to localStorage.
 */
import { create } from 'zustand'
import type { RaceBonusRule } from '../data/config/rates'
import { TREE_SLOTS, emptyTree } from '../model/types'
import type { SlotPairKey, Tree, UmaBuild } from '../model/types'

export type Theme = 'system' | 'light' | 'dark'

export type ToolKey =
  | 'affinity' | 'aptitudes' | 'chances' | 'wishlist' | 'recommend'
  | 'optimizer' | 'farming' | 'races' | 'library' | 'blueprints'

export interface Settings {
  showMemos: boolean
  showAffinity: boolean
  /** Horizontal tree layout (desktop enhancement). */
  horizontal: boolean
  /** Rendered ancestor generations: 2 = quick 7-slot mode, 4 = full tree. */
  depth: 2 | 3 | 4
  raceBonusRule: RaceBonusRule
  /** Character picker: only show owned characters. */
  ownedOnly: boolean
  theme: Theme
  /** Active tool tab below the tree. */
  activeTool: ToolKey
}

const DEFAULT_SETTINGS: Settings = {
  showMemos: true,
  showAffinity: true,
  horizontal: false,
  depth: 2,
  raceBonusRule: 'global-legacy',
  ownedOnly: false,
  theme: 'system',
  activeTool: 'affinity',
}

const LS_TREE = 'sparkline.tree.v1'
const LS_SETTINGS = 'sparkline.settings.v1'
const LS_OWNED = 'sparkline.owned.v1'
const LS_WISHLIST = 'sparkline.wishlist.v1'
const LS_SUPPORTS = 'sparkline.supports.v1'

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full/unavailable — the app keeps working, just without autosave.
  }
}

function sanitizeTree(raw: unknown): Tree | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Tree
  if (!Array.isArray(t.slots) || t.slots.length !== TREE_SLOTS) return null
  return { slots: t.slots, extraWins: t.extraWins ?? {} }
}

interface TreeStore {
  tree: Tree
  /** Slot open in the editor drawer, or null. */
  selectedSlot: number | null
  /** Click-to-copy clipboard (drag-and-drop fallback). */
  clipboard: UmaBuild | null
  settings: Settings
  ownedChars: number[]
  /** Flagged must-have sparks: SparkRateRow keys (e.g. "white:skill:20034"). */
  wishlist: string[]
  /** Race-planner character pool (shared so other tools can hand off to it). */
  racePool: number[]
  /** Owned support cards (id → max limit break), from UmaExtractor imports. */
  ownedSupports: Record<string, number>

  setSlot(index: number, build: UmaBuild | null): void
  setRacePool(pool: number[]): void
  setOwnedSupports(cards: { id: number; limitBreak: number }[]): void
  updateSlot(index: number, patch: Partial<UmaBuild>): void
  copySlot(from: number, to: number): void
  swapSlots(a: number, b: number): void
  select(index: number | null): void
  setClipboard(build: UmaBuild | null): void
  setExtraWins(key: SlotPairKey, wins: number): void
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void
  toggleOwned(charaId: number): void
  toggleWishlist(key: string): void
  loadTree(tree: Tree): void
  resetTree(): void
}

export const useTreeStore = create<TreeStore>((set) => ({
  tree: loadJson<Tree>(LS_TREE) && sanitizeTree(loadJson(LS_TREE)) || emptyTree(),
  selectedSlot: null,
  clipboard: null,
  settings: { ...DEFAULT_SETTINGS, ...loadJson<Partial<Settings>>(LS_SETTINGS) },
  ownedChars: loadJson<number[]>(LS_OWNED) ?? [],
  wishlist: loadJson<string[]>(LS_WISHLIST) ?? [],
  racePool: [],
  ownedSupports: loadJson<Record<string, number>>(LS_SUPPORTS) ?? {},

  setSlot: (index, build) =>
    set((s) => {
      const slots = [...s.tree.slots]
      slots[index] = build
      return { tree: { ...s.tree, slots } }
    }),

  updateSlot: (index, patch) =>
    set((s) => {
      const current = s.tree.slots[index]
      if (!current) return s
      const slots = [...s.tree.slots]
      slots[index] = { ...current, ...patch }
      return { tree: { ...s.tree, slots } }
    }),

  copySlot: (from, to) =>
    set((s) => {
      const src = s.tree.slots[from]
      if (!src) return s
      const slots = [...s.tree.slots]
      slots[to] = structuredClone(src)
      return { tree: { ...s.tree, slots } }
    }),

  swapSlots: (a, b) =>
    set((s) => {
      const slots = [...s.tree.slots]
      ;[slots[a], slots[b]] = [slots[b] ?? null, slots[a] ?? null]
      return { tree: { ...s.tree, slots } }
    }),

  select: (index) => set({ selectedSlot: index }),
  setClipboard: (build) => set({ clipboard: build ? structuredClone(build) : null }),

  setExtraWins: (key, wins) =>
    set((s) => {
      const extraWins = { ...s.tree.extraWins }
      if (wins > 0) extraWins[key] = wins
      else delete extraWins[key]
      return { tree: { ...s.tree, extraWins } }
    }),

  setSetting: (key, value) =>
    set((s) => ({ settings: { ...s.settings, [key]: value } })),

  toggleOwned: (charaId) =>
    set((s) => ({
      ownedChars: s.ownedChars.includes(charaId)
        ? s.ownedChars.filter((c) => c !== charaId)
        : [...s.ownedChars, charaId],
    })),

  setRacePool: (pool) => set({ racePool: [...new Set(pool)] }),

  setOwnedSupports: (cards) =>
    set((s) => {
      const merged = { ...s.ownedSupports }
      for (const c of cards) merged[c.id] = Math.max(merged[c.id] ?? 0, c.limitBreak)
      return { ownedSupports: merged }
    }),

  toggleWishlist: (key) =>
    set((s) => ({
      wishlist: s.wishlist.includes(key)
        ? s.wishlist.filter((k) => k !== key)
        : [...s.wishlist, key],
    })),

  loadTree: (tree) => set({ tree: structuredClone(tree), selectedSlot: null }),
  resetTree: () => set({ tree: emptyTree(), selectedSlot: null }),
}))

// Autosave (throttled by microtask batching of zustand set calls).
useTreeStore.subscribe((state, prev) => {
  if (state.tree !== prev.tree) saveJson(LS_TREE, state.tree)
  if (state.settings !== prev.settings) saveJson(LS_SETTINGS, state.settings)
  if (state.ownedChars !== prev.ownedChars) saveJson(LS_OWNED, state.ownedChars)
  if (state.wishlist !== prev.wishlist) saveJson(LS_WISHLIST, state.wishlist)
  if (state.ownedSupports !== prev.ownedSupports) saveJson(LS_SUPPORTS, state.ownedSupports)
})
