# Google Drive Backup (legacy overview)

> **➡️ The complete, exact, up-to-date setup guide now lives in [GOOGLE-DRIVE-SYNC-GUIDE.md](GOOGLE-DRIVE-SYNC-GUIDE.md)** — Google Cloud console walkthroughs word-for-word, error tables, automatic sync, one-click restore, disaster recovery, OneDrive and GitHub Actions routes. This file remains as the short overview.


Your platform's backups belong to **your school's own Google Drive** — not to us, not to a third party. This guide takes you from zero to automatic cloud backups in ~10 minutes, and shows exactly how to restore when the day comes.

---

## Why Drive backup matters (read once)

- The free Supabase tier gives you a **database** and 7-day backups, but projects can pause (inactivity) or be lost (billing/account issues). Your Drive copy is **yours forever**, immune to all of it.
- Backups are **full envelopes**: every exam with its question bank, every student roster, every candidate result, platform settings, license and recent audit events — one JSON file.
- Restores are **dry-runnable**: you see the exact plan before anything is written.
- If the worst happens, the **Disaster Recovery console** (`disaster-recovery.html`) rebuilds the entire platform from Drive in 7 guided steps.

---

## Part 1 — One-time setup (≈10 minutes)

### Step 1 · Create a free Google OAuth Client ID (once per organisation)

1. Go to **console.cloud.google.com** and sign in with the **school's Google account** (this is the account that will own the backups — choose deliberately).
2. Create a project (any name, e.g. "School CBT").
3. **APIs & Services → OAuth consent screen** → External → fill the app name and support email → Save. (You can leave it in "Testing" — it works for your own account; add the school's other accounts as test users if more than one person will authorize.)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
5. Application type: **Web application**.
6. **Authorized JavaScript origins** — add EVERY address the platform is reachable on, e.g.:
   - `https://your-school.vercel.app`
   - `https://yourname.github.io`
   - `http://localhost:5500` (only if you test locally)
7. Copy the **Client ID** (ends with `.apps.googleusercontent.com`).

> ⚠️ One origin list, maintained in one place: if you deploy the platform at a new URL later, add that URL here too, or Drive authorization will fail from the new deployment with a clear `origin_mismatch` error.

### Step 2 · Connect the platform (2 minutes)

1. Open the platform → **Settings → Google Drive Cloud Sync**.
2. Paste the Client ID → **Save**.
3. Click **Authorize Drive** → Google asks for permission to "see, edit and create files in its own folder" — that is the `drive.file` scope: the platform can only touch **files it created itself**, nothing else in the Drive.
4. Click **Test Connection** → expect a green success.
5. Click **Backup Now** once → a `HMG_CBT_Backups` folder appears in the school's Drive (My Drive → HMG_CBT_Backups) containing your first envelope.

### Step 3 · Turn on auto-sync

Still in **Settings → Google Drive Cloud Sync**:

- Set the interval (recommended: **1 day** for active exam periods, up to 7 during holidays).
- Enable auto-sync.
- The next backups upload automatically whenever an admin has the platform open (the sync runs on page load + interval). For 24/7 unattended backups, also enable the GitHub heartbeat (see `SUPABASE_FREE_TIER_PROTECTION.md`) — the heartbeat workflow keeps the project alive; Drive uploads happen whenever an admin visits, which is when data can change anyway.

---

## Part 2 — What gets backed up, and where

| Item | Included |
|---|---|
| Exams | ✅ every exam + its full question bank (all 20 types) |
| Students | ✅ rosters per teacher |
| Results | ✅ every candidate submission: answers, scores, times, integrity logs |
| Settings | ✅ platform settings (branding, defaults, accessibility, security) |
| License | ✅ site license row |
| Audit | ✅ the most recent 2,000 audit events |
| Proctor photos | ❌ (kept only in the database — size) |
| Login accounts | ❌ (Supabase Auth users — cannot be exported; re-invited in 2 minutes after recovery) |

**File naming:** `cbt-backup-YYYY-MM-DD-HHMM.json` inside `HMG_CBT_Backups`. The **newest 15** are kept in Drive (rotation) — older ones are replaced, so fetch any historical copy you want to keep.

**History:** every backup (Drive, envelope, vault) is recorded in the platform's `system_backups` table and shown in **Admin Data → Backup History**.

---

## Part 3 — Restoring

### A · Restore into the SAME platform (e.g. accidental deletion)

1. **Admin Data → Dry-Run Restore**.
2. Pick **Load from Google Drive** (or paste/upload an envelope file).
3. Review the plan: exams update by code (never duplicate), students upsert by (teacher, ID), results re-attach by exam code, settings/license restore through owner-checked RPCs.
4. Approve → the plan is applied → done.

### B · Restore into a FRESH Supabase project (disaster recovery)

Use the **Disaster Recovery console** (`disaster-recovery.html`): the same engine wrapped in a guided 7-step wizard — connect the previous Drive, prepare the new project (schema tested live), choose a backup, dry-run, execute with verification, switch permanently, re-arm protection. See the page itself; every step is self-verifying and idempotent.

---

## Part 4 — Troubleshooting (every error, honestly)

| Symptom | Cause | Fix |
|---|---|---|
| `origin_mismatch` popup on authorize | The current URL is not in the OAuth client's authorized origins | Add the URL in Google Cloud → Credentials → your client → Authorized JavaScript origins, then retry |
| Popup closes instantly, nothing happens | Browser blocked the popup | Allow popups for the platform, then click Authorize again (the platform also times out the pending authorization after 5 minutes and tells you) |
| `401 invalid_credentials` during backup | Google token expired (happens after ~1 hour or password change) | The engine retries once silently; if it still fails, click **Authorize** again |
| Backups stopped uploading | No admin has opened the platform since the interval elapsed (uploads run on admin visits) | Open the platform; consider the GitHub heartbeat for full unattended coverage |
| `HMG_CBT_Backups` folder not visible in Drive | You are signed into a different Google account in Drive | Switch account in Drive — the folder is in the account that authorized |
| Previous backups vanished after 15 | Rotation keeps the newest 15 by design | Download any backup you want to keep permanently |
| Backup uploads but restore says "unknown format" | The file was renamed/edited, or it is not an envelope | Use a file downloaded from Drive/Admin Data unmodified; legacy v10 envelopes auto-convert |
| Test Connection OK but Backup Now fails | Drive quota full (15 GB free) | Free space in the school's Drive, or move older backups out manually |

---

## Part 5 — Best-practice checklist

- [ ] One dedicated school Google account owns the backups — never a personal account someone might lose.
- [ ] Client ID created once; every deployment URL added to authorized origins.
- [ ] Auto-sync enabled (1 day during exam terms).
- [ ] A full envelope ALSO downloaded to the school's computer after every major exam week (Admin Data → Full Envelope Export) — two locations beat one.
- [ ] Staff know the Disaster Recovery page exists — it is the 15-minute path back from anything.
