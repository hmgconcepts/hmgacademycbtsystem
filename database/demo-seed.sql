-- ============================================================================
-- DEMO SAMPLE DATA — one-call seeding (also available from Admin Data page)
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
      'admin_seed_demo_data',
      'admin_purge_test_results'
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


-- 10.8 One-click demo sample data (Admin Data page) — creates a demo teacher
--      profile mirror, a demo multi-subject exam with real 17-type questions,
--      a demo roster and a few results, so new deployments are never empty.
--      Idempotent: re-running updates the same demo exam instead of duplicating.
CREATE OR REPLACE FUNCTION public.admin_seed_demo_data()
RETURNS TABLE (exam_code TEXT, students_added INTEGER, results_added INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_teacher UUID;
  v_exam_id UUID;
  v_students_added INTEGER := 0;
  v_results_added INTEGER := 0;
  v_demo_code TEXT := 'DEMO101';
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;

  -- demo exam belongs to the requesting admin
  v_teacher := auth.uid();

  INSERT INTO public.exams (teacher_id, code, subject, duration, attempt_limit, is_open, exam_mode,
                            instructions, is_multi_subject, csv_data)
  VALUES (
    v_teacher, v_demo_code,
    'Demonstration Subject|JSS 1|First Term|Intro Demo|Mixed|2025/2026|50',
    10, 3, true, 'open',
    'This is DEMO sample data. Edit or delete it freely — it exists so every screen has something to show.',
    false,
    '[
      {"Question":"What is 7 + 5?","A":"10","B":"11","C":"12","D":"13","CorrectAnswer":"C","Explanation":"7 + 5 = 12. Count up five from seven: 8, 9, 10, 11, 12.","Type":"MCQ","Difficulty":"easy","Tags":"demo,arithmetic"},
      {"Question":"The Earth revolves around the Sun.","A":"True","B":"False","CorrectAnswer":"A","Explanation":"The Earth completes one revolution roughly every 365.25 days, which is why we add a leap day every four years.","Type":"TrueFalse","Difficulty":"easy","Tags":"demo,science"},
      {"Question":"Type the value of 9 x 8.","CorrectAnswer":"72","Type":"ShortAnswer","Tolerance":"0","Explanation":"9 x 8 = 72 (nine rows of eight).","Difficulty":"easy","Tags":"demo,arithmetic"}
    ]'::jsonb
  )
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW(), is_open = true
  RETURNING id INTO v_exam_id;

  -- demo roster (idempotent by student_id)
  INSERT INTO public.students (teacher_id, full_name, student_id, class)
  SELECT v_teacher, s.full_name, s.sid, 'JSS 1 Demo'
  FROM (VALUES
    ('Ada Demo', 'DEMO001'),
    ('Bola Demo', 'DEMO002'),
    ('Chidi Demo', 'DEMO003')
  ) AS s(full_name, sid)
  ON CONFLICT (teacher_id, student_id) DO NOTHING;

  SELECT COUNT(*) INTO v_students_added FROM public.students WHERE teacher_id = v_teacher AND class = 'JSS 1 Demo';

  -- two demo results only if none exist yet for the demo exam
  IF NOT EXISTS (SELECT 1 FROM public.results WHERE exam_id = v_exam_id) THEN
    INSERT INTO public.results (exam_id, student_name, student_class, student_id_ref, score, total,
                                correct_count, wrong_count, skipped_count, time_taken, cert_code, subject_breakdown)
    VALUES
      (v_exam_id, 'Ada Demo', 'JSS 1 Demo', 'DEMO001', 3, 3, 3, 0, 0, 240, '', '{"Demonstration Subject": {"score": 3, "total": 3}}'::jsonb),
      (v_exam_id, 'Bola Demo', 'JSS 1 Demo', 'DEMO002', 2, 3, 2, 1, 0, 300, '', '{"Demonstration Subject": {"score": 2, "total": 3}}'::jsonb);
    v_results_added := 2;
  END IF;

  PERFORM public.log_audit_event('admin_seed_demo_data', 'exam', v_demo_code, jsonb_build_object('students', v_students_added, 'results', v_results_added));
  RETURN QUERY SELECT v_demo_code, v_students_added, v_results_added;
END;
$$;

-- 9.x (legacy numbering kept) Admin Purge Test Results
CREATE OR REPLACE FUNCTION public.admin_purge_test_results(p_exam_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;

  DELETE FROM public.results WHERE exam_id = p_exam_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM public.log_audit_event('admin_purge_test_results', 'exam', p_exam_id::TEXT, jsonb_build_object('deleted_results', v_count));
  RETURN v_count;
END;
$$;

-- SECTION 14 — SEED DATA (all ON CONFLICT DO NOTHING — re-run safe)
-- ============================================================================

-- 14.1 Default institution row
INSERT INTO public.institutions (id, name, tagline, plan, status, primary_color, accent_color)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'HMG Academy CBT Pro',
  'Enterprise Computer-Based Testing & Exam Simulation',
  'enterprise',
  'active',
  '#10b981',
  '#8b5cf6'
)
ON CONFLICT (id) DO NOTHING;

-- 14.2 Heartbeat row (id = 1) — created NOW so sc_keep_alive() has a row to
--      update from the very first second after installation.
INSERT INTO public.sc_heartbeat (id, last_ping, last_source, ping_count)
VALUES (1, NOW(), 'schema-install', 0)
ON CONFLICT (id) DO NOTHING;

-- 14.3 Site license row — defaults to LIFETIME (one-time ownership).
--      The proprietor switches it to a subscription from the License page.
INSERT INTO public.site_license (id, model, plan, status, grace_days)
VALUES (1, 'lifetime', 'One-time purchase (lifetime ownership)', 'active', 7)
ON CONFLICT (id) DO NOTHING;

-- 14.4 Platform settings row — defaults mirror assets/js/app.js defaults.
INSERT INTO public.platform_settings (id, institution_name)
VALUES (1, 'HMG Academy CBT Pro')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================


-- Convenience one-liners (run in the Supabase SQL Editor):
--   Seed / refresh demo data:   SELECT public.admin_seed_demo_data();
--   Remove demo test results:   SELECT public.admin_purge_test_results('<exam-uuid>');

COMMIT;
