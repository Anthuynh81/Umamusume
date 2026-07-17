/**
 * Byte-level primitives for the share-URL codec: LEB128 varints, UTF-8
 * strings, and base64url. Byte-aligned by design — simple to debug and to
 * keep stable as a public format.
 */

export class ByteWriter {
  private buf: number[] = []

  u8(v: number): void {
    this.buf.push(v & 0xff)
  }

  /** Unsigned LEB128. */
  varint(v: number): void {
    if (!Number.isInteger(v) || v < 0) throw new Error(`varint expects a non-negative integer, got ${v}`)
    while (v >= 0x80) {
      this.buf.push((v & 0x7f) | 0x80)
      v = Math.floor(v / 128)
    }
    this.buf.push(v)
  }

  bytes(b: Uint8Array): void {
    for (const x of b) this.buf.push(x)
  }

  /** Length-prefixed UTF-8. */
  utf8(s: string): void {
    const b = new TextEncoder().encode(s)
    this.varint(b.length)
    this.bytes(b)
  }

  u32le(v: number): void {
    this.u8(v)
    this.u8(v >>> 8)
    this.u8(v >>> 16)
    this.u8(v >>> 24)
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.buf)
  }
}

export class DecodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DecodeError'
  }
}

export class ByteReader {
  private i = 0
  private readonly buf: Uint8Array

  constructor(buf: Uint8Array) {
    this.buf = buf
  }

  get remaining(): number {
    return this.buf.length - this.i
  }

  u8(): number {
    const v = this.buf[this.i]
    if (v === undefined) throw new DecodeError('unexpected end of data')
    this.i++
    return v
  }

  varint(): number {
    let shift = 0
    let out = 0
    for (;;) {
      const b = this.u8()
      out += (b & 0x7f) * 2 ** shift
      if ((b & 0x80) === 0) break
      shift += 7
      if (shift > 35) throw new DecodeError('varint too long')
    }
    if (!Number.isSafeInteger(out)) throw new DecodeError('varint out of range')
    return out
  }

  bytes(n: number): Uint8Array {
    if (this.remaining < n) throw new DecodeError('unexpected end of data')
    const s = this.buf.subarray(this.i, this.i + n)
    this.i += n
    return s
  }

  utf8(): string {
    return new TextDecoder().decode(this.bytes(this.varint()))
  }

  u32le(): number {
    return this.u8() + this.u8() * 0x100 + this.u8() * 0x10000 + this.u8() * 0x1000000
  }
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new DecodeError('invalid base64url input')
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  let bin: string
  try {
    bin = atob(b64)
  } catch {
    throw new DecodeError('invalid base64url input')
  }
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
