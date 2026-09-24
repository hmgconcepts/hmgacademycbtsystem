# DEPLOYMENT GUIDE — HMG Academy CBT Pro (Client Platform) & HMG CBT Builder (Generator)
**Version:** Phase 12K · **Read this once, end to end, before deploying.** Every step is exact and safe to re-run.

---

## ⚠️ THE ONE TRAP THAT CAUSED THE LAST INCIDENT (read first)

**GitHub's "Add files via upload" can ADD and OVERWRITE files — it can NEVER DELETE them.**

When we retired `license.html` and `client-monitor.html` from the client platform, the new build simply stopped containing them. Uploading the new build overwrote every changed file — but the two retired files from the older upload **stayed on the live site, fully functional**. The same upload also mangled the `.github/` folder into `,github/`, silently disabling 2 of the 10 anti-pause layers.

**Two ways to deploy correctly — use either:**

### ✅ Way 1 (recommended, handles deletions + dot-folders automatically) — git command line
```bash
# one-time setup
git clone https://github.com/hmgconcepts/hmgacademycbtsystem.git
cd hmgacademycbtsystem

# every release
unzip -o ~/Downloads/cbt-system-PHASE12K.zip -d ./          # overwrite contents in place
git add -A                                                    # stages adds, edits AND deletions
git commit -m "Phase 12K release"
git push                                                      # Vercel redeploys automatically
```

### ✅ Way 2 — GitHub web UI (no tools installed)
1. Unzip `cbt-system-PHASE12K.zip` on your computer.
2. On GitHub: **Add file → Upload files**, then **drag the extracted files/folders in** (select the *contents*, not the zip).
3. **Uploads never delete — so finish Part A2 below (the 4 deletions) every single time you deploy this way.**

> The Phase 12K build ships **tombstone redirect pages** for `license.html` and `client-monitor.html`. Even if you forget the deletions, a plain re-upload instantly replaces the dangerous old pages with inert redirects that bounce visitors Home. The deletions below then remove even the tombstones.

---

## PART A — Client platform (hmgacademycbtsystem.vercel.app)

### A1. Upload the build
Follow Way 1 or Way 2 above with `cbt-system-PHASE12K.zip`.

### A2. Delete the 4 stale files (web-UI deploys only — 2 minutes)
On GitHub, open each file, click the **⋮ (three dots) → Delete file → Commit changes**:
1. `license.html` (retired builder tool — tombstone until deleted)
2. `client-monitor.html` (retired builder tool — tombstone until deleted)
3. `,github/a` (junk from a mangled upload)
4. `,github/workflows/supabase-auto-restore.yml` and `,github/workflows/supabase-heartbeat.yml` (mangled junk — the real ones are re-created in A3)

### A3. Restore the GitHub Actions anti-pause layers (web-UI deploys only)
The dot-folder `.github/` gets dropped by uploads. Re-create the two workflow files once:
1. GitHub → **Add file → Create new file**.
2. Type the full path: `.github/workflows/supabase-heartbeat.yml`
3. Paste the entire contents of the same file from the unzipped build (open it in Notepad/VS Code).
4. **Commit**. Repeat for `.github/workflows/supabase-auto-restore.yml`.
5. (Optional, for cleanliness) same way create `.nojekyll` with an empty body.
6. Verify: repo page → **Actions** tab → you should see the workflows listed; after the first scheduled run, the **Platform Health** page heartbeat evidence turns green.

### A4. First-run Supabase setup (fresh deployments only)
1. Create a free project at supabase.com → **Project Settings → API** → copy the **Project URL** and the **anon public** key.
2. In the unzipped build, set both constants in **teacher.html**, **student.html**, **admin.html** and **assets/js/app.js** (`SB_URL`, `SB_KEY`). (The generator does this automatically for generated clients.)
3. Supabase → **SQL Editor** → paste the ENTIRE `database/complete-schema.sql` → **Run**. Safe to re-run (idempotent).
4. **Authentication → Providers → Email**: enable. Sign-up flow: the first account registered becomes `super_admin` automatically; later sign-ups land in the approval queue (Roles & Approvals page).
5. RLS is enforced by the schema — never paste a `service_role` key anywhere in the front-end (Platform Health grades this an instant F).

### A5. Verify the deployment (5 minutes, every time)
1. Open `https://<your-site>/deployment_validator.html` → **Run all checks**. Everything must be green — including the new **Builder-tool leakage** and **Stale upload artifacts** rows. A red row prints the exact fix.
2. Open `platform-health.html` → latency probe, 7 RPC smokes, heartbeat evidence, security grade **A/B**.
3. Open a governance page (e.g. `/storage`) in a **private/incognito window** → you must be redirected to the admin sign-in (this proves the clean-URL guard fix is live).
4. Sign in as admin → the sidebar shows Governance Console, breadcrumbs, your user chip; press **Ctrl+K** → the palette opens; try “storage”.
5. Settings → set an Announcement Banner → Save → it appears on every page.

### A6. Keep-alive & backups (strongly recommended)
- Follow **SUPABASE_FREE_TIER_PROTECTION.md** (~7 minutes) to arm all 10 anti-pause layers (GitHub Actions ×2, Vercel endpoint + cron, pg_cron, UptimeRobot, Edge function, auto-restore watchdog…).
- Follow **GOOGLE-DRIVE-SYNC-GUIDE.md** to arm automatic encrypted backups to the school's own Google Drive (free OAuth client, scope `drive.file`).
- Keep **DISASTER-RECOVERY-RUNBOOK.md** printed/nearby — the 7-step console rebuilds everything from a Drive backup if a project is ever lost.

---

## PART B — Builder console / generator (cbtgen.vercel.app)

**Action required:** cbtgen.vercel.app still runs the pre-12J build whose `templates/` contain `license.html` + `client-monitor.html` — every client platform generated from it today ships the two builder tools.

1. Deploy `cbt-generator-PHASE12K.zip` to the generator's repo/Vercel project (same Way 1/Way 2 as Part A; the generator's templates are now clean, and its own `license.html`/`client-monitor.html` live at the package **root** with a standalone builder App shim — that is correct and intended).
2. After deploying, generate one test client (branding → Supabase test creds → build) and confirm the produced ZIP contains **no** `license.html`/`client-monitor.html` and no builder-marker text (the generator's leak scan enforces this automatically).

## PART C — The SaaS workflow (how the generator gives you a full-stack platform)

1. **Builder console** (generator.html): enter the school's identity, theme, font, layout + the client's Supabase URL/anon key + licence model → **Build**.
2. The generator stamps `templates/` (a complete client platform: 20 question types, proctoring, analytics, certificates, Drive backup, DR console, governance pages), applies client-mode stripping, branding and the leak scan, and produces a **verified, deploy-ready ZIP**.
3. You deploy that ZIP to the client's repo/Vercel (Part A procedure) — each client is a full stack: static front-end on Vercel (free) + Supabase free tier (Postgres + Auth + Storage + Edge) + the school's own Google Drive for backups.
4. **Client Monitor** (builder root) tracks every deployed client's licence status live; the **Site Licence** console (builder root) manages keys/expiry. Neither ever ships inside a client build.
5. `SAAS_ARCHITECTURE.md` documents the full model, including the provider-managed renewal flow.

---

## Quick reference — what lives where

| Surface | Repo / package | Builder tools? |
|---|---|---|
| Client platform (this repo) → hmgacademycbtsystem.vercel.app | `cbt-system-PHASE12K.zip` | **Never** (tombstones only, delete per A2) |
| Builder console → cbtgen.vercel.app | `cbt-generator-PHASE12K.zip` (root: generator + licence + client-monitor) | Yes — intended |
| Generated client builds | produced by the generator from `templates/` | **Never** (enforced by build-time scan) |
