# PHASE 10 — ENTERPRISE FEATURE RESEARCH & ENHANCEMENT
### Deep Internet research → gap analysis → 10 new enterprise capabilities, all free and rule-based (no AI API)

---

## 0. How this phase was built (method — the expert diagnosis first)

Before writing a single line of code, the platform was benchmarked against the
wider CBT industry through structured Internet research across three fronts:

| Research front | Platforms studied | What they do that we didn't |
|---|---|---|
| Enterprise assessment | Questionmark, D2L Brightspace, Mercer Mettl, ExamSoft, TestGorilla, ClassMarker, Respondus | Psychometric item analysis (KR-20, discrimination, distractor quality), per-question time anomaly tracking, IP/device evidence, live proctoring consoles, weighted/aggregate scoring, appeals & rescoring workflows |
| Nigerian JAMB/UTME practice apps | ExamGuide, TestDriller, Awajis, MySchoolGist, Prepmate, SchoolHub | UTME /400 aggregate scoring, practice-by-difficulty behaviour, rich result analytics (speed + accuracy) |
| Engagement & accessibility | Quizizz/Wayground, Kahoot, Gimkit, TalentLMS; ETS, Cal Poly DRC, ISC²/Microsoft/Pearson VUE, ADA guidance | Adaptive difficulty, instant-feedback practice mode with points/streaks, hideable leaderboards, per-candidate extra-time accommodations (1.5×/2×) that are never flagged on reports |

**Every feature below passed a three-part filter before implementation:**
1. **Gap** — genuinely absent from our platform (checked against the full Phase 1–9 inventory).
2. **Free & rule-based** — no AI API, no paid service, no new account, no external dependency. Pure logic that runs in the browser or in Postgres we already run.
3. **Enhance-only** — nothing pre-existing was removed or reworked. Every feature degrades gracefully on an older database: the classic engine behaviour is the default.

**What we verified we ALREADY had (so we didn't duplicate it):** 20 question
types, multi-subject tabs, scientific calculator, maths keyboard, webcam Face
Gate + tab detection, shuffle, negative marking, MRQ all-or-nothing, most-missed
question analysis, certificates + QR verification, audit log, roles, keepalive,
licensing, PWA, wait room, attempt limits, **JAMB 8-key navigation (A/B/C/D,
N/P, R, S — already live in the student engine)**, question flagging/bookmarks,
offline backup of results, drafts.

---

## 1. The ten new features — detailed explanation of each

---

### FEATURE 1 — 🧠 Adaptive Difficulty Delivery
*(borrowed from Quizizz adaptive questioning and ALEKS/D2L adaptive engines)*

**What it is.** When enabled, the exam re-orders itself *live* around the
candidate's running performance: doing well → the next question is drawn from
the **hard** bucket; struggling → from the **easy** bucket.

**How it works (the exact rule).**
- Each question already carries a **Difficulty** tag in the bank (the `Difficulty` CSV column — supported since the CSV bridge was built; untagged questions count as *medium*).
- The engine keeps a running tally: `accuracy = correct-so-far / graded-so-far` over the auto-gradable questions answered.
  - accuracy ≥ 70% → target bucket **hard**
  - 30–69% → **medium**
  - < 30% → **easy**
- When the candidate moves forward, the best-bucket unused question is swapped
  into the next slot. **The paper never grows or shrinks** — everyone answers
  the same number of questions; only the ORDER adapts, so scores stay
  comparable across candidates.
- Delivery is **forward-only** (no Previous, no jump grid) exactly like real
  computerised-adaptive tests — going back would break the adaptation.

**Where to switch it on.** Teacher Hub → Create Exam (or Edit Exam) →
**Delivery & Scoring — Phase 10 Options** → *Adaptive difficulty*.

**Requirements & guard rails.** Single-subject paper, ≥ 5 questions, MCQ/TF/MRQ-style
gradable items drive the accuracy tally (essays etc. never distort it).
Multi-subject packages keep the classic order this phase (documented limitation).

---

### FEATURE 2 — ⚡ Instant-Feedback Practice Mode (with points & streaks)
*(borrowed from Quizizz Study mode, Kahoot, Gimkit)*

**What it is.** A second delivery mode for LOW-STAKES use: homework, drills,
revision. The moment a candidate locks an auto-gradable answer, they see
**✓ Correct!** or **✗ Not quite + the correct answer + your explanation**,
the options freeze, and a score chip counts **10 points per correct answer plus
a 5-point-per-step streak bonus** (3-in-a-row shows 🔥). The result screen ends
with a "🎮 Practice complete — X points · best streak 🔥 Y" banner.

**How it works.** After each answer the engine renders a verdict panel under the
options and disables further changes to that question. Grading at submit is
**unchanged** — the mode only changes what the candidate SEES. Non-gradable
types (essay, code…) behave normally and stay teacher-reviewed.

**Where.** Same Delivery & Scoring panel → **Feedback Mode = ⚡ Practice**.
(For real exams keep **🔒 Standard** — results only at the end.)

---

### FEATURE 3 — 📊 Psychometric Analytics Engine (ExamSoft-style)
*(borrowed from ExamSoft Enterprise Portal statistics, Questionmark, university item-analysis practice)*

**What it is.** An enterprise statistics pack computed **entirely in the
teacher's browser** from data the platform already stores — zero extra
database writes, zero cost.

**Exam-level statistics:**
- **N, mean, median, SD, min/max, pass rate**
- **KR-20** (Kuder–Richardson 20) — internal-consistency reliability for
  right/wrong items: `KR-20 = k/(k−1) · (1 − Σpᵢqᵢ/σ²)`.
  Interpretation bands (industry standard): ≥ 0.90 excellent (standardised
  testing) · 0.80–0.89 very good · 0.70–0.79 acceptable for classroom tests ·
  < 0.60 the test ranks candidates weakly.
- **SEM** (standard error of measurement) = `SD·√(1−KR-20)` — the ± band
  around an observed score.

**Per-question (item) statistics:**
- **Difficulty index p** — proportion correct. p > 0.80 too easy; p < 0.20 too hard.
- **Discrimination index D** — `p(upper 27%) − p(lower 27%)`. ≥ 0.20 acceptable;
  ≈ 0 weak item; negative = top performers miss it more (defect or mis-key).
- **Point-biserial correlation** between the item and the total score. ≥ 0.20 good.
- **Response spread** — how every option (A–D) was chosen, including blanks.
- **Distractor analysis** — a *functioning* distractor attracts ≥ 5% of
  candidates AND pulls weaker ones; a distractor that attracts TOP performers
  is flagged as a probable mis-key.
- **Mean answering time** per item.
- **Automatic flags:** `too-easy`, `too-hard`, `low-discrimination`,
  `negative-discrimination`, `weak-correlation`, `fast-answers`,
  `mostly-skipped`, `dead-distractors(n)`, `distractor-defect(BC)`.

**Where.** Teacher Hub → Results → **📊 Psychometric Report** → pick exam →
Generate. The module lives in `assets/js/psychometrics.js` — a dependency-free
pure-function library (unit-tested in Node with hand-computed fixtures:
52 assertions including textbook KR-20 examples).

---

### FEATURE 4 — ⏱ Per-Candidate Accommodations (extra time)
*(borrowed from ETS, Cal Poly DRC, ISC²/Microsoft/Pearson VUE accommodation practice)*

**What it is.** Every student on the roster can be granted **+25%, +50%
(1.5×, the most common real-world grant) or +100% (2×)** exam time, plus a
private teacher note ("DRC approved, term 1, documentation on file").

**How it works.** The accommodation lives on the roster row
(`students.extra_time_pct`). At exam start, `verify_student_for_exam` returns
it silently and the student engine multiplies the clock. Following the
accessibility norm (ETS/ADA — "accommodated scores are never flagged"), the
extension is applied **quietly**: it never appears on the result slip, the
leaderboard, or any report. The only thing the candidate sees is a one-line
confirmation toast on their own screen.

**Where.** Teacher Hub → Students → the **⏱** button on any roster row.
Applies to **registered-mode exams** (the candidate must be on the roster —
that's what makes an accommodation approvable in the first place).

---

### FEATURE 5 — UTME /400 Aggregate Scoring
*(borrowed from the JAMB/UTME scoring model: 4 subjects × 100 = 400)*

**What it is.** A second, JAMB-authentic headline score: each subject
contributes **its percentage × 1**, so a 4-subject combined paper totals
exactly **/400** like the real UTME; single-subject papers scale ×4.

**How it works.** Set **Score Model = UTME /400** on any exam (the
Multi-Subject Builder selects it by default). At submit, the aggregate is
computed from the per-subject percentages and shown as a big blue
**UTME-STYLE AGGREGATE — 312 / 400** banner on the result screen. The classic
percentage, pass/fail, grade ring and subject breakdown are untouched. The
aggregate is also stored in the result's `answers_data.__meta` for exports.

---

### FEATURE 6 — 👁 Live Invigilation Monitor
*(borrowed from ProctorExam/Honorlock-style live monitoring consoles)*

**What it is.** A live dashboard of everyone **currently sitting** an open
exam: candidate identity, live progress bar (answered/total), which question
and subject they're on, violation count, device fingerprint, and how long
since their last heartbeat.

**How it works.** The student engine sends one tiny RPC upsert every ~45 s
(and a final one marked *finished* at submit) into `live_sessions` — one row
per candidate per exam (`UNIQUE (exam_id, student_key)`, progress clamped
0–100). The teacher's monitor polls `list_live_sessions` every 15 s. A row
with no ping for 2+ minutes shows **⚠ Stale** — worth a hallway glance.
Sessions older than 3 hours drop off automatically.

**Safety by design.** The ping path is anonymous-RPC-only (the table itself is
`REVOKE`d from everyone — same pattern as the heartbeat table), writes are
rate-limited by design (one per 45 s per candidate ≈ 80 writes/hour for a
whole class — trivial on the free tier), and **a ping failure can never
disturb a candidate's exam** (all errors are swallowed silently).

**Where.** Teacher Hub → Results → **👁 Live Monitor** → choose an open exam.

---

### FEATURE 7 — 🧾 Result Appeals (script-review workflow)
*(borrowed from enterprise rescoring/appeals workflows)*

**What it is.** A candidate who believes a question was marked wrongly can
request a review **from their own result screen**; the teacher gets a queue and
resolves each request with a decision note.

**How it works.**
- Candidate side: result screen → "🧾 Not happy with a score? Request a script
  review" → reason (min 10 characters) → the `submit_appeal` RPC. Enforced in
  the DATABASE, not just the UI: requires a **released result** on an **open,
  non-archived exam**, and allows **one pending appeal per candidate per exam**.
- Teacher side: Results → **🧾 Appeals** — the queue (pending first) shows exam,
  candidate, reason, age. **✓ Grant** or **✗ Decline** with a note; the button
  badge shows the pending count. Use the existing Review Queue to actually
  re-mark the script — the appeal record is the governance trail.
- Table access: anonymous RPC for submission, ownership-checked RPCs for the
  teacher, direct table access revoked.

---

### FEATURE 8 — 🏆 Hideable Leaderboard (best attempt, percentiles, badges)
*(borrowed from Kahoot/Quizizz leaderboards — including Quizizz's "hide the leaderboard" option, because public ranking stresses some learners)*

**What it is.** A one-click ranked view of the currently filtered results:
each candidate's **best attempt** only, medals 🥇🥈🥉 for the top 3,
**percentiles**, and badges (**Distinction ≥ 90%, Merit ≥ 75%, Top 10%,
Finisher**). Tie-break on time — like a real competition.

**Design decision (accessibility).** The leaderboard is **teacher-only by
default and hideable with one click**. Project it deliberately (assembly,
 prize day) — never leave it up by default.

**Where.** Teacher Hub → Results → **🏆 Leaderboard** (respects every filter:
per exam, class, term…).

---

### FEATURE 9 — 🛡 Integrity Signals (fast-answer & device evidence)
*(borrowed from TestGorilla's per-question time tracking and IP/device consistency checks)*

**What it is.** Evidence-grade signals computed from data the engine already
records — presented as **leads to investigate, not verdicts**:

- **fast-answers** — half or more of a candidate's CORRECT answers were locked
  in under 2 seconds (needs ≥ 5 timed correct answers to fire).
- **very-fast-pace** — average under 3 s per question across the whole paper.
- **violations(n)** — the anti-cheat counter, surfaced in context.
- **device switching** — each attempt now carries a persistent device
  fingerprint; a candidate whose attempts come from several devices is listed
  (impersonation pattern — or shared school computers; that's why it's a lead).

**Where it comes from.** The engine has recorded per-question times since an
early phase; Phase 10 additionally stores `time_ms` and an `is_correct`
boolean per question plus a `__meta` block (device id, user agent, screen) in
every submission — all inside the existing `answers_data` JSONB, so **no
schema change was needed** and old results still analyse (times fall back to
the legacy `time_sec` field).

**Where.** Teacher Hub → Results → **🛡 Integrity Signals**.

---

### FEATURE 10 — 🎮 Gamified result extras + delivery metadata (the connective tissue)
*(the small print that makes the practice experience complete)*

- **Score chip** during practice exams (points + streak, animated pop on score).
- **Practice summary banner** on the result screen (points, best streak).
- **Delivery-mode status line** on the entry screen: "🧠 Adaptive difficulty ·
  ⚡ Practice (instant feedback) · UTME /400 scoring" — candidates know the
  paper type before they start.
- **`answers_data.__meta`** on every submission: score model, UTME aggregate,
  adaptive flag, feedback mode, game tally, device id, user agent, screen —
  the evidence backbone features 6 and 9 read.

---

## 2. What was deliberately NOT built (and why — the research said so)

| Candidate feature | Verdict | Reason |
|---|---|---|
| AI-powered proctoring / AI answer similarity | **Rejected** | Violates the no-AI-API cost rule. Rule-based signals deliver the evidence without a paid service. |
| Email/SMS bulk invites | **Rejected** | Needs a paid sender service. WhatsApp share + access sheets already cover distribution free. |
| Live screen-sharing proctoring | **Rejected** | Needs media servers (paid). Webcam snapshots + live monitor give equivalent evidence free. |
| Full CAT (item-level IRT ability estimation) | **Deferred** | Rule-based bucket adaptivity delivers 90% of the classroom value; IRT calibration needs item pools an order of magnitude larger than a school has. |
| Adaptive mode inside multi-subject packages | **Deferred** | Combining per-subject tabs with forward-only adaptive delivery needs its own UX pass; documented as the known limitation of this phase. |

---

## 3. DATABASE CHANGES (what changed in `complete-schema.sql`)

All changes are **additive** and **idempotent**, and follow the standing drift
rule (every `NOT NULL ADD COLUMN` in the 3.9 reconciliation carries a
`DEFAULT`):

**New columns**
- `exams.adaptive BOOLEAN NOT NULL DEFAULT false`
- `exams.feedback_mode TEXT NOT NULL DEFAULT 'end'` — `'end' | 'immediate'`
- `exams.score_model TEXT NOT NULL DEFAULT 'standard'` — `'standard' | 'utme400'`
- `students.extra_time_pct INTEGER NOT NULL DEFAULT 0` — 0/25/50/100
- `students.accommodation_note TEXT DEFAULT ''`

**New tables (both RPC-only — direct table access REVOKEd, like the heartbeat table)**
- `live_sessions` — one row per candidate per exam (`UNIQUE (exam_id, student_key)`): progress, answered/total, current subject/question, violations, finished, last_seen, device_id.
- `appeals` — exam, candidate, reason, status (`pending|granted|declined`), resolution note, timestamps.

**New RPCs (all in the Section-0 drop list for idempotent re-runs; all `SECURITY DEFINER` with pinned `search_path`)**
- `upsert_live_session(p_session JSONB)` → VOID — **anon** (student pings; upsert, clamped values, refuses to resurrect closed/archived exams).
- `list_live_sessions(p_exam_id UUID)` — **teacher**, ownership-checked, last-3-hours only.
- `submit_appeal(p_exam_id, p_student_name, p_student_class, p_attempt_number, p_reason)` → BOOLEAN — **anon** (requires released result; one pending per candidate).
- `list_appeals(p_exam_id UUID DEFAULT NULL)` — **teacher**, ownership-checked, pending first.
- `resolve_appeal(p_appeal_id, p_status, p_note)` → BOOLEAN — **teacher**, `granted|declined` only, pending only.

**Changed RPCs**
- `verify_student_for_exam` now also returns `extra_time_pct, accommodation_note` (silent accommodation delivery).
- `get_public_exam_by_code` now also returns `adaptive, feedback_mode, score_model` (the student engine reads them).

**New shared library**
- `assets/js/psychometrics.js` — the psychometrics + leaderboard + integrity engine (browser `window.Psychometrics` / Node `module.exports`, 52-assertion unit suite).

**Robustness repairs found during the audit (bonus fixes)**
- teacher.html's tutor-audit trail called `sbRpc()` which was **never defined** in that page — the audit log has been silently failing since it was written. `sbRpc` is now a proper global helper (and the tutor audit works).
- teacher.html had no local `escapeHtml` (app.js isn't loaded there) — added, and all injected roster/appeal names pass through it.

---

## 4. DEPLOYMENT PROCESS — clear, unambiguous, step-by-step

> **Who this is for:** a client deploying the Phase 10 package fresh, OR a
> client upgrading an existing Phase 1–9 deployment. Both paths are covered.

### STEP 0 — What you need before you start
1. The new `cbt-system-PHASE10.zip` (or a regenerated build from the Generator).
2. Your Supabase project (existing or new — free tier is fine).
3. Your hosting (Vercel/Netlify/GitHub Pages — free tier is fine).
4. 10 minutes. No paid accounts, no AI keys, no external services.

### STEP 1 — Deploy the files
1. Unzip `cbt-system-PHASE10.zip`. It preserves the platform's folder
   structure (`student.html` at root, `assets/js/…`, `database/…`).
2. Drag-and-drop the folder into Vercel/Netlify (or push it to the GitHub
   repo your site deploys from). **Nothing about hosting changed in Phase 10.**
3. Confirm `assets/js/psychometrics.js` uploaded (it's new — Teacher Hub loads
   it; the Psychometric Report button warns if it's missing).

### STEP 2 — Update the database (THE critical step)
1. Supabase Dashboard → your project → **SQL Editor**.
2. Open `database/complete-schema.sql` from the zip, copy **ALL** of it, paste
   into the editor, click **RUN**.
3. **Existing Phase 1–9 databases:** the file is fully idempotent and
   drift-safe — Section 3.9 adds the new columns with defaults, Section 0
   drops-and-recreates the changed RPCs, and every existing table keeps its
   data. You can re-run it as many times as you like.
4. **Verify** (optional but recommended) — run in the SQL editor:
   ```sql
   SELECT column_name FROM information_schema.columns
    WHERE table_name='exams' AND column_name IN ('adaptive','feedback_mode','score_model');
   SELECT column_name FROM information_schema.columns
    WHERE table_name='students' AND column_name IN ('extra_time_pct','accommodation_note');
   SELECT count(*) FROM pg_tables WHERE schemaname='public'
    AND tablename IN ('live_sessions','appeals');   -- expect 2
   ```
   All three queries must return the new columns/tables. If they don't, the
   SQL Editor almost certainly stopped at an earlier error — read the panel
   output; the most common cause is pasting only part of the file.

### STEP 3 — Smoke-test the new features in 5 minutes
1. **Psychometrics:** Teacher Hub → Results → 📊 Psychometric Report → pick an
   exam with submissions → Generate. You should see KR-20, SEM and the item
   table. (Old results from Phase 1–9 analyse fine — the engine reads the
   legacy `time_sec` field too.)
2. **Delivery options:** Create a throwaway exam → in **Delivery & Scoring**
   tick *Adaptive difficulty* and set *Feedback Mode = Practice* → publish →
   sit it as a student: the ⚡ verdicts + score chip appear; the entry screen
   says "🧠 Adaptive difficulty · ⚡ Practice".
3. **Accommodation:** Students → ⏱ on any student → +50% → sit a
   registered-mode exam as that student → the clock starts 1.5× longer, and
   the result slip shows nothing about it.
4. **Live monitor:** open 👁 Live Monitor on that exam while it runs → watch
   the progress bar move; submit → the row flips to ✓ Finished.
5. **Appeals:** from the student result screen → Request a script review →
   back in Teacher Hub → Results → 🧾 Appeals → Grant with a note.
6. **Leaderboard:** Results → filter to one exam → 🏆 Leaderboard → hide it
   again with one click.

### STEP 4 — Gradual rollout guidance (recommended)
- Phase 10 options are **all OFF by default**. Nothing changes for your
  existing exams until you switch a feature on for a specific paper.
- Sensible first moves: ⚡ Practice mode on a homework paper; 📊 Psychometric
  Report after your next major exam; ⏱ accommodations only where a
  documented need exists.
- Keep real exams on **Standard feedback** — instant feedback is for practice.

### STEP 5 — Free-tier impact (why this is all safe)
| Resource | Added load | Why it's fine |
|---|---|---|
| Database size | 2 small tables | `live_sessions` ≈ 1 row per candidate per exam; `appeals` grows only when candidates appeal. 3-hour window + archive vault keep them tiny. |
| Write volume | 1 upsert / 45 s / candidate | A 60-candidate sitting ≈ 4,800 tiny writes/hour — far below free-tier limits, and only while exams run. |
| Bandwidth | `psychometrics.js` (~11 KB gzipped) | Loaded by Teacher Hub only. |
| Compute | All statistics client-side | Nothing runs on servers. No AI API. |

### Generator clients (built from the cbt-generator-package)
Regenerate the client ZIP from the Generator as usual — the Phase 10 files
(`assets/js/psychometrics.js`, updated `student.html`, `teacher.html`,
`cbt-multi.html`, chatbot/help, and the schema) are in the template manifest,
and all credential fields remain EMPTY for the client's own Supabase details.
Then follow STEPS 1–5 above with the generated ZIP.

---

## 5. Test evidence for this phase

| Suite | Result |
|---|---|
| `psychometrics_test.js` (NEW — hand-computed KR-20/D/rpb/distractor/leaderboard/integrity fixtures) | **52/52** |
| `adaptive_test.js` (NEW — buckets, swap-in, grading, instant feedback, accommodation math) | **35/35** |
| `teacher_p10_test.js` (NEW — controls, payloads, lean fallback, accommodations, toolkit wiring, sbRpc repair) | **44/44** |
| `submit_integration_test.js` (extended — `__meta`, `is_correct`/`time_ms`, final live ping, UTME) | **PASS** |
| `schema_static_test.py` (extended — 22 new Phase 10 assertions incl. drift rule) | **60/60 checks** |
| `schema_pg_verify.sh` (extended — real-Postgres Phase 10 round-trip: upsert/update-clamp, owner/non-owner visibility, appeal lifecycle, REVOKE checks) | **ALL PASS** |
| `http_smoke_test.py` (extended — 25 new served-content checks) | **159/159** |
| Full regression: assistant_bot 155, license 19, multi-subject CSV 32, csv-bridge 57, calc 75, guard matrix, prompt-studio 452, sample-bank E2E, teacher-fix 41, phase2 audit 657 | **ALL GREEN** |

---

## 6. Feature-to-source map (for maintainers)

| Feature | Files |
|---|---|
| Adaptive delivery | `student.html` (`_adaptiveBucketOf/_adaptiveTargetBucket/_adaptiveSwapNextIn/_adaptiveGradeCurrent`, next()/prev()/renderQNav gating) |
| Instant feedback | `student.html` (`_ifVerdictFor/_ifReveal/_ifRenderChip`, `.if-verdict` styles) |
| Psychometrics | `assets/js/psychometrics.js`, `teacher.html` (report modal + include) |
| Accommodations | `database/complete-schema.sql` (columns + `verify_student_for_exam`), `teacher.html` (roster ⏱ + modal), `student.html` (clock extension) |
| UTME /400 | `student.html` (aggregate + result banner), `cbt-multi.html` (default score model), `teacher.html` (option) |
| Live monitor | `database/complete-schema.sql` (`live_sessions` + 2 RPCs), `student.html` (ping loop), `teacher.html` (monitor modal) |
| Appeals | `database/complete-schema.sql` (`appeals` + 3 RPCs), `student.html` (modal + submit), `teacher.html` (queue + badge) |
| Leaderboard | `assets/js/psychometrics.js` (`leaderboard`), `teacher.html` (toggle + panel) |
| Integrity signals | `assets/js/psychometrics.js` (`integritySignals`), `student.html` (`__meta`, `time_ms`, `is_correct`), `teacher.html` (modal) |
| Help layer | `assets/js/chatbot.js` (11 new KB entries + quick questions), `assets/js/site-help.js` (teacher/student/multi guides) |

*End of Phase 10 document.*
