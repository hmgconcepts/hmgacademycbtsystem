# PHASE 7 — SHARE-LINK BUG & COMPLETE SCHEMA AUDIT

**Date:** 2026-09-11 · **Scope:** HMG Academy CBT Pro + generator templates · **Method:** expert end-to-end review, every finding verified on a real PostgreSQL 17 instance before shipping.

---

## Issue 1 — Exam share links opened the teacher login page ✅

**Symptom:** sharing `https://hmgcbtsystem.vercel.app/teacher?code=FIXV1O` took students to the teacher login instead of the exam.

**Root cause:** all 9 share-link builders in `teacher.html` derived the student URL with
`window.location.href.replace(/teacher[^/]*\.html.*/i, 'student.html')` — a regex that only matches `teacher.html`. On the live deployment (Vercel clean URLs) the page address is `/teacher` with no extension, so the replacement never fired and the link stayed on the teacher page. The certificate-verification link builder had the same flaw.

**Fix (all 9 builders + the certificate builder):**
```js
window.location.href.replace(/[?#].*$/, '')      // strip any ?code= / #hash first
  .replace(/\/teacher(\.html)?$/i, '/student.html')  // works for /teacher AND /teacher.html
```
Verified against every URL shape: `/teacher?code=X`, `/teacher.html?code=X`, GitHub Pages subpaths, and local `file://` use. The student portal already auto-reads `?code=` / `?exam=` / `?c=` parameters, so shared links now open straight into the exam runner.

## Issue 2 — `ERROR 42703: column s.status does not exist` + full schema audit ✅

**Root cause (expert diagnosis):** the master schema's `students` table *does* define `status` — but the live database was created by an **older build whose `students` table had no `status` column**. `CREATE TABLE IF NOT EXISTS` silently skips existing tables, so newer columns never reach older databases. Phase 5's Section 0 then drops and recreates every function — and `verify_student_for_exam` references `s.status`, so its creation fails against the drifted table. The error is one symptom of a whole bug class: **schema drift between deployments**.

### Audit findings (whole file, beginning → end)

| # | Finding | Class | Fix |
|---|---|---|---|
| 1 | Old databases never receive columns added in newer builds (`students.status` was the reported case; any column can be next) | **Confirmed bug** | **SECTION 3.9 — COMPLETE COLUMN RECONCILIATION**: every column of every table (150 statements, 10 tables) is now re-asserted with `ADD COLUMN IF NOT EXISTS`; NOT NULL columns without a master default carry a safe fallback default so the statement can never fail on a table holding rows. Any deployment of any vintage is upgraded to the master shape in one pass |
| 2 | Legacy databases can also be missing UNIQUE constraints → duplicate exam codes / profile emails / roster IDs silently break lookups | Potential bug | Guarded constraint reconciliation for `exams_code_key`, `profiles_email_key`, `institutions_slug_key`, `students_teacher_id_student_id_key` — skipped with a NOTICE (never an abort) when duplicates exist |
| 3 | `submit_student_result` feeds `exams.csv_data` straight into `jsonb_array_elements` — a non-array value (legacy row, repaired database) would 500 every submission | Potential bug | `CASE WHEN jsonb_typeof(e.csv_data) = 'array' …ELSE '[]'::jsonb` guard |
| 4 | Function-layer drop list, policies (24× DROP+CREATE), triggers (9×), indexes (all IF NOT EXISTS), grants, pg_cron section | **Verified healthy** | no change needed |
| 5 | All SECURITY DEFINER functions pin `SET search_path`; no plpgsql OUT-param shadowing; anon grants limited to 4 safe functions | **Verified healthy** | no change needed |

### Verification on a real PostgreSQL 17 instance (`analysis/schema_pg_verify.sh`)

1. **Reproduced the user's exact database** — legacy `students` without `status`, with rows → ran `complete-schema.sql` → **clean success** (previously `ERROR 42703`).
2. **Idempotency** — second full run: clean success.
3. **Harsher drift** — dropped 6 more columns + the exam-code UNIQUE constraint, re-ran: everything self-healed, constraint restored.
4. **Functional RPC smoke** — keep-alive, heartbeat, public settings, `get_public_exam_by_code`, `verify_student_for_exam` (the failing function), `submit_student_result`, `verify_certificate`, audit logging, attempt counting, admin stats (with its auth guard correctly refusing unauthenticated calls).
5. **Module extracts** — all 5 (`keep-alive`, `security-hardening`, `drive-sync`, `storage-offload`, `demo-seed`) install cleanly **twice** on the upgraded database.
6. **Static analysis** (`analysis/schema_static_test.py`) — all 150 columns reconciled, drop list covers all 41 functions, no comment-swallowed semicolons, every SECURITY DEFINER function pins `search_path`, function bodies reference only existing columns.

**What the user should do:** simply re-run `database/complete-schema.sql` in the Supabase SQL editor — the drifted live database is upgraded in place; no manual repair, no data loss (tables and rows are never touched; only missing columns/constraints/functions are added).

## Issue 3 — Every file updated across all repos ✅

- `teacher.html` link fix + schema changes synced into the generator's `templates/` with credential + site-URL tokenisation.
- New regression tests wired into the standing suites: `teacher_fix_test.js` (5 new link checks), `schema_static_test.py`, `schema_pg_verify.sh`, HTTP smoke +4 checks.
- This report ships inside both packages.

## Verification summary

| Suite | Result |
|---|---|
| Schema on real PostgreSQL 17 (legacy → upgrade → idempotent → harsh drift → RPC smoke → modules ×2) | ✅ all pass |
| Schema static analysis | ✅ 10 checks |
| Teacher fixes (incl. link builders) | ✅ 18 checks |
| All other standing suites (prompt studio, audit, csv-bridge, guard, runtime, calc, license, multi-subject, sample banks, submit integration) | ✅ pass |
| HTTP smoke | ✅ 104 checks |
