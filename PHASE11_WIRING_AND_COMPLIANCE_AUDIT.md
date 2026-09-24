# PHASE 11 — Wiring & Compliance Audit
### Prompt-by-prompt compliance, original-baseline feature preservation, cross-page bug hunt, navigation completeness, and the Paper Exam Export feature
**Date:** 2026-09-16 · **Method:** every claim below was verified by script against the original baseline (`cbt-system-ORIGINAL.zip`), the current repos, and the live deployment — nothing assumed.

---

## 1. Prompt-by-prompt compliance audit (your instruction vs what was built)

| Your instruction (in your words) | Status | Evidence |
|---|---|---|
| Follow prompts "correctly, totally, line-by-line" / don't assume — verify | **OBEYED, with one blind spot now closed** | Every phase shipped with automated verification. The blind spot: cross-page session wiring had never been workflow-tested — found and fixed this phase (§3.1). |
| Expert/understudy role: diagnose and know the systems before building | OBEYED | Each phase began with an audit; this phase re-audited the ORIGINAL baseline file-by-file. |
| Free-based tools only; **no AI API** (not cost effective) | OBEYED | Every feature to date is rule-based/client-side: psychometrics, adaptive delivery, proctoring (CDN face-api + Web Audio), Paper Exam Export, licensing, monitors. Zero AI-API calls anywhere. |
| **Do not remove pre-existing features — enhance only** | **OBEYED — verified, not assumed** | Scripted diff of every function in all 28 original files vs current: 10 flags investigated, ALL are renames/refactors with enhancements (§2). Zero original functions lost. All 19 original pages still present. |
| Original folder structure when zipping | OBEYED | Zips are built from the repo root; extraction verified each time. |
| Phase 4: CBT system and generator are SEPARATE products; internal tools only behind logins | OBEYED | `generator.html`/`generator.js` were removed from the CBT system repo (your explicit instruction) and live only in the generator package; every internal page enforces its own sign-in/role guard (re-verified by the new audit suite). |
| Phase 5: Supabase credential fields EMPTY in the generator | OBEYED (re-verified this phase) | `gen-sb-url`/`gen-sb-key` are empty inputs with placeholders; the build's hard leak-scan fails the build if builder credentials survive — and it caught a partial-tokenisation slip during this phase's sync, which was fixed before shipping. |
| Phase 5: exam settings page stays neat | OBEYED | Reference material moved to its own page (question-types.html) in Phase 5. |
| Phase 6: workspace under snapshot limits; SEO serves client identity AND HMG attribution | OBEYED | Workspace ~45 MB (limit 128 MB); canonical/OG/JSON-LD on every public page; ecosystem links + sameAs present. |
| Phase 7: schema fixes must heal EXISTING databases (drift) | OBEYED | complete-schema.sql is idempotent, drop-and-recreate RPC layer, guarded reconciliations; §4 of the Phase 10B runbook exercises exactly this on your stale live DB. |
| Phase 10: research FIRST, implement only gaps | OBEYED | Phase 10 doc records the researched platforms and the gap analysis. |
| Phase 10B: fix the "new exams unreachable" live bug | **PRODUCT FIXED; live DB remediation still pending on your side** | The code fixes shipped (reset default, schema banner, student fallback, validator probe). Your live database still needs `database/complete-schema.sql` run once, and the two locked exams opened — see PHASE10B §4. **Redeploying this Phase 11 package does NOT replace that SQL run.** |
| "Update every file accordingly across all repos" (recurring) | OBEYED | Both repos, both zips, templates, tests, docs, KBs updated every phase — including this one. |

## 2. Feature-preservation audit (original baseline → current)

Scripted comparison of every `function` declaration in every original file
against the current build. Ten flags; every one verified:

| Original | Current | Verdict |
|---|---|---|
| `admin-data.html: getFullEnvelopePayload` | `DataPort.buildFullEnvelope` (data-portability.js, wired into the same buttons) | Refactored + enhanced (v4 envelopes, legacy archive import) |
| `admin-data.html: processRestoreEnvelope` | Envelope import & restore with dry-run + legacy support | Enhanced |
| `settings.html: saveAllSettings` | `saveSettings(opts)` | Renamed, same button |
| `settings.html: authorizeGoogleDrive` | `authorizeDrive()` via drive-sync.js | Refactored |
| `settings.html: syncDriveNow` | DriveSync flow + auto-sync on interval | Enhanced |
| `license.html: loadLicense` | `loadKeyState()` | Renamed |
| `status-manager.html: updateStatus` | `admin_set_profile_status` RPC + reasons + bulk actions | Enhanced (server-side audit trail) |
| `cbt-prompts.html: generatePrompt` | `PS.buildFromForm()` (prompt-studio.js, 24 packs) | Enhanced |
| `cbt-prompts.html: copyGeneratedPrompt` | `PS.copy(...)` | Renamed |
| `cbt-exam-kit.js` parser | all parser functions present | False flag (nested functions) |

**Conclusion: no pre-existing feature was dropped.** Pages: all 19 original
pages present (only `generator.html` was moved out of this repo — your Phase 4
instruction). Current build adds question-types.html, client-monitor.html,
disaster-recovery.html and 8 new JS engines on top.

## 3. The live bug you reported — root cause and fix

### 3.1 "Please open the Teacher Hub and sign in first…" while signed in
**Root cause (verified in the ORIGINAL baseline — a latent bug from day one):**
`teacher.html` stores its session under `localStorage['cbt_pro_session']`, but
the shared App layer (`assets/js/app.js`) read only `cbt_session`,
`cbt_teacher_session` and `cbt_admin_session`. The Multi-Subject Builder asks
`App.getSession()` for the owner — which returned `null` for EVERY signed-in
teacher, on every attempt, on any deployment of the original or repaired build.
**This bug also silently affected** settings.html, license.html,
status-manager.html and client-monitor.html (all read the session through the
same broken chain).

**Fix (enhance-only):**
- `app.js.getSession()` now also reads `cbt_pro_session`.
- New role-aware getters so each page demands the right persona:
  `getTeacherSession()` (multi-subject builder — an admin session is never an
  exam owner), `getAdminSession()` (client monitor), `getBestSession()`
  (settings, license, status manager — governance pages that derive rights
  from the profile role, preferring the most privileged signed-in persona).
- `cbt-multi.html` shows an amber banner the moment you arrive without a
  teacher session (and greets you by email when you have one), and the publish
  wall now offers to take you to the Teacher Hub sign-in.
- Teacher logout clears every teacher-persona key, so tool pages never see a
  stale session.

### 3.2 Admin-shortcut double sign-in (same bug class, also fixed)
Signing in at the Teacher Hub with the platform admin email stored a
`cbt_pro_session` and redirected to admin.html — which restored only
`cbt_admin_session` and demanded a second login. The Admin Panel now adopts
that session when it belongs to the platform admin.

## 4. Navigation completeness (your issue #2)

**Before:** the Teacher Hub sidebar listed 13 of 20 pages (and the
Administration section was hidden for non-admin profiles); the Admin Panel
sidebar listed 12 of 20. Unreachable-from-nav pages included the Student
Portal, Certificate Verify, Deployment Validator, Link Checker, Feature Guide,
Client Monitor and Portals Home.

**After:** both sidebars list **every page** (new "Platform Pages" sections +
full Administration listing). Access control is unchanged — each page still
enforces its own sign-in/role guard when opened (Phase 4 constraint intact).
Enforced automatically forever by the new audit suite: *"navigation
completeness — every page in both nav panes."*

## 5. The software-testing-expert audit (interconnectedness)

Two new permanent suites, both green and wired into the regression runs:

- **`analysis/workflow_audit_test.js` — 622 checks:** every inline event
  handler in every page resolves to a real function (or loaded library); every
  internal href/src target exists; every invoked RPC (45) exists in
  `database/complete-schema.sql`; both nav panes list every page; the
  session-key matrix is consistent; every `navigate()` target has a view.
- **`analysis/phase11_wiring_test.js` — 30 checks (behavioural):** the real
  app.js session layer evaluated against a mocked localStorage (teacher-first
  priority, admin preference, full logout clearing); the real
  `printPaperExam` rendering single- and multi-subject papers; the admin
  adoption path; the empty-bank edge case.

## 6. New enterprise feature — 📄 Paper Exam Export

One click (Assessments → **📄 Paper Exam**) produces a print-ready document:
question paper (school header, candidate box, instructions, lettered options,
ruled lines for written answers, subject section headers on multi-subject
papers, per-question marks), **confidential answer key** with answer letter +
option text + explanation, and an **OMR-style bubble sheet** (A–E; written
questions marked out). Built for offline sittings, mocks and archives — free,
rule-based, and the digital CBT remains the source of truth. (Implementation
note: the generated document deliberately contains no inner `<script>` — a raw
`</script>` inside `document.write` would truncate the host page's script
block; the auto-print uses the established post-write pattern.)

## 7. The "Tutoring Connect" generator question (full-stack & SaaS)

You asked whether the *tutoring-connect generator* delivers a full-stack SaaS
platform. Verified against the live ecosystem: there is no product named
"Tutoring Connect" — the generator that serves **tutors & training centres**
is the **CBT System Generator** (cbtgen.vercel.app). The honest expert answer:

- **It IS full-stack** — but with a free-tier BaaS architecture instead of a
  rented server: static front-end (CDN) + Supabase Auth (roles, approvals,
  impersonation) + Postgres with row-level security + 45 server-side RPCs
  (business logic) + Storage (offload vault) + an Edge Function + GitHub
  Actions workflows + PWA/offline. No server to patch, zero monthly cost.
- **SaaS primitives are built in:** multi-role tenancy per deployment
  (teacher/admin/super_admin), subscription licensing with remote registry,
  heartbeat keep-alive, audit logs, institutions table, and the 📡 Client
  Monitor on your side for every client deployment.
- **The scaling model is a "SaaS factory":** one generator run = one branded,
  licensed, independently-deployed client platform. That is deliberately the
  right model at free tier (shared-tenant SaaS would pool every school's data
  behind one database — more risk, same cost).
- **New doc:** `SAAS_ARCHITECTURE.md` ships in the generator package with the
  complete architecture map, the SaaS primitive inventory, the scaling guide
  and the deployment economics.

## 8. Files changed this phase

| File | Change |
|------|--------|
| `assets/js/app.js` | Session layer: reads `cbt_pro_session`; `getTeacherSession/getAdminSession/getBestSession`; full-persona logout clearing |
| `teacher.html` | Sidebar: complete page map (Platform Pages + full Administration); logout clears teacher keys; **printPaperExam** + 📄 Paper Exam button |
| `admin.html` | Sidebar: complete page map; admin-shortcut session adoption |
| `cbt-multi.html` | `getTeacherSession()` + proactive sign-in banner + guided publish wall |
| `settings.html`, `license.html`, `status-manager.html` | `getBestSession()` |
| `client-monitor.html` | `getAdminSession()` |
| `assets/js/chatbot.js`, `assets/js/site-help.js` | Paper Exam, navigation and sign-in-requirement knowledge |
| `sw.js` | cache → `hmg-cbt-shell-v11-phase11-v1` |
| `FEATURES.md`, `FIXES_APPLIED.md` | Phase 11 sections |
| `analysis/workflow_audit_test.js`, `analysis/phase11_wiring_test.js` | New permanent suites (622 + 30 checks) |

## 9. Deployment (clear, unambiguous steps)

1. **Deploy the updated files** (Vercel: drag the extracted `cbt-system-PHASE10.zip`→now containing Phase 11 — or connect the repo and redeploy). Nothing to configure.
2. **Run the database update once** (if you have not already done it for Phase 10B): Supabase → SQL Editor → paste the ENTIRE `database/complete-schema.sql` → Run. Idempotent and drift-healing.
3. **Open the two locked exams** (5FPSX8, J19EST) under Assessments → 🟢 Open, then re-apply their anti-cheat options with ✏️ Edit.
4. **Hard-refresh** (Ctrl+Shift+R) so browsers pick up the new service-worker cache (`phase11-v1`).
5. **Verify:** sign in as a teacher → Multi-Subject Builder should greet you by email (no banner) → publish works; both sidebars list every page; Assessments → 📄 Paper Exam prints; `deployment_validator.html` shows the live database probe ✅.

## 10. Verification summary

- workflow_audit_test: **622/622** · phase11_wiring_test: **30/30**
- Full Phase 1–10 regression suite: ALL GREEN (re-run after every change)
- HTTP smoke: extended and re-run — see the run log in §10 of FIXES_APPLIED.md
- Generator build E2E: PASS (credential leak-scan clean, all files included)
