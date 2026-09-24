# PHASE 12E — Option Cards & Reference-Shape Parity (AR + Case Study, round 2)

**Date:** 2026-09-17 · **Scope:** student runtime (CSS + data shapes) · **Regression:** 26/26 node suites (exit-code verified) · smoke 272/272 · phase12c 50/50 · phase12d 32/32 · **new phase12e 26/26**

## How this round was diagnosed
Your five screenshots were read via OCR. They revealed **two different things**:

1. **The live site was still running the pre-12D `student.html`.** The AR screenshot shows the exact pre-12D crash signature (Assertion/Reason badge panel rendered, then nothing — no options): the old `_safeItems()` leaked the items JSON *object* through and the renderer died on `items.filter`. The 12D build already fixes that crash — but only if the new file is actually uploaded. The screenshots also show the 12C UI (Read Aloud, How to Answer, passage panel), which pins the deployed build to 12C.
2. **A real, still-unfixed bug: the option cards had no CSS at all.** The case-study screenshots show the options rendering as bare text lines — that is exactly what unstyled `div`s look like. Since Phase 12C, case-study / assertion–reason / image-MCQ / evidence-MCQ options render through `_renderLetterOptions`, which builds `.option-card` elements inside an `.options-grid` — **and neither class existed in the stylesheet**. No card border, no padding, no pointer cursor, no hover, and — critically — **the `.selected` class had no visual effect**, so students clicked and saw nothing happen. That is the "options are not well rendered so students cannot click" defect.

Both reference sites were studied from source (github.com/hmgconcepts/adewaleclassroom + gosaportal): their engines (`cbt-types.js`) render option cards as styled, tappable cards with letter badges and clear selected states — and their questions carry `q.options` arrays and `q.passage` directly on the question object. This phase brings the student runtime to that contract.

## What was fixed

### 1. The option-card CSS (the click bug) — `student.html`
`.options-grid` + `.option-card` + `.option-card.selected` + letter-badge + hover-lift + mobile styles, matching the School Connect / Adewale Classroom / GOSA card look. Cards are now visibly cards, the cursor is a pointer, and the chosen answer is highlighted (primary border + green tint + gradient letter badge).

### 2. Reference-family data shapes — `normalizeQuestionPayload` v3 + renderers
Papers authored on (or exported from) the sibling platforms carry:
- **`q.options`** — an array of option strings (or `{text|label|value}` objects; also accepted as a JSON or pipe-separated string). Parsed once at load; the a–e columns are backfilled so every renderer and grader path works.
- **`q.passage`** — read by the case-study renderer (already) alongside `items.passage`.
- **AR stems in `options[0]/options[1]`** — the Adewale Classroom contract; extracted to the Assertion/Reason panel, with the statements rendered as cards.
- **Literal `\n` / `\r` escapes** in question cells (visible in your screenshot as the two characters “\n” on screen) — normalised to a space for every question type. Real blank lines are preserved (they carry the case-study passage split).

### 3. Assertion–Reason renderer hardening
Stems resolve in priority order: normalised `q.assertion/q.reason` → the items JSON in either documented shape → the a/b columns (unless a–d carry four option statements) → `options[0]/[1]`. Options resolve: labelled items → a–d(+e) columns → the `q.options` array → the five canonical statements. When the stems are recovered from the question text itself ("Assertion: … Reason: …"), the question line is rewritten to a clean prompt so the stems are not shown twice.

### 4. The 5-option key wipe
At load, the answer-sanitiser for mcq/tf blanked any key outside A–D — which destroyed healed 5-option keys (E). The valid set is now A–E; garbage keys are still blanked.

### 5. Deployment-staleness marker
`student.html` now begins with `<!-- BUILD: hmg-cbt-student-v12-phase12e — … -->`. **Open the live student page → view source → if you cannot see that line near the top, the new files have not been uploaded.** The service worker cache also bumped (`hmg-cbt-shell-v12-phase12e-v1`) so browsers drop the old shell after deploy.

## Deployment checklist (important)
1. Upload the **contents of `cbt-system-PHASE12E.zip`** to your hosting, replacing the old files — especially `student.html` and `sw.js`.
2. Hard-refresh the student page (Ctrl+Shift+R) once, or let the service worker update on the second load.
3. Verify: view-source on the student page shows the `BUILD: hmg-cbt-student-v12-phase12e` line.
4. Open the same AR and case-study questions: AR shows the badge panel **plus five option cards**; case study shows the passage panel **plus styled, clickable option cards with a visible selected state**.
5. Already-published exams need no re-publishing — all healing happens in the student app at load.

## Why this can't regress
`analysis/phase12e_option_cards_test.js` (26 checks) replays **your exact paper** — reconstructed from the screenshots: multi-subject, four subject tabs, the literal-`\n` AR question with a/b stems and the items object, the passage-object case studies — through the real student runtime, asserting the badge panel, the card classes, the CSS rules themselves, click recording, the selected state, per-subject answer keys, the Adewale/School-Connect `q.options`/`q.passage` shapes, and the E-key survival. Plus the full regression: 26/26 suites, smoke 272/272, 12C 50/50, 12D 32/32.

## Files changed
| Repo / file | Change |
|---|---|
| `student.html` | option-card CSS; `normalizeQuestionPayload` v3 (literal-`\n`, `q.options`/`q.passage`, a–e backfill); AR stems/options hardening; case-study `q.options` chain; A–E key sanitiser; BUILD marker |
| `sw.js` | cache bump `hmg-cbt-shell-v12-phase12e-v1` |
| Generator `templates/` | `student.html` (identical edits, placeholders intact) + `sw.js` synced |
| `analysis/` | **new** `phase12e_option_cards_test.js`; smoke test 12E checks (272 total) |

**No DB change. No workflow change. Papers already published heal at load.**
