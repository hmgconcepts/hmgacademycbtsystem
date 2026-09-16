# Supabase Free-Tier Protection — Complete, Automated & Unambiguous (v2, research-verified)

> **The problem:** Supabase **pauses** every FREE-tier project that records **no database activity for ~7 consecutive days**. A paused CBT platform shows connection errors until someone logs into the Supabase dashboard and manually restores it. On the free tier there are **no automatic backups**, and a project left paused too long can eventually be **deleted**.
>
> **Key fact:** the inactivity detector counts **real database activity** (writes hitting Postgres). A ping that never writes to the database does **not** reliably reset the timer. That is why every layer below performs an actual **database write** through the `sc_keep_alive()` RPC installed by `database/complete-schema.sql`.

---

## What the research says (verified September 2026)

Background checking against current Supabase free-tier documentation and community findings:

1. **The pause rule is real and unchanged:** free projects pause after **7 consecutive days without database activity**. "Activity" means API requests, database queries or Edge Function invocations — **opening the Supabase dashboard does NOT count** (the timer tracks database activity, not UI visits). Paused projects are unreachable until manually restored from the dashboard. The 2026 free limits remain: 500 MB database, 1 GB file storage, 5 GB bandwidth, 50,000 MAUs, 2 active projects.
2. **One ping per week is mathematically enough** — the timeout is measured in days, not minutes. Every scheduled request that reaches the database resets the clock. Daily runs are still recommended so a single missed execution never matters.
3. **pg_cron alone cannot save you** — it lives inside the very database that gets paused (a circular dependency). Every credible guide therefore pairs INTERNAL schedulers with at least one EXTERNAL pinger. That is exactly this platform's architecture: pg_cron (Layer 4) is a bonus, while GitHub Actions (Layer 2), UptimeRobot (Layer 6), Vercel cron (Layer 7) and the Edge function (Layer 8) are all external.
4. **External scheduler options (all free):** GitHub Actions scheduled workflows (built in here), UptimeRobot / Better Stack / StatusCake HTTP monitors (Layer 6), cron-job.org (identical role — point it at `/api/keepalive` or the Edge function URL, every 1–6 hours, if you prefer it to UptimeRobot), n8n self-hosted workflows, and browser extensions such as "Supabase Keep Alive" for a personal machine. This platform ships with the GitHub Actions + UptimeRobot + Vercel combination — the most robust free stack — and any of the alternatives can be added without configuration changes since they all simply hit the same verified endpoints.
5. **A paused project does not lose data** — pausing makes it unreachable; data survives and the dashboard can restore it. The real risks are (a) an organisation losing access to the DASHBOARD account, and (b) projects deleted for quota/policy reasons — both are covered by the Google Drive backup envelopes and the Disaster Recovery console.

**Design decisions taken from this research:** every layer in this platform performs a **real database write** (not a bare HTTP 200, which can be served by a proxy/CDN without touching Postgres), every automated verification checks the **returned timestamp** as proof, and at least two layers are **external** to Supabase so they survive the very outage they prevent.

## The 10 layers (what protects this platform, in order)

| # | Layer | What it does | Setup needed |
|---|---|---|---|
| 0 | `sc_heartbeat` table + `sc_keep_alive()` RPC | The write every other layer performs; records last ping time, source and count | ✅ Installed by `database/complete-schema.sql` |
| 1 | **Site-visit heartbeat** (`assets/js/keepalive.js`) | Any admin/teacher page visit performs a real RPC write, throttled to once per device per 12 hours | ✅ None — automatic |
| 2 | **GitHub Actions heartbeat** (`.github/workflows/supabase-heartbeat.yml`) | GitHub's servers write a verified heartbeat every **Monday and Thursday** + self-commit so the workflow can never be frozen for repo inactivity | ⚠️ 2 repo secrets (5 min, once) |
| 3 | **Vercel serverless endpoint** (`/api/keepalive`) | A real, verified database write callable from anywhere | ✅ None on Vercel (deployed with the site) |
| 4 | **pg_cron internal scheduler** | The database schedules its own heartbeat **every 2 days** — fully internal, works even if every external layer fails | ✅ Auto-installed by the schema (skipped gracefully where pg_cron is unavailable) |
| 5 | **Manual heartbeat button** | Platform Health → "Write Heartbeat Now", with timestamp proof | ✅ Built-in |
| 6 | **UptimeRobot / external pinger** | A free monitor calls `/api/keepalive` (or the Edge function) every 5 minutes forever | ⚠️ Optional (10 min, once) |
| 7 | **Vercel cron** (`vercel.json`) | Vercel itself calls the keepalive endpoint every 2 days | ✅ None on Vercel |
| 8 | **Supabase Edge Function `ping`** (`supabase/functions/ping/index.ts`) | A deployable, no-auth function that performs the verified write — ideal target for UptimeRobot | ⚠️ Optional (10 min, once) |
| 9 | **Self-committing workflow** (inside Layer 2) | Commits a timestamp file when the repo goes 30+ days without commits, so GitHub's 60-day scheduler freeze can never happen | ✅ Automatic (needs repo Actions set to "Read and write permissions" — see below) |
| 10 | **Auto-restore watchdog** (`.github/workflows/supabase-auto-restore.yml`) | Daily check via the Management API; if the project is paused it **restores it automatically** and re-arms the heartbeat | ⚠️ 2 repo secrets (2 min, once) |

**Belt and braces:** Layers 1, 3, 4, 5, 7, 9 need **zero setup**. Layer 2 needs 5 minutes once. Even if you do nothing at all, the platform protects itself as long as anyone opens it once a week.

---

## Layer 2 — GitHub Actions heartbeat (RECOMMENDED, ~5 minutes, once)

GitHub's servers call your database every Monday and Thursday (maximum gap = 4 days, safely inside the 7-day window). You never touch it again.

### Step A — Copy your two values from Supabase first

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) and open your project.
2. Click **Project Settings** (bottom of the left sidebar) → **API**.
3. Copy the **Project URL** (looks like `https://abcdefghijklmnop.supabase.co`) and the **anon / public** key (a long text starting with `eyJ...`) into a notepad.
4. ⚠️ On the same page there is also a **service_role** key. **Never use that one anywhere** — it bypasses all security.

### Step B — Create the repository secrets

1. Open your site's repository on [github.com](https://github.com).
2. Click the **Settings** tab (top of the repo).
3. Left sidebar → **Security** → **Secrets and variables** → **Actions**.
4. On the **Secrets** tab click **New repository secret** and add them **one at a time**:

| Field | Value |
|---|---|
| **Name** | `SUPABASE_URL` (exactly, in capitals) |
| **Secret** | your Project URL, e.g. `https://abcdefghijklmnop.supabase.co` |

Then click **New repository secret** again:

| Field | Value |
|---|---|
| **Name** | `SUPABASE_ANON_KEY` |
| **Secret** | your long anon/public key (`eyJ...`) |

> The names must match **exactly** — the workflow file looks them up by those names. GitHub hides the values after saving; that is normal.

### Step C — Enable workflow write permissions (for the self-commit layer)

1. Repo **Settings** → **Actions** → **General**.
2. Scroll to **Workflow permissions** and select **Read and write permissions**.
3. Save. (This lets the heartbeat workflow commit its tiny keepalive file when the repo is inactive for 30+ days, so GitHub can never freeze your schedules.)

### Step D — Test it once (do not skip)

1. Click the **Actions** tab. If you see *"I understand my workflows, go ahead and enable them"* — click it.
2. In the left list click **Supabase Free-Tier Heartbeat & Anti-Pause**.
3. **Run workflow** → keep the default branch → **Run workflow**.
4. Wait ~20 seconds, refresh, open the run → the **heartbeat** job.
   - ✅ Success looks like: `✅ Keep-alive heartbeat written AND verified (HTTP 200, timestamp returned). Supabase inactivity timer reset.`
   - ❌ "secrets are not set" → re-check Step B names.
   - ❌ "RPC is missing" → run `database/complete-schema.sql` once in the Supabase SQL Editor, then re-run.

### Step E — Watch the evidence on the platform

Platform Health → **Keep-alive Heartbeat Evidence** will show `last_source: github-actions` with the timestamp and the running ping count. You can also verify in the Supabase SQL Editor:

```sql
select last_ping, last_source, ping_count from public.sc_heartbeat;
```

---

## Layer 6 — UptimeRobot external pinger (optional but free forever, ~10 minutes)

UptimeRobot is a free monitoring service: it visits a URL on a schedule, forever, from its own servers. Every visit performs a real database write — so once this monitor exists, your database stays awake even if nobody opens the platform for months. Perfect for long holidays.

1. Register free at [uptimerobot.com](https://uptimerobot.com) (50 monitors, 5-minute intervals, free forever) and verify your email.
2. Click **Add New Monitor**:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** `CBT keep-alive`
   - **URL (choose one):**
     - the Vercel endpoint: `https://YOUR-DEPLOYMENT.vercel.app/api/keepalive`, **or**
     - the Supabase Edge function (Layer 8): `https://YOUR_PROJECT_REF.supabase.co/functions/v1/ping`
   - **Monitoring Interval:** 5 minutes (or the slowest free option)
3. Save. Done — check back once and confirm the monitor shows green (up).

> Tip: the Platform Health page has a **"Copy External Ping URL"** button that copies your deployment's keepalive URL to the clipboard.

---

## Layer 8 — Supabase Edge Function `ping` (optional, ~10 minutes)

The file `supabase/functions/ping/index.ts` in this package performs a verified database write on every call. Deploy it once with the Supabase CLI:

**Windows (PowerShell):**
```powershell
irm get.scoop.sh | iex          # install Scoop if you don't have it
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```
**macOS:** `brew install supabase/tap/supabase`
**Any computer with Node.js (no global install):** use `npx supabase ...` in place of `supabase ...`

Then, from **inside this folder** (the folder containing `supabase/`):
```bash
supabase login                                   # opens your browser to authorize
supabase link --project-ref YOUR_PROJECT_REF     # the 20-char code from your dashboard URL
supabase functions deploy ping --no-verify-jwt   # no login needed to CALL it (it exposes no data)
```

Test immediately in a browser:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/ping
```
✅ You should see `{"status":"alive", ..., "database_heartbeat":"heartbeat written at …"}` — the `database_heartbeat` field is the proof a real write happened.

---

## Layer 10 — Auto-Restore Watchdog (optional, 2 minutes — the last line of defence)

Every other layer **prevents** the pause. This one **undoes** it automatically if it happens anyway (e.g. every pinger failed in the same week). Daily, it asks the Supabase Management API for your project's status; if it is paused, it calls the official restore endpoint, waits for the project to come back, and writes a fresh heartbeat so the timer restarts.

Add two repository secrets (same Steps as Layer 2):

| Name | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | a Personal Access Token (starts with `sbp_`) from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) → **Generate new token** |
| `SUPABASE_PROJECT_REF` | the 20-character code from your dashboard URL (`https://supabase.com/dashboard/project/THIS-PART`) |

⚠️ The access token manages your **whole Supabase account** — store it ONLY as a GitHub secret, never in code or config files. The workflow skips gracefully (with a notice) if the secrets are absent.

---

## How to verify every layer is alive (2-minute monthly routine)

1. Open **Platform Health** (`platform-health.html`).
2. Click **Run Full Diagnostics**.
3. Check:
   - **Last Heartbeat** stat — should be within days (not weeks) and show the most recent source layer;
   - the **Heartbeat Evidence** card — `last_ping`, `last_source`, `ping_count` from the live `sc_heartbeat` row;
   - the **10-Layer Matrix** — each layer's status;
   - **Security Posture** grade (bonus: key hygiene, RLS probes, HTTPS).
4. In GitHub → **Actions**, confirm the last heartbeat run was green.
5. In Supabase → SQL Editor:
   ```sql
   select last_ping, last_source, ping_count from public.sc_heartbeat;
   ```

---

## Disaster recovery (if the worst happens anyway)

1. **Restore the project:** Supabase Dashboard → your project → **Restore project** (or let the Layer-10 watchdog do it — it checks daily).
2. **If the project is gone for good:** create a fresh free project, run `database/complete-schema.sql` once, then use **Admin Data → Disaster Recovery & Migration** to re-hydrate everything from your latest Google Drive backup in under a minute.
3. **Where are the backups?** In the school's own Google Drive folder `HMG_CBT_Backups` (newest 15 kept) — see `DEPLOYMENT.md` for the Drive setup.

---

## Summary checklist (total one-time effort: ~17 minutes)

- [ ] `database/complete-schema.sql` run once in the Supabase SQL Editor *(installs Layers 0 + 4 automatically)*
- [ ] Repo secrets `SUPABASE_URL` + `SUPABASE_ANON_KEY` added *(activates Layer 2 + 9)*
- [ ] Workflow permissions set to **Read and write** *(enables the self-commit)*
- [ ] Heartbeat workflow test-run was green
- [ ] Optional: UptimeRobot monitor on `/api/keepalive` or the Edge `ping` function *(Layer 6 + 8)*
- [ ] Optional: `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` secrets *(activates Layer 10 auto-restore)*

After that, everything is automatic. The database cannot be paused for inactivity, and if it ever is, it restores itself.

---

## EXPIRED SUBSCRIPTION ≠ PAUSED PROJECT (Phase 9 guarantee)

**The scenario:** a client on the subscription model lets their licence expire.
The portal locks — but the school has NOT renewed yet, maybe for weeks. If
nothing else happens, the Supabase free-tier project would cross the 7-day
inactivity window and pause, making renewal harder. This platform guarantees
that can never happen:

1. **The licence guard itself heartbeats.** `assets/js/site-license.js` (loaded
   on every page, public pages included) fires a keepalive touch whenever it
   evaluates a subscription to `grace`, `expired` or `suspended`. Anyone —
   the proprietor checking the lock screen included — generates real database
   activity just by opening the site.
2. **The lock never blocks renewal.** `license.html` (the console with
   quick-extend +30/+90/+365) and `admin.html` (sign-in) deliberately show
   only a banner instead of the full lock — the proprietor can always renew
   from inside the platform.
3. **The lock never interrupts a paper.** While a candidate has an exam in
   progress (`examActive`), the lock defers and re-checks after submission.
4. **Layer 2 runs regardless of the licence.** The twice-weekly GitHub
   Actions heartbeat (self-committing, watchdog-verified) keeps writing even
   if nobody at all visits a locked platform — zero-visitor protection.
5. **Remote renewal and override.** From the builder's side, the
   📡 **Client Monitor** (client-monitor.html) shows every client's live
   licence state and generates the license-registry override snippet to
   extend or reactivate a client instantly. The registry, when configured,
   always beats the client's local licence row.

**Bottom line:** an expired client platform stays warm, reachable and
renewable — renewal restores full access instantly, with no rebuild and no
data loss. Run the checklist above once on every client deployment and the
guarantee holds even with zero visitors.
