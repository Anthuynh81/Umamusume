// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { emptyTree } from './model/types'
import { useTreeStore } from './store/tree'

/** Opens a slot editor, searches a character, clicks her first variant chip. */
async function assignCharacter(slotPattern: RegExp, name: string) {
  fireEvent.click(screen.getByLabelText(slotPattern))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Search characters'), { target: { value: name } })
  const item = (await within(dialog).findByText(name)).closest('li')!
  const chip = within(item as HTMLElement)
    .getAllByRole('button')
    .find((b) => !(b.getAttribute('aria-label') ?? '').startsWith('Toggle owned'))!
  fireEvent.click(chip)
  return screen.findByRole('dialog')
}

function closeEditor() {
  fireEvent.keyDown(window, { key: 'Escape' })
}

function openTool(name: RegExp | string) {
  fireEvent.click(screen.getByRole('tab', { name }))
}

/** End-to-end smoke test over the real static game data. */
describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    useTreeStore.setState((s) => ({
      tree: emptyTree(),
      selectedSlot: null,
      clipboard: null,
      wishlist: [],
      racePool: [],
      settings: { ...s.settings, activeTool: 'affinity' as const },
    }))
  })
  afterEach(cleanup)

  it('renders the shell and the 7-slot quick tree', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Sparkline' })).toBeTruthy()
    expect(screen.getByLabelText(/Edit Trainee/)).toBeTruthy()
    expect(screen.getByLabelText(/Edit Legacy 1 › 2/)).toBeTruthy()
    expect(screen.getAllByLabelText(/^Edit /)).toHaveLength(7)
  })

  it('assigns characters, shows live affinity, and computes rate rows', async () => {
    render(<App />)

    const dialog = await assignCharacter(/Edit Trainee/, 'Special Week')
    expect(within(dialog).getByText(/Blue \(stat\)/i)).toBeTruthy()
    closeEditor()

    const dialog2 = await assignCharacter(/Edit Legacy 1 \(empty\)/, 'Silence Suzuka')
    // Give the parent a 3★ Stamina blue so a rate row exists.
    fireEvent.click(within(dialog2).getByRole('button', { name: 'Stamina' }))
    closeEditor()

    // Affinity tool (default tab): the real Special Week × Silence Suzuka pair is 27.
    const affinity = screen.getByRole('region', { name: 'Affinity' })
    const row = within(affinity).getByText('Trainee × Legacy 1').closest('tr')!
    expect(within(row as HTMLElement).getAllByText('27').length).toBeGreaterThan(0)

    // Chances tool: the stamina blue appears with a per-career chance.
    openTool('Chances')
    const rates = screen.getByRole('region', { name: 'Inheritance rates' })
    expect(within(rates).getByText('Stamina')).toBeTruthy()

    // Aptitudes tool reflects Special Week's base turf A.
    openTool('Aptitudes')
    const aptitudes = screen.getByRole('region', { name: 'Aptitudes' })
    expect(within(aptitudes).getByText('Turf')).toBeTruthy()
  })

  it('aggregates flagged sparks in the wishlist panel', async () => {
    render(<App />)
    await assignCharacter(/Edit Trainee/, 'Special Week')
    closeEditor()
    const dialog = await assignCharacter(/Edit Legacy 1 \(empty\)/, 'Silence Suzuka')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stamina' }))
    closeEditor()

    openTool('Chances')
    fireEvent.click(screen.getByLabelText('Wishlist Stamina'))
    openTool(/^Wishlist/)
    const wishlist = screen.getByRole('region', { name: 'Wishlist' })
    expect(within(wishlist).getByText('Stamina')).toBeTruthy()
    expect(within(wishlist).getByText('Expected')).toBeTruthy()
  })

  it('cycles the theme and applies the dark class', () => {
    render(<App />)
    const toggle = screen.getByRole('button', { name: /^Theme:/ })
    // system → light → dark
    fireEvent.click(toggle)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    fireEvent.click(toggle)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    // dark → system (jsdom has no matchMedia → treated as light)
    fireEvent.click(toggle)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('plans shared races on the calendar and picks a cell race', async () => {
    render(<App />)
    openTool('Races')
    const panel = screen.getByRole('region', { name: 'Race planner' })

    for (const name of ['Special Week', 'Silence Suzuka']) {
      fireEvent.change(within(panel).getByLabelText('Add character to pool'), { target: { value: name } })
      fireEvent.click(await within(panel).findByRole('button', { name: new RegExp(name) }))
      expect(within(panel).getByRole('button', { name: `Remove ${name}` })).toBeTruthy()
    }

    // Disable the aptitude filter so multi-race turns survive for this pool.
    fireEvent.change(within(panel).getByLabelText('Minimum shared aptitude'), { target: { value: 'off' } })

    // Junior December 1st half: Hanshin Juvenile Fillies + Asahi Hai share the turn.
    const cell = await within(panel).findByRole('button', { name: /Dec ¹.*click to pick/ })
    fireEvent.click(cell)
    const listbox = within(panel).getByRole('listbox')
    fireEvent.click(within(listbox).getByRole('option', { name: /Asahi Hai/ }))
    expect(within(panel).getByRole('button', { name: /Dec ¹: Asahi Hai/ })).toBeTruthy()
  })

  it('round-trips the tree through the share codec', async () => {
    render(<App />)
    await assignCharacter(/Edit Trainee/, 'Special Week')
    closeEditor()

    const { encodeTree, decodeTree } = await import('./model/serialize')
    const tree = useTreeStore.getState().tree
    expect(tree.slots[0]).not.toBeNull()
    expect(decodeTree(encodeTree(tree))).toEqual(tree)
  })
})
