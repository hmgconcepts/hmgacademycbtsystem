-- ============================================================================
-- HMG ACADEMY CBT PRO — PLATFORM INTEGRATION PACK (Phase 12N)
-- ----------------------------------------------------------------------------
-- WHAT THIS PACK ADDS (robust, all-inclusive, self-contained, seamless):
--
--   1. FLEET-CONSOLE-COMPATIBLE KEEP-ALIVE
--      sc_keep_alive() now accepts BOTH parameter names:
--          {"src":  "..."}  ← HMG Fleet Console + School Connect style
--          {"p_src":"..."}  ← this platform's own layers (site-visit,
--                             GitHub Actions, Vercel Cron, pg_cron, …)
--      Existing callers keep working unchanged; the Fleet Console's
--      one-click ping (body {"src":"hmg-fleet-console"}) now lands in the
--      heartbeat row and is VISIBLE on the Platform Health console with
--      its source.
--
--   2. sc_keepalive VIEW — the read shape the HMG Fleet Console uses to
--      display heartbeat age for every project it monitors
--      (GET /rest/v1/sc_keepalive?select=pinged_at&limit=1, anon key).
--      Exposes ONLY the timestamp + source of the single heartbeat row.
--
--   3. sc_license_status() RPC — Fleet Console / external monitors can read
--      the license state (model, plan, expiry, grace, lock) in one call.
--
--   4. login_audit TABLE + RLS — every sign-in / sign-out / idle-lock is
--      recorded automatically (email, event, user agent). Admins review it
--      on the Activity Log page and the Platform Health console.
--
--   5. user_security_prefs TABLE + RLS — per-account "2-Factor (email OTP)"
--      preference used by the Settings page and the sign-in flow.
--
--   6. sc_install_state TABLE + sc_installed_packs() RPC — the marker
--      registry the Schema Doctor reads to prove which SQL packs ran.
--
--   7. students.gender + students.date_of_birth — optional demographic
--      columns for the Analytics page (gender split + birthday cards).
--      Both default to empty — nothing breaks when they are not filled.
--
--   8. platform_settings.auto_id_prefix + auto_id_year — auto-generated
--      candidate numbers (PREFIX/NNNN or PREFIX/YYYY/NNNN) applied by the
--      teacher's student import when the CSV leaves the ID column blank.
--
--   9. sc_relink_accounts() RPC — one-click re-link after Disaster
--      Recovery: when teachers sign up again in a fresh project, this
--      re-points students/exams/audit rows from the OLD auth ids to the
--      NEW ones by matching emails (bridge built BEFORE ids are touched).
--
--  Idempotent — safe to run repeatedly. Run in the Supabase SQL Editor.
--  (Also embedded in database/complete-schema.sql for fresh installs.)
-- ============================================================================

SELECT 'RUNNING: HMG CBT Pro platform-integration pack (Phase 12N)' AS running_version;

-- ══════════════════════════════════════════════════════════════════════════
-- 1. FLEET-CONSOLE-COMPATIBLE KEEP-ALIVE RPC
-- ══════════════════════════════════════════════════════════════════════════
-- The heartbeat row must exist (complete-schema / keep-alive.sql create it;
-- re-assert here so this pack also heals a half-installed database).
CREATE TABLE IF NOT EXISTS public.sc_heartbeat (
  id          INTEGER PRIMARY KEY,
  last_ping   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_source TEXT,
  ping_count  BIGINT NOT NULL DEFAULT 0
);

INSERT INTO public.sc_heartbeat (id, last_ping, last_source, ping_count)
VALUES (1, NOW(), 'schema-install', 0)
ON CONFLICT (id) DO NOTHING;

-- Replace the old 1-parameter signature with the dual-name version.
-- DROP first: CREATE OR REPLACE cannot change the argument list, and leaving
-- both overloads alive would make PostgREST resolve old callers ambiguously.
/* 12N-2: drop EVERY existing overload of sc_keep_alive (the Fleet
   Console's Ops-Toolkit snippet installs sc_keep_alive(src text) writing
   to its own table; older phases shipped the 1-arg p_src version; any
   other variant may exist). One clean canonical function follows below. */
DO $kareset$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'sc_keep_alive'
  LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION public.%I(%s)', fn.name, fn.args);
      RAISE NOTICE 'keep-alive reset: dropped sc_keep_alive(%)', fn.args;
    EXCEPTION WHEN undefined_function THEN NULL;
              WHEN dependent_objects_still_exist THEN NULL;
    END;
  END LOOP;
END
$kareset$;

CREATE FUNCTION public.sc_keep_alive(src TEXT DEFAULT NULL, p_src TEXT DEFAULT NULL)
RETURNS TIMESTAMPTZ
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $keepalive$
  UPDATE public.sc_heartbeat
     SET last_ping   = NOW(),
         last_source = LEFT(COALESCE(NULLIF(src, ''), NULLIF(p_src, ''), 'unknown'), 40),
         ping_count  = ping_count + 1
   WHERE id = 1
  RETURNING last_ping;
$keepalive$;

GRANT EXECUTE ON FUNCTION public.sc_keep_alive(TEXT, TEXT) TO anon, authenticated;

-- The legacy alias keeps working (first positional arg is now `src` —
-- identical behaviour: the source label is recorded).
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

-- ══════════════════════════════════════════════════════════════════════════
-- 2. sc_keepalive VIEW — the Fleet Console's heartbeat read shape
-- ══════════════════════════════════════════════════════════════════════════
-- HMG Fleet Console shows per-project heartbeat age by reading:
--     GET {project}/rest/v1/sc_keepalive?select=pinged_at&limit=1
-- This view exposes exactly that (plus the source, for richer consoles).
-- A view has no RLS and runs as its owner — it can only ever return this
-- single row, so it leaks nothing.
/* 12N-2 ROBUST INSTALL: the Fleet Console's Ops-Toolkit snippet creates a
   TABLE named public.sc_keepalive (id, pinged_at, src). On a database that
   ran that snippet first, a plain CREATE OR REPLACE VIEW fails with
   SQLSTATE 42809 ("sc_keepalive" is not a view). This guard preserves the
   legacy table's ping history into sc_heartbeat, retires it, then installs
   the view -- seamless on fresh, upgraded AND console-prepared databases. */
DO $keepaliveview$
DECLARE
  v_kind "char";
  v_rec  RECORD;
  v_ping TIMESTAMPTZ := NULL;
  v_src  TEXT := NULL;
  v_cnt  BIGINT := 0;
BEGIN
  SELECT c.relkind INTO v_kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'sc_keepalive';

  IF v_kind IS NULL OR v_kind = 'v' THEN
    RAISE NOTICE 'sc_keepalive: % - CREATE OR REPLACE VIEW handles it',
      CASE WHEN v_kind IS NULL THEN 'nothing exists yet' ELSE 'view already installed' END;
    RETURN;
  END IF;

  IF v_kind IN ('r', 'p') THEN
    RAISE NOTICE 'sc_keepalive: legacy TABLE found (Fleet Console Ops-Toolkit snippet or older install) - migrating its ping history, then retiring it';
    BEGIN
      FOR v_rec IN EXECUTE
        'SELECT pinged_at AS ping, src AS src FROM public.sc_keepalive ORDER BY pinged_at DESC LIMIT 1'
      LOOP
        v_ping := v_rec.ping; v_src := v_rec.src;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        FOR v_rec IN EXECUTE
          'SELECT created_at AS ping, NULL::text AS src FROM public.sc_keepalive ORDER BY created_at DESC LIMIT 1'
        LOOP
          v_ping := v_rec.ping;
        END LOOP;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'sc_keepalive: legacy table shape not recognised - nothing to preserve';
      END;
    END;
    BEGIN
      EXECUTE 'SELECT count(*) FROM public.sc_keepalive' INTO v_cnt;
    EXCEPTION WHEN OTHERS THEN
      v_cnt := 0;
    END;
    IF v_ping IS NOT NULL THEN
      INSERT INTO public.sc_heartbeat (id, last_ping, last_source, ping_count)
      VALUES (1, v_ping, LEFT(COALESCE(v_src, 'fleet-console-legacy'), 40), GREATEST(v_cnt, 1))
      ON CONFLICT (id) DO UPDATE SET
        last_ping   = GREATEST(EXCLUDED.last_ping, public.sc_heartbeat.last_ping),
        last_source = CASE WHEN EXCLUDED.last_ping >= public.sc_heartbeat.last_ping
                           THEN EXCLUDED.last_source
                           ELSE public.sc_heartbeat.last_source END,
        ping_count  = public.sc_heartbeat.ping_count + GREATEST(v_cnt, 1);
      RAISE NOTICE 'sc_keepalive: preserved legacy ping % (source: %)', v_ping, COALESCE(v_src, 'n/a');
    END IF;
    EXECUTE 'DROP TABLE public.sc_keepalive CASCADE';
    RAISE NOTICE 'sc_keepalive: legacy table retired - the Fleet Console view takes over';
  ELSIF v_kind = 'm' THEN
    EXECUTE 'DROP MATERIALIZED VIEW public.sc_keepalive';
    RAISE NOTICE 'sc_keepalive: legacy materialized view dropped';
  ELSIF v_kind = 'f' THEN
    EXECUTE 'DROP FOREIGN TABLE public.sc_keepalive';
    RAISE NOTICE 'sc_keepalive: legacy foreign table dropped';
  ELSE
    RAISE EXCEPTION 'public.sc_keepalive exists as an unsupported object type (relkind %). Drop it manually, then re-run this file.', v_kind;
  END IF;
END
$keepaliveview$;

CREATE OR REPLACE VIEW public.sc_keepalive AS
  SELECT last_ping AS pinged_at,
         last_source AS source
    FROM public.sc_heartbeat
   WHERE id = 1;

GRANT SELECT ON public.sc_keepalive TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 3. sc_license_status() — one-call license state for external monitors
-- ══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sc_license_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  l        public.site_license%ROWTYPE;
  v_state  TEXT;
  v_exp    DATE;
  v_grace  DATE;
  v_days   INT;
  v_locked BOOLEAN := false;
BEGIN
  SELECT * INTO l FROM public.site_license WHERE id = 1;

  -- No row (or lifetime model): perpetual license, never locks.
  IF l.id IS NULL OR l.model <> 'subscription' THEN
    RETURN jsonb_build_object(
      'state', 'lifetime', 'locked', false,
      'model',  COALESCE(l.model, 'lifetime'),
      'plan',   COALESCE(l.plan, 'One-time purchase (lifetime ownership)'));
  END IF;

  IF l.status = 'suspended' THEN
    v_locked := true;
    RETURN jsonb_build_object(
      'state', 'suspended', 'locked', true, 'model', l.model, 'plan', l.plan,
      'cycle', l.cycle, 'renew_url', l.renew_url, 'lock_message', l.lock_message,
      'server_date', current_date);
  END IF;

  v_exp := l.expires_on;
  IF v_exp IS NULL THEN
    RETURN jsonb_build_object('state', 'active', 'locked', false, 'model', l.model,
                              'plan', l.plan, 'cycle', l.cycle, 'server_date', current_date);
  END IF;

  v_grace := v_exp + make_interval(days => COALESCE(l.grace_days, 7));
  IF current_date > v_grace THEN
    v_state := 'expired';  v_days := current_date - v_grace;  v_locked := true;
  ELSIF current_date > v_exp THEN
    v_state := 'grace';    v_days := v_grace - current_date;  v_locked := false;
  ELSE
    v_days  := v_exp - current_date;
    v_state := CASE WHEN v_days <= 30 THEN 'warning' ELSE 'active' END;
  END IF;

  RETURN jsonb_build_object(
    'state', v_state, 'days', v_days, 'expires_on', v_exp,
    'grace_days', COALESCE(l.grace_days, 7), 'model', l.model, 'plan', l.plan,
    'cycle', l.cycle, 'status', l.status, 'renew_url', l.renew_url,
    'lock_message', l.lock_message, 'locked', v_locked, 'server_date', current_date);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sc_license_status() TO anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 4. login_audit — who signed in, when, from what browser
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.login_audit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email       TEXT,
  event       TEXT NOT NULL DEFAULT 'login',   -- 'login' | 'logout' | 'idle_lock' | '2fa_challenge' | '2fa_passed'
  ip          TEXT DEFAULT '',
  user_agent  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS login_audit_created_idx ON public.login_audit (created_at DESC);

ALTER TABLE public.login_audit ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can append (their own row — the insert carries their
-- token; the audit write must never break a sign-in).
DROP POLICY IF EXISTS "login_audit_insert" ON public.login_audit;
CREATE POLICY "login_audit_insert" ON public.login_audit
  FOR INSERT TO authenticated WITH CHECK (true);

-- Only platform admins may read the trail.
DROP POLICY IF EXISTS "login_audit_read" ON public.login_audit;
CREATE POLICY "login_audit_read" ON public.login_audit
  FOR SELECT TO authenticated USING (public.is_platform_admin());

GRANT SELECT, INSERT ON public.login_audit TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 5. user_security_prefs — per-account 2-Factor (email OTP) preference
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_security_prefs (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  two_factor  BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_security_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_security_prefs_self" ON public.user_security_prefs;
CREATE POLICY "user_security_prefs_self" ON public.user_security_prefs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════════
-- 6. sc_install_state + sc_installed_packs() — Schema Doctor markers
-- ══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.sc_install_state (
  key          TEXT PRIMARY KEY,          -- the pack file name, e.g. 'keep-alive.sql'
  label        TEXT NOT NULL DEFAULT '',
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sc_install_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sc_install_state_read" ON public.sc_install_state;
CREATE POLICY "sc_install_state_read" ON public.sc_install_state
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.sc_installed_packs()
RETURNS TABLE (key TEXT, label TEXT, installed_at TIMESTAMPTZ)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT key, label, installed_at FROM public.sc_install_state ORDER BY key;
$$;

GRANT EXECUTE ON FUNCTION public.sc_installed_packs() TO anon, authenticated;

-- Marker for THIS pack.
INSERT INTO public.sc_install_state (key, label) VALUES
  ('platform-integration.sql', 'Fleet Console integration, login audit, 2FA prefs, analytics columns')
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, installed_at = NOW();

-- ══════════════════════════════════════════════════════════════════════════
-- 7. students.gender + students.date_of_birth (Analytics page)
-- ══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT '';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS date_of_birth DATE;

COMMENT ON COLUMN public.students.gender IS 'Phase 12N: optional demographics for the Analytics page (male/female/…). Empty = not provided.';
COMMENT ON COLUMN public.students.date_of_birth IS 'Phase 12N: optional birthday tracking on the Analytics page. NULL = not provided.';

-- ══════════════════════════════════════════════════════════════════════════
-- 8. Auto-generated candidate numbers (platform_settings columns)
-- ══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS auto_id_prefix TEXT NOT NULL DEFAULT '';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS auto_id_year   BOOLEAN NOT NULL DEFAULT false;

-- The next candidate number for a prefix (used by the import UI preview and
-- by the teacher's import when the CSV leaves the ID column blank).
-- Works for BOTH formats — PREFIX/NNNN and PREFIX/YYYY/NNNN — by reading the
-- trailing number of every ID that starts with the prefix.
CREATE OR REPLACE FUNCTION public.sc_next_student_id(p_prefix TEXT DEFAULT '', p_year BOOLEAN DEFAULT false)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN p_prefix = '' THEN NULL ELSE
    p_prefix || CASE WHEN p_year THEN '/' || to_char(NOW(), 'YYYY') ELSE '' END || '/' ||
    LPAD(((COALESCE(max((regexp_match(student_id, '(\d+)\s*$'))[1]::int), 0)) + 1)::text, 4, '0')
  END
  FROM public.students
  WHERE student_id LIKE (p_prefix || '%')
$$;

GRANT EXECUTE ON FUNCTION public.sc_next_student_id(TEXT, BOOLEAN) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 9. sc_relink_accounts() — one-click re-link after Disaster Recovery
-- ══════════════════════════════════════════════════════════════════════════
-- Scenario: old project lost, data restored into a FRESH project from the
-- Drive backup. The restored rows still carry the OLD auth ids; teachers
-- sign up again and get NEW ids. This RPC re-links everybody by EMAIL:
--   • a bridge table (old profile id → email → new auth id) is built first,
--     so no step destroys the information the next step needs;
--   • students.teacher_id / exams.teacher_id / audit_logs.actor_id are
--     re-pointed to the new ids;
--   • profiles.id itself is re-labelled to the new id (email stays unique);
--   • a JSON report is returned: counts + still-unmatched emails.
CREATE OR REPLACE FUNCTION public.sc_relink_accounts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_students INT := 0;
  v_exams    INT := 0;
  v_audit    INT := 0;
  v_profiles INT := 0;
  v_unmatched JSONB;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Not authorized: admin access required';
  END IF;

  -- 9.1 bridge: old profile id → email → fresh auth id (built BEFORE edits)
  CREATE TEMP TABLE IF NOT EXISTS _relink_bridge AS
    SELECT p.id AS old_id, p.email, u.id AS new_id
      FROM public.profiles p
      JOIN auth.users u ON lower(u.email) = lower(p.email)
     WHERE p.id <> u.id;

  -- 9.2 re-point owned rows to the fresh ids
  UPDATE public.students s
     SET teacher_id = b.new_id
    FROM _relink_bridge b
   WHERE s.teacher_id = b.old_id;
  GET DIAGNOSTICS v_students = ROW_COUNT;

  UPDATE public.exams e
     SET teacher_id = b.new_id
    FROM _relink_bridge b
   WHERE e.teacher_id = b.old_id;
  GET DIAGNOSTICS v_exams = ROW_COUNT;

  UPDATE public.audit_logs a
     SET actor_id = b.new_id
    FROM _relink_bridge b
   WHERE a.actor_id = b.old_id;
  GET DIAGNOSTICS v_audit = ROW_COUNT;

  -- 9.3 re-label the profiles themselves (after the bridge was consumed)
  UPDATE public.profiles p
     SET id = b.new_id
    FROM _relink_bridge b
   WHERE p.id = b.old_id;
  GET DIAGNOSTICS v_profiles = ROW_COUNT;

  -- 9.4 teachers that have NOT signed up again yet (actionable report)
  SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO v_unmatched
    FROM (SELECT p.email, p.full_name
            FROM public.profiles p
           WHERE p.role IN ('teacher', 'admin', 'super_admin')
             AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(p.email))
           ORDER BY p.email LIMIT 100) x;

  DROP TABLE IF EXISTS _relink_bridge;

  RETURN jsonb_build_object(
    'students_relinked', v_students,
    'exams_relinked',    v_exams,
    'audit_relinked',    v_audit,
    'profiles_relabeled', v_profiles,
    'unmatched',         v_unmatched,
    'hint', 'Unmatched teachers simply sign up again with the same email, then run this once more.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.sc_relink_accounts() TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 10. save_platform_settings — accept the two new auto-ID keys
--     (full function re-created; identical to complete-schema + 2 columns)
-- ══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.save_platform_settings(p_patch JSONB DEFAULT '{}'::jsonb)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.platform_settings%ROWTYPE;
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
  IF p_patch ? 'auto_id_prefix' THEN v_row.auto_id_prefix := UPPER(LEFT(TRIM(BOTH FROM COALESCE(p_patch->>'auto_id_prefix', '')), 12)); END IF;
  IF p_patch ? 'auto_id_year' THEN v_row.auto_id_year := COALESCE((p_patch->>'auto_id_year')::BOOLEAN, false); END IF;

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
    auto_id_prefix = v_row.auto_id_prefix,
    auto_id_year = v_row.auto_id_year,
    updated_at = NOW()
  WHERE id = 1;

  PERFORM public.log_audit_event('save_platform_settings', 'platform_settings', '1',
    jsonb_build_object('keys', (SELECT string_agg(k, ',') FROM jsonb_object_keys(p_patch) k)));
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_platform_settings(JSONB) TO authenticated;

-- ============================================================================
-- PHASE 12N — admin_purge_login_audit: purge old sign-in history (owner-only,
-- keeps at least the last 7 days, returns archived rows for download first).
-- Mirrors admin_purge_audit_logs from complete-schema.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_purge_login_audit(p_before TIMESTAMPTZ)
RETURNS TABLE (purged INTEGER, archived JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER; v_rows JSONB;
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Not authorized: super_admin (owner) access required to purge the sign-in history';
  END IF;
  IF p_before IS NULL OR p_before > NOW() - INTERVAL '7 days' THEN
    RAISE EXCEPTION 'Refusing to purge: keep at least the last 7 days of sign-in history';
  END IF;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_rows
    FROM (SELECT * FROM public.login_audit WHERE created_at < p_before ORDER BY created_at) t;

  DELETE FROM public.login_audit WHERE created_at < p_before;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM public.log_audit_event('admin_purge_login_audit', 'login_audit', '', jsonb_build_object('purged', v_count, 'before', p_before));
  RETURN QUERY SELECT v_count, v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_purge_login_audit(TIMESTAMPTZ) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════
SELECT 'PHASE 12N platform-integration pack: ALL STEPS DONE ✓' AS result;

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
    'auto_id_prefix', auto_id_prefix,
    'auto_id_year', auto_id_year,
    'license', (SELECT jsonb_build_object(
        'model', model, 'plan', plan, 'cycle', cycle,
        'expires_on', expires_on, 'grace_days', grace_days,
        'status', status, 'lock_message', lock_message
      ) FROM public.site_license WHERE id = 1)
  )
  FROM public.platform_settings WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;
