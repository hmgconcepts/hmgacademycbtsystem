# 🛠️ HMG Academy CBT Pro — Expert Repair Package (2026-09-11)

This package is the repaired build of `hmgacademyhub/cbt-system` following a full
expert audit of the live site (cbtsystem-hmgacademy.vercel.app) and all 57 repository
files. Every fix is surgical and behaviour-preserving outside the bug path. The
platform's zero-build, pure-fetch, free-tier architecture is unchanged.

**Verification:** all 19 pages load, every internal reference resolves, all inline and
standalone JavaScript passes `node --check`, and the repaired grading/parser logic is
covered by automated simulations (multi-subject grading, CSV parsing, TF normalisation,
code generation).

---

## 🔴 CRITICAL fixes

### C1 — Multi-subject exams graded only the ACTIVE subject  *(student.html)*
**Symptom:** a UTME/JAMB candidate who answered 4 subjects was scored only on whichever
subject tab was open when they pressed Submit. `total` also equalled just that subject's
question count, so the percentage was wrong too.

**Root cause:** the runtime keeps `questions = activeSubject.questions`; the grading
loop, the result-review builder and the `answers_data` builder all iterated `questions`.

**Fix:**
- New single-source-of-truth helpers: `_subjIdxOf`, `_aKeyOf`, `_timeKeyOf`,
  `_matchPoolKeyOf`, `_gradingList()` (subject-aware composite keys).
- `submitExam()` now grades **every** subject (`_gradingList()`), `total` = all
  questions, and a per-subject breakdown is computed.
- The result screen now shows a **Per-Subject Breakdown table** (score, %, C/W/S,
  pass status) for multi-subject exams.
- The breakdown is also stored in `answers_data.__subjects` for the teacher dashboard.
- The post-exam review now walks all subjects with continuous question numbering.

### C2 — Tutor Score Audit produced NaN and crashed  *(teacher.html)*
**Symptom:** saving a manual score revision wrote `NaN` into `results.score` and threw
`ReferenceError: renderResultsTable is not defined`.

**Root cause (3 stacked bugs):**
1. `CBTTypes.grade()` returns `{earned, max, correct}` but the audit read
   `.fraction` / `.isCorrect` → `undefined + undefined = NaN`.
2. It called `renderResultsTable()` — a function that does not exist (real name:
   `renderResults`).
3. `CBTTypes.grade()` reads `q.answer` while platform questions store `q.ans` — so even
   a "fixed" call would have regraded every non-audited answer as 0.

**Fix:** the audit now regrades with the dashboard's own `scoreQuestion()` (correct for
all 17 types and the `q.ans` field convention) through the multi-subject normaliser,
adds a `Number.isFinite` guard so a bad recalculation can never corrupt a record, and
refreshes with the real `renderResults()`.

### C2d — Tutor Score Audit modal was unreachable  *(teacher.html)*
`openTutorAuditModal()` was defined but **no UI element ever called it** — the feature
advertised on the landing page could not be used at all. It is now self-sufficient
(loads its own result/question data) and every question row in **View Answers** has a
**✏️ Audit** button.

### C3 — Teacher tools blind to multi-subject exams  *(teacher.html)*
`viewAnswers`, `exportItemAnalysisCSV` and `saveTutorScoreAudit` built their question
list from `exam.csv_data`; multi-subject exams store questions in `exam.subjects_data`,
so teachers saw *"Exam questions not found"*. Additionally
`qOrder = Object.keys(ad).map(Number)` produced `NaN` entries from the legitimate
non-numeric `time_analytics` / `scoring_summary` keys.

**Fix:** new normalisers `_examIsMultiSubject()`, `_examQuestions()` (flattens
`subjects_data` in subject order) and `_normalizeAnswersData()` (maps
`subjectIdx_origIdx` answer keys to flat indices, with legacy-key fallback). All three
tools now work for both single- and multi-subject papers; each review row carries a
subject badge, and audits are written back to the original stored key.

### C4 — Vercel keepalive endpoint dead in production  *(api/keepalive.js)*
**Verified live:** the endpoint returned HTTP 500 because it selected
`institutions.last_keepalive_at` — a column that does not exist in the deployed
database (PostgREST error 42703). Both the Vercel cron (every 2 days) and every
browser heartbeat were pinging a dead endpoint.

**Fix:** the function now touches only guaranteed columns (`id,name`), calls the
`keep_alive_ping` RPC opportunistically (non-fatal if absent), and returns HTTP 200
whenever the database answers.

### C5 — GitHub Actions heartbeat never ran  *(repo)*
The workflow lived in **`,github/workflows/`** (comma instead of a dot) plus a stray
1-byte file `,github/workflows/a`, so GitHub never executed it — "Layer 2" of the
10-layer protection did not exist.

**Fix:** moved to `.github/workflows/supabase-heartbeat.yml`, stray file removed.

### C6 — Browser heartbeat reported success while doing nothing  *(assets/js/keepalive.js)*
The heartbeat required a `window.sb` Supabase SDK client that is never created anywhere
(pure-fetch codebase) — the DB touch silently skipped; `/api/keepalive` was fetched
fire-and-forget; the 12-hour throttle stamp was written **even on failure**; and
`{success:true}` was returned unconditionally.

**Fix:** pure-fetch heartbeat (RPC → REST fallback), results awaited, success/throttle
reported honestly (settings page now distinguishes success / throttled / failure).
`window.App.SB_URL/SB_KEY` are used when available.

---

## 🟠 MAJOR fixes

| ID | Fix |
|---|---|
| **M1** | `saveExamTemplate`/`loadExamTemplate` referenced six non-existent element IDs (`ex-subject`, `ex-duration`, `ex-attempts`, `ex-select-count`, `ex-negative-mark`, `ex-certificate`) — templates silently lost subject, duration, attempts, question count and negative marking. Rebound to the real IDs (`ex-sub`, `ex-dur`, `ex-limit`, `ex-count`, `ex-negative`). |
| **M2** | `loadExamTemplate` called `setAntiCheatFormConfig()` which never existed (real: `setAntiCheatForm()`) behind a `typeof` guard — anti-cheat settings were never restored from templates. Fixed. |
| **M3** | True/False normalisation destroyed natural-language keys: `"TRUE"` → `"E"`, `"FALSE"` → `""`. `cleanAns()` now maps TRUE/T/YES/1 → `A` and FALSE/F/NO/0 → `B` for `tf` questions (verified by unit test). |
| **M4** | Whitelabel generator shipped broken packages: `cbt-exam-kit.js` + `cbt-richtext.js` missing (script dependencies of the exam pages), no logo/icon assets at all, and a reference to the then-nonexistent `.github/workflows/…` file. File list completed (scripts + all branding assets + `.nojekyll`/`browserconfig.xml`/`llms.txt`). |
| **M5** | The submit modal flagged **every** question as unanswered in multi-subject mode (`answers[questions[i]._orig]` without the subject prefix). Now uses `hasAnswer()` and reports whole-paper counts. |
| **M6** | Draft autosave did not persist remaining time — **a page refresh reset the countdown to the full duration** (integrity hole). Drafts now store `timeLeft` (restored, clamped), the active subject tab, and per-subject question orders; expiry is duration-aware (≥ 2 h). The single-subject order restore also no longer re-parses `csv_data` (which silently lost answer normalisation). |
| **M7** | Matching-question pools and per-question times were keyed by the bare per-subject index — **two subjects' matching questions collided and misgraded each other**, and flags/times bled across tabs. All keys are now subject-aware composites (`subjectIdx_origIdx`), including flag toggles, the palette, jump-to-flagged, and time analytics. |
| **M8** | The CSV parser split on newlines **before** quote handling, corrupting/dropping multi-line quoted cells (standard Excel/Sheets exports). New `splitCSVRows()` state machine parses RFC-style rows; `parseQuestionsCSV` now consumes pre-parsed rows (matching/ordering/advanced types unchanged — regression-tested). |
| **M9** | Multi-subject builder published with a placeholder all-zero `teacher_id` when not signed in (cryptic RLS failure). Now fails fast with clear guidance. |

---

## 🟡 MINOR fixes

| ID | Fix |
|---|---|
| **m1** | `sw.js` shell cache was missing `assets/js/site-help.js` and `assets/js/chatbot.js` (used by every page); cache version bumped. |
| **m2** | `manifest.webmanifest` `id` was `/cbtplatform/` — did not match the deployed root. Now `./`. |
| **m3** | ~143 KB of dead `<script>` includes (`cbt-exam-kit.js`, `cbt-richtext.js`, `cbt-types.js`) removed from student/teacher pages — zero references (files retained in the repo; the validator and generator still ship them). Faster first paint on metered data. |
| **m4** | Certificate QR code depended on an external image API with no fallback — now degrades to a readable verification URL when offline. |
| **m5** | Access/certificate codes could be shorter than 6/8 characters (`Math.random().toString(36)` edge). New `_gen6()` guarantees fixed-length codes (5,000-run test). |
| **m6** | `cbt-engine.js computeResults()` had the same `{fraction,isCorrect}` vs `{earned,max,correct}` mismatch (NaN scores) — normalised to the real result shape. |
| **m7** | Chatbot knowledge base claimed "14 columns" CSV and "37+ question types" — corrected to the real 17-column / 17-type platform format. |
| **m8** | Landing/health pages claimed "19+ RPC smoke tests" while 5 run — copy aligned ("core RPC smoke tests"). |
| **m9** | The teacher CSV template referenced `assets/sample-heart-diagram.png`, which never existed in the repo (broken image in the sample `image_mcq` row). A clean labelled sample diagram now ships in `assets/`. |
| **m10** | `student.html` state (`isMultiSubjectMode`, `multiSubjectsList`, `activeSubjectIdx`) was created as accidental implicit globals — now properly declared. |

---

## Files changed

```
.github/workflows/supabase-heartbeat.yml   (moved from ,github/workflows/ — stray file "a" deleted)
api/keepalive.js                           (rewritten — production 500 fix)
assets/js/keepalive.js                     (rewritten — honest heartbeat)
assets/js/generator.js                     (complete package file list)
assets/js/cbt-engine.js                    (grade result-shape fix)
assets/js/chatbot.js                       (KB corrections)
assets/sample-heart-diagram.png            (new — sample referenced by the CSV template)
certificate.html                           (QR fallback)
cbt-multi.html                             (login guard, safe code gen)
index.html                                 (copy alignment)
manifest.webmanifest                       (PWA id fix)
platform-health.html                       (copy alignment)
settings.html                              (honest keepalive feedback)
student.html                               (C1, M5, M6, M7, m3, m5, m10 + per-subject breakdown UI)
sw.js                                      (cache completion, version bump)
teacher.html                               (C2, C2d, C3, M1, M2, M3, M8, m3, m5)
FIXES_APPLIED.md                           (this file)
README.md                                  (repair release note appended)
```

## Deployment notes

1. No database migration is required — the SQL schema is untouched; all fixes are
   frontend/serverless. (Running the updated `database/complete-schema.sql` is still
   recommended for fresh projects, as before.)
2. Deploy to Vercel/GitHub Pages exactly as before (zero-build static + `/api` function).
3. The service-worker cache version was bumped — returning clients will refresh their
   shell automatically.
4. Old multi-subject results (submitted before this fix) cannot be retroactively
   re-graded because only the active subject's answers were saved; new submissions are
   complete. The teacher review displays them via the legacy-key fallback.

---

# PHASE 10 APPENDIX — Enterprise Feature Research & Enhancement (2026-09-16)

Phase 10 was driven by structured Internet research across enterprise CBT
platforms (Questionmark, D2L, Mettl, ExamSoft, TestGorilla, ClassMarker), the
Nigerian JAMB/UTME practice-app ecosystem (ExamGuide, TestDriller, Awajis,
MySchoolGist), and engagement/accessibility research (Quizizz, Kahoot, ETS,
ADA guidance). Ten absent capabilities were implemented — every one
free-of-charge and rule-based (no AI API), every one additive (nothing was
removed), and every one degrades gracefully on an older database.

## New capabilities
1. **🧠 Adaptive difficulty delivery** — the paper re-orders itself from the
   bank's Difficulty tags (≥70% accuracy → hard bucket, 30–69% → medium,
   <30% → easy); forward-only like real CAT; grading unchanged.
2. **⚡ Instant-feedback practice mode** — per-question ✓/✗ + correct answer +
   explanation with Kahoot-style points (10 + 5×streak bonus); grading unchanged.
3. **📊 Psychometric analytics engine** (`assets/js/psychometrics.js`) — KR-20,
   SEM, difficulty/discrimination/point-biserial indexes, response spreads,
   distractor-quality flags, fast-answer flags; 100% client-side.
4. **⏱ Per-candidate accommodations** — +25/50/100% time from the roster,
   applied silently (never flagged on reports, per ETS/ADA norm).
5. **UTME /400 aggregate scoring** — JAMB-style headline (each subject
   contributes up to 100); classic percentage untouched.
6. **👁 Live invigilation monitor** — 45s candidate heartbeats into
   `live_sessions` (RPC-only), teacher dashboard polling every 15s with
   stale detection.
7. **🧾 Result appeals** — candidate-initiated script-review requests with
   DB-enforced eligibility (released result, one pending per candidate) and a
   teacher resolution queue.
8. **🏆 Hideable leaderboard** — best attempt per candidate, medals,
   percentiles, badges; teacher-only and one-click hideable.
9. **🛡 Integrity signals** — fast-answer anomalies and device-switching
   evidence from `time_ms`/`is_correct`/`__meta` now stored per submission.
10. **Delivery metadata** — entry-screen mode badges, practice summary banner,
    `answers_data.__meta` evidence block.

## Robustness repairs shipped alongside
- **teacher.html `sbRpc()` was never defined** — the tutor-audit trail
  (`log_audit_event` after score audits) has been silently failing with a
  ReferenceError since it was written. Now a proper global helper; audit
  entries write again.
- **teacher.html had no `escapeHtml`** (app.js is not loaded on that page) —
  added; all Phase 10 injected names/notes pass through it.
- `saveExamPayloadWithFallback` lean path now also strips the Phase 10
  columns (`adaptive`, `feedback_mode`, `score_model`) so publishes still
  succeed on pre-Phase-10 databases (with a toast telling the teacher to
  run the schema).
- `cbt-multi.html` publish got the same lean-retry resilience.
- Student engine per-attempt state (adaptive tallies, game points, revealed
  keys, live-ping timer) is reset in `_beginExam` so retakes start clean.

## Database (all additive, idempotent, drift-safe — see PHASE10 doc §3)
New columns: `exams.adaptive/feedback_mode/score_model`,
`students.extra_time_pct/accommodation_note`. New RPC-only tables:
`live_sessions`, `appeals`. New RPCs: `upsert_live_session`,
`list_live_sessions`, `submit_appeal`, `list_appeals`, `resolve_appeal`.
Changed RPCs: `verify_student_for_exam` (returns accommodations),
`get_public_exam_by_code` (returns delivery options).

## Deployment
Follow **PHASE10_ENTERPRISE_FEATURES.md §4** — the short version: deploy the
files, re-run `database/complete-schema.sql` in the Supabase SQL Editor
(safe on existing databases), and smoke-test the six flows listed there.
All Phase 10 options are OFF by default; existing exams are unaffected.

## Verification
psychometrics 52/52 · adaptive 35/35 · teacher_p10 44/44 · submit
integration PASS (incl. live-ping + `__meta` asserts) · schema static 60/60 ·
real-Postgres verify ALL PASS · HTTP smoke 159/159 · full Phase 1–9
regression suite ALL GREEN.

---

# PHASE 10B — Exam Reachability Hotfix (2026-09-16)

Live incident: newly created CBT links showed students the dead-end
"Exam not found or not open" error while pre-existing links worked.
Root cause chain (probed live): the deployed Phase 10 front-end was running
against a pre-Phase-8 database (missing `check_exam_code_status` RPC +
Phase 10 columns), the new exams were sitting locked, a teacher.html
form-reset bug re-locked every subsequent exam published in the same
session, and the student page couldn't explain any of it.
**Full analysis, evidence and the 3-minute live runbook:
PHASE10B_EXAM_REACHABILITY_HOTFIX.md.**

Fixes (all enhance-only):
- **teacher.html** — post-publish form reset now restores the recommended
  "Open Exam Immediately? = Yes" default (was silently re-locking the next
  exam in the session); new `checkSchemaCurrency()` login canary + persistent
  red "Platform database is out of date" banner with the exact SQL fix and a
  Re-check button; lean-fallback saves now escalate to the banner and use an
  explicit toast.
- **student.html** — `checkExamCodeStatus()` distinguishes "probe RPC
  missing" from "exam not found"; students get an actionable checklist
  (locked → teacher opens it; wrong code; schema update note for teachers)
  instead of the dead-end message. All existing status messages preserved.
- **deployment_validator.html** — new live "Database schema up to date"
  probe (status RPC + Phase 10 column) that catches this exact condition
  before students do.
- **assets/js/chatbot.js** — "exam not found / locked" answer now covers the
  database-behind-the-site cause (new links fail, old ones work) + fix.
- **assets/js/site-help.js** — documents the red banner, the validator probe,
  and the standing rule: update the database whenever you update the files.
- **sw.js** — cache bumped to `hmg-cbt-shell-v10-phase10-v8`.

Verification: hotfix_reachability_test 47/47 (behavioural: real reset block
restores the open default on a mock DOM; real canary flags missing-RPC /
missing-column / healthy DBs; real student probe resolves undefined vs null
vs status row) · full regression re-run ALL GREEN · HTTP smoke re-run.
