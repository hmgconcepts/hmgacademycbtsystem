-- ============================================================================
-- HMG CBT PRO — ENTERPRISE COMPLETE SCHEMA SQL (v4.0 — Phase 2 Enhancement)
-- ============================================================================
-- ONE FILE. RUN ONCE. NOTHING ELSE NEEDED.
--
-- This single idempotent script installs the ENTIRE platform database:
--   • 10 tables (with schema-evolution guards for older deployments)
--   • 40+ RPC functions (public, student, teacher, admin, heartbeat, archive)
--   • Row Level Security policies on every table
--   • Private "archive-vault" storage bucket (free-tier database offloading)
--   • Keep-alive heartbeat system (sc_heartbeat + sc_keep_alive + pg_cron)
--   • Site license + platform settings subsystems
--   • Indexes, triggers and seed data
--
-- SAFE TO RUN MANY TIMES:
--   • Every table uses      CREATE TABLE IF NOT EXISTS
--   • Every function is dropped (all signatures) then recreated, so
--     upgraded installs never hit the 42P13 return-type conflict
--   • Every policy is       DROP POLICY IF EXISTS → CREATE POLICY
--   • Every trigger is      DROP TRIGGER IF EXISTS → CREATE TRIGGER
--   • Every seed uses       ON CONFLICT DO NOTHING
--   • Older deployments of ANY version are upgraded in place: Section 3.9
--     reconciles every column of every table (ADD COLUMN IF NOT EXISTS) and
--     restores missing UNIQUE constraints — no drift can survive a re-run
--   • Re-running never drops, truncates or loses data.
--
-- HOW TO RUN (Supabase):
--   Dashboard → your project → SQL Editor → New query → paste this WHOLE file
--   → Run. Expect a series of "Success" notices. That is all.
-- ============================================================================

-- ============================================================================
-- SECTION 0 — FUNCTION-LAYER CLEAN REINSTALL (idempotency hardening)
-- ============================================================================
-- WHY THIS EXISTS: CREATE OR REPLACE FUNCTION cannot change the RETURN TYPE or
-- argument list of a function that already exists — PostgreSQL aborts the whole
-- run with:
--     ERROR 42P13: cannot change return type of existing function
--     HINT: Use DROP FUNCTION <name>(<args>) first.
-- Any deployment upgraded from an earlier schema version therefore failed
-- halfway. This section drops EVERY function this script is about to define —
-- in ALL historical signatures — before the script recreates them below.
--
-- SAFETY:
--   • Only functions THIS SCRIPT fully recreates are touched — nothing else.
--   • CASCADE is required because RLS policies and triggers depend on several
--     of them; every policy (Section 11), trigger (Section 13) and storage
--     rule (Section 12) is re-created later in this same run, so nothing is
--     left missing at the end.
--   • Dropping a function never touches its TABLES or DATA.
--   • Per-function exception guards mean a fresh database (no functions yet)
--     sails through with zero errors.
-- ============================================================================

DO $funcreset$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
      'admin_browse_table',
      'admin_bulk_set_profile_status',
      'admin_delete_client_registration',
      'admin_delete_profile',
      'admin_delete_table_rows',
      'admin_get_all_exams',
      'admin_get_all_profiles',
      'admin_get_all_results',
      'admin_get_audit_logs',
      'admin_get_audit_stats',
      'admin_get_drive_backups',
      'admin_get_institutions',
      'admin_get_platform_stats',
      'admin_list_client_registrations',
      'admin_purge_audit_logs',
      'admin_purge_old_results',
      'admin_purge_test_results',
      'admin_restore_archived_rows',
      'admin_seed_demo_data',
      'admin_set_profile_role',
      'admin_set_profile_status',
      'admin_table_stats',
      'admin_upsert_client_registration',
      'list_appeals',
      'list_live_sessions',
      'resolve_appeal',
      'submit_appeal',
      'upsert_live_session',
      'check_exam_code_status',
      'extend_site_license',
      'get_exam_attempt_count',
      'get_exam_teacher_id',
      'get_heartbeat_status',
      'get_public_exam_by_code',
      'get_public_settings',
      'handle_new_user',
      'is_exam_open_for_submission',
      'is_owner',
      'is_platform_admin',
      'is_platform_owner',
      'keep_alive_ping',
      'log_audit_event',
      'log_backup_event',
      'save_platform_settings',
      'save_site_license',
      'sc_keep_alive',
      'submit_student_result',
      'update_updated_at_column',
      'verify_certificate',
      'verify_student_for_exam'
      )
  LOOP
    BEGIN
      EXECUTE 'DROP FUNCTION ' || fn.signature || ' CASCADE';
      RAISE NOTICE 'function layer reset: dropped %', fn.signature;
    EXCEPTION
      WHEN undefined_function THEN NULL;            -- already gone
      WHEN dependent_objects_still_exist THEN NULL; -- recreated below anyway
    END;
  END LOOP;
END
$funcreset$;

-- ============================================================================
-- SECTION 1 — EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION 2 — CORE TABLES
-- ============================================================================

-- 2.1 Institutions (Tenancy & Whitelabel Branding)
CREATE TABLE IF NOT EXISTS public.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'HMG Academy',
  tagline TEXT DEFAULT 'Computer-Based Testing & Learning Solutions',
  slug TEXT UNIQUE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  plan TEXT NOT NULL DEFAULT 'enterprise',
  status TEXT NOT NULL DEFAULT 'active',
  logo_url TEXT DEFAULT '',
  stamp_url TEXT DEFAULT '',
  primary_color TEXT DEFAULT '#10b981',
  accent_color TEXT DEFAULT '#8b5cf6',
  branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  drive_client_id TEXT DEFAULT '',
  drive_folder_id TEXT DEFAULT '',
  drive_sync_enabled BOOLEAN DEFAULT false,
  drive_sync_days INTEGER DEFAULT 7,
  drive_last_backup TIMESTAMPTZ,
  license_token TEXT DEFAULT '',
  license_data JSONB DEFAULT '{}'::jsonb,
  last_keepalive_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 User Profiles & Roles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'teacher', -- 'super_admin', 'admin', 'teacher', 'student'
  is_admin BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'inactive', 'suspended'
  phone TEXT DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Exams & Question Packages (Single & Multi-Subject)
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 45,
  attempt_limit INTEGER NOT NULL DEFAULT 1,
  select_count INTEGER NOT NULL DEFAULT 0,
  is_open BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  exam_mode TEXT NOT NULL DEFAULT 'open', -- 'open' or 'registered'
  negative_mark NUMERIC(6,2) NOT NULL DEFAULT 0,
  release_results BOOLEAN NOT NULL DEFAULT true,
  math_keyboard BOOLEAN NOT NULL DEFAULT false,
  certificate_enabled BOOLEAN NOT NULL DEFAULT false,
  certificate_valid_days INTEGER NOT NULL DEFAULT 0,
  proctoring BOOLEAN NOT NULL DEFAULT false,
  anti_cheat_config JSONB NOT NULL DEFAULT '{"tab_switch":true,"window_blur":true,"copy_paste":true,"right_click":true,"fullscreen":true,"devtools":true,"proctoring":false,"audio":false,"max_violations":5}'::jsonb,
  instructions TEXT DEFAULT '',
  is_multi_subject BOOLEAN NOT NULL DEFAULT false,
  adaptive BOOLEAN NOT NULL DEFAULT false,          -- Phase 10: adaptive difficulty delivery
  feedback_mode TEXT NOT NULL DEFAULT 'end',        -- 'end' | 'immediate' (practice mode)
  score_model TEXT NOT NULL DEFAULT 'standard',     -- 'standard' (%) | 'utme400' (UTME /400 aggregate)
  subjects_data JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of [{subject_name, count, csv_data, passmark}]
  csv_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_at TIMESTAMPTZ,
  close_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 Candidate Results & Submissions
CREATE TABLE IF NOT EXISTS public.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_class TEXT NOT NULL DEFAULT '',
  student_id_ref TEXT DEFAULT '',
  student_type TEXT DEFAULT 'open',
  score NUMERIC(10,2) NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  wrong_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  attempt_number INTEGER DEFAULT 1,
  time_taken INTEGER DEFAULT 0,
  answers_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  subject_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb, -- Multi-subject score breakdown
  violations INTEGER DEFAULT 0,
  violation_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  proctor_data JSONB,
  cert_code TEXT NOT NULL DEFAULT '',
  is_released BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 Registered Students Roster
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extra_time_pct INTEGER NOT NULL DEFAULT 0,        -- Phase 10: approved accommodation, % extra exam time (0/25/50/100)
  accommodation_note TEXT DEFAULT '',               -- Phase 10: private note for the teacher (never shown to candidates)
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  class TEXT NOT NULL DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, student_id)
);

-- 2.6 Audit & Activity Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT DEFAULT '',
  entity_id TEXT DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hint TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.7 System Backups & Drive Sync History
CREATE TABLE IF NOT EXISTS public.system_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  backup_name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google_drive', -- 'google_drive', 'local_json', 'envelope'
  drive_file_id TEXT DEFAULT '',
  drive_file_url TEXT DEFAULT '',
  file_size_bytes BIGINT DEFAULT 0,
  total_records INTEGER DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.8 Keep-Alive Heartbeat (FREE-TIER PROTECTION — Layer 0, table)
--     One single row touched by every keep-alive layer. Supabase pauses
--     free projects after ~7 days without REAL database activity, so each
--     heartbeat performs a genuine UPDATE through sc_keep_alive().
CREATE TABLE IF NOT EXISTS public.sc_heartbeat (
  id          INTEGER PRIMARY KEY,
  last_ping   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_source TEXT,
  ping_count  BIGINT NOT NULL DEFAULT 0
);

-- 2.9 Site License (Subscription / Lifetime state, row id = 1)
--     Readable pre-login (RLS public read) so the lock screen can render
--     before authentication; writable only by platform admins.
CREATE TABLE IF NOT EXISTS public.site_license (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  model         TEXT NOT NULL DEFAULT 'lifetime',   -- 'lifetime' | 'subscription'
  plan          TEXT DEFAULT 'One-time purchase (lifetime ownership)',
  cycle         TEXT DEFAULT '',                     -- 'monthly' | 'termly' | 'annual' | 'custom'
  started_on    DATE,
  expires_on    DATE,
  grace_days    INTEGER NOT NULL DEFAULT 7,
  status        TEXT NOT NULL DEFAULT 'active',     -- 'active' | 'suspended'
  renew_url     TEXT DEFAULT '',
  lock_message  TEXT DEFAULT '',
  license_token TEXT DEFAULT '',                     -- offline perpetual token (dual engine)
  signature     TEXT DEFAULT '',                     -- sha256(model|expires_on|grace_days|status|salt)
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT site_license_single_row CHECK (id = 1)
);

-- 2.10 Platform Settings (single shared settings row, id = 1)
--      Persists configuration that must be identical on EVERY admin device:
--      branding mirror, accessibility defaults, module access matrix,
--      audit retention, security hardening (idle lock / lockdown mode),
--      Google Drive sync settings and license registry pointer.
--      NOTE: no secrets live here — Supabase keys sit in assets/js/app.js,
--      the Drive OAuth Client ID is public by design.
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id                        INTEGER PRIMARY KEY DEFAULT 1,
  institution_name          TEXT DEFAULT 'HMG Academy CBT Pro',
  branding                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  accessibility             JSONB NOT NULL DEFAULT '{"font_scale":1,"high_contrast":false,"reduced_motion":false,"dyslexia_font":false,"language":"en"}'::jsonb,
  cbt_defaults              JSONB NOT NULL DEFAULT '{"duration":45,"passmark":50,"shuffle_questions":true,"shuffle_options":true,"negative_mark":0,"attempt_limit":1,"release_results":true}'::jsonb,
  module_access             JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {"teacher":["teacher.html",...], ...}
  audit_retention_days      INTEGER NOT NULL DEFAULT 365,
  idle_lock_minutes         INTEGER NOT NULL DEFAULT 30,          -- 0 = off (security-guard)
  lockdown_mode             BOOLEAN NOT NULL DEFAULT false,       -- emergency portal lock
  lockdown_message          TEXT DEFAULT '',
  drive_client_id           TEXT DEFAULT '',
  drive_sync_enabled        BOOLEAN NOT NULL DEFAULT false,
  drive_sync_days           INTEGER NOT NULL DEFAULT 7,
  drive_folder_id           TEXT DEFAULT '',
  drive_last_backup         TIMESTAMPTZ,
  license_registry_url      TEXT DEFAULT '',                      -- optional remote authoritative registry
  license_salt              TEXT DEFAULT 'HMG_CBT_PRO_V10_SECURE_SALT_2026',
  watermark_text            TEXT DEFAULT '',
  signature_data_uri        TEXT DEFAULT '',                      -- official signature image
  updated_at                TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT platform_settings_single_row CHECK (id = 1)
);

-- 2.11 Client Registrations (builder-side registry — powers client-monitor.html)
--      Used by the PLATFORM OWNER / BUILDER (e.g. HMG) to track the client
--      deployments they deliver: each row points at one client platform and
--      stores only that client's PUBLIC connection details (their Supabase
--      URL + anon key — the license row is public-by-design so lock screens
--      render pre-login). Access is RPC-only (admin-gated); RLS denies all
--      direct table access. On client deployments this table simply sits
--      empty unless that owner also resells platforms.
CREATE TABLE IF NOT EXISTS public.client_registrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,
  deploy_url       TEXT DEFAULT '',
  supabase_url     TEXT DEFAULT '',
  supabase_anon_key TEXT DEFAULT '',
  model            TEXT DEFAULT 'subscription',      -- 'subscription' | 'lifetime'
  notes            TEXT DEFAULT '',
  created_by       UUID,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2.12 Live Invigilation Sessions (Phase 10 — the teacher's live exam monitor)
--      Written by the student engine during an exam (one upsert per candidate
--      every ~45s), read by the owning teacher. Rows are evidence, not history:
--      only recent sessions are listed by the RPC.
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_key TEXT NOT NULL,                       -- name|class|id as shown on the roster
  device_id TEXT DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0,             -- % of questions answered
  answered INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  current_subject INTEGER NOT NULL DEFAULT 0,
  current_question INTEGER NOT NULL DEFAULT 0,
  violations INTEGER NOT NULL DEFAULT 0,
  finished BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT live_sessions_one_per_candidate UNIQUE (exam_id, student_key)
);

-- 2.13 Result Appeals (Phase 10 — candidate-initiated rescoring requests)
--      A candidate asks for a script review from the result screen; the
--      teacher resolves it from the Review area. One pending appeal per
--      candidate per exam.
CREATE TABLE IF NOT EXISTS public.appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_class TEXT DEFAULT '',
  attempt_number INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',          -- 'pending' | 'granted' | 'declined'
  resolution_note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- SECTION 3 — SCHEMA EVOLUTION GUARDS (upgrade older deployments in place)
-- ============================================================================
-- These ALTERs make the script safe to run on databases created with an
-- OLDER version of this file: missing columns are added, existing ones are
-- left untouched. Each line is a no-op when the column already exists.

-- institutions: Drive + license columns (added v3.1)
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_client_id TEXT DEFAULT '';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_folder_id TEXT DEFAULT '';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_sync_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_sync_days INTEGER DEFAULT 7;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_last_backup TIMESTAMPTZ;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS license_token TEXT DEFAULT '';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS license_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS last_keepalive_at TIMESTAMPTZ DEFAULT NOW();

-- exams: advanced proctoring / scheduling columns (added v3.1)
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS negative_mark NUMERIC(6,2) NOT NULL DEFAULT 0;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS release_results BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS math_keyboard BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS certificate_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS certificate_valid_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS proctoring BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS anti_cheat_config JSONB NOT NULL DEFAULT '{"tab_switch":true,"window_blur":true,"copy_paste":true,"right_click":true,"fullscreen":true,"devtools":true,"proctoring":false,"audio":false,"max_violations":5}'::jsonb;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS instructions TEXT DEFAULT '';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_multi_subject BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS subjects_data JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS close_at TIMESTAMPTZ;

-- results: analytics columns (added v3.1)
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS time_taken INTEGER DEFAULT 0;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS answers_data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS subject_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS violations INTEGER DEFAULT 0;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS violation_log JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS proctor_data JSONB;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS cert_code TEXT NOT NULL DEFAULT '';
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS is_released BOOLEAN DEFAULT true;
-- results: tutor score-audit workflow (added v4.1)
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS reviewed_by TEXT NOT NULL DEFAULT '';
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- profiles: workflow columns (added v3.1)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- site_license: signature + offline-token columns (added v4.0)
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS license_token TEXT DEFAULT '';
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS signature TEXT DEFAULT '';
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS lock_message TEXT DEFAULT '';
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS started_on DATE;

-- platform_settings: security + signature columns (added v4.0)
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS idle_lock_minutes INTEGER NOT NULL DEFAULT 30;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS lockdown_mode BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS lockdown_message TEXT DEFAULT '';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS watermark_text TEXT DEFAULT '';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS signature_data_uri TEXT DEFAULT '';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS license_registry_url TEXT DEFAULT '';

-- ============================================================================
-- SECTION 3.9 — COMPLETE COLUMN RECONCILIATION (any deployment shape → master)
-- ============================================================================
-- The guards above cover the columns this file historically added late. This
-- block goes further: it reconciles EVERY column of EVERY table against the
-- master definition, so a database created by ANY older build (or repaired by
-- hand) is upgraded to the full master shape in one pass. Every line is a
-- no-op when the column already exists, and NOT NULL columns that lack a
-- master default carry a safe fallback default so the statement can never
-- fail on a table that already holds rows.
-- This is the definitive fix for: "ERROR 42703: column s.status does not
-- exist" (and every other column-drift variant) when re-running this file.

-- institutions
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'HMG Academy';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS tagline TEXT DEFAULT 'Computer-Based Testing & Learning Solutions';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'enterprise';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS stamp_url TEXT DEFAULT '';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#10b981';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#8b5cf6';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS branding JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_client_id TEXT DEFAULT '';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_folder_id TEXT DEFAULT '';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_sync_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_sync_days INTEGER DEFAULT 7;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_last_backup TIMESTAMPTZ;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS license_token TEXT DEFAULT '';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS license_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS last_keepalive_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT UNIQUE NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'teacher';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT gen_random_uuid();
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_id TEXT NOT NULL DEFAULT '';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS class TEXT NOT NULL DEFAULT '';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- exams
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT gen_random_uuid();
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS code TEXT UNIQUE NOT NULL DEFAULT '';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT '';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS duration INTEGER NOT NULL DEFAULT 45;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS attempt_limit INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS select_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS exam_mode TEXT NOT NULL DEFAULT 'open';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS negative_mark NUMERIC(6,2) NOT NULL DEFAULT 0;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS release_results BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS math_keyboard BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS certificate_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS certificate_valid_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS proctoring BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS anti_cheat_config JSONB NOT NULL DEFAULT '{"tab_switch":true,"window_blur":true,"copy_paste":true,"right_click":true,"fullscreen":true,"devtools":true,"proctoring":false,"audio":false,"max_violations":5}'::jsonb;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS instructions TEXT DEFAULT '';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_multi_subject BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS subjects_data JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS csv_data JSONB NOT NULL DEFAULT '[]'::jsonb;
-- PHASE 12 drift healing: older/drifted databases created these columns
-- NOT NULL WITHOUT a default, which made multi-subject publishes fail with
-- 'null value in column "csv_data" violates not-null constraint'. Re-assert
-- the defaults (idempotent — safe on every database state). The publish
-- payload now also sends csv_data explicitly, so BOTH old and new databases
-- work even before this reconciliation runs.
ALTER TABLE public.exams ALTER COLUMN subjects_data SET DEFAULT '[]'::jsonb;
ALTER TABLE public.exams ALTER COLUMN csv_data SET DEFAULT '[]'::jsonb;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS close_at TIMESTAMPTZ;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- results
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE DEFAULT gen_random_uuid();
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS student_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS student_class TEXT NOT NULL DEFAULT '';
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS student_id_ref TEXT DEFAULT '';
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS student_type TEXT DEFAULT 'open';
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS score NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS correct_count INTEGER DEFAULT 0;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS wrong_count INTEGER DEFAULT 0;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS skipped_count INTEGER DEFAULT 0;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS time_taken INTEGER DEFAULT 0;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS answers_data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS subject_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS violations INTEGER DEFAULT 0;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS violation_log JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS proctor_data JSONB;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS cert_code TEXT NOT NULL DEFAULT '';
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS is_released BOOLEAN DEFAULT true;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- audit_logs
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_email TEXT DEFAULT '';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT '';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT '';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT DEFAULT '';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_hint TEXT DEFAULT '';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
-- system_backups
ALTER TABLE public.system_backups ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE public.system_backups ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;
ALTER TABLE public.system_backups ADD COLUMN IF NOT EXISTS backup_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.system_backups ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'google_drive';
ALTER TABLE public.system_backups ADD COLUMN IF NOT EXISTS drive_file_id TEXT DEFAULT '';
ALTER TABLE public.system_backups ADD COLUMN IF NOT EXISTS drive_file_url TEXT DEFAULT '';
ALTER TABLE public.system_backups ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT DEFAULT 0;
ALTER TABLE public.system_backups ADD COLUMN IF NOT EXISTS total_records INTEGER DEFAULT 0;
ALTER TABLE public.system_backups ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.system_backups ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
-- platform_settings
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS id INTEGER PRIMARY KEY DEFAULT 1;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS institution_name TEXT DEFAULT 'HMG Academy CBT Pro';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS branding JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS accessibility JSONB NOT NULL DEFAULT '{"font_scale":1,"high_contrast":false,"reduced_motion":false,"dyslexia_font":false,"language":"en"}'::jsonb;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS cbt_defaults JSONB NOT NULL DEFAULT '{"duration":45,"passmark":50,"shuffle_questions":true,"shuffle_options":true,"negative_mark":0,"attempt_limit":1,"release_results":true}'::jsonb;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS module_access JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS audit_retention_days INTEGER NOT NULL DEFAULT 365;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS idle_lock_minutes INTEGER NOT NULL DEFAULT 30;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS lockdown_mode BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS lockdown_message TEXT DEFAULT '';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS drive_client_id TEXT DEFAULT '';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS drive_sync_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS drive_sync_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS drive_folder_id TEXT DEFAULT '';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS drive_last_backup TIMESTAMPTZ;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS license_registry_url TEXT DEFAULT '';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS license_salt TEXT DEFAULT 'HMG_CBT_PRO_V10_SECURE_SALT_2026';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS watermark_text TEXT DEFAULT '';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS signature_data_uri TEXT DEFAULT '';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- site_license
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS id INTEGER PRIMARY KEY DEFAULT 1;
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'lifetime';
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'One-time purchase (lifetime ownership)';
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS cycle TEXT DEFAULT '';
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS started_on DATE;
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS expires_on DATE;
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS grace_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS renew_url TEXT DEFAULT '';
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS lock_message TEXT DEFAULT '';
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS license_token TEXT DEFAULT '';
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS signature TEXT DEFAULT '';
ALTER TABLE public.site_license ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- exams (Phase 10 delivery & scoring options)
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS adaptive BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS feedback_mode TEXT NOT NULL DEFAULT 'end';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS score_model TEXT NOT NULL DEFAULT 'standard';
-- students (Phase 10 accommodations)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS extra_time_pct INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS accommodation_note TEXT DEFAULT '';
-- live_sessions (Phase 10 live invigilation)
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE DEFAULT gen_random_uuid();
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS student_key TEXT NOT NULL DEFAULT '';
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS device_id TEXT DEFAULT '';
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS answered INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS total_questions INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS current_subject INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS current_question INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS violations INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS finished BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- appeals (Phase 10 result appeals)
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE DEFAULT gen_random_uuid();
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS student_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS student_class TEXT DEFAULT '';
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS resolution_note TEXT DEFAULT '';
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
-- client_registrations
ALTER TABLE public.client_registrations ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE public.client_registrations ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.client_registrations ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
ALTER TABLE public.client_registrations ADD COLUMN IF NOT EXISTS deploy_url TEXT DEFAULT '';
ALTER TABLE public.client_registrations ADD COLUMN IF NOT EXISTS supabase_url TEXT DEFAULT '';
ALTER TABLE public.client_registrations ADD COLUMN IF NOT EXISTS supabase_anon_key TEXT DEFAULT '';
ALTER TABLE public.client_registrations ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'subscription';
ALTER TABLE public.client_registrations ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.client_registrations ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.client_registrations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.client_registrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- sc_heartbeat
ALTER TABLE public.sc_heartbeat ADD COLUMN IF NOT EXISTS id INTEGER PRIMARY KEY;
ALTER TABLE public.sc_heartbeat ADD COLUMN IF NOT EXISTS last_ping TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.sc_heartbeat ADD COLUMN IF NOT EXISTS last_source TEXT;
ALTER TABLE public.sc_heartbeat ADD COLUMN IF NOT EXISTS ping_count BIGINT NOT NULL DEFAULT 0;

-- Unique-constraint reconciliation: legacy databases that predate a UNIQUE
-- column allow duplicates that silently break code lookups (exam codes,
-- profile emails, student roster IDs). Guarded: if duplicates exist the
-- constraint is skipped with a NOTICE instead of aborting the install.
DO $uniqrec$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exams_code_key' AND conrelid = 'public.exams'::regclass) THEN
    ALTER TABLE public.exams ADD CONSTRAINT exams_code_key UNIQUE (code);
  END IF;
EXCEPTION WHEN unique_violation OR others THEN
  RAISE NOTICE 'exams.code has duplicate values — UNIQUE constraint skipped; de-duplicate and re-run.';
END $uniqrec$;

DO $uniqrec$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
EXCEPTION WHEN unique_violation OR others THEN
  RAISE NOTICE 'profiles.email has duplicate values — UNIQUE constraint skipped; de-duplicate and re-run.';
END $uniqrec$;

DO $uniqrec$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'institutions_slug_key' AND conrelid = 'public.institutions'::regclass) THEN
    ALTER TABLE public.institutions ADD CONSTRAINT institutions_slug_key UNIQUE (slug);
  END IF;
EXCEPTION WHEN unique_violation OR others THEN
  RAISE NOTICE 'institutions.slug has duplicate values — UNIQUE constraint skipped; de-duplicate and re-run.';
END $uniqrec$;

DO $uniqrec$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_teacher_id_student_id_key' AND conrelid = 'public.students'::regclass) THEN
    ALTER TABLE public.students ADD CONSTRAINT students_teacher_id_student_id_key UNIQUE (teacher_id, student_id);
  END IF;
EXCEPTION WHEN unique_violation OR others THEN
  RAISE NOTICE 'students has duplicate (teacher_id, student_id) rows — UNIQUE constraint skipped; de-duplicate and re-run.';
END $uniqrec$;

-- ============================================================================
-- SECTION 4 — INDEXES FOR HIGH-PERFORMANCE SEARCH & RETRIEVAL
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_exams_code ON public.exams(upper(code));
CREATE INDEX IF NOT EXISTS idx_exams_teacher_id ON public.exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_exams_is_open ON public.exams(is_open, is_archived);
CREATE INDEX IF NOT EXISTS idx_exams_multi ON public.exams(is_multi_subject);
CREATE INDEX IF NOT EXISTS idx_results_exam_id ON public.results(exam_id);
CREATE INDEX IF NOT EXISTS idx_results_cert_code ON public.results(upper(cert_code));
CREATE INDEX IF NOT EXISTS idx_results_student_name ON public.results(lower(student_name));
CREATE INDEX IF NOT EXISTS idx_results_created_at ON public.results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_teacher_sid ON public.students(teacher_id, upper(student_id));
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_system_backups_created ON public.system_backups(created_at DESC);

-- ============================================================================
-- SECTION 5 — SECURITY & HELPER FUNCTIONS
-- ============================================================================

-- 5.1 Check Platform Admin
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
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT,
  p_entity_type TEXT DEFAULT '',
  p_entity_id TEXT DEFAULT '',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_email TEXT := COALESCE(auth.jwt()->>'email', 'system');
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, metadata)
  VALUES (v_actor_id, v_email, p_action, p_entity_type, p_entity_id, p_metadata);
END;
$$;

-- 5.7 Updated_at Trigger Function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 5.8 Auto Profile Creation Trigger on Auth Signup
--     The FIRST registered user automatically becomes super_admin (active);
--     everyone else starts as a pending teacher awaiting admin approval.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := 'teacher';
  v_is_admin BOOLEAN := false;
  v_status TEXT := 'pending';
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.profiles;
  IF v_count = 0 THEN
    v_role := 'super_admin';
    v_is_admin := true;
    v_status := 'active';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, is_admin, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    v_role,
    v_is_admin,
    v_status
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

  RETURN NEW;
END;
$$;

-- ============================================================================
-- SECTION 6 — FREE-TIER KEEP-ALIVE HEARTBEAT (Layers 0–4 backend)
-- ============================================================================
-- Supabase pauses FREE-tier projects after ~7 days without REAL database
-- activity. A plain SELECT ping does not reliably reset the timer — only a
-- genuine write does. sc_keep_alive() performs an actual UPDATE and returns
-- the new timestamp so every caller (site visits, GitHub Actions, the Edge
-- ping function, UptimeRobot, pg_cron) can PROVE the write happened.

-- 6.1 The heartbeat RPC — real UPDATE, callable with the anon key,
--     exposes no school data. Returns the new last_ping timestamp.
CREATE OR REPLACE FUNCTION public.sc_keep_alive(p_src TEXT DEFAULT 'unknown')
RETURNS TIMESTAMPTZ
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $keepalive$
  UPDATE public.sc_heartbeat
     SET last_ping   = NOW(),
         last_source = LEFT(COALESCE(p_src, 'unknown'), 40),
         ping_count  = ping_count + 1
   WHERE id = 1
  RETURNING last_ping;
$keepalive$;

GRANT EXECUTE ON FUNCTION public.sc_keep_alive(TEXT) TO anon, authenticated;

-- 6.2 Legacy alias (kept so older clients keep working — never remove)
CREATE OR REPLACE FUNCTION public.keep_alive_ping()
RETURNS TABLE (success BOOLEAN, pinged_at TIMESTAMPTZ, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_ts TIMESTAMPTZ;
BEGIN
  SELECT public.sc_keep_alive('legacy-ping') INTO v_ts;
  RETURN QUERY SELECT true, v_ts, 'Supabase keepalive ping successful. Free-tier anti-pause active.'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.keep_alive_ping() TO anon, authenticated;

-- 6.3 Heartbeat status reader (used by the Platform Health console to show
--     last_ping / last_source / ping_count and verify every layer works)
CREATE OR REPLACE FUNCTION public.get_heartbeat_status()
RETURNS TABLE (last_ping TIMESTAMPTZ, last_source TEXT, ping_count BIGINT, seconds_since_ping BIGINT)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT last_ping, last_source, ping_count,
         GREATEST(0, EXTRACT(EPOCH FROM (NOW() - last_ping))::BIGINT)
    FROM public.sc_heartbeat WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_heartbeat_status() TO anon, authenticated;

-- ============================================================================
-- SECTION 7 — PUBLIC SETTINGS & SITE LICENSE RPCS (pre-login safe)
-- ============================================================================

-- 7.1 Public platform settings (safe columns only — powers the login-page
--     branding, language, accessibility defaults and lockdown notice before
--     the user signs in). NOTE: platform_settings contains no secrets.
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'institution_name', institution_name,
    'branding', branding,
    'accessibility', accessibility,
    'lockdown_mode', lockdown_mode,
    'lockdown_message', lockdown_message,
    'watermark_text', watermark_text,
    'license', (SELECT jsonb_build_object(
        'model', model, 'plan', plan, 'cycle', cycle,
        'expires_on', expires_on, 'grace_days', grace_days,
        'status', status, 'lock_message', lock_message
      ) FROM public.site_license WHERE id = 1)
  )
  FROM public.platform_settings WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;

-- 7.2 Save platform settings (ADMIN ONLY) — merges a JSONB patch into the
--     single settings row. Column keys are whitelisted; unknown keys go
--     into the branding / accessibility / cbt_defaults / module_access JSON
--     objects by prefix ("branding_x", "a11y_x", "cbt_x", "acl_x").
CREATE OR REPLACE FUNCTION public.save_platform_settings(p_patch JSONB DEFAULT '{}'::jsonb)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.platform_settings%ROWTYPE;
  k TEXT;
  v JSONB;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;

  SELECT * INTO v_row FROM public.platform_settings WHERE id = 1 FOR UPDATE;

  -- simple scalar columns
  IF p_patch ? 'institution_name' THEN v_row.institution_name := LEFT(p_patch->>'institution_name', 200); END IF;
  IF p_patch ? 'audit_retention_days' THEN v_row.audit_retention_days := GREATEST(7, COALESCE((p_patch->>'audit_retention_days')::INT, 365)); END IF;
  IF p_patch ? 'idle_lock_minutes' THEN v_row.idle_lock_minutes := GREATEST(0, COALESCE((p_patch->>'idle_lock_minutes')::INT, 30)); END IF;
  IF p_patch ? 'lockdown_mode' THEN v_row.lockdown_mode := COALESCE((p_patch->>'lockdown_mode')::BOOLEAN, false); END IF;
  IF p_patch ? 'lockdown_message' THEN v_row.lockdown_message := LEFT(p_patch->>'lockdown_message', 500); END IF;
  IF p_patch ? 'drive_client_id' THEN v_row.drive_client_id := LEFT(p_patch->>'drive_client_id', 200); END IF;
  IF p_patch ? 'drive_sync_enabled' THEN v_row.drive_sync_enabled := COALESCE((p_patch->>'drive_sync_enabled')::BOOLEAN, false); END IF;
  IF p_patch ? 'drive_sync_days' THEN v_row.drive_sync_days := LEAST(GREATEST(1, COALESCE((p_patch->>'drive_sync_days')::INT, 7)), 90); END IF;
  IF p_patch ? 'drive_folder_id' THEN v_row.drive_folder_id := LEFT(p_patch->>'drive_folder_id', 200); END IF;
  IF p_patch ? 'drive_last_backup' THEN v_row.drive_last_backup := (p_patch->>'drive_last_backup')::TIMESTAMPTZ; END IF;
  IF p_patch ? 'license_registry_url' THEN v_row.license_registry_url := LEFT(p_patch->>'license_registry_url', 500); END IF;
  IF p_patch ? 'license_salt' THEN v_row.license_salt := LEFT(p_patch->>'license_salt', 200); END IF;
  IF p_patch ? 'watermark_text' THEN v_row.watermark_text := LEFT(p_patch->>'watermark_text', 120); END IF;
  IF p_patch ? 'signature_data_uri' THEN v_row.signature_data_uri := LEFT(p_patch->>'signature_data_uri', 300000); END IF;

  -- JSON objects (deep merge)
  IF p_patch ? 'branding' THEN v_row.branding := v_row.branding || (p_patch->'branding'); END IF;
  IF p_patch ? 'accessibility' THEN v_row.accessibility := v_row.accessibility || (p_patch->'accessibility'); END IF;
  IF p_patch ? 'cbt_defaults' THEN v_row.cbt_defaults := v_row.cbt_defaults || (p_patch->'cbt_defaults'); END IF;
  IF p_patch ? 'module_access' THEN v_row.module_access := (p_patch->'module_access'); END IF;

  UPDATE public.platform_settings SET
    institution_name = v_row.institution_name,
    branding = v_row.branding,
    accessibility = v_row.accessibility,
    cbt_defaults = v_row.cbt_defaults,
    module_access = v_row.module_access,
    audit_retention_days = v_row.audit_retention_days,
    idle_lock_minutes = v_row.idle_lock_minutes,
    lockdown_mode = v_row.lockdown_mode,
    lockdown_message = v_row.lockdown_message,
    drive_client_id = v_row.drive_client_id,
    drive_sync_enabled = v_row.drive_sync_enabled,
    drive_sync_days = v_row.drive_sync_days,
    drive_folder_id = v_row.drive_folder_id,
    drive_last_backup = v_row.drive_last_backup,
    license_registry_url = v_row.license_registry_url,
    license_salt = v_row.license_salt,
    watermark_text = v_row.watermark_text,
    signature_data_uri = v_row.signature_data_uri,
    updated_at = NOW()
  WHERE id = 1;

  PERFORM public.log_audit_event('save_platform_settings', 'platform_settings', '1',
    jsonb_build_object('keys', (SELECT string_agg(k, ',') FROM jsonb_object_keys(p_patch) k)));
END;
$$;

-- 7.3 Save the site license row (OWNER ONLY — super_admin)
CREATE OR REPLACE FUNCTION public.save_site_license(p_license JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  /*LICENSE-SELF-SERVICE-GUARD*/
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not authorized: super_admin (owner) access required to change the site license';
  END IF;
  /*LICENSE-SELF-SERVICE-GUARD-END*/

  INSERT INTO public.site_license (id, model, plan, cycle, started_on, expires_on, grace_days,
                                   status, renew_url, lock_message, license_token, signature, updated_at)
  VALUES (
    1,
    CASE WHEN p_license->>'model' = 'subscription' THEN 'subscription' ELSE 'lifetime' END,
    LEFT(COALESCE(p_license->>'plan',''), 200),
    LEFT(COALESCE(p_license->>'cycle',''), 40),
    NULLIF(p_license->>'started_on','')::DATE,
    NULLIF(p_license->>'expires_on','')::DATE,
    GREATEST(0, COALESCE((p_license->>'grace_days')::INT, 7)),
    CASE WHEN p_license->>'status' = 'suspended' THEN 'suspended' ELSE 'active' END,
    LEFT(COALESCE(p_license->>'renew_url',''), 500),
    LEFT(COALESCE(p_license->>'lock_message',''), 500),
    LEFT(COALESCE(p_license->>'license_token',''), 20000),
    LEFT(COALESCE(p_license->>'signature',''), 128),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    model        = EXCLUDED.model,
    plan         = EXCLUDED.plan,
    cycle        = EXCLUDED.cycle,
    started_on   = EXCLUDED.started_on,
    expires_on   = EXCLUDED.expires_on,
    grace_days   = EXCLUDED.grace_days,
    status       = EXCLUDED.status,
    renew_url    = EXCLUDED.renew_url,
    lock_message = EXCLUDED.lock_message,
    license_token= EXCLUDED.license_token,
    signature    = EXCLUDED.signature,
    updated_at   = NOW();

  PERFORM public.log_audit_event('save_site_license', 'site_license', '1', jsonb_build_object(
    'model', p_license->>'model', 'expires_on', p_license->>'expires_on', 'status', p_license->>'status'));
END;
$$;

-- 7.4 Quick-extend a subscription by N days (OWNER ONLY) — the "renewal"
--     action used by the license page after payment is received.
CREATE OR REPLACE FUNCTION public.extend_site_license(p_days INTEGER DEFAULT 30)
RETURNS TABLE (new_expiry DATE, days_added INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_cur DATE;
BEGIN
  /*LICENSE-SELF-SERVICE-GUARD*/
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not authorized: super_admin (owner) access required';
  END IF;
  /*LICENSE-SELF-SERVICE-GUARD-END*/
  IF p_days < 1 OR p_days > 3650 THEN
    RAISE EXCEPTION 'Days must be between 1 and 3650';
  END IF;

  SELECT GREATEST(COALESCE(expires_on, CURRENT_DATE), CURRENT_DATE) INTO v_cur
    FROM public.site_license WHERE id = 1;

  UPDATE public.site_license
     SET expires_on = v_cur + p_days,
         status = 'active',
         signature = '',   -- signature is recomputed by the license console
         updated_at = NOW()
   WHERE id = 1;

  PERFORM public.log_audit_event('extend_site_license', 'site_license', '1', jsonb_build_object('days_added', p_days));
  RETURN QUERY SELECT (v_cur + p_days), p_days;
END;
$$;

-- 7.5 List client registrations (ADMIN ONLY) — powers client-monitor.html.
--      The builder-side registry of delivered client platforms.
CREATE OR REPLACE FUNCTION public.admin_list_client_registrations()
RETURNS TABLE (id UUID, name TEXT, slug TEXT, deploy_url TEXT, supabase_url TEXT,
               supabase_anon_key TEXT, model TEXT, notes TEXT,
               created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  RETURN QUERY
  SELECT r.id, r.name, r.slug, r.deploy_url, r.supabase_url,
         r.supabase_anon_key, r.model, r.notes, r.created_at, r.updated_at
  FROM public.client_registrations r
  ORDER BY r.created_at DESC;
END;
$$;

-- 7.6 Upsert a client registration (ADMIN ONLY, audit-logged).
--      p_client: {id?, name, slug, deploy_url, supabase_url,
--                 supabase_anon_key, model, notes}
CREATE OR REPLACE FUNCTION public.admin_upsert_client_registration(p_client JSONB)
RETURNS TABLE (client_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id UUID; v_name TEXT; v_slug TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  v_name := NULLIF(trim(p_client->>'name'), '');
  v_slug := lower(NULLIF(trim(p_client->>'slug'), ''));
  IF v_name IS NULL OR v_slug IS NULL THEN
    RAISE EXCEPTION 'Client name and slug are required';
  END IF;
  IF p_client->>'id' IS NOT NULL AND p_client->>'id' <> '' THEN
    v_id := (p_client->>'id')::UUID;
    UPDATE public.client_registrations r
       SET name = v_name, slug = v_slug,
           deploy_url = COALESCE(p_client->>'deploy_url',''),
           supabase_url = COALESCE(p_client->>'supabase_url',''),
           supabase_anon_key = COALESCE(p_client->>'supabase_anon_key',''),
           model = COALESCE(NULLIF(p_client->>'model',''),'subscription'),
           notes = COALESCE(p_client->>'notes',''),
           updated_at = NOW()
     WHERE r.id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Client registration % not found', v_id;
    END IF;
  ELSE
    INSERT INTO public.client_registrations
      (name, slug, deploy_url, supabase_url, supabase_anon_key, model, notes, created_by)
    VALUES
      (v_name, v_slug,
       COALESCE(p_client->>'deploy_url',''),
       COALESCE(p_client->>'supabase_url',''),
       COALESCE(p_client->>'supabase_anon_key',''),
       COALESCE(NULLIF(p_client->>'model',''),'subscription'),
       COALESCE(p_client->>'notes',''),
       auth.uid())
    RETURNING client_registrations.id INTO v_id;
  END IF;
  PERFORM public.log_audit_event('admin_upsert_client_registration', 'client_registrations', v_id::TEXT,
                                 jsonb_build_object('name', v_name, 'slug', v_slug));
  RETURN QUERY SELECT v_id;
END;
$$;

-- 7.7 Delete a client registration (ADMIN ONLY, audit-logged).
CREATE OR REPLACE FUNCTION public.admin_delete_client_registration(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_name TEXT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  SELECT name INTO v_name FROM public.client_registrations WHERE id = p_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Client registration not found';
  END IF;
  DELETE FROM public.client_registrations WHERE id = p_id;
  PERFORM public.log_audit_event('admin_delete_client_registration', 'client_registrations', p_id::TEXT,
                                 jsonb_build_object('name', v_name));
  RETURN TRUE;
END;
$$;

-- ============================================================================
-- SECTION 8 — PUBLIC & STUDENT RPCS (SAFE ANONYMOUS ACCESS)
-- ============================================================================

-- 8.1 Get Public Exam By Code
CREATE OR REPLACE FUNCTION public.get_public_exam_by_code(p_code TEXT)
RETURNS TABLE (
  id UUID,
  code TEXT,
  subject TEXT,
  duration INTEGER,
  attempt_limit INTEGER,
  select_count INTEGER,
  is_open BOOLEAN,
  exam_mode TEXT,
  negative_mark NUMERIC,
  release_results BOOLEAN,
  instructions TEXT,
  anti_cheat_config JSONB,
  proctoring BOOLEAN,
  math_keyboard BOOLEAN,
  certificate_enabled BOOLEAN,
  is_multi_subject BOOLEAN,
  adaptive BOOLEAN,
  feedback_mode TEXT,
  score_model TEXT,
  subjects_data JSONB,
  start_at TIMESTAMPTZ,
  close_at TIMESTAMPTZ,
  csv_data JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    e.id,
    e.code,
    e.subject,
    e.duration,
    e.attempt_limit,
    e.select_count,
    e.is_open,
    e.exam_mode,
    e.negative_mark,
    e.release_results,
    e.instructions,
    e.anti_cheat_config,
    e.proctoring,
    e.math_keyboard,
    e.certificate_enabled,
    e.is_multi_subject,
    e.adaptive,
    e.feedback_mode,
    e.score_model,
    e.subjects_data,
    e.start_at,
    e.close_at,
    CASE
      WHEN e.start_at IS NOT NULL AND e.start_at > NOW() THEN '[]'::jsonb
      ELSE e.csv_data
    END AS csv_data,
    e.created_at,
    e.updated_at
  FROM public.exams e
  WHERE upper(trim(e.code)) = upper(trim(p_code))
    AND e.is_archived = false
    AND e.is_open = true
    AND (e.close_at IS NULL OR e.close_at > NOW())
  LIMIT 1;
$$;

-- 8.1b Check Exam Code Status (safe public probe — no question data leaked)
-- Lets the Student Portal tell the difference between a wrong code and a
-- correct code for an exam that is locked / scheduled / already closed.
CREATE OR REPLACE FUNCTION public.check_exam_code_status(p_code TEXT)
RETURNS TABLE (found BOOLEAN, is_open BOOLEAN, starts_at TIMESTAMPTZ, closes_at TIMESTAMPTZ)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    TRUE,
    e.is_open,
    e.start_at,
    e.close_at
  FROM public.exams e
  WHERE upper(trim(e.code)) = upper(trim(p_code))
    AND e.is_archived = false
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.check_exam_code_status(TEXT) TO anon, authenticated;

-- 8.2 Verify Student For Exam
CREATE OR REPLACE FUNCTION public.verify_student_for_exam(p_exam_id UUID, p_student_id TEXT)
RETURNS TABLE (id UUID, full_name TEXT, student_id TEXT, class TEXT, extra_time_pct INTEGER, accommodation_note TEXT)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.full_name, s.student_id, s.class, s.extra_time_pct, s.accommodation_note
  FROM public.students s
  JOIN public.exams e ON e.id = p_exam_id
  WHERE s.teacher_id = e.teacher_id
    AND upper(trim(s.student_id)) = upper(trim(p_student_id))
    AND s.status = 'active'
  LIMIT 1;
$$;

-- 8.3 Get Candidate Exam Attempt Count
CREATE OR REPLACE FUNCTION public.get_exam_attempt_count(
  p_exam_id UUID,
  p_student_name TEXT,
  p_student_class TEXT,
  p_student_id_ref TEXT DEFAULT ''
)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.results r
  WHERE r.exam_id = p_exam_id
    AND (
      (COALESCE(trim(p_student_id_ref), '') <> '' AND upper(COALESCE(r.student_id_ref, '')) = upper(trim(p_student_id_ref)))
      OR
      (lower(trim(r.student_name)) = lower(trim(p_student_name))
       AND lower(trim(r.student_class)) = lower(trim(p_student_class)))
    );
$$;

-- 8.4 Submit Student Result
CREATE OR REPLACE FUNCTION public.submit_student_result(p_payload JSONB)
RETURNS TABLE (saved BOOLEAN, result_id UUID, cert_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exam_id UUID := (p_payload->>'exam_id')::UUID;
  v_cert TEXT := upper(COALESCE(NULLIF(p_payload->>'cert_code',''), substring(replace(gen_random_uuid()::text,'-','') from 1 for 10)));
  v_id UUID;
BEGIN
  IF v_exam_id IS NULL OR NOT public.is_exam_open_for_submission(v_exam_id) THEN
    RAISE EXCEPTION 'Exam is not open for submission or exam_id is invalid.';
  END IF;

  INSERT INTO public.results (
    exam_id, student_name, student_class, student_id_ref, student_type,
    score, total, correct_count, wrong_count, skipped_count, attempt_number,
    time_taken, answers_data, subject_breakdown, violations, violation_log,
    proctor_data, cert_code, is_released, needs_review
  ) VALUES (
    v_exam_id,
    LEFT(COALESCE(p_payload->>'student_name','Anonymous'), 200),
    LEFT(COALESCE(p_payload->>'student_class','General'), 120),
    NULLIF(LEFT(COALESCE(p_payload->>'student_id_ref',''), 120), ''),
    COALESCE(NULLIF(p_payload->>'student_type',''), 'open'),
    COALESCE((p_payload->>'score')::NUMERIC, 0),
    COALESCE((p_payload->>'total')::INTEGER, 0),
    COALESCE(NULLIF(p_payload->>'correct_count','')::INTEGER, 0),
    COALESCE(NULLIF(p_payload->>'wrong_count','')::INTEGER, 0),
    COALESCE(NULLIF(p_payload->>'skipped_count','')::INTEGER, 0),
    COALESCE(NULLIF(p_payload->>'attempt_number','')::INTEGER, 1),
    COALESCE(NULLIF(p_payload->>'time_taken','')::INTEGER, 0),
    COALESCE(p_payload->'answers_data', '{}'::jsonb),
    COALESCE(p_payload->'subject_breakdown', '{}'::jsonb),
    COALESCE(NULLIF(p_payload->>'violations','')::INTEGER, 0),
    COALESCE(p_payload->'violation_log', '[]'::jsonb),
    p_payload->'proctor_data',
    v_cert,
    COALESCE((p_payload->>'is_released')::BOOLEAN, true),
    /* Phase 3 — scripts containing open-ended questions (essay, code, short
       answer, case study) are auto-flagged for the teacher's review queue. */
    EXISTS (
      SELECT 1
      FROM public.exams e
      CROSS JOIN LATERAL jsonb_array_elements(
        /* guard: csv_data is JSONB in the master schema, but a legacy row (or
           a repaired database) can hold a non-array value — treat anything
           that is not a JSON array as empty instead of failing the submit. */
        CASE WHEN jsonb_typeof(e.csv_data) = 'array' THEN e.csv_data ELSE '[]'::jsonb END
      ) AS q(x)
      WHERE e.id = v_exam_id
        AND q.x->>'type' IN ('essay','code','short','case_study','comprehension','long_answer')
    )
  ) RETURNING id INTO v_id;

  RETURN QUERY SELECT true, v_id, v_cert;
END;
$$;

-- 8.5 Verify Certificate
CREATE OR REPLACE FUNCTION public.verify_certificate(p_cert_code TEXT)
RETURNS TABLE (
  cert_code TEXT,
  student_name TEXT,
  student_class TEXT,
  subject TEXT,
  score NUMERIC,
  total INTEGER,
  percentage NUMERIC,
  grade TEXT,
  issued_at TIMESTAMPTZ,
  issuer_name TEXT,
  is_valid BOOLEAN
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    r.cert_code,
    r.student_name,
    r.student_class,
    split_part(e.subject, '|', 1) AS subject,
    r.score,
    r.total,
    ROUND((r.score / NULLIF(r.total,0)) * 100, 2) AS percentage,
    CASE
      WHEN r.total <= 0 THEN 'UNSCORED'
      WHEN (r.score / NULLIF(r.total,0)) * 100 >= 70 THEN 'DISTINCTION'
      WHEN (r.score / NULLIF(r.total,0)) * 100 >= COALESCE(CASE WHEN split_part(e.subject,'|',7) ~ '^[0-9]+$' THEN split_part(e.subject,'|',7)::INTEGER END,50) THEN 'PASS'
      ELSE 'FAIL'
    END AS grade,
    r.created_at AS issued_at,
    COALESCE(p.full_name, p.email, 'HMG Academy') AS issuer_name,
    (e.certificate_enabled = true AND (e.certificate_valid_days = 0 OR r.created_at + (e.certificate_valid_days || ' days')::interval >= NOW())) AS is_valid
  FROM public.results r
  JOIN public.exams e ON e.id = r.exam_id
  LEFT JOIN public.profiles p ON p.id = e.teacher_id
  WHERE upper(trim(r.cert_code)) = upper(trim(p_cert_code))
    AND COALESCE(r.cert_code,'') <> ''
  ORDER BY r.created_at DESC
  LIMIT 1;
$$;

-- 8.14 Upsert Live Invigilation Session (Phase 10 — called by the student engine)
--      Anonymous: a candidate in an active exam reports their progress every
--      ~45 seconds. The exam must be open and not closed, and the write is an
--      UPSERT on (exam_id, student_key) so pings never duplicate rows.
CREATE OR REPLACE FUNCTION public.upsert_live_session(p_session JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.live_sessions (exam_id, student_key, device_id, progress, answered,
        total_questions, current_subject, current_question, violations, finished, last_seen)
  VALUES (
    (p_session->>'exam_id')::UUID,
    left(coalesce(p_session->>'student_key',''),120),
    left(coalesce(p_session->>'device_id',''),64),
    GREATEST(0, LEAST(100, COALESCE((p_session->>'progress')::INT, 0))),
    GREATEST(0, COALESCE((p_session->>'answered')::INT, 0)),
    GREATEST(0, COALESCE((p_session->>'total_questions')::INT, 0)),
    GREATEST(0, COALESCE((p_session->>'current_subject')::INT, 0)),
    GREATEST(0, COALESCE((p_session->>'current_question')::INT, 0)),
    GREATEST(0, COALESCE((p_session->>'violations')::INT, 0)),
    COALESCE((p_session->>'finished')::BOOLEAN, false),
    NOW()
  )
  ON CONFLICT (exam_id, student_key) DO UPDATE
  SET device_id        = EXCLUDED.device_id,
      progress         = EXCLUDED.progress,
      answered         = EXCLUDED.answered,
      total_questions  = EXCLUDED.total_questions,
      current_subject  = EXCLUDED.current_subject,
      current_question = EXCLUDED.current_question,
      violations       = GREATEST(live_sessions.violations, EXCLUDED.violations),
      finished         = EXCLUDED.finished,
      last_seen        = NOW()
  WHERE public.live_sessions.exam_id IN (
    SELECT id FROM public.exams
    WHERE is_archived = false AND (close_at IS NULL OR close_at > NOW())
  );
END;
$$;

-- 8.15 List Live Invigilation Sessions (Phase 10 — teacher's live monitor)
--      Teacher-only (ownership enforced). Only sessions seen in the last 3
--      hours are returned, newest activity first.
CREATE OR REPLACE FUNCTION public.list_live_sessions(p_exam_id UUID)
RETURNS TABLE (id UUID, student_key TEXT, device_id TEXT, progress INTEGER, answered INTEGER,
               total_questions INTEGER, current_subject INTEGER, current_question INTEGER,
               violations INTEGER, finished BOOLEAN, last_seen TIMESTAMPTZ)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT ls.id, ls.student_key, ls.device_id, ls.progress, ls.answered, ls.total_questions,
         ls.current_subject, ls.current_question, ls.violations, ls.finished, ls.last_seen
  FROM public.live_sessions ls
  JOIN public.exams e ON e.id = ls.exam_id
  WHERE ls.exam_id = p_exam_id
    AND e.teacher_id = auth.uid()
    AND ls.last_seen > NOW() - INTERVAL '3 hours'
  ORDER BY ls.finished ASC, ls.last_seen DESC;
$$;

-- 8.16 Submit Result Appeal (Phase 10 — candidate-initiated rescoring request)
--      Anonymous: only for released results on an open exam; one pending appeal
--      per candidate per exam is allowed (a second request returns false).
CREATE OR REPLACE FUNCTION public.submit_appeal(p_exam_id UUID, p_student_name TEXT, p_student_class TEXT,
                                                p_attempt_number INTEGER, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Exam must exist, be open, not archived
  IF NOT EXISTS (SELECT 1 FROM public.exams e
                 WHERE e.id = p_exam_id AND e.is_open = true AND e.is_archived = false) THEN
    RETURN false;
  END IF;
  -- Candidate must have a released result on this exam
  IF NOT EXISTS (SELECT 1 FROM public.results r
                 WHERE r.exam_id = p_exam_id
                   AND r.student_name = p_student_name
                   AND r.is_released = true) THEN
    RETURN false;
  END IF;
  -- One pending appeal per candidate per exam
  IF EXISTS (SELECT 1 FROM public.appeals a
             WHERE a.exam_id = p_exam_id AND a.student_name = p_student_name
               AND a.status = 'pending') THEN
    RETURN false;
  END IF;
  INSERT INTO public.appeals (exam_id, student_name, student_class, attempt_number, reason)
  VALUES (p_exam_id, left(trim(p_student_name),120), left(coalesce(p_student_class,''),60),
          GREATEST(1, COALESCE(p_attempt_number,1)), left(trim(coalesce(p_reason,'')),1000));
  RETURN true;
END;
$$;

-- 8.17 List Appeals (Phase 10 — teacher queue)
CREATE OR REPLACE FUNCTION public.list_appeals(p_exam_id UUID DEFAULT NULL)
RETURNS TABLE (id UUID, exam_id UUID, exam_title TEXT, student_name TEXT, student_class TEXT,
               attempt_number INTEGER, reason TEXT, status TEXT, resolution_note TEXT,
               created_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT a.id, a.exam_id, e.subject, a.student_name, a.student_class, a.attempt_number,
         a.reason, a.status, a.resolution_note, a.created_at, a.resolved_at
  FROM public.appeals a
  JOIN public.exams e ON e.id = a.exam_id
  WHERE e.teacher_id = auth.uid()
    AND (p_exam_id IS NULL OR a.exam_id = p_exam_id)
  ORDER BY (a.status = 'pending') DESC, a.created_at DESC
  LIMIT 200;
$$;

-- 8.18 Resolve Appeal (Phase 10 — teacher decision: granted / declined)
CREATE OR REPLACE FUNCTION public.resolve_appeal(p_appeal_id UUID, p_status TEXT, p_note TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_status NOT IN ('granted','declined') THEN
    RETURN false;
  END IF;
  UPDATE public.appeals a
  SET status = p_status,
      resolution_note = left(coalesce(p_note,''),1000),
      resolved_at = NOW()
  FROM public.exams e
  WHERE a.id = p_appeal_id
    AND e.id = a.exam_id
    AND e.teacher_id = auth.uid()
    AND a.status = 'pending';
  RETURN FOUND;
END;
$$;


GRANT EXECUTE ON FUNCTION public.upsert_live_session(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_live_sessions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_appeal(UUID, TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_appeals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_appeal(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- SECTION 9 — ADMIN SUPERVISOR RPCS (ADMIN ROLE PROTECTED)
-- ============================================================================

-- 9.1 Admin Get All Profiles
CREATE OR REPLACE FUNCTION public.admin_get_all_profiles()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles ORDER BY created_at DESC;
END;
$$;

-- 9.2 Admin Get All Exams
CREATE OR REPLACE FUNCTION public.admin_get_all_exams()
RETURNS SETOF public.exams
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  RETURN QUERY SELECT * FROM public.exams ORDER BY created_at DESC;
END;
$$;

-- 9.3 Admin Get All Results
CREATE OR REPLACE FUNCTION public.admin_get_all_results()
RETURNS TABLE (
  id UUID,
  exam_id UUID,
  student_name TEXT,
  student_class TEXT,
  student_id_ref TEXT,
  student_type TEXT,
  score NUMERIC,
  total INTEGER,
  correct_count INTEGER,
  wrong_count INTEGER,
  skipped_count INTEGER,
  attempt_number INTEGER,
  time_taken INTEGER,
  answers_data JSONB,
  subject_breakdown JSONB,
  violations INTEGER,
  violation_log JSONB,
  proctor_data JSONB,
  cert_code TEXT,
  created_at TIMESTAMPTZ,
  exams JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;

  RETURN QUERY
  SELECT
    r.id, r.exam_id, r.student_name, r.student_class,
    r.student_id_ref, r.student_type, r.score, r.total,
    r.correct_count, r.wrong_count, r.skipped_count,
    r.attempt_number, r.time_taken, r.answers_data,
    r.subject_breakdown, r.violations, r.violation_log,
    r.proctor_data, r.cert_code, r.created_at,
    jsonb_build_object(
      'subject', e.subject,
      'teacher_id', e.teacher_id,
      'code', e.code,
      'is_multi_subject', e.is_multi_subject
    ) AS exams
  FROM public.results r
  LEFT JOIN public.exams e ON e.id = r.exam_id
  ORDER BY r.created_at DESC;
END;
$$;

-- 9.4 Admin Platform Stats
CREATE OR REPLACE FUNCTION public.admin_get_platform_stats()
RETURNS TABLE (
  total_teachers BIGINT,
  active_teachers BIGINT,
  pending_teachers BIGINT,
  total_exams BIGINT,
  live_exams BIGINT,
  total_results BIGINT,
  total_students BIGINT,
  avg_score NUMERIC,
  pass_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.profiles WHERE role IN ('teacher', 'admin', 'super_admin')) AS total_teachers,
    (SELECT COUNT(*) FROM public.profiles WHERE status = 'active') AS active_teachers,
    (SELECT COUNT(*) FROM public.profiles WHERE status = 'pending') AS pending_teachers,
    (SELECT COUNT(*) FROM public.exams) AS total_exams,
    (SELECT COUNT(*) FROM public.exams WHERE is_open = true AND is_archived = false) AS live_exams,
    (SELECT COUNT(*) FROM public.results) AS total_results,
    (SELECT COUNT(*) FROM public.students) AS total_students,
    COALESCE((SELECT ROUND(AVG((score / NULLIF(total, 0)) * 100), 2) FROM public.results WHERE total > 0), 0) AS avg_score,
    COALESCE((
      SELECT ROUND(
        AVG(CASE WHEN (score / NULLIF(total, 0)) * 100 >= 50 THEN 1 ELSE 0 END) * 100,
        2
      )
      FROM public.results
      WHERE total > 0
    ), 0) AS pass_rate;
END;
$$;

-- 9.5 Admin Set Profile Status
CREATE OR REPLACE FUNCTION public.admin_set_profile_status(p_id UUID, p_status TEXT, p_reason TEXT DEFAULT '')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  IF p_status NOT IN ('pending', 'active', 'inactive', 'suspended') THEN
    RAISE EXCEPTION 'Invalid status: use pending, active, inactive or suspended';
  END IF;
  IF p_id = auth.uid() AND p_status <> 'active' THEN
    RAISE EXCEPTION 'You cannot suspend or deactivate your own account';
  END IF;

  UPDATE public.profiles
  SET status = p_status,
      updated_at = NOW()
  WHERE id = p_id;

  PERFORM public.log_audit_event('admin_set_profile_status', 'profile', p_id::TEXT,
    jsonb_build_object('status', p_status, 'reason', p_reason));
END;
$$;

-- 9.6 Admin Bulk Set Profile Status (Role & Status Manager bulk actions)
CREATE OR REPLACE FUNCTION public.admin_bulk_set_profile_status(p_ids UUID[], p_status TEXT, p_reason TEXT DEFAULT '')
RETURNS TABLE (updated INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  IF p_status NOT IN ('pending', 'active', 'inactive', 'suspended') THEN
    RAISE EXCEPTION 'Invalid status: use pending, active, inactive or suspended';
  END IF;

  UPDATE public.profiles
     SET status = p_status, updated_at = NOW()
   WHERE id = ANY(p_ids)
     AND id <> auth.uid();   -- never lock yourself out with a bulk action

  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.log_audit_event('admin_bulk_set_profile_status', 'profiles', p_ids::TEXT,
    jsonb_build_object('status', p_status, 'count', v_count, 'reason', p_reason));
  RETURN QUERY SELECT v_count;
END;
$$;

-- 9.7 Admin Set Profile Role
CREATE OR REPLACE FUNCTION public.admin_set_profile_role(p_id UUID, p_role TEXT, p_status TEXT DEFAULT 'active')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  IF p_role NOT IN ('super_admin', 'admin', 'teacher', 'student') THEN
    RAISE EXCEPTION 'Invalid role: use super_admin, admin, teacher or student';
  END IF;
  IF p_role = 'super_admin' AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Only a super_admin can grant super_admin';
  END IF;

  UPDATE public.profiles
  SET role = p_role,
      is_admin = (p_role IN ('admin', 'super_admin')),
      status = p_status,
      updated_at = NOW()
  WHERE id = p_id;

  PERFORM public.log_audit_event('admin_set_profile_role', 'profile', p_id::TEXT, jsonb_build_object('role', p_role, 'status', p_status));
END;
$$;

-- 9.8 Admin Delete Profile
CREATE OR REPLACE FUNCTION public.admin_delete_profile(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  IF p_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  DELETE FROM public.profiles WHERE id = p_id;
  PERFORM public.log_audit_event('admin_delete_profile', 'profile', p_id::TEXT, '{}'::jsonb);
END;
$$;

-- 9.9 Admin Get Audit Logs (paginated + filterable — powers the Audit page)
CREATE OR REPLACE FUNCTION public.admin_get_audit_logs(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
  p_action TEXT DEFAULT '',
  p_actor TEXT DEFAULT '',
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF public.audit_logs
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  RETURN QUERY
  SELECT * FROM public.audit_logs
  WHERE (p_action = '' OR action ILIKE '%' || p_action || '%')
    AND (p_actor = '' OR actor_email ILIKE '%' || p_actor || '%' OR action ILIKE '%' || p_actor || '%')
    AND (p_from IS NULL OR created_at >= p_from)
    AND (p_to IS NULL OR created_at < p_to)
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 1000)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

-- 9.10 Admin Audit Log Stats (charts on the Audit page)
CREATE OR REPLACE FUNCTION public.admin_get_audit_stats()
RETURNS TABLE (
  total_events BIGINT,
  events_24h BIGINT,
  events_7d BIGINT,
  unique_actors BIGINT,
  first_event TIMESTAMPTZ,
  last_event TIMESTAMPTZ,
  top_actions JSONB,
  daily_counts JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.audit_logs),
    (SELECT COUNT(*) FROM public.audit_logs WHERE created_at > NOW() - INTERVAL '24 hours'),
    (SELECT COUNT(*) FROM public.audit_logs WHERE created_at > NOW() - INTERVAL '7 days'),
    (SELECT COUNT(DISTINCT actor_email) FROM public.audit_logs),
    (SELECT MIN(created_at) FROM public.audit_logs),
    (SELECT MAX(created_at) FROM public.audit_logs),
    (SELECT COALESCE(jsonb_object_agg(action, c), '{}'::jsonb)
       FROM (SELECT action, COUNT(*) c FROM public.audit_logs
             GROUP BY action ORDER BY COUNT(*) DESC LIMIT 15) t),
    (SELECT COALESCE(jsonb_object_agg(to_char(d, 'YYYY-MM-DD'), c), '{}'::jsonb)
       FROM (SELECT date_trunc('day', created_at) d, COUNT(*) c FROM public.audit_logs
             WHERE created_at > NOW() - INTERVAL '30 days'
             GROUP BY 1 ORDER BY 1) t);
END;
$$;

-- 9.11 Admin Purge Audit Logs (OWNER ONLY, with archive-first semantics:
--      returns the purged rows as JSON so the caller can save them BEFORE
--      the client deletes them — the client MUST upload the archive first)
CREATE OR REPLACE FUNCTION public.admin_purge_audit_logs(p_before TIMESTAMPTZ)
RETURNS TABLE (purged INTEGER, archived JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER; v_rows JSONB;
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not authorized: super_admin (owner) access required to purge audit logs';
  END IF;
  IF p_before IS NULL OR p_before > NOW() - INTERVAL '7 days' THEN
    RAISE EXCEPTION 'Refusing to purge: keep at least the last 7 days of audit history';
  END IF;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_rows
    FROM (SELECT * FROM public.audit_logs WHERE created_at < p_before ORDER BY created_at) t;

  DELETE FROM public.audit_logs WHERE created_at < p_before;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM public.log_audit_event('admin_purge_audit_logs', 'audit_logs', '', jsonb_build_object('purged', v_count, 'before', p_before));
  RETURN QUERY SELECT v_count, v_rows;
END;
$$;

-- 9.12 Admin Get Institutions
CREATE OR REPLACE FUNCTION public.admin_get_institutions()
RETURNS SETOF public.institutions
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  RETURN QUERY SELECT * FROM public.institutions ORDER BY created_at ASC;
END;
$$;

-- ============================================================================
-- SECTION 10 — STORAGE MANAGER & DATA PORTABILITY RPCS
-- ============================================================================

-- 10.1 Table statistics for the Storage Manager (row counts + physical sizes
--      so admins can see exactly what consumes the 500 MB free-tier DB)
CREATE OR REPLACE FUNCTION public.admin_table_stats()
RETURNS TABLE (table_name TEXT, row_count BIGINT, total_bytes BIGINT, pretty_size TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;

  RETURN QUERY
  SELECT c.relname::TEXT,
         (xpath('/row/c/text()', query_to_xml(format('SELECT COUNT(*) AS c FROM public.%I', c.relname), FALSE, TRUE, '')))[1]::TEXT::BIGINT,
         pg_total_relation_size(c.oid),
         pg_size_pretty(pg_total_relation_size(c.oid))
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN ('institutions','profiles','exams','results','students','audit_logs','system_backups','site_license','platform_settings','sc_heartbeat')
  ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$;

-- 10.2 Browse a whitelisted table (paginated, newest first) — Admin Data page
CREATE OR REPLACE FUNCTION public.admin_browse_table(
  p_table TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE v_result JSONB;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  IF p_table NOT IN ('exams','results','students','profiles','audit_logs','system_backups','institutions','client_registrations') THEN
    RAISE EXCEPTION 'Table % is not browsable through this RPC', p_table;
  END IF;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (
       SELECT * FROM public.%I ORDER BY created_at DESC LIMIT %s OFFSET %s
     ) t', p_table, LEAST(GREATEST(p_limit,1),500), GREATEST(p_offset,0))
  INTO v_result;

  RETURN v_result;
END;
$$;

-- 10.3 Delete rows from a whitelisted table by id (OWNER ONLY, audit-logged)
CREATE OR REPLACE FUNCTION public.admin_delete_table_rows(p_table TEXT, p_ids UUID[])
RETURNS TABLE (deleted INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER;
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not authorized: super_admin (owner) access required for destructive operations';
  END IF;
  IF p_table NOT IN ('exams','results','students','audit_logs','system_backups') THEN
    RAISE EXCEPTION 'Table % is not deletable through this RPC', p_table;
  END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No row ids supplied';
  END IF;
  IF array_length(p_ids, 1) > 1000 THEN
    RAISE EXCEPTION 'Delete at most 1000 rows per call — archive first, then delete in batches';
  END IF;

  EXECUTE format('DELETE FROM public.%I WHERE id = ANY($1)', p_table) USING p_ids;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM public.log_audit_event('admin_delete_table_rows', p_table, p_ids::TEXT, jsonb_build_object('deleted', v_count));
  RETURN QUERY SELECT v_count;
END;
$$;

-- 10.4 Purge old results AFTER they were archived (OWNER ONLY).
--      The client uploads the archive JSON to the archive-vault bucket FIRST
--      and passes p_archive_path as proof; the path is recorded in the audit log.
CREATE OR REPLACE FUNCTION public.admin_purge_old_results(
  p_before TIMESTAMPTZ,
  p_archive_path TEXT DEFAULT ''
)
RETURNS TABLE (purged INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER;
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not authorized: super_admin (owner) access required';
  END IF;
  IF p_before IS NULL OR p_before > NOW() - INTERVAL '1 day' THEN
    RAISE EXCEPTION 'Refusing to purge results newer than 24 hours';
  END IF;
  IF COALESCE(p_archive_path, '') = '' THEN
    RAISE EXCEPTION 'Refusing to purge without an archive path — export or archive the results first';
  END IF;

  DELETE FROM public.results WHERE created_at < p_before;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM public.log_audit_event('admin_purge_old_results', 'results', p_archive_path, jsonb_build_object('purged', v_count, 'archive_path', p_archive_path, 'before', p_before));
  RETURN QUERY SELECT v_count;
END;
$$;

-- 10.5 Restore archived rows back into the database (OWNER ONLY).
--      Accepts the JSON envelope produced by the archive vault and re-inserts
--      rows idempotently (ON CONFLICT DO NOTHING) for whitelisted tables.
CREATE OR REPLACE FUNCTION public.admin_restore_archived_rows(p_table TEXT, p_rows JSONB)
RETURNS TABLE (restored INTEGER, skipped INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER; v_total INTEGER;
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not authorized: super_admin (owner) access required';
  END IF;
  IF p_table NOT IN ('results','audit_logs','students','system_backups') THEN
    RAISE EXCEPTION 'Table % is not restorable through this RPC', p_table;
  END IF;
  IF NOT jsonb_typeof(p_rows) = 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array of row objects';
  END IF;

  v_total := jsonb_array_length(p_rows);

  EXECUTE format(
    'WITH ins AS (
       INSERT INTO public.%I
       SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1)
       ON CONFLICT DO NOTHING
       RETURNING 1
     ) SELECT COUNT(*) FROM ins', p_table, p_table)
  INTO v_count USING p_rows;

  PERFORM public.log_audit_event('admin_restore_archived_rows', p_table, '', jsonb_build_object('restored', v_count, 'skipped', v_total - v_count));
  RETURN QUERY SELECT v_count, (v_total - v_count);
END;
$$;

-- 10.6 Log a backup event (Drive sync / envelope / local JSON history)
CREATE OR REPLACE FUNCTION public.log_backup_event(
  p_backup_name TEXT,
  p_provider TEXT DEFAULT 'google_drive',
  p_drive_file_id TEXT DEFAULT '',
  p_drive_file_url TEXT DEFAULT '',
  p_file_size_bytes BIGINT DEFAULT 0,
  p_total_records INTEGER DEFAULT 0,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;

  INSERT INTO public.system_backups (backup_name, provider, drive_file_id, drive_file_url, file_size_bytes, total_records, metadata)
  VALUES (
    LEFT(COALESCE(p_backup_name, 'backup'), 200),
    COALESCE(NULLIF(p_provider, ''), 'google_drive'),
    LEFT(COALESCE(p_drive_file_id, ''), 300),
    LEFT(COALESCE(p_drive_file_url, ''), 1000),
    GREATEST(0, COALESCE(p_file_size_bytes, 0)),
    GREATEST(0, COALESCE(p_total_records, 0)),
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

-- 10.7 List backup history
CREATE OR REPLACE FUNCTION public.admin_get_drive_backups(p_limit INTEGER DEFAULT 50)
RETURNS SETOF public.system_backups
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;
  RETURN QUERY SELECT * FROM public.system_backups ORDER BY created_at DESC LIMIT LEAST(GREATEST(p_limit,1),200);
END;
$$;

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

-- ============================================================================
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
-- Phase 10: no direct policies on live_sessions / appeals — all access goes
-- through the SECURITY DEFINER RPCs above (student pings + teacher queues).
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

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

-- 11.8b Client Registrations — RPC-only access (admin-gated RPCs read/write
--      through SECURITY DEFINER; direct table access is denied to everyone).
ALTER TABLE public.client_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct client registry access" ON public.client_registrations;
CREATE POLICY "No direct client registry access" ON public.client_registrations
  FOR ALL USING (false) WITH CHECK (false);

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

-- 11.11 Phase 10 live_sessions / appeals — same pattern: direct table access
--      revoked; students ping through upsert_live_session(), candidates file
--      appeals through submit_appeal(), teachers read/resolve through their
--      ownership-checked RPCs. No REST access for either role.
REVOKE ALL ON TABLE public.live_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.appeals FROM anon, authenticated;

-- ============================================================================
-- SECTION 12 — FILE-STORAGE ARCHIVE VAULT (free-tier database offloading)
-- ============================================================================
-- The free tier gives each project ~500 MB of DATABASE space but a SEPARATE
-- 1 GB of FILE STORAGE. The Storage Manager moves old/cold rows (old CBT
-- results, aged audit logs) into a PRIVATE bucket as portable JSON archives,
-- then purges them from the database — keeping the database tiny forever.
-- Archives can be listed, downloaded and RESTORED at any time.
DO $vault$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage schema not present (local test database) — archive bucket skipped.';
    RETURN;
  END IF;

  -- 1. Private bucket (50 MB per archive file is far more than needed)
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('archive-vault', 'archive-vault', FALSE, 52428800, ARRAY['application/json'])
  ON CONFLICT (id) DO NOTHING;

  -- 2. Admin-only policies on storage.objects for this bucket
  EXECUTE 'DROP POLICY IF EXISTS "cbt archive admin read" ON storage.objects';
  EXECUTE 'CREATE POLICY "cbt archive admin read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''archive-vault'' AND public.is_platform_admin())';

  EXECUTE 'DROP POLICY IF EXISTS "cbt archive admin write" ON storage.objects';
  EXECUTE 'CREATE POLICY "cbt archive admin write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''archive-vault'' AND public.is_platform_admin())';

  EXECUTE 'DROP POLICY IF EXISTS "cbt archive admin update" ON storage.objects';
  EXECUTE 'CREATE POLICY "cbt archive admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = ''archive-vault'' AND public.is_platform_admin()) WITH CHECK (bucket_id = ''archive-vault'' AND public.is_platform_admin())';

  EXECUTE 'DROP POLICY IF EXISTS "cbt archive admin delete" ON storage.objects';
  EXECUTE 'CREATE POLICY "cbt archive admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''archive-vault'' AND public.is_platform_admin())';

  RAISE NOTICE 'Archive vault ready: private bucket "archive-vault" (admin-only).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Archive bucket setup skipped (%). You can create a private bucket named "archive-vault" from Dashboard → Storage instead.', SQLERRM;
END
$vault$;

-- ============================================================================
-- SECTION 13 — TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_exams_updated_at ON public.exams;
CREATE TRIGGER trg_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_institutions_updated_at ON public.institutions;
CREATE TRIGGER trg_institutions_updated_at
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_site_license_updated_at ON public.site_license;
CREATE TRIGGER trg_site_license_updated_at
  BEFORE UPDATE ON public.site_license
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER trg_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_client_registrations_updated_at ON public.client_registrations;
CREATE TRIGGER trg_client_registrations_updated_at
  BEFORE UPDATE ON public.client_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_results_updated_at ON public.results;
CREATE TRIGGER trg_results_updated_at
  BEFORE UPDATE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_students_updated_at ON public.students;
CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
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
-- SECTION 15 — LAYER 4: PG_CRON INTERNAL HEARTBEAT (best effort)
-- ============================================================================
-- An additional FULLY-INTERNAL keep-alive: the database schedules itself
-- every 2 days. Wrapped so installation never fails where pg_cron is
-- unavailable (all external layers keep protecting the project regardless).
DO $cronsetup$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
      PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cbt-keep-alive';
      PERFORM cron.schedule('cbt-keep-alive', '23 5 */2 * *', $job$ SELECT public.sc_keep_alive('pg_cron'); $job$);
      RAISE NOTICE 'cbt-keep-alive pg_cron job scheduled (every 2 days at 05:23 UTC).';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron keep-alive not scheduled (%). External heartbeats still protect the project.', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron extension not available; relying on site-visit + GitHub Actions + Edge/UptimeRobot heartbeats.';
  END IF;
END
$cronsetup$;

-- ============================================================================
-- SECTION 16 — POST-INSTALL VERIFICATION (informational, safe to run)
-- ============================================================================
-- Run these in the SQL Editor to confirm the installation:
--
--   SELECT * FROM public.get_heartbeat_status();          -- heartbeat row alive
--   SELECT public.sc_keep_alive('manual-test');           -- returns a timestamp
--   SELECT model, status, grace_days FROM public.site_license;
--   SELECT institution_name, lockdown_mode FROM public.platform_settings;
--   SELECT COUNT(*) FROM pg_tables WHERE schemaname='public';  -- expect 10 tables

-- ============================================================================
-- SCHEMA DEPLOYMENT COMPLETE
--   10 tables • 40+ RPC functions • full RLS • archive-vault bucket
--   heartbeat system with pg_cron • triggers • seed data
-- Idempotent: re-running this file NEVER drops or loses data.
-- ============================================================================
