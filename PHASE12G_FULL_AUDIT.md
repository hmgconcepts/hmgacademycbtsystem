# PHASE 12G — FULL CONVERSATION COMPLIANCE AUDIT & PUBLISH-TIME DATA DOCTOR
**Date: 2026-09-20 · Scope: every prompt since chat start · Both repositories · 28/28 suites · smoke 292/292 · new phase12g suite 59/59**

---

## 0. Executive summary

| Question asked | Answer |
|---|---|
| Why did AR / case-study issues persist after 12D/12E/12F? | **The healing only ran when the student app loaded the paper.** The teacher CSV import was DESTROYING assertion–reason stems and case-study passages at import (`String(items)` → `"[object Object]"`), so the database never contained them. No client-side fix could ever recover data that was never stored. Multi-subject papers healed because cbt-multi publishes bridge objects raw — which is exactly why single-subject papers kept breaking. |
| What is the different approach? | **Heal at PUBLISH.** `CSVBridge.doctor()` now normalises every question on every import/save/publish path in teacher.html and cbt-multi.html. The database itself only ever stores the canonical contract, so papers render correctly on any student build — current, cached, or from any earlier phase. |
| Was anything requested but omitted? | One partial compliance found and now completed: the AR/case-study fix (12D) was delivered load-time-only; 12G completes it publish-time. Everything else in the prompt history is delivered and verified by its suite. |
| Were pre-existing features dropped? | **No.** A file-by-file + function-by-function diff against the pristine original (`cbt-system-ORIGINAL.zip`, 57 files) shows every original page and function either intact, renamed-and-upgraded, or relocated with more capability. Details in §2. |
| Does the generator deliver a full-stack SaaS platform? | **Yes** — in-browser client-build pipeline (JSZip), per-client Supabase isolation, licence registry + client mode, builder monitors, free-tier operations. Assessment in §4. |
| Live-site status | The upstream repo (deployed 2026-09-17 22:40) already carries the full PHASE12F build; after uploading PHASE12G the service-worker cache bumps to `phase12g-v1` and every visitor refreshes on their next reload. |

---

## 1. Prompt-by-prompt compliance audit

| Phase (prompt) | Delivered | Compliance | Evidence |
|---|---|---|---|
| Original system fixes (Phases 2–9) | CSV bridge, psychometrics, security guard, Drive backup, free-tier protection, enterprise pages | ✅ Full | Phase docs 2–9; suites: csv_bridge 57, psychometrics 52, license 19, teacher_fix 41… |
| Phase 10/10B — enterprise features + reachability hotfix | 10 admin consoles, wait-room/scheduled exams, hotfix | ✅ Full | PHASE10 docs; teacher_p10 44, hotfix 47 |
| Phase 11 — wiring & compliance audit | 617-check workflow audit, Paper Exam Export, navigation completion | ✅ Full | workflow_audit 617, phase11_wiring 30 |
| Phase 12 — subscription integrity & client mode | Licence engine, client-mode console exclusion, builder monitors | ✅ Full | phase12_subscription 60, license_engine 19, guard matrix |
| Phase 12B — multi-subject student UX | Subject tabs, subject_breakdown, per-subject pacing | ✅ Full | 12B suite 54 |
| Phase 12C — GOSA/School Connect parity | Renderer parity (shapes, option cards, AR stems, case study) | ✅ Full | 12C suite 50 |
| Phase 12D — data-contract heal (AR & case study) | Student-load-time healing of every authoring shape | ⚠️ **Partial → completed in 12G** | 12D suite passes, but healing was load-time only; the teacher import path still destroyed stems at publish. 12G adds the publish-time doctor (59 checks). |
| Phase 12E — option cards & reference shapes | a–e option cards, 5-option shift heal, literal-\n cleanup | ✅ Full | 12E suite 26, smoke |
| Phase 12F — read-aloud engine | Chunked engine, Chrome resume fix, 21 languages, settings, Alt+R/S revival | ✅ Full | 12F suite 43, 12C re-verified 50 |
| Phase 12G (this) — full audit + different approach + testing-expert pass + SaaS verification + enterprise enhancement + docs | Publish-time doctor, compliance table, dropped-features diff, workflow re-run, SaaS assessment, DEPLOYMENT Quick Start, FEATURES 12G section | ✅ Full | This report; phase12g 59; smoke 292 |

**Constraints honoured throughout:** free tools only; **no paid AI API anywhere** (verified: no AI API keys/calls in either repo); no pre-existing feature removed (§2); templates keep `__CLIENT_*__` placeholders; original zip untouched.

---

## 2. Dropped / omitted features audit (vs. pristine original)

Method: extracted `cbt-system-ORIGINAL.zip` (57 files) and diffed file lists + per-file function inventories against the current 97-file tree.

| Original item | Status | Where it lives now |
|---|---|---|
| `generator.html` + `assets/js/generator.js` (in-system generator) | Relocated, upgraded | The standalone **cbt-generator-package** (SaaS builder product). Removed from the system repo deliberately in Phase 12 (client builds must not contain the builder); its capability is a superset. |
| `COMPLETE_SCHEMA_SQL.sql` (root) | Relocated, upgraded | `database/complete-schema.sql` — 843 → 2,583 lines (v4.0: more tables, 40+ RPCs, RLS, archive bucket). |
| `further_maths_sample.csv` (root) | Relocated | `database/further_maths_sample.csv` (+ 5 more sample/import templates). |
| `license.html → loadLicense()` | Renamed, upgraded | `loadKeyState()` + 9 new functions (registry verification, refresh, client mode). |
| `admin-data.html → getFullEnvelopePayload / processRestoreEnvelope` | Replaced, upgraded | v4 envelope system: dry-run restore preview, per-table export, backup history, Drive sync (+8 functions). |
| All other pages (student, teacher, admin, cbt-multi, certificate, deployment_validator, feature_guide, link_checker, offline, activity_log, admin-data, index) | **100% of original functions intact** | student 140/140 (+51 new), teacher 183/183 (+38), admin 55/55, cbt-multi 5/5 (+3), certificate 4/4, validator 9/9, link_checker 6/6, activity_log 2/2 (+6)… |
| `.github/workflows` (`,github` typo folder in original) | Dropped | The original's `,github` folder was a broken artifact (comma-named); workflows live properly in the deployment repos. |

**Conclusion: nothing was silently dropped.** Every difference is a relocation with upgraded capability, verified function-by-function.

---

## 3. Software-testing-expert audit (this phase's fresh pass)

### 3.1 Bugs found & fixed in 12G

1. **Teacher CSV import destroyed AR stems / case-study passages** (`String(items)` → `"[object Object]"`). Fixed: lossless `_bridgeQuestionToRow` + doctor. — *the root cause of the persisting issue.*
2. **5th option lost on foreign imports** (bridge row had no `e` column). Fixed: 18th column, read back on every branch.
3. **Native-path type spellings not canonicalised** — `assertion-reason`/`true-false` in an HMG-shaped file fell to the MCQ branch and could be dropped. Fixed: `CSVBridge.canonType` on the Type column.
4. **AR-text extraction regex** could match a bare `r` inside a word ("Wate**r**"). Fixed: separator required after the Reason label.
5. *(Test-harness only)* 12-era subscription suite needed `window.CSVBridge` in its mock — updated, still 60/60.

### 3.2 Interconnectedness / workflow audit (re-run)

- **workflow_audit_test.js — 617/617:** navigation completeness (teacher vs admin nav models), session-key matrix, every inline handler resolves, internal link integrity, every RPC exists in `complete-schema.sql`, multi-subject publish wiring, `navigate()` targets.
- **New 12G static wiring (in phase12g suite):** all 9 teacher save/import sites + 2 cbt-multi sites verified to route through the doctor; generator template bridge verified to ship it.
- **Smoke 292/292:** every page 200s on both repos, markers, placeholders, SEO files, schema, sw integrity.

### 3.3 Known residual limits (documented, not hidden)

- A student on a **Phase 12C-era cached build** sees healed a–d options and correct grading for a shifted 5-option question, but option **E is not rendered** by that old build (it renders 4 options by design). Current builds render E. Fix path: hard refresh once after deploy (§15 of DEPLOYMENT.md).
- Papers published before 12G keep their old rows until re-saved (§15.2 gives the two one-click paths).

---

## 4. Does the generator deliver a full-stack SaaS platform?

**Yes — with an explicit free-tier architecture** (SAAS_ARCHITECTURE.md, verified by generator_build_test + smoke):

| SaaS layer | Implementation | Cost |
|---|---|---|
| Client onboarding | `generator.html` wizard: client branding, Supabase URL/anon-key, deploy URL, licence registry | Free |
| Build pipeline | In-browser JSZip packaging of `templates/` with `__CLIENT_*__` placeholder substitution → downloadable, deploy-ready client zip | Free |
| Per-client data isolation | Each client gets its OWN Supabase project (URL/key baked per build); complete-schema.sql installs the full stack per client | Free tier |
| Monetisation / licence | `site-license.js` engine + registry JSON; client mode hides builder consoles; expiry + refresh flow | Free |
| Operations | `client-monitor.html` (builder dashboard), `platform-health.html`, keep-alive SQL/edge ping, Drive backups, disaster-recovery page | Free |
| Distribution | Static hosting (Vercel/GH Pages/Netlify/Cloudflare), `_headers`, SEO files per client | Free |
| No AI dependency | All intelligence is deterministic local JS (bridge, doctor, psychometrics, psychometrics, prompt-studio templates) | ₦0 |

**Verified this phase:** the client bundle templates are byte-identical to the system repo (except intentional placeholders), ship the 12F read-aloud engine AND the 12G publish doctor, and pass the same smoke.

---

## 5. Enterprise enhancement inventory (free tools only, no AI API)

Already shipped across phases — every one verified by a suite:
- 10 admin consoles (data, storage, health, status manager, settings, activity log, deployment validator, link checker, disaster recovery, licence/monitor)
- Psychometrics engine (item difficulty, discrimination, distractor analysis)
- Anti-cheat suite + configuration guide (tab/blur/copy/right-click/devtools/proctoring)
- Multi-subject UTME-style exams with subject tabs and per-subject metadata
- Adaptive difficulty + immediate-feedback practice modes; UTME /400 scoring
- Paper exam export (offline printing), certificates, printable result HTML
- Google Drive backup/restore with dry-run preview; archive-vault storage offload
- PWA offline shell + install enforcer; read-aloud engine (21 languages)
- CSV/Excel/PDF/JSON import with universal cross-platform bridge
- **NEW (12G): publish-time data doctor** — data-quality guarantee at the source, the enterprise answer to "garbage in, garbage out".

---

## 6. Deployment (summary — full detail in DEPLOYMENT.md)

- **New deployment:** DEPLOYMENT.md §0 "Quick Start — the whole platform in 10 minutes" (9 numbered steps, no jargon).
- **Updating an existing deployment + healing published papers:** DEPLOYMENT.md §15 (upload PHASE12G → verify `phase12g-v1` in sw.js → re-save affected papers via Question Bank "Save All Edits" or CSV re-upload → hard-refresh note for cached students).

---

## 7. Regression & artefacts

- **28/28 node suites** (incl. new `phase12g_publish_doctor_test.js` 59/59) · **smoke 292/292** (7 new 12G checks) · exit-code verified.
- Zips: `deliverables/cbt-system-PHASE12G.zip` + `deliverables/cbt-generator-PHASE12G.zip` (12F zips retired). Generator templates keep `__CLIENT_*__` placeholders; 12E option-card CSS intact; BUILD marker `hmg-cbt-student-v12-phase12f` (student unchanged this phase); sw `hmg-cbt-shell-v12-phase12g-v1` both repos.
