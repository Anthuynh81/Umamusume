import { describe, expect, it } from 'vitest'
import { DecodeError, fromBase64Url, toBase64Url } from './bits'
import { decodeTree, encodeTree } from './serialize'
import { emptyBuild, emptyTree, slotPairKey } from './types'
import type { Tree } from './types'

/** Deterministic kitchen-sink tree exercising every field of the format. */
function goldenTree(): Tree {
  const tree = emptyTree()

  const trainee = emptyBuild(100101)
  trainee.blue = { stat: 'speed', stars: 3 }
  trainee.pink = { aptitude: 'dirt', stars: 2 }
  trainee.green = { stars: 1 }
  trainee.memo = 'ace — ダート育成'
  tree.slots[0] = trainee

  const parent = emptyBuild(100501)
  parent.blue = { stat: 'stamina', stars: 2 }
  parent.pink = { aptitude: 'long', stars: 3 }
  parent.whites = [
    { kind: 'skill', refId: 200342, stars: 3 },
    { kind: 'race', refId: 1101, stars: 1 },
    { kind: 'scenario', refId: 2, stars: 2 },
  ]
  parent.wonRaces = [1101, 1105, 1301]
  parent.status = 'farmed'
  tree.slots[1] = parent

  const rental = emptyBuild(100801)
  rental.status = 'rental'
  tree.slots[2] = rental

  const gp = emptyBuild(100101) // trainee as her own grandparent (legal)
  gp.pink = { aptitude: 'end', stars: 1 }
  tree.slots[5] = gp

  const deep = emptyBuild(101502)
  deep.blue = { stat: 'wit', stars: 1 }
  tree.slots[30] = deep

  tree.extraWins[slotPairKey(2, 1)] = 4
  return tree
}

describe('base64url', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = Uint8Array.from({ length: 300 }, (_, i) => (i * 7 + 3) % 256)
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes)
  })

  it('rejects non-base64url characters', () => {
    expect(() => fromBase64Url('abc+/=')).toThrow(DecodeError)
  })
})

describe('tree codec v1', () => {
  it('round-trips an empty tree', () => {
    expect(decodeTree(encodeTree(emptyTree()))).toEqual(emptyTree())
  })

  it('round-trips the kitchen-sink tree exactly', () => {
    const tree = goldenTree()
    expect(decodeTree(encodeTree(tree))).toEqual(tree)
  })

  it('round-trips a fully populated 31-slot tree', () => {
    const tree = emptyTree()
    for (let i = 0; i < 31; i++) {
      const build = emptyBuild(100001 + i)
      build.blue = { stat: 'power', stars: ((i % 3) + 1) as 1 | 2 | 3 }
      build.whites = [{ kind: 'skill', refId: 200000 + i, stars: 2 }]
      tree.slots[i] = build
    }
    expect(decodeTree(encodeTree(tree))).toEqual(tree)
  })

  it('golden vector: byte layout is pinned (format is a public contract)', () => {
    expect(encodeTree(goldenTree())).toMatchInlineSnapshot(`"AScAAECFjgYPEBEAABdhY2Ug4oCUIOODgOODvOODiOiCsuaIkJWRBjMJJQMIlp0MAc0IBgIDzQgExAHBkwZgAIWOBgIJAP6YBgEEAAEBAgQ"`)
  })

  it('rejects unknown versions', () => {
    const bytes = fromBase64Url(encodeTree(emptyTree()))
    bytes[0] = 2
    expect(() => decodeTree(toBase64Url(bytes))).toThrow(/version/)
  })

  it('rejects trailing data', () => {
    const bytes = fromBase64Url(encodeTree(emptyTree()))
    const extended = new Uint8Array([...bytes, 0])
    expect(() => decodeTree(toBase64Url(extended))).toThrow(/trailing/)
  })

  it('rejects truncated data', () => {
    const full = fromBase64Url(encodeTree(goldenTree()))
    expect(() => decodeTree(toBase64Url(full.subarray(0, 12)))).toThrow(DecodeError)
  })

  it('rejects garbage input', () => {
    expect(() => decodeTree('not a share link!')).toThrow(DecodeError)
    expect(() => decodeTree('')).toThrow(DecodeError)
  })

  it('drops zero-count extra-win entries on encode', () => {
    const tree = emptyTree()
    tree.extraWins['1-2'] = 0
    expect(decodeTree(encodeTree(tree)).extraWins).toEqual({})
  })
})
