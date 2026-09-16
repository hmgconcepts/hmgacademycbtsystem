# 🚀 HMG Academy CBT Pro v4.1 — Complete Deployment Guide

This guide explains how to deploy the CBT system using free or free-tier tools. It assumes no paid AI API and no paid server.

---

## 1. What you need

| Requirement | Recommended free tool |
|---|---|
| Static hosting | GitHub Pages, Netlify, Vercel, or Cloudflare Pages |
| Database | Supabase Postgres free tier |
| Authentication | Supabase Auth free tier |
| Browser | Chrome/Edge/Firefox/Safari latest |
| Code editor | VS Code, Notepad++, or any text editor |

---

## 2. Files to upload

Upload every file in the project root except `.git`:

```text
index.html
teacher.html
student.html
admin.html
link_checker.html
deployment_validator.html
feature_guide.html
offline.html
sw.js
manifest.webmanifest
hmg-icon.svg
hmg-academy-logo.png
assets/hmg-academy-logo.png
database/complete-schema.sql
README.md
DEPLOYMENT.md
DEPLOYMENT_GUIDE.md
FEATURES.md
FEATURES_GUIDE.md
SECURITY.md
CHANGELOG.md
CONTRIBUTING.md
PROMPT_TEMPLATE.md
DIAGNOSIS_REPORT.md
EXPERT_ENHANCEMENT_REPORT.md
database/further_maths_sample.csv
_headers
.nojekyll
LICENSE
```

---

## 3. Step-by-step Supabase setup

### Step 3.1 — Create the project

1. Go to https://supabase.com.
2. Sign in or create a free account.
3. Click **New Project**.
4. Enter project name, password, and region.
5. Wait for the project to finish provisioning.

### Step 3.2 — Copy API values

Open **Project Settings → API** and copy:

- Project URL, e.g. `https://xxxxx.supabase.co`
- `anon` public key

### Step 3.3 — Update frontend config

Open these files and replace the constants:

```js
const SB_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SB_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

Files:

- `teacher.html`
- `student.html`
- `admin.html`
- `link_checker.html`

Also update admin email in:

```js
const ADMIN_EMAIL = 'buildingmyictcareer@gmail.com';
```

Files:

- `teacher.html`
- `admin.html`

Use your real production admin email if different.

---

## 4. Run the database SQL

1. Open **`database/complete-schema.sql`** (in the `database/` folder of this package).
2. Copy the entire file.
3. Go to Supabase **SQL Editor**.
4. Create a new query.
5. Paste the SQL.
6. Click **Run** — **once**. That single file is all-inclusive: 10 tables, 41+ RPC
   functions, full Row-Level Security, indexes, triggers, the private
   `archive-vault` storage bucket, the keep-alive heartbeat system and starter
   seed rows. **No other SQL is needed after it.**

It is also **idempotent** — every table is `CREATE TABLE IF NOT EXISTS`, every
function `CREATE OR REPLACE`, every policy `DROP POLICY IF EXISTS → CREATE`,
every seed `ON CONFLICT DO NOTHING` — so re-running it (for example when
upgrading the platform) never drops or loses data.

The other files in `database/` (`keep-alive.sql`, `security-hardening.sql`,
`drive-sync.sql`, `storage-offload.sql`, `demo-seed.sql`, `demo-users.sql`)
are optional maintenance extracts of subsystems already inside the master file —
see `database/README.md`. The CSVs there (`sample-question-bank.csv`,
`students_import_template.csv`, `further_maths_sample.csv`) are sample data for
the Teacher Hub importers.

### Expected verification output

At the end, Supabase should show:

- **10 public tables** with `rowsecurity = true`
  (`institutions`, `profiles`, `exams`, `results`, `students`, `audit_logs`,
  `system_backups`, `sc_heartbeat`, `site_license`, `platform_settings`)
- RPC functions including:
  - `get_public_exam_by_code`
  - `verify_student_for_exam`
  - `get_exam_attempt_count`
  - `submit_student_result`
  - `admin_get_all_profiles`
  - `admin_get_all_exams`
  - `admin_get_all_results`
  - `is_platform_admin`
  - `sc_keep_alive`
- the seed rows (default institution, heartbeat, site license, platform settings)

Confirm with the post-install checks in `database/README.md`.

---

## 5. Supabase Auth settings

### For demos and school labs

1. Go to **Authentication → Providers → Email**.
2. Turn **Confirm email** OFF.
3. Save.

This lets teachers sign up and be approved quickly.

### For production

Keep email confirmation ON if your school wants stronger identity assurance. If you keep it ON, teachers must click the Supabase email link before they can login.

### Redirect URLs

Go to **Authentication → URL Configuration** and add your deployment domain, for example:

```text
https://hmgacademyhub.github.io/cbt-system/
https://hmgacademyhub.github.io/cbt-system/teacher.html
https://hmgacademyhub.github.io/cbt-system/admin.html
```

Add Netlify/Vercel/Cloudflare URLs too if you use them.

---

## 6. GitHub Pages deployment

1. Create or open your GitHub repository.
2. Upload all files into the repository root.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Save.
6. Wait 1–5 minutes.
7. Visit the generated URL.

If your project is under a repository path such as `/cbt-system/`, relative links already work because the files use relative paths.

---

## 7. Netlify deployment

1. Go to https://netlify.com.
2. Click **Add new site**.
3. Choose **Deploy manually** or connect GitHub.
4. Drag the project folder or connect the repo.
5. Build command: leave empty.
6. Publish directory: project root.
7. Deploy.

Optional: add the `_headers` file for security headers. Netlify reads it automatically.

---

## 8. Vercel deployment

1. Go to https://vercel.com.
2. Import the repository.
3. Framework preset: **Other**.
4. Build command: blank.
5. Output directory: blank/root.
6. Deploy.

---

## 9. Cloudflare Pages deployment

1. Go to Cloudflare Dashboard → Pages.
2. Connect your GitHub repository.
3. Framework preset: None.
4. Build command: blank.
5. Build output directory: `/`.
6. Deploy.

---

## 10. Post-deployment test plan

Run this test before sharing with real students.

### Teacher flow

1. Open `teacher.html`.
2. Sign up as a teacher.
3. Open `admin.html` with the admin account.
4. Approve the teacher.
5. Login again as teacher.
6. Create an exam with 3–5 questions.
7. Copy the exam link/code.

### Student flow

1. Open `student.html?code=XXXXXX`.
2. Enter student name/class or verify student ID if registered mode.
3. Answer the exam.
4. Submit.
5. Confirm result is saved.

### Teacher result flow

1. Return to `teacher.html`.
2. Open Results.
3. Confirm the student submission appears.
4. Open answer breakdown.
5. Export results CSV.

### Admin flow

1. Open `admin.html`.
2. Confirm teachers, exams, and results appear.
3. Run security checks.
4. Export platform CSV.

---

## 11. Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Teacher cannot login | Wrong Supabase URL/key or email not confirmed | Check `SB_URL`, `SB_KEY`, Auth email confirmation setting. |
| Teacher sees “pending approval” | Admin has not approved teacher | Login as admin and approve. |
| Student code says exam not found | Exam closed, archived, expired, wrong code, or SQL not run | Re-open exam, check code, run `database/complete-schema.sql`. |
| Registered student cannot verify ID | Roster not uploaded or RPC missing | Upload roster and re-run SQL. |
| Attempt limit not enforced | Attempt-count RPC missing | Re-run SQL and verify `get_exam_attempt_count`. |
| Results do not save | RLS/policy missing or exam closed | Re-run SQL and ensure exam is open/not expired. |
| Admin sees no data | Admin RPC not created or admin profile inactive | Re-run SQL, set `profiles.is_admin=true`, `status='active'`. |
| Charts not visible offline | Chart.js CDN unavailable | Exports still work; reconnect internet for charts. |
| Camera/proctoring blocked | Browser permission/HTTPS issue | Use HTTPS and allow camera/microphone. |
| PWA not updating | Old service worker cache | Hard refresh or clear site data; v3.1 uses `hmg-cbt-shell-v7`. |

---

## 11.5 Running 1,000 students at once — capacity plan

The platform is engineered for a full hall (or several halls) sitting the same
exam simultaneously. Here is exactly what protects the run, and what you should
do operationally:

**What the platform already does (no setup needed)**

| Protection | Where | What it does |
|---|---|---|
| Jittered submission spread | `student.html` | Every submission waits a random 0–2 s first, so 1,000 timers expiring together do not hit the database in the same second. |
| 5-attempt retry with exponential backoff | `student.html` | Failed submissions retry with 0.8 s → 1.6 s → 3.2 s → 6.4 s → 12 s caps (plus random jitter), absorbing transient errors and rate limits. |
| Multi-tier payload fallback | `student.html` | If the full payload is rejected, it retries without proctor data, then without violations, then minimal core columns — a result is never lost to a schema mismatch. |
| Offline queue + auto-flush | `student.html` | If the network drops completely, the finished submission is queued in the browser and uploads automatically on reconnect (and on next app load) with the same jittered backoff. |
| Attempt verification before exam | `student.html` | `verify_student_for_exam` + `get_exam_attempt_count` run once per student before question data loads, preventing duplicate result rows under double-clicks/refreshes. |
| `Prefer: return=minimal` | `student.html` | Inserts return no row body — smaller responses, less bandwidth per student. |
| Database indexes | `database/complete-schema.sql` | `idx_exams_code` (exam-code lookup), `idx_results_exam_id` (result aggregation), `idx_results_created_at DESC` and friends keep teacher/admin queries fast as `results` grows into the hundreds of thousands. |
| SECURITY DEFINER RPCs | `database/complete-schema.sql` | Submissions go through `submit_student_result`, one atomic call instead of multiple client-side requests. |

**Operational checklist for a big sitting**

1. **Stagger start times** by class/row where possible (even 2–3 minutes apart)
   — the platform already jitters, but staggering removes the burst entirely.
2. **Keep the exam open** (not locked) and verify the code works from one student
   device on the venue network *before* the hall fills.
3. **Have the JSON offline backup**: each student result screen offers a local
   backup download even when everything else fails — collect those files only in
   the (unlikely) event the queue could not flush.
4. **After the sitting**: Teacher Hub → Results refreshes live; large halls may
   take a few seconds to aggregate. Export CSV for records.
5. **Capacity notes (Supabase free tier)**: the free tier comfortably serves
   1,000 simultaneous exam takers on a static front-end (Vercel/Netlify) +
   Supabase connection pooling. Watch the bandwidth line in the Supabase
   dashboard during the sitting; if you regularly run halls of 1,000+, consider
   the Pro tier for headroom and 5-minute PITR backups.

---

## 12. Production checklist

- [ ] `SB_URL` and `SB_KEY` updated in all required files.
- [ ] `ADMIN_EMAIL` updated.
- [ ] `database/complete-schema.sql` run successfully.
- [ ] Admin profile active and admin-enabled.
- [ ] RLS enabled on all tables.
- [ ] No `service_role` key in frontend.
- [ ] HTTPS deployment active.
- [ ] Teacher signup tested.
- [ ] Admin approval tested.
- [ ] Exam creation tested.
- [ ] Student submission tested.
- [ ] Teacher results tested.
- [ ] `deployment_validator.html` opened — **"Database schema up to date (live probe)" shows ✅** (this catches "site newer than database", the cause of students seeing "Exam not found or not open" for NEW exams while old ones work — see PHASE10B_EXAM_REACHABILITY_HOTFIX.md).

## 12.1 — Updating an EXISTING deployment (standing rule)

**Whenever you deploy new site files, run `database/complete-schema.sql` once
against the live database in the same maintenance window** (Supabase → SQL
Editor → paste the entire file → Run). It is idempotent and drift-hardened —
safe on databases with existing exams and results. Then open
`deployment_validator.html` and confirm the live database probe is ✅ before
sharing new exam links. If the Teacher Hub ever shows the red **"Platform
database is out of date"** banner, that is this exact rule not yet applied —
run the SQL and click *Re-check now*.
- [ ] Admin exports tested.
- [ ] Backup/export tested.
- [ ] Deployment validator passes.

---

## 13. Updating an existing deployment

1. Backup current repository files.
2. Backup Supabase data:
   - export exams/results from teacher/admin dashboards;
   - optionally use Supabase table export.
3. Upload v3.1 files.
4. Run the full `database/complete-schema.sql` again.
5. Hard refresh browser cache.
6. Re-test one full exam flow.

The SQL is designed to be idempotent and preserves data.

---

## 14. No paid AI API policy

The platform deliberately avoids AI API calls because paid APIs are not cost-effective for many schools. Essay scoring and insights are transparent rule-based logic in the browser. Teachers should still review high-stakes essays manually.


## CBT v3 note

Before deployment, run `database/complete-schema.sql`, then upload all static files. CBT v3 includes a rewritten `PROMPT_TEMPLATE.md` for manual AI-assisted CSV question generation, the dedicated question-types.html reference for all 20 question types, and a downloadable CSV template with all 20 type examples. No runtime AI API is used.
## Search engine and PWA deployment checks

After deployment, verify `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, and `/sw.js` load publicly. Submit the sitemap URL to Google Search Console and Bing Webmaster Tools. Test PWA installation on Android Chrome, iPhone Safari, and desktop Chrome/Edge.
## Repair deployment note

After uploading this repair package and redeploying to Vercel, hard-refresh the browser or clear site data so the old service worker/browser cache does not keep the broken `teacher.html`. Then test all Teacher Dashboard sidebar menus.
## CBT v4 deployment note

After deployment, hard-refresh or clear browser site data because the service worker cache name changed. Test install prompt, student navigator hide/show, teacher result/certificate printing and sitemap/PWA files.
## CBT v5 deployment check

After redeployment, open Teacher Dashboard → Create Exam and confirm the Exam Type dropdown contains Admission Screening, Scholarship Test, Common Entrance, Recruitment / Aptitude Test, Certification Exam, STEM Exam, UTME/JAMB Practice and WAEC/NECO/BECE Practice.
## CBT v6 SQL deployment warning

If Supabase previously failed at `admin_get_platform_stats()` with a mismatched-parentheses error near `pass_rate`, use the repaired `database/complete-schema.sql` in this package and run it from top to bottom. The full SQL has been parsed after the repair.
## CBT v7 deployment check

After redeployment, test with an already-created exam. Confirm the Math/Science keyboard appears during the exam and that `Export Result PDF` and `Save Result + Questions` produce readable white-background output. Clear PWA cache if old dark print styling remains.



---

## 15. Phase 2 (v4.0) — new subsystems setup

The v4.0 platform adds a Settings Console, Storage Manager with an Archive Vault, a dual-engine Site License, the full Prompt Studio, security posture auditing and the complete 10-layer free-tier protection. Everything is installed by the SAME single run of `database/complete-schema.sql` (Section 4) — it now creates 10 tables, 41 RPCs, the private `archive-vault` storage bucket and the pg_cron heartbeat automatically, and it is safe to re-run on an existing v3 database (missing columns are added in place; no data is ever dropped).

### 15.1 Free-tier protection (strongly recommended, ~7 minutes once)

Follow **SUPABASE_FREE_TIER_PROTECTION.md** shipped in this folder. Minimum recommended setup:
1. Add repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (repo Settings → Secrets and variables → Actions).
2. Repo Settings → Actions → General → Workflow permissions → **Read and write permissions** (enables the self-committing heartbeat).
3. Actions tab → run **Supabase Free-Tier Heartbeat & Anti-Pause** once manually; expect `✅ heartbeat written AND verified`.
4. Optional: `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` secrets activate the daily **auto-restore watchdog**; UptimeRobot on `/api/keepalive` adds an independent forever-pinger.

### 15.2 Google Drive backup (optional, ~10 minutes once)

1. console.cloud.google.com → APIs & Services → Credentials → **Create OAuth Client ID** (Web application).
2. Add your deployed URL(s) to **Authorized JavaScript origins**.
3. Copy the Client ID → platform **Settings → Google Drive Cloud Sync** → paste → **Authorize Drive** → sign in with the school's Google account → **Test Connection**.
4. Click **Backup Now** once, then enable auto-sync (interval in days). Backups land in the school's own Drive folder `HMG_CBT_Backups` (newest 15 kept).

### 15.3 After first login

- The FIRST registered account is automatically the super_admin (unchanged).
- Admin Data → **Seed Demo Data** puts a DEMO101 exam on every screen (delete freely).
- License page → set the client's license model (lifetime or subscription) if it was not baked by the Generator.
- Settings → Security → configure idle sign-out and (if ever needed) Lockdown Mode.

### 15.4 Deploying the GENERATOR package

The **CBT System Generator** is a separate product (live at https://cbtgen.vercel.app) and is **not part of this deployment** — this package contains the exam platform only. If you need to build branded CBT deployments for client schools, deploy the generator product separately and follow its own README.


---

## 16. Phase 3 (v4.1) — new subsystems

**Upgrading an existing v3/v4.0 deployment?** Replace the files and re-run `database/complete-schema.sql` once — it adds the manual-review columns (`needs_review`, `reviewed_by`, `reviewed_at`) in place; no data is touched.

### 16.1 New page — Disaster Recovery console (`disaster-recovery.html`)

Linked in the admin navigation as **🚨 Recovery**. Use it whenever a Supabase project is lost/paused beyond rescue and Google Drive backups exist: 7 self-verifying steps (Drive → fresh project → backup → dry-run → verified restore → permanent switch → protection re-arm). Full Google Drive setup and troubleshooting: **GOOGLE_DRIVE_BACKUP.md**.

### 16.2 CSV compatibility (no setup needed)

Upload any question CSV — HMG 17-column, School Connect, or GOSA Portal format; the importer auto-detects. To move a bank the other way: Teacher Hub → Bank → **🔀 Export School Connect CSV**.

### 16.3 Tutor review workflow (no setup needed)

Scripts with essay / code / short-answer / case-study questions are auto-flagged into the Teacher Hub **🧑‍⚖️ Review Queue**. Audit them with the marking-scheme panel; scores revise and audit-log automatically.

## 6. Make the platform searchable (Google, Bing, Yahoo)

The package ships with production-grade SEO: a `sitemap.xml`, a `robots.txt`,
canonical URLs, Open Graph / Twitter social-share tags and JSON-LD structured
data on every public page.

1. **If you entered a Deployment URL in the generator** — everything already
   points at your live address. Nothing to change.
2. **If you left it blank** — after deploying, open `robots.txt` and
   `sitemap.xml` and replace `https://YOUR-DEPLOYMENT-URL` with your live
   address (e.g. `https://my-school.vercel.app`). The HTML pages use
   domain-agnostic relative URLs, so they need no edits on any domain.
3. **Claim and submit** (free, ~10 minutes, one-time):
   - Google: [Search Console](https://search.google.com/search-console) →
     add property → submit `sitemap.xml`.
   - Bing **and** Yahoo: [Bing Webmaster Tools](https://www.bing.com/webmasters)
     → import from Google Search Console or submit the sitemap directly
     (Bing powers Yahoo search).
   - DuckDuckGo indexes automatically — no submission needed.
4. Results typically appear within days; exam codes and certificate
   verification pages then surface when people search your school's name.

> Internal staff tools (admin, data, storage, health, roles, settings, audit)
> are intentionally excluded from the sitemap — they sit behind logins and
> should not appear in search results.
