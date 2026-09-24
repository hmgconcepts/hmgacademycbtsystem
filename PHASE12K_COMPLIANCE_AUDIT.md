# PHASE 12K — Prompt-Compliance & Full-Platform Audit
**Date:** 2026-09-24 · **Method:** live-site probes (hmgacademycbtsystem.vercel.app, cbtgen.vercel.app) + fresh clone of the GitHub repo (commit `f4bc711`, 2026-09-24 10:49) + byte-level tree diff against the workspace build + full regression.

> **Why the issues persisted — the executive answer.** You deployed the Phase 12J build correctly (the live repo content matches it byte-for-byte). But **GitHub's "Add files via upload" can only add and overwrite — it can never delete files.** The retired `license.html` and `client-monitor.html` from the older upload therefore stayed live with full functionality. Separately, the upload **dropped the `.github/` dot-folder** (it arrived mangled as `,github/`), silently killing 2 of the 10 anti-pause layers. And a third, pre-existing bug — the **clean-URL page-detection flaw** — made every page-name comparison (access guards, chatbot page-awareness, help center, license banner) fail whenever the site is served at Vercel's canonical clean URLs (`/storage` instead of `storage.html`). Phase 12K fixes all three with a different, upload-safe approach.

---

## 1. Prompt-by-prompt compliance (the whole conversation)

| # | Directive (your words/intent) | Status before 12K | Evidence & 12K outcome |
|---|---|---|---|
| 1 | *Deep audit of repos + live site, fix every bug* | **Partially obeyed** — audits were repo-local; the live deployment pipeline itself was never audited | 12K audited the live GitHub repo + both live sites. Found 4 live defects (below) — all fixed or neutralized in this phase |
| 2 | *Sidebar nav pane on ALL internal pages; never disappears; robust, all-inclusive, self-contained, seamless* | **Fully obeyed in code** (12J `bindShell()`), verified live (app.js deployed) | Enhanced in 12K: + breadcrumbs, + user chip with sign-out, + 🔎 Search button, + global Ctrl+K palette. Also fixed the clean-URL bug that broke active-highlighting on live |
| 3 | *Unique per-page descriptions; chatbot/help robust and page-aware* | **Fully obeyed in code** (12J), **but broken live** — the clean-URL bug made chatbot/help fall back to generic content on every live page | 12K fixed page-detection in app.js, chatbot.js, site-help.js, site-license.js — page-aware help now works under clean URLs |
| 4 | *Site Licence must NOT exist on the client platform (no subscription bypass)* | **Obeyed in the build, defeated by the deploy method** — file deleted from the zip, but GitHub upload can't delete, so it stayed live | 12K different approach: upload-safe **tombstone** pages ship in the zip (instantly neutralize the live pages on next upload) + exact GitHub deletion steps in DEPLOYMENT_GUIDE.md + an automated leakage check in the Deployment Validator |
| 5 | *Client Monitor must NOT exist on the client platform* | Same as #4 | Same fix |
| 6 | *Update every file, page and section across all repos* | Fully obeyed (sw bump, FEATURES, tests, both repos) | Re-done for 12K across both repos |
| 7 | *Never drop pre-existing features — enhance them* | **Fully obeyed** — nothing was dropped. Licence/Client Monitor were *relocated* to the builder console (generator root), not removed from the ecosystem; every prior feature (Drive V9.4, DR wizard, sealed backups, health cards, audit print…) is intact and re-verified by the regression suites | 12K adds features on top (palette, breadcrumbs, announcements, user chip, validator scans) — zero removals |
| 8 | *Free tools only; no paid AI APIs* | Fully obeyed — every feature is pure front-end/Supabase-free-tier | 12K additions likewise: zero paid APIs, zero new services |
| 9 | *More sophisticated than School Connect / GOSA* | Fully obeyed (12I parity report) | Extended in 12K (School Connect has no global palette, no broadcast announcements, no upload-leak scanner) |
| 10 | *Detailed deployment steps* | **Partially obeyed** — steps existed across docs, but nothing explained the GitHub-upload deletion trap that caused this exact incident | 12K ships DEPLOYMENT_GUIDE.md — one definitive, unambiguous, step-by-step runbook |
| 11 | *Generator must deliver a full-stack SaaS platform* | Fully obeyed — generator stamps branding, client Supabase creds, license injection, client-mode strip, leak scan, verified ZIP | 12K re-verified (`generator_build_test`) + the guide documents the SaaS workflow; **action required: redeploy cbtgen.vercel.app** (it still runs the pre-12J build whose templates ship builder tools to clients) |

**Conclusion:** the code obeyed the directives; the *deployment channel* and one pre-existing URL-handling bug were what "still persisted". 12K closes both.

---

## 2. Live defects found (all verified against production, not assumed)

| # | Defect | Live evidence | 12K fix |
|---|---|---|---|
| L1 | `license.html` still live with full console (subscription-bypass surface) | HTTP 200, contains `extend_site_license`, quick-extend, save licence RPCs | Tombstone in the zip overwrites it on next upload; GitHub deletion steps in the guide; Validator flags it red until gone |
| L2 | `client-monitor.html` still live | HTTP 200 | Same |
| L3 | `.github/workflows/supabase-heartbeat.yml` + `supabase-auto-restore.yml` missing from the repo (mangled to `,github/…`) — 2 of 10 anti-pause layers dead | `git ls-files` shows `,github/a`, `,github/workflows/…`, no `.github/` | Guide gives the exact re-create steps (Add file → Create new file → paste path) + git CLI alternative |
| L4 | Clean-URL page-detection flaw (pre-existing, every phase): guards, chatbot, help, licence banner all compared `'storage'` against `'storage.html'` and silently failed | Vercel 308s every `.html` to clean URL; `/storage` serves 200 to anonymous curl | Normalization added to `pageName()` (app.js), chatbot.js, site-help.js, site-license.js — under `/storage` the guard now correctly demands sign-in, the chatbot/help show the Storage guide, and an expired platform keeps admin sign-in reachable |
| L5 | Generator site (cbtgen.vercel.app) runs the pre-12J build — its templates still ship `license.html`/`client-monitor.html` into every generated client | `templates/license.html` → 200 | Redeploy from `cbt-generator-PHASE12K.zip` (guide, Part B) |

## 3. Phase 12K additions (all free-tier, zero paid APIs)

1. **🔎 Global command palette (Ctrl+K / ⌘K)** — role-aware search across every page, tool and action; keyboard-navigable; works offline; never intercepts the exam runner.
2. **🍞 Breadcrumbs** in the sidebar (Home › Group › Page) — seamless "you are here" + back-navigation.
3. **👤 User chip** — signed-in identity, role badge and one-click sign-out (clears every session alias) on every shell page.
4. **📣 Announcement Banner** — admins broadcast a notice (info/warning) from Settings; renders on every page for every visitor; dismissal is per-message, per-session; stored in the existing `branding` JSONB — **zero schema migration**.
5. **🛡️ Deployment Validator: builder-tool leakage + stale-artifact scan** — catches L1/L2/L3-class issues automatically post-deploy, with the exact fix printed.
6. **Clean-URL hardening** across the 4 page-detection code paths.

## 4. Regression status

- All JS suites pass (now including the new `phase12k_cleanurl_test.js` and the 12J shell suite).
- HTTP smoke: 300+ checks green (updated for tombstones + new features).
- Service worker: `hmg-cbt-shell-v12-phase12k-v1`.
- Deliverables: `cbt-system-PHASE12K.zip`, `cbt-generator-PHASE12K.zip`.
