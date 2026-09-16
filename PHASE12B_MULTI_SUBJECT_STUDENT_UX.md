# PHASE 12B — Multi-Subject Student Experience
### Structured question types rendered correctly at the student end · subject tabs · cross-subject navigation · School Connect / GOSA Portal parity
**Date:** 2026-09-16 · **Trigger:** live report — matching, ordering, categorization, multi-part numeric, assertion–reason and case-study questions were unanswerable at the student end of a multi-subject paper, and students hit the **submit button** at the end of subject 1 with **no subject tabs** to switch with.

---

## 1. Root causes (three real defects, all verified against the running code)

| # | Defect | Why it happened |
|---|---|---|
| 1 | **Structured types unanswerable.** Matching/ordering questions **crashed the renderer** (`pairs.map is not a function`), categorization/multi-part-numeric showed *"⚠️ No … defined"*. The multi-part-numeric **grader** also scored 0 even when answered. | The CSV bridge (correctly) ships the `Pairs`/`Items` columns as **JSON strings**. The renderers/graders for these four types read `q.pairs`/`q.items` raw — a string is truthy and has `.length`, so guards passed and `.map`/`Array.isArray` failed. JSON-bank papers (arrays) worked, CSV papers didn't. |
| 2 | **No subject tabs.** The tab bar existed in the HTML and `renderMultiSubjectTabs()` existed — but it was **only called from inside the switch handler**, which itself could only be reached through the tabs. Dead code circle. | Missed call-site at exam start. |
| 3 | **Submit button at the end of every subject.** `next()` opened the submit modal at the last question of *whatever subject was active*. | `next()` had no multi-subject awareness. |

**Bonus defects found by the audit and fixed in the same pass:**
- `switchStudentExamSubject()` called `prevQuestionRecordTime()` — **a function that no longer exists anywhere in the codebase**: every subject switch threw a `ReferenceError` (masked until now because the tabs never rendered).
- The flag button state used an unprefixed position key, so flag state leaked across subject tabs.
- `jumpToFirstUnanswered()` only searched the current subject.
- Ordering papers that ship **no answer key** (CSV banks list items in correct order) graded 0/100 no matter what the student did.

## 2. School Connect / GOSA Portal study → what was ported

The sibling HMG platforms ([School Connect](https://hmgschoolconnect.vercel.app) and the [GOSA portal](https://gosaportal.vercel.app), source studied from `hmgconcepts/gosaportal`) run a mature UTME-style multi-subject runner. Patterns ported into the CBT system:

| School Connect / GOSA pattern | Now in the CBT system |
|---|---|
| **Sticky subject tab bar** — always visible, active subject highlighted, live `(answered/total)` counters | ✅ sticky at the top of the viewport, per-subject counters that tick as the student answers, ✓ when a subject is complete |
| **`refreshMeters`** — update counters without re-rendering (never rebuild a drag list under the student's finger) | ✅ `_refreshSubjectTabCounts()` — counters/active state only, no button rebuild |
| **Subject-scoped prev/next** — "Next in *Subject* →", explicit end-of-subject, submit is always a separate action | ✅ `next()` flows **into the next subject** ("Next Subject: Mathematics →"), `prev()` returns to the previous subject's last question, submit modal only after the final question of the final subject |
| **Subject + local position indicator** — "Maths · Q 3/10 (overall 13/40)" | ✅ same line in the progress strip |
| **Submit dialog with per-subject progress** | ✅ every subject listed with `answered/total`, ✓/⚠ state, click a row to jump back into that subject |
| **`subject_breakdown` metadata** `[{name,start,end,count}]` + per-question section tags — the sibling platforms' paper representation | ✅ the multi-subject builder now publishes it (`anti_cheat_config.subject_breakdown` + `q.section`), and the student runner **rebuilds tabs from it** when a paper ships flat `csv_data` (legacy/GOSA-built papers get tabs automatically) |
| **`itemsOf` tolerant payload accessors** (cbt-types.js) — JSON string *or* array, never a crash | ✅ `_safeItems`/`_pairsOf`/`_arrOfRaw` + `normalizeQuestionPayload()` at load, in BOTH the multi-subject and single-subject paths |

## 3. What changed

| File | Change |
|---|---|
| `student.html` | Payload normalisation (string→array, both load paths); all renderers + graders + review displays use tolerant accessors; sticky tab bar rendered at exam start; counters refresh on every answer; `next()`/`prev()` subject-aware with honest button labels; per-subject progress in the submit dialog; flag-state fix; `jumpToFirstUnanswered` crosses subjects; phantom `prevQuestionRecordTime` replaced with real time recording; ordering grader default-key fix; legacy `subject_breakdown` fallback |
| `cbt-multi.html` | Publishes `subject_breakdown` + `subjects` metadata and tags every question with its subject (Section); lean retry for old databases now also drops `anti_cheat_config` |
| `sw.js` | cache → `hmg-cbt-shell-v12-phase12b-v1` |
| Generator templates | `student.html`, `cbt-multi.html`, `sw.js` re-synced tokenised (round-trip verified) |

## 4. Verification

- **NEW `phase12b_multi_subject_ux_test.js` — 54/54.** Runtime E2E: boots the *real* student.html script in a VM, loads a CSV-bridge-shaped paper (pairs/items as JSON strings), and proves: every structured type renders a widget with no ⚠️; tabs visible at start with counters; `next()` crosses subjects and only the final boundary opens submit (which lists per-subject progress); `prev()` crosses back; flag state per-subject; jump-to-unanswered crosses subjects; legacy `subject_breakdown` papers get tabs; the **real grader chain** scores matching/ordering/categorization/multi-part-numeric (including half-credit) from string payloads; single-subject regression clean.
- Full suite re-run: **25 JS suites + schema static ALL GREEN** (workflow_audit 616, phase12 integrity 60, assistant bot 155, prompt studio 452, multi-subject CSV 32, …).
- HTTP smoke extended: **243/243** (master + templates assert the new UX wiring).

## 5. Deployment note

Client platforms built with the generator get all of this automatically (templates re-synced). For the live master: deploy the new `student.html`/`cbt-multi.html`/`sw.js` — **no database change required**; already-published exams keep working (papers published before this fix render correctly too, because normalisation happens at load time on the student side).
