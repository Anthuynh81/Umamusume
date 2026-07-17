import type { GameData } from '../../data/types'
import type { SparkRateRow } from '../../engine/proc'
import { APTITUDE_LABELS, BLUE_STAT_LABELS } from '../../model/types'

export function rowName(row: SparkRateRow, data: GameData): string {
  if (row.color === 'white' && row.refId !== null) return data.spark(row.refId)?.name ?? `#${row.refId}`
  if (row.color === 'green') return row.refId !== null ? (data.uniqueSkill(row.refId)?.name ?? 'Unique') : 'Unique'
  if (row.aptitude) return APTITUDE_LABELS[row.aptitude]
  if (row.stat) return BLUE_STAT_LABELS[row.stat]
  return row.key
}
