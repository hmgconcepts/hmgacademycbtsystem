# Supabase Free-Tier Protection — Complete, Automated & Unambiguous

> **The problem:** Supabase **pauses** every FREE-tier project that records **no database activity for ~7 consecutive days**. A paused CBT platform shows connection errors to every teacher and student until someone logs into the Supabase dashboard and manually restores it. On the free tier there are **no automatic backups**, and a project left paused too long can eventually be **deleted**.
>
> **Key fact (verified):** the inactivity detector counts **real database activity** (queries/writes hitting Postgres). A ping that never touches the database does **not** reliably reset the timer. That is why every layer below performs an actual **database write** through the `sc_keep_alive()` RPC.
>
> **The guarantee:** with even ONE layer below active, your project cannot be paused for inactivity. This platform ships ELEVEN layers — the recommended setup activates at least three. **Total one-time effort: ~15 minutes. After that everything is automatic.**

---

## What is already built in (zero setup for the school)

`database/complete-schema.sql` (and `database/keep-alive.sql` for existing installs) installs a tiny heartbeat system:

| Object | Purpose |
|---|---|
| `public.sc_heartbeat` table | One row storing the last ping time, source and count |
| `public.sc_keep_alive(src, p_src)` RPC | Performs a real `UPDATE` (genuine DB activity) — callable with the anon key, exposes no school data. Phase 12N: accepts BOTH parameter names — `src` (HMG Fleet Console / School Connect style) and `p_src` (this platform's own layers) — so every ping, wherever it comes from, lands in the same trail with its source recorded |
| `pg_cron` job `hmg-keep-alive` | **Layer 4** — internal DB scheduler fires every 2 days automatically (skipped gracefully where pg_cron is unavailable) |

**Layer 1 — Site-visit heartbeat (automatic, nothing to configure)**
`assets/js/keepalive.js` on every page calls `sc_keep_alive('site-visit')` at most **once per device per 24 hours**. As long as *anyone* (a teacher, a student, even you) opens the site once a week, the project never pauses. This is fully automated the moment the site is deployed — and the **Platform Health console** (💓 Keep-alive Heartbeat Evidence card) shows the live proof row: when the database was last touched, by which layer, and the total ping count.

Because school traffic can stop during long holidays, add the independent external layers below.

---

## Layer 2 — GitHub Actions heartbeat (recommended, ~5 minutes)

The file `.github/workflows/supabase-heartbeat.yml` is already in this package. Once activated, GitHub's servers automatically call your database **twice a week** (maximum gap = 4 days, safely inside the 7-day window), then **verify the write really happened** (the RPC returns the new timestamp — a failed write fails the job loudly and GitHub emails you). You never touch it again.

To activate it, GitHub needs to know your Supabase URL and anon key. You store them as **repository secrets**. A "secret" in GitHub is simply a **named value**: the **Name** field is a label the workflow uses to find the value, and the **Secret** field is the value itself. You will create **two separate secrets** — one named `SUPABASE_URL` and one named `SUPABASE_ANON_KEY`. The names must be typed **exactly** as shown (all capitals, underscores, no spaces), because the workflow file looks them up by those exact names.

### Step A — Copy your two values from Supabase first

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) and open your project.
2. Click the ⚙️ **Project Settings** (bottom of the left sidebar) → **API** (on some dashboards this is now called **Data API** / **API Keys**).
3. You will see:
   - **Project URL** — looks like `https://abcdefghijklmnop.supabase.co`. Copy it into a notepad.
   - **anon / public** key — a very long text starting with `eyJ...`. Click the copy icon next to it and paste it into your notepad too.
4. ⚠️ On the same page there is also a **service_role** key. **Never use that one anywhere** — it bypasses all security.

### Step B — Create the first secret (`SUPABASE_URL`)

1. Open your site's repository on **github.com**.
2. Click the **Settings** tab (top of the repo — if you don't see it, you are not an admin of the repo).
3. In the left sidebar scroll to **Security** → click **Secrets and variables** → click **Actions**.
4. Make sure you are on the **Secrets** tab (not "Variables"), then click the green **New repository secret** button.
5. Fill the form like this:

   | Field on the GitHub form | What you type |
   |---|---|
   | **Name** | `SUPABASE_URL` (exactly this, in capitals) |
   | **Secret** | paste your Project URL, e.g. `https://abcdefghijklmnop.supabase.co` |

6. Click **Add secret**.

### Step C — Create the second secret (`SUPABASE_ANON_KEY`)

1. Click **New repository secret** again (each secret is added one at a time — that is why you saw only one Name/Secret pair).
2. Fill the form:

   | Field on the GitHub form | What you type |
   |---|---|
   | **Name** | `SUPABASE_ANON_KEY` (exactly this) |
   | **Secret** | paste the long **anon / public** key (`eyJ...`) |

3. Click **Add secret**. You should now see both `SUPABASE_URL` and `SUPABASE_ANON_KEY` listed. (GitHub hides the values after saving — that is normal; you can only *update* or *remove* them, never re-read them.)

### Step D — Enable workflow write permissions (for the self-commit layer)

1. Same **Settings** page → **Actions** → **General** (left sidebar).
2. Scroll to **Workflow permissions** → select **Read and write permissions** → **Save**.
   *(Only the heartbeat workflow's built-in self-commit needs this — see Layer 9. Without it, the heartbeat still works; only the 60-day self-reset cannot commit.)*

### Step E — Test it once (do not skip)

1. Click the **Actions** tab at the top of the repo.
   - If you see a button like **"I understand my workflows, go ahead and enable them"**, click it.
2. In the left list click **Supabase Free-Tier Heartbeat & Anti-Pause**.
3. On the right, click the **Run workflow** dropdown → keep the default branch → click the green **Run workflow** button.
4. Wait ~20 seconds, refresh, and click the new run. Open the **heartbeat** job.
   - ✅ Success looks like: `✅ Keep-alive heartbeat written (HTTP 200). Supabase inactivity timer reset.` — plus the watchdog verification line.
   - ❌ If it warns that secrets are not set, re-check Steps B/C — the names must match exactly.
5. Optional double-check on the platform: open **platform-health.html** → Run Full Diagnostics → the 💓 card's *last source* should now say `github-actions`.

> ✅ **The 60-day caveat is SOLVED automatically.** GitHub normally disables *scheduled* workflows in repositories with no commits for 60 days. This workflow is **self-committing**: whenever the repository's last commit is older than 30 days, it commits a tiny timestamp file (`.github/last-keepalive.txt`) and pushes — so the 60-day clock resets itself forever. Full details in **Layer 9**.

---

## Layer 3 — Edge Function `ping` + UptimeRobot (also free, ~10 minutes)

Two parts: **(1)** deploy the tiny `ping` function that lives at `supabase/functions/ping/index.ts` in this package (it performs a **real database write** each time it is called), then **(2)** tell the free UptimeRobot service to call it automatically forever.

### Part 1 — Install the Supabase CLI and deploy the function (one time)

**Windows (easiest — via Scoop):**
1. Open **PowerShell** (Start menu → type "PowerShell" → Enter).
2. Install Scoop (a Windows app installer) if you don't have it:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   irm get.scoop.sh | iex
   ```
3. Install the Supabase CLI:
   ```powershell
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

**macOS (via Homebrew):**
```bash
brew install supabase/tap/supabase
```

**Any computer that has Node.js — no global install needed:**
```bash
npx supabase --version
```
(then use `npx supabase ...` wherever the commands below say `supabase ...`)

**Step 1 of 4 — Open a terminal INSIDE your site folder.** All commands must run *from inside the folder where you unzipped this site* — the folder that contains the `supabase/` subfolder (alongside `index.html`, `assets/`, `database/`, etc.).
- **Windows:** open the site folder in File Explorer → click the address bar → type `powershell` → press **Enter**.
- **macOS:** open **Terminal** → type `cd ` (with a trailing space) → drag the site folder from Finder onto the Terminal window → press **Enter**.

✅ Confirm: `dir supabase\functions\ping` (Windows) or `ls supabase/functions/ping` (macOS/Linux) should list `index.ts`.

**Step 2 of 4 — `supabase login`** (logs the CLI into **your Supabase account** — not GitHub, not Vercel):
1. Run `supabase login`. Your browser opens at a Supabase authorize page → click the confirm button. Back in the terminal you will see `Finished supabase login.`
2. If the browser does not open (some office PCs block it): go to **supabase.com/dashboard/account/tokens** → **Generate new token** → copy the `sbp_...` token → run `supabase login --token sbp_YOUR_TOKEN_HERE`.

**Step 3 of 4 — `supabase link`** (points this folder at YOUR project):
1. Find your **project ref**: the dashboard URL looks like `https://supabase.com/dashboard/project/abcdefghijklmnop` — the 20-character code is the ref (also the first part of your Project URL).
2. Run `supabase link --project-ref abcdefghijklmnop`
3. If it asks for the database password, just press **Enter** to skip (not needed for functions).

**Step 4 of 4 — deploy the ping function:**
```bash
supabase functions deploy ping --no-verify-jwt
```
- `--no-verify-jwt` makes it callable by UptimeRobot without a login token (it exposes no data — it only writes a heartbeat timestamp).
- Success looks like: `Deployed Functions on project abcdefghijklmnop: ping`.

**Common errors and exactly what they mean:**

| Message | Cause | Fix |
|---|---|---|
| `supabase: command not found` | CLI not installed or terminal opened before install finished | Re-run the install, open a NEW terminal, or use `npx supabase ...` |
| `Cannot find project ref. Have you run supabase link?` | Skipped Step 3 or running from the wrong folder | Run Step 3 again from inside the site folder |
| `Entrypoint path does not exist` | Not inside the folder containing `supabase/functions/ping/index.ts` | `cd` into the site folder and re-run |

### Part 2 — Create the UptimeRobot monitor (calls the function forever)

1. Open **[uptimerobot.com](https://uptimerobot.com)** → **Sign up free** (email + password; no card).
2. **Add New Monitor** and fill it exactly like this:

   | Field | What you type |
   |---|---|
   | Monitor Type | **HTTP(s)** |
   | Friendly Name | `CBT database keep-alive` |
   | URL (or IP) | `https://abcdefghijklmnop.supabase.co/functions/v1/ping` — replace `abcdefghijklmnop` with YOUR project ref |
   | Monitoring Interval | **12 hours** (free tier minimum is 5 min; 12 h is plenty) |

3. Click **Create Monitor**. Done — UptimeRobot now pings the function forever, for free, and every ping is a real database write.
4. **Bonus — a second monitor for your website:** Add New Monitor → type HTTP(s) → URL `https://yourschool.vercel.app` → interval 1 day. You get an email the moment the site itself is down.

### How do you KNOW it is working? (verification checklist)

- **Platform Health console** (`platform-health.html`) → Run Full Diagnostics → the 💓 card shows `last_source: supabase-functions` (or `uptimerobot`) and a recent `last_ping`.
- Supabase → **Edge Functions** → `ping` → the **Logs** tab shows invocations arriving on schedule.
- UptimeRobot dashboard: the monitor is green with 0% downtime.

---

## Layer 4 — pg_cron (fully internal, installed automatically)

`database/complete-schema.sql` tries to install a `pg_cron` schedule inside Postgres itself (`hmg-keep-alive`, every 2 days). Where the free tier allows pg_cron, the database now keeps **itself** alive with zero external dependencies. Where it is unavailable, the step is skipped gracefully — the other layers cover it. Nothing to do; the Platform Health console's protection matrix shows its state.

---

## Layer 5 — Manual heartbeat button (zero setup, human-triggered)

Platform Health console → **💓 Write Heartbeat Now**. One click = one real database write. Useful the day you take over a project, or during holidays when you happen to open the console.

---

## Layer 6 — cron-job.org (a second, independent free scheduler — optional but recommended)

**Prerequisite:** the `ping` Edge Function from Layer 3 Part 1 must already be deployed (this layer calls the same URL). If you have not done Layer 3 Part 1 yet, do that first.

**Why a SECOND external pinger?** UptimeRobot (Layer 3) and cron-job.org are two unrelated companies. If either one has an outage, changes its free plan, or accidentally deletes your monitor, the other still resets the 7-day timer. Redundancy across companies is the whole point of this layer.

### Step-by-step (~5 minutes)

1. Open **[cron-job.org](https://cron-job.org)** → **Register** (email + password; no card). Confirm the activation email if one arrives.
2. On the dashboard click the big **+ Create Cronjob** button (top right).
3. Fill the form exactly like this:

   | Field | What you type |
   |---|---|
   | Title | `CBT keep-alive` |
   | URL | `https://abcdefghijklmnop.supabase.co/functions/v1/ping` — replace `abcdefghijklmnop` with YOUR 20-character project ref (the same URL UptimeRobot uses) |
   | Execution Schedule | Select **Every 12 hours** (or Advanced: `0 */12 * * *`) |
   | Request Method | **GET** (leave the default) |
   | Notify on failure | ✅ leave enabled (default) — you get an email the moment a ping fails |

4. Click **Create**. The job appears in your list as **Active**, with "Next execution" showing a countdown.
5. **Test it immediately:** open the job → **Run now** (or the ▶ button). The status turns green with a 200 response and an execution time. That single click already wrote a heartbeat.

### How do you KNOW it is working?

- cron-job.org → your job → **History** tab: green entries every 12 hours with HTTP 200.
- **platform-health.html** → Run Full Diagnostics → the 💓 card's `last_ping` keeps refreshing and `ping_count` grows.
- cron-job.org emails you if the URL ever stops answering — that is your early warning that the database is unreachable.

> **Failure email settings (worth 30 seconds):** Profile → **Notifications** → confirm your email is verified, so the failure alerts actually reach you.

---

## Layer 7 — Vercel Cron (the same account that hosts your site — ~3 minutes)

**Prerequisite:** the site is deployed on Vercel (if you can open `https://yourschool.vercel.app`, you are already there) — and this package ALREADY ships the two files this layer needs: `api/keepalive.js` (the serverless function, which calls `sc_keep_alive` and **verifies** the response before declaring success) and `vercel.json` (the cron entry). For most deployments there is **nothing to add — just verify**, using the steps below.

### Step 1 — Confirm the files are deployed

In your local site folder check that both exist:

- `api/keepalive.js` — the function. Open it: it POSTs `{"p_src":"vercel-cron"}` to your Supabase RPC and checks the reply is a real timestamp.
- `vercel.json` — contains:

```json
{
  "crons": [{ "path": "/api/keepalive", "schedule": "0 6,18 * * *" }]
}
```

If you deploy via the Vercel dashboard **Git integration**, just commit these files and Vercel picks them up. If you deploy by drag-and-drop, include both in the upload.

### Step 2 — Verify on the Vercel dashboard (1 minute)

1. Open **vercel.com** → your project → the **Cron Jobs** tab (left sidebar).
2. You should see **`/api/keepalive`** with schedule `0 6,18 * * *` and the next run time.
3. Click the job → **Run** (manual trigger, top right) — this executes it immediately.
4. Open the **Deployments** tab → latest deployment → **Functions** (or **Logs**) → you will see `/api/keepalive` returning 200 with a JSON body that includes `"touched": true` and `"via": "sc_keep_alive RPC"`.

### Step 3 — Verify from the database side

Open **platform-health.html** → Run Full Diagnostics → the 💓 heartbeat card now lists `vercel-cron` as a recent source (raw source shown under "Where the last ping came from").

### Free-tier notes (honest limits)

- Vercel **Hobby** cron runs with **once-a-day precision** — Vercel may collapse `0 6,18 * * *` to one daily execution. One verified write per day is still comfortably inside Supabase's 7-day window.
- Hobby plans allow a small number of cron jobs per project — this platform uses exactly one.
- Because the cron runs on **Vercel's own servers**, this layer survives even if GitHub, UptimeRobot AND cron-job.org are all down at once.

### Test the endpoint by hand (30 seconds)

```bash
curl https://yourschool.vercel.app/api/keepalive
```
Expected: `{"ok":true,"touched":true,...}` and a fresh timestamp on the Platform Health console.

---

## Layer 8 — Google Apps Script (runs on Google's servers, needs only the school's Gmail)

**Prerequisite:** the `ping` Edge Function from Layer 3 Part 1 must already be deployed (this layer calls the same URL).

This layer adds a pinger from a THIRD company (Google). It needs no server, no card and nothing but the school's own Google account.

### Step-by-step (~5 minutes)

1. Sign in to the school's Google account, then open **[script.google.com](https://script.google.com)** → click **New project** (top left).
2. Delete the placeholder code in the editor and paste this (replace the URL with YOUR ping address from Layer 3):

   ```javascript
   function keepAlive() {
     const r = UrlFetchApp.fetch('https://abcdefghijklmnop.supabase.co/functions/v1/ping');
     console.log('keep-alive status: ' + r.getResponseCode());   // 200 = heartbeat written
   }
   ```

3. Rename the project (top left, "Untitled project") to `CBT keep-alive` so anybody can recognise it later.
4. **Test it once before automating:** click **Run** (▶, top bar) → Google asks for authorisation → **Review permissions** → choose the school account → **Advanced** → **Go to CBT keep-alive (unsafe)** → **Allow** (this is Google's standard warning for your own unpublished script). The first run should log `keep-alive status: 200`.
5. **Automate it:** click the **Triggers** icon (clock, left sidebar) → **+ Add Trigger** (bottom right) and set exactly:

   | Field | Value |
   |---|---|
   | Choose which function to run | `keepAlive` |
   | Select event source | **Time-driven** |
   | Select type of time based trigger | **Day timer** |
   | Select time of day | **1pm – 2pm** (any hour works; pick one you will remember) |
   | Failure notification settings | **Daily** (email me if it fails) |

6. Click **Save**. Done — Google's servers now call your database once a day, forever, free.

### How do you KNOW it is working?

- Apps Script → **Executions** (left sidebar): one green `keepAlive` run per day around your chosen hour.
- Apps Script → **Triggers**: the trigger is listed as enabled.
- **platform-health.html** → the 💓 card keeps refreshing every day; Supabase → Edge Function `ping` → Logs shows one invocation from a Google IP range each day.
- If it ever fails, Apps Script emails the school account (that is what the "Failure notification settings" in step 5 does).

> **Handover tip:** write the school's Gmail address on the client checklist — the trigger lives in THAT account. If the school ever changes Gmail, re-create steps 1–6 with the new account and delete the old trigger.

---

## Layer 9 — the 60-day Actions freeze, SOLVED automatically (self-committing workflow — built in)

GitHub disables **scheduled** workflows in repositories with no commits for 60 days. Left alone, this would silently kill Layer 2 after two quiet months. This platform's workflow already contains the fix: after each heartbeat it checks the repository's last-commit date; when it is older than **30 days**, it commits a tiny timestamp file (`.github/last-keepalive.txt`) and pushes — resetting the 60-day clock forever. The only requirement is the **Read and write permissions** switch from Layer 2 Step D (verify it once).

---

## Layer 10 — Auto-Restore Watchdog: if a pause EVER happens, it un-pauses itself

Every layer above PREVENTS the pause. This one UNDOES it. The file `.github/workflows/supabase-auto-restore.yml` asks the Supabase **Management API** for your project's status daily. If the project is **INACTIVE** (paused), it calls the official restore endpoint — exactly what the "Restore project" button in the dashboard does — waits for the project to come back, then writes a heartbeat so the timer restarts.

**One-time setup (2 minutes) — two repository secrets** (Settings → Secrets and variables → Actions → New repository secret):
- `SUPABASE_ACCESS_TOKEN` — a Personal Access Token (starts with `sbp_`): create at supabase.com/dashboard/account/tokens → **Generate new token**.
- `SUPABASE_PROJECT_REF` — your project ref (`abcdefghijklmnop`).

Then Actions tab → enable + **Run workflow** once to test. With this armed, even a total keep-alive failure self-heals within ~24 hours.

---

## Layer 11 — HMG Fleet Console (your own monitoring console — one-click keep-alive for EVERY client project)

**What it is:** [hmgfleetconsole.vercel.app](https://hmgfleetconsole.vercel.app) — your own PWA that watches every Supabase project you have built for clients. It shows a fleet dashboard, health-checks every project, detects new deploys, and — most importantly — can **reset any project's 7-day inactivity timer with one click** (or health-check-all across the whole fleet at once).

**Why it is a real layer, not just a dashboard:** the console's ping performs the exact same verified write as every other layer — `POST /rest/v1/rpc/sc_keep_alive` with the payload `{"src":"hmg-fleet-console"}` — and since Phase 12N this platform's RPC accepts BOTH parameter names (`src` for the console, `p_src` for the platform's own layers), so the console's pings land in the heartbeat trail **with their source visible** on the Platform Health console.

### What this platform exposes to the console (all three verified live on Platform Health → 🚀 Fleet Console card)

| Console feature | What it calls | Installed by |
|---|---|---|
| One-click keep-alive + latency | `POST /rest/v1/rpc/sc_keep_alive` with `{"src":"hmg-fleet-console"}` | `keep-alive.sql` / `platform-integration.sql` (Phase 12N dual-param signature) |
| Heartbeat age ("stale-heartbeat wake-up") | `GET /rest/v1/sc_keepalive?select=pinged_at&limit=1` (anon key) | `platform-integration.sql` (the `sc_keepalive` view) |
| License cell | `POST /rest/v1/rpc/sc_license_status` | `platform-integration.sql` |

None of the three exposes school data — a timestamp, a source label and the license state.

### Add THIS platform to the console (2 minutes)

1. Open **hmgfleetconsole.vercel.app** → **＋ Add project**.
2. **Project URL:** `https://abcdefghijklmnop.supabase.co` (copy it from Platform Health → 🚀 Fleet Console card → **Copy Project URL**).
3. **Anon key:** the `eyJ...` public anon key (same card → **Copy anon key** — it is public by design and cannot read school data).
4. Save → press **🩺 Re-check**. Health, heartbeat age and license light up.
5. Press **💓 Ping** once. Then open this platform's **platform-health.html** → the 💓 heartbeat card shows **"🚀 HMG Fleet Console — one-click fleet ping (Layer 11)"** with raw source `hmg-fleet-console`. That is your proof the integration is live.

### Verifying the whole fleet

- The console's **Health-check all** button re-probes every project at once; **Detect deploys** spots when a client site was redeployed.
- Each project's **deploy-history chip** shows the last detected deploy version.
- On this platform's side, the heartbeat card tells you WHO touched the database last — including the console.

## Existing sites installed before this feature

Only if the database predates these features: run `database/keep-alive.sql` once in the Supabase **SQL Editor** (installs the heartbeat table + RPC + pg_cron attempt; idempotent — safe to re-run). For the Phase 12N additions — the Fleet-Console-compatible dual-name RPC signature, the `sc_keepalive` view, `sc_license_status()`, the `login_audit` sign-in trail, 2-Factor preferences, Schema Doctor markers, analytics columns and the DR re-link RPC — run `database/platform-integration.sql` once (also idempotent). The **Platform Health → Schema Doctor** card probes the live database and tells you exactly whether this (and every other SQL pack) still needs a run.

## How to verify the whole system (2-minute monthly routine)

1. Open **platform-health.html** → **Run Full Diagnostics**.
2. Check the 💓 card: `last_ping` within your shortest layer interval; `ping_count` growing.
3. Check the **11-layer protection matrix** — every active layer green.
4. Check the **Schema Doctor** — all packs green.
5. Glance at GitHub **Actions** (green checks), UptimeRobot (0% downtime) and — if the project is in your fleet — the HMG Fleet Console dashboard (all projects healthy).

## Recommended client handover checklist

- [ ] `database/complete-schema.sql` run on the client project (Schema Doctor all green)
- [ ] Layer 1 verified: Platform Health heartbeat card shows a recent site-visit ping
- [ ] Layer 2: `SUPABASE_URL` + `SUPABASE_ANON_KEY` secrets set; workflow ran green once; write permissions enabled
- [ ] Layer 3: `ping` function deployed; UptimeRobot monitor green
- [ ] Layer 6: cron-job.org job created and **Run now** returned 200
- [ ] Layer 7: `/api/keepalive` visible in Vercel → Cron Jobs; manual **Run** returned 200
- [ ] Layer 8: Apps Script trigger created; first **Run** logged `keep-alive status: 200`
- [ ] Layer 10: watchdog secrets set; workflow ran green once
- [ ] Layer 11: project added to the HMG Fleet Console; 🩺 Re-check green; one 💓 Ping verified in the Platform Health heartbeat card (source `hmg-fleet-console`)
- [ ] Phase 12N pack: `database/platform-integration.sql` run (Schema Doctor: platform-integration.sql green)
- [ ] Google Drive auto-backup ON (see GOOGLE-DRIVE-SYNC-GUIDE.md) — a paused project is recoverable; a **deleted** project is only recoverable from Drive
- [ ] Show the client the Platform Health console and this file

## The complete matrix (11 layers — tick what you have)

| # | Layer | Where it runs | Setup | Automatic? |
|---|---|---|---|---|
| 1 | Site-visit heartbeat (keepalive.js) | every visitor's browser | none | ✅ built in |
| 2 | GitHub Actions heartbeat | GitHub servers | 2 secrets | ✅ 2×/week + self-verify |
| 3 | Edge Function `ping` + UptimeRobot | Supabase + UptimeRobot | CLI deploy + monitor | ✅ every 12 h |
| 4 | pg_cron internal schedule | inside Postgres | none | ✅ (where available) |
| 5 | Manual heartbeat button | Platform Health | none | human-triggered |
| 6 | cron-job.org second pinger | cron-job.org | 1 monitor | ✅ every 12 h |
| 7 | Vercel Cron | Vercel | vercel.json entry | ✅ daily (Hobby precision) |
| 8 | Google Apps Script | Google servers | 1 trigger | ✅ daily |
| 9 | 60-day self-commit | GitHub workflow | permissions switch | ✅ built in |
| 10 | Auto-Restore Watchdog | GitHub workflow | 2 secrets | ✅ daily check + auto-restore |
| 11 | HMG Fleet Console one-click ping | your console (hmgfleetconsole.vercel.app) | add project (URL + anon key) | one click (fleet-wide) |

## The whole system in one sentence

Layers 1 + 4 alone keep the project alive automatically; Layers 2, 3, 6, 7 and 8 add independent external redundancy from five different companies; Layer 5 gives the admin a one-press manual reset; Layer 9 keeps the GitHub schedulers themselves alive forever; Layer 10 automatically un-pauses the project if the impossible ever happens; and Layer 11 puts a one-click fleet-wide reset in your own HMG Fleet Console — **eleven safeguards in total, ten of them fully automated.**

## Disaster recovery (if the worst happens anyway)

A **paused** project: Layer 10 restores it, or press Restore in the Supabase dashboard (nothing is lost). A **deleted** project: rebuild from your Google Drive backups — the full step-by-step **Disaster Recovery Wizard** lives in Admin Data, with the printable runbook in `DISASTER-RECOVERY-RUNBOOK.md`.

## EXPIRED SUBSCRIPTION ≠ PAUSED PROJECT (Phase 9 guarantee)

These are different things and the platform handles both: a lapsed client **license** shows a renewal notice but the CBT platform keeps working through its grace window (see license.html); a **paused Supabase project** is infrastructure and is prevented by the layers above. One never causes the other.
