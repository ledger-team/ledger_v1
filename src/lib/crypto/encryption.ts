// AES-256-GCM authenticated encryption for secrets at rest (Canvas tokens, etc).
//
// Serialized format (the `v2:` scheme):
//
//   v2:<base64url( IV[12] ‖ authTag[16] ‖ ciphertext[…] )>
//
// The `v2:` prefix is a dispatch tag. `decrypt` reads the version first and
// routes to the matching unpacker, rejecting anything it doesn't recognize.
// This is what makes key rotation / algorithm migration possible later: a
// future `v3:` can be introduced while old `v2:` ciphertext stays decryptable.
// `v2` (not `v1`) deliberately marks this as the v2-app scheme, distinct from
// the prototype.
//
// This module is intentionally PURE: no DB, no audit, no logging. Auditing of
// decryptions lives in the caller that has the actor context (Milestone F's
// `getDecryptedToken()`), per Phase 0 plan Decision D1. Keep it that way so the
// crypto core stays trivially testable and reusable.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const VERSION = 'v2'
const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12 // 96-bit nonce — the GCM-recommended size.
const TAG_BYTES = 16 // 128-bit auth tag.
const KEY_BYTES = 32 // AES-256.

/** Base class for all errors thrown by this module. */
export class CryptoError extends Error {}
/** The serialized input is structurally invalid (bad prefix/encoding/length). */
export class MalformedCiphertextError extends CryptoError {}
/** The version prefix is well-formed but not one we know how to decrypt. */
export class UnsupportedCryptoVersionError extends CryptoError {}
/** Authentication failed: wrong key, corrupted data, or AAD mismatch. */
export class DecryptionError extends CryptoError {}
/** The provided key is not 64 hex chars / 32 bytes. */
export class InvalidKeyError extends CryptoError {}

export type CryptoOptions = {
  /**
   * Additional Authenticated Data. Not encrypted, but bound to the ciphertext:
   * decryption fails unless the same AAD is supplied. Use it to pin a ciphertext
   * to a context (e.g. a user id) so a stolen blob can't be replayed elsewhere.
   */
  aad?: string
}

export type Crypto = {
  encrypt: (plaintext: string, opts?: CryptoOptions) => string
  decrypt: (serialized: string, opts?: CryptoOptions) => string
}

function decodeKey(keyHex: string): Buffer {
  if (!/^[0-9a-fA-F]+$/.test(keyHex)) {
    throw new InvalidKeyError('ENCRYPTION_KEY must be hexadecimal')
  }
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== KEY_BYTES) {
    throw new InvalidKeyError(
      `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (64 hex chars); got ${key.length} bytes`,
    )
  }
  return key
}

/**
 * Build an encrypt/decrypt pair bound to an explicit key. Exposed so key
 * validation and crypto behavior can be unit-tested without touching process
 * env. Application code should use the default `encrypt`/`decrypt` exports.
 */
export function makeCrypto(keyHex: string): Crypto {
  const key = decodeKey(keyHex)

  function encrypt(plaintext: string, opts?: CryptoOptions): string {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(ALGORITHM, key, iv)
    if (opts?.aad) cipher.setAAD(Buffer.from(opts.aad, 'utf8'))
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    const packed = Buffer.concat([iv, tag, ciphertext])
    return `${VERSION}:${packed.toString('base64url')}`
  }

  function decrypt(serialized: string, opts?: CryptoOptions): string {
    const sep = serialized.indexOf(':')
    if (sep === -1) {
      throw new MalformedCiphertextError('missing version prefix')
    }
    const version = serialized.slice(0, sep)
    const body = serialized.slice(sep + 1)

    if (version !== VERSION) {
      throw new UnsupportedCryptoVersionError(`unsupported crypto version: ${version}`)
    }
    // base64url decoding is lenient (it silently drops invalid chars), so guard
    // the alphabet explicitly to make malformed input a deterministic rejection.
    if (!/^[A-Za-z0-9_-]+$/.test(body)) {
      throw new MalformedCiphertextError('body is not valid base64url')
    }

    const packed = Buffer.from(body, 'base64url')
    if (packed.length < IV_BYTES + TAG_BYTES) {
      throw new MalformedCiphertextError('ciphertext too short to contain IV and tag')
    }

    const iv = packed.subarray(0, IV_BYTES)
    const tag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
    const ciphertext = packed.subarray(IV_BYTES + TAG_BYTES)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    if (opts?.aad) decipher.setAAD(Buffer.from(opts.aad, 'utf8'))

    try {
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    } catch {
      // GCM final() throws when the tag doesn't verify. Collapse every failure
      // into one opaque error — never reveal *why* a decrypt failed.
      throw new DecryptionError('decryption failed: authentication tag mismatch or corrupt data')
    }
  }

  return { encrypt, decrypt }
}

// Lazily-constructed default instance bound to process.env.ENCRYPTION_KEY.
// Lazy so importing this module never throws at load time in contexts that
// don't actually encrypt (and so a bad key surfaces only when crypto is used).
let _default: Crypto | null = null
function getDefault(): Crypto {
  if (!_default) {
    const keyHex = process.env.ENCRYPTION_KEY
    if (!keyHex) throw new InvalidKeyError('ENCRYPTION_KEY is not set')
    _default = makeCrypto(keyHex)
  }
  return _default
}

export function encrypt(plaintext: string, opts?: CryptoOptions): string {
  return getDefault().encrypt(plaintext, opts)
}

export function decrypt(serialized: string, opts?: CryptoOptions): string {
  return getDefault().decrypt(serialized, opts)
}
