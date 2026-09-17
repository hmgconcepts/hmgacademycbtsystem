# PHASE 12F — Read Aloud Engine (School Connect / GOSA / Adewale Classroom parity)

**Date:** 2026-09-17 · **Scope:** student runtime (speech engine), chatbot/site-help docs · **Regression:** 27/27 node suites (exit-code verified) · smoke 285/285 · **new phase12f suite 43/43** · 12C suite re-verified 50/50 against the new engine

## What was audited
Every page and file that touches speech (`student.html`, `assets/js/chatbot.js`, `assets/js/site-help.js`, generator template copies) was compared against the reference engines — `cbt-speech.js` from both the GOSA portal (School Connect V10.8) and Adewale Classroom (V39), studied from their public source repos. The audit found **two live bugs and thirteen robustness/parity gaps**.

## Live bugs found (and fixed)

1. **The Alt+R / Alt+S keyboard shortcuts were dead code.** They were nested inside `if(['A','B','C','D'].includes(key))` in `handleKeydown` — R and S are not in A–D, so the shortcuts could never fire, ever. They now run at the very top of the handler: they work on any screen state (even while typing an answer — Alt-combos are never plain answer keys), and they never fire when Ctrl/Meta is held, because AltGr (used for typing accented characters on European layouts) reports as Ctrl+Alt and must not be hijacked.
2. **The speech script dropped `q.passage`.** When a case-study question's items JSON was an empty object, the passage ternary took the meta branch and never fell through to `q.passage` — the sibling-platform shape read no passage aloud. Speech now mirrors the renderer's fallback exactly.

## Robustness gaps closed (ported from the reference engines)

| Gap | Fix |
|---|---|
| One giant utterance — engines stall/truncate long case-study passages | **Chunked queue**: sentence-aware ~180-char chunks (splitter avoids lookbehind — Safari < 16.4 throws a *parse-time* error on `(?<=…)`, which would kill the whole script); `onend` **and** `onerror** both advance the queue, so one bad chunk never hangs the read |
| Chrome leaves `speechSynthesis` PAUSED after a cancel → read-aloud dies after first stop | every `speak()` passes through `resume()` first (no-op when not paused) |
| No voice selection — wrong default voice, no per-language choice | async voice list + `voiceschanged` refresh; saved per-language choice → BCP-47 prefix match → named-voice match (`/yoruba/i`…) → African English (en-NG/GH/KE/ZA) → any English; offline voices preferred so weak connections never stall mid-exam |
| Nigerian papers garbled or skipped | **21-language detection** — Yorùbá/Igbo/Hausa orthographic fingerprints + function words, world scripts deterministic (Arabic, Chinese, Japanese, Korean, Cyrillic, Devanagari, Hebrew, Thai, Greek, Bengali, Tamil, + Latin-language scoring for French/Spanish/Portuguese/German/Italian/Swahili); per-chunk `utterance.lang` tagging |
| No native voice → tone-marked text skipped | **phonetic fallback**: ẹ→e, ṣ→sh, ị→i, ɓ→b…, tones stripped (NFD), rate ×0.85 for clarity, plus a one-time tip toast. Includes a fix to the reference's own latent bug: substitutions now run *before* the tone-strip, so `ṣ→sh` actually fires |
| No settings, no persistence | **⚙ settings panel** beside the button: language (auto + 21), voice (with offline markers), speed slider, per-language test-voice samples; prefs persisted in `localStorage` (private-mode safe) |
| Screen readers blind to the speech | hidden **aria-live region** mirrors the current sentence; `aria-pressed` lifecycle fully synced (the old question-change cancel forgot to reset it) |
| Audio could outlive the page | stop on `visibilitychange` **+ `pagehide` + `beforeunload`** (new), question change, and submit |
| Toggle relied on `speechSynthesis.speaking` (engine quirks desync it) | the engine keeps its own speaking flag — the button never lies |
| Math read as backslash commands | **math-to-speech**: `\frac{3x+6}{9}` → "the fraction 3x plus 6, over 9", `^2` → "squared", `√` → "square root", symbols spoken |
| Matching questions read only the left side | the right-side option pool (pairs + distractors + a–d) is read too |
| Speech lagged the 12E renderer shapes | AR stems resolve identically to the renderer (normalised → items → `options[0]/[1]` → a/b); case-study options from labelled items → `q.options` → a–e; MCQ reads the healed E option; TF reads "Option A. True. Option B. False." |
| Unsupported browsers got a generic toast | `available()` checks both `speechSynthesis` **and** `SpeechSynthesisUtterance`; the button renders a muted 🔇 state with guidance |
| Docs promised less than the engine does | chatbot + site-help entries updated (both repos) to describe chunking, languages, ⚙ settings, Alt+S |

## Exam integrity (unchanged, now enforced harder)
Candidate-initiated only — nothing autoplays. The utterances are built from question + passage + options only; **the answer key is never queued during a live exam**. Audio is cancelled on question change, submit, tab hide, pagehide and beforeunload.

## Why this can't regress
`analysis/phase12f_read_aloud_test.js` (43 checks) drives the real student runtime with a recording speech shim: chunk counts and bounds, queue drain on `onend`, advance on `onerror`, `resume()` call count, cancel count, aria-pressed lifecycle at every transition, aria-live set/clear, all six language detections, three voice-selection scenarios, phonetic fallback output + slowed rate, prefs round-trip, per-type scripts (including the Adewale AR shape, `q.options` case studies, math, matching pool, TF), question-change/submit/pagehide/beforeunload/visibility stops, Alt+R start / Alt+S stop / AltGr+R non-hijack, and the unsupported-browser fallback. The 12C parity suite was upgraded to drain the chunked queue and assert against the full spoken script (50/50).

## Files changed
| Repo / file | Change |
|---|---|
| `student.html` | the `_SP` engine (queue, voices, languages, phonetics, prefs, settings UI, lifecycles); `_speechPlain` math-to-speech; `_speechTextForQuestion` renderer-parity upgrade; Alt+R/S revived + AltGr-safe; showQ cancel via the engine; settings CSS; BUILD marker `v12-phase12f` |
| `assets/js/chatbot.js`, `assets/js/site-help.js` | feature docs updated to the new engine (both repos) |
| `sw.js` | cache bump `hmg-cbt-shell-v12-phase12f-v1` |
| Generator `templates/` | `student.html` (engine + all fixes, placeholders intact), `sw.js`, `chatbot.js`, `site-help.js` synced |
| `analysis/` | **new** `phase12f_read_aloud_test.js`; `phase12c_gosa_parity_test.js` upgraded for the chunked engine; smoke 12F checks (285 total) |

**No DB change. No workflow change. Already-published exams get the new reader automatically at load.**
