import { describe, expect, it } from 'vitest'
import {
  DecryptionError,
  InvalidKeyError,
  MalformedCiphertextError,
  UnsupportedCryptoVersionError,
  makeCrypto,
} from './encryption'

// A fixed, valid 64-hex-char (32-byte) key. Pure tests — never touches env.
const KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const c = makeCrypto(KEY)

// Flip one byte of the packed (IV‖tag‖ciphertext) buffer and re-serialize.
function tamper(serialized: string, byteIndex: number): string {
  const body = Buffer.from(serialized.slice(VERSION_PREFIX.length), 'base64url')
  body[byteIndex] ^= 0xff
  return VERSION_PREFIX + body.toString('base64url')
}
const VERSION_PREFIX = 'v2:'

describe('encryption round-trip', () => {
  it.each(['hello world', '', 'unicode: café ☕ 日本語 — ✓', 'x'.repeat(5000)])(
    'decrypts back to the original (%#)',
    (plaintext) => {
      expect(c.decrypt(c.encrypt(plaintext))).toBe(plaintext)
    },
  )

  it('emits the v2: versioned, base64url format', () => {
    expect(c.encrypt('hi')).toMatch(/^v2:[A-Za-z0-9_-]+$/)
  })
})

describe('tamper detection (GCM auth tag)', () => {
  it('rejects auth-tag tampering', () => {
    // Tag occupies bytes 12..27.
    expect(() => c.decrypt(tamper(c.encrypt('secret'), 13))).toThrow(DecryptionError)
  })

  it('rejects ciphertext tampering', () => {
    // Ciphertext begins at byte 28.
    expect(() => c.decrypt(tamper(c.encrypt('a-reasonably-long-secret-value'), 30))).toThrow(
      DecryptionError,
    )
  })

  it('rejects ciphertext encrypted under a different key', () => {
    const other = makeCrypto('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    expect(() => c.decrypt(other.encrypt('secret'))).toThrow(DecryptionError)
  })
})

describe('malformed input rejection', () => {
  it('rejects a missing version prefix', () => {
    expect(() => c.decrypt('no-colon-here')).toThrow(MalformedCiphertextError)
  })

  it('rejects an unsupported version', () => {
    const v1 = 'v1:' + c.encrypt('hi').slice(VERSION_PREFIX.length)
    expect(() => c.decrypt(v1)).toThrow(UnsupportedCryptoVersionError)
  })

  it('rejects a non-base64url body', () => {
    expect(() => c.decrypt('v2:!!! not base64 !!!')).toThrow(MalformedCiphertextError)
  })

  it('rejects a body too short to hold IV + tag', () => {
    const short = Buffer.alloc(10).toString('base64url')
    expect(() => c.decrypt('v2:' + short)).toThrow(MalformedCiphertextError)
  })
})

describe('IV uniqueness', () => {
  it('uses a unique IV (and produces unique ciphertext) across 1000 calls', () => {
    const ivs = new Set<string>()
    const outputs = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const ct = c.encrypt('identical plaintext every time')
      outputs.add(ct)
      ivs.add(Buffer.from(ct.slice(3), 'base64url').subarray(0, 12).toString('hex'))
    }
    expect(ivs.size).toBe(1000)
    expect(outputs.size).toBe(1000)
  })
})

describe('key length validation', () => {
  it('rejects a too-short key', () => {
    expect(() => makeCrypto('abcd')).toThrow(InvalidKeyError)
  })

  it('rejects a non-hex key of the right length', () => {
    expect(() => makeCrypto('z'.repeat(64))).toThrow(InvalidKeyError)
  })

  it('rejects a hex key of the wrong byte length', () => {
    expect(() => makeCrypto('ab'.repeat(31))).toThrow(InvalidKeyError) // 31 bytes
  })

  it('accepts a valid 64-char hex key', () => {
    expect(() => makeCrypto(KEY)).not.toThrow()
  })
})

describe('additional authenticated data (aad)', () => {
  it('round-trips when the aad matches', () => {
    const ct = c.encrypt('canvas-token', { aad: 'user-1' })
    expect(c.decrypt(ct, { aad: 'user-1' })).toBe('canvas-token')
  })

  it('fails when the aad differs', () => {
    const ct = c.encrypt('canvas-token', { aad: 'user-1' })
    expect(() => c.decrypt(ct, { aad: 'user-2' })).toThrow(DecryptionError)
  })

  it('fails when the aad is omitted on decrypt', () => {
    const ct = c.encrypt('canvas-token', { aad: 'user-1' })
    expect(() => c.decrypt(ct)).toThrow(DecryptionError)
  })
})
