# 🎓 HMG Academy CBT Pro v3.1 Enterprise

> **The CBT platform built for African classrooms** — free static hosting, Supabase free-tier backend, no paid AI API, no student app install, and no student accounts required.

**Brand owner:** HMG Concepts / HMG Academy  
**Founder:** Adewale Samson Adeagbo — Data Scientist, STEM Educator, AI-Augmented Solutions Developer  
**Support:** WhatsApp +234 810 086 6322 · Phone +234 907 790 7677 · hismarvellousgrace@gmail.com · buildingmyictcareer@gmail.com  
**Web:** https://hmgacademy.pages.dev/ · https://hmgconcepts.pages.dev/

---

## 1. What this system does

HMG Academy CBT Pro is a browser-based computer-based testing platform for schools, tutorial centres, examination practice programmes, and training organisations. It provides three portals:

| Portal | File | Purpose |
|---|---|---|
| Public landing page | `index.html` | Explains the platform and directs users to each portal. |
| Teacher dashboard | `teacher.html` | Create exams, upload/import questions, manage students, monitor results, export analytics. |
| Student portal | `student.html` | Students enter an exam code/link, take the exam, auto-save progress, submit, and receive a result or held-result notice. |
| Admin panel | `admin.html` | Approve teachers, supervise platform data, run security/deployment checks, export platform data. |

The platform is intentionally **zero-build**: upload the files to GitHub Pages, Netlify, Vercel, Cloudflare Pages, or any static hosting provider. Supabase supplies database and authentication using the free tier.

---

## 2. Major v3.1 enterprise upgrades

v3.1 focuses on correctness, security, and enterprise readiness while preserving all existing features.

### Database and SQL correctness

- `database/complete-schema.sql` has been rearranged so all helper functions exist **before** RLS policies reference them.
- Admin RPC functions now enforce admin status inside PostgreSQL through `public.is_platform_admin()`.
- Anonymous students no longer need broad table reads for exams, results, or rosters.
- Public student actions now use safe RPCs:
  - `get_public_exam_by_code(p_code)`
  - `verify_student_for_exam(p_exam_id, p_student_id)`
  - `get_exam_attempt_count(p_exam_id, p_student_name, p_student_class, p_student_id_ref)`
- Results now store decimal scores using `NUMERIC(10,2)` for partial-credit question types.
- Student submissions are accepted only when the exam is open, active, not archived, and not expired.

### Platform features added/enhanced

- Secure public exam loading RPC.
- Secure registered-student ID verification RPC.
- Secure attempt-count RPC.
- Decimal partial-credit scoring.
- Negative marking enforcement.
- Teacher-controlled result release/hold mode.
- Certificate/submission verification code saved with each result.
- JAMB-style keyboard shortcuts: `A-D`, `N`, `P`, arrow keys, `R`, `S`.
- CSV question metadata: `Difficulty`, `Tags`, and `Section` columns.
- Safer mixed old/new question storage parsing.
- Updated deployment validator and link checker.
- Updated documentation and security guidance.

---

## 3. Question types supported

| Type | Code | Auto-scored? | Notes |
|---|---:|---:|---|
| Multiple Choice | `mcq` | Yes | A-D option selection. |
| Multiple Response | `mrq` | Yes | Partial credit or all-or-nothing. |
| True/False | `tf` | Yes | A=True, B=False. |
| Short Answer | `short` | Yes | Exact/accepted-answer list. |
| Numeric | `numeric` | Yes | Supports tolerance and units. |
| Matching | `matching` | Yes | Partial credit by matched pairs. |
| Ordering | `ordering` | Yes | Partial credit by correct position. |
| Cloze / multi-blank | `cloze` | Yes | Pipe-separated accepted answers per blank. |
| Essay | `essay` | Rule-based | Keyword/minimum-word score; teacher review recommended. |
| Categorization | `categorization` | Yes | Partial credit per item category. |
| Multi-numeric | `multi_numeric` | Yes | Several numeric answers in one question. |

### CSV columns

```text
Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,Accept,MRQ_AON,Pairs,Items,Difficulty,Tags,Section
```

The first 7 columns remain backward-compatible. Columns 8–17 are optional and enable advanced question types, scoring controls, analytics, and item-bank metadata.

---

## 4. Enterprise feature overview

### Teacher dashboard

- Account signup/login through Supabase Auth.
- Admin approval workflow through `profiles.status`.
- Create exams with subject, class, term, topic, session, type, pass mark, duration, attempt limit, question count, open/registered mode, schedule, close time, negative marking, instructions, and result-release control.
- Upload questions via CSV/XLSX/PDF/manual entry.
- Edit full exam metadata after publishing.
- Append questions to existing exams.
- Export/import exam packages as JSON.
- Print invigilator access sheets.
- Manage registered-student rosters.
- View results with answer breakdowns.
- Export results, item analysis, and analytics CSV.
- Generate browser-only rule-based insights.
- Import emergency student result backup JSON.

### Student portal

- Access by link or code.
- Open mode: name + class.
- Registered mode: secure student ID verification RPC.
- Integrity pledge.
- Countdown timer.
- Question navigation.
- Flag questions.
- Auto-save draft in `localStorage`.
- Scientific calculator.
- Text-to-speech/read-aloud.
- Keyboard shortcuts for CBT speed practice.
- Fullscreen/tab-switch/copy/right-click/devtools/audio/face flags.
- Emergency result backup JSON.
- Instant result if released, or held-result notice if teacher selected hold.

### Admin panel

- Admin login by configured email or `profiles.is_admin = true`.
- Approve, deactivate, reactivate, promote, and remove teacher profiles.
- View platform-wide exams/results.
- Export platform data.
- Run security checks.
- Download RLS smoke-test SQL.
- Broadcast local browser notice.
- Review teacher activity and platform health.

---

## 5. File inventory

```text
.nojekyll
_headers
admin.html
assets/hmg-academy-logo.png
CHANGELOG.md
database/complete-schema.sql
CONTRIBUTING.md
DEPLOYMENT.md
DEPLOYMENT_GUIDE.md
deployment_validator.html
DIAGNOSIS_REPORT.md
EXPERT_ENHANCEMENT_REPORT.md
feature_guide.html
FEATURES.md
FEATURES_GUIDE.md
database/further_maths_sample.csv
hmg-academy-logo.png
hmg-icon.svg
index.html
LICENSE
link_checker.html
manifest.webmanifest
offline.html
PROMPT_TEMPLATE.md
README.md
SECURITY.md
student.html
sw.js
```

> Note: `assets/hmg-academy-logo.png` is the primary logo used by the live pages. The root `hmg-academy-logo.png` is retained for backward compatibility with older deployments.

---

## 6. Deployment quick start

1. Create a Supabase project.
2. Copy the Project URL and anon public key.
3. Replace `SB_URL` and `SB_KEY` in:
   - `teacher.html`
   - `student.html`
   - `admin.html`
   - `link_checker.html`
4. Set `ADMIN_EMAIL` in `teacher.html` and `admin.html`.
5. Run **all** of `database/complete-schema.sql` in Supabase SQL Editor.
6. Upload the repository files to GitHub Pages/Netlify/Vercel/Cloudflare Pages.
7. Visit `deployment_validator.html`.
8. Test: teacher signup → admin approval → create exam → student submit → teacher/admin verify result.

For detailed steps, read `DEPLOYMENT.md`.

---

## 7. Cost model

| Layer | Tool | Cost |
|---|---|---:|
| Hosting | GitHub Pages / Netlify / Vercel / Cloudflare Pages | Free tier |
| Database | Supabase Postgres | Free tier |
| Auth | Supabase Auth | Free tier |
| Charts | Chart.js CDN with graceful fallback | Free |
| PWA/offline shell | Service worker | Free |
| Proctoring helpers | Browser APIs + optional free CDN model | Free |
| AI API | Not used | ₦0 |

---

## 8. Security principles

- Never place a Supabase `service_role` key in any frontend file.
- Use only the anon key in HTML.
- Run the v3.1 SQL so RLS and RPC guards are active.
- Treat exam access codes as private bearer tokens.
- Rotate exam codes if shared accidentally.
- Use HTTPS in production.
- Export backups regularly.
- Review `SECURITY.md` before production use.

---

## 9. Brand statement

HMG Academy CBT Pro is part of the HMG Technologies mission under HMG Concepts: **Learning Deliberately. Teaching Authentically.** It is built for Nigerian and African education realities — low budgets, mixed devices, variable internet, and the need for dependable assessment workflows without expensive subscriptions or paid AI APIs.


---

## 10. Complete file inventory

A complete file-by-file inventory is available in `FILE_INVENTORY.md`.


## 2026 Enterprise repair package

This repository now includes granular anti-cheat selection, optional proctoring, robust RPC-based result saving, verifiable certificates, expanded working Math/Science keyboard, and updated SQL. Run `database/complete-schema.sql` in Supabase before deploying the updated static files to Vercel or Cloudflare Pages.
## CBT v2 package

CBT v2 adds more question types, always-on Math/Science keyboard availability during exams, and admin-supervised teacher dashboard control mode. See `ADVANCED_QUESTION_TYPES_GUIDE.md` and `CBT_V2_AUDIT_AND_DEPLOYMENT_STEPS.md`.
## CBT v3 authoring package

CBT v3 updates the teacher question-type reference, CSV template download, and `PROMPT_TEMPLATE.md`. The prompt template is now a practical question-bank generation prompt file for teachers who want an AI assistant to produce manual CSV question banks. It supports both the 11 core types and the full 17-type enterprise set.
## SEO, PWA and lead generation

The platform includes `robots.txt`, `sitemap.xml`, `llms.txt`, improved PWA manifest metadata, service worker caching, Open Graph/Twitter metadata, JSON-LD structured data, and landing-page lead links to the HMG Concepts ecosystem. See `SEO_PWA_LEAD_GENERATION.md`.
## Repair release note

This package fixes a critical `teacher.html` layout nesting bug that prevented Assessments, Results, Analytics, Settings and Students pages from appearing after sidebar clicks. See `CBT_REPAIR_AUDIT_REPORT.md`.
## CBT v4 package

CBT v4 adds PWA install enforcement, student hide/show question navigator, teacher-side result/certificate printing, Q&A packet download, and exam-compatibility documentation for common entrance, external candidates, certification and school ecosystem workflows.
## CBT v5 exam categories

CBT v5 expands the Exam Type dropdowns for school, admission, scholarship, recruitment, certification, STEM and standardised-practice workflows. Key exam types apply recommended settings automatically, but teachers can edit all settings before publishing.
## CBT v6 fullstack/SaaS repair

CBT v6 fixes the Supabase SQL pass-rate syntax error and adds SaaS-ready institution/audit-log database structures. The platform remains a static frontend with Supabase Auth/Postgres/RLS/RPC backend, making it a free-tier-friendly fullstack SaaS-style app. See `FULLSTACK_SAAS_ARCHITECTURE.md`.
## CBT v7 bug-fix package

CBT v7 fixes dark/black backgrounds when students save or print result/question reviews. It also adds a readable `Save Result + Questions` HTML export and strengthens Math/Science keyboard availability for pre-existing exams.

## 2026-09-11 Expert Repair Package (v3.1.1)

Full-codebase audit release. **Critical:** multi-subject (UTME/JAMB) exams now grade
EVERY subject (previously only the open tab was scored — with a per-subject breakdown
on the result screen), the Tutor Score Audit now works end-to-end (it previously wrote
NaN scores, crashed on a non-existent function, and its modal was unreachable), the
teacher review/item-analysis supports multi-subject exams, the production keepalive
endpoint (HTTP 500 → 200) and the GitHub Actions heartbeat (`,github/` → `.github/`)
are fixed, and the browser heartbeat now reports honestly. Also includes: exam-template
save/load rebound to the real form fields, TRUE/FALSE answer-key normalisation, a
quote-aware CSV reader for multi-line cells, exam package export/import,
draft time/subject persistence (closes the refresh-resets-timer hole), subject-aware
matching pools and question timings, guaranteed 6-character access codes, PWA manifest
and service-worker corrections, and ~143 KB of dead script includes removed from the
exam pages. Full detail: `FIXES_APPLIED.md`. No database migration required.


---

## v4.0 — Phase 2 Enterprise Release

Understudied the School Connect / GOSA Portal ecosystem and implemented its full governance-resilience-storage-licensing stack, more robustly:

- **New pages depth:** Settings (12 sections), Admin Data (dry-run restores, table browser, demo data), Storage Manager (Archive Vault into File Storage), Platform Health (A–F security posture + heartbeat evidence), Roles & Status (bulk ops + drill-downs), Audit Log (filters + charts + retention), License (dual engine), Prompt Studio (24 packs), Question Types Reference (question-types.html — all 20 types on a dedicated page).
- **New modules:** `site-license.js`, `security-guard.js`, `data-portability.js`, `prompt-studio.js` (+ hardened `drive-sync.js`, `keepalive.js`, `app.js`).
- **Schema v4.0:** 10 tables / 41 RPCs / 24 policies / archive bucket / pg_cron — still one idempotent file.
- **Free-tier protection:** all 10 layers incl. self-committing heartbeat workflow and auto-restore watchdog; every write verified.
- **Generator:** 4-step wizard, real theme application, license baking, ZIP integrity self-check, no silent failures, client-specific START-HERE.md.
- **Tests:** 326 prompt-studio checks, 12 license checks, 558 cross-reference audit checks, 65/65 HTTP smoke, full Phase 1 regression suite green. See `PHASE2_ENHANCEMENTS.md`.


---

## v4.1 — Phase 3: compatibility, recovery, oversight

- **Universal CSV bridge**: School Connect / GOSA question CSVs import unchanged and export back (`assets/js/csv-bridge.js`).
- **Exam calculator & maths keyboard completed**: safe no-eval engine, statistics suite, percent-modulo disambiguation, history replay, Use-result, 300+ searchable symbols (was 83, ungrouped).
- **Tutor Score Audit**: auto-flagged review queue, marking schemes, overrides + feedback, release control, audit-logged.
- **Disaster Recovery console** (`disaster-recovery.html`): 7-step verified rebuild from Google Drive into a fresh Supabase project; `GOOGLE_DRIVE_BACKUP.md` manual.
- **Generator v4.1**: fonts actually load in generated packages; client-branded PWA manifest; per-client SW cache; deployment-URL-rebased sitemap/robots.
- **Install prompts like GOSA**: persistent banner everywhere + weekly modal.
- **Help system**: 20 pages/78 sections + Help Center modal + 36-intent offline bot.
- **Audit**: 10 real lapses found & fixed (documented in `PHASE3_AUDIT_AND_FIXES.md`); 593 cross-reference checks, 494 new test checks, all Phase 1/2 suites still green.

---

## Phase 4 — Product separation, structure & compliance

- **Two products, cleanly separated.** The homepage now exposes exactly three portals (Candidate, Teacher Login, Admin Login). All internal tools (Multi-Subject, AI Prompts, Data & Sync, Storage, Health, Roles, Settings, License, Audit) live inside the teacher/admin workspaces behind login. The Generator is no longer part of this package at all — it is its own product.
- **Role-aware page guard.** Unauthenticated visitors opening an internal page are redirected to the right login with a `?next=` return path; teachers cannot open admin-only tools; admins pass. `teacher.html`/`admin.html` self-gate (they contain the login screens) and are never redirect-guarded.
- **`database/` folder (refs' convention).** `complete-schema.sql` is the single, all-inclusive, run-once, idempotent setup file — nothing else is needed after it. Optional maintenance extracts (`keep-alive`, `security-hardening`, `drive-sync`, `storage-offload`, `demo-seed`, `demo-users`) plus sample CSVs and a README round it out.
- **`PROMPT_TEMPLATE.md`** — the complete offline master prompt for generating CSV question banks with any free AI chat (17-column contract, four-move explanation standard, variants, QA checklist). Linked from the Teacher Hub.
- **AI Prompts Studio static library** — six complete copy-paste prompts (Simple → Intermediate → Advanced → Enterprise v3 Exam-Board Simulation, plus Strict UTME and Strict MCQ-only), a 6-step walkthrough and a "what is this page" card.
- **1,000-student resilience completed** — offline submission queue with auto-flush on reconnect/app-load (same jittered backoff as live submissions) on top of the existing retry/backoff/payload-fallback stack; DEPLOYMENT.md gains a full capacity plan (§11.5).
- **Grading shape bug fixed** — `CBTTypes.grade()`/`hasKey()` now accept both `.ans` (runtime) and `.answer` (School Connect) key shapes; multi-select understands comma-letter keys with proper partial credit.
- Full details: `PHASE4_AUDIT_AND_FIXES.md`.
