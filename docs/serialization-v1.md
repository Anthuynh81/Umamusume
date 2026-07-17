# Share-URL serialization format, version 1

The entire tree state is serialized to bytes, base64url-encoded (no padding),
and carried in the `d` query parameter. **This format is a public contract:**
once links exist in the wild, v1 must keep decoding forever. Changes require a
new version byte and a new decoder branch; never mutate v1 semantics. The
golden-vector test in `src/model/serialize.test.ts` pins the byte layout.

All multi-byte fields are byte-aligned. `varint` = unsigned LEB128.
Tree names are deliberately NOT in the URL — shared trees are anonymous; the
receiver names their own copy when saving locally.

## Layout

| Field | Type | Notes |
|---|---|---|
| version | u8 | `1` |
| filledMask | u32 LE | bit *i* set ⇔ slot *i* present; bits ≥ 31 must be 0 |
| slots | slot × popcount(mask) | ascending slot index; heap order (0 = trainee, children of *i* at 2*i*+1 / 2*i*+2) |
| extraWinCount | varint | manual shared-G1-win overrides |
| extraWins | entry × count | `u8 slotA, u8 slotB, varint wins`; A < B, sorted; wins > 0 |

## Slot

| Field | Type | Notes |
|---|---|---|
| variantId | varint | card/outfit id from static data |
| flags | u8 | see below |
| blue | u8 | if flag bit 0 — bits 0-2 stat index (speed, stamina, power, guts, wit), bits 3-4 stars−1 |
| pink | u8 | if flag bit 1 — bits 0-3 aptitude index (turf, dirt, sprint, mile, medium, long, front, pace, late, end), bits 4-5 stars−1 |
| green | u8 | if flag bit 2 — bits 0-1 stars−1 (skill identity is implied by the variant) |
| whiteCount | varint | always present |
| whites | white × count | `u8 (bits 0-1 kind: skill, race, scenario; bits 2-3 stars−1), varint refId` |
| wonRaces | varint count, then varint × count | if flag bit 4 — race ids, sorted ascending, delta-encoded (first value absolute, then differences) |
| memo | varint byteLen + UTF-8 | if flag bit 3 |

### Slot flags

| Bit | Meaning |
|---|---|
| 0 | blue spark present |
| 1 | pink spark present |
| 2 | green spark present |
| 3 | memo present |
| 4 | wonRaces present |
| 5-6 | slot status: 0 planned, 1 farmed, 2 borrowed, 3 rental |
| 7 | reserved, must be 0 (decoder rejects) |

## Id spaces

`variantId`, white `refId` (skill / race / scenario ids) reference the static
game-data tables shipped with the app and are stable game ids, so links remain
valid across app data updates. If an id is unknown to a newer/older build, the
UI shows an "unknown" chip rather than failing the decode.

## Size expectations

A fully filled 31-slot tree with ~10 white sparks and won-races per slot is
roughly 1.2–1.5 KB of bytes → ~1.6–2 KB of URL, comfortably under practical
URL limits. Typical 7-slot quick-mode shares are under 200 bytes.
