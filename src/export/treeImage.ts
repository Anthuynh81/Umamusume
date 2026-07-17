/**
 * PNG export: hand-drawn canvas rendering of the tree (not DOM screenshots —
 * cleaner output, no CSS-to-canvas quirks). Layout math is pure and
 * unit-tested; painting happens in drawTree.
 */
import type { GameData } from '../data/types'
import { affinityBreakdown } from '../engine/affinity'
import { generationSlots, slotLabel } from '../model/tree'
import { APTITUDE_LABELS, BLUE_STAT_LABELS } from '../model/types'
import type { Tree, UmaBuild } from '../model/types'

export interface ExportOptions {
  /** 'active' = trainee + parents + grandparents (7 slots); 'full' = 31. */
  scope: 'active' | 'full'
  showAffinity: boolean
  dark: boolean
}

const CARD_W = 208
const CARD_H = 116
const GAP_X = 14
const GAP_Y = 46
const MARGIN = 24
const HEADER_H = 54
const FOOTER_H = 26

export interface CardPos {
  slot: number
  x: number
  y: number
}

export interface TreeLayout {
  width: number
  height: number
  cards: CardPos[]
  /** Connector lines: [childSlot, parentSlot] (parent rendered below child). */
  links: [number, number][]
  generations: number
}

/** Pure layout: positions for every slot in scope, centered per generation. */
export function layoutTree(scope: 'active' | 'full'): TreeLayout {
  const generations = scope === 'active' ? 3 : 5
  const maxRow = 2 ** (generations - 1)
  const width = MARGIN * 2 + maxRow * CARD_W + (maxRow - 1) * GAP_X
  const height = HEADER_H + generations * CARD_H + (generations - 1) * GAP_Y + FOOTER_H + MARGIN

  const cards: CardPos[] = []
  const links: [number, number][] = []
  for (let gen = 0; gen < generations; gen++) {
    const slots = generationSlots(gen)
    const rowWidth = slots.length * CARD_W + (slots.length - 1) * (gen === generations - 1 ? GAP_X : GAP_X)
    const startX = (width - rowWidth) / 2
    const y = HEADER_H + gen * (CARD_H + GAP_Y)
    slots.forEach((slot, i) => {
      cards.push({ slot, x: startX + i * (CARD_W + GAP_X), y })
      if (gen < generations - 1) {
        links.push([slot, 2 * slot + 1], [slot, 2 * slot + 2])
      }
    })
  }
  return { width, height, cards, links, generations }
}

interface Palette {
  bg: string
  card: string
  cardBorder: string
  text: string
  subtext: string
  faint: string
  accent: string
  line: string
  badge: string
  badgeText: string
  chipBlue: [string, string]
  chipPink: [string, string]
  chipGreen: [string, string]
  chipWhite: [string, string]
}

const LIGHT: Palette = {
  bg: '#f8fafc', card: '#ffffff', cardBorder: '#e2e8f0',
  text: '#0f172a', subtext: '#64748b', faint: '#94a3b8',
  accent: '#4338ca', line: '#cbd5e1', badge: '#fbbf24', badgeText: '#ffffff',
  chipBlue: ['#e0f2fe', '#075985'], chipPink: ['#fce7f3', '#9d174d'],
  chipGreen: ['#d1fae5', '#065f46'], chipWhite: ['#f1f5f9', '#475569'],
}

const DARK: Palette = {
  bg: '#020617', card: '#0f172a', cardBorder: '#334155',
  text: '#f8fafc', subtext: '#94a3b8', faint: '#64748b',
  accent: '#a5b4fc', line: '#334155', badge: '#d97706', badgeText: '#0f172a',
  chipBlue: ['#0c4a6e', '#bae6fd'], chipPink: ['#831843', '#fbcfe8'],
  chipGreen: ['#064e3b', '#a7f3d0'], chipWhite: ['#1e293b', '#cbd5e1'],
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function drawSilhouette(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string, variant: number) {
  const s = size / 64
  ctx.save()
  ctx.translate(cx - size / 2, cy - size / 2)
  ctx.scale(s, s)
  ctx.fillStyle = color
  // Ears
  ctx.beginPath()
  if (variant === 1) {
    ctx.moveTo(20, 20); ctx.lineTo(20, 5); ctx.lineTo(29, 17)
    ctx.moveTo(44, 20); ctx.lineTo(44, 5); ctx.lineTo(35, 17)
  } else {
    ctx.moveTo(22, 18); ctx.lineTo(26, 3); ctx.lineTo(31, 16)
    ctx.moveTo(42, 18); ctx.lineTo(38, 3); ctx.lineTo(33, 16)
  }
  ctx.fill()
  // Head + shoulders
  ctx.beginPath()
  ctx.arc(32, 29, 13, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(12, 64)
  ctx.quadraticCurveTo(14, 45, 32, 45)
  ctx.quadraticCurveTo(50, 45, 52, 64)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function hashColor(id: number): string {
  return `hsl(${((id * 137.508) % 360).toFixed(0)} 55% 55%)`
}

/** Five-point star drawn as a path — text ★ has no guaranteed font glyph. */
function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    const radius = i % 2 === 0 ? r : r * 0.45
    const px = cx + Math.cos(angle) * radius
    const py = cy + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

/** Tier symbol (◎/○/△) drawn as shapes for the same font-safety reason. */
function drawTierSymbol(ctx: CanvasRenderingContext2D, tier: 'excellent' | 'good' | 'poor', cx: number, cy: number, r: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.8
  if (tier === 'poor') {
    ctx.beginPath()
    ctx.moveTo(cx, cy - r)
    ctx.lineTo(cx + r * 0.95, cy + r * 0.75)
    ctx.lineTo(cx - r * 0.95, cy + r * 0.75)
    ctx.closePath()
    ctx.stroke()
    return
  }
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  if (tier === 'excellent') {
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function chip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  stars: number,
  [bg, fg]: [string, string],
): number {
  ctx.font = '10px system-ui, sans-serif'
  const w = ctx.measureText(label).width + 10 + stars * 9 + (stars > 0 ? 2 : 0)
  ctx.fillStyle = bg
  roundRect(ctx, x, y, w, 15, 7)
  ctx.fill()
  ctx.fillStyle = fg
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + 5, y + 8)
  const starsX = x + 5 + ctx.measureText(label).width + 4
  for (let i = 0; i < stars; i++) drawStar(ctx, starsX + i * 9 + 3.5, y + 7.5, 4, fg)
  return w + 4
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  pos: CardPos,
  build: UmaBuild | null,
  data: GameData,
  pal: Palette,
  affinity: number | null,
) {
  const { x, y } = pos
  ctx.fillStyle = pal.card
  ctx.strokeStyle = pal.cardBorder
  ctx.lineWidth = 1
  roundRect(ctx, x, y, CARD_W, CARD_H, 10)
  ctx.fill()
  ctx.stroke()

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = pal.faint
  ctx.font = '9px system-ui, sans-serif'
  ctx.fillText(slotLabel(pos.slot).toUpperCase(), x + 10, y + 16)

  if (!build) {
    ctx.fillStyle = pal.faint
    ctx.font = 'italic 11px system-ui, sans-serif'
    ctx.fillText('empty', x + 10, y + 40)
    return
  }

  const variant = data.variant(build.variantId)
  const chara = variant ? data.character(variant.charaId) : undefined
  drawSilhouette(ctx, x + 26, y + 44, 32, chara?.color ?? (chara ? hashColor(chara.id) : pal.faint), (chara?.id ?? 0) % 3)

  ctx.fillStyle = pal.text
  ctx.font = 'bold 12px system-ui, sans-serif'
  ctx.fillText(truncate(ctx, chara?.name ?? `#${build.variantId}`, CARD_W - 62), x + 46, y + 38)
  ctx.fillStyle = pal.subtext
  ctx.font = '9px system-ui, sans-serif'
  ctx.fillText(truncate(ctx, variant?.title ?? '', CARD_W - 62), x + 46, y + 50)

  // Spark chips (two rows max).
  let cx = x + 10
  let cy = y + 64
  const put = (label: string, stars: number, colors: [string, string]) => {
    ctx.font = '10px system-ui, sans-serif'
    const w = ctx.measureText(label).width + 14 + stars * 9
    if (cx + w > x + CARD_W - 8) {
      cx = x + 10
      cy += 18
    }
    if (cy > y + CARD_H - 16) return
    cx += chip(ctx, cx, cy, label, stars, colors)
  }
  if (build.blue) put(BLUE_STAT_LABELS[build.blue.stat], build.blue.stars, pal.chipBlue)
  if (build.pink) put(APTITUDE_LABELS[build.pink.aptitude], build.pink.stars, pal.chipPink)
  if (build.green) put('Unique', build.green.stars, pal.chipGreen)
  for (const w of build.whites.slice(0, 3)) {
    put(truncate(ctx, data.spark(w.refId)?.name ?? `#${w.refId}`, 70), w.stars, pal.chipWhite)
  }
  if (build.whites.length > 3) put(`+${build.whites.length - 3}`, 0, pal.chipWhite)

  if (affinity !== null) {
    ctx.font = 'bold 10px system-ui, sans-serif'
    const label = String(affinity)
    const w = ctx.measureText(label).width + 12
    ctx.fillStyle = affinity >= 51 ? pal.badge : affinity > 0 ? pal.line : '#ef4444'
    roundRect(ctx, x + CARD_W - w - 6, y - 8, w, 16, 8)
    ctx.fill()
    ctx.fillStyle = pal.badgeText
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x + CARD_W - w, y)
    ctx.textBaseline = 'alphabetic'
  }
}

export function drawTree(
  canvas: HTMLCanvasElement,
  tree: Tree,
  data: GameData,
  opts: ExportOptions,
): void {
  const layout = layoutTree(opts.scope)
  const scale = 2 // retina-crisp output
  canvas.width = layout.width * scale
  canvas.height = layout.height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')
  ctx.scale(scale, scale)

  const pal = opts.dark ? DARK : LIGHT
  ctx.fillStyle = pal.bg
  ctx.fillRect(0, 0, layout.width, layout.height)

  const breakdown = affinityBreakdown(tree, 0, data)

  // Header
  ctx.fillStyle = pal.accent
  ctx.font = 'black 20px system-ui, sans-serif'
  ctx.fillText('Sparkline', MARGIN, 32)
  if (opts.showAffinity && breakdown.links.length > 0) {
    drawTierSymbol(ctx, breakdown.tier, MARGIN + 122, 25, 8, pal.text)
    ctx.fillStyle = pal.text
    ctx.font = 'bold 16px system-ui, sans-serif'
    ctx.fillText(String(breakdown.total), MARGIN + 138, 31)
  }
  ctx.fillStyle = pal.faint
  ctx.font = '10px system-ui, sans-serif'
  const dateLabel = new Date().toISOString().slice(0, 10)
  ctx.fillText(dateLabel, layout.width - MARGIN - ctx.measureText(dateLabel).width, 30)

  // Connectors under cards
  const posOf = new Map(layout.cards.map((c) => [c.slot, c]))
  ctx.strokeStyle = pal.line
  ctx.lineWidth = 1.5
  for (const [child, parent] of layout.links) {
    const a = posOf.get(child)
    const b = posOf.get(parent)
    if (!a || !b) continue
    ctx.beginPath()
    const ax = a.x + CARD_W / 2
    const ay = a.y + CARD_H
    const bx = b.x + CARD_W / 2
    const by = b.y
    ctx.moveTo(ax, ay)
    ctx.bezierCurveTo(ax, ay + GAP_Y / 2, bx, by - GAP_Y / 2, bx, by)
    ctx.stroke()
  }

  for (const pos of layout.cards) {
    const showBadge = opts.showAffinity && pos.slot >= 1 && pos.slot <= 6 && tree.slots[pos.slot] != null
    drawCard(ctx, pos, tree.slots[pos.slot] ?? null, data, pal, showBadge ? (breakdown.perSlot[pos.slot] ?? 0) : null)
  }

  // Footer
  ctx.fillStyle = pal.faint
  ctx.font = '9px system-ui, sans-serif'
  ctx.fillText('made with Sparkline - unofficial fan tool - Umamusume (c) Cygames', MARGIN, layout.height - 12)
}

export async function exportTreePng(tree: Tree, data: GameData, opts: ExportOptions): Promise<Blob> {
  const canvas = document.createElement('canvas')
  drawTree(canvas, tree, data, opts)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png')
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
