-- CreateTable
CREATE TABLE "GradeSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "grade" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradeSnapshot_userId_courseId_capturedAt_idx" ON "GradeSnapshot"("userId", "courseId", "capturedAt");

-- CreateIndex
CREATE INDEX "GradeSnapshot_userId_capturedAt_idx" ON "GradeSnapshot"("userId", "capturedAt");

-- CreateIndex
CREATE INDEX "AssignmentNote_userId_assignmentId_position_idx" ON "AssignmentNote"("userId", "assignmentId", "position");

-- AddForeignKey
ALTER TABLE "GradeSnapshot" ADD CONSTRAINT "GradeSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeSnapshot" ADD CONSTRAINT "GradeSnapshot_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentNote" ADD CONSTRAINT "AssignmentNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentNote" ADD CONSTRAINT "AssignmentNote_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================================================
-- RLS for the two tables added above. Every table in this schema carries
-- policies from the migration that creates it (FOUNDATION.md: "RLS on every
-- table from migration #1"). Without these, app_user has table grants from
-- migration 0002's ALTER DEFAULT PRIVILEGES but zero policies, which means
-- RLS denies everything and the Study tab silently returns nothing.
-- =========================================================================

ALTER TABLE "GradeSnapshot"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssignmentNote" ENABLE ROW LEVEL SECURITY;

-- GradeSnapshot: own rows only, and append-only for the app.
--
-- This table is the fix for grades having lived on the shared Course row, where
-- one student's score was visible to every classmate in the same Canvas course.
-- The whole point is per-user isolation, so SELECT is strictly own-row.
--
-- No UPDATE or DELETE policy: a grade reading is a historical fact. Corrections
-- arrive as a new row. (Grants still permit it — the FERPA delete path needs the
-- cascade — but with no policy, app_user cannot reach these rows either way.)
CREATE POLICY grade_snapshot_select ON "GradeSnapshot" FOR SELECT TO app_user
  USING ("userId" = public.current_user_id());
CREATE POLICY grade_snapshot_insert ON "GradeSnapshot" FOR INSERT TO app_user
  WITH CHECK ("userId" = public.current_user_id());

-- AssignmentNote: student-authored content, own rows only across all CRUD.
CREATE POLICY assignment_note_select ON "AssignmentNote" FOR SELECT TO app_user
  USING ("userId" = public.current_user_id());
CREATE POLICY assignment_note_insert ON "AssignmentNote" FOR INSERT TO app_user
  WITH CHECK ("userId" = public.current_user_id());
CREATE POLICY assignment_note_update ON "AssignmentNote" FOR UPDATE TO app_user
  USING ("userId" = public.current_user_id())
  WITH CHECK ("userId" = public.current_user_id());
CREATE POLICY assignment_note_delete ON "AssignmentNote" FOR DELETE TO app_user
  USING ("userId" = public.current_user_id());
