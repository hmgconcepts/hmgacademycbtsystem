# Phase 3 Expert Audit — Findings, Fixes & Enhancements (v4.1)

A full re-examination of every page, module and process (software-testing-expert pass). Ten genuine lapses were found and fixed; every fix is tested and listed here with its root cause. Nothing was removed — only repaired and extended.

---

## A. Lapses & bugs found → fixed

| # | Finding (root cause) | Fix |
|---|---|---|
| 1 | **The superior calculator engine was never used by the exam.** `cbt-exam-kit.js` contains a full tokenising scientific parser, but `student.html` (the real exam page) shipped its own calculator that evaluated with `Function('return …')` — eval semantics — and lacked a dozen functions the main engine had. | `student.html` now loads the engine; `calculate()` evaluates through the safe `SciCalc` parser (no eval) with the legacy path kept only as an absent-engine fallback. |
| 2 | **MS key was a ghost.** The calculator's click handler had an `MS` (memory store) case — but no button anywhere emitted it. | MS added to the memory row; handler wired. |
| 3 | **Postfix percent was broken in the engine.** `50%` in `SciCalc` threw "Malformed expression" (the `%` token was left unconsumed), and the exam calculator regex-converted `N%` blindly — so `7 % 2` (modulo) could never work. | Engine now disambiguates like a real scientific calculator: `%` after a value with no operand following = percent (`50%` → 0.5); with an operand following = modulo (`10 % 3` → 1). 75-check engine suite passes. |
| 4 | **The exam maths keyboard had 83 flat keys, no search, no grouping** — while the engine's own keyboard design (300+ searchable symbols) sat unused in the unused module. | The exam keyboard now carries **300+ symbols in 20 labelled groups with a search box** (Greek complete, calculus, sets & logic, number sets, geometry, vectors & matrices, statistics, brackets, fractions, relations, chemistry, physics units, arrows, super/subscripts) — all feeding the existing `insertMathSymbol` flow and anti-cheat allowances. |
| 5 | **School Connect / GOSA CSVs misparsed silently.** The importer detected a header only by checking whether the first cell *starts with "question"* and then parsed positionally — a School Connect header row (`question,type,a,b,c,d,answer,…`) shifted every column (type landed in option A, mark became the question type). | New **`assets/js/csv-bridge.js`**: canonicalised header mapping over the union of both platforms' aliases, headerless layout detection (14+ columns = HMG positional, fewer = School Connect positional), full type-alias translation (`true_false→tf`, `multi_select→mrq`, `fill_blank→cloze`, `comprehension→case_study`, `long_answer/oral_prompt/peer_review→essay`…), full-text answers converted to A–D letters, pipe-lists converted to JSON pairs. `parseQuestionsCSV` routes through the bridge and falls back to the unchanged legacy parser. 57 bridge checks + 24 integration checks against the real teacher.html code pass. |
| 6 | **No export path back to School Connect / GOSA** ("vice versa" was impossible). | **🔀 Export School Connect CSV** button on every question bank — emits their exact 13-column contract, types mapped back, structured keys JSON-encoded. |
| 7 | **Manual review was invisible.** The tutor-audit modal existed (a Phase-1 repair) but nothing ever told a teacher which scripts needed attention, the marking scheme was not shown, revisions were not audit-logged, and no result was ever flagged. | **Review workflow end-to-end:** schema v4.1 adds `needs_review / reviewed_by / reviewed_at`; `submit_student_result` auto-flags any script containing essay / code / short-answer / case-study questions; the Teacher Hub gains a **🧑‍⚖️ Review Queue** (badge count + modal listing flagged scripts with open-ended question counts); the audit modal now shows the **marking scheme** (expected keywords, minimum words, provisional keyword score, reference explanation, previous audit) and an optional **release** checkbox; saving clears the flag when every open-ended question is audited and writes a `tutor_score_audit` event to the audit log. Candidates see an honest 🧑‍🏫 "score may be adjusted after tutor review" notice for such scripts. |
| 8 | **Anti-cheat guarded the calculator but not the maths keyboard** (window-blur allowance and select-start allowance covered only `#calculator`). | Both guards now cover `#math-kbd` too. |
| 9 | **Generated packages never loaded the chosen font.** The Generator rewrote the CSS `font-family` but every page's `<head>` still requested only Plus Jakarta Sans — every non-default font silently fell back to a generic sans. Also: the PWA manifest kept HMG's name/colours, the service-worker cache name was shared across all clients, and sitemap/robots pointed at the master deployment. | Generator v4.1: `brandHtmlHead` swaps the Google Fonts link to the chosen family (weights omitted deliberately — weighted requests 400-error on single-weight display families), `brandManifest` brands name/short_name/theme/background colours, `brandSW` gives each client a unique cache, `brandSitemapRobots` rebases to the client's deployment URL (new optional field in the wizard). All verified by an 11-check VM suite. |
| 10 | **Help content was stale and thin.** site-help claimed a "14-column CSV" and "37+ question types"; the disaster-recovery, docs and validator pages were undocumented; the bot knew 9 topics with first-match-wins logic; the install prompt was a weekly modal on 5 pages only. | site-help.js rewritten: **20 pages, 78 sections, who-it's-for lines, tips, 4 role-based getting-started paths, 18-term glossary, 6 FAQs, and a Help Center modal**. Chatbot rewritten: **36 score-matched intents** covering every page/feature + quick-question chips + page-aware fallbacks. Install enforcer v2: **persistent GOSA-style banner on every page** (48 h dismissal, honoured "never", iOS walkthrough, install-state detection) + the weekly modal, self-injected, loaded via app.js everywhere. |

## B. Audit method (what was re-examined)

- Cross-reference auditor (`analysis/phase2_audit.js`): every `<script src>` resolves; every inline handler function is defined on the page or its includes; every RPC used in JS exists in `database/complete-schema.sql`; every internal href resolves; module load order correct; REST tables valid — **558 positive checks, clean** (re-run after all Phase 3 changes).
- New suites this phase: `csv_bridge_test.js` (57), `teacher_csv_bridge_integration_test.js` (24), `calc_engine_test.js` (75), generator v4.1 checks (11), chatbot matching probes (9).
- Phase 1 regression suites re-run green: multi-subject grading, teacher fixes (14/14), submit integration (4/4 across subjects, RPC save).
- Schema statics: dollar-quote balance (80, even), single submit RPC, evolution guards intact; HTTP smoke test: every file serves 200.

## C. Enhancements beyond the fixes (all free, no AI APIs)

1. **Universal CSV bridge** — bidirectional School Connect ⇄ GOSA ⇄ HMG compatibility (import any of the three; export to both column families).
2. **Statistics suite in the calculator** — median, mode, sample std, variance, range, count, roundx, rand, randint, todeg, torad — plus ↑/↓ expression replay (last 20), Ans, EE, and **⤵ Use result** which types the answer into the focused answer box; thousand-grouped display; Alt+C / Alt+K shortcuts.
3. **Disaster Recovery console** (`disaster-recovery.html`) — the 7-step, self-verifying, idempotent rebuild path from Google Drive backups into a fresh Supabase project: Drive connection with inspection, live-tested schema readiness, backup selection, dry-run plan, verified execution (live row counts vs envelope), permanent-switch and protection re-arm guidance, and an "every circumstance" matrix (stale backups, collisions, interrupted restores, legacy formats, file fallback).
4. **Review Queue + marking schemes** (item 7 above) — the tutor-oversight feature for every open-ended question type.
5. **Generator v4.1 build output** — client-branded PWA manifest, per-client service-worker cache, deployment-URL-rebased sitemap/robots, actually-loaded fonts, 20-page/65-file manifest.
6. **GOSA-grade install encouragement** — persistent banner everywhere, iOS walkthrough, install-state aware.
7. **Help system** — the Help Center modal (roles, page index, glossary, FAQ) + the detailed per-page guide banner + the 36-intent assistant bot.
8. **`GOOGLE_DRIVE_BACKUP.md`** — unambiguous setup/restore/troubleshooting manual (every error, honestly).
9. **Protection manual v2** — research-verified (September 2026): the 7-day pause rule, why dashboard visits don't count, why internal cron can't be the only layer, and the full menu of free external schedulers (cron-job.org, n8n, browser extensions) alongside the shipped GitHub Actions + UptimeRobot + Vercel stack.

## D. Testing summary

| Suite | Checks | Result |
|---|---|---|
| CSV bridge | 57 | ✅ |
| Teacher CSV integration (real page code) | 24 | ✅ |
| SciCalc engine (incl. new statistics & percent) | 75 | ✅ |
| Generator v4.1 branding (fonts/manifest/SW/sitemap) | 11 | ✅ |
| Chatbot matching | 9 probes | ✅ |
| Cross-reference audit | 558 | ✅ |
| Phase 1 regressions (3 suites) | — | ✅ |
| Schema statics + HTTP smoke | all files | ✅ |
