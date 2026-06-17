# dashboard

The first real plug-and-play feature (FOUNDATION §Plug-and-Play). Shows the
logged-in student their upcoming Canvas assignments and course grades.

## Files

| File | Purpose |
| --- | --- |
| `queries.ts` | `getDashboardData(session)` — reads via `withSession` (RLS-enforced). Returns the user's enrolled courses (+ grades) and assignments due in the future / last 24h, ordered by `dueAt`. No service-role on reads. |
| `urgency.ts` | Pure logic: `classifyUrgency(dueAt)` → `due_soon`/`this_week`/`normal`; `gradeColor(score)` → tone. |
| `actions.ts` | `generateStudyGuide(assignmentId)` — Phase 0 stub; Phase 1 swaps only the return body. |
| `components/` | `DashboardView` (server, composes), `CourseGrades` (server), `AssignmentCard` (server), `StudyGuideButton` (client). |
| `*.test.ts` | urgency classification (unit), stub action (unit), query isolation (integration). |

The Next route `src/app/(app)/home/page.tsx` is a thin server component that
resolves the session, calls `getDashboardData`, and renders `HomeView`. It lives
inside the `(app)` route group, which provides the persistent nav shell (G2).

## Conventions (PHASE_0_PLAN §6)

- Imports from `src/lib/*` and `src/components/*` only. No cross-feature imports.
- All reads go through `withSession`; isolation is enforced by RLS, not app code.
- Events use the central taxonomy (`EVENTS.dashboard.*`).

## UI

- Mobile-first (390px), single vertical column, no fixed positioning, ≥44px tap
  targets. Dark mode primary via `next-themes` (class strategy) + the brand
  tokens in `globals.css`.
- Urgency: `<24h` rose border + "DUE SOON"; `<72h` amber border + "THIS WEEK";
  else neutral. Grades: ≥90 lime, 80–89 foreground, 70–79 amber, <70 rose.
