/**
 * Held-skill helpers: mapping a library uma's learned skills to spark
 * factors and generation tiers.
 */
import type { WhiteTier } from '../data/config/rates'
import type { GameData } from '../data/types'
import type { LibraryUma } from '../model/library'

export interface HeldSkill {
  id: number
  level: number
}

/** Held skills of a library entry (levels default to 1 for old imports). */
export function heldSkillsOf(uma: LibraryUma): HeldSkill[] {
  if (uma.heldSkills && uma.heldSkills.length > 0) return uma.heldSkills
  return uma.skillIds.map((id) => ({ id, level: 1 }))
}

const TIER_RANK: Record<WhiteTier, number> = { normal: 0, circle: 1, gold: 2 }

/**
 * The best version of a spark factor's skill group this uma holds — the
 * "tier held" input for white-spark generation odds. Null = she doesn't
 * hold any version (the spark can't generate for her at all).
 */
export function bestHeldTier(
  held: HeldSkill[],
  factorId: number,
  data: GameData,
): WhiteTier | null {
  let best: WhiteTier | null = null
  for (const h of held) {
    const skill = data.skill(h.id)
    if (!skill || skill.factorId !== factorId) continue
    if (skill.tier === 'unique' || skill.tier === 'other') continue
    if (best === null || TIER_RANK[skill.tier] > TIER_RANK[best]) best = skill.tier
  }
  return best
}
