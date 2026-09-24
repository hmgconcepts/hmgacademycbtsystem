# PHASE 10B — Exam Reachability Hotfix
### Live incident: new CBT links show "Exam not found or not open" while old links work
**Date:** 2026-09-16 · **Status:** FIXED (product) + RUNBOOK (live database) · **Risk:** No features removed — behaviour only made safer and more explicit.

---

## 1. The incident

On the live deployment (`hmgacademycbtsystem.vercel.app`), every **newly created** exam link/code (e.g. `student.html?code=5FPSX8`, `?code=J19EST`) showed students the dead-end message:

> *"Exam not found or not open. Check your exam code or ask your teacher to resend/re-open the link/code. Try another code"*

…while **pre-existing exams kept working** end-to-end (entry, sitting, submission).

## 2. Root cause — a chain, not a single fault

Diagnosis was performed directly against the live deployment and its Supabase database (read-only probes):

| # | Finding | Evidence (live probes, 2026-09-16) |
|---|---------|-------------------------------------|
| 1 | **The deployed site is newer than the database.** The live site runs the Phase 10 front-end, but the database's RPC layer predates Phase 8: `check_exam_code_status` (the Phase 8 student status probe) is **missing**, and the Phase 10 exam columns (`adaptive`, `feedback_mode`, `score_model`) **do not exist**. | RPC probe `{"p_code":"…"}` → PGRST202; column probe `?select=adaptive` → 42703. Core RPCs (`submit_student_result`, `verify_student_for_exam`, `get_public_exam_by_code`, `get_exam_attempt_count`) are all present and working. |
| 2 | **The two new exams are not publicly enterable** — `get_public_exam_by_code` returns an empty set for both codes (they exist as rows but are locked/closed from the public's perspective). | Live RPC call returned `[]` for `5FPSX8` and `J19EST`. |
| 3 | **Product defect (silent lock trap):** after publishing an exam, the create-exam form reset **"Open Exam Immediately?" back to "No — keep locked"**. A teacher publishing several exams in one session got exams 2, 3, … **locked by default**, contradicting the Phase 8 "open by default (recommended)" design. | `teacher.html` post-publish reset: `_on.value='false'` (now fixed). |
| 4 | **Product defect (dead-end student UX):** when the status-probe RPC is missing, the student page cannot tell "locked" apart from "wrong code" — so it fell back to the generic, unhelpful message instead of telling the student the exam is probably locked and the teacher must open it. | `student.html` `checkExamCodeStatus()` swallowed the RPC error and returned `null`, which the UI read as "not found". |
| 5 | **Product defect (silent downgrade):** when saving an exam on a stale database, the teacher only saw a **3.5-second toast** that the newest columns were dropped — easy to miss, no persistence. | `saveExamPayloadWithFallback` lean path (toast only, now escalated). |

**Why old exams work:** they were created as OPEN rows earlier (fresh sessions / earlier sessions of the page) — the public RPC happily returns them, and all core RPCs they need exist.

**Why new exams fail:** they sit locked (defect 3 or a deliberately-locked publish), and with the probe RPC missing (defect 1 + 4) students get no explanation — plus their anti-cheat/certificate/Phase 10 settings were silently dropped at creation time (defect 5).

## 3. What was fixed (this package)

### 3.1 `teacher.html` — post-publish reset restores the recommended default
The form reset after publishing now returns **"Open Exam Immediately?" → "Yes (recommended)"**, so the next exam created in the same session is OPEN, matching the Phase 8 design. Teachers can still deliberately choose "keep locked" — and are warned at publish time, share time, and on the printed access sheet (all unchanged).

### 3.2 `teacher.html` — schema currency guard + persistent banner
- On login the Teacher Hub runs **`checkSchemaCurrency()`**: two canaries — the `check_exam_code_status` RPC and the `exams.adaptive` column.
- If **either** is missing (or a save ever downgrades via the lean fallback), a **persistent red banner** is pinned to the top of the Teacher Hub:

  > ⚠️ **Platform database is out of date — some features are being silently skipped**
  > Until it is updated: students see a dead-end "Exam not found or not open" error for new exams instead of a clear reason, and anti-cheat, certificate, math-keyboard, adaptive/practice mode and UTME /400 settings are not saved on new exams.
  > **How to fix (2 minutes, safe to re-run):** Supabase dashboard → SQL Editor → paste the **entire** `database/complete-schema.sql` → Run → refresh this page.

  Buttons: **Re-check now** (re-runs both canaries, clears the banner when healthy) and **Hide for now** (dismisses for the current browser session only — it comes back next session until fixed). A lean-fallback save also *un-dismisses* the banner immediately.
- The lean-fallback toast was upgraded from vague to explicit: *"Saved WITHOUT anti-cheat / certificate / Phase 10 options — your database is out of date. See the red banner at the top."*

### 3.3 `student.html` — actionable fallback instead of a dead end
`checkExamCodeStatus()` now returns a distinguishable `undefined` when the RPC itself is unavailable (schema stale) vs `null` when the probe ran and the exam genuinely doesn't exist. When the probe is unavailable, students now see:

> **We could not load this exam. This usually happens for one of two reasons:**
> 1. The exam is still **LOCKED** — ask your teacher to open it, then **refresh this page**. Teachers open exams under **Teacher Hub → Assessments → 🟢 Open**.
> 2. The code or link is wrong — ask your teacher to resend the correct link or code.
>
> If neither fixes it, show your teacher this message: *"the platform database needs its one-time update — run database/complete-schema.sql in the Supabase SQL Editor"*.

The existing messages (locked / not-started / closed / genuine not-found) are unchanged.

### 3.4 `deployment_validator.html` — live database schema probe
A new check, **"Database schema up to date (live probe)"**, reads the Supabase config from the deployed `teacher.html` and probes the real database for the status RPC and the Phase 10 columns. A red ❌ is the exact condition behind this incident, with the 2-minute fix spelled out. This turns the incident class into a **pre-flight check**: run the validator after every deploy/update.

### 3.5 `assets/js/chatbot.js` + `assets/js/site-help.js` — knowledge base
- The offline assistant's "exam not found / locked" answer now covers **cause #2: database behind the site (NEW links fail, OLD ones still work)** with the signature, the fix, and the validator probe. New keywords: `new exam not working`, `new link not working`, `old exams work`.
- The site guide documents the red banner and adds the standing tip: **update the DATABASE whenever you update the FILES** (one idempotent SQL run per package update).

### 3.6 `sw.js`
Cache bumped to `'hmg-cbt-shell-v10-phase10-v8'` so every visitor's browser picks up the fixed teacher/student/validator/chatbot/help files on next load.

## 4. RUNBOOK — fix the live site (do once, ~3 minutes)

The product fixes above prevent recurrence; these steps repair the **live database and the two affected exams today**:

1. **Update the database (2 minutes, safe to re-run, keeps all data):**
   - Open your **Supabase dashboard → SQL Editor**.
   - Paste the **entire** `database/complete-schema.sql` from this package (it is idempotent and drift-hardened — it heals a partially-updated database exactly like this one).
   - Click **Run**. You should see `SUCCESS` status messages (the script self-verifies).
2. **Open the two locked exams:**
   - Log into the **Teacher Hub** → **Assessments**.
   - Find the exams with codes **5FPSX8** and **J19EST** (they show a 🔴 Locked badge) → click **🟢 Open** on each row.
3. **Re-check the affected exams' settings (one-time):** because they were created while the database was stale, their anti-cheat / certificate / math-keyboard / adaptive / UTME /400 options were not saved. Open each one with **✏️ Edit**, re-apply the intended options, and save (saving now works fully).
4. **Verify:** open `deployment_validator.html` on the site — the **"Database schema up to date (live probe)"** row must be ✅ — then open a student link/code in a fresh tab (or incognito). Locked exams now tell students they're locked; opened exams let them in.
5. **Redeploy this package** (Vercel) so the fixed teacher/student/validator files and the new service-worker cache go live.

## 5. Verification performed

- `node --check` on all edited inline scripts and JS assets — clean.
- New behavioural regression suite `analysis/hotfix_reachability_test.js` — **47/47 passed**: the real reset block restores the open default on a mock DOM; the real canary detects missing-RPC, missing-column and healthy databases correctly (banner raised only when stale); the real student probe resolves `undefined` (RPC missing) vs `null` (not found) vs the status row; validator/chatbot/site-help markers asserted.
- Full regression suite re-run (smoke + all suites) — see §6.

## 6. Files changed

| File | Change |
|------|--------|
| `teacher.html` | Post-publish reset → open default; `SCHEMA_STALE` flag; `checkSchemaCurrency()` canary wired into login flow; persistent `showSchemaBanner()`; lean-fallback escalation + explicit toast |
| `student.html` | `checkExamCodeStatus()` distinguishes RPC-missing (`undefined`); actionable checklist message for that case |
| `deployment_validator.html` | Live database schema probe (RPC + column) with exact remediation |
| `assets/js/chatbot.js` | KB: database-behind-site cause, fix, validator pointer, new keywords |
| `assets/js/site-help.js` | Teacher guide: red banner section, validator probe section, update-database tip |
| `sw.js` | `CACHE_NAME` → `hmg-cbt-shell-v10-phase10-v8` |
| `analysis/hotfix_reachability_test.js` | New regression suite (47 checks) |

**Standing rule going forward:** whenever the site files are updated, run `database/complete-schema.sql` once against the live database, and confirm with `deployment_validator.html` before sharing new exam links.
