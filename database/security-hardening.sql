-- ============================================================================
-- SECURITY HARDENING — admin-guard helper functions + full RLS policy set
--   Maintenance EXTRACT from complete-schema.sql — everything here is already
--   inside the master file. Run this ONLY to repair/inspect one subsystem on an
--   existing installation without touching anything else. All statements are
--   idempotent, so re-running is safe.
--   New installs: run database/complete-schema.sql ONCE and you are done.
-- ============================================================================
BEGIN;
/* -- module function reset: drop this module's functions in ANY historical
   -- signature before recreating them (prevents 42P13 return-type errors on
   -- upgraded installs). CASCADE is safe: this module recreates everything it
   -- owns below, and no data is touched. */
DO $modulereset$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
      'is_platform_admin',
      'is_platform_owner',
      'is_owner',
      'get_exam_teacher_id',
      'is_exam_open_for_submission'
      )
  LOOP
    BEGIN
      EXECUTE 'DROP FUNCTION ' || fn.signature || ' CASCADE';
      RAISE NOTICE 'module reset: dropped %', fn.signature;
    EXCEPTION WHEN undefined_function THEN NULL;
              WHEN dependent_objects_still_exist THEN NULL;
    END;
  END LOOP;
END
$modulereset$;


CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role IN ('super_admin', 'admin') OR is_admin = true)
      AND status = 'active'
  );
$$;

-- 5.2 Check Platform Owner (super_admin only — used by destructive RPCs:
--      purge, table delete, archive restore, license writes)
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND status = 'active'
  );
$$;

-- 5.3 Check the authenticated user owns an object (storage policies)
CREATE OR REPLACE FUNCTION public.is_owner(p_owner UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() = p_owner;
$$;

-- 5.4 Get Exam Teacher ID
CREATE OR REPLACE FUNCTION public.get_exam_teacher_id(p_exam_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT teacher_id FROM public.exams WHERE id = p_exam_id;
$$;

-- 5.5 Check If Exam Open for Submission
CREATE OR REPLACE FUNCTION public.is_exam_open_for_submission(p_exam_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.exams
    WHERE id = p_exam_id
      AND is_open = true
      AND is_archived = false
      AND (close_at IS NULL OR close_at > NOW())
      AND (start_at IS NULL OR start_at <= NOW())
  );
$$;

-- 5.6 Audit Logger (callable by any authenticated user; anonymous events
--      are tagged 'system')

-- SECTION 11 — ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Every policy is dropped-then-recreated so this file stays safe to re-run.
-- RLS is ENABLED on every table; the heartbeat table has NO policies at all
-- (it is only reachable through the sc_keep_alive() RPC).

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_license ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sc_heartbeat ENABLE ROW LEVEL SECURITY;

-- 11.1 Institutions
DROP POLICY IF EXISTS "Public read institutions" ON public.institutions;
CREATE POLICY "Public read institutions" ON public.institutions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage institutions" ON public.institutions;
CREATE POLICY "Admins manage institutions" ON public.institutions FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- 11.2 Profiles
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_platform_admin());

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- 11.3 Exams
DROP POLICY IF EXISTS "Teachers view own exams" ON public.exams;
CREATE POLICY "Teachers view own exams" ON public.exams FOR SELECT
  USING (auth.uid() = teacher_id OR public.is_platform_admin());

DROP POLICY IF EXISTS "Teachers insert own exams" ON public.exams;
CREATE POLICY "Teachers insert own exams" ON public.exams FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers update own exams" ON public.exams;
CREATE POLICY "Teachers update own exams" ON public.exams FOR UPDATE
  USING (auth.uid() = teacher_id OR public.is_platform_admin())
  WITH CHECK (auth.uid() = teacher_id OR public.is_platform_admin());

DROP POLICY IF EXISTS "Teachers delete own exams" ON public.exams;
CREATE POLICY "Teachers delete own exams" ON public.exams FOR DELETE
  USING (auth.uid() = teacher_id OR public.is_platform_admin());

-- 11.4 Results
DROP POLICY IF EXISTS "Teachers view results for own exams" ON public.results;
CREATE POLICY "Teachers view results for own exams" ON public.results FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.exams WHERE exams.id = results.exam_id AND (exams.teacher_id = auth.uid() OR public.is_platform_admin()))
);

DROP POLICY IF EXISTS "Teachers delete results for own exams" ON public.results;
CREATE POLICY "Teachers delete results for own exams" ON public.results FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.exams WHERE exams.id = results.exam_id AND (exams.teacher_id = auth.uid() OR public.is_platform_admin()))
);

-- 11.5 Students
DROP POLICY IF EXISTS "Teachers manage own student roster" ON public.students;
CREATE POLICY "Teachers manage own student roster" ON public.students FOR ALL
  USING (auth.uid() = teacher_id OR public.is_platform_admin())
  WITH CHECK (auth.uid() = teacher_id OR public.is_platform_admin());

-- 11.6 Audit Logs (insert allowed for authenticated users through RLS too —
--      log_audit_event() is the primary path and works pre-auth as 'system')
DROP POLICY IF EXISTS "Admins view audit logs" ON public.audit_logs;
CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Users insert audit logs" ON public.audit_logs;
CREATE POLICY "Users insert audit logs" ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- 11.7 System Backups
DROP POLICY IF EXISTS "Admins manage system backups" ON public.system_backups;
CREATE POLICY "Admins manage system backups" ON public.system_backups FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- 11.8 Site License — public read (lock screen renders pre-login),
--      admin write (the save_site_license RPC additionally requires OWNER)
DROP POLICY IF EXISTS "Public read site license" ON public.site_license;
CREATE POLICY "Public read site license" ON public.site_license FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins write site license" ON public.site_license;
CREATE POLICY "Admins write site license" ON public.site_license FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- 11.9 Platform Settings — public read (login-page branding + lockdown
--      notice + license state; contains no secrets), admin write.
DROP POLICY IF EXISTS "Public read platform settings" ON public.platform_settings;
CREATE POLICY "Public read platform settings" ON public.platform_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins write platform settings" ON public.platform_settings;
CREATE POLICY "Admins write platform settings" ON public.platform_settings FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- 11.10 Heartbeat — intentionally NO policies: direct table access is denied
--      to everyone; only the SECURITY DEFINER RPC can touch it.
REVOKE ALL ON TABLE public.sc_heartbeat FROM anon, authenticated;

-- ============================================================================

COMMIT;
