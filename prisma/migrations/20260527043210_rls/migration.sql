-- =========================================================================
-- 0002_rls — Row Level Security
--
-- Enables RLS on every public table, creates the non-superuser `app_user`
-- role that runtime queries execute as, and writes per-table policies.
-- See docs/db/SCHEMA.md § "RLS policies" for the full policy summary.
--
-- Runtime contract: every server action calls withSession() in
-- src/lib/db/withSession.ts, which opens a transaction and runs:
--   SET LOCAL ROLE app_user;
--   SET LOCAL request.jwt.claims = '{"user_id":"...","school_id":"..."}';
-- RLS policies read those claims via the helper functions defined below.
--
-- The default Prisma connection (postgres superuser) bypasses RLS.
-- NextAuth's adapter, this migration, and prisma/seed.ts all rely on that.
-- =========================================================================

-- -----------------------------------------------------------------------
-- 1. App role
-- -----------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END $$;

-- The postgres superuser must be a member of app_user so SET ROLE app_user
-- succeeds from a connection authenticated as postgres.
GRANT app_user TO postgres;

-- Floor privileges; RLS policies define the actual access pattern.
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Append-only enforcement on AuditLog. UPDATE/DELETE revoked entirely —
-- even a SQL injection bug can't mutate audit history under app_user.
REVOKE UPDATE, DELETE ON "AuditLog" FROM app_user;

-- -----------------------------------------------------------------------
-- 2. JWT claim reader helpers
-- -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS text
  LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'user_id'
$$;

CREATE OR REPLACE FUNCTION public.current_school_id() RETURNS text
  LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'school_id'
$$;

-- -----------------------------------------------------------------------
-- 3. Enable RLS on every table
-- -----------------------------------------------------------------------

ALTER TABLE "User"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "School"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CanvasToken"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Course"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Section"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enrollment"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assignment"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Post"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reaction"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudyGuide"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyLimit"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog"          ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 4. Policies — per-command for clarity. A missing policy = denied.
-- -----------------------------------------------------------------------

-- User: own row only. INSERT is service-role (NextAuth adapter).
CREATE POLICY user_select ON "User" FOR SELECT TO app_user
  USING (id = public.current_user_id());
CREATE POLICY user_update ON "User" FOR UPDATE TO app_user
  USING (id = public.current_user_id())
  WITH CHECK (id = public.current_user_id());
CREATE POLICY user_delete ON "User" FOR DELETE TO app_user
  USING (id = public.current_user_id());

-- Account / Session: SELECT scoped to own user; writes via service role.
CREATE POLICY account_select ON "Account" FOR SELECT TO app_user
  USING ("userId" = public.current_user_id());
CREATE POLICY session_select ON "Session" FOR SELECT TO app_user
  USING ("userId" = public.current_user_id());
-- VerificationToken: no policies → app_user has no access. NextAuth uses service role.

-- School: any authenticated user can see all schools (onboarding dropdown).
CREATE POLICY school_select ON "School" FOR SELECT TO app_user
  USING (public.current_user_id() IS NOT NULL);

-- CanvasToken: own-row-only across all CRUD.
CREATE POLICY canvas_token_select ON "CanvasToken" FOR SELECT TO app_user
  USING ("userId" = public.current_user_id());
CREATE POLICY canvas_token_insert ON "CanvasToken" FOR INSERT TO app_user
  WITH CHECK ("userId" = public.current_user_id());
CREATE POLICY canvas_token_update ON "CanvasToken" FOR UPDATE TO app_user
  USING ("userId" = public.current_user_id())
  WITH CHECK ("userId" = public.current_user_id());
CREATE POLICY canvas_token_delete ON "CanvasToken" FOR DELETE TO app_user
  USING ("userId" = public.current_user_id());

-- Course: SELECT requires enrollment in a section of this course.
-- INSERT/UPDATE gated on schoolId = current_school_id() — solves the
-- sync chicken-and-egg (sync writes the Course before the Enrollment exists).
CREATE POLICY course_select ON "Course" FOR SELECT TO app_user
  USING (EXISTS (
    SELECT 1
    FROM "Enrollment" e
    JOIN "Section" s ON s.id = e."sectionId"
    WHERE s."courseId" = "Course".id
      AND e."userId" = public.current_user_id()
  ));
CREATE POLICY course_insert ON "Course" FOR INSERT TO app_user
  WITH CHECK ("schoolId" = public.current_school_id());
CREATE POLICY course_update ON "Course" FOR UPDATE TO app_user
  USING ("schoolId" = public.current_school_id())
  WITH CHECK ("schoolId" = public.current_school_id());

-- Section: SELECT requires enrollment in this section.
CREATE POLICY section_select ON "Section" FOR SELECT TO app_user
  USING (EXISTS (
    SELECT 1 FROM "Enrollment" e
    WHERE e."sectionId" = "Section".id
      AND e."userId" = public.current_user_id()
  ));
CREATE POLICY section_insert ON "Section" FOR INSERT TO app_user
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Course" c
    WHERE c.id = "Section"."courseId"
      AND c."schoolId" = public.current_school_id()
  ));
CREATE POLICY section_update ON "Section" FOR UPDATE TO app_user
  USING (EXISTS (
    SELECT 1 FROM "Course" c
    WHERE c.id = "Section"."courseId"
      AND c."schoolId" = public.current_school_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Course" c
    WHERE c.id = "Section"."courseId"
      AND c."schoolId" = public.current_school_id()
  ));

-- Enrollment: own only.
CREATE POLICY enrollment_select ON "Enrollment" FOR SELECT TO app_user
  USING ("userId" = public.current_user_id());
CREATE POLICY enrollment_insert ON "Enrollment" FOR INSERT TO app_user
  WITH CHECK ("userId" = public.current_user_id());
CREATE POLICY enrollment_delete ON "Enrollment" FOR DELETE TO app_user
  USING ("userId" = public.current_user_id());

-- Assignment: SELECT via enrollment chain; INSERT/UPDATE within own school.
CREATE POLICY assignment_select ON "Assignment" FOR SELECT TO app_user
  USING (EXISTS (
    SELECT 1
    FROM "Enrollment" e
    JOIN "Section" s ON s.id = e."sectionId"
    WHERE s."courseId" = "Assignment"."courseId"
      AND e."userId" = public.current_user_id()
  ));
CREATE POLICY assignment_insert ON "Assignment" FOR INSERT TO app_user
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Course" c
    WHERE c.id = "Assignment"."courseId"
      AND c."schoolId" = public.current_school_id()
  ));
CREATE POLICY assignment_update ON "Assignment" FOR UPDATE TO app_user
  USING (EXISTS (
    SELECT 1 FROM "Course" c
    WHERE c.id = "Assignment"."courseId"
      AND c."schoolId" = public.current_school_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Course" c
    WHERE c.id = "Assignment"."courseId"
      AND c."schoolId" = public.current_school_id()
  ));

-- Post / Reaction: deny-all in Phase 0. No policies = no access.
-- (RLS is enabled; with zero permissive policies, app_user sees zero rows
--  and cannot write. Policies open up when each social feature ships.)

-- Report: own only. Insert + read; updates/deletes via service role.
CREATE POLICY report_select ON "Report" FOR SELECT TO app_user
  USING ("reporterId" = public.current_user_id());
CREATE POLICY report_insert ON "Report" FOR INSERT TO app_user
  WITH CHECK ("reporterId" = public.current_user_id());

-- StudyGuide: own only.
CREATE POLICY study_guide_select ON "StudyGuide" FOR SELECT TO app_user
  USING ("userId" = public.current_user_id());
CREATE POLICY study_guide_insert ON "StudyGuide" FOR INSERT TO app_user
  WITH CHECK ("userId" = public.current_user_id());
CREATE POLICY study_guide_update ON "StudyGuide" FOR UPDATE TO app_user
  USING ("userId" = public.current_user_id())
  WITH CHECK ("userId" = public.current_user_id());
CREATE POLICY study_guide_delete ON "StudyGuide" FOR DELETE TO app_user
  USING ("userId" = public.current_user_id());

-- DailyLimit: own only.
CREATE POLICY daily_limit_select ON "DailyLimit" FOR SELECT TO app_user
  USING ("userId" = public.current_user_id());
CREATE POLICY daily_limit_insert ON "DailyLimit" FOR INSERT TO app_user
  WITH CHECK ("userId" = public.current_user_id());
CREATE POLICY daily_limit_update ON "DailyLimit" FOR UPDATE TO app_user
  USING ("userId" = public.current_user_id())
  WITH CHECK ("userId" = public.current_user_id());

-- AuditLog: SELECT and INSERT only. UPDATE/DELETE revoked at grant level above.
CREATE POLICY audit_log_select ON "AuditLog" FOR SELECT TO app_user
  USING ("actorUserId" = public.current_user_id());
CREATE POLICY audit_log_insert ON "AuditLog" FOR INSERT TO app_user
  WITH CHECK ("actorUserId" = public.current_user_id());
