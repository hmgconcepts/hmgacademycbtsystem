# Disaster Recovery Runbook — printable
**HMG Academy CBT Pro · restores a school's CBT platform onto a FRESH database from Google Drive · ~30–45 minutes · 100% free tools**

> **Keep this file with the school's records.** The interactive version of this
> runbook lives in the platform itself: **Admin Data → Disaster Recovery Wizard**
> (click to open). Prevention beats cure: keep Drive auto-sync ON and glance at
> the Platform Health console weekly — then this runbook is never needed.

---

## When to use which

| Situation | What to do |
|---|---|
| Project is merely **PAUSED** (7-day inactivity) | Do NOT rebuild. Open supabase.com → your project → **Restore**. Or just let the Layer-10 Auto-Restore Watchdog do it within ~24 h. Nothing is lost. |
| Project paused too long and **deleted** / you want a clean project | **This runbook.** |
| You only want yesterday's data back (bad import, accidental deletes) | Admin Data → **List Cloud Backups** → **↩ Restore** (dry-run preview, safe upsert, nothing deleted). No rebuild needed. |
| Migrating to a NEW Supabase project on purpose (upgrade / region / client handover) | **This runbook** — same steps, zero drama. |

---

## The 8 steps (same as the in-page wizard)

1. **Create the fresh database** — [supabase.com](https://supabase.com) → New project → copy the new **Project URL** and **anon public key** (Project Settings → API). Save them in a notepad.
2. **Install the schema** — new project → SQL Editor → paste the ENTIRE `database/complete-schema.sql` → Run. This installs every table, RPC, RLS policy, the keep-alive system, the archive vault, Drive-sync columns and security settings in one idempotent shot. Verify on **Platform Health → Schema Doctor** (all green).
3. **Reconnect this website** — two routes:
   - **Live migration (preferred for one-off restore):** Admin Data → Disaster Recovery card → enter the new URL/key → **Verify New Database** → continue to step 6. Your current browser session restores straight into the new project.
   - **Permanent switch:** edit `assets/js/app.js` → replace `SB_URL` and `SB_KEY` with the new values → push to GitHub → your host (Vercel/GitHub Pages) redeploys the SAME site onto the fresh database.
4. **Recreate the first admin** — Admin Panel → sign up. Then Supabase → Table Editor → `profiles` → set that row to `role = admin`. Approve pending teachers from the Admin Panel.
5. **Reconnect Google Drive** — sign in as that admin → Admin Data → Google Drive card → ⚙️ Configure → paste the school's existing OAuth **Client ID** → Save. (The Client ID is tied to the site URL, not the database — the SAME one still works. See GOOGLE-DRIVE-SYNC-GUIDE.md if it was never set up.)
6. **One-click restore** — Admin Data → **📋 List Cloud Backups** → on the NEWEST backup click **🚑 Recover to new project** (not plain Restore). Recovery mode:
   - verifies the archive's **SHA-256 seal** first (tamper/corruption guard);
   - re-creates every exam, question set, roster and result with safe **upsert** semantics — nothing is deleted;
   - retries failed rows once each and skips dead login references with a reason;
   - prints a **per-table recovery report** when finished.
7. **Re-onboard people** — teachers sign up again (send one platform announcement); approve them in the Admin Panel. Restored rosters re-link by exam code and student ID; students keep using exam codes as normal.
8. **Re-arm ALL safeguards** — Platform Health console:
   - press **💓 Write Heartbeat Now**;
   - re-add the GitHub Action secrets with the NEW url/key (SUPABASE_URL / SUPABASE_ANON_KEY, plus the watchdog's SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF);
   - repoint UptimeRobot / cron-job.org at the new project's ping URL;
   - switch Drive **auto-sync back ON** and run one fresh backup;
   - every tile green = done.

---

## What survives / what doesn't

| Data | Survives a Drive recovery? | Why |
|---|---|---|
| Exams, questions, schedules, settings | ✅ fully | portable envelope, upserted by code |
| Students / rosters | ✅ fully | re-created by teacher + student ID |
| Results & scores | ✅ fully | re-created per submission |
| Platform settings, branding, security config | ✅ fully | merged via `save_platform_settings` |
| Audit trail | ✅ fully | restored into `audit_logs` |
| **Teacher & admin passwords (Supabase Auth)** | ❌ re-created, not restored | Auth users live outside the database; people simply sign up again and are re-approved. Profile rows are restored and re-link by email. |
| Google Drive connection itself | ❌ re-connect once | the Client ID survives (tied to the site URL) but each browser re-authorises once |
| Files in the Archive Vault (storage bucket) | ⚠️ optional | the vault is an offload, not the primary store; re-upload archived exports if needed |
| UptimeRobot / GitHub secrets | ❌ point them at the new project | one-time, 5 minutes (step 8) |

## After the recovery — acceptance test (5 minutes)

1. Teacher Hub sign-in works; the exam list shows restored exams.
2. Student opens `student.html` → enters a restored exam code → questions render (including image and assertion–reason questions) → submit → score recorded.
3. Admin Panel → Results shows the submission.
4. Platform Health: heartbeat card fresh, Schema Doctor green, Drive tile shows the new backup.
5. Take one fresh Drive backup — it becomes the new recovery baseline.

## Prevention checklist (so this never happens)

- Drive auto-sync ON (weekly) — GOOGLE-DRIVE-SYNC-GUIDE.md Part E.
- At least 3 keep-alive layers active — SUPABASE_FREE_TIER_PROTECTION.md.
- Platform Health reviewed monthly (2-minute routine).
- Termly: one Archive Vault run + one full JSON export kept outside Drive (USB / OneDrive).
