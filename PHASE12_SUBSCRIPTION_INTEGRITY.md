# PHASE 12 — Subscription Integrity & Client Mode
### Builder/client product split, provider-managed renewals, keep-alive guarantees, teacher-nav separation, and the multi-subject csv_data publish fix
**Date:** 2026-09-16 · **Principle honoured throughout:** nothing removed from the master platform — builder tooling is *separated* into the builder's deployment, and client builds are hardened.

---

## 1. The business model, made tamper-proof

**Your directive:** clients must never be able to bypass the subscription mode; you (HMG Concepts) monitor and renew every client platform from your end; an expired client platform must never pause, so renewal is always easy.

### 1.1 What clients receive (generator output) — and what they never see
| Component | Client build |
|---|---|
| License **enforcement engine** (`site-license.js`, lock screens, banners, heartbeat keep-alive) | ✅ shipped — every platform enforces its license |
| License **console** (`license.html` — status editing, quick-extend +30/+90/+365) | ❌ **not shipped** |
| Client **Monitor** (`client-monitor.html` — your registry/control room) | ❌ **not shipped** |
| `extend_site_license` / `save_site_license` RPCs | ✅ present but **refuse local changes**: *"License changes on this deployment are managed by the platform provider (HMG Concepts). Contact your provider to renew."* |
| Renewal UX (lock screen + banners) | **Provider-managed:** contact HMG Concepts / Renew button — no self-service wording anywhere |

**How it works technically:** the master repo marks builder-only blocks with `BUILDER-ONLY` markers (HTML comments / JS comments) and the license self-service guards with `LICENSE-SELF-SERVICE-GUARD` markers. The generator's new **`applyClientMode()`** pass — wired before branding and the credential leak-scan — strips every marked block and swaps the license guards to the provider-managed denial. Result: even a client's own super_admin, working directly in their Supabase SQL editor, cannot flip their subscription through the platform's RPCs, and the hosted **license registry always wins** over any local value on the client platform.

### 1.2 What YOU keep (the builder's master deployment)
The master repo (your deployment, e.g. `hmgcbtsystem.vercel.app`) keeps everything: the License console (owner-only), the Client Monitor, and owner-gated license RPCs — your control room for the subscription business.

## 2. "Expired platforms never pause" — the keep-alive stack

Supabase pauses free-tier projects after **7 days of inactivity**. A client who stops paying must NOT lose their data or their instant-renewability. Five layers now protect every client platform:

1. **Scheduled heartbeat** — `.github/workflows/supabase-heartbeat.yml` (shipped in every client package) pings the `sc_keep_alive` RPC on GitHub's schedule, portal state irrelevant.
2. **Lock-screen keep-alive** — `site-license.js` explicitly touches the heartbeat RPC whenever an expired/grace/suspended platform is opened (`keepAliveTouch()`).
3. **Auto-restore** — `.github/workflows/supabase-auto-restore.yml` brings a paused project back (documented restore guide).
4. **External pingers** — `api/keepalive.js` (Vercel function) + the free external-scheduler menu (cron-job.org / UptimeRobot / n8n), documented in `SUPABASE_FREE_TIER_PROTECTION.md` — set once per client at delivery.
5. **🫀 NEW — Builder-side keep-alive sweep** — the Client Monitor's new one-click sweep pings **every registered client's** heartbeat RPC directly from your side (the registry stores each client's public Supabase URL + anon key), with an honest per-sweep report (warmed ✓ / unreachable — possibly paused / skipped — no credentials stored). **Run it weekly** (or after any break) and no client database — expired or not — ever goes cold.

## 3. The multi-subject publish bug (live error of this phase)

**Error:** `Publish failed: null value in column "csv_data" of relation "exams" violates not-null constraint`.

**Root cause (verified against the ORIGINAL baseline — present since day one):** the Multi-Subject Builder's payload never included `csv_data`. On databases where the `exams.csv_data` column is `NOT NULL` **without a default** (your live database drifted this way), the insert is rejected. The same audit found a sibling defect: **duplicating** a multi-subject exam silently dropped `subjects_data`/`is_multi_subject`, degrading the copy into a flat single-subject paper.

**Fixes (robust on every schema state, no database update required):**
- The publish payload now always sends **`csv_data`** — the flattened question list in engine order (which also keeps Duplicate and every single-subject-style reader working), an explicit **`exam_mode`**, and per-subject entries carrying **both** reader keys (`questions` for the student engine, `csv_data` for teacher-side analytics and the schema's documented shape).
- Duplicate now carries `is_multi_subject` + `subjects_data` (never null → NOT-NULL safe).
- Schema drift-healing added: `ALTER TABLE … ALTER COLUMN csv_data/subjects_data SET DEFAULT '[]'::jsonb` — running `database/complete-schema.sql` once re-asserts the defaults on drifted databases like yours (the payload fix works even before you do).

## 4. Teacher navigation pane (your directive #2)

The 10 administration consoles — ⭐ Admin Panel, 💾 Data & Drive Sync, 🚨 Disaster Recovery, 📦 Storage Manager, 🩺 Platform Health, 👥 Roles & Approvals, 🛠️ Platform Settings, 📜 Site License, 📊 Audit Log, 📡 Client Monitor — are **admin pages** and are now completely absent from the teacher navigation pane (the hidden-admin-section reveal logic was removed too). They live in the **Admin Panel's own navigation**, which lists every page. Teachers keep: Dashboard, Create, Assessments, Results, Analytics, Multi-Subject Builder, AI Prompts Studio, Question Types Guide, Settings, Students + the Platform Pages section (Portals Home, Student Portal, Certificate Verify, Feature Guide, Deployment Validator, Link Checker). Admins reach the Admin Panel via **Portals Home → Admin Sign In**.

## 5. What changed where

| File | Change |
|---|---|
| `cbt-multi.html` | csv_data + exam_mode always sent; subjects_data carries both reader keys |
| `teacher.html` | Administration section removed from sidebar (+ dead reveal code); duplicate carries multi-subject identity |
| `database/complete-schema.sql` | `ALTER COLUMN … SET DEFAULT` drift-heal; `LICENSE-SELF-SERVICE-GUARD` markers on both license RPCs |
| `assets/js/site-license.js` | Lock/renewal banners rewritten provider-managed (no self-service wording) |
| `client-monitor.html` | 🫀 Keep-alive sweep (ping all clients) |
| `admin.html`, `settings.html`, `deployment_validator.html`, `sw.js`, `assets/js/app.js`, `assets/js/chatbot.js`, `assets/js/site-help.js` | `BUILDER-ONLY` markers around every builder-console reference |
| `cbt-generator-package/assets/js/generator.js` | `applyClientMode()` pass (strip + guard-swap) wired before branding/leak-scan; MANIFEST drops license.html + client-monitor.html |
| `cbt-generator-package/templates/` | license.html + client-monitor.html **deleted**; all changed files re-synced tokenised |

## 6. Deployment / runbook

**For a NEW client (subscription or one-time):** run the generator → hand over the ZIP → client runs `database/complete-schema.sql` in their Supabase → their platform enforces whatever license the registry/row says. They have no console and no self-service extension — renewal comes through you.

**For YOUR live deployment (hmgacademycbtsystem — currently running the pre-Phase-12 build):**
1. Deploy this package (the master keeps your consoles).
2. Re-run `database/complete-schema.sql` once (adds the defaults drift-heal + this phase's RPC updates).
3. For each delivered client: register them in the **Client Monitor** (name, deploy URL, their Supabase URL + anon key), host your `license-registry.json`, and click **🫀 Keep-alive sweep** weekly.
4. Set a free external pinger on each client's `/api/keepalive` (see SUPABASE_FREE_TIER_PROTECTION.md).

**To renew a client:** update your hosted registry (or use the monitor's override snippet) — the client platform re-checks and unlocks instantly. No site visit needed.

## 7. Verification

- `phase12_subscription_integrity_test.js` — **56/56** (behavioural: real payload construction, real `applyClientMode` strip/swap, marker pairing, rendered-reply cleanliness, banner wording, sweep wiring)
- `workflow_audit_test.js` — **616/616** (new navigation model: teacher pane excludes admin consoles; Admin Panel pane lists every page; all handler/link/RPC/session checks green)
- `generator_build_test.js` — E2E **PASS** incl. new client-mode assertions (no license console, no client monitor, zero marker leaks, provider-managed license RPCs, no sw.js precache of license.html, schema drift-heal shipped)
- Full Phase 1–11 regression re-run — ALL GREEN · HTTP smoke extended (master keeps both consoles; templates 404 for both)
