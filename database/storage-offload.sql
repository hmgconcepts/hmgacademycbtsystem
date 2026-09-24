-- ============================================================================
-- STORAGE OFFLOAD — archive-vault bucket + table browse/purge/restore RPCs
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
      'admin_table_stats',
      'admin_browse_table',
      'admin_delete_table_rows',
      'admin_purge_old_results',
      'admin_restore_archived_rows'
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
  IF p_table NOT IN ('exams','results','students','profiles','audit_logs','system_backups','institutions') THEN
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

COMMIT;
