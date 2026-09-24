# PHASE 5 — AUDIT & FIXES (User Issues 1–8)

**Date:** 2026-09-11 · **Scope:** HMG Academy CBT Pro (`fixed-cbt-system`) and the CBT System Generator (`cbt-generator-package`) · **Rule:** free tools only, no AI APIs, no feature removal — enhancement only.

---

## Issue 1 — Generator: 50 themes, 50 fonts, 50 layouts ✅

- **Themes:** 50 professional themes (verified count, real distinct palettes).
- **Fonts:** 50 curated font stacks.
- **Layouts:** **NEW layout engine** — `LAYOUT_CSS` map (50 entries) + `layoutCSS(cfg)` in `assets/js/generator.js`. Previously `layoutId` was cosmetic; it now emits a real `/* ==== LAYOUT LAYER — "<id>" ==== */` block appended to the generated `assets/css/style.css`:
  - `:root` radius variables (`--radius`, `--radius-sm`) and `--layout-max`
  - `.main-wrap` max-width, `.app-header` treatment, `.card` borders/shadows/hover, body background — per layout id (e.g. `geometric-bauhaus` → hard borders + offset shadows; `corporate-trust` → 4px top border).
- Marketing copy updated everywhere ("50 professional themes / 50 font stacks / 50 layouts").

## Issue 2 — Generator "Backend & License" credentials must be EMPTY ✅

- The Supabase URL + anon key fields on the generator's **Backend & License** step start **empty** — clients type their own project credentials.
- Templates ship with `__CLIENT_SUPABASE_URL__` / `__CLIENT_SUPABASE_KEY__` placeholder tokens; packaging injects the client's values, and a legacy-literal sweep + **hard per-file leak scan** (build fails if the builder's own credentials or an unresolved token appear in any output file) protect every release.
- Verified this phase: full-zip leak scan of a generated package = **clean**.

## Issue 3 — `complete-schema.sql` re-run failure (ERROR 42P13) ✅

- **Root cause:** `CREATE OR REPLACE FUNCTION` cannot change a function's return type; re-running the schema after any signature drift raised `cannot change return type of existing function`.
- **Fix — Section 0 "FUNCTION-LAYER CLEAN REINSTALL":** a `DO $funcreset$` block at the top of `database/complete-schema.sql` that
  - loops `pg_proc`/`pg_namespace` for **all 41 function names** in `public` (ANY signature),
  - executes `DROP FUNCTION <signature> CASCADE` per function with per-function exception guards (`undefined_function`, `dependent_objects_still_exist`) and `RAISE NOTICE` per drop,
  - never touches tables or data — policies (§11), storage rules (§12) and triggers (§13) are recreated later in the same file.
- All 5 module extracts (`keep-alive.sql`, `security-hardening.sql`, `drive-sync.sql`, `storage-offload.sql`, `demo-seed.sql`) were regenerated from the master and each carries its own scoped `DO $modulereset$` drop-guard (security-hardening also covers `get_exam_teacher_id` + `is_exam_open_for_submission`).
- **Result:** the schema is now fully idempotent — re-running it on an existing database is safe regardless of past signature drift.

## Issue 4 — Question type reference moved off the exam-setting page ✅

- The ~145-line "Question Type Reference" (per-type accordion + complete reference) was **removed from the Create Assessment page** and replaced with a compact link card, so the exam-setting page is clean and uncluttered.
- **NEW dedicated page `question-types.html`** (teacher-guarded) where tutors can properly understand the types:
  - jump-to-type chips, the full 14-column CSV contract table,
  - **20 type cards** grouped Core / Pairing & Ordering / Higher-Order / Visual & Evidence — each with purpose, exact columns, a copy-paste CSV example row, the scoring rule, and what the student sees,
  - JSON escaping rule, cross-platform compatibility (School Connect / GOSA Portal import + export), free-AI authoring paths.
- Registered everywhere: teacher sidebar ("📖 Question Types Guide"), header nav, `app.js` (TEACHER_PAGES + GUARD_TEACHER_PAGES), `sw.js` precache (cache v6), `deployment_validator.html` (required files + feature check), `site-help.js` (full page guide), linked from the CSV panel and the Prompts Studio.

## Issue 5 — "Publish Assessment" button missing after CSV upload ✅

- **Root cause:** in `teacher.html`'s create page, the `panel-xlsx` div was never closed — the shared pool-status bar and the **Publish Assessment** button were nested inside `panel-pdf` (inside `panel-xlsx`), so they only rendered when the PDF tab was active. The CSV tab hid them.
- **Fix:** closed `panel-xlsx` at the right point and removed one leftover stray `</div>` from the page footer region (whole-file div balance is now **0**, matching the original). Pool status + Publish now sit at card level — **visible for every input method** (CSV, manual, XLSX, PDF, reuse).

## Issue 6 — All question types from School Connect + GOSA ✅ (now 20)

- **NEW `range`** (Range / Estimation): answer `15-25` in the answer column or `{"min":15,"max":25}` in Items; any value inside the interval (inclusive) earns the mark.
- **NEW `hotspot`** (tap-the-image): Items `{"image":"…","regions":[{"label":"Equator","x":50,"y":48},…]}` (x/y = %); the student taps a numbered dot on the image; if the image cannot load, labelled buttons appear instead so the item is still answerable.
- **NEW `evidence_mcq`** (two-part evidence): Items `{"part1":{question, options, answer},"part2":{…}}` — Part A answer + Part B best-evidence; both right = full mark, one = half.
- Wired **end-to-end** in the CBT system: `teacher.html` (CSV parser routing, manual builder for range, review scorer `scoreQuestion`), `student.html` (renderers `_renderRange` / `_renderHotspot` / `_renderEvidenceMCQ` + submit-time grading), `assets/js/cbt-types.js` (aliases, hasKey, grading incl. `{a1,a2}` review shape), `assets/js/csv-bridge.js` (aliases incl. School Connect/GOSA spellings: `estimate`, `interval`, `image_hotspot`, `click_image`, `evidence`, `evidence_based`, `two_part_evidence`).
- Generator templates carry the identical engine (synced), so generated client systems support all 20 types too.
- Unit-verified: 13/13 new-type grading checks (in/out of range, negative bounds, items JSON, hotspot label keys, evidence full/half/zero, hasKey, aliases).

## Issue 7 — All prompt packs from School Connect + GOSA ✅ (now 24)

Six packs added to the Prompt Studio (`assets/js/prompt-studio.js`, mirrored in the generator templates):

| Pack | What it does |
|---|---|
| 🎯 **Auto-Graded Ultimate Pack** (every auto-marked type) | All 18 auto-graded types guaranteed present (`minOne`), strictly no essay/code/manual review — the reference "engine tour" paper |
| 📄 Uploaded Material CBT | Strictly from a pasted/attached document, auto-graded types only |
| 🔗 Linked Material CBT | Strictly from a URL (links-only policy), auto-graded types only |
| 📚 Reading Comprehension — article link | Questions that prove the article was read |
| 📚 Video Comprehension — video link | Timeline-anchored questions + ordering of demonstrated steps |
| 📝 Assignment brief + rubric | Part 1 hand-out-ready brief + rubric, Part 2 self-check quiz CSV |

- `RULES` added for `range` + `evidence_mcq`; the ENTERPRISE pack upgraded to **all 20 types**; `NEEDS` wired for the five source-based packs; `{{SOURCE}}` in pack sections now resolves from the studio's source field.
- The Prompts Studio page now shows a **"The 20 question types"** card (incl. range + evidence_mcq) with a link to the new reference page.

## Issue 8 — Every file updated across all repos ✅

- **Count sweep** (17→20 types, 18→24 packs) across: `index.html` (meta/OG/JSON-LD/hero), `teacher.html`, `cbt-prompts.html`, `disaster-recovery.html`, `chatbot.js`, `site-help.js`, `prompt-studio.js`, `sw.js`, `README.md`, `FEATURES.md`, `DEPLOYMENT.md`, `GOOGLE_DRIVE_BACKUP.md`, `llms.txt`, and the generator's own `generator.html`, `index.html`, `README.md`, `llms.txt`, `generator.js` README blurb. Historical phase reports (PHASE2/PHASE4, FIXES_APPLIED) are left as accurate history.
- **Generator templates fully re-synced** from the fixed system (30 files incl. `question-types.html`, the Section-0 schema, and the 6 module extracts), with credential tokenisation re-applied and verified — after tokenisation **zero** files differ from the source product.
- `MANIFEST.pages` now includes `question-types.html` (20 pages · 17 JS modules).
- The downloadable CSV question template now contains **20 example rows** (file renamed `…_v3_20_types.csv`).

---

## Verification (all suites re-run after Phase 5)

| Suite | Result |
|---|---|
| Prompt Studio unit tests | ✅ 452 checks, 24 packs, 20 type rules |
| Phase 2 audit | ✅ 582 checks |
| CSV bridge | ✅ 57 checks |
| Teacher↔bridge integration | ✅ 24 checks |
| Teacher fixes | ✅ 14 passed |
| Scientific calculator | ✅ 75 checks |
| License engine | ✅ 12 checks |
| Runtime | ✅ 11/11 |
| Guard matrix (incl. question-types.html) | ✅ pass |
| Multi-subject grading | ✅ fix verified |
| Sample bank parse + E2E | ✅ 25 questions |
| Submit integration | ✅ pass |
| New types (range/hotspot/evidence) | ✅ 13/13 |
| HTTP smoke (both products) | ✅ **85 ok** (extended for question-types.html + new copy) |
| Generator build E2E (JSZip) | ✅ 81/81 files, question-types.html packaged with 20 cards, Section-0 schema included, full-zip leak scan clean |

## Deployment steps (unchanged flow)

1. **CBT system** — deploy the static files (Vercel/GitHub Pages/any static host); run `database/complete-schema.sql` in the Supabase SQL editor (safe to re-run any time — Section 0 self-heals function drift); optional: `api/keepalive.js` + the GitHub heartbeat workflow from `SUPABASE_FREE_TIER_PROTECTION.md`.
2. **Generator** — deploy the generator package as-is; clients configure their own Supabase URL + anon key in the wizard (fields ship empty), pick theme/font/layout, and download a branded, leak-scanned zip.
3. Post-deploy: open `deployment_validator.html` (admin tool) — it now also verifies the Question Types Reference page.
