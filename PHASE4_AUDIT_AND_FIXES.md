# PHASE 4 — Product Separation, Structure & Compliance Audit

> Full re-audit of every prompt versus the built work, followed by the architectural
> separation of the two products (CBT system vs CBT System Generator), the refs'
> database-folder convention, and a deeper prompt library. All changes verified by
> automated tests (totals at the bottom).

## 1. What the audit found

| Check | Result |
|---|---|
| Live sites `hmgcbtsystem.vercel.app` + `cbtgen.vercel.app` fetched and compared | **Identical 12-tile public homepages** — the CBT system exposed every internal tool publicly and carried a Generator tile; the generator deployment was a full copy of the exam platform. This is what Phase 4 corrects. |
| Original vs current file tree (Phase 1 zip → now) | **No pre-existing file dropped** at any point (only `.git` internals). Phase 4 then *deliberately* removes `generator.html` + `assets/js/generator.js` from the CBT system per instruction — a product-separation decision, not a regression. |
| Dangling references | `teacher.html` referenced `PROMPT_TEMPLATE.md` which never existed anywhere in any phase → **created** (full master prompt document, see §5). |
| `DEPLOYMENT.md` §4 | Still described the v3.1-era `COMPLETE_SQL_SETUP.sql` / 4-table setup → rewritten for `database/complete-schema.sql` (10 tables, run-once). |
| `sitemap.xml` | Listed login-guarded internal pages publicly → trimmed to public pages only. |
| Stale names | `COMPLETE_SQL_SETUP.sql` references across 7 files → all repointed to `database/complete-schema.sql`. |

## 2. Product separation (the core demand)

**CBT system = ONLY CBT. Generator = ONLY builds CBT systems.**

### 2.1 CBT system (this package)
- **Homepage cut from 12 public tiles to exactly 3:** Candidate — Take Exam, Teacher Login, Admin Login. The other nine (Multi-Subject, AI Prompts, Generator, Admin, Admin Data, Storage, Health, Roles, License, Audit) are gone from public view.
- **`generator.html` + `assets/js/generator.js` deleted** and every reference cleaned: `sw.js` precache, `deployment_validator.html` required-files, `sitemap.xml`, `settings.html` quick links, `site-help.js` topic, `chatbot.js` answer, README/DEPLOYMENT prose. Zero live references remain.
- **Internal tools mapped into the workspaces:**
  - Teacher sidebar: new *Teacher Tools* section (Multi-Subject Builder, AI Prompts Studio).
  - Teacher sidebar (admin-only section, stays hidden for teachers): Admin Panel, Data & Drive Sync, Disaster Recovery, Storage Manager, Platform Health, Roles & Approvals, Platform Settings, Site License, Audit Log.
  - Admin sidebar: new *Governance Console* section (same nine) + *Teacher Tools* section (Teacher Hub, Multi-Subject, AI Prompts).
- **Role-aware access guard (app.js v5):** `guardPageAccess()` runs first on every page load. Anonymous visitors opening an internal page are redirected to the correct login (`teacher.html`/`admin.html`) with a `?next=` return path; teacher-role accounts opening admin-only tools are bounced to the admin login; admins/super_admins pass. `teacher.html`/`admin.html` themselves are never guarded (they carry their own login screens — guarding them would self-redirect-loop). Nav categories stay separate from guard categories.

### 2.2 Generator package (separate repo/deployment)
Restructured root → **landing + wizard + templates**:
- `index.html` — NEW generator landing page (distinct product page: what it is, 4-step how-it-works, what's in the ZIP, audience, FAQ). No portals, no logins, no student/teacher/admin links.
- `generator.html` — the wizard; links `templates/assets/css/style.css`, ships **without** the platform's `app.js`; self-contained toast; static nav.
- `templates/` — the complete client CBT system (all 78 files, including `database/`, `PROMPT_TEMPLATE.md`, the 3-portal homepage).
- `assets/js/generator.js` — `MANIFEST` now fetches every file from `templates/<path>` and zips it at the client's root-relative path. **The generated ZIP contains no generator files and no `templates/` prefix** (verified by an end-to-end build test that really assembles and re-opens the ZIP).
- Generator-root `README.md`, `robots.txt`, `sitemap.xml`, `llms.txt` rewritten generator-specific; the client system's cron removed from the generator's `vercel.json`.
- `clientReadme` inside the ZIP points at `database/complete-schema.sql`.

## 3. database/ folder (refs' convention) — in BOTH products

| File | Role |
|---|---|
| `complete-schema.sql` | **The one file that matters.** All-inclusive (10 tables, 41+ RPCs, full RLS, indexes, triggers, `archive-vault` bucket, keep-alive + pg_cron, seeds), run-once, idempotent (`IF NOT EXISTS` / `OR REPLACE` / `DROP POLICY IF EXISTS` / `ON CONFLICT DO NOTHING`), safe to re-run, nothing else needed after it. |
| `README.md` | Install guide + module map + CSV import tips + upgrade path. |
| `keep-alive.sql` | Maintenance extract: heartbeat table + RPCs + pg_cron. |
| `security-hardening.sql` | Maintenance extract: admin-guard functions + full RLS policy set. |
| `drive-sync.sql` | Maintenance extract: Drive settings columns, backup registry, RPCs. |
| `storage-offload.sql` | Maintenance extract: archive-vault bucket + browse/purge/restore RPCs. |
| `demo-seed.sql` | Maintenance extract: `admin_seed_demo_data()` / `admin_purge_test_results()` + seeds. |
| `demo-users.sql` | NEW: creates demo teacher + admin logins (bcrypt via pgcrypto, idempotent, removal block included). |
| `sample-question-bank.csv` | NEW: 25 questions across 8 types, validated end-to-end through the real parser **and** the real student runtime contract. |
| `students_import_template.csv` | NEW: `full_name,student_id,class` roster template. |
| `further_maths_sample.csv` | Moved from root (was already shipped). |

Every reference to the old root paths was updated (18 files), including `sw.js` precache, the deployment validator's required-files list, and the disaster-recovery page.

## 4. 1,000-student concurrency (completed)

The submission path already had jittered spread, 5-attempt exponential backoff and multi-tier payload fallbacks. Phase 4 adds the missing last line of defence:
- **Offline queue:** if every network attempt fails, the full submission is queued in `localStorage` (de-duplicated) with a visible "waiting to upload" badge.
- **Auto-flush on reconnect** (`online` event) **and on next app load**, using the same jittered backoff so a hall of 1,000 reconnecting devices cannot stampede the database.
- **DEPLOYMENT.md §11.5** — a full capacity plan (what the platform does + the operational checklist + free-tier notes).

## 5. Prompts depth (as comprehensive as the refs)

- **`PROMPT_TEMPLATE.md`** (new, fixes the dangling reference): complete offline master prompt — 3-step usage, the 17-column contract table, the four-move Explanation Standard, a full master prompt, four variant blocks (Strict UTME, multi-subject, from-source-material, misconception mode) and a 60-second QA checklist. Linked from the Teacher Hub CSV help.
- **cbt-prompts.html static library** (the ref's benchmark feature): six complete copy-paste prompts — Level 1 Simple (20q quiz), Level 2 Intermediate (30q mixed skills), Level 3 Advanced (40q full interactive), Level 4 **Enterprise v3 "Exam Board Simulation"** (role/mission/section budgets/type-specific keys/quality gates/self-verification), Strict UTME multi-subject, Strict MCQ-only — each with a copy button, plus a 6-step "prompt → loaded bank" walkthrough and a "What is this page" card. `PS.copy()` upgraded to copy `<pre>` blocks (not just textareas) with an `execCommand` fallback.

## 6. Bug fixes found by the Phase 4 audit

1. **Guard self-redirect loop** — `teacher.html`/`admin.html` were in their own guard lists → split GUARD lists from NAV categories; login pages are never redirected.
2. **`CBTTypes.grade()` shape bug (major)** — the grader read `q.answer` while every runtime question from the platform's CSV parser carries `q.ans`, so `hasKey()` marked real questions "keyless → unmarkable" and they scored 0. Fixed with a `_adaptKey()` shape adapter in both `grade()` and `hasKey()`; multi-select also now understands comma-letter keys (`A,C`) with correct partial credit and case normalisation. Both shapes grade identically (verified across mcq/tf/mrq/short/numeric/ordering/cloze/essay/keyless cases).
3. **`PS.copy()` could not copy the static library prompts** (read only `.value`) → reads `textContent` too, with a working `execCommand` fallback for `<pre>` blocks.
4. **Bare `location` ReferenceError** inside the guard (vm-sandbox strict mode) → `window.location`.
5. **Stale `COMPLETE_SQL_SETUP.sql` instructions** in DEPLOYMENT §4 / README / SECURITY / feature_guide / teacher setup page / deployment validator.
6. **Test-suite rot** (not product bugs): `runtime_test.js` still targeted the Phase-1 original system and its extraction regex cut a function mid-signature; fixed and its expectations strengthened (was passing one check vacuously).

## 7. Verification totals (Phase 4)

| Suite | Result |
|---|---|
| Guard access matrix (new) | ✅ 22/22 scenarios (anon/teacher/admin/super_admin × public/teacher/admin/login pages) |
| Cross-reference audit (`phase2_audit.js`) | ✅ 568 checks clean |
| Prompt studio | ✅ 326 checks, 18 packs |
| CSV bridge | ✅ 57 checks |
| Teacher CSV bridge integration | ✅ 24 checks |
| Scientific calculator engine | ✅ 75 checks |
| License engine | ✅ 12 checks |
| Multi-subject grading | ✅ all subjects graded |
| Runtime/grading (fixed + strengthened) | ✅ CBTTypes 11/11 + parser test |
| Sample bank E2E (new) | ✅ 25 questions, real parser + real student contract |
| Generator build E2E (new) | ✅ 76/76 files, branded, zero generator leaks in client ZIP |
| HTTP smoke (new) | ✅ 76 checks across both deployments |
| `node --check` | ✅ every shipped JS file + every inline script block |
