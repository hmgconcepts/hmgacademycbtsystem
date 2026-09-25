/* ====================================================================
   chatbot.js — HMG CBT Pro v5.0 Rule-Based Interactive Assistant
   ====================================================================
   100% Offline, Zero AI API, Free-Tier Rule-Based Knowledge Assistant.

   v5.0 — PAGE-AWARE & ALL-INCLUSIVE:
   • Knows which page you are on (all 20 pages) and explains THAT page
     on demand: purpose, who it is for, every section, and its tips —
     powered by the same page guides the 📘 Help Center renders
     (site-help.js), so the bot and the Help Center never disagree.
   • 55+ intents covering EVERY page and feature: exams, CSV
     compatibility, multi-subject UTME papers with subject tabs, the
     scientific calculator, maths keyboard, manual review, disaster
     recovery, Drive sync, free-tier protection, subscription licensing
     (warning → grace → renewal), client monitoring, open/locked exam
     states, certificates, audit, storage, settings, roles, the
     generator, accessibility, PWA install… plus quick-question chips
     that adapt to the current page.
   • Matching: small-talk → page-guide triggers → keyword intents →
     current-page section search → guided fallback. A minimum score
     threshold stops weak false positives; longer keyword hits always
     outrank short ones.
   ==================================================================== */
const CBTChatbot = {
  isOpen: false,
  messages: [],

  /* ────────────────────────────────────────────────────────────────
     PAGE AWARENESS — single source of truth is SiteHelp.pages
     (site-help.js is loaded on every page alongside this file).
     FALLBACK_GUIDES keeps the bot useful if SiteHelp ever fails.
     ──────────────────────────────────────────────────────────────── */
  pageId() {
    let p = (window.location.pathname.split('/').pop() || 'index.html').split(/[?#]/)[0];
    if (p && !/\.[a-z0-9]+$/i.test(p)) p += '.html'; /* 12K: clean-URL hosts serve /storage for storage.html */
    return p || 'index.html';
  },

  FALLBACK_GUIDES: {
    'index.html':      { title: '🏠 Home — Portal Launcher', who: 'Everyone', summary: 'The front door: launch the Candidate / Teacher / Admin portals, install the app, verify a certificate.' },
    'student.html':    { title: '📝 Candidate Exam Portal', who: 'Candidates', summary: 'Where exams happen: code entry, identity gate, fullscreen timer, calculator, maths keyboard, results.' },
    'teacher.html':    { title: '👨‍🏫 Teacher Hub', who: 'Teachers / exam officers', summary: 'Build exams (CSV, manual, XLSX/PDF, reuse), share codes, watch submissions, audit essays, analyse.' },
    'cbt-multi.html':  { title: '🧪 Multi-Subject Builder', who: 'Teachers preparing UTME/JAMB papers', summary: 'Bundle several subjects into ONE exam code with subject tabs. Fast lane: paste one combined CSV — it splits by the Section column.' },
    'cbt-prompts.html':{ title: '🤖 AI Prompts Studio', who: 'Teachers wanting AI-written banks', summary: '24 prompt packs you copy into any free AI chat; it returns a downloadable CSV that imports straight in.' },
    'question-types.html': { title: '📖 Question Types Guide', who: 'Everyone', summary: 'The full reference for all 20 question types with copy-paste CSV examples.' },
    'admin.html':      { title: '🛡️ Admin Console', who: 'Admins / owner', summary: 'Platform governance: stats, approvals, sign-in and the admin workspace.' },
    'admin-data.html': { title: '💾 Data & Sync', who: 'Admins', summary: 'Backup envelopes, Google Drive sync, imports/exports.' },
    
    'disaster-recovery.html': { title: '🚨 Recovery', who: 'Admins', summary: '7-step console that rebuilds the whole platform on a fresh Supabase project from Drive/envelope backups.' },
    'storage.html':    { title: '📦 Storage Manager', who: 'Admins', summary: 'Table sizes vs the 500 MB cap, efficiency advisor, Archive Vault (safe purge with verified snapshot).' },
    'platform-health.html': { title: '🩺 Platform Health', who: 'Admins', summary: 'Latency probe, RPC smoke tests, heartbeat evidence, A–F security posture grade.' },
    'status-manager.html': { title: '👥 Roles & Status', who: 'Admins', summary: 'Approval queue, roles, bulk activate/suspend, account drill-downs.' },
    'settings.html':   { title: '⚙️ Settings', who: 'Admins', summary: 'Branding, assessment defaults, accessibility, security, module matrix, signature, Drive config.' },
    
    'activity_log.html': { title: '📊 Audit & Activity', who: 'Admins', summary: 'Every privileged action, filters, stats, chart, CSV export, retention purge.' },
    'certificate.html': { title: '🏅 Verify Certificate', who: 'Anyone — no login', summary: 'Verify a result certificate by code or QR.' },
    'link_checker.html': { title: '🔗 Link Checker', who: 'Admins', summary: 'Crawls the deployment and reports broken links/assets.' },
    'feature_guide.html': { title: '🗺️ Feature Guide', who: 'Everyone', summary: 'The narrated tour of every feature and where to find it.' },
    'offline.html':    { title: '📴 Offline Fallback', who: 'Everyone (auto)', summary: 'Shown when the network is gone — cached shell with retry.' },
    'deployment_validator.html': { title: '✅ Deployment Validator', who: 'Admins', summary: 'Post-deploy checklist: every file present, schema applied, headers, PWA.' }
  },

  pageGuide() {
    const id = this.pageId();
    const sh = window.SiteHelp && window.SiteHelp.pages && window.SiteHelp.pages[id];
    if (sh) return sh;
    return this.FALLBACK_GUIDES[id] || { title: this.FALLBACK_GUIDES['index.html'].title, who: 'Everyone', summary: 'Ask me about any page or feature.', sections: [], tips: [] };
  },

  pageGuideText(g) {
    g = g || this.pageGuide();
    let out = '**' + (g.title || 'This page') + '**\n' + (g.summary || '') + '\n\n**Who it is for:** ' + (g.who || 'everyone') + '\n';
    if (g.sections && g.sections.length) {
      out += '\n**What is on this page:**\n';
      g.sections.forEach((s, i) => { out += (i + 1) + '. **' + s.name + '** — ' + s.desc + '\n'; });
    }
    if (g.tips && g.tips.length) {
      out += '\n**Tips:**\n' + g.tips.map(t => '• ' + t).join('\n');
    }
    out += '\n\nWant more? Tap **📘 Help Center** in the page guide banner at the top, or ask me about any section by name.';
    return out;
  },

  kb: [
    /* ── EXAM CREATION ── */
    { keywords: ['create exam', 'make exam', 'new exam', 'create assessment', 'build exam'], reply: '**To create an assessment (Teacher Hub):**\n1. Choose an input method — **CSV Upload**, **Type Questions** (all 20 types with live previews), **XLSX/PDF**, or **Reuse a previous exam**\n2. Fill the settings: duration, attempts, passmark, negative marking, result release, anti-cheat switches\n3. **Publish** → you get a 6-character code + a WhatsApp-ready share message\n\nNew exams **open immediately on publish** — students can enter right away. (Choose "No — keep locked" in the form only when you deliberately want to pre-load ahead; the system then warns you at publish time AND at share time.)\n\nTip: CSVs from **School Connect / GOSA Portal import unchanged** — the format is auto-detected.' },
    { keywords: ['csv format', 'csv columns', 'question template', 'download template', 'csv order'], reply: '**CSV formats this platform understands (auto-detected):**\n\n1️⃣ **HMG 17-column:** `Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,Accept,MRQ_AON,Pairs,Items,Difficulty,Tags,Section` — columns 8–17 optional\n2️⃣ **School Connect / GOSA:** `question,type,a,b,c,d,answer,explanation,mark,difficulty,topic,tolerance,section` — any column order works\n3️⃣ **Headerless:** 14+ columns = HMG layout; fewer = School Connect layout\n\nDownload the template from Teacher Hub → CSV panel, or ask me about **type names**.' },
    { keywords: ['school connect csv', 'gosa csv', 'import from school connect', 'cross platform', 'compatible'], reply: '**Yes — full cross-platform CSV compatibility:**\n\n• School Connect / GOSA CSVs import into this platform **unchanged** (their headers, aliases, and type names like `true_false`, `multi_select`, `fill_blank` are auto-translated)\n• Your banks export to their format: Teacher Hub → Bank → **🔀 Export School Connect CSV**\n• Full-text answers are converted to A–D letters automatically\n\nSee Teacher Hub → CSV panel for details.' },
    { keywords: ['question types', 'types of questions', '17 types', '20 types', 'cloze', 'matching', 'matrix', 'hot text'], reply: '**All 20 question types:** MCQ · Multiple Response (all-or-nothing option) · True/False · Short Answer · Numeric (± tolerance) · Range/Estimation (any value in an interval) · Matching (with distractors) · Ordering · Assertion–Reason · Case Study/Comprehension · Image MCQ · Matrix/Grid · Hot Text · Code · Cloze multi-blank · Essay (keyword + min-word marking) · Categorization · Multi-part Numeric · Hotspot (tap the image) · Evidence-Based MCQ (two-part).\n\nFull reference with copy-paste CSV examples for every type: **question-types.html** (also linked from the Create Assessment page). Every type has a live preview in the Teacher Hub manual builder, and structured types take JSON in the Pairs/Items columns.' },
    { keywords: ['multi subject', 'utme', 'jamb', 'combined exam', 'subject tabs', 'multi-subject'], reply: '**Multi-Subject packages (🧪 Multi-Subject Builder):** bundle several subjects under ONE code with ONE combined timer. Candidates switch **subject tabs** at the top of the exam freely — answers persist per subject, and results include a per-subject breakdown.\n\n**Fastest way to build one:**\n1. Open the **AI Prompts Studio → Multi-Subject paper (UTME / Common Entrance style)** pack (or the UTME quick classic) and copy the prompt into any free AI chat — it is instructed to return a **downloadable .csv file** whose **Section column** tags every question with its subject.\n2. Open the **Multi-Subject Builder → ⚡ Fast lane** and paste or upload that ONE file (or grab the **⬇️ Sample CSV** to see the exact format).\n3. Click **🪄 Split into subjects** — the blocks fill themselves automatically. School Connect / GOSA combined CSVs work unchanged too.\n4. Review each subject, set the combined duration, publish → one code, tabbed paper.\n\n**Publishing needs a signed-in teacher** — if the builder says "packages must be owned by a teacher account", open the Teacher Hub and sign in first (the amber banner at the top of the builder page tells you before you upload anything).' },
    { keywords: ['paper exam', 'print exam', 'printable', 'offline exam', 'paper mode', 'bubble sheet', 'omr', 'answer key', 'print question paper'], reply: '**📄 Paper Exam Export (Phase 11):** every assessment can also run on PAPER. On the Assessments page click **📄 Paper Exam** — a print-ready document opens with:\n\n1. **The question paper** — school header, candidate details box, instructions, numbered questions with lettered options (or ruled lines for written answers), per-question marks, and subject section headers for multi-subject papers.\n2. **A confidential answer key** — one row per question with the answer letter + option text and the explanation/marking note, stamped KEEP SECURE for the invigilator.\n3. **An OMR-style bubble sheet** — A–E bubbles per objective question (written-answer questions get a marked-out box).\n\nThe digital CBT stays the source of truth — this is an extra delivery channel for halls without power/internet, mock exams, and archives. 100% free, no external service.' },
    { keywords: ['fast lane', 'combined csv', 'split csv', 'one file', 'section column', 'split into subjects'], reply: '**⚡ Fast lane (Multi-Subject Builder):** one combined CSV — the kind the Prompt Studio multi-subject pack produces — splits itself into subject blocks by its **Section** column:\n\n1. Multi-Subject Builder → **⚡ Fast lane** box\n2. Paste the CSV text or upload the downloaded `.csv` file (a JSON array works too)\n3. **🪄 Split into subjects** → every subject becomes its own block with its questions loaded (types, Pairs/Items JSON, tolerances all survive)\n4. Review names/counts, then **🚀 Publish Combined Assessment**\n\nQuestions without a Section value land in a "General" block. Download the **⬇️ Sample CSV** in the same box to see the exact format.' },
    { keywords: ['sample csv', 'download sample', 'example csv', 'sample file'], reply: '**Sample CSVs you can download right now:**\n\n• **Multi-subject (UTME-style):** AI Prompts Studio → the UTME quick-classic card → **⬇️ Sample multi-subject CSV** — or the same button inside the Multi-Subject Builder ⚡ Fast lane. Three subjects, mixed types, Section column, ready to re-import.\n• **Single-subject bank:** Teacher Hub → CSV panel template; the full 25-question demonstration bank is `database/sample-question-bank.csv` in the package.\n\nBoth import with zero edits — they are also the exact formats the Prompt Studio prompts request from the AI.' },
    { keywords: ['negative marking', 'penalty'], reply: '**Negative marking:** set the penalty per wrong answer when creating the exam (e.g. 0.25). Unanswered questions are never penalised — only wrong ones. It appears in the exam settings and applies at grading.' },
    /* ── PHASE 10: researched feature set ── */
    { keywords: ['adaptive', 'adaptive difficulty', 'harder questions', 'easier questions', 'cat', 'computerised adaptive'], reply: '**🧠 Adaptive difficulty (Phase 10):** turn it on in the exam form (Delivery & Scoring). The engine reads each question\u2019s **Difficulty** tag and re-orders the paper live:\n\n• Accuracy ≥70% → next question comes from the **hard** bucket\n• 30–69% → **medium**\n• Below 30% → **easy**\n\nDelivery is **forward-only** (like the real computerised-adaptive tests), needs a single-subject paper with at least 5 questions, and grading is unchanged — only the order adapts. Untagged questions count as medium.' },
    { keywords: ['instant feedback', 'immediate feedback', 'practice mode', 'study mode', 'points', 'streak', 'streaks', 'gamification'], reply: '**⚡ Practice mode with instant feedback (Phase 10):** set **Feedback Mode = Practice** when creating (or editing) an exam. After each auto-gradable answer the candidate immediately sees ✓/✗, the correct answer and your explanation — options freeze so the reveal is final.\n\nA Kahoot-style score chip counts **10 points per correct + 5 × streak bonus**, and the result screen shows the final points and best streak. Perfect for homework and drills; keep it on **Standard** for real exams.' },
    { keywords: ['utme 400', '400', 'score model', 'aggregate', 'jamb score'], reply: '**UTME /400 aggregate scoring (Phase 10):** set **Score Model = UTME /400** on any exam (the Multi-Subject Builder defaults to it). Each subject contributes its percentage × 1, so a 4-subject paper totals exactly /400 like the real UTME; single-subject papers scale ×4. The candidate sees a big **UTME-STYLE AGGREGATE** banner on the result screen, and the classic percentage stays everywhere else.' },
    { keywords: ['accommodation', 'extra time', 'extended time', 'disability', '1.5x', '2x', 'special time'], reply: '**⏱ Exam accommodations (Phase 10):** on the Students page every roster student now has an ⏱ button — grant **+25% / +50% (1.5×, the most common grant) / +100% (2×)** extra time, plus a private note.\n\nApplies to **registered-mode exams** automatically at start. Following accessibility best practice (ETS/ADA), the extension is applied **silently** — accommodated candidates are never singled out on result slips, leaderboards or reports.' },
    { keywords: ['psychometric', 'kr-20', 'item analysis', 'difficulty index', 'discrimination', 'distractor', 'reliability', 'statistics report'], reply: '**📊 Psychometric Report (Phase 10, Results page):** ExamSoft-style statistics computed from your own submissions:\n\n• **Exam level:** KR-20 reliability, SEM (± band around a score), mean, median, SD, pass rate\n• **Per question:** difficulty index p, discrimination index D (upper vs lower 27%), point-biserial, mean answering time, full response spread\n• **Automatic flags:** too easy/hard, low/negative discrimination, weak correlation, dead distractors (<5% picks), distractor defects, suspiciously fast answers\n\n100% rule-based maths in your browser — free, no AI service. Export alongside the classic Item Analysis CSV.' },
    { keywords: ['live monitor', 'live invigilation', 'invigilation', 'watching exam', 'live session'], reply: '**👁 Live Invigilation Monitor (Phase 10, Results page):** see everyone currently sitting an open exam — live progress bars, which question they are on, violation counts, and time since their last ping (the engine pings every ~45s; over 2 minutes shows ⚠ Stale). Rows refresh every 15s. Sessions older than 3 hours drop off automatically.' },
    { keywords: ['appeal', 'appeals', 'rescore', 'rescoring', 'review my score', 'script review'], reply: '**🧾 Appeals — script review requests (Phase 10):** candidates get a **"Request a script review"** link on their result screen (released results only; one pending request per exam).\n\nAs the teacher you see the queue on the Results page → **🧾 Appeals** — each request shows the candidate\u2019s reason, and you resolve it **✓ Grant** or **✗ Decline** with a decision note. Use the Review Queue to actually re-mark the script if needed.' },
    { keywords: ['leaderboard', 'ranking', 'medal', 'percentile', 'badges'], reply: '**🏆 Leaderboard (Phase 10, Results page):** ranks the currently filtered results using each candidate\u2019s **best attempt** — medals for the top 3, percentiles, and badges (Distinction ≥90%, Merit ≥75%, Top 10%).\n\nIt is teacher-only by design and **hideable with one click** — Quizizz made hiding possible because public ranking stresses some learners. Project it deliberately, not by default.' },
    { keywords: ['what is new', 'phase 10', 'new features', "what's new", 'latest features', 'upgrade'], reply: '**Phase 10 — features researched from the world\u2019s best CBT platforms (all free, rule-based, no AI API):**\n\n1. **🧠 Adaptive difficulty** — the paper re-orders itself harder/easier as the candidate goes\n2. **⚡ Practice mode** — instant ✓/✗ + explanation per question, with points and streaks\n3. **📊 Psychometric report** — KR-20, SEM, difficulty/discrimination/distractor analysis\n4. **⏱ Accommodations** — +25/50/100% time per roster student, applied silently\n5. **UTME /400 scoring** — JAMB-style aggregate on any paper\n6. **👁 Live invigilation monitor** — watch an exam in progress, live\n7. **🧾 Appeals** — candidates request script reviews; you resolve them\n8. **🏆 Leaderboard** — best attempt per candidate, hideable\n9. **🛡 Integrity signals** — fast-answer and device-consistency evidence\n\nAsk me about any of them by name for the full how-to.' },
    { keywords: ['integrity signals', 'fast answers', 'anomaly', 'device', 'cheating evidence', 'suspicious'], reply: '**🛡 Integrity Signals (Phase 10, Results page):** evidence computed from data the engine already records — **fast-answers** (half or more of correct answers locked in under 2 seconds), **very-fast-pace** across the paper, violation counts, and **device switching** across attempts (each attempt carries a device fingerprint).\n\nThese are leads, not verdicts: shared school computers and repeated retakes can both look "fast". Always open the script before drawing conclusions.' },
    { keywords: ['access code', 'exam code', '6 character', 'share exam', 'share link'], reply: '**Access codes:** every published exam gets a unique 6-character code + link. Candidates enter it on the home page (or follow the link). The Teacher Hub shows a WhatsApp-ready message. Codes can be regenerated, exams locked/unlocked, duplicated or archived.' },
    { keywords: ['exam locked', "students can't enter", 'students cannot enter', 'not open error', 'exam not found', 'locked exam', 'reopen exam', 'open exam', 'is locked', 're-open', 'reopen', 'locked out', 'cant enter', "can't enter", 'new exam not working', 'new link not working', 'old exams work'], reply: '**"Exam not found or not open" — what it means and the fix:**\n\nAn exam code only loads when the exam is **OPEN**. Causes and fixes:\n\n1. **Locked exam** (most common): the teacher published with "No — keep locked". The student page will actually say *"this exam is currently LOCKED by your teacher"* once the updated schema is installed. **Fix:** Teacher Hub → **Assessments → select the exam → ⋮ Actions → Open** (or the batch Open action). New exams now **open by default** on publish — and after publishing one exam, the form resets to the recommended "open immediately" default.\n2. **Database behind the site (NEW links fail, OLD ones still work):** the front-end was updated but the Supabase database wasn\'t. Students see a dead-end message, and anti-cheat / certificate / adaptive settings are silently dropped on save. The Teacher Hub shows a persistent red **"Platform database is out of date"** banner when this happens. **Fix (2 minutes, safe to re-run):** Supabase dashboard → SQL Editor → paste and run the **entire** `database/complete-schema.sql` → refresh. Then open any exam that was created while the banner was showing.\n3. **Not started yet:** if a future start time is set, students see the unlock date/time and a wait room — nothing to fix.\n4. **Closing time passed:** the exam auto-closes at its scheduled close time; re-open or extend if it should still run.\n5. **Wrong code:** 6 characters, letters+digits — resend the code/link from the Assessments page.\n\nGuardrails: sharing a locked exam warns the teacher on WhatsApp share, copy-link AND the printed Access Sheet shows a 🔴 LOCKED banner. You can also run **deployment_validator.html** — its live database probe now checks this exact condition.' },

    /* ── TAKING EXAMS ── */
    { keywords: ['take exam', 'start exam', 'student portal', 'candidate', 'enter code'], reply: '**Taking an exam:** open the link or home page → enter the 6-character code → type your name and class (or registered Student ID) → pass the identity/proctoring gate if enabled → the exam runs in fullscreen with a timer and question navigator. In **multi-subject papers**, subject tabs sit at the top — switch any time, your answers persist per subject.\n\nYour answers auto-save to the device every 10 seconds, and a draft restore brings you back if the browser crashes.' },
    { keywords: ['calculator', 'scientific calculator', 'alt+c', 'trigonometry', 'logb'], reply: '**The on-screen scientific calculator** (exam screen, Alt+C):\n• Trig + reciprocals + inverses (sin…cot, asin…acot) with DEG/RAD\n• Hyperbolics + inverses, ln/log/log₂/logb(x,b), powers, roots, nCr/nPr, n!\n• **Statistics:** median, mode, std, variance, range, count\n• Percent handled like a real calculator (50% = 0.5, but 10 % 3 = modulo)\n• Memory MC/MR/M+/M−/MS, **Ans**, constants (π, e, τ, φ, g, Nₐ…)\n• **↑ ↓ replay** of your last 20 expressions and **⤵ Use result** which types the answer straight into your answer box\n• Safe tokenising engine — no eval, ever' },
    { keywords: ['keyboard shortcuts', 'jamb keys', '8 keys', 'hotkeys', 'shortcut keys'], reply: '**JAMB-style 8-key navigation (exam screen):**\n\n• **A / B / C / D** — select that option (works on MCQ, True/False, Multiple Response)\n• **N** or **→** — next question\n• **P** or **←** — previous question\n• **R** — flag / bookmark the current question for review\n• **S** — open the submit summary\n\nExactly like the real UTME interface, so candidates practise the muscle memory. The keys never fire while you are typing in an answer box.' },
    { keywords: ['**🔊 Read Aloud & ❓ How to Answer** (exam screen):\n• **Read Aloud (Alt+R)** speaks the current question and its options with your device\'s free built-in voices — long passages are read in smooth sentence-by-sentence chunks that never stall, and Alt+S stops instantly. Every question style is read naturally: matching (including the option pool), ordering, categorization, assertion–reason (stems first), case studies (passage first, then the question), math spoken in words (“the fraction 3x plus 6, over 9”), and Yorùbá/Igbo/Hausa/French plus 20 more languages are auto-detected — with a phonetic fallback when no native voice is installed. Tap the ⚙ beside the button to choose language, voice and speed (remembered on this device). It never reads the answer key, and it stops automatically when you change question, submit, switch tabs or close the page.\n• **How to Answer** opens a plain-language legend for EVERY question style — multiple response, matching, ordering, categorization, matrix, hot text (tap a chip to select it — it lights up — tap again to unselect), assertion–reason, case study and more. Reading it does not use exam time.\n• Every structured question also shows a 💡 how-to tip right above it.', 'text to speech', 'tts', 'voice', 'speak question', 'alt+r', 'how to answer', 'question types work', 'legend'], reply: '**🔊 Read Aloud & ❓ How to Answer** (exam screen):\n• **Read Aloud (Alt+R)** speaks the current question and its options with your device\'s free built-in voices — matching, ordering, categorization, assertion–reason and case studies (passage first, then the question) are read naturally. It never reads the answer key, and it stops automatically when you change question, submit or switch tabs (Alt+S stops it too).\n• **How to Answer** opens a plain-language legend for EVERY question style — multiple response, matching, ordering, categorization, matrix, hot text (tap a chip to select it — it lights up — tap again to unselect), assertion–reason, case study and more. Reading it does not use exam time.\n• Every structured question also shows a 💡 how-to tip right above it.' },
    { keywords: ['maths keyboard', 'math keyboard', 'symbols', 'greek', 'integral symbol', 'alt+k'], reply: '**The Maths & Science keyboard** (exam screen, Alt+K): **300+ searchable symbols** in 20 groups — all 48 Greek letters, calculus (∫∬∭∮∂∇∑), sets & logic, number sets, geometry, vectors & matrices, statistics, brackets, fractions, relations, chemistry (H₂O, SO₄²⁻, ⇌), physics units, arrows, super/subscripts.\n\nTap your answer box first, then tap a symbol. Use the 🔎 search box to find any symbol by name ("integral", "alpha", "subset").' },
    { keywords: ['cheating', 'anti cheat', 'proctoring', 'webcam', 'tab switch', 'fullscreen'], reply: '**Integrity system:** fullscreen lockdown, tab-switch and window-blur detection, copy/paste/right-click/devtools blocking, optional webcam Face Gate with periodic snapshots and multi-face detection, optional voice-activity monitor. Violations warn, log, and can auto-submit at the configured limit.\n\nThe calculator and maths keyboard are recognised exam tools — using them never raises a flag.' },
    { keywords: ['draft', 'autosave', 'browser crashed', 'restore answers', 'crash'], reply: '**Answer safety nets:** answers auto-save to the device every 10 seconds. If the browser or network dies, reopening the exam offers a **draft restore** back to your exact question. An offline backup file can be downloaded mid-exam if the network is gone.' },
    { keywords: ['result', 'score', 'grade ring', 'released', 'held'], reply: '**Results:** after submitting you see the score ring, grade, time used, integrity summary and a question-by-question breakdown with explanations. Teachers can hold results for manual release. If your script contains **essay/code/short answers**, a 🧑‍🏫 notice explains those marks stay provisional until the teacher\'s audit.' },

    /* ── MANUAL REVIEW ── */
    { keywords: ['essay grading', 'essay mark', 'essays marked', 'how are essays', 'manual grading', 'tutor audit', 'review queue', 'subjective', 'override score', 'keyword score'], reply: '**Tutor Score Audit (manual review):** scripts containing essay / code / short-answer / case-study questions are **auto-flagged** into the teacher\'s 🧑‍⚖️ **Review Queue** at submission.\n\nOpen a script → the marking-scheme panel shows expected keywords, minimum words and the provisional keyword score → **✏️ Audit** each open-ended question → assign 0.0–1.0, add feedback, optionally release the result. When every open-ended question is audited, the script leaves the queue and the revision is written to the audit trail.' },

    /* ── AI PROMPTS ── */
    { keywords: ['ai prompt', 'chatgpt', 'claude', 'gemini', 'deepseek', 'prompt studio', 'generate questions'], reply: '**AI Prompts Studio (cbt-prompts.html):** 24 tailored prompt packs (simple recall → enterprise all-20-types → 🎯 Auto-Graded Ultimate Pack (every auto-marked type) → multi-subject UTME → misconception hunter → exam-board simulation → uploaded/linked material CBT → reading & video comprehension → assignment brief + rubric…). Copy the prompt into any **free** AI chat; it is instructed to return a **downloadable .csv file** built for this platform\'s importer. Paste the answer back (or load the downloaded file) and the validator checks it before loading into your Teacher Hub bank.\n\nNo AI API, no cost — and the 17-column CSV contract is enforced in the prompt itself.' },

    /* ── GENERATOR ── */
    { keywords: ['generator', 'whitelabel', 'custom zip', 'brand', 'new school', 'client package'], reply: '**The CBT System Generator is a separate product** (cbtgen.vercel.app) — it is not part of this exam platform. Deployments for client schools are built there: brand the identity and theme, inject the client\'s Supabase credentials and license, and download a verified, deploy-ready ZIP of a complete CBT system.' },

    /* ── BACKUP / DRIVE / DR ── */
    { keywords: ['google drive', 'drive sync', 'cloud backup', 'backup', 'sync'], reply: '**Google Drive backup:** Settings → Google Drive Cloud Sync → paste a free OAuth Client ID → **Authorize** → **Test** → **Backup Now**, then enable auto-sync (interval in days). Backups land in the school\'s OWN Drive folder `HMG_CBT_Backups` (newest 15 kept, scope drive.file — we only see our own files). Full setup guide: **GOOGLE_DRIVE_BACKUP.md**.' },
    { keywords: ['disaster recovery', 'inactive project', 'paused project', 'lost project', 'new supabase', 'migrate', 'restore drive'], reply: '**Disaster Recovery Console (🚨 Recovery page):** if a Supabase project is lost/paused forever but the school has Drive backups, the 7-step console rebuilds everything on a fresh free project:\n\n1. Connect the previous Google Drive (or load a downloaded envelope file)\n2. Create the new project + run the schema SQL — connection & schema TESTED live\n3. Choose a backup and inspect its contents\n4. **Dry-run** the restore (full plan, nothing written)\n5. Execute + live verification (row counts vs envelope)\n6. Switch permanently + re-invite staff logins\n7. Re-arm the 10-layer protection\n\nIdempotent throughout — interrupted? Just re-run.' },
    { keywords: ['envelope', 'full backup', 'export data', 'data portability'], reply: '**Backup envelopes (Admin Data):** one JSON file with every table — exams with banks, rosters, results, settings, license, recent audit. Restore supports **dry-run** (see the exact plan first), upserts exams by code, students by (teacher, ID), and re-attaches results by exam code. Legacy v10 envelopes auto-convert.' },
    { keywords: ['free tier', 'supabase pause', 'inactivity', 'keepalive', 'heartbeat', '7 day'], reply: '**10-layer Supabase free-tier protection** (Supabase pauses free projects after 7 days without database activity):\n\n0. Heartbeat table + RPC · 1. site-visit pings · 2. GitHub Actions twice-weekly (verified write + self-committing anti-freeze) · 3. Vercel endpoint · 4. pg_cron every 2 days · 5. manual button · 6. UptimeRobot 24/7 · 7. Vercel cron · 8. Supabase Edge function `ping` · 9+10. daily Management-API **auto-restore watchdog**.\n\nEvery layer performs a REAL database write and the timestamp proof is checked. **The protection keeps running even when a subscription has expired** — an expired platform is never allowed to fall silent and get paused. Full manual: **SUPABASE_FREE_TIER_PROTECTION.md** (~7 min setup).' },
    { keywords: ['storage', '500mb', 'quota', 'archive vault', 'purge', 'database size'], reply: '**Storage Manager (storage.html):** real Postgres table sizes vs the 500 MB free cap, an efficiency advisor, and the **Archive Vault** — old results/audit rows are snapshotted into the separate 1 GB File Storage bucket, the upload is verified, and ONLY THEN can the purge run (the purge RPC demands the archive path as proof). Restore any archive later.' },
    { keywords: ['platform health', 'health page', 'health check', 'security grade', 'rls', 'posture', 'diagnostics'], reply: '**Platform Health (platform-health.html):** latency probe, 7 RPC smoke tests, live heartbeat evidence, and an **A–F security posture grade** — anon-key hygiene, RLS probes that must FAIL anonymously, HTTPS, session hygiene, lockdown/idle-lock config. Anything below B comes with the exact fix, and the report is copyable for support.' },
    { keywords: ['roles', 'status', 'approve', 'suspend', 'user management', 'super admin', 'approval queue'], reply: '**Roles & Status (status-manager.html):** approval queue for new sign-ups, teacher/admin/super_admin roles (owner-only grants enforced server-side), bulk activate/suspend/deactivate with reasons, account drill-downs (exams, submissions, audit trail) and an invite-message generator. The FIRST registered account becomes super_admin automatically.' },
    { keywords: ['audit', 'activity log', 'who did', 'event log', 'trail'], reply: '**Audit & Activity Log (activity_log.html):** every privileged action — approvals, role changes, purges, archives, restores, settings edits, license changes, score audits — with server-side filtering, stats, a 30-day chart, live tail, CSV export and retention purge (with a downloadable copy first).' },

    /* ── LICENSING & SUBSCRIPTIONS ── */
    { keywords: ['license', 'subscription', 'expiry', 'grace', 'lifetime', 'token', 'renew', 'renewal'], reply: '**Site License — how subscriptions work:**\n• **Lifecycle:** lifetime / active / warning (≤30 days) / grace (expired + grace days) / expired / suspended. Sources: remote registry JSON → site_license table → baked config, with SHA-256 tamper evidence.\n• **Renewal is provider-managed:** when a subscription expires, contact **HMG Concepts** (the platform provider — WhatsApp +234 810 086 6322) or use the Renew link on the lock screen. The provider extends the platform **remotely** and it re-activates instantly — no rebuild, no data loss. Subscription state can never be changed from inside a client deployment.\n• **An expired platform never goes silent:** the heartbeat keeps the database warm so Supabase never pauses it, and in-progress exams are never interrupted mid-paper.'
     },
    { keywords: ['subscription expired', 'platform locked', 'renew', 'renewal', 'expired subscription', 'locked portal'], reply: '**When a subscription expires:**\n1. **≤30 days before:** an amber banner counts down and links the renew action.\n2. **Expiry day → grace days:** a red banner shows the final grace days left.\n3. **After grace:** the portal shows a renewal screen — BUT the platform is deliberately kept alive: the **heartbeat keeps the Supabase database warm** so the project is never paused for inactivity, and **renewal restores full access instantly** — no rebuild, no data loss. Admin sign-in stays reachable while locked.\n4. **Renewal is provider-managed:** contact **HMG Concepts** (WhatsApp +234 810 086 6322 · hismarvellousgrace@gmail.com) or use the Renew button on the lock screen — the provider extends the platform **remotely** and it re-activates immediately. Subscription state can never be changed from inside a client deployment.' +
    '\nIn-progress exams are never interrupted mid-paper.' },
    
    

    /* ── PAGES & TOOLS ── */
    { keywords: ['certificate', 'verify', 'verification code', 'qr'], reply: '**Certificates:** passed exams issue certificates with a verification code + QR link. Anyone can verify on certificate.html (no login). Held results issue nothing until the teacher releases them. The proprietor\'s signature from Settings appears on printouts.' },
    { keywords: ['install', 'install app', 'pwa', 'add to home', 'home screen', 'download app'], reply: '**Installing the app** (recommended for exams): the banner at the bottom of every page offers it.\n• **Android/Chrome/Edge:** Install app (or menu ⋮ → Add to Home screen)\n• **iPhone/iPad:** open in **Safari** → Share ⬆️ → **Add to Home Screen**\n• **Windows/Mac/Chromebook:** install icon in the address bar\n\nInstalled, it runs full-screen, loads faster and survives weak networks. The weekly reminder stops once installed.' },
    { keywords: ['new version', 'update available', 'refresh', 'stale page', 'old page still showing', 'browser cache', 'site looks old'], reply: '**🚀 Updates & cache:** after a redeploy the browser may keep showing the previous version until its service worker updates — a “🚀 A new version is available — Refresh now” pill appears at the bottom when the new version is ready. To see it immediately: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac). The platform checks for updates automatically every 15 minutes on open tabs.' },
    { keywords: ['announcement', 'broadcast', 'notice', 'school notice', 'message from admin', 'banner message'], reply: '**📣 Announcements:** administrators broadcast a notice from **Settings → Announcement Banner**; it appears at the top of every page for every visitor until dismissed (per browser session) or changed. Ideal for exam timetables, maintenance windows and school-wide notices — no rebuild, no redeploy, instant.' },
    { keywords: ['ctrl k', 'control k', 'command palette', 'global search', 'find page', 'jump to page', 'keyboard shortcut', 'search pages'], reply: '**🔎 Global Search (Ctrl+K / ⌘K):** press Ctrl+K anywhere (or the 🔎 button, bottom-right) to open the command palette — type to jump to any page, tool or action your role allows: “storage”, “verify”, “prompts”, “sign out”, “help”… Arrow keys navigate, Enter opens, Esc closes. It works on every page except the fullscreen exam runner.' },
    { keywords: ['link checker', 'broken link', '404'], reply: '**Link Checker (link_checker.html):** crawls this deployment and reports every broken internal link, missing asset or dead reference — run it after every redeploy or domain change.' },
    { keywords: ['deployment validator', 'post-deploy', 'validator', 'checklist'], reply: '**Deployment Validator (deployment_validator.html):** the post-deploy health checklist — verifies every expected file is served, the schema markers are present, security headers, PWA wiring and the keepalive configuration. Run it once after deploying and once after any upgrade.' },
    { keywords: ['offline page', 'no network', 'offline mode'], reply: '**Offline mode:** when the network drops, the installed app shows the cached 📳 offline shell instead of a browser error — exams in progress keep running from the draft safety net, and mid-exam answer backup files can be downloaded. Reconnect and everything syncs.' },

    /* ── ACCOUNTS ── */
    { keywords: ['sign up', 'register', 'login', 'account', 'teacher account', 'approved'], reply: '**Accounts:** sign up with email + password (Supabase Auth). Teachers/admins wait in the **approval queue** until an admin approves them — the first account on a fresh platform becomes super_admin automatically. Candidates never need accounts: they use the exam code + their name (or registered Student ID).' },
    { keywords: ['student id', 'registered student', 'roster', 'impersonation'], reply: '**Registered vs Open candidates:** teachers import a roster (FullName, StudentID, Class). A registered exam only admits students whose ID is on the roster — stopping impersonation. Open exams accept any name + class.' },

    /* ── DATA / SCHEMA ── */
    { keywords: ['schema', 'sql', 'complete_schema', 'database setup', 'tables'], reply: '**Database setup:** one file — `database/complete-schema.sql` — installs 11 tables (incl. the client registry), 45+ RPCs, security policies, the archive-vault bucket, the heartbeat system and starter rows. **Idempotent:** safe to run many times; running it on an older deployment upgrades it in place without data loss.' },
    { keywords: ['rls security', 'is my data safe', 'security', 'anon key', 'service role'], reply: '**Security model:** row-level security decides per request who may read/write what — enforced by Postgres, not by the browser. The public anon key is safe in the page; the **service_role key must NEVER be pasted anywhere** (Platform Health grades this instantly as F). All destructive actions are owner-only, batch-capped, whitelist-checked and audit-logged.' },

    /* ── HELP / NAVIGATION ── */
    { keywords: ['where is', 'navigate', 'which page', 'how do i find', 'menu', 'sitemap of pages'], reply: '**Every page:** 🏠 Home (launcher) · 📝 Take Exam · 👨‍🏫 Teacher Hub · 🧪 Multi-Subject Builder · 🤖 AI Prompts · 📖 Type Guide · 🛡️ Admin · 💾 Data & Sync · 🚨 Recovery · 📦 Storage · 🩺 Health · 👥 Roles · ⚙️ Settings · 📊 Audit · 🏅 Verify · 🔗 Link Checker · ✅ Deployment Validator · 🗺️ Feature Guide.' +
    '\n\nPublic pages are reachable directly; internal tools live behind the Teacher/Admin sign-ins. The **📘 Help Center** button on any page explains every section of the current page in detail — and you can ask me "what is this page?" anywhere.' },
    { keywords: ['help center', 'page guide', 'guide banner', 'explain page', 'what is this page', 'this page', 'about this page', 'how do i use this page'], reply: '__PAGE_GUIDE__' },
    { keywords: ['tips', 'advice', 'best practice', 'mistakes to avoid'], reply: '__PAGE_TIPS__' },
    { keywords: ['first time', 'getting started', 'beginner', 'new user', 'start here', 'new here'], reply: '**First time here?**\n• **Candidates:** get the 6-character code from your teacher → home page → Take Exam\n• **Teachers:** sign up → get approved → Teacher Hub → Create Assessment (a School Connect CSV pastes straight in; new exams open on publish)\n• **Admins:** Settings → branding/defaults/security, then approve staff, then connect Google Drive' +
    '\n\nAsk me about any of these for the detailed walkthrough — or "what is this page?" anywhere you are.' },
    { keywords: ['what can you do', 'who are you', 'what do you know', 'your capabilities', 'help me'], reply: '**I am the CBT System Assistant** — a 100% offline, rule-based guide (no AI API, no data leaves your browser). I know:\n\n• **Every page** of this platform — ask "what is this page?" anywhere\n• **Every process:** creating exams, CSV formats (ours + School Connect/GOSA), multi-subject UTME papers with subject tabs, sharing codes, the exam runner, calculator & maths keyboard, essay review, backups, disaster recovery, storage, subscriptions & renewal, client monitoring, licensing, roles, audit, settings, certificates, installing the app…\n• **The fixes:** "students can\'t enter", "exam locked", "subscription expired", "supabase pause" and more\n\nTap a quick-question chip or just type naturally.' },
    { keywords: ['price', 'cost', 'paid', 'free', 'subscription fee'], reply: '**Running costs here are ₦0:** hosting (Vercel/GitHub Pages), database (Supabase free tier + 10-layer protection), backups (the school\'s own Google Drive), question generation (free AI chats + our prompt packs), certificates, PWA — no per-student cost, no AI API. (If this platform was delivered by HMG as a subscription product, renewal is arranged directly with HMG Concepts — never collected inside the app.)' }
  ],

  /* Quick chips: page-aware (top sections of this page + two globals) */
  quickQuestions: [],

  buildQuickQuestions() {
    const g = this.pageGuide();
    const secs = (g.sections || []).slice(0, 3).map(s => 'About: ' + s.name);
    const pageId = this.pageId();
    let pageSpecific = [];
    if (pageId === 'index.html') pageSpecific = ['How do students take an exam?', 'What is new in Phase 10?', 'Getting started'];
    else if (pageId === 'student.html') pageSpecific = ['Calculator features', 'Keyboard shortcuts (JAMB 8 keys)', 'My answers crashed — restore?'];
    else if (pageId === 'teacher.html') pageSpecific = ['How do I create an exam?', 'Psychometric report', 'Live invigilation monitor', 'How are essays graded?'];
    else if (pageId === 'cbt-multi.html') pageSpecific = ['How does the fast lane work?', 'Download a sample CSV'];
    else if (pageId === 'cbt-prompts.html') pageSpecific = ['Generate questions with AI', 'CSV format help'];
    
    else if (pageId === 'admin.html') pageSpecific = ['Subscription expired — what now?', 'How do I renew?'];
    else pageSpecific = ['What is this page?', 'Getting started'];
    return [...new Set([...pageSpecific, ...secs, 'What is this page?'])].slice(0, 8);
  },

  init() {
    this.messages = [{ sender: 'bot', text: this.greeting() }];
    this.quickQuestions = this.buildQuickQuestions();
    this.injectWidget();
  },

  greeting() {
    const g = this.pageGuide();
    const t = g.title || 'the platform';
    return 'Hello! 👋 I am your **CBT System Assistant** — I know every page of this platform.\n\n**You are on:** ' + t.replace(/^[^\w]+/u, '') + '\n' + (g.summary || '') + '\n\nAsk me anything — or tap **"What is this page?"** below for the full walkthrough of this page.';
  },

  injectWidget() {
    if (document.getElementById('cbt-chatbot-widget')) return;
    if (!this.quickQuestions || !this.quickQuestions.length) this.quickQuestions = this.buildQuickQuestions();
    const widget = document.createElement('div');
    widget.id = 'cbt-chatbot-widget';
    const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    widget.innerHTML = `
      <div id="cbt-chatbot-toggle" onclick="CBTChatbot.toggle()" style="position:fixed;bottom:24px;left:24px;z-index:99990;background:linear-gradient(135deg,var(--primary),var(--accent));color:#000;width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.4);transition:transform 0.2s;" title="Ask the CBT Assistant">
        🤖
      </div>
      <div id="cbt-chatbot-window" style="position:fixed;bottom:86px;left:24px;z-index:99990;width:370px;max-width:calc(100vw - 48px);height:520px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 16px 48px rgba(0,0,0,0.5);display:none;flex-direction:column;overflow:hidden;">
        <div style="background:var(--surface-2);padding:14px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:20px;">🤖</span>
            <div>
              <strong style="font-size:13px;display:block;">CBT System Assistant</strong>
              <small style="font-size:11px;color:var(--primary);">Offline · page-aware · knows every page</small>
            </div>
          </div>
          <button class="btn btn-sm btn-outline" onclick="CBTChatbot.toggle(false)" style="padding:4px 8px;">✕</button>
        </div>
        <div id="cbt-chatbot-quick" style="padding:8px 10px;border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:5px;background:var(--bg);">
          ${this.quickQuestions.map(q => `<button class="btn btn-sm btn-outline" style="padding:4px 9px;font-size:11px;margin:0;" onclick="CBTChatbot.ask('${esc(q).replace(/'/g, "\\'")}')">${esc(q)}</button>`).join('')}
        </div>
        <div id="cbt-chatbot-messages" style="flex:1;padding:14px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;font-size:13px;"></div>
        <div style="padding:10px;background:var(--surface-2);border-top:1px solid var(--border);display:flex;gap:6px;">
          <input type="text" id="cbt-chatbot-input" placeholder="Ask anything — pages, exams, CSV, backup, renewals…" style="margin-bottom:0;padding:8px 12px;font-size:13px;" onkeydown="if(event.key==='Enter') CBTChatbot.send()">
          <button class="btn btn-sm btn-primary" onclick="CBTChatbot.send()">Send</button>
        </div>
      </div>
    `;
    document.body.appendChild(widget);
    this.render();
  },

  toggle(force) {
    this.isOpen = force !== undefined ? force : !this.isOpen;
    const win = document.getElementById('cbt-chatbot-window');
    if (win) win.style.display = this.isOpen ? 'flex' : 'none';
    if (this.isOpen) setTimeout(() => document.getElementById('cbt-chatbot-input')?.focus(), 100);
  },

  ask(q) {
    this.toggle(true);
    const inp = document.getElementById('cbt-chatbot-input');
    if (inp) { inp.value = q; }
    this.send();
  },

  /* score-based matching: the intent with most (and longest) keyword hits wins;
     a minimum threshold stops weak false positives. */
  _match(lower) {
    let best = null, bestScore = 0;
    for (const item of this.kb) {
      let score = 0;
      for (const k of item.keywords) {
        if (lower.includes(k)) score += k.length;   // longer match = stronger signal
      }
      if (score > bestScore) { bestScore = score; best = item; }
    }
    return (bestScore >= 4) ? best : null;
  },

  /* Section-level search inside the CURRENT page guide: lets a user ask
     about a section by name ("roster", "review queue", "fast lane"…). */
  _matchSection(lower, g) {
    if (!g || !g.sections) return null;
    let best = null, bestScore = 0;
    for (const s of g.sections) {
      const name = String(s.name || '').toLowerCase();
      const desc = String(s.desc || '').toLowerCase();
      let score = 0;
      for (const word of lower.split(/[^a-z0-9]+/)) {
        if (word.length < 4) continue;
        if (name.includes(word)) score += word.length * 2;      // name hits count double
        else if (desc.includes(word)) score += word.length;
      }
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return (bestScore >= 10) ? best : null;
  },

  send() {
    const inp = document.getElementById('cbt-chatbot-input');
    const text = inp?.value.trim();
    if (!text) return;

    this.messages.push({ sender: 'user', text });
    inp.value = '';
    this.render();

    setTimeout(() => {
      const lower = text.toLowerCase();
      const g = this.pageGuide();
      let reply = null;

      if (/\b(hello|hi|hey|good (morning|afternoon|evening))\b/.test(lower) && lower.length < 30) {
        reply = 'Hello! 👋 You are on **' + (g.title || 'the platform').replace(/^[^\w]+/u, '') + '**. ' + (g.summary || '') + '\n\nAsk me about this page, any feature, or tap a quick question above.';
      } else if (lower.includes('thank')) {
        reply = 'You are very welcome! 🎉 Ask me anything else any time.';
      } else {
        const hit = this._match(lower);
        if (hit) {
          reply = hit.reply;
          if (reply === '__PAGE_GUIDE__') reply = this.pageGuideText(g);
          else if (reply === '__PAGE_TIPS__') reply = (g.tips && g.tips.length)
            ? '**Tips for this page (' + (g.title || '').replace(/^[^\w]+/u, '') + '):**\n' + g.tips.map(t => '• ' + t).join('\n')
            : this.pageGuideText(g);
        } else {
          const sec = this._matchSection(lower, g);
          if (sec) {
            reply = '**' + sec.name + '** (section of ' + (g.title || 'this page') + ')\n' + sec.desc + '\n\nFor the rest of this page ask "what is this page?" — or tap 📘 Help Center at the top.';
          }
        }
      }

      if (!reply) {
        const topics = (g.sections || []).slice(0, 4).map(s => '**' + s.name + '**').join(' · ');
        reply = 'I don\'t have a specific answer for that yet — but on **this page** I can explain: ' + (topics || 'every section') + '.\n\nYou can also ask about: **create exam**, **CSV format**, **multi-subject UTME**, **calculator**, **essay grading**, **Google Drive**, **free-tier protection**, **disaster recovery**, **subscription/renewal**, **client monitor**, **roles**, **license**, or **installing the app**.\n\nFor the full walkthrough of this page tap **📘 Help Center** in the page guide banner at the top, or ask me "what is this page?".';
      }

      this.messages.push({ sender: 'bot', text: reply });
      this.render();
    }, 250);
  },

  render() {
    const container = document.getElementById('cbt-chatbot-messages');
    if (!container) return;
    container.innerHTML = this.messages.map(m => `
      <div style="align-self:${m.sender === 'user' ? 'flex-end' : 'flex-start'};max-width:88%;background:${m.sender === 'user' ? 'var(--primary)' : 'var(--surface-2)'};color:${m.sender === 'user' ? '#000' : 'var(--text)'};padding:10px 14px;border-radius:12px;border:1px solid ${m.sender === 'user' ? 'transparent' : 'var(--border)'};line-height:1.55;">
        ${m.text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code style="background:rgba(127,127,127,.15);padding:1px 5px;border-radius:5px;font-size:11.5px;">$1</code>').replace(/\n/g, '<br>')}
      </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
  }
};

window.CBTChatbot = CBTChatbot;

document.addEventListener('DOMContentLoaded', () => {
  if (window.SiteHelp && !document.getElementById('cbt-page-guide-banner')) SiteHelp.renderPageGuideBanner();
  CBTChatbot.init();
});
