-- ============================================================================
-- KEEP-ALIVE / HEARTBEAT SUBSYSTEM (Layer 0 + Layer 4)
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
      'sc_keep_alive',
      'keep_alive_ping',
      'get_heartbeat_status'
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


CREATE TABLE IF NOT EXISTS public.sc_heartbeat (
  id          INTEGER PRIMARY KEY,
  last_ping   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_source TEXT,
  ping_count  BIGINT NOT NULL DEFAULT 0
);

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

GRANT EXECUTE ON FUNCTION public.sc_keep_alive(TEXT) TO anon, authenticated;

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


COMMIT;
