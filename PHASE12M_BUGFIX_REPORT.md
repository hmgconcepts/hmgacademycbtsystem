# PHASE 12M — Bug-Fix Report: Session Roles, Navigation Flow & Component Rendering
**Date:** 2026-09-25 · Every reported issue was reproduced in a behavioural test harness before fixing, and every fix is locked in by a new regression suite (`analysis/phase12m_session_render_test.js`, 52 checks).

---

## Issue 1 — “Certificate verify / feature guide (and others) not well-rendered; Link Checker logs the teacher out”

**Root cause A (rendering):** `certificate.html`, `feature_guide.html` and `link_checker.html` run `app.js` (which injects the sidebar, palette, announcements, update pill) but none of them link the platform stylesheet — so every injected component rendered **unstyled** (a raw `<aside>` glued to the page).
**Fix:** new **`assets/css/shell.css`** — a component-only stylesheet (sidebar, palette, announcement banner, update pill, breadcrumbs, chips; every colour uses `var(--x, fallback)` so it adapts to any page). `App.injectShellStyles()` auto-injects it on **every** page app.js runs on — idempotent, never repaints the page's own design, precached by the service worker. Component styles were moved out of `style.css` (single source of truth).

**Root cause B (Link Checker “logout”):** `link_checker.html` is an admin-gated tool. A signed-in teacher clicking it was redirected to **`admin.html` (the admin sign-in)** — from the teacher's perspective, being dumped on a login screen = “logged out”.
**Fix:** authenticated teachers who hit an admin tool are now returned to **their own Teacher Hub with a friendly dismissible banner** (“🔒 Link Checker is an administrator tool… you are still signed in as a teacher”). Anonymous visitors still get the admin sign-in (correct — they need an account). Admin-gated tools now show a **🔒 marker** in the sidebar/palette for non-admins, so nobody clicks blind.

## Issue 2 — “Admin clicking any governance page always returns to the admin dashboard”

**Root cause (two stacked bugs):**
1. `sessionRole()` resolved the role from `getSession()`, which prefers the **`cbt_session` teacher alias** over `cbt_admin_session` — an admin with any teacher alias on the browser was read as a teacher.
2. Even on a clean browser, the admin session stores `{access_token, refresh_token, user}` with **no role anywhere** (Supabase keeps the role in the `profiles` table; the synchronous page-guard cannot query it) — and `sessionRole()` defaulted every role-less session to `'teacher'`. Result: **every governance page bounced the admin back to admin.html.**

**Fixes:**
- `sessionRole()` now resolves the **best session** (`getBestSession()` — admin preferred, never masked by a stale alias), honours a `profile.role` stamp / `user_metadata` / JWT role claim, and treats a session saved under `cbt_admin_session` as **admin by construction** (admin.html only saves it after verifying `ADMIN_EMAIL` / `profiles.is_admin`).
- **admin.html stamps the verified role** (`super_admin` for the owner, `admin` for profile-based admins) into the saved session at every write (login, adoption, token refresh).
- **`?next=` is finally honored**: after sign-in (or session restore), the admin is delivered to the exact page the guard took them from — target normalized for clean URLs and allowlisted (off-site values rejected).
- **Multi-Subject Builder smart routing**: the admin nav's “Multi-Subject Builder” now checks for a teacher session — with one, straight to the builder; without, to the Teacher Hub with an explanatory note (the admin session is untouched). cbt-multi's sign-in banner recognizes administrators and explains the workspace split instead of a generic “not signed in”.

## Issue 3 — Full-platform audit (every page, method, flow)

- **36 regression suites + 346 HTTP smoke checks — all green** (link integrity, event-handler resolution, RPC coverage, session-key matrix, teacher/admin nav separation, licence-guard states, generator client builds).
- The full per-page interconnectedness matrix is maintained in `PHASE12L_COMPLIANCE_AUDIT.md`; the generator's full-stack SaaS chain is re-verified by `generator_build_test` (client builds: branding, credential injection, client-mode strip, leak scan, verified ZIP).
- **No pre-existing feature was removed** — this phase is purely additive/repair (all 12I enterprise features intact).

## New surface in 12M (all free-tier, no AI APIs)
`shell.css` + `injectShellStyles()` · best-session role resolution · role-stamped admin sessions · `honorNextParam()` · friendly teacher denial banners (`roleNotice`) · 🔒 gated-tool indicators · `openMultiBuilder()` smart routing · admin-aware cbt-multi banner.

## Deploy
Follow `DEPLOYMENT_GUIDE.md` with `cbt-system-PHASE12M.zip` / `cbt-generator-PHASE12M.zip`. After deploying: hard-refresh once (Ctrl+Shift+R) — the service-worker cache may serve the previous version until the 🚀 update pill appears — and **sign in to the Admin Panel once** so your stored session gains the role stamp (existing stored sessions predate it; new logins get it automatically).
