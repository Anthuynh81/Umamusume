/**
 * Copyable "looking for this rental" summary of a slot's required uma —
 * formatted to paste into Discord or a friend-search post.
 */
import type { GameData } from '../data/types'
import { APTITUDE_LABELS, BLUE_STAT_LABELS } from '../model/types'
import type { UmaBuild } from '../model/types'

const star = (n: number) => `${n}★`

export function rentalText(build: UmaBuild, data: GameData): string {
  const variant = data.variant(build.variantId)
  const chara = variant ? data.character(variant.charaId) : undefined
  const lines: string[] = []

  lines.push(`LF rental: ${chara?.name ?? `Card ${build.variantId}`} (any outfit)`)

  const core: string[] = []
  if (build.blue) core.push(`${BLUE_STAT_LABELS[build.blue.stat]} ${star(build.blue.stars)}`)
  if (build.pink) core.push(`${APTITUDE_LABELS[build.pink.aptitude]} ${star(build.pink.stars)}`)
  if (build.green) core.push(`Unique ${star(build.green.stars)}`)
  if (core.length > 0) lines.push(`Sparks: ${core.join(' / ')}`)

  if (build.whites.length > 0) {
    const whites = build.whites.map((w) => `${data.spark(w.refId)?.name ?? `#${w.refId}`} ${star(w.stars)}`)
    lines.push(`Whites: ${whites.join(', ')}`)
  }

  if (build.wonRaces.length > 0) {
    const races = build.wonRaces.map((id) => data.race(id)?.name ?? `#${id}`)
    lines.push(`Won: ${races.join(', ')}`)
  }

  if (build.memo) lines.push(`Note: ${build.memo}`)
  lines.push('(planned with Sparkline)')
  return lines.join('\n')
}
