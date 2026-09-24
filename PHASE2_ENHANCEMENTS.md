# HMG CBT Pro — Phase 2 Enterprise Enhancements (v4.0)

**Scope of this release:** every governance, resilience, storage and licensing subsystem of the reference School Connect / GOSA Portal platforms — re-engineered for the CBT system, made more robust, and extended beyond the references. No pre-existing feature was removed; the 65-file platform now ships **10 subsystems** documented below.

| # | Subsystem | Page(s) / module(s) | Status vs reference |
|---|---|---|---|
| 1 | Settings Console | `settings.html` | Far beyond (12 sections vs 5) |
| 2 | Admin Data & Portability | `admin-data.html` + `assets/js/data-portability.js` | Beyond (dry-run restores, table browser) |
| 3 | Storage Manager & Archive Vault | `storage.html` + schema | Beyond (real pg sizes, verified archive-first purge) |
| 4 | Platform Health Console | `platform-health.html` + `assets/js/security-guard.js` | Beyond (graded posture report, heartbeat evidence) |
| 5 | Roles & Status Manager | `status-manager.html` | Beyond (bulk ops, drill-down, invite flow) |
| 6 | Audit / Activity Log | `activity_log.html` | Beyond (filters, charts, retention purge) |
| 7 | Site License (dual engine) | `license.html` + `assets/js/site-license.js` | Beyond (offline token + subscription in one) |
| 8 | AI Questions Prompt Studio | `cbt-prompts.html` + `assets/js/prompt-studio.js` | Beyond (18 packs vs 17, validator kept) |
| 9 | Free-Tier Protection (10 layers) | workflows + `api/` + `supabase/` + `keepalive.js` | Parity + verified watchdogs |
| 10 | Google Drive Sync | `assets/js/drive-sync.js` | Beyond (settings now actually persist; error mapping; 401 retry) |

---

## 1. Settings Console (`settings.html`)

**What it is:** the single source of truth for platform-wide configuration, stored in the `platform_settings` table (row id = 1) so **every admin device sees the same settings** — the old version kept some settings only in that browser's localStorage.

**Sections (12):**
- **Institution Branding** — name, tagline, primary/accent colours with a live preview. Feeds every page header, exports and printouts.
- **Assessment & CBT Defaults** — default duration, passmark, attempts, negative marking, shuffle questions/options, release results. Pre-fills every new exam a teacher creates.
- **Accessibility & Language** — text scaling (85–140%), high contrast, reduced motion, dyslexia-friendly font, and interface language (EN/FR/YO/IG/HA). Defaults apply platform-wide on every page load; each device can additionally override locally.
- **Security & Session** — idle auto sign-out (minutes), audit retention days, **Lockdown Mode** (emergency portal lock for all non-admins, with a custom notice) — the same switch as the Platform Health security report reads.
- **Module Access Control** — a per-role matrix of which pages appear in the navigation for teacher / student / admin. (Hides links; the real security remains RLS.)
- **Official Signature** — draw the proprietor's signature once on a canvas; stored as a data-URI for certificates and printouts.
- **Exam Watermark** — faint text (e.g. "EXAM2026 — CONFIDENTIAL") available to exam screens.
- **Google Drive Cloud Sync** — Client ID, interval, enable/disable, one-click Authorize / Test / Backup Now.
- **Supabase Connection** — live connection test with latency + forced keep-alive ping with proof.

**How saving works:** the `save_platform_settings(p_patch JSONB)` RPC merges a whitelisted patch server-side, enforces ranges (retention ≥ 7 days, Drive interval 1–90 days) and writes an audit event. Non-admins can read settings but every write requires an active admin role, checked server-side.

---

## 2. Admin Data & Portability (`admin-data.html` + `data-portability.js`)

**What it is:** the data-ownership centre — full-platform backup envelopes, Google Drive sync with restore, **dry-run restores**, per-table archives, a table browser, demo data and disaster recovery.

**Features:**
- **Full Envelope Export** — one JSON file containing every table (institutions, settings, license, profiles, exams, results, students, newest 2,000 audit events) with metadata and counts. Recorded in `system_backups`.
- **Dry-run Restore** — paste or load any envelope and see the exact plan (what will be inserted, updated, skipped and why) **before anything is written**. Approving runs the real restore:
  - exams upsert **by code** (same code → updated, never duplicated);
  - students upsert by (teacher, student ID);
  - results re-inserted through the public RPC **rematched by exam code** (ids never collide);
  - profiles update rows whose auth users still exist (deleted accounts are skipped, honestly reported);
  - settings/license restored via their owner-checked RPCs.
  - Legacy v10.0 envelopes (the old format) are auto-converted.
- **Google Drive** — Backup Now, list backups with restore, connection status, backup history from `system_backups` (Drive + envelope + vault events in one timeline).
- **One-Click Demo Data** — `admin_seed_demo_data()` creates/refreshes a DEMO101 exam with real questions, a 3-student roster and two results. Idempotent.
- **Table Browser** — page through any table (25–200 rows), expand full-row JSON, delete selected rows (owner-only, ≤1,000/batch, audit-logged, whitelist-enforced server-side).
- **Portable Archive Center** — per-table JSON archives with metadata.
- **Batch Exporters** — CSV and JSON per table.
- **Disaster Recovery Migration** — point at a brand-new blank Supabase project (tested live), pick a Drive backup, and re-hydrate everything through the same dry-run engine, with the final step telling you exactly which two constants to update to make the switch permanent.
- **Danger Zone** — purge one exam's submissions **by exam code** (the v3 button called the RPC without an exam id — it could never succeed; fixed and documented).

---

## 3. Storage Manager & Archive Vault (`storage.html`)

**What it is:** the free-tier database efficiency centre. The free tier allows ~500 MB of database but a **separate 1 GB of File Storage** — this page moves cold rows into File Storage as JSON and keeps the database tiny forever.

**Features:**
- **Real table statistics** — row counts AND physical sizes from `pg_total_relation_size()` via the `admin_table_stats()` RPC (the old page showed rough estimates).
- **Quota dashboard** — database footprint vs the 500 MB free allowance, total rows, archive count, local browser cache.
- **Efficiency advisor** — rule-based, runs against the live statistics: green when lean, amber/red with the exact action to take.
- **Archive Vault** — pick a table (results / audit_logs) and a cutoff date. The manager (1) fetches the old rows, (2) uploads a JSON snapshot to the private `archive-vault` bucket (created by the schema; admin-only RLS policies), (3) **verifies the upload**, and only then unlocks the purge button. The purge RPC (`admin_purge_old_results`) **refuses to run without the archive path as proof** — a purge can never happen before its archive.
- **Vault browser** — list, download, restore (idempotent, `ON CONFLICT DO NOTHING`) or delete any archive.
- **Audit purge with download** — the purge RPC returns the purged rows; the page offers them as a JSON archive before they are gone, and refuses to touch the last 7 days.
- **Local device optimizer** — clears exam draft caches from the current browser.

---

## 4. Platform Health Console (`platform-health.html` + `security-guard.js`)

**What it is:** one page that **proves** the platform is alive and safe — with evidence, not assumptions.

**Features:**
- **Latency probe** — live REST round-trip time.
- **RPC smoke tests** — 7 real endpoint tests; "correctly rejected" counts as a PASS (security guards doing their job). Missing objects are identified as "run database/complete-schema.sql".
- **Heartbeat Evidence** — reads the live `sc_heartbeat` row: last ping time, which layer wrote it, total ping count, and whether it is inside the 7-day danger window. A **Write Heartbeat Now** button performs a verified write (the returned timestamp is the proof).
- **Security Posture Report (grade A–F)** from `security-guard.js`:
  - **Key hygiene** — decodes the Supabase JWT and confirms it is the anon key (a service_role key in a browser is an instant F with instructions), and detects expired keys.
  - **RLS probes** — anonymous requests that must FAIL (read audit_logs, write profiles, delete results, read the heartbeat table directly) plus one that must SUCCEED (the heartbeat RPC).
  - **Transport** — HTTPS enforcement (localhost/file exempt).
  - **Session hygiene** — no session material in cookies.
  - **Configuration** — lockdown mode state and idle-lock minutes.
- **10-layer protection matrix** — every layer listed with its status and setup pointer.
- **Copy Report** — a full text report for support conversations.
- **Idle lock & lockdown enforcement** — every app.js page starts an inactivity watcher (default 30 min) that signs out stale sessions, and enforces lockdown mode for non-admins (admins keep access to lift it).

---

## 5. Roles & Status Manager (`status-manager.html`)

**What it is:** the full user-lifecycle console.

**Features:**
- **Access Queue** — pending sign-ups surface at the top with one-click Approve/Reject and **Approve All**. (First user on a fresh platform is auto-super_admin — unchanged.)
- **Search & filters** — by name/email, role, status; sort newest/oldest/name.
- **Bulk actions** — select any accounts and activate/suspend/deactivate in one audit-logged RPC call (`admin_bulk_set_profile_status`). Your own account is excluded automatically; the server re-checks role and enforces valid statuses.
- **Reason capture** — status changes prompt for a reason, recorded in the audit trail.
- **Account drill-down** — role, status, join date, exams created, candidate submissions (computed live), and the user's recent audit events.
- **Role changes** — teacher ↔ admin, super_admin grants restricted to owners (enforced server-side), delete account with double confirmation.
- **Invite flow** — generates a customisable onboarding message (sign-up link + what to expect) to share via WhatsApp/email; honest about Supabase auth (self-register → approve).

---

## 6. Audit / Activity Log (`activity_log.html`)

**What it is:** the searchable, measurable audit trail.

**Features:**
- **Server-side filtering** — action contains, actor contains, date range, page size — all executed inside the `admin_get_audit_logs()` RPC (indexes on created_at, action, actor_email).
- **Statistics** — total events, 24 h, 7 days, unique actors; a 30-day pure-CSS bar chart (no chart library needed offline); top-15 action chips.
- **Live tail** — optional 20-second auto-refresh.
- **Metadata drill-down** — every event expands its JSON metadata.
- **CSV export** and **owner-only retention purge** (with the purged rows offered as a download first; the RPC refuses to purge the last 7 days).
- Everything privileged that happens anywhere on the platform writes here through `log_audit_event()` — approvals, role changes, purges, archives, restores, settings edits, license changes, heartbeats.

---

## 7. Site License — Dual Engine (`license.html` + `site-license.js`)

**What it is:** two complementary licensing engines on one page.

**Engine A — Subscription lifecycle (new).** Lifetime or billed cycles with:
- States: `lifetime / active / warning (≤30 days) / grace (expired + grace days) / expired / suspended`.
- Sources evaluated in priority order: **remote registry JSON** (optional, on hosting the client cannot edit — wins when reachable) → **`site_license` table row** (public read so the lock renders pre-login; owner-checked writes) → **baked config fallback**.
- Tamper evidence: rows carry `sha256(model|expires_on|grace_days|status|salt)`; a hand-edited row fails verification and is flagged.
- Lock & banner UI rendered inside a **closed Shadow DOM**, re-attached by a MutationObserver if removed; re-evaluated every 15 minutes and on tab refocus; skipped on pure exam pages so an in-progress exam is never interrupted.
- Proprietor console: model/cycle/dates/grace/status editing, renewal link, custom lock message, **+30/+90/+365-day quick-extend** (owner RPC, audit-logged), and a **lock-screen test**.

**Engine B — Offline perpetual token (kept, enhanced).** The HMAC-SHA256 certificate from v3 is unchanged in function, now also persistable to the site_license row and verifiable on the page with full details (institution, plan, issue/expiry, candidate limit).

**Honest note (also on the page):** code on client-controlled hosting can never be 100% tamper-proof. These layers make bypass non-trivial and the optional registry keeps the authoritative status in the proprietor's hands.

---

## 8. AI Questions Prompt Studio (`cbt-prompts.html` + `prompt-studio.js`)

**What it is:** a rule-based prompt engineering studio — **no AI API is called or needed** (cost-effective by design). It composes prompts that a teacher pastes into any FREE AI chat; the AI returns a strict CSV that imports directly into the Teacher Hub.

**The 18 packs** (each a genuinely different prompt — its own examiner role, mission, scaled type distribution, briefing sections, quality bar and final checklist):
simple recall · intermediate mixed · advanced HOTS · **enterprise all-18-types** · MCQ-only · **multi-subject (UTME-style, per-subject budgets + topics)** · exam-board simulation (WAEC/NECO/IGCSE/SAT) · from source material · marking-scheme explanations · differentiated tiers · multi-line mathematics · misconception hunter · reading comprehension · proctored certification · early-years primary · physics/chemistry units · professional/clinical/legal · syllabus → term paper.

**The contract:** all packs share the exact 17-column CSV header this platform's importer parses (`Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,Accept,MRQ_AON,Pairs,Items,Difficulty,Tags,Section`) — character-identical or files stop importing. JSON output format is also supported.

**The Explanation Standard:** every generated prompt injects the 4-move marking-scheme rule — verdict in words (never a bare letter, because option order can be randomised per candidate) → numbered reasoning → the misconception behind each wrong option → a memorable takeaway — and the final checklist grades the AI against it.

**Distribution maths:** the `mix()` algorithm scales each pack's reference distribution to EXACTLY the requested count (sum always equals N; the enterprise pack guarantees every type appears when N ≥ 18; verified by 326 unit checks).

**Kept from v3 and hardened:** the output validator (now with a real quoted-CSV parser, markdown-fence stripping, and per-row problem reporting), file loading (`.csv/.json/.txt`), and **Load into Teacher Hub**.

---

## 9. Supabase Free-Tier Protection — all 10 layers

Full manual: **`SUPABASE_FREE_TIER_PROTECTION.md`** (shipped in the platform and every generated package). Layers: heartbeat table+RPC (0), site-visit (1), GitHub Actions twice-weekly with **verified-write watchdog + self-committing anti-freeze** (2+9), Vercel endpoint (3), pg_cron every 2 days (4), manual button (5), UptimeRobot (6), Vercel cron (7), Edge Function `ping` (8), **auto-restore watchdog via the Management API** (10). Every layer performs a REAL database write and the proof (the returned timestamp) is checked; the old "HTTP 200 = fine" assumption is gone.

## 10. Google Drive Sync (`drive-sync.js`)

- **Bug fixed:** the v3 engine read/wrote its settings through a Supabase SDK client (`window.sb`) that never exists in this pure-fetch codebase — Drive settings silently never persisted. They now use plain `fetch()` against `platform_settings` (with the institutions row as fallback), so **every admin device finally shares one Drive configuration**.
- Token flow hardened: closing the Google popup previously left the promise pending forever — `error_callback` + a 5-minute timeout now always settle it, with human-readable messages (popup blocked, closed, declined).
- 401 responses trigger exactly one silent re-auth before surfacing errors; the backup folder is verified (a trashed folder id previously broke every upload forever); rotation keeps the newest 15 backups; every upload is recorded in `system_backups`.
- Scope remains `drive.file` — the app can only see files it creates.

---

## Schema (`database/complete-schema.sql` v4.0) — run once, nothing else needed

- **10 tables** (7 previous + `sc_heartbeat`, `site_license`, `platform_settings`), **41 RPCs**, **24 policies**, private **`archive-vault`** storage bucket, triggers, indexes, seeds.
- **Idempotent everywhere:** `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, drop-then-create policies/triggers, `ON CONFLICT DO NOTHING` seeds, and **`ADD COLUMN IF NOT EXISTS` evolution guards** so older deployments upgrade in place without data loss.
- Verified: balanced dollar-quotes, no destructive statements, every policy/trigger drop-guarded (static checks in the repo test suite).
- Destructive RPCs are owner-only (`is_platform_owner`), batch-capped, whitelist-checked and audit-logged (`admin_delete_table_rows`, `admin_purge_old_results`, `admin_purge_audit_logs`, `admin_restore_archived_rows`).

## Generator (v4.0)

`generator.html` is now a 4-step wizard — Brand & Identity → Theme & Typography → Backend & License → Preview & Download. Upgrades over v3:
- **Themes actually apply** (CSS custom properties `--primary/--accent/--bg/--surface/--primary-dim/...` are rewritten — v3 only swapped the first font-family declaration).
- **No silent failures:** every file fetch is tracked; a missing CRITICAL file aborts with an honest error listing it (v3 swallowed failures with `catch (_) {}` and shipped broken packages).
- **Integrity self-check:** the produced ZIP is re-opened and every expected file verified present before the download starts.
- **License model baked** for the client (`window.CBT_LICENSE` + database seed), plus branding, tagline, contacts, passmark and Drive Client ID.
- **START-HERE.md** — a client-specific 5-minute launch guide written into every package.
- **Live Supabase test** before you generate; 64-file manifest including both workflows, the Edge function, and all docs.

## Testing performed (this release)

| Suite | Result |
|---|---|
| `analysis/prompt_studio_test.js` — 18 packs × 8 counts, build completeness, placeholders, source/subject budgets, JSON mode, statics | ✅ 326 checks |
| `analysis/license_engine_test.js` — all states, normalization, signature determinism | ✅ 12 checks |
| `analysis/phase2_audit.js` — script srcs, handler functions, RPC↔schema, hrefs, load order, module usage, REST tables | ✅ 558 checks clean |
| `analysis/multi_subject_test.js` (Phase 1 regression) | ✅ all subjects graded |
| `analysis/teacher_fix_test.js` (Phase 1 regression) | ✅ 14 passed, 0 failed |
| `analysis/submit_integration_test.js` (Phase 1 regression) | ✅ 4/4, breakdown, time analytics, RPC save |
| Schema static analysis — dollar-quote balance, drop guards, danger scan | ✅ clean |
| HTTP smoke test — every file of the platform serves 200 | ✅ 65/65 |
| Generator manifest vs disk — 64 entries, none missing, none forgotten | ✅ |
