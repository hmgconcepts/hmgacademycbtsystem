# Database — Complete Schema & Module Files

This folder holds **every piece of SQL and sample data** the platform needs.
Follow the one-step install below and nothing else is required.

## 1. The one file that matters — `complete-schema.sql`

| | |
|---|---|
| **What it is** | The complete, all-inclusive platform schema: 10 tables, 41+ RPC functions, full Row-Level Security, indexes, triggers, the private `archive-vault` storage bucket, the keep-alive heartbeat system (with a best-effort `pg_cron` job), and starter seed rows. |
| **When to run** | **Once, on a fresh Supabase project**, in the Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run). |
| **Idempotent?** | **Yes — safe to run repeatedly.** Every table uses `CREATE TABLE IF NOT EXISTS`, every function `CREATE OR REPLACE FUNCTION`, every policy `DROP POLICY IF EXISTS → CREATE POLICY`, every seed `ON CONFLICT DO NOTHING`. Re-running never drops or loses data. |
| **Do I need any other SQL after it?** | **No.** No other file in this folder (or anywhere) is required. The module files below are optional maintenance extracts of subsystems that are already inside the master file. |

### Post-install verification (optional, read-only)

```sql
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';   -- expect 10 tables
SELECT * FROM public.get_heartbeat_status();                   -- heartbeat row alive
SELECT public.sc_keep_alive('manual-test');                    -- returns a timestamp
SELECT institution_name, lockdown_mode FROM public.platform_settings;
```

## 2. Module files — optional maintenance extracts

Each module below is a **self-contained extract of one subsystem** from
`complete-schema.sql`. Use them when you need to repair or inspect a single
subsystem on an existing installation without re-running the whole schema.
They are all idempotent and can be run in any order.

| File | Subsystem | Use it when… |
|---|---|---|
| `keep-alive.sql` | `sc_heartbeat` table, `sc_keep_alive()` / `keep_alive_ping()` / `get_heartbeat_status()` RPCs, `pg_cron` job | Platform Health reports the heartbeat RPC missing, or a paused-project recovery |
| `security-hardening.sql` | `is_platform_admin()` / `is_platform_owner()` / `is_owner()` guards + the full RLS policy set for all 10 tables | You want to re-assert Row-Level Security after manual table changes, or audit policies |
| `drive-sync.sql` | Google Drive settings columns, `system_backups` registry, `log_backup_event()` / `admin_get_drive_backups()` | Drive sync on the Admin Data page cannot find backup history |
| `storage-offload.sql` | Private `archive-vault` bucket + `admin_table_stats()` / `admin_browse_table()` / `admin_delete_table_rows()` / `admin_purge_old_results()` / `admin_restore_archived_rows()` | Storage Manager shows "vault unavailable" or browse/purge RPCs missing |
| `demo-seed.sql` | `admin_seed_demo_data()` / `admin_purge_test_results()` + starter seed rows | You want demo data from SQL instead of the Admin Data page button |
| `demo-users.sql` | Creates **demo teacher + admin login accounts** (bcrypt via pgcrypto) | Evaluation/training deployments — see the removal block inside before production |

## 3. Sample data files (CSV)

| File | Format | Where it is used |
|---|---|---|
| `sample-question-bank.csv` | `Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,Accept,MRQ_AON,Pairs,Items,Difficulty,Tags,Section` | Teacher Hub → Create/Import exam (CSV). Covers mcq, mrq, true_false, short_answer, numeric, matching, ordering, fill_blank. |
| `students_import_template.csv` | `full_name,student_id,class` | Teacher Hub → Students → Import Students (CSV). Replace the sample rows with your roster and upload. |
| `further_maths_sample.csv` | Same question-bank format, Further Mathematics questions | Teacher Hub → CSV import; also the reference file for math-keyboard question types. |

> **Import tips:** quote any cell that contains a comma; leave option columns
> blank for non-MCQ types; `CorrectAnswer` for multi-answer questions is a
> comma-separated option list (e.g. `A,C`); `Pairs` uses `Label::Value` joined
> by pipes; `Accept` lists alternative spellings a short answer may match.

## 4. Upgrading an existing deployment

1. Back up first (Admin Data → JSON Envelope export, or Drive sync).
2. Replace the site files with the new package.
3. Re-run `database/complete-schema.sql` — it is safe: it only ADDS missing
   objects (tables, columns via `ADD COLUMN IF NOT EXISTS`, functions,
   policies, indexes) and never drops data.
