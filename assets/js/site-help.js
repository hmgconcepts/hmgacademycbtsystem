/* ====================================================================
   site-help.js — HMG CBT Pro v4.1 Comprehensive Help & Page Guides
   ====================================================================
   Every page explained in detail for FIRST-TIME users: what the page is
   for, who uses it, what every section does, and the practical tips that
   stop mistakes before they happen. Plus a Help Center modal with the
   getting-started paths for each role, a glossary, and FAQs.
   100% offline, no AI API.
   ==================================================================== */
const SiteHelp = {
  pages: {
    'index.html': {
      title: '🏠 Home — Portal Launcher & Feature Showcase',
      who: 'Everyone — candidates, teachers, admins, first-time visitors.',
      summary: 'The front door of the platform. It launches the three portals, demonstrates the question types, and installs the app on your device.',
      sections: [
        { name: 'Portal Launcher', desc: 'Three portals, and only three: Candidate Exam Portal (take a test — no account needed), Teacher Login (the assessment hub for staff), and Admin Login (platform governance). All internal tools — Multi-Subject Builder, AI Prompts Studio, Data & Sync, Storage, Health, Roles, Settings, License, Audit — live INSIDE the teacher and admin workspaces after sign-in, never on this public page.' },
        { name: 'Take-Exam Card', desc: 'Candidates paste the exam LINK or the 6-character CODE their teacher gave them, type their name and class (or registered Student ID), and enter the proctored exam runner.' },
        { name: 'Install Prompt (banner + weekly reminder)', desc: 'The platform repeatedly offers to install itself as an app — full-screen, faster, better on weak networks. Android/Chrome: Install app. iPhone: Safari → Share → Add to Home Screen. Dismissal is remembered; "never ask" is honoured.' },
        { name: 'Feature Showcase', desc: 'An interactive catalogue of everything included — 20 question types, anti-cheat tools, calculator, maths keyboard, Drive backup, certificates — so stakeholders can evaluate before registering.' },
        { name: 'Verify Certificate', desc: 'Employers and parents can verify any result certificate by its code without logging in.' }
      ],
      tips: ['Bookmark this page — all three portals are one tap from here.', 'Installing the app (banner at the bottom) gives the smoothest exam experience.']
    },
    'student.html': {
      title: '📝 Candidate Exam Portal — the proctored CBT runner',
      who: 'Candidates. Also teachers previewing their papers.',
      summary: 'Where exams actually happen: identity check, optional webcam gate, fullscreen lockdown, timer, question navigator, on-screen scientific calculator and 300+ symbol maths keyboard, then instant results.',
      sections: [
        { name: 'Access (link or code)', desc: 'Enter the link OR the 6-character code, then your Full Name and Class (Open mode) or your registered Student ID (Registered mode — the teacher\'s roster is checked before you can start).' },
        { name: 'Identity & Proctoring Gate', desc: 'If the teacher enabled proctoring: the webcam captures 3 baseline photos, then periodic snapshots; multi-face and voice activity can raise integrity flags. Photos stay in your school\'s database.' },
        { name: 'Exam Screen', desc: 'Timer top-right, question navigator grid (green = answered, amber = flagged, blue = current), Previous/Next, Flag for review. In multi-subject exams, subject tabs switch papers without losing answers. JAMB-style 8-key shortcuts work throughout: A/B/C/D pick an option, N/→ next, P/← previous, R flag, S submit.' },
        { name: '⚡ Practice Mode & 🧠 Adaptive Papers', desc: 'If your teacher set the exam to Practice mode, each answer is marked instantly — ✓/✗ with the correct answer and explanation, options lock after the reveal, and a score chip counts points and streak bonuses. Adaptive papers get easier when you struggle and harder when you cruise — they move forward only, exactly like the real computerised-adaptive tests. Approved extra time (accommodation) is applied to your clock automatically and never appears on your result slip.' },
        { name: '🧾 Result & Script Review', desc: 'The result screen shows your score, per-subject breakdown (and a UTME-style /400 aggregate on JAMB-mode papers). If you believe a question was marked wrongly, tap "Request a script review", give your reason, and your teacher will re-check the script — one pending request per exam.' },
        { name: 'On-screen Scientific Calculator', desc: 'Full Casio-style engine: trig (sin/cos/tan/sec/csc/cot + inverses), hyperbolics, logs (ln, log, log₂, logb), powers/roots, nCr/nPr, factorial, statistics (median, mode, std, variance, range), DEG/RAD, memory (MC/MR/M+/M−/MS), Ans, ↑↓ history recall, percent handling (50% = 0.5; 10 % 3 = modulo), and ⤵ Use result which types the answer straight into your answer box. Shortcut: Alt+C.' },
        { name: 'Maths & Science Keyboard', desc: '300+ searchable symbols across 20 groups — Greek (all 48 letters), calculus, sets & logic, number sets, geometry, vectors & matrices, statistics, brackets, fractions, relations, chemistry (H₂O, SO₄²⁻…), physics units, arrows, super/subscripts. Tap your answer box first, then tap a symbol. Shortcut: Alt+K.' },
        { name: 'Safety Nets During the Exam', desc: 'Answers auto-save to this device every 10 seconds; if the browser crashes, the draft is restored on return. An offline backup file can be downloaded if the network dies mid-exam.' },
        { name: 'Results Screen', desc: 'Score ring, grade, time used, integrity summary and a full question-by-question breakdown with explanations. If your paper contains essay/code/short-answer questions you will see a "🧑‍🏫 tutor review" notice — those marks are provisional until your teacher audits them. Printable/downloadable result slip and certificate.' }
      ],
      tips: ['Type into the calculator with your physical keyboard too — Enter evaluates, ↑/↓ replays past expressions.', 'Flag questions you are unsure about and return via the navigator instead of losing time.', 'Do not leave fullscreen or switch tabs — the integrity system logs it and can auto-submit.']
    },
    'teacher.html': {
      title: '👨‍🏫 Teacher Hub — build, publish, invigilate, grade, analyse',
      who: 'Teachers and exam officers.',
      summary: 'The complete assessment workbench: create exams from CSV (yours, School Connect\'s or GOSA\'s — auto-detected), manage banks, share codes, watch live submissions, audit subjective scores, and export analytics.',
      sections: [
        { name: 'Exam Builder (4 input methods)', desc: 'CSV upload (the universal bridge auto-detects HMG 17-column, School Connect/GOSA headers in any order, and headerless positional layouts from both platforms), manual typing with live previews, plus a dedicated 📖 Question Types Reference page (question-types.html) documenting all 20 types, XLSX/PDF extraction, and reuse of a previous exam\'s bank.' },
        { name: '17 Question Types', desc: 'MCQ, MRQ (multi-response with all-or-nothing marking), True/False, Short answer, Numeric (with tolerance), Matching (with distractors), Ordering, Assertion–Reason, Case Study/Comprehension, Image MCQ, Matrix/Grid, Hot Text, Code, Cloze (multi-blank), Essay (keyword + min-word provisional marking), Categorization, Multi-part Numeric.' },
        { name: 'Exam Settings', desc: 'Duration, attempt limits, passmark, negative marking, result release (instant vs held), scheduling (auto open/close), lockdown mode, calculator/keyboard availability, proctoring switches and custom instructions.' },
        { name: 'Access Codes & Sharing', desc: 'Each published exam gets a unique 6-character code + shareable link (WhatsApp-ready message). Codes can be regenerated; exams can be locked, archived or duplicated.' },
        { name: 'Students & Rosters', desc: 'Import a class list (FullName, StudentID, Class CSV) or add students manually; registered students must sign the roster to enter — stopping impersonation.' },
        { name: 'Results & Analytics', desc: 'Live submissions table with per-question item analysis, class statistics, charts, exports. Bulk select for delete/print. The 🧑‍⚖️ Review Queue badge shows how many scripts need your audit.' },
        { name: 'Manual Review Queue (Tutor Score Audit)', desc: 'Scripts containing essay / code / short-answer / case-study questions are AUTO-FLAGGED here the moment they are submitted. Open a script, read the marking scheme panel (expected keywords, minimum words, the provisional keyword score), then ✏️ Audit each open-ended question: assign 0.0–1.0, add feedback, optionally release the result. When every open-ended question is audited, the script leaves the queue automatically and the score revision is written to the audit trail.' },
        { name: 'Bank Export (both platforms)', desc: 'Export any question bank as the standard HMG CSV or as a School Connect / GOSA format CSV that imports into those platforms unchanged — and vice versa.' },
        { name: '🧠 Phase 10 — Delivery & Scoring', desc: 'When creating or editing an exam: **Adaptive difficulty** re-orders the paper live from each question\u2019s Difficulty tag (accuracy ≥70% → hard bucket, 30–69% → medium, below 30% → easy; forward-only like real CAT). **Feedback mode = Practice** reveals ✓/✗, the correct answer and your explanation after each question with points and streaks — ideal for homework. **Score model = UTME /400** gives a JAMB-style aggregate (each subject contributes up to 100).' },
        { name: '📊 Phase 10 — Psychometric Report', desc: 'Results page → 📊 Psychometric Report: ExamSoft-style statistics computed in your browser from your own submissions — exam-level KR-20 reliability, SEM, mean/median/SD, and per-question difficulty index, discrimination index (upper vs lower 27%), point-biserial, response spread and distractor quality, with automatic flags (too easy/hard, negative discrimination, dead distractors, fast answers).' },
        { name: '👁 Phase 10 — Live Invigilation & Integrity', desc: 'Results page → 👁 Live Monitor: everyone currently sitting an open exam with live progress bars, current question, violations and heartbeat freshness (auto-refresh 15s). Results page → 🛡 Integrity Signals: fast-answer anomalies, violation counts and device-switching evidence across attempts — leads to investigate, not verdicts.' },
        { name: '🧾 Phase 10 — Appeals & Accommodations', desc: 'Candidates request a script review straight from their result screen; resolve each request (grant/decline + note) in Results → 🧾 Appeals. On the Students page, every roster student has an ⏱ accommodation button — +25/50/100% extra time, applied silently on registered-mode exams per accessibility best practice (never flagged on reports).' },
        { name: '⚠️ Red "Database out of date" banner', desc: 'If the top of the Teacher Hub shows a persistent red banner, the deployed site is NEWER than your Supabase database: students get a dead-end "Exam not found or not open" error for new exams, and anti-cheat / certificate / adaptive / UTME /400 settings are silently dropped when saving. Fix in 2 minutes (safe to re-run): Supabase dashboard → SQL Editor → paste and run the ENTIRE database/complete-schema.sql → click "Re-check now" on the banner. deployment_validator.html has a live probe for the same check.' }
      ],
      tips: ['Paste a School Connect CSV as-is — the format is detected and type names (true_false, multi_select, fill_blank…) are translated automatically.', 'Use Review Queue after every exam with essays; keyword scores are only provisional.', 'Item Analysis shows which questions the class missed most — your revision plan writes itself.', 'Run the Psychometric Report after every major exam — KR-20 below 0.70 means the test itself is ranking candidates weakly, not just teaching gaps.', 'Keep Live Monitor open on a second screen during sittings — ⚠ Stale rows (no ping for 2+ minutes) are worth a hallway glance.', 'Update the DATABASE whenever you update the FILES: after deploying a new package, run database/complete-schema.sql once (it is idempotent — safe on existing data).']
    },
    'cbt-multi.html': {
      title: '🧪 Multi-Subject Builder — UTME / JAMB packages',
      who: 'Teachers preparing combined papers (e.g. 4-subject UTME mocks).',
      summary: 'Bundles several subject papers into ONE package with one code, one timer and subject tabs for the candidate.',
      sections: [
        { name: 'Combined Parameters', desc: 'Package title, target class, term, session, paper type, pass mark, total combined duration (e.g. 120 minutes across 4 subjects), attempt limit, negative marking and shared instructions.' },
        { name: '⚡ Fast Lane — one combined CSV', desc: 'The recommended path. Take the ONE file the AI Prompts Studio multi-subject pack produces (every question tagged with its subject in the Section column), paste or upload it, click 🪄 Split into subjects — the subject blocks fill themselves automatically. School Connect / GOSA Portal combined CSVs work unchanged; JSON arrays work too. The ⬇️ Sample CSV shows the exact format.' },
        { name: 'Subjects Manager', desc: 'Add each subject with its own question bank (CSV or JSON) and question count — or let the Fast Lane fill them. Files parse through the universal CSV bridge (quoted multi-line fields, any header order, type aliases). The package stores subjects separately; candidates switch tabs freely and their answers persist per subject.' },
        { name: 'Publishing', desc: 'Publishing creates one exam with a single access code — open immediately, just like Teacher Hub papers. Candidates see a tab per subject at the top of the exam; the Teacher Hub and analytics show a per-subject breakdown (e.g. English 82% · Maths 64% · Physics 71%). Phase 10 options at publish time: Feedback mode (Standard, or ⚡ Practice with instant marking) and Score model — UTME /400 (each subject contributes up to 100, exactly like the real UTME) is the recommended default here.' }
      ],
      tips: ['Set the combined duration honestly — candidates get ONE timer for all subjects.', 'Questions with no Section value land in a "General" block — tag them before publishing.', 'Subjects left empty get SAMPLE placeholder questions so you can test the flow — replace them before the real exam.']
    },
    'cbt-prompts.html': {
      title: '🤖 AI Questions Prompts Studio — 24 packs, zero API cost',
      who: 'Teachers who want large, high-quality question banks fast.',
      summary: 'Builds perfectly-structured prompts that you paste into any FREE AI chat (ChatGPT, Claude, Gemini, DeepSeek). The AI returns a strict CSV that imports straight into the Teacher Hub — validated first.',
      sections: [
        { name: 'The 24 Packs', desc: 'Simple recall → intermediate mixed → advanced HOTS → ENTERPRISE all-20-types → 🎯 Auto-Graded Ultimate Pack (every auto-marked type) → MCQ-only → multi-subject UTME (per-subject budgets + topics) → exam-board simulation (WAEC/NECO/IGCSE/SAT) → from a past paper → marking-scheme explanations → differentiated tiers → multi-line mathematics → misconception hunter → reading comprehension → proctored certification → early-years primary → physics/chemistry units → professional/clinical/legal → syllabus-to-paper → 📄 uploaded-material CBT → 🔗 linked-material CBT → 📚 reading-comprehension article link → 📚 video-comprehension link → 📝 assignment brief + rubric.' },
        { name: 'The 17-Column Contract', desc: 'Every prompt enforces the exact CSV header the platform parses (Question, A, B, C, D, CorrectAnswer, Explanation, Type, Tolerance, Unit, Accept, MRQ_AON, Pairs, Items, Difficulty, Tags, Section). The AI cannot invent its own format.' },
        { name: 'Explanation Standard', desc: 'Each generated question must carry a 4-move marking-scheme explanation: verdict in words → numbered reasoning → the misconception behind every wrong option → a takeaway. The final checklist grades the AI against it.' },
        { name: 'Validator & Loader', desc: 'Paste the AI output back; the validator checks the header, row shapes, answer keys and JSON cells, reports problems per row, previews the questions, then loads them straight into the Teacher Hub bank.' }
      ],
      tips: ['Distribution maths is exact: ask for 25 questions and every pack scales to exactly 25.', 'Multi-subject pack: fill the subjects field (e.g. "English:60,Maths:40") and it builds per-subject budgets.', 'Never accept an AI answer that ignores the checklist — regenerate.']
    },
    'question-types.html': {
      title: '📖 Question Types Guide — the complete 20-type reference',
      who: 'Teachers and content builders writing question banks.',
      summary: 'The dedicated reference for every question type the platform supports: what each CSV column means, a copy-paste example row for each type, how it is scored, and what the student actually sees. Keeps the Create Assessment page clean — the full reference lives here.',
      sections: [
        { name: 'Jump-to-a-type chips', desc: 'Tap any type id (mcq, mrq, range, hotspot…) to scroll straight to its card.' },
        { name: 'The 14-column CSV contract', desc: 'Columns 1–7 are the classic base format; columns 8–14 are optional extensions (type, tolerance, unit, accepted answers, MRQ marking mode, pairs, items JSON). Leave optional columns blank for simple MCQs.' },
        { name: 'Type cards (grouped)', desc: 'Core (mcq, tf, mrq, short, numeric, range) · Pairing & Ordering (matching, ordering, cloze, categorization, multi_numeric, matrix) · Higher-Order (assertion_reason, case_study, image_mcq, essay, code, hot_text) · Visual & Evidence (hotspot, evidence_mcq). Each card shows the exact columns, an example CSV row, the scoring rule and the student experience.' },
        { name: 'JSON escaping rule', desc: 'When Col13/Col14 contain JSON, wrap the whole cell in double quotes and double every inner double-quote. The AI Prompts Studio generates this escaping automatically.' },
        { name: 'Cross-platform compatibility', desc: 'School Connect / GOSA Portal CSVs import without editing (any column order, their headers and type names are auto-detected), and banks export back out as School Connect-compatible CSV.' }
      ],
      tips: ['Keep this page open in a second tab while you build CSVs — every example row is copy-paste ready.', 'New in this release: range (estimation), hotspot (tap-the-image) and evidence_mcq (two-part evidence) types.']
    },
    'admin.html': {
      title: '🛡️ Admin Super Panel',
      who: 'Administrators and proprietors.',
      summary: 'The platform\'s control room: usage statistics, quick links to every governance page, and the master switches.',
      sections: [
        { name: 'Dashboard', desc: 'Exams, submissions, teachers and students at a glance with trends.' },
        { name: 'Governance Shortcuts', desc: 'Direct links into Data & Sync, Disaster Recovery, Storage, Platform Health, Roles & Status, Settings, License and the Audit Log.' }
      ],
      tips: ['The first registered account automatically becomes super_admin.']
    },
    'admin-data.html': {
      title: '💾 Data & Sync — backups, Drive, restores, table browser',
      who: 'Administrators.',
      summary: 'Your data-ownership centre: full backup envelopes, Google Drive sync with history, dry-run restores, per-table archives/exports, table browser, demo seeding and migration.',
      sections: [
        { name: 'Full Envelope Export', desc: 'One JSON file containing every table — exams (with banks), rosters, results, settings, license, recent audit — with metadata and counts. Recorded in system_backups.' },
        { name: 'Google Drive Sync', desc: 'Authorize the school\'s Drive once; backups land in HMG_CBT_Backups (newest 15 kept). Backup Now, list backups, restore directly from Drive, and watch the unified backup history.' },
        { name: 'Dry-Run Restore', desc: 'Paste or load any envelope and see the exact plan — inserts, updates, skips with reasons — BEFORE anything is written. Exams upsert by code; students by (teacher, ID); results re-attach by exam code. Legacy envelopes auto-convert.' },
        { name: 'Table Browser & Batch Export', desc: 'Page through any table, expand full-row JSON, owner-only row deletion (audited, batch-capped, whitelist-checked), CSV/JSON exports per table.' },
        { name: 'Demo Data & Danger Zone', desc: 'One-click DEMO101 exam with roster and results; purge a single exam\'s submissions by code (never without one).' }
      ],
      tips: ['Download a full envelope before any big change — it is your undo button.', 'Drive auto-sync interval is set on the Settings page.']
    },
    'disaster-recovery.html': {
      title: '🚨 Disaster Recovery Console — total platform rebuild',
      who: 'Administrators recovering from a lost/inactive Supabase project.',
      summary: 'The guided 7-step recovery: connect the school\'s previous Google Drive, prepare a fresh free Supabase project, choose a backup, DRY-RUN the restore, execute with live verification, switch the platform permanently, and re-arm the 10-layer protection.',
      sections: [
        { name: 'Step 1 — Connect Previous Drive', desc: 'Authorize the SAME Google account the old platform backed up to. All HMG_CBT_Backups envelopes are listed with dates and sizes. A file fallback loads any previously downloaded envelope if Google sign-in is impossible.' },
        { name: 'Step 2 — Fresh Supabase Project', desc: 'Create the project, run database/complete-schema.sql once (idempotent), paste URL + anon key. The console TESTS the connection and verifies the schema is installed (it writes a real heartbeat as proof) before unlocking the next step.' },
        { name: 'Step 3 — Choose Backup', desc: 'Newest is preselected; inspect its contents table-by-table (exams, rosters, results, settings, license counts) before committing.' },
        { name: 'Step 4 — Dry Run', desc: 'The engine replays the backup against the new project and reports exactly what WOULD happen — every insert, update and skip with reasons. Nothing is written until you approve.' },
        { name: 'Step 5 — Execute & Verify', desc: 'Writes the approved plan, then re-counts every table in the live database and compares against the envelope. Green checks mean the rows are really there.' },
        { name: 'Step 6 — Make It Permanent', desc: 'Redeploy with the new credentials (Generator or edit app.js), re-invite staff logins (Auth users cannot migrate — the page explains the 2-minute re-invite; data re-attaches by exam code / student ID), re-link the same Drive.' },
        { name: 'Step 7 — Re-arm Protection', desc: 'New repository secrets, workflow permissions, UptimeRobot, first heartbeat + first Drive backup — so the new project never goes dark either.' },
        { name: 'Every Circumstance Covered', desc: 'Multiple backups, stale backups, half-empty new projects, exam-code collisions, interrupted restores (idempotent — just re-run), legacy envelope formats, keeping the old project — each is explained on the page.' }
      ],
      tips: ['The whole recovery takes ~15 minutes and is safe to re-run at any step.', 'Staff must sign up again after recovery — their data finds them automatically.']
    },
    'storage.html': {
      title: '📦 Storage Manager & Archive Vault',
      who: 'Administrators watching the 500 MB free-tier database cap.',
      summary: 'Real Postgres table sizes, quota dashboard, efficiency advisor, and the Archive Vault that offloads cold rows into the separate 1 GB File Storage.',
      sections: [
        { name: 'Quota Dashboard', desc: 'Actual database footprint vs the free 500 MB, row counts per table, archive count and local browser cache size.' },
        { name: 'Archive Vault', desc: 'Pick results or audit_logs and a cutoff date. The manager snapshots the old rows into the private archive-vault bucket, VERIFIES the upload, and only then unlocks purge — the purge RPC refuses to run without the archive path as proof. Restore any archive afterwards.' },
        { name: 'Efficiency Advisor', desc: 'Rule-based analysis of the live statistics: green when lean, amber/red with the exact next action.' },
        { name: 'Audit Purge & Local Optimizer', desc: 'Purge old audit events with a downloadable copy first (last 7 days always protected); clear exam draft caches from this browser.' }
      ],
      tips: ['File Storage (1 GB) is separate from the database (500 MB) — the vault exploits exactly that.', 'Archive-first purging means nothing is ever deleted without a restorable copy existing.']
    },
    'platform-health.html': {
      title: '🩺 Platform Health & Security Posture',
      who: 'Administrators; support engineers during incidents.',
      summary: 'One page that PROVES the platform is alive and safe: latency probe, 7 RPC smoke tests, heartbeat evidence, an A–F security grade and the 10-layer protection matrix.',
      sections: [
        { name: 'Latency & RPC Smokes', desc: 'Live REST round-trip time plus seven real endpoint tests — correctly-rejected anonymous probes count as PASS (your security guards are working).' },
        { name: 'Heartbeat Evidence', desc: 'Reads the live sc_heartbeat row: last ping, which layer wrote it, total pings, 7-day danger window. Write Heartbeat Now performs a verified write and shows the timestamp proof.' },
        { name: 'Security Posture Report', desc: 'Grade A–F from security-guard.js: anon-key hygiene (a service_role key in the browser is an instant F), RLS probes that must fail anonymously, HTTPS enforcement, session hygiene, lockdown/idle-lock configuration. Copy the full text report for support.' },
        { name: '10-Layer Protection Matrix', desc: 'Every anti-pause layer with live status and its setup pointer — heartbeat RPC, site-visit pings, GitHub Actions (self-committing), Vercel endpoint + cron, pg_cron, manual button, UptimeRobot, Edge function, auto-restore watchdog.' }
      ],
      tips: ['Run this page after deployment and after any Supabase project change.', 'Anything below grade B comes with the exact fix.']
    },
    'status-manager.html': {
      title: '👥 Roles & Status Manager',
      who: 'Administrators.',
      summary: 'The full user lifecycle: approval queue, roles, statuses, bulk actions, drill-downs and invites.',
      sections: [
        { name: 'Approval Queue', desc: 'Pending sign-ups with one-click Approve/Reject and Approve All. Nobody teaches or administers until approved.' },
        { name: 'Roles & Statuses', desc: 'teacher / admin / super_admin (owner-only grants, enforced server-side), active / suspended / deactivated / pending. Bulk actions run in one audited RPC; your own account is protected automatically.' },
        { name: 'Account Drill-Down', desc: 'Per user: role, status, join date, exams created, candidate submissions and their recent audit events.' },
        { name: 'Invite Flow', desc: 'Generates a ready-to-send onboarding message (sign-up link + what to expect) for WhatsApp/email.' }
      ],
      tips: ['Status changes ask for a reason — it lands in the audit trail.', 'Suspend instead of deactivate when a teacher may return.']
    },
    'settings.html': {
      title: '⚙️ Platform Settings',
      who: 'Administrators.',
      summary: 'Twelve sections of shared, server-stored configuration — every admin device sees the same settings.',
      sections: [
        { name: 'Institution Branding', desc: 'Name, tagline, colours with live preview — feeds every header, export and printout.' },
        { name: 'Assessment Defaults', desc: 'Default duration, passmark, attempts, negative marking, shuffles, result release — pre-fills every new exam.' },
        { name: 'Accessibility & Language', desc: 'Text scaling 85–140%, high contrast, reduced motion, dyslexia-friendly font, and 5 interface languages (EN/FR/YO/IG/HA). Platform-wide defaults plus per-device overrides.' },
        { name: 'Security & Session', desc: 'Idle auto sign-out minutes, audit retention days, and emergency Lockdown Mode with a custom notice (admins keep access to lift it).' },
        { name: 'Module Access Matrix', desc: 'Which pages appear in the navigation per role. (Links hidden — real security remains row-level on the server.)' },
        { name: 'Official Signature & Watermark', desc: 'Draw the proprietor\'s signature once on a canvas (stored as data-URI) for certificates; set the exam watermark text.' },
        { name: 'Drive & Supabase', desc: 'Google Drive Client ID + interval + Authorize/Test/Backup Now; live Supabase connection test with latency and a forced verified heartbeat.' }
      ],
      tips: ['Settings save to the platform_settings table — one save, every device.', 'Lockdown Mode is the emergency brake for exam-week incidents.']
    },
    'license.html': {
      title: '📜 Site License — dual engine',
      who: 'Proprietors / license holders.',
      summary: 'Two complementary engines: an offline HMAC-SHA256 perpetual certificate, and a full subscription lifecycle with states, registry and tamper evidence.',
      sections: [
        { name: 'Subscription Engine', desc: 'lifetime / active / warning (≤30 days) / grace (expired + grace days) / expired / suspended. Sources: remote registry JSON → site_license table (public read so the lock renders pre-login) → baked config. Rows carry SHA-256 signatures; hand-edits are flagged.' },
        { name: 'Proprietor Console', desc: 'Edit model/cycle/dates/grace/status, custom lock message, quick-extend +30/+90/+365 days (owner-only, audited), and a lock-screen test.' },
        { name: 'Offline Perpetual Token', desc: 'The v3 HMAC certificate: institution, plan, issue/expiry, candidate limit — verifiable with zero network, savable to the license row, printable.' },
        { name: 'Honest Note', desc: 'Code on client-controlled hosting can never be 100% tamper-proof. These layers make bypass non-trivial and keep the authoritative status in the proprietor\'s hands (optional registry).' }
      ],
      tips: ['Grace days keep the school running over a payment weekend.', 'The lock screen never interrupts an in-progress exam.', 'Locked out? This console and the Admin sign-in stay reachable on purpose — renew from inside, any time.', 'An expired platform is never allowed to go silent: the heartbeat keeps the Supabase database warm so renewal is instant.']
    },
    'activity_log.html': {
      title: '📊 Audit & Activity Log',
      who: 'Administrators, auditors, investigators.',
      summary: 'The searchable, measurable trail of every privileged action on the platform.',
      sections: [
        { name: 'Server-Side Filtering', desc: 'Action contains, actor contains, date range, page size — all executed inside the indexed admin_get_audit_logs RPC.' },
        { name: 'Statistics & Chart', desc: 'Totals, 24 h and 7-day counts, unique actors, a 30-day bar chart and the top-15 action chips.' },
        { name: 'Live Tail & Export', desc: '20-second auto-refresh option, per-event metadata drill-down, CSV export, and owner-only retention purge (with a downloadable copy of the purged rows first).' }
      ],
      tips: ['Everything privileged writes here: approvals, role changes, purges, archives, restores, settings edits, license changes, heartbeats, score audits.']
    },
    'certificate.html': {
      title: '🏅 Certificate Verification',
      who: 'Employers, parents, other schools — no login needed.',
      summary: 'Enter a certificate code; the platform verifies it against the live results and renders the certificate with its QR link.',
      sections: [
        { name: 'Code Verification', desc: '8–10 character codes printed on certificates resolve to the student, exam, score and issue date — or an honest "not found".' },
        { name: 'Printable Certificate', desc: 'Verified certificates render with the school branding and the proprietor\'s signature from Settings.' }
      ],
      tips: ['Held results do not issue certificates until released by the teacher.']
    },
    'link_checker.html': {
      title: '🔗 Link Checker',
      who: 'Support / QA.',
      summary: 'Verifies that every page and asset of the deployment is reachable and healthy.',
      sections: [
        { name: 'Deployment Scan', desc: 'Walks every page and static asset, reporting HTTP status, missing files and broken references.' }
      ]
    },
    'feature_guide.html': {
      title: '📚 Feature Guide',
      who: 'Everyone evaluating the platform.',
      summary: 'The plain-language catalogue of every feature — question types, proctoring, backup, licensing, protection layers — with what each one is for.',
      sections: [
        { name: 'Feature Tiles', desc: 'Each feature explained on one card: what it does, who it is for, and which page it lives on.' }
      ]
    },
    'offline.html': {
      title: '📴 Offline Page',
      who: 'Candidates who lose the network mid-exam.',
      summary: 'Shown by the service worker when the app cannot reach the network — explains that answers were saved locally and how to return.',
      sections: [
        { name: 'Recovery Instructions', desc: 'Answers are in this device\'s storage; reconnect (or reopen) and the draft restore brings you back to the exact question.' }
      ]
    },
    'client-monitor.html': {
      title: '📡 Client Monitor — builder-side subscription registry',
      who: 'The platform owner / builder (HMG) — admin accounts only.',
      summary: 'Register every client deployment you deliver and watch their live subscription status in one table — the builder-side control room for subscription business models.',
      sections: [
        { name: 'Client Registry', desc: 'Register each delivered platform: name, slug, deploy URL, and the client\'s Supabase URL + anon key. The key only ever reads the client\'s PUBLIC site_license row (public by design so lock screens render pre-login) — no secrets, no writes to client data.' },
        { name: 'Live Status Board', desc: 'Check Now polls every client\'s actual license row and shows the truth: 🟢 active / lifetime · 🟡 warning (days left) · 🟠 grace (days left) · 🔴 expired (days over) · ⏸ suspended · ❌ unreachable (possibly paused — with the restore guide). Ages show how fresh each reading is.' },
        { name: 'Override / Bypass Generator', desc: 'One click builds the exact license-registry JSON snippet for a client — extend the expiry, flip status back to active, or convert to lifetime (courtesy/permanent access). Paste it into the registry file you host; the client platform checks it and the registry always wins over local values.' },
        { name: 'Why clients never go dark', desc: 'Expired platforms keep their heartbeat running (site-visit pings + scheduled workflows), so Supabase never pauses them for inactivity — renewal is always a single action away, with zero rebuild or data loss.' }
      ],
      tips: ['Run Check Now before every renewal conversation — quote the client their exact state and days.', 'Unreachable ≠ expired: it usually means the client\'s Supabase project is paused — restore it first, then re-check.', 'Every registry change is audit-logged server-side.']
    },
    'deployment_validator.html': {
      title: '✅ Deployment Validator',
      who: 'Whoever deploys or updates the platform.',
      summary: 'A live self-test of the deployment: required files, key behaviours, PWA assets, integration points — and a live DATABASE schema probe that catches "site newer than database" before students do.',
      sections: [
        { name: 'Checks', desc: 'Every required file (including workflows, Edge function and docs), plus live functional probes with pass/warn/fail rows and a final score.' },
        { name: 'Live database probe (Phase 10B)', desc: 'Reads your Supabase config from teacher.html and checks the real database for the status-probe RPC and the Phase 10 columns. A red ❌ here is the exact condition behind "students see Exam not found or not open for NEW exams while old ones still work" — fix it by running database/complete-schema.sql in the Supabase SQL Editor.' }
      ],
      tips: ['Run it once after every deployment or update.', 'Always resolve a ❌ "Database schema up to date" row before sharing new exam links — it takes one SQL paste.']
    }
  },

  /* ── getting-started paths by role ── */
  firstSteps: [
    { role: '🎓 Candidate (first exam)', steps: [
      'Open the link your teacher sent, or the platform home page → enter the 6-character code.',
      'Type your name and class exactly as your school records them (or your Student ID for registered exams).',
      'Allow the camera if your school enabled proctoring — the gate explains each step.',
      'Stay in fullscreen; use the calculator (Alt+C) and maths keyboard (Alt+K) when allowed.',
      'Flag hard questions, revisit them via the navigator grid, submit, then read every explanation on the results screen.'
    ]},
    { role: '👨‍🏫 Teacher (first exam)', steps: [
      'Sign up, wait for admin approval (or use AI Prompts → build a prompt → generate your bank in a free AI chat).',
      'Teacher Hub → Create Assessment → CSV Upload → paste or drop your CSV (School Connect / GOSA CSVs work unchanged).',
      'Set duration, attempts, passmark, release mode and anti-cheat switches.',
      'Publish → copy the WhatsApp message with the code + link.',
      'After submissions: check the 🧑‍⚖️ Review Queue for essays, open scripts and audit open-ended answers; then export analytics.'
    ]},
    { role: '🛡️ Administrator (first setup)', steps: [
      'Run database/complete-schema.sql once in the Supabase SQL editor (already done if deployed from the ZIP).',
      'First registered account becomes super_admin — sign up first.',
      'Settings: branding, defaults, accessibility, security, module matrix, signature.',
      'Roles & Status: approve staff as they register.',
      'Admin Data: authorize Google Drive → Backup Now → enable auto-sync.',
      'Platform Health: write a heartbeat, confirm grade A/B, then follow SUPABASE_FREE_TIER_PROTECTION.md (7 minutes).'
    ]},
    { role: '⚙️ Platform owner (new client school)', steps: [
      'Create the client\'s free Supabase project; run the schema SQL; copy URL + anon key.',
      'Open the Generator → 4 steps → download the verified branded ZIP.',
      'Deploy the ZIP (Vercel or GitHub Pages — START-HERE.md in the ZIP has the clicks).',
      'Re-arm the protection secrets for the client repo; set their license on the License page.'
    ]}
  ],

  glossary: [
    ['Access code', 'The 6-character code that opens one exam. Candidates type it (or use the link) on the home page.'],
    ['Answer key', 'The CorrectAnswer column — A/B/C/D for choice questions, the exact value for numeric, keywords for essays, JSON for matching/ordering.'],
    ['Archive Vault', 'Private Supabase File Storage bucket where old database rows are snapshotted as JSON before purging — purge is impossible without the archive proof.'],
    ['Audit log', 'The append-only trail of every privileged action (who, what, when, metadata).'],
    ['Backup envelope', 'One JSON file containing every table of the platform — the unit of backup, Drive sync and disaster recovery.'],
    ['CBT', 'Computer-Based Testing — exams taken on a device instead of paper.'],
    ['Dry run', 'A restore rehearsal that computes and shows the full plan without writing anything.'],
    ['Envelope format (v10/v11)', 'Versioned JSON structure of backup envelopes; legacy formats auto-convert on restore.'],
    ['Free-tier pause', 'Supabase pauses free projects after 7 days without database activity — the 10-layer protection exists to prevent exactly this.'],
    ['Heartbeat', 'A verified database write that resets Supabase\'s 7-day inactivity clock. The timestamp proof is checked, not just HTTP 200.'],
    ['Lockdown Mode', 'Emergency platform-wide lock for non-admins with a custom notice, set on the Settings page.'],
    ['Manual review / tutor audit', 'The teacher\'s score override for open-ended questions (essay, code, short answer, case study) with feedback.'],
    ['MRQ AON', 'All-or-nothing marking for multi-response questions: every box must be right for the mark.'],
    ['PWA', 'Progressive Web App — a website that installs on the device and runs full-screen like a native app.'],
    ['Registry (license)', 'Optional remote JSON the proprietor hosts; when reachable it is the authoritative license state.'],
    ['RLS', 'Row-Level Security — Postgres rules that decide, per request, which rows a role may read or write. Enforced server-side.'],
    ['Subject breakdown', 'Per-subject scores inside a multi-subject exam (e.g. English 82% · Maths 64%).'],
    ['Tolerance', '± acceptance for numeric answers (answer 9.8 ± 0.2 accepts 9.6–10.0).']
  ],

  faq: [
    ['Is any of this paid?', 'No. Hosting (Vercel/GitHub Pages), database (Supabase free tier), backups (school\'s own Google Drive), AI question generation (free AI chats with our prompts) and every protection layer are free.'],
    ['What happens if Supabase pauses the project?', 'The 10-layer protection makes it very unlikely (verified heartbeats, twice-weekly GitHub Actions, daily watchdogs, UptimeRobot). If it still happens, the auto-restore workflow unpauses it via the Management API — and if the project is ever LOST, the Disaster Recovery console rebuilds everything from Drive.'],
    ['Can students cheat with the calculator or keyboard?', 'They are exam tools: the anti-cheat system explicitly allows them, while tab-switching, copy/paste, right-click, devtools and fullscreen exits are logged and can auto-submit.'],
    ['Do School Connect / GOSA CSVs really import unchanged?', 'Yes — headers in any order, their aliases, their type names, their headerless layouts. Exports also come in their format from the Teacher Hub bank.'],
    ['How are essays marked without an AI API?', 'Provisionally: keyword coverage + minimum word count. The script is then auto-flagged in the teacher\'s Review Queue for a professional audit with the marking scheme shown.'],
    ['Can I move everything to a new Supabase project later?', 'Yes — Disaster Recovery console: 7 guided steps with dry-run, live verification and the protection re-arm checklist.']
  ],

  getCurrentPageHelp() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    return this.pages[page] || this.pages['index.html'];
  },

  renderPageGuideBanner() {
    const guide = this.getCurrentPageHelp();
    const existing = document.getElementById('cbt-page-guide-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'cbt-page-guide-banner';
    banner.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px 22px;margin-bottom:20px;box-shadow:var(--shadow);';
    banner.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:280px;">
          <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:2px;">${guide.title}</div>
          <div style="font-size:11.5px;font-weight:700;color:var(--primary);margin-bottom:6px;">WHO IT'S FOR: ${guide.who || 'All users'}</div>
          <p style="margin:0 0 10px;font-size:13px;color:var(--text-muted);">${guide.summary}</p>
          <div style="display:grid;gap:8px;font-size:12px;">
            ${(guide.sections || []).map(s => `<div style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;"><strong style="color:var(--primary);">${s.name}:</strong> <span style="color:var(--text-muted);">${s.desc}</span></div>`).join('')}
          </div>
          ${(guide.tips && guide.tips.length) ? `<div style="margin-top:10px;font-size:12px;color:var(--warning);"><b>Tips:</b> ${guide.tips.join(' · ')}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-self:flex-start;">
          <button class="btn btn-sm btn-primary" onclick="SiteHelp.openHelpCenter()" style="white-space:nowrap;">📘 Help Center</button>
          <button class="btn btn-sm btn-outline" onclick="this.closest('#cbt-page-guide-banner').remove()" style="white-space:nowrap;">✕ Hide guide</button>
        </div>
      </div>
    `;
    const mainWrap = document.querySelector('.main-wrap');
    if (mainWrap) mainWrap.insertBefore(banner, mainWrap.firstChild);
  },

  /* ── Help Center modal: first steps, glossary, FAQ, every page index ── */
  openHelpCenter(tab) {
    let m = document.getElementById('site-help-center');
    if (m) m.remove();
    m = document.createElement('div');
    m.id = 'site-help-center';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);z-index:2147482100;display:flex;align-items:center;justify-content:center;padding:18px;font-family:inherit;';
    const cur = this.getCurrentPageHelp();
    const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    m.innerHTML = `<div style="max-width:860px;width:100%;max-height:88vh;overflow:auto;background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.5);">
      <div style="position:sticky;top:0;background:var(--surface-2);border-bottom:1px solid var(--border);padding:16px 20px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <b style="font-size:16px;">📘 Help Center — every page, every concept</b>
        <button class="btn btn-sm btn-danger" onclick="document.getElementById('site-help-center').remove()">✕ Close</button>
      </div>
      <div style="padding:20px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
          ${['Getting started', 'Every page', 'Glossary', 'FAQ'].map((t, i) => `<button class="btn btn-sm ${i === 0 ? 'btn-primary' : 'btn-outline'}" onclick="SiteHelp._hcTab(this,'${t}')">${t}</button>`).join('')}
        </div>
        <div id="hc-body"></div>
      </div>
    </div>`;
    document.body.appendChild(m);
    this._renderHCTab(tab || 'Getting started');
  },
  _hcTab(btn, name) {
    btn.parentElement.querySelectorAll('button').forEach(b => { b.className = 'btn btn-sm btn-outline'; });
    btn.className = 'btn btn-sm btn-primary';
    this._renderHCTab(name);
  },
  _renderHCTab(name) {
    const body = document.getElementById('hc-body');
    if (!body) return;
    const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (name === 'Getting started') {
      body.innerHTML = this.firstSteps.map(p => `
        <div style="border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">
          <b style="color:var(--primary);font-size:14px;">${esc(p.role)}</b>
          <ol style="margin:10px 0 0;padding-left:22px;font-size:13px;color:var(--text-muted);line-height:1.9;">${p.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        </div>`).join('');
    } else if (name === 'Every page') {
      body.innerHTML = Object.values(this.pages).map(p => `
        <details style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px;">
          <summary style="cursor:pointer;font-weight:800;font-size:13.5px;">${p.title}</summary>
          <p style="font-size:12.5px;color:var(--text-muted);margin:8px 0;">${esc(p.summary)}</p>
          ${(p.sections || []).map(s => `<div style="font-size:12.5px;margin-bottom:6px;"><b style="color:var(--primary);">${esc(s.name)}:</b> <span style="color:var(--text-muted);">${esc(s.desc)}</span></div>`).join('')}
        </details>`).join('');
    } else if (name === 'Glossary') {
      body.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12.5px;">` +
        this.glossary.map(g => `<tr style="border-bottom:1px solid var(--border);"><td style="padding:8px 10px;font-weight:800;white-space:nowrap;vertical-align:top;color:var(--primary);">${esc(g[0])}</td><td style="padding:8px 10px;color:var(--text-muted);">${esc(g[1])}</td></tr>`).join('') + `</table>`;
    } else if (name === 'FAQ') {
      body.innerHTML = this.faq.map(f => `
        <details style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px;">
          <summary style="cursor:pointer;font-weight:800;font-size:13.5px;">${esc(f[0])}</summary>
          <p style="font-size:12.5px;color:var(--text-muted);margin:8px 0 0;line-height:1.7;">${esc(f[1])}</p>
        </details>`).join('');
    }
  }
};

window.SiteHelp = SiteHelp;
