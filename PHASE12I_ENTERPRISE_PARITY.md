# PHASE 12I — Enterprise Parity with School Connect / GOSA Portal
**2026-09-20 · repos studied: hmgconcepts/schoolconnect, gosaportal, schoolconnectdemo · 30/30 suites · smoke 311/311 · phase12i suite 80/80**

## How the study was done
All three reference repositories were cloned and their pages examined feature-by-feature: settings (976 lines), admin-data (692), platform-health (169), storage (597), activity_log (573), drive-sync.js (292), plus their SUPABASE_FREE_TIER_PROTECTION.md (487) and GOOGLE-DRIVE-SYNC-GUIDE.md (257). Every advanced behaviour found there is implemented here; the table below shows where this platform now matches or exceeds.

| Area | School Connect has | This platform now has | Edge |
|---|---|---|---|
| Drive auto-sync engine | urgency retries, daily self-heal prompt, refocus re-check, overdue banner, demo guard | identical engine, ported to our App/session + platform_settings | = (V9.4 parity) |
| Backup integrity | SHA-256 seal referenced | **SHA-256 seal implemented + verified before every import** (buildFullEnvelope seals; restoreEnvelope refuses mismatches before any write) | > |
| Disaster recovery | 8-step wizard (manual config edit) + runbook doc | 8-step wizard + runbook **+ live migration tool (enter new-project credentials and re-hydrate in-session) + 🚑 recovery mode (row-retry, dead-ref skip, per-table report)** | > |
| Platform health | keep-alive, schema doctor, DB space, drive tile, license tile, security controls, sign-in audit | all of those **plus** security posture grading, RPC/RLS smoke tests, 10-layer matrix (pre-existing) | > |
| Security controls | idle lock + lockdown | identical (security-guard.js enforcement on every page, saved via RPC) | = |
| Audit log | filters, CSV, PDF export, retention | filters, live tail, CSV, **print/PDF report**, retention (already exceeded; print added) | > |
| Storage manager | vault, efficiency, purge | identical + local device optimizer + real pg sizes | > |
| Anti-pause docs | 487-line 10-layer guide | full-depth rewrite, 10 layers, exact step-by-steps, handover checklist | = |
| Drive setup guide | 257-line exact guide | full port adapted to this platform + seal + recovery semantics + overdue banner rows | = |

## Files changed
- `assets/js/drive-sync.js` — V9.4-class engine, `restoreFrom`, auto-trigger IIFE
- `assets/js/data-portability.js` — SHA-256 sealing, `verifySeal`, recovery mode
- `admin-data.html` — wizard, recover action, seal badges
- `platform-health.html` — Schema Doctor, DB space, Drive + License tiles, Security Controls, audit card (PH12I engine)
- `activity_log.html` — Print / PDF report
- `GOOGLE-DRIVE-SYNC-GUIDE.md` (new) · `SUPABASE_FREE_TIER_PROTECTION.md` (rewritten) · `DISASTER-RECOVERY-RUNBOOK.md` (new) · `GOOGLE_DRIVE_BACKUP.md` (pointer)
- Both repos synced; sw → `hmg-cbt-shell-v12-phase12i-v1`

## Bugs found & fixed during the port
- `restoreEnvelope` referenced `verifySealAsync` after the rename — every restore would have thrown (caught by the new suite, fixed).
- Test-harness notes recorded for future phases.

## Regression
30/30 node suites · smoke 311/311 (14 new checks) · phase12i 80/80. Zips: cbt-system-PHASE12I.zip + cbt-generator-PHASE12I.zip.
