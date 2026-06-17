// Canvas token storage. The ciphertext is the Milestone D module's format:
// `v2:<base64url(iv‖tag‖ciphertext)>` — NOT the colon-delimited hex that an
// older CanvasToken schema comment described. AAD binds each token to its user
// (Decision F1), so a stolen ciphertext can't be decrypted under another user.

import { prisma } from '@/lib/db/prisma'
import { encrypt, decrypt } from '@/lib/crypto/encryption'
import { audit } from '@/lib/audit/audit'
import { EVENTS } from '@/lib/analytics/events'

export async function saveToken(userId: string, plaintext: string): Promise<void> {
  const encryptedToken = encrypt(plaintext, { aad: userId })
  await prisma.canvasToken.upsert({
    where: { userId },
    create: { userId, encryptedToken },
    update: { encryptedToken, rotatedAt: new Date() },
  })
  await audit.log({
    action: EVENTS.canvas.token_encrypted,
    actorUserId: userId,
    targetType: 'CanvasToken',
  })
}

/**
 * Decrypt the user's Canvas token. Returns null if none is stored. Throws if the
 * stored ciphertext fails to decrypt (corruption / AAD mismatch). Every
 * successful decryption is audited (Decision D1).
 */
export async function getDecryptedToken(userId: string): Promise<string | null> {
  const row = await prisma.canvasToken.findUnique({
    where: { userId },
    select: { encryptedToken: true },
  })
  if (!row) return null

  const token = decrypt(row.encryptedToken, { aad: userId })
  await audit.log({
    action: EVENTS.canvas.token_decrypted,
    actorUserId: userId,
    targetType: 'CanvasToken',
  })
  return token
}
