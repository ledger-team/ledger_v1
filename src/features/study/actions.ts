'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/session'
import { withSession } from '@/lib/db/withSession'
import { logger } from '@/lib/log/logger'
import { EVENTS } from '@/lib/analytics/events'

// Notes are student-authored, so every mutation runs through withSession and is
// scoped to session.user.id in the WHERE as well. RLS catches a missed filter;
// it is not a substitute for writing one.

const Body = z.string().trim().min(1, 'Write something first').max(500)

export type NoteResult = { ok: boolean; error?: string }

export async function addNote(assignmentId: string, body: string): Promise<NoteResult> {
  const session = await requireUser()
  const parsed = Body.safeParse(body)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message }

  await withSession(
    { user_id: session.user.id, school_id: session.user.schoolId ?? null },
    async (tx) => {
      // Append to the end of this user's list for this assignment.
      const last = await tx.assignmentNote.findFirst({
        where: { userId: session.user.id, assignmentId },
        orderBy: { position: 'desc' },
        select: { position: true },
      })
      await tx.assignmentNote.create({
        data: {
          userId: session.user.id,
          assignmentId,
          body: parsed.data,
          position: (last?.position ?? -1) + 1,
        },
      })
    },
  )

  logger.info({ event: EVENTS.study.note_added, userId: session.user.id, assignmentId }, 'note added')
  revalidatePath(`/assignment/${assignmentId}`)
  return { ok: true }
}

export async function toggleNote(noteId: string, assignmentId: string): Promise<NoteResult> {
  const session = await requireUser()

  await withSession(
    { user_id: session.user.id, school_id: session.user.schoolId ?? null },
    async (tx) => {
      const note = await tx.assignmentNote.findFirst({
        where: { id: noteId, userId: session.user.id },
        select: { done: true },
      })
      if (!note) return
      await tx.assignmentNote.updateMany({
        where: { id: noteId, userId: session.user.id },
        data: { done: !note.done },
      })
    },
  )

  revalidatePath(`/assignment/${assignmentId}`)
  return { ok: true }
}

export async function deleteNote(noteId: string, assignmentId: string): Promise<NoteResult> {
  const session = await requireUser()

  await withSession(
    { user_id: session.user.id, school_id: session.user.schoolId ?? null },
    async (tx) => {
      await tx.assignmentNote.deleteMany({ where: { id: noteId, userId: session.user.id } })
    },
  )

  revalidatePath(`/assignment/${assignmentId}`)
  return { ok: true }
}
