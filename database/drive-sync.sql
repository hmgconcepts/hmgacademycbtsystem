-- ============================================================================
-- GOOGLE DRIVE SYNC SUBSYSTEM — settings columns, backup registry, RPCs
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
      'log_backup_event',
      'admin_get_drive_backups'
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

ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_client_id TEXT DEFAULT '';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_folder_id TEXT DEFAULT '';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_sync_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_sync_days INTEGER DEFAULT 7;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS drive_last_backup TIMESTAMPTZ;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS license_token TEXT DEFAULT '';
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS license_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS last_keepalive_at TIMESTAMPTZ DEFAULT NOW();

-- exams: advanced proctoring / scheduling columns (added v3.1)


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

COMMIT;
