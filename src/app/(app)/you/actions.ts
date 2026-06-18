'use server'

import { requireUser } from '@/lib/auth/session'
import { deleteUserCompletely } from '@/lib/user/deleteUserCompletely'

// Authorization boundary for the FERPA delete: only ever deletes the CALLER's own
// account (session.user.id), never a client-supplied id. deleteUserCompletely
// uses the service-role client, so this guard is what protects it.
export async function deleteAccount(): Promise<{ ok: boolean }> {
  const session = await requireUser()
  await deleteUserCompletely(session.user.id)
  return { ok: true }
}
