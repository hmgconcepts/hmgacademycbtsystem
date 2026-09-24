# PHASE 12C — GOSA / School Connect Presentation Parity
### Assertion–Reason & Case Study rendered right · unmistakable hot-text selection · 🔊 Read Aloud · ❓ How to Answer
**Date:** 2026-09-16 · **Trigger:** live report — Assertion–Reason and Case Study still not well rendered at the student end; chosen hot-text options indistinguishable; School Connect / GOSA-portal features (Read Aloud, "How to answer", …) missing.

---

## 1. What was actually broken (verified against the running code)

| Symptom | Root cause | Fix |
|---|---|---|
| **Assertion–Reason badly rendered** | On CSV papers the stems (Assertion / Reason) live in the **a/b columns**. The option builder's fallback also read `q.a`/`q.b` — so the assertion and reason appeared **again as "options" A and B**, with no real A–E statements to pick. | Dedicated renderer: the stems display in a **tagged badge panel** (`Assertion` blue / `Reason` purple — GOSA `arBlock` parity), and the options are the **five canonical A–E statements** (or explicit labelled items when the bank provides them) — **never** the a/b columns. |
| **Case Study badly rendered** | The CSV bridge prefixes the passage into the question text — students saw one giant blob in the question line, and the passage could also be sourced from the answer-accept column. | The passage renders in its own **scrollable passage panel with a "read this first" title** ABOVE the options (GOSA parity); passages prefixed into the question text are **split back out**, so the question line shows only the actual question. Options come from explicit items or the a–d columns. |
| **Chosen hot-text options indistinguishable** | Chips used the generic `btn-primary` vs `btn-outline` pair — too subtle. | Dedicated **pill chips** (GOSA `scq-chip` parity): selected = **gradient fill + white bold text + glow + ✓ + aria-pressed**; unselected = calm outline. Tap toggles; the hint now says *"Tap every part that is correct — tap again to unselect."* |
| **Read Aloud "missing"** | The button shipped with `class="hidden"` and **nothing in the codebase ever un-hid it** — the feature existed but was invisible for the entire exam. It also only read MCQ/MRQ/TF questions. | Button now appears the moment the exam starts. Fully rewritten, per-type reader (below). |

## 2. Ported from School Connect / GOSA Portal (studied from the live `gosaportal` source)

| GOSA / School Connect feature | Now in the CBT system |
|---|---|
| 🔊 **Read Aloud** (V10.8) — candidate-initiated, per-question, question + options only, never the answer key; cancels on question change / submit / tab blur; free device voices | ✅ **Alt+R read · Alt+S stop**; reads every type naturally: Assertion–Reason reads *Assertion: … Reason: … Option A: …*; Case Study reads *Passage. … Question. … Option A: …*; matching reads the left items; ordering/categorization read their items; hot text reads the tappable parts; multi-part numeric reads part labels + units. `aria-pressed` on the button; auto-stop on visibility change and on submit. |
| ❓ **How to answer** legend (V10.3) — every question style explained in plain language; reading it costs no exam time | ✅ Button beside Flag → overlay legend with **all 17 styles** (multiple choice → code), plus a footer pointing to flags, jump-to-unanswered and Alt+R. |
| 💡 **HOWTO tip** above every structured question (`scq-howto`) | ✅ Plain-language tip above every structured question (matching, ordering, cloze, categorization, matrix, hot text, multi-part numeric, assertion–reason, case study, essay, code, image, range). MCQ/True-False stay clean. |
| **arBlock** — Assertion/Reason as tagged badge rows | ✅ (see table above) |
| **scq-chip / is-on** — unmistakable selection state | ✅ (see table above) |
| **Essay live word count** vs the minimum | ✅ *"23 words · at least 20 expected"* updates as the candidate types. |

## 3. What changed

| File | Change |
|---|---|
| `student.html` | AR + Case Study renderers rebuilt (badge panel / passage panel / option sourcing fixed); hot-text chips; 💡 tips; legend overlay; Read Aloud rewritten (per-type speech, shortcuts, cancel rules, aria); buttons un-hidden at exam start; essay word count; CSS additions |
| `assets/js/site-help.js` | Student-portal guide: new "🔊 Read Aloud & ❓ How to Answer" section; Exam Screen section updated |
| `assets/js/chatbot.js` | New KB entry (read aloud / how to answer / legend keywords) |
| `sw.js` | cache → `hmg-cbt-shell-v12-phase12c-v1` |
| Generator templates | `student.html`, `sw.js`, `site-help.js`, `chatbot.js` re-synced tokenised (markers intact) |

## 4. Verification

- **NEW `phase12c_gosa_parity_test.js` — 50/50.** Runtime E2E on the real script: AR renders the badge panel + exactly A–E canonical statements with the stems **excluded** from options; Case Study shows the passage panel and strips the passage from the question line; hot-text chips toggle selected/✓/aria-pressed and clear cleanly; tips appear per type; the legend opens with 17 rows; Read Aloud is visible, reads AR/case-study/hot-text/MCQ correctly, never speaks the answer key, and Alt+R/S + cancel rules are wired; essay word count renders; multi-subject regression intact.
- `phase12b_multi_subject_ux_test.js` — **54/54** (no regressions from 12B).
- Full suite: **all 26 suites + schema static GREEN** (workflow_audit 617, phase12 integrity 60, assistant bot 155, prompt studio 452, …). HTTP smoke extended → **254/254**.

## 5. Deployment note

Deploy `student.html`, `sw.js`, `site-help.js`, `chatbot.js` (master and any client build regenerated from the generator). **No database change.** Already-published papers render correctly — the fixes are at render time on the student side, and Assertion–Reason papers authored with stems in the a/b columns now display properly without any re-publishing.
