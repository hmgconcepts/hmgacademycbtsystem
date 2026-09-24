# PHASE 12D — Assertion–Reason & Case-Study Data-Contract Heal

**Date:** 2026-09-17 · **Scope:** student runtime, CSV bridge, authoring spec · **Regression:** 27/27 suites green (exit-code verified), smoke 264/264, new Phase-12D suite 32/32 (25× consecutive runs)

## The two live bugs (user-reported, screenshots)

1. **Assertion–Reason questions rendered no assertion text, no reason text and no options.**
2. **Case-study passages rendered but the options were broken — students could not click to pick the right option.**

Both were *data-contract* bugs: the student runtime was fed papers authored in the shapes the two authoring guides actually document (which differ from each other), and it crashed or rendered nothing.

## Root causes (verified by live repro through the real CSVBridge → student pipeline)

| # | Cause | Effect |
|---|-------|--------|
| 1 | `_safeItems()` returned parsed JSON even when it was an **object** (`{"assertion":…,"reason":…}`) | `items.filter is not a function` TypeError → AR renderer crashed, rendered nothing |
| 2 | Guide's AR example row is **shifted**: 5 option statements in columns 2–6 (5th sits in the CorrectAnswer column), key letter in the Explanation column | `q.ans` = an option's *text* → ungradeable; 5th option never rendered |
| 3 | The two guides use **different key spellings** — AR items `[{"a":…},{"r":…}]` vs `{"assertion":…,"reason":…}`; matching/categorization/multi-numeric payload in the **Pairs column** with `{l,r}` / `{label,ans,unit}` keys | renderers read `q.items` → "no items defined" → unanswerable |
| 4 | Type aliases never canonicalised: `assertion-reason`, `case study`, `true-false`, `multi-select` strip to `assertionreason`, `casestudy`… which matched nothing | questions fell through to unknown-type handling |
| 5 | `cbt-multi.html` publishes CSVBridge output **raw** (the single-subject flow normalises; the multi-subject flow does not) | already-published papers carry the raw shapes forever |

## The fix — one normaliser, every documented shape

### 1. `getQType` alias map (`_TYPE_CANON`) — student.html + csv-bridge.js
Every spelling/hyphenation/alias of every type name (`assertion-reason`, `case study`, `true-false`, `multi-select`, `comprehension`, `passage`, `multipart-numeric`, `fill-in-the-blank`, `long-answer`, `code-output`, `ar`, …) resolves to the canonical type. The bridge canonicalises at parse; the student runtime heals again at load (already-published papers are covered).

### 2. `normalizeQuestionPayload` v2 — the documented-contract heal (student side)
- **Pairs-column routing:** empty `items` + payload in `pairs` → routed for categorization / multi_numeric / matrix / ordering / cloze / hot_text.
- **Key spelling:** pairs `{l,r}`→`{left,right}` (DISTRACTOR rows → `distractors`); categorization → `{item,category}`; matrix → `{statement,answer}` (incl. the guide's `{row,answer}`); multi-numeric `{ans,value}`→`answer`, `{tol}`→`tolerance`.
- **AR stems:** from items object `{"assertion","reason"}`, from array `[{"a"},{"r"}]`, or parsed from the `"A: … R: …"` pattern in the question text.
- **5-option shift heal:** if `ans` is option *text* and the Explanation column holds the key letter → `q.e = ans text` (the real 5th option), `q.ans = key letter`. Text-match fallback maps an option-text key back to its letter. Applies to mcq / tf / assertion_reason / case_study / image_mcq / evidence_mcq; `True`/`False` keys normalise to A/B.
- `_safeItems` is now array-only; a new `_itemsObjOf` reads object-shaped items JSON without ever crashing.

### 3. Renderers — options always visible and clickable
- **AR:** stems from `q.assertion/q.reason` → a/b columns only when they are NOT four option statements; options from labelled items → **a–d + healed e** columns → the five canonical A–E statements.
- **Case study:** options from labelled items → plain item list → **a–d (+ healed e)** → the Accept column's pipe list → True/False fallback. The passage panel is unchanged.
- **MCQ** renders the healed fifth option (`E`) too; **matching** merges the a–d right-side option pool (documented in the guide) into the dropdowns, deduped so the key mapping stays valid.

### 4. Authoring spec aligned (`cbt-prompts.html`)
The AR / multi-numeric Items spec now names the canonical keys (`{"assertion","reason"}`, `answer`/`tolerance`) while the runtime still accepts the legacy spellings — new papers are clean, old papers keep working.

## Why this can't regress
`analysis/phase12d_data_contract_test.js` (32 checks) feeds a probe CSV containing **all eight documented/shifted shapes** through the real `CSVBridge.parse` → the real student runtime → render → **click** → grade-key, and asserts the healed data state, the badge panel, the passage panel, option-card counts (including the healed E card), click recording, and absence of raw `[object Object]` leaks. Verified deterministic across 25 consecutive runs (exam shuffle order-independent, content-addressed assertions).

## Files changed
| Repo / file | Change |
|---|---|
| `student.html` | `_TYPE_CANON` + tolerant `getQType`; array-only `_safeItems` + `_itemsObjOf`; `normalizeQuestionPayload` v2 (routing, key spelling, AR stems, 5-option heal, tf normalise); `_renderAssertionReason` rebuilt; `_renderCaseStudy` option fallbacks; `_renderMCQ` E option; matching a–d pool merge; matrix `{row}` key |
| `assets/js/csv-bridge.js` | canon-form type aliases (`assertionreason`, `casestudy`, `truefalse`, `multiselect`, `multipartnumeric`, `imagemcq`, `evidencemcq`, `fillintheblank`, `longanswer`, `oralprompt`, `peerreview`, `fileupload`, `codeoutput`, `ar`, …) |
| `cbt-prompts.html` | AR / multi-numeric Items spec aligned to canonical keys |
| `sw.js` | cache bump `hmg-cbt-shell-v12-phase12d-v1` |
| Generator `templates/` | `student.html` (placeholder-preserving re-edit), `assets/js/csv-bridge.js`, `cbt-prompts.html`, `sw.js` synced |
| `analysis/` | **new** `phase12d_data_contract_test.js` + `phase12d_probe.csv`; `submit_integration_test.js`, `adaptive_test.js`, `multi_subject_test.js` extraction extended for `_TYPE_CANON`; `http_smoke_test.py` 12D checks (264 total) |

**No DB change. No workflow change. Papers already published heal at load — no re-publishing needed.**
