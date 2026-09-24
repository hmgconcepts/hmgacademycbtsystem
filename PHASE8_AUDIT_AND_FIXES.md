# PHASE 8 — New CBT Links "Exam Not Found" Bug: Audit & Fixes

**Product:** HMG Academy CBT Pro (CBT System) — a product of HMG Concepts
**Date:** Phase 8 · 2026-09-14
**Scope:** New assessments published by teachers were unreachable by students; pre-existing assessments kept working. Fixed end-to-end (teacher portal, student portal, database schema), with regression tests. No features removed — behaviour made safe by default and clearly signposted.

---

## 1. The Reported Bug

> "When I create a new CBT and share the link with my students, it gives this error:
> **'Exam not found or not open. Check your exam code or ask your teacher to resend/re-open the link/code. Try another code'**
> But already pre-existing CBT links work and students can take exams."

New links → blocked. Old links → fine. Same portal, same database.

## 2. Root Cause (verified in code and reproduced on a real PostgreSQL 17 database)

The database function that serves exams to the Student Portal deliberately only returns **open** exams:

```sql
-- database/complete-schema.sql → get_public_exam_by_code(p_code)
WHERE upper(trim(e.code)) = upper(trim(p_code))
  AND e.is_archived = false
  AND e.is_open = true            -- ← hard filter
  AND (e.close_at IS NULL OR e.close_at > NOW())
```

On the Teacher Portal, the **"Open Exam Immediately?"** control in the exam creation form defaulted to:

> **"No — Keep locked until I open it manually"**

So every newly created exam was inserted with `is_open = false`. The public RPC returned zero rows, and `student.html` rendered exactly the reported message. Pre-existing exams had already been opened (or were created open under the older deployment), which is why they kept working.

This default was present in the original baseline — it is a design/UX trap, not a regression from any phase: *publishing* an assessment and *sharing* its link both imply "students can now enter", yet the default silently contradicted that. Compounding factors:

1. The toggle sits deep in the "Scheduling & Availability" section — easy to never notice.
2. The success toast said **"✅ Assessment published!"** with no hint the exam was locked.
3. The WhatsApp share message and the printed Access Sheet also looked identical for open and locked exams.
4. Imported exam packages (`.json`) also forced `is_open=false` on publish.
5. The student error could not distinguish *wrong code* from *locked exam* from *not started yet* — teachers got blamed for typos they never made.

## 3. The Fixes

### 3.1 Teacher Portal — open by default (teacher.html)

* **"Open Exam Immediately?" now defaults to "Yes — Open as soon as I publish (recommended)"** (first option, selected). The "No — keep locked" option remains fully available for teachers who want to pre-load exams ahead of time — the feature is preserved, only the default and the labels changed.
* **Imported exam packages** now also publish open (previously forced locked).
* **State-aware publish toast** — after publishing, the teacher sees one of:
  * `✅ Assessment published & OPEN! Code: XXXXXX — share the link, students can enter right away.`
  * `✅ Assessment published (scheduled). Code: XXXXXX — it unlocks automatically at the start time.`
  * `⚠️ Published but LOCKED. Code: XXXXXX — students CANNOT enter yet. Open it under Assessments → ⋮ Actions → Open, then share.`
* **Share-time guardrails** (so a locked exam can never be shared unknowingly again):
  * *WhatsApp share* of a locked, unscheduled exam appends a **TEACHER NOTE** reminding them to open it first.
  * *Copy link* shows `⚠️ This exam is LOCKED — students will see "Exam not found or not open"…` before the copy confirmation.
  * *Printed Access Sheet* now carries a colour-coded status banner — 🟢 OPEN / 🔒 SCHEDULED (with unlock time) / 🔴 LOCKED (with the "open it before handing out this sheet" instruction) / ⚠️ unknown — plus an Opens/Closes schedule line.

### 3.2 Student Portal — precise status messages (student.html)

A new safe RPC probe (`check_exam_code_status`) lets the Student Portal tell students *why* an exam code isn't loading, instead of one blanket error:

| Situation | Message shown to student |
|---|---|
| Exam locked | "This exam exists but is currently **LOCKED** by your teacher. Ask your teacher to open it (Assessments → ⋮ Actions → Open) and then refresh this page." |
| Not started yet | "This exam has not started yet. It opens automatically at **<date/time>**. Please wait and refresh then." |
| Closing time passed | "This exam reached its scheduled closing time (<date/time>) and is no longer accepting entries." |
| Code genuinely wrong | "Exam not found or not open. Check your exam code or ask your teacher to resend/re-open the link/code." (unchanged) |

If the new RPC is not yet installed on a database, the probe degrades gracefully (caught, returns null) and the original generic message is shown — no breakage during upgrade.

### 3.3 Database — new safe probe RPC (database/complete-schema.sql)

```sql
-- 8.1b Check Exam Code Status (safe public probe — no question data leaked)
CREATE OR REPLACE FUNCTION public.check_exam_code_status(p_code TEXT)
RETURNS TABLE (found BOOLEAN, is_open BOOLEAN, starts_at TIMESTAMPTZ, closes_at TIMESTAMPTZ)
LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public, pg_temp
```

* Returns **only** availability facts — no questions, answers, metadata, or IDs.
* Filters out archived exams; `SECURITY DEFINER` + explicit `GRANT … TO anon, authenticated` mirrors the existing public RPC pattern.
* Registered in the Section-0 drop list, so the schema stays **fully idempotent** (safe to re-run any number of times, on drifted databases too — verified on a live PostgreSQL 17 instance including the legacy-upgrade and harsh-drift scenarios).

## 4. Deployment Steps (to activate the fix on your live site)

1. **Deploy the updated files** — at minimum `teacher.html`, `student.html` (and `database/complete-schema.sql` for the repo) from the Phase 8 package. All other files are unchanged from Phase 7.
2. **Run the updated `database/complete-schema.sql` once** in Supabase → SQL Editor → *Run whole file*. It is idempotent: it adds `check_exam_code_status`, re-reconciles anything drifted, and changes no data. (If you skip this step, everything still works — students just see the generic message for locked exams until you run it.)
3. **Open your currently-locked new exams** — the exams you created during the bug are stored fine; they are simply locked. In the Teacher Portal → **Assessments**, select them and use **⋮ Actions → Open** (or the Open bulk action). They become instantly reachable — no need to recreate or resend codes.
4. From now on, **new exams open automatically on publish**. If you deliberately want a locked pre-load, choose "No — Keep locked…" in the form — and the system will warn you at publish time and at share time.

## 5. Verification

* **Real PostgreSQL 17 verification** (`analysis/schema_pg_verify.sh`): legacy-drift upgrade, idempotent re-run ×2, harsh-drift self-heal, full RPC smoke, and a new Phase 8 behavioural block — locked exam is **not** publicly fetchable **but is** reported by the probe as `found + closed`; opening it makes it fetchable (case-insensitive); scheduled exam exposes future `start_at`; expired exam hides from the public RPC while the probe reports the past `close_at`; archived exam invisible to both; wrong code not found; probe returns exactly 4 safe columns. **ALL PASS.**
* **Static schema audit** — 15/15 checks.
* **Teacher regression suite** — 41/41 checks (18 prior + 23 new Phase 8 checks: default-open markup, locked-option preserved, state-aware toasts, share guardrails, access-sheet banners, import default, student probe + all four messages + graceful degradation, schema definition/drop-list/grant/security/leak-safety).
* **HTTP smoke** — 113 checks across both packages (104 prior + 9 Phase 8 needles).
* **Full JS battery** — all 14 suites pass (calc engine 75, CSV bridge 57, prompt studio 452, phase-2 audit 584, sample-bank E2E, multi-subject grading, submit integration, teacher CSV integration, license engine, guard matrix, runtime, sample parse, teacher fixes).
* **Generator E2E** — build test re-verified in both URL modes.

## 6. Files Changed in This Phase

| File | Change |
|---|---|
| `teacher.html` | Open-by-default publish select; state-aware publish toast; WhatsApp/copy-link locked warnings; Access Sheet status banner + schedule line; imported packages publish open |
| `student.html` | `checkExamCodeStatus()` probe + precise locked / not-started / closed messages with graceful fallback |
| `database/complete-schema.sql` | New `check_exam_code_status` RPC (Section-0 drop-list entry + function + grant) |
| `templates/*` (generator package) | Same three files, tokenised (`__CLIENT_SUPABASE_URL__`, `__CLIENT_SUPABASE_KEY__`, `__CLIENT_SITE_URL__`) — client credentials never pre-filled |
| Tests | `teacher_fix_test.js` (+23), `schema_static_test.py` (+5), `http_smoke_test.py` (+9), `schema_pg_verify.sh` (+ Phase 8 behavioural block) |

---

*HMG Academy CBT Pro — Learning Deliberately. Teaching Authentically. A product of HMG Concepts.*
