# study

The Study tab, the assignment detail page, and student-authored notes.

## Files

| File | Purpose |
| --- | --- |
| `grades.ts` | Pure grade-history logic. Collapses `GradeSnapshot` rows into a current score, a delta over a window, a trend, and sparkline points. No DB, no React. |
| `weekAhead.ts` | Pure "what does my week look like" logic. Buckets assignments into calendar days, finds the heaviest day, separates overdue work. |
| `queries.ts` | `getStudyData(session)` and `getAssignment(session, id)`. Both read via `withSession` (RLS-enforced). |
| `actions.ts` | Note mutations. `withSession` plus an explicit `userId` filter in every WHERE. |
| `components/` | `StudyView`, `WeekGrid`, `GradeCard`, `Sparkline` (server); `Notes` (client). |
| `*.test.ts` | Unit tests for both pure modules, including the day-boundary and window-edge cases. |

## Why grades live in `GradeSnapshot`

`Course` is unique on `(schoolId, canvasCourseId)`, so **one row is shared by every
student at the school taking that Canvas course**. Writing a per-student grade onto
it means the last student to sync overwrites what all of their classmates see —
wrong numbers, and one student's grade rendered as another's.

`Course.currentGrade` / `currentScore` / `finalGrade` / `finalScore` are marked
deprecated in the schema for exactly this reason. Nothing reads them. Grades are
keyed `(userId, courseId)` in `GradeSnapshot` and appended, never updated.

Sync writes a snapshot only when the score actually moves. Sync runs on every
login, so writing unconditionally would bury real changes under thousands of
identical rows.

**There is no backfill.** History begins at the first sync after this shipped.
The UI says so rather than pretending the line starts earlier.

## Conventions (per `docs/PHASE_0_PLAN.md` §6)

- Imports from `src/lib/*` only. The one exception is `classifyUrgency` from
  `features/dashboard/urgency.ts`, used by the assignment page — if a third
  consumer appears, that helper should move to `src/lib/`.
- All reads and writes through `withSession`. RLS is the backstop for a missed
  `where:`, not a substitute for writing one.
- Events use the central taxonomy (`EVENTS.study.*`), catalogued in
  `docs/observability/EVENTS.md` before being emitted.

## Notes on the assignment page

98% of synced DSHS assignments have an empty or near-empty description (measured
with `scripts/check-assignment-content.ts`). The empty state is therefore the
common case and is designed first; a rich description is the exception. Canvas
HTML is stripped to text and rendered as text — never `dangerouslySetInnerHTML`,
since it is markup we did not author.

A missing assignment and one hidden by RLS both produce a 404. That is deliberate:
an assignment in a course you are not enrolled in should be indistinguishable from
one that does not exist.
