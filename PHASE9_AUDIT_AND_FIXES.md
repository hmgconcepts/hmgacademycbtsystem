# PHASE 9 — Multi-Subject CSV Round-Trip, All-Page Assistant Bot, Subscription Monitoring & Anti-Pause

**Product:** HMG Academy CBT Pro (CBT System) + CBT System Generator — products of HMG Concepts
**Date:** Phase 9 · 2026-09-14
**Scope:** (1) Multi-Subject paper prompts → downloadable CSV → tabbed multi-subject CBT, exactly like School Connect / GOSA Portal; (2) the CBT System Assistant rebuilt as a page-aware, all-inclusive guide; (3) builder-side subscription monitoring, bypass/override, and the guarantee that an expired client platform is never paused by Supabase inactivity; (4) every file updated across both repos. No features removed — enhanced only.

---

## 1. Multi-Subject CSV round-trip (Issue 1)

**Studied:** the live School Connect / GOSA Portal implementations (`cbt-prompts.html` ENTERPRISE STRICT CSV prompt + `cbt-multi.html` V10.4 one-file import + `verify-v5-cbt-tabs.js` tab contract).

### What was already right
- The Prompt Studio's **Multi-Subject paper (UTME / Common Entrance style)** pack already enforces: one CSV file, the exact 17-column header, the **Section column = subject name** ("the platform splits the paper into subject tabs by this column alone"), per-subject budgets, and "OUTPUT A DOWNLOADABLE FILE — NOT RAW TEXT" with a named `.csv` attachment.
- `student.html` already renders **subject tabs** with per-subject progress (`multi-subject-tab-bar`, `renderMultiSubjectTabs`, `switchStudentExamSubject`) and per-subject grading.

### What was missing (now fixed)
The **builder** page could not ingest the very file the prompt produces — teachers had to split the combined CSV by hand into one file per subject, and the per-subject uploader used a naive line-split parser that broke on quoted multi-line fields. Fixed in `cbt-multi.html`:

1. **⚡ Fast lane — one combined CSV (recommended):** paste or upload the ONE file (CSV *or* JSON array) → **🪄 Split into subjects** groups every question by its Section column and fills the subject blocks automatically — names, counts, questions, types, Pairs/Items JSON and tolerances all survive because parsing goes through the platform's universal **CSVBridge** (School Connect / GOSA headers, any column order, headerless positional layouts, quoted multi-line fields, type aliases). Questions without a Section land in a "General" block.
2. **Per-subject upload upgraded** to the same CSVBridge parser (the naive line-split is gone).
3. **⬇️ Sample CSV** — `database/sample-multi-subject.csv` (3 subjects × 4 questions, mixed types incl. matching-with-JSON and multi-line quoted fields) downloadable from both the builder's Fast lane and the Prompts Studio's UTME cards, so anyone can see the exact expected format.
4. **Publishing metadata fixed:** the exam's subject metadata is now properly encoded (`title|class|term|type|session|passmark` with new Term / Session / Paper Type / Pass Mark fields), the access-code generator uses the platform's 6-character contract, empty subjects warn before sample placeholders are used, and the success message names the subject tabs students will see.
5. **Prompts Studio page:** the UTME quick-classic and Strict-UTME library cards now state the downloadable-file deliverable explicitly and link straight to the builder's Fast lane + sample CSV.

**Verified end-to-end in tests:** sample CSV → parse → split → 3 subjects × 4 with every type intact; School Connect 13-column combined CSV splits identically; JSON arrays split; multi-line quoted fields survive; student tab bar present.

## 2. The CBT System Assistant, rebuilt (Issue 2)

`assets/js/chatbot.js` v5.0 — still **100% offline, rule-based, zero AI API**:

- **Page-aware on every page (21 pages):** the greeting names the page you are on and its purpose; the quick-question chips adapt to the page; "what is this page?" / "explain this page" returns the full guide — purpose, who it's for, **every section explained**, and the page's tips. The guides come from the same source the 📘 Help Center renders (`site-help.js`), so the bot and the Help Center can never disagree; a built-in fallback map keeps the bot working even if that file fails to load.
- **Section-level search:** asking about a section by name ("how does the review queue work?" on the Teacher Hub) finds and explains that exact section, with name hits weighted double.
- **46 intents** (up from 36) covering every page and process: exam creation, CSV formats + cross-platform compatibility, all 20 question types, the multi-subject Fast lane, sample downloads, calculator & maths keyboard, integrity/proctoring, drafts & crash restore, results & manual review, AI prompts, the generator, Drive backup, disaster recovery, envelopes, free-tier protection, storage, health, roles, audit, certificates, PWA install, offline mode, accounts, rosters, schema, security, navigation, first-time paths, pricing — plus the new **exam-locked troubleshooting**, **subscription lifecycle & renewal**, **client monitoring**, and **bypass/override** intents.
- **No weak false positives:** a minimum match score threshold; gibberish gets a guided, page-aware fallback instead of a wrong answer.
- The bot and the Help Center are now included on **question-types.html** too (previously the only page without them).

## 3. Subscription monitoring, bypass & the anti-pause guarantee (Issue 3)

### 3a. Monitor every client from your end — 📡 Client Monitor (`client-monitor.html`, new page)

An owner/admin-gated console (behind the admin sign-in, in the admin nav) where the builder registers every delivered platform and watches it live:

- **Registry:** name, slug, deploy URL, model, notes, and the client's Supabase URL + **anon key** — which only ever reads the client's **public** `site_license` row (public by design so lock screens render pre-login). No secrets, no writes to client data. Stored in your own Supabase through three new admin-gated, audit-logged RPCs.
- **Live status board:** "Check all now" polls every client's actual license row and shows 🟢 active/lifetime · 🟡 warning (days left) · 🟠 grace · 🔴 expired (days over) · ⏸ suspended · ❌ unreachable (usually a paused project — restore guide linked). States are computed by the same battle-tested engine (`SiteSub.evaluate`) that runs the client-side locks.
- **Override / bypass generator:** one click builds the exact **license-registry JSON** for a client — extend the expiry, flip status to active, or convert to lifetime (courtesy/permanent access). The registry (a small JSON file you host) always beats the client's local values.

### 3b. Renewal is always possible — the lock can never lock you out

`assets/js/site-license.js` v5, now loaded on **every page** (public pages included — the engine finds project credentials from `App`, `window.SB_URL` or the global `SB_URL/SB_KEY` bindings):

- **`license.html` and `admin.html` are exempt from the full lock** — they show the banner instead. The proprietor can always sign in and quick-extend (+30/+90/+365 days) from inside, even while the rest of the portal is locked.
- **The lock defers while a candidate has an exam in progress** (`examActive`) and re-checks after submission — a paper is never interrupted mid-flight.
- The lock screen itself now carries renewal instructions and the reassurance below.

### 3c. EXPIRED ≠ PAUSED — the anti-pause guarantee

Supabase pauses free projects after ~7 days without database activity. A locked, unused, expired client platform would previously drift toward that cliff. Now:

1. **The licence guard heartbeats:** whenever it evaluates a subscription to grace/expired/suspended, it fires a real database write (`sc_keep_alive`, source `license-guard`). Anyone opening the locked portal — the proprietor included — keeps the project warm.
2. **Layer 2 runs regardless of the licence:** the twice-weekly, self-committing, watchdog-verified GitHub Actions heartbeat keeps writing even with **zero visitors**.
3. Documented as a new section — *EXPIRED SUBSCRIPTION ≠ PAUSED PROJECT* — in `SUPABASE_FREE_TIER_PROTECTION.md`.

**Bottom line:** an expired client platform stays warm, reachable and renewable; renewal restores full access instantly with no rebuild and no data loss.

### 3d. Database support (database/complete-schema.sql)

- New **`client_registrations`** table (Section 2.11) with full Section-3.9 column reconciliation (NOT NULL columns carry fallback defaults — the static audit enforces this), an `updated_at` trigger, and **RLS deny-all direct access** (everything goes through the RPCs).
- Three new RPCs — `admin_list_client_registrations()` (7.5), `admin_upsert_client_registration(p_client)` (7.6), `admin_delete_client_registration(p_id)` (7.7) — all `SECURITY DEFINER`, admin-gated via `is_platform_admin()`, audit-logged, and registered in the Section-0 drop list so the schema stays **fully idempotent** on drifted databases.
- `admin_browse_table` whitelist extended so Admin Data can browse the registry.
- *A security hole was caught and fixed during verification:* the first draft of the list RPC lacked its admin gate — the real-PostgreSQL test proved anon could read the registry; the gate is now in place and proven.

## 4. Verification (all green)

- **Real PostgreSQL 17** (`schema_pg_verify.sh`): legacy-drift upgrade, idempotent re-runs ×2, harsh-drift self-heal, 11-RPC smoke, Phase 8 probe block, and the new **Phase 9 block** — client registry shape, RLS enabled, anon refused (`Not authorized`), admin round-trip upsert → list → update → browse-whitelist → delete, audit trail written. **ALL PASS.**
- **Static schema audit:** 30/30 checks (incl. new client-registry set).
- **New `multi_subject_csv_test.js`:** 32/32 — sample CSV split, School Connect CSV split, JSON split, multi-line survival, builder/prompts/student wiring.
- **New `assistant_bot_test.js`:** 155/155 — page-aware greeting + chips + full guides on all 21 pages, fallback without SiteHelp, 13 key intents, no false positives on gibberish, section matching, bot + guard wired on every page, guard behaviours.
- **License engine:** 19/19 (was 12) — renewal-page exemption, exam deferral, expired/grace keepalive touch, active does not touch, multi-source credentials.
- **Full battery:** calc 75, CSV bridge 57, prompt studio 452 (24 packs, 20 type rules), phase-2 audit 637 positive checks, sample-bank E2E, multi-subject grading, submit integration, teacher CSV integration, guard matrix, runtime, sample parse, teacher fixes 41/41 — **all pass**.
- **HTTP smoke:** 134 checks across both packages. **Generator E2E:** re-verified after sync (see §5).

## 5. Files changed / added (both repos, synced + tokenised)

| File | Change |
|---|---|
| `cbt-multi.html` | ⚡ Fast lane combined-CSV import, CSVBridge parsing, sample CSV download, prompts link, proper publish metadata, open-by-default |
| `cbt-prompts.html` | Downloadable-file deliverable + sample CSV + builder links on the multi-subject cards |
| `database/sample-multi-subject.csv` | **NEW** — 3-subject × 4-question demonstration bank (mixed types, Section column) |
| `assets/js/chatbot.js` | **v5 rewrite** — page-aware engine, 46 intents, adaptive chips, section search, guided fallback |
| `assets/js/site-help.js` | Fast-lane guide sections, client-monitor guide, license renewal tips |
| `assets/js/site-license.js` | **v5** — runs on every page, renewal-page exemption, exam deferral, expired-but-alive heartbeat, multi-source credentials, better lock copy |
| `client-monitor.html` | **NEW** — admin-gated client registry + live status board + override generator |
| `assets/js/app.js` | client-monitor wired into the admin guard lists + admin nav |
| `database/complete-schema.sql` | `client_registrations` table + 3.9 reconciliation + 3 admin RPCs + RLS deny-all + trigger + browse whitelist + drop-list entries |
| `question-types.html` + 19 other pages | assistant bot / licence guard script wiring |
| `deployment_validator.html` | new files added to the post-deploy checklist |
| `SUPABASE_FREE_TIER_PROTECTION.md` | EXPIRED ≠ PAUSED section |
| Generator `assets/js/generator.js` | MANIFEST: client-monitor.html, sample-multi-subject.csv, PHASE9 doc |
| Tests | `multi_subject_csv_test.js` (new), `assistant_bot_test.js` (new), `license_engine_test.js` (+7), `schema_static_test.py` (+10), `http_smoke_test.py` (+21), `schema_pg_verify.sh` (+Phase 9 block), `phase2_audit.js` (event.* built-ins) |

## 6. Deployment steps

1. **CBT system deployments:** deploy the Phase 9 package (or just the changed files) and **re-run `database/complete-schema.sql` once** in the Supabase SQL Editor — idempotent; it adds the client registry + RPCs and re-reconciles any drift. Then hard-refresh (Ctrl+Shift+R) so the new bot and licence guard load.
2. **Using the Client Monitor:** sign in as admin/super_admin → 📡 Clients → register each delivered platform (their deploy URL, Supabase URL + anon key) → **Check all now**. The anon key is on the client's `assets/js/app.js` (line `const SB_KEY=`) — it is public by design.
3. **Renewing / bypassing a client:** their License console (quick-extend) — or your registry override snippet from the Client Monitor → paste into your hosted `license-registry.json` → the client platform picks it up within 15 minutes (the registry always wins).
4. **Generator product:** the wizard now ships client-monitor.html + the sample multi-subject CSV + this doc in every generated package automatically.

---

*HMG Academy CBT Pro — Learning Deliberately. Teaching Authentically. A product of HMG Concepts.*
