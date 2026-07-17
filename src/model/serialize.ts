/**
 * Share-URL codec, format v1. PUBLIC CONTRACT — once share links exist in the
 * wild this format must keep decoding forever. Never change v1 semantics;
 * introduce v2 behind a new leading version byte instead.
 *
 * Spec: docs/serialization-v1.md. The golden-vector test in serialize.test.ts
 * pins the byte layout; if it breaks, you changed the format.
 */
import { ByteReader, ByteWriter, DecodeError, fromBase64Url, toBase64Url } from './bits'
import {
  APTITUDE_KEYS, BLUE_STATS, SLOT_STATUSES, TREE_SLOTS, WHITE_KINDS,
  emptyTree, slotPairKey,
} from './types'
import type {
  AptitudeKey, BlueStat, SlotStatus, Stars, Tree, UmaBuild, WhiteKind, WhiteSpark,
} from './types'

export const FORMAT_VERSION = 1

/** URL query parameter carrying the tree, e.g. sparkline.app/?d=AQAB… */
export const SHARE_PARAM = 'd'

// Slot flag bits (see spec).
const F_BLUE = 1 << 0
const F_PINK = 1 << 1
const F_GREEN = 1 << 2
const F_MEMO = 1 << 3
const F_RACES = 1 << 4
const F_STATUS_SHIFT = 5 // bits 5-6
const F_RESERVED = 1 << 7

export function encodeTree(tree: Tree): string {
  const w = new ByteWriter()
  w.u8(FORMAT_VERSION)

  let mask = 0
  for (let i = 0; i < TREE_SLOTS; i++) if (tree.slots[i]) mask |= 1 << i
  w.u32le(mask >>> 0)

  for (let i = 0; i < TREE_SLOTS; i++) {
    const slot = tree.slots[i]
    if (!slot) continue
    encodeSlot(w, slot)
  }

  const winEntries = Object.entries(tree.extraWins)
    .map(([k, v]) => {
      const [a, b] = k.split('-').map(Number) as [number, number]
      return { a, b, wins: v ?? 0 }
    })
    .filter((e) => e.wins > 0)
    .sort((x, y) => x.a - y.a || x.b - y.b)
  w.varint(winEntries.length)
  for (const { a, b, wins } of winEntries) {
    w.u8(a)
    w.u8(b)
    w.varint(wins)
  }

  return toBase64Url(w.toBytes())
}

function encodeSlot(w: ByteWriter, slot: UmaBuild): void {
  w.varint(slot.variantId)

  let flags = 0
  if (slot.blue) flags |= F_BLUE
  if (slot.pink) flags |= F_PINK
  if (slot.green) flags |= F_GREEN
  if (slot.memo.length > 0) flags |= F_MEMO
  if (slot.wonRaces.length > 0) flags |= F_RACES
  flags |= SLOT_STATUSES.indexOf(slot.status) << F_STATUS_SHIFT
  w.u8(flags)

  if (slot.blue) w.u8(BLUE_STATS.indexOf(slot.blue.stat) | ((slot.blue.stars - 1) << 3))
  if (slot.pink) w.u8(APTITUDE_KEYS.indexOf(slot.pink.aptitude) | ((slot.pink.stars - 1) << 4))
  if (slot.green) w.u8(slot.green.stars - 1)

  w.varint(slot.whites.length)
  for (const white of slot.whites) {
    w.u8(WHITE_KINDS.indexOf(white.kind) | ((white.stars - 1) << 2))
    w.varint(white.refId)
  }

  if (slot.wonRaces.length > 0) {
    const sorted = [...new Set(slot.wonRaces)].sort((x, y) => x - y)
    w.varint(sorted.length)
    let prev = 0
    for (const id of sorted) {
      w.varint(id - prev) // delta-encoded ascending
      prev = id
    }
  }

  if (slot.memo.length > 0) w.utf8(slot.memo)
}

export function decodeTree(encoded: string): Tree {
  const r = new ByteReader(fromBase64Url(encoded))
  const version = r.u8()
  if (version !== FORMAT_VERSION) {
    throw new DecodeError(`unsupported share-link version ${version} (this build reads v${FORMAT_VERSION})`)
  }

  const mask = r.u32le()
  if (mask >= 2 ** TREE_SLOTS) throw new DecodeError('invalid slot mask')

  const tree = emptyTree()
  for (let i = 0; i < TREE_SLOTS; i++) {
    if ((mask & (1 << i)) === 0) continue
    tree.slots[i] = decodeSlot(r)
  }

  const winCount = r.varint()
  for (let k = 0; k < winCount; k++) {
    const a = r.u8()
    const b = r.u8()
    const wins = r.varint()
    if (a >= TREE_SLOTS || b >= TREE_SLOTS || a === b) throw new DecodeError('invalid shared-win pair')
    tree.extraWins[slotPairKey(a, b)] = wins
  }

  if (r.remaining > 0) throw new DecodeError('trailing data after tree')
  return tree
}

function decodeSlot(r: ByteReader): UmaBuild {
  const variantId = r.varint()
  const flags = r.u8()
  if (flags & F_RESERVED) throw new DecodeError('reserved slot flag set')

  const slot: UmaBuild = {
    variantId,
    blue: null,
    pink: null,
    green: null,
    whites: [],
    wonRaces: [],
    memo: '',
    status: statusFromIndex((flags >> F_STATUS_SHIFT) & 0b11),
  }

  if (flags & F_BLUE) {
    const b = r.u8()
    slot.blue = { stat: blueStatFromIndex(b & 0b111), stars: starsFromIndex((b >> 3) & 0b11) }
  }
  if (flags & F_PINK) {
    const b = r.u8()
    slot.pink = { aptitude: aptitudeFromIndex(b & 0b1111), stars: starsFromIndex((b >> 4) & 0b11) }
  }
  if (flags & F_GREEN) {
    slot.green = { stars: starsFromIndex(r.u8() & 0b11) }
  }

  const whiteCount = r.varint()
  for (let k = 0; k < whiteCount; k++) {
    const b = r.u8()
    const white: WhiteSpark = {
      kind: whiteKindFromIndex(b & 0b11),
      stars: starsFromIndex((b >> 2) & 0b11),
      refId: r.varint(),
    }
    slot.whites.push(white)
  }

  if (flags & F_RACES) {
    const n = r.varint()
    let prev = 0
    for (let k = 0; k < n; k++) {
      prev += r.varint()
      slot.wonRaces.push(prev)
    }
  }

  if (flags & F_MEMO) slot.memo = r.utf8()
  return slot
}

function starsFromIndex(i: number): Stars {
  if (i > 2) throw new DecodeError('invalid star count')
  return (i + 1) as Stars
}
function blueStatFromIndex(i: number): BlueStat {
  const v = BLUE_STATS[i]
  if (!v) throw new DecodeError('invalid blue stat')
  return v
}
function aptitudeFromIndex(i: number): AptitudeKey {
  const v = APTITUDE_KEYS[i]
  if (!v) throw new DecodeError('invalid aptitude')
  return v
}
function whiteKindFromIndex(i: number): WhiteKind {
  const v = WHITE_KINDS[i]
  if (!v) throw new DecodeError('invalid white spark kind')
  return v
}
function statusFromIndex(i: number): SlotStatus {
  const v = SLOT_STATUSES[i]
  if (!v) throw new DecodeError('invalid slot status')
  return v
}
