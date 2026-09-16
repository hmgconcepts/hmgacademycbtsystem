# HMG Academy CBT Pro v3.1 — Detailed Features

This document explains the features in the CBT platform and how each feature helps schools, teachers, students, and administrators.

---

## 1. Access and roles

### Landing page

`index.html` introduces the platform, highlights HMG Academy/HMG Concepts branding, and links to the three portals.

### Teacher role

Teachers create exams, manage students, publish links/codes, and analyse results. Teacher data is isolated by RLS so each teacher sees their own exams, students, and results unless they are also an admin.

### Student role

Students do not need accounts. They access an exam by direct link or code. This is ideal for classrooms, WhatsApp groups, CBT labs, and low-friction assessment.

### Admin role

Admins approve teachers, supervise platform data, export reports, and run security checks.

---

## 2. Exam creation features

| Feature | Explanation |
|---|---|
| Subject/class/term/topic/session metadata | Encodes school reporting context for filters and result exports. |
| Duration | Countdown timer for exam pressure and fairness. |
| Attempt limit | Uses secure v3.1 RPC to count previous attempts. |
| Question count selection | Teachers can upload a large bank and deliver a random subset. |
| Open mode | Any student with the link/code can sit the exam. |
| Registered mode | Student ID must match the teacher’s uploaded roster. |
| Start time | Students see a wait room until exam opens. |
| Close time | Exam automatically stops accepting submissions after expiry. |
| Negative marking | Deducts configured marks per wrong answer and stores adjusted score. |
| Result release control | Teacher can show instant result or hold result until later. |
| Instructions | Teacher-provided exam rules shown before entry. |

---

## 3. Question authoring and import

### CSV import

The system supports the extended CSV format:

```text
Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,Accept,MRQ_AON,Pairs,Items,Difficulty,Tags,Section
```

### XLSX import

Teachers can upload spreadsheet files; the browser extracts rows and converts them into question objects.

### PDF/text import

For legacy question papers, teachers can paste/import structured text and the system detects common MCQ patterns.

### Manual entry

Teachers can build questions in the dashboard without external files.

### Metadata columns

- `Difficulty`: Easy, Medium, Hard, or school-defined label.
- `Tags`: pipe-separated topic/skill tags, e.g. `Algebra|Quadratic Equations`.
- `Section`: exam section, topic strand, or learning outcome.

These fields support better analytics, remediation, and item-bank management.

---

## 4. Question types

| Type | Auto scoring | Partial credit | Description |
|---|---:|---:|---|
| MCQ | Yes | No | One correct option A-D. |
| MRQ | Yes | Yes | Multiple correct options with partial or all-or-nothing mode. |
| True/False | Yes | No | A=True, B=False. |
| Short answer | Yes | No | Exact answer plus accepted alternatives. |
| Numeric | Yes | No | Numeric answer with tolerance and optional unit. |
| Matching | Yes | Yes | Pair left and right items. |
| Ordering | Yes | Yes | Arrange items in the correct sequence. |
| Cloze | Yes | Yes | Several fill-in-the-gap blanks. |
| Essay | Rule-based | Yes | Keyword/minimum-word score; teacher review recommended. |
| Categorization | Yes | Yes | Place items into categories. |
| Multi-numeric | Yes | Yes | Solve several numeric parts in one question. |

---

## 5. Student exam-taking features

### Link + code access

Teachers can share a URL or a 4–12 character code. The student portal extracts codes from:

- `?code=ABC123`
- `?exam=ABC123`
- `?c=ABC123`
- raw pasted code

### Wait room

If an exam has a future start time, students see a countdown. In v3.1, public RPC hides question data until the start time.

### Draft auto-save

Answers are saved locally during the exam. If the browser refreshes accidentally, the system can restore the draft.

### Navigator

Students see answered, unanswered, and flagged questions in a grid.

### Flag for review

Students can flag uncertain questions and revisit them before submission.

### Keyboard shortcuts

- `A-D`: select/toggle options
- `N` or right arrow: next question
- `P` or left arrow: previous question
- `R`: flag question
- `S`: open submit dialog

This mimics common CBT/JAMB-style speed practice workflows.

### Scientific calculator

Built-in calculator supports arithmetic, trigonometry, powers, constants, memory, and history.

### Read aloud

Browser speech synthesis reads the question and options when available.

---

## 6. Integrity and proctoring features

All integrity features use browser-side/free tools. They are not a replacement for human invigilation in high-stakes exams, but they provide useful logs.

| Feature | Description |
|---|---|
| Tab/app switch detection | Flags when document becomes hidden. |
| Window blur detection | Flags repeated focus loss. |
| Fullscreen monitoring | Prompts/flags when fullscreen is exited. |
| Copy/cut/paste/right-click blocking | Reduces easy copying. |
| Print/view-source/devtools shortcut blocking | Flags suspicious shortcuts. |
| DevTools window-size trap | Detects likely open devtools. |
| Periodic camera snapshots | Stores snapshots in `proctor_data` if permission is granted. |
| Multiple/no-face signal | Uses optional free face detection models where available. |
| Audio spike warning | Uses Web Audio API to flag loud/possible dictation audio. |
| Dynamic watermark | Shows student identity overlay during exam. |

---

## 7. Scoring and results

### Decimal scores

v3.1 stores scores as `NUMERIC(10,2)`, so partial-credit results match what students see.

### Negative marking

If a teacher sets a negative mark, the platform deducts:

```text
wrong_count × negative_mark
```

The score is clamped at zero.

### Held results

If `release_results=false`, the student sees a “Submission Received” screen without score or answer review. The teacher still receives the full result.

### Certificate/submission code

Each submission receives a verification code stored in `results.cert_code` and displayed to the student.

### Emergency backup

If saving fails, the student can download a JSON backup and send it to the teacher. Teachers can import backup JSON from the dashboard.

---

## 8. Teacher analytics

| Analytics | Purpose |
|---|---|
| Score distribution | See class performance spread. |
| Pass/fail ratio | Quickly judge performance against pass mark. |
| Per-question item analysis | Identify easy/hard questions and misconceptions. |
| Time analytics | Detect questions taking too long. |
| Leaderboard | Rank performance and percentiles. |
| Weakness identification | Find struggling students/topics. |
| Rule-based insights | No paid AI API; transparent recommendations. |
| CSV export | Use in Excel, Google Sheets, or school records. |

---

## 9. Admin features

- Teacher account approval.
- Pending/active/inactive status control.
- Admin promotion.
- Platform-wide exam and result views.
- CSV exports.
- Security checks.
- RLS smoke-test SQL download.
- Deployment checklist downloads.
- Platform health indicators.

Admin RPCs are protected server-side by `public.is_platform_admin()`.

---

## 10. PWA/offline shell

- `manifest.webmanifest` makes the platform installable.
- `sw.js` caches the app shell.
- `offline.html` provides a fallback page.
- Exam data still requires Supabase connectivity at loading/submission time, but drafts and emergency backup reduce data-loss risk.

---

## 11. Free-tool architecture

| Layer | Tool |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Hosting | Any static host |
| Database/auth | Supabase free tier |
| Charts | Chart.js CDN |
| PWA | Service Worker |
| Proctoring helpers | Browser APIs, optional free CDN model |
| AI | None; rule-based logic only |

---

## 12. Brand integration

The HMG Academy / HMG Concepts identity is embedded in:

- page titles
- landing page
- teacher login/dashboard
- student portal
- admin portal
- manifest
- documentation
- exported reports/checklists
- certificates/submission backups

Brand details:

- Founder: Adewale Samson Adeagbo
- WhatsApp: +234 810 086 6322
- Phone: +234 907 790 7677
- Email: hismarvellousgrace@gmail.com
- Tech/partnerships: buildingmyictcareer@gmail.com

## Enterprise features added/confirmed

### Granular anti-cheat controls
Teachers can choose only the controls needed per exam: tab/app switch detection, window blur detection, copy/cut/paste/select-all blocking, right-click blocking, fullscreen enforcement, devtools/print/source shortcut detection, camera photo gate with periodic snapshots, audio spike monitoring, and the number of violations before auto-submit.

### Result operations
Teachers can export CSV, export item analysis, view detailed answer/proctor evidence, delete individual results, bulk-select results, and delete all currently filtered/listed results. Admin can view/export/delete platform-wide result records.

### Verifiable certificates
Students receive a certificate/submission code after submission. `certificate.html` verifies the code against Supabase through `verify_certificate()` and displays the authentic score, subject, date, issuer, and validity status.

### Math/Science on-screen keyboard
The student portal includes an on-screen keyboard for symbols not available on normal keyboards, including Greek letters, inequalities, roots, calculus signs, set/logic signs, superscripts/subscripts, chemistry formula fragments, and science units.

### Question types
The system supports MCQ, MRQ, True/False, Short Answer, Numeric, Matching, Ordering, Cloze/Multi-blank, Essay/Keyword, Categorization, and Multi-part Numeric. Assertion-reason, case-study, image-based, and practical/science questions can be implemented using these supported types without paid APIs.
## CBT v2 additions

- Additional question types: Assertion–Reason, Case Study, Image MCQ, Matrix/Grid, Hot Text, and Code/Algorithm responses.
- Math/Science keyboard is now always available during exams so legacy exams also support symbol input.
- Admin can open a teacher dashboard in admin-supervised control mode, without knowing or exposing teacher passwords.
- Admin can open/lock exams and clear an exam’s result records from the platform-wide exam page.
## CBT v3 documentation and authoring upgrades

- Teacher Dashboard links to the dedicated Question Types Reference page (question-types.html) documenting all 20 question types.
- Downloadable CSV question template includes example rows for all 20 question types (including range, hotspot and evidence_mcq).
- `PROMPT_TEMPLATE.md` now contains ready-to-copy prompts that teachers can give to an AI assistant to generate HMG CBT-compatible CSV question banks manually.
- The prompt template includes strict CSV header, CSV escaping rules, distribution guidance, type-specific column rules, quality rules, and no-paid-API reminders.
## SEO/PWA/Lead generation

- Search-engine friendly landing page with canonical URL, meta description, Open Graph/Twitter cards and JSON-LD structured data.
- `robots.txt` and `sitemap.xml` included for Google, Bing and other search engines.
- Installable PWA for Android, iPhone/iPad, Windows, macOS and Chromebook.
- HMG ecosystem lead links point customers to HMG Academy, HMG Concepts, HMG Technologies/project enquiry and WhatsApp.
## CBT v4 enterprise additions

- Install prompt/strong PWA enforcement for phone, tablet, laptop and desktop users.
- Student can hide/show the question-number navigator during exams.
- Teacher can print individual and bulk result slips/certificates.
- Teacher can download each student’s question-and-answer packet for audit, parent communication, admission screening and records.
- Compatible with common entrance, admission, scholarship, terminal, mock, certification, recruitment and STEM/coding exams.
## CBT v5 exam-type coverage

The platform now explicitly supports Admission Screening, Scholarship Tests, Common Entrance Exams, Recruitment/Aptitude Tests, Certification Exams, STEM Exams, UTME/JAMB Practice, WAEC/NECO/BECE Practice, Post-UTME Screening, Placement Tests, Training Assessments and IELTS/SAT Practice. Presets apply sensible defaults while still allowing teacher editing.
## CBT v6 fullstack SaaS readiness

- Supabase backend includes SaaS-ready institution and audit-log tables.
- Optional `institution_id` columns prepare profiles, exams, students and results for multi-tenant school deployments.
- Fullstack architecture remains free-tier friendly: static frontend + Supabase Auth/Postgres/RLS/RPC backend.
## CBT v7 student result saving improvements

- Students can export result PDF with clean white-background print styling.
- Students can download a readable HTML result + question review file.
- Math/Science keyboard is force-available during every active exam, including old exams.



---

## Phase 2 (v4.0) — Enterprise enhancements

Ten new/overhauled subsystems, all free-tier, no AI APIs. Full explanations: **PHASE2_ENHANCEMENTS.md**.

1. **Settings Console** — branding, CBT defaults, accessibility (font scale / contrast / motion / dyslexia / 5 languages), security (idle lock, lockdown mode), module access matrix, official signature canvas, watermark, Drive config, connection tests. Shared across every admin device via the `platform_settings` table.
2. **Admin Data & Portability** — full backup envelopes, **dry-run restores** (plan preview before writing), Drive backup/restore with history, one-click demo data, table browser with owner-only row delete, per-table archives/exports, disaster-recovery migration to a fresh Supabase project.
3. **Storage Manager & Archive Vault** — real Postgres table sizes, quota dashboard, efficiency advisor, archive-first vault flow into 1 GB File Storage (purge requires upload proof), restore-from-vault, audit purge with downloadable archive.
4. **Platform Health Console** — latency probe, 7 RPC smoke tests, live heartbeat evidence, **A–F security posture grade** (key hygiene, RLS probes, HTTPS, session, config), 10-layer protection matrix, copyable report.
5. **Roles & Status Manager** — approval queue, search/filter/sort, bulk status changes with reasons, account drill-down (exams, submissions, audit trail), owner-only role grants, invite message generator.
6. **Audit / Activity Log** — server-side filters, 24 h/7 d/actor stats, 30-day chart, live tail, metadata drill-down, CSV export, retention purge.
7. **Site License (dual engine)** — offline HMAC perpetual token + subscription lifecycle (warning/grace/expired/suspended states, remote registry, SHA-256 tamper evidence, Shadow-DOM lock screen, quick-extend).
8. **AI Prompt Studio** — 18 rule-based packs (simple → enterprise all-18-types → multi-subject UTME → misconception hunter …), shared 17-column contract, 4-move Explanation Standard, exact-count distribution maths, validator + Teacher Hub loader.
9. **Free-tier protection, all 10 layers** — verified-write heartbeats (site-visit, GitHub Actions w/ self-commit, Vercel, pg_cron, Edge function, UptimeRobot), auto-restore watchdog.
10. **Google Drive Sync** — settings now genuinely persist (v3 bug fixed), popup-error mapping, 401 auto-retry, folder verification, 15-backup rotation, upload history.

Database: `database/complete-schema.sql` v4.0 — 10 tables, 41 RPCs, 24 policies, archive-vault bucket, heartbeat system; idempotent and safe to re-run on any earlier version.


---

## Phase 3 (v4.1) — Cross-platform compatibility, recovery & oversight

Full audit trail of this release: **PHASE3_AUDIT_AND_FIXES.md**.

1. **Universal CSV compatibility** — question CSVs from School Connect / GOSA Portal import unchanged (their headers, any column order, their type names, their headerless layouts) and banks export back in their exact format. One bridge module (`csv-bridge.js`), 81 automated checks.
2. **Calculator & maths keyboard, fully loaded** — safe no-eval engine in the exam; statistics suite (median/mode/std/variance/range), percent-modulo disambiguation, ↑/↓ expression replay, Ans/EE/MS, ⤵ Use result into the answer box, Alt+C/Alt+K shortcuts; 300+ searchable symbols in 20 groups on the exam maths keyboard.
3. **Tutor Score Audit, complete** — subjective scripts auto-flagged into the 🧑‍⚖️ Review Queue at submission; marking schemes shown to the teacher (keywords, min-words, provisional keyword score); 0.0–1.0 overrides with feedback; optional release; every revision audit-logged; candidates see an honest "pending tutor review" notice.
4. **Disaster Recovery console** — guided 7-step rebuild from Google Drive backups into a fresh Supabase project: live-tested schema readiness, backup inspection, dry-run plan, verified execution, permanent-switch and protection re-arm checklists, plus an "every circumstance" matrix. Idempotent throughout.
5. **Generator v4.1 build output** — chosen fonts actually load; PWA manifest branded per client; per-client service-worker cache; sitemap/robots rebased to the client's deployment URL; 20-page/65-file verified manifest.
6. **GOSA-grade install prompts** — persistent banner on every page (48h dismissal, honoured "never", iOS walkthrough) plus the weekly modal; install-state aware.
7. **Help system, comprehensive** — 20 pages × 78 sections documented in-page, Help Center modal (4 role paths, glossary, FAQ), and a 36-intent offline assistant bot with quick-question chips.
8. **GOOGLE_DRIVE_BACKUP.md** — the unambiguous setup/restore/troubleshooting manual (every error, honestly).
9. **Protection manual v2 (research-verified)** — the 7-day pause rule, why dashboard visits don't count, why external pingers are mandatory, and the free external-scheduler menu (cron-job.org / n8n / extensions) alongside the shipped GitHub Actions + UptimeRobot + Vercel stack.

## Phase 10 (2026-09-16) — Enterprise features from industry research

Deep Internet research across enterprise CBT platforms (Questionmark, D2L,
Mettl, ExamSoft, TestGorilla, ClassMarker), the JAMB/UTME practice-app
ecosystem, and gamification/accessibility practice (Quizizz, Kahoot, ETS, ADA)
drove this gap-closing release. Full detail: **PHASE10_ENTERPRISE_FEATURES.md**.

1. **🧠 Adaptive difficulty delivery** — the paper re-orders itself live from the bank's Difficulty tags (≥70% accuracy → hard bucket, 30–69% → medium, <30% → easy); forward-only like real CAT; grading unchanged; single-subject papers.
2. **⚡ Instant-feedback practice mode** — per-question ✓/✗ + correct answer + explanation, frozen options, Kahoot-style points (10 + 5×streak bonus), result-screen practice summary. Grading unchanged.
3. **📊 Psychometric analytics engine** (`assets/js/psychometrics.js`) — exam-level KR-20, SEM, mean/median/SD/pass-rate; per-question difficulty index, discrimination index (upper/lower 27%), point-biserial, response spreads, distractor-quality analysis and automatic flags. 100% client-side; analyses pre-Phase-10 results too.
4. **⏱ Per-candidate accommodations** — +25/50/100% exam time from the roster (registered mode), applied silently per ETS/ADA norm — never flagged on result slips or reports.
5. **UTME /400 aggregate scoring** — JAMB-style headline on any paper (each subject contributes up to 100); classic percentage untouched; default on multi-subject packages.
6. **👁 Live invigilation monitor** — candidate heartbeats every 45s into an RPC-only `live_sessions` table; teacher dashboard with live progress bars, current question, violations and stale detection; auto-refresh 15s.
7. **🧾 Result appeals** — candidates request script reviews from their result screen (DB-enforced: released result, one pending per candidate); teacher queue with grant/decline + note; pending-count badge.
8. **🏆 Hideable leaderboard** — best attempt per candidate, medals, percentiles, Distinction/Merit/Top-10% badges; teacher-only, one-click hide.
9. **🛡 Integrity signals** — fast-answer anomalies (<2s correct answers), very-fast-pace flags, violation counts and device-switching evidence across attempts; evidence framed as leads, not verdicts.
10. **Submission evidence upgrade** — every result now stores `is_correct` + `time_ms` per question and a `__meta` block (score model, delivery mode, device id, user agent, screen) inside `answers_data`; no schema change.

Also shipped: teacher.html `sbRpc()` repair (the tutor-audit trail had been
silently failing), local `escapeHtml` for teacher.html, lean-save fallback for
the new exam columns on older databases, chatbot + Help Center coverage of all
new features, and the full test posture (3 new suites, extended schema/PG/smoke
suites, complete Phase 1–9 regression green).

## Phase 10B (2026-09-16) — Exam reachability hotfix

Live incident: newly created exam links failed with "Exam not found or not
open" while old links worked — the site was newer than the database and two
silent-UX defects hid the reason. Full analysis, evidence and the live
runbook: **PHASE10B_EXAM_REACHABILITY_HOTFIX.md**.

1. **Open-by-default publish reset** — after publishing, the create form now
   restores "Open Exam Immediately? = Yes (recommended)" so the next exam in
   the same session is never silently locked.
2. **Teacher schema-currency guard** — a login canary probes the
   `check_exam_code_status` RPC and the Phase 10 exam columns; if either is
   missing (or a save downgrades), a persistent red banner explains exactly
   what is being skipped and how to run `database/complete-schema.sql`
   (with a Re-check button and per-session dismissal).
3. **Actionable student fallback** — when the status probe is unavailable,
   students get a clear checklist (locked → teacher opens it under
   Assessments → 🟢 Open; wrong code; database update note for teachers)
   instead of a dead-end message.
4. **Validator live database probe** — deployment_validator.html now checks
   the real database behind the deployed files and flags "site newer than
   database" with the 2-minute fix, turning this incident class into a
   pre-flight check.
5. **Assistant + Help Center** — the offline bot's exam-not-found answer
   covers the database-behind-the-site cause; the site guide documents the
   red banner and the "update the database whenever you update the files"
   rule.

## Phase 11 (2026-09-16) — Cross-page wiring, complete navigation, Paper Exam Export

A full prompt-compliance and interconnectedness audit (original baseline vs every
phase build) plus three platform upgrades. Full report:
**PHASE11_WIRING_AND_COMPLIANCE_AUDIT.md**.

1. **Cross-page session wiring fixed (live bug)** — teacher.html has always
   stored its session under `cbt_pro_session`, but the shared App layer only
   read three other keys — so the Multi-Subject Builder refused to publish for
   signed-in teachers ("must be owned by a teacher account"), and the settings,
   license, status-manager and client-monitor pages could not see teachers
   either. app.js now reads every persona key and exposes role-aware getters:
   `getTeacherSession()` (exam ownership — used by the builder), `getAdminSession()`
   (admin consoles) and `getBestSession()` (governance pages that derive rights
   from the profile role). Teacher logout now clears every teacher-persona key.
2. **Complete navigation panes** — every platform page is now listed in BOTH
   the Teacher Hub and Admin Panel sidebars (new "Platform Pages" sections;
   the Administration section is visible to all signed-in users — each page
   still enforces its own sign-in/role guard). No page is unreachable.
3. **Admin-shortcut adoption fixed** — signing in at the Teacher Hub with the
   platform admin email redirected to the Admin Panel, which then demanded a
   second sign-in; the panel now adopts that session automatically.
4. **📄 Paper Exam Export (new enterprise feature)** — one click on Assessments
   produces a print-ready question paper (school header, candidate box,
   instructions, lettered options or ruled answer lines, subject sections),
   a confidential answer key with explanations, and an OMR-style bubble
   sheet. Offline sittings, mocks and archives without power/internet —
   100% free and rule-based; the digital CBT remains the source of truth.
5. **Automated interconnectedness audits** — two new suites (622 + 30 checks)
   verify every event handler resolves, every internal link target exists,
   every invoked RPC exists in the schema, both nav panes list every page,
   the session-key matrix is consistent, and navigate() targets have views.

## Phase 12 — Subscription Integrity & Client Mode (2026-09-16)

**Subscription integrity (client hardening):**
- Client builds (generator output) ship **no License console and no Client Monitor** — clients can never bypass subscription mode. The license *engine* still runs everywhere; only the consoles are builder-side.
- `extend_site_license` / `save_site_license` RPCs on client deployments are swapped to a provider-managed denial ("License changes on this deployment are managed by the platform provider (HMG Concepts)") — safe even in the client's own SQL editor.
- All renewal banners/lock screens and the bot's license KB answers are **provider-managed**: contact HMG Concepts (WhatsApp +234 810 086 6322 · hismarvellousgrace@gmail.com) or the Renew button — no self-service quick-extend wording on client builds.

**Builder control room (master only):**
- 🫀 **Client Monitor keep-alive sweep** — one click pings every registered client's `sc_keep_alive` RPC (using each client's stored Supabase URL + anon key) with per-client warmed/unreachable/skipped reporting. Weekly routine: no client database ever goes cold, expired or not.

**Multi-subject publish fix:**
- Publish Combined Assessment now always sends `csv_data` (+ explicit `exam_mode`; per-subject rows carry both `questions` and `csv_data` reader keys) — kills the live `null value in column "csv_data" … NOT NULL constraint` failure on every schema state.
- Duplicate keeps `is_multi_subject` + `subjects_data` (copies no longer degrade to flat papers); `complete-schema.sql` adds `csv_data`/`subjects_data` SET DEFAULT drift-heal.

**Navigation separation:**
- Teacher navigation pane no longer lists the 10 administration consoles (Admin Panel, Data & Drive Sync, Disaster Recovery, Storage Manager, Platform Health, Roles & Approvals, Platform Settings, Site License, Audit Log, Client Monitor) — they live in the Admin Panel's own navigation, reached via Portals Home → Admin Sign In.
