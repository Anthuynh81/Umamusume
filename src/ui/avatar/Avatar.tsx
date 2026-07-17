/**
 * Placeholder character avatars: original, deliberately abstract uma-girl
 * silhouettes (no official assets, not traced from art), tinted with the
 * character's theme color. This is the swappable asset layer — replace the
 * body of <Avatar> to move to real images later without touching callers.
 */
import type { CharacterDef } from '../../data/types'

/** Deterministic fallback color for characters without a theme color. */
function hashColor(id: number): string {
  const hue = (id * 137.508) % 360 // golden-angle spacing
  return `hsl(${hue.toFixed(0)} 55% 55%)`
}

/** Three original silhouette shapes, picked by character id. */
function SilhouettePath({ variant }: { variant: number }) {
  switch (variant) {
    case 0: // perky ears, short hair
      return (
        <>
          <polygon points="21,19 25,4 30,17" />
          <polygon points="43,19 39,4 34,17" />
          <circle cx="32" cy="29" r="13.5" />
          <path d="M11 64 Q13 45 32 45 Q51 45 53 64 Z" />
        </>
      )
    case 1: // outward ears, long hair mass
      return (
        <>
          <polygon points="20,20 20,5 29,17" />
          <polygon points="44,20 44,5 35,17" />
          <path d="M18 34 Q15 55 19 64 L45 64 Q49 55 46 34 Z" opacity="0.55" />
          <circle cx="32" cy="28" r="13" />
          <path d="M13 64 Q15 46 32 46 Q49 46 51 64 Z" />
        </>
      )
    default: // tall ears, ponytail
      return (
        <>
          <polygon points="24,17 26,2 31,16" />
          <polygon points="40,17 38,2 33,16" />
          <path d="M44 26 Q54 36 49 56 L43 52 Q46 38 41 32 Z" opacity="0.55" />
          <circle cx="32" cy="29" r="13" />
          <path d="M12 64 Q14 45 32 45 Q50 45 52 64 Z" />
        </>
      )
  }
}

export function Avatar({
  chara,
  size = 40,
  className = '',
}: {
  chara: CharacterDef | undefined
  size?: number
  className?: string
}) {
  const color = chara?.color ?? (chara ? hashColor(chara.id) : '#cbd5e1')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={chara?.name ?? 'Empty slot'}
      className={`shrink-0 rounded-full bg-slate-100 ${className}`}
    >
      {chara ? (
        <g fill={color}>
          <SilhouettePath variant={chara.id % 3} />
        </g>
      ) : (
        <g fill="#cbd5e1">
          <circle cx="32" cy="26" r="12" />
          <path d="M13 64 Q15 45 32 45 Q49 45 51 64 Z" />
        </g>
      )}
    </svg>
  )
}
