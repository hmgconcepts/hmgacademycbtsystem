# PHASE 12N — Fleet Console Integration, Login Audit, 2FA & Full Analytics Parity

**Date:** 2026-09-29 · **Scope:** School Connect + GOSA Portal deep-understudy (analytics, activity log, settings, storage manager, admin data, platform health) + **HMG Fleet Console** compatibility + protection-doc depth. Every requirement below is implemented, verified, and shipped in both repos (`fixed-cbt-system` and the generator's `templates/`).

---

## 1. ✅ SUPABASE_FREE_TIER_PROTECTION.md — every layer at full depth

The user's finding was correct: Layers 6/7/8 were thin summaries while School Connect's were click-by-click. All three are now rewritten at (and beyond) SC depth:

| Layer | What the rewrite adds |
|---|---|
| **6 — cron-job.org** | Prerequisite callout, why-a-second-provider rationale, field-by-field table, **Run now** immediate test, History-tab verification, failure-email settings, 30-second notification check |
| **7 — Vercel Cron** | Ships-ready note (`api/keepalive.js` + `vercel.json` already in the package), dashboard **Cron Jobs** tab verification, manual **Run**, Functions/Logs 200 check, database-side verification, honest Hobby-tier daily-precision note, `curl` hand test |
| **8 — Google Apps Script** | Rename step, **test-before-automate** with the exact Google permission dance (Review permissions → Advanced → Allow), trigger field table incl. failure notifications, Executions-tab verification, handover tip about the owning Gmail account |

Plus: **Layer 11 — HMG Fleet Console** (new, full section: what the console is, the three endpoints it calls, the 2-minute add-project steps, verification via the heartbeat source display), the 11-layer matrix, updated handover checklist (now ticks layers 6/7/8/11 + the 12N SQL pack), the ELEVEN-layers promise, and a closing one-sentence system summary. Existing-sites section now points at `platform-integration.sql`.

## 2. ✅ HMG Fleet Console compatibility (the user's own app)

Studied the console's live code (`hmgfleetconsole.vercel.app` → `fleet.js`/`store.js`/`sync.js`). It pings `POST /rest/v1/rpc/sc_keep_alive` with body `{"src":"hmg-fleet-console"}`, reads heartbeat age from `GET /rest/v1/sc_keepalive?select=pinged_at&limit=1` (anon key), and reads `POST /rest/v1/rpc/sc_license_status`. This platform now supports **all three exactly**:

- **`sc_keep_alive(src, p_src)`** — the RPC accepts BOTH parameter names. The console's `src` payload and this platform's own `p_src` layers (site-visit, GitHub Actions, Vercel Cron, pg_cron, license guard, security probe, auto-restore watchdog) all land in the same heartbeat row. Old 1-arg signature is dropped first so PostgREST never resolves ambiguously; **all existing callers keep working unchanged** (verified by test).
- **`sc_keepalive` VIEW** — exposes `pinged_at` + `source` of the single heartbeat row, anon-readable (a view returns only that row — no school data).
- **`sc_license_status()` RPC** — full license state (`state`, `days`, `expires_on`, `grace_days`, `model`, `plan`, `cycle`, `status`, `renew_url`, `lock_message`, `locked`, `server_date`), handling lifetime/subscription/suspended/grace/expired.
- **Platform Health → 🚀 Fleet Console card** — probes all three endpoints live from the page, shows the add-project steps, offers Copy Project URL / Copy anon key, links to the console.
- Everything is installed by the new **`database/platform-integration.sql`** (one run on existing databases; embedded in `complete-schema.sql` for fresh installs; verified by the Schema Doctor).

## 3. ✅ Platform Health console — the three named requirements

1. **Keep-alive shows where the last ping comes from** — the heartbeat card now has a dedicated **"Where the last ping came from"** tile that translates every source into plain English (`site-visit` → *Layer 1 — Site-visit heartbeat*, `hmg-fleet-console` → *🚀 HMG Fleet Console — one-click fleet ping (Layer 11)*, `pg_cron` → *Layer 4 — internal scheduler*, … 18 mappings + graceful passthrough), alongside the raw source chip, timestamp, ping count and 7-day-window status.
2. **Schema Doctor shows EVERY SQL pack installed** — the card now probes **all 8 shipped packs** (`complete-schema`, `keep-alive`, `security-hardening`, `drive-sync`, `storage-offload`, `platform-integration`, `demo-seed`, `demo-users`) using cheapest-marker probes plus the new **`sc_install_state` marker registry** (`sc_installed_packs()` RPC; every pack self-marks when run standalone). Green-across banner, per-pack ✓/✗/⚠ with install dates, and the fix instructions.
3. **Recent sign-in activity shows who logged in** — new **🕵️ login audit card** listing the last 25 sign-ins (email, event, browser, time), fed by the new `login_audit` table (below). Deep-links to `activity_log.html?log=login`.

Also added: **🗃️ Archive Health** card (counts archived exams so nothing is silently hidden, with restore links) and the matrix is now **11 layers**.

## 4. ✅ Login audit (sign-in history) — full SC parity

- **`login_audit` table** (id, user_id, email, event, ip, user_agent, created_at) — RLS: authenticated may insert, **admin-only read**.
- Recorded automatically at **every real event**: teacher sign-in, admin shortcut sign-in, post-2FA sign-in, teacher logout, shell sign-outs (`signOutEverywhere`, `signOutUI`), and **idle locks** (teacher inactivity + security-guard idle lock). Fire-and-forget — an audit failure can never break a sign-in. Half-finished sign-ins (pending/blocked approval) are never recorded.
- **Activity Log page**: a Log switcher — *Platform audit trail* ↔ *Sign-in history (login audit — who signed in)* — with event filter (login/logout/idle_lock/2fa_challenge/2fa_passed), email search, date range, pagination, live tail, **JSON + CSV + print exports**, and an owner-only purge with download-first archive (`admin_purge_login_audit()` RPC, 7-day floor). Stats row and chart relabel in login mode. `?log=login` deep link.
- Sign-in history is also purgeable from the **Storage Manager** (vault-archive + purge, same two-step safety), travels in **full backup envelopes** (newest 2000), and restores through the whitelisted `admin_restore_archived_rows` RPC.

## 5. ✅ Two-Factor Authentication (free stack — goes beyond SC's flag)

- **`user_security_prefs` table** (own-row RLS) + a Settings card: *🔐 Two-Factor Authentication (this account)*.
- When ON, sign-in demands a **6-digit code emailed by Supabase's built-in email service** after the password step — full flow: challenge screen, verify, resend, cancel, wrong-code retry, free-tier rate-limit messaging. Both the challenge and the pass are login-audited. (School Connect stores a `two_factor` preference flag; this platform **enforces** it.)
- Toggle writes via a single PostgREST upsert (`resolution=merge-duplicates`) — no insert/patch race.

## 6. ✅ Analytics page (new `analytics.html`) — SC/GOSA parity in the CBT domain

Every SC analytics card mapped to this platform's data, plus CBT-native additions:

| Card | Source |
|---|---|
| 📈 Enrollment trend (12 mo) | students by `created_at` |
| 📝 Exam activity (12 mo) / 📊 Attempts (30 d) | exams + results |
| 👥 Class sizes | students by class |
| 🚻 Gender split / 🎂 Birthdays (next 30 days) | **new optional `students.gender` + `students.date_of_birth` columns** (empty = harmless) |
| 📚 Top subjects / 📋 Latest exams | exams |
| 🏆 Top 10 students / ⚠️ At-risk students (lowest 10) | per-student attempt averages |
| 📊 Performance by class / 📚 by subject | avg % + pass rate at a selectable baseline |
| 🧾 Participation (30 d) | attempts vs roster per class |

Class + subject scope filters, dependency-free charts (dark-mode aware, no CDN), **JSON + CSV exports + print/PDF**, a "reading this page" guide, admin-nav entry, access-guarded (`GUARD_ADMIN_PAGES`), offline-precached. The teacher roster import accepts the new optional columns (template updated), and **auto-generates IDs** for blank StudentID rows.

## 7. ✅ Settings / Storage / Admin Data parity items

- **Settings**: 2FA card (above), **🔑 Site License & Subscription** card (reads `sc_license_status()` live — the same call the console uses), **🔢 Auto-Generated Candidate Numbers** (prefix + include-year, live preview `HMG/0001` / `HMG/2026/0001`, authoritative `sc_next_student_id()` RPC, applied at import and single-add).
- **Storage Manager**: `login_audit` joins results/audit_logs as a vault-archive + purge target.
- **Admin Data**: **🔗 One-Click Re-link after Disaster Recovery** — `sc_relink_accounts()` admin RPC builds an email bridge (old id → email → new auth id) *first*, then re-points students/exams/audit rows, re-labels profiles, and reports teachers who have not signed up again yet. Full backup envelopes now include `login_audit`.

## 8. 🐛 Bugs found & fixed along the way

- **`App.signOutUI()` called `this.clearSession()` — a method that does not exist** (latent since 12K): the button threw a TypeError instead of signing out. Now `setSession(null)` + audited.
- **Generator MANIFEST never listed `assets/css/shell.css`** (12M latent gap): whitelabel builds would have shipped without the shell stylesheet that `app.js` injects. Fixed; the generator build test now asserts it.
- Teacher login half-sessions (pending/blocked approval) no longer linger in the `session` variable.

## 9. 🧪 Verification (all green)

- **New `analysis/phase12n_platform_test.js` — 156 checks** (Fleet-compat SQL contract incl. "old callers unchanged", login-audit/2FA schema, Schema-Doctor markers for all 8 packs, page features, VM behavioural checks of the analytics engine + heartbeat source labels, protection-doc depth, sw pin, 25-file template parity).
- **36/36 JS suites pass** (incl. updated 12K/12L/12M sw-pin expectations, workflow audit treating analytics.html as an admin console, phase2 audit's known-tables extended).
- **HTTP smoke suite: 372/372** (26 new 12N checks: analytics cards, fleet card, source display, 2FA, relink card, pack presence + generator parity).
- Generator build E2E asserts analytics.html / shell.css / platform-integration.sql ship in client builds.
- Service worker: **`hmg-cbt-shell-v12-phase12n-v1`**, analytics.html precached.
- All SQL packs dollar-quote/paren balanced; all page JS `node --check` clean.

## 10. 📦 Files changed (both repos, byte-identical)

`analytics.html` (NEW) · `database/platform-integration.sql` (NEW) · `database/complete-schema.sql` · `database/keep-alive.sql` · `database/security-hardening.sql` · `database/drive-sync.sql` · `database/storage-offload.sql` · `database/demo-seed.sql` · `database/demo-users.sql` · `database/README.md` · `activity_log.html` · `settings.html` · `storage.html` · `admin-data.html` · `platform-health.html` · `teacher.html` · `admin.html` · `sw.js` · `assets/js/app.js` · `assets/js/security-guard.js` · `assets/js/data-portability.js` · `assets/js/keepalive.js` · `SUPABASE_FREE_TIER_PROTECTION.md` · `FEATURES.md` · `DEPLOYMENT_GUIDE.md` — plus the generator's `assets/js/generator.js` (manifest: analytics page, shell.css, platform-integration.sql).

**Upgrade path for existing sites:** deploy the new build → run `database/platform-integration.sql` once in the Supabase SQL Editor → Platform Health → Run Full Diagnostics → 🚀 Fleet Console card all ✅, 🩺 Schema Doctor all 8 packs green. Then add the project to the Fleet Console (URL + anon key) and press 💓 Ping — the heartbeat card will say exactly where it came from.

---

## 11. 🔧 12N-2 hotfix — `42809: "sc_keepalive" is not a view` (live-DB report, fixed)

**What happened on the live database:** the 12N SQL ships `CREATE OR REPLACE VIEW public.sc_keepalive` (the read shape the HMG Fleet Console polls). PostgreSQL refuses to replace a **TABLE** with a view → `SQLSTATE 42809`. The table was traced to the **Fleet Console's own Ops-Toolkit "Keep-alive SQL" snippet** (its one-paste snippet for non-HMG projects creates `sc_keepalive (id, pinged_at, src)` + a 1-arg `sc_keep_alive(src)` writing to it). The original CBT platform never contained any `sc_keepalive` object (verified against the ORIGINAL zip — zero matches), so the collision only occurs on databases prepared by the console first.

**The fix (robust + lossless, shipped to every file):**

1. **Guarded install** before each `CREATE OR REPLACE VIEW` (both `database/complete-schema.sql` §6.2b and `database/platform-integration.sql`): a `DO $keepaliveview$` block reads `pg_class.relkind` for `public.sc_keepalive` and handles every shape:
   - `r`/`p` (table) → preserves the newest `pinged_at` + `src` into `sc_heartbeat` (newest-wins `GREATEST` merge, row count folded into `ping_count`, source recorded as the legacy value or `fleet-console-legacy`), then `DROP TABLE … CASCADE`;
   - `m` (materialized view) / `f` (foreign table) → dropped;
   - `v` or nothing → plain `CREATE OR REPLACE VIEW` path;
   - anything else → clear exception naming the object type.
   - Unknown legacy column shapes fall back to `created_at`, and unrecognised shapes degrade to a NOTICE (never a crash) — data is only written when there is something to preserve.
2. **Full overload reset** in `platform-integration.sql`: every existing `sc_keep_alive` signature (the console's `(text)`, the old `(p_src)`, any variant) is dropped via a `pg_proc` loop before the canonical dual-param function is created. `complete-schema.sql` already reset by name at the top; the standalone pack now does the same.
3. **Audit of the same hazard on other new objects:** `login_audit`, `user_security_prefs` and `sc_install_state` are `CREATE TABLE IF NOT EXISTS` (safe on pre-existing shapes); `sc_keepalive` was the only view and is now guarded. The console's policy on its legacy table dies with the table.

**What the user does on the live database:** nothing special — re-run `database/complete-schema.sql` (or just `database/platform-integration.sql`) end-to-end. The Supabase SQL Editor runs a failed script as one rolled-back transaction, so the earlier attempt left nothing half-applied; the re-run completes with the migration NOTICES visible (`sc_keepalive: preserved legacy ping …`, `legacy table retired`), and the console's ping keeps working through the view. The Platform Health → Fleet Console card now explains this inline.

**Files touched by the hotfix:** `database/complete-schema.sql` · `database/platform-integration.sql` · `platform-health.html` (card note) · `sw.js` → **`hmg-cbt-shell-v12-phase12n-v2`** · `FEATURES.md` (§11) · `DEPLOYMENT_GUIDE.md` (hotfix note) · `SUPABASE_FREE_TIER_PROTECTION.md` (Layer 11 note) · `database/README.md` · this report — all synced byte-identical to `cbt-generator-package/templates/`.

**Verification:** `phase12n_platform_test.js` grew by 27 checks (now **183/183**) covering the guard end-to-end in both SQL files; 12K/12L/12M pins updated to `phase12n-v2`; smoke suite +10 checks → **382/382**; full battery 36/36 JS suites + schema_static/func/html/id all green; zips rebuilt.
