/**
 * Generates the social-share card (public/og.png, 1200×630). Run manually
 * when the branding changes: `node scripts/make-og.mjs`.
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas } from '@napi-rs/canvas'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og.png')
const W = 1200
const H = 630

const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d')

// Background
const bg = ctx.createLinearGradient(0, 0, W, H)
bg.addColorStop(0, '#0f172a')
bg.addColorStop(1, '#1e1b4b')
ctx.fillStyle = bg
ctx.fillRect(0, 0, W, H)

// Spark motif
function star(cx, cy, r, color, points = 4) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points
    const radius = i % 2 === 0 ? r : r * 0.28
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}
star(980, 160, 120, '#4f46e5')
star(1080, 300, 55, '#fbbf24')
star(880, 360, 34, '#818cf8')
star(1105, 95, 26, '#a5b4fc')

// Faint tree glyph (three generations of connected cards)
ctx.strokeStyle = 'rgba(129,140,248,0.35)'
ctx.fillStyle = 'rgba(129,140,248,0.12)'
ctx.lineWidth = 3
const card = (x, y) => {
  ctx.beginPath()
  ctx.roundRect(x, y, 96, 60, 10)
  ctx.fill()
  ctx.stroke()
}
ctx.beginPath()
ctx.moveTo(710, 470)
ctx.lineTo(620, 530)
ctx.moveTo(710, 470)
ctx.lineTo(800, 530)
ctx.stroke()
card(662, 410)
card(572, 530)
card(752, 530)

// Wordmark
ctx.fillStyle = '#a5b4fc'
ctx.font = '900 110px system-ui, sans-serif'
ctx.fillText('Sparkline', 70, 200)
ctx.fillStyle = '#f8fafc'
ctx.font = '600 40px system-ui, sans-serif'
ctx.fillText('Umamusume legacy planner', 74, 270)
ctx.fillStyle = '#94a3b8'
ctx.font = '400 28px system-ui, sans-serif'
ctx.fillText('Family trees · affinity math · inheritance chances', 74, 322)
ctx.fillText('loop pools · race calendars · farming odds', 74, 360)
ctx.fillStyle = '#64748b'
ctx.font = '400 22px system-ui, sans-serif'
ctx.fillText('Unofficial fan tool · Umamusume: Pretty Derby © Cygames', 74, 580)

writeFileSync(OUT, canvas.toBuffer('image/png'))
console.log(`wrote ${OUT}`)
