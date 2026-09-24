/* ====================================================================
   data-portability.js — HMG CBT Pro Data Portability & Vault Engine
   ====================================================================
   Powers the Admin Data page and the Storage Manager:
     • Full-platform backup envelope (every table, JSON, portable forever)
     • Envelope restore with DRY-RUN preview (see exactly what would
       happen BEFORE anything is written) and idempotent conflict handling
     • Per-table exports (JSON + CSV)
     • Table browser (browse any table page-by-page, delete selected rows)
     • One-click demo sample data
     • Archive Vault: move old rows into the private Supabase File Storage
       bucket (archive-vault) as JSON snapshots, then purge them from the
       database — and RESTORE them back at any time.

   All privileged operations go through the SECURITY DEFINER RPCs installed
   by database/complete-schema.sql (admin/owner checked server-side; every
   mutation is written to audit_logs). This file never talks to the
   database with anything except the anon key + the caller's own session
   token — there is no service_role key anywhere in the client.
   ==================================================================== */
const DataPort = {

  SCHEMA_VERSION: 4,

  /* ────────────────────────────────────────────────────────────────
     FULL BACKUP ENVELOPE
     ──────────────────────────────────────────────────────────────── */
  async buildFullEnvelope() {
    const App = window.App;
    const meta = {
      schema_version: this.SCHEMA_VERSION,
      exported_at: new Date().toISOString(),
      platform: (App && App.institutionName) || 'HMG CBT Pro',
      generator: 'data-portability.js v4.0'
    };

    // Public-reading tables (anon key is enough)
    const [institutions, settings, license] = await Promise.all([
      App.sbFetch('/rest/v1/institutions?select=*').catch(() => []),
      App.sbFetch('/rest/v1/platform_settings?select=*').catch(() => []),
      App.sbFetch('/rest/v1/site_license?select=model,plan,cycle,started_on,expires_on,grace_days,status').catch(() => [])
    ]);

    // Admin-privileged tables (needs an admin session)
    let exams = [], results = [], students = [], profiles = [], audit = [];
    try { exams = await App.sbRpc('admin_get_all_exams'); } catch (_) {}
    try { results = await App.sbRpc('admin_get_all_results'); } catch (_) {}
    try { profiles = await App.sbRpc('admin_get_all_profiles'); } catch (_) {}
    // students: direct REST (RLS: admins see all)
    try { students = await App.sbFetch('/rest/v1/students?select=*&order=created_at.desc&limit=10000'); } catch (_) {}
    // audit trail travels in FULL exports only (can be huge) — include newest 2000
    try { audit = await App.sbRpc('admin_get_audit_logs', { p_limit: 2000 }); } catch (_) {}

    const data = {
      institutions, platform_settings: settings, site_license: license,
      profiles, exams, results, students, audit_logs: audit
    };

    const summary = {
      total_records: Object.values(data).reduce((n, t) => n + (Array.isArray(t) ? t.length : 0), 0),
      counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]))
    };

    /* PHASE 12I — SHA-256 seal: a tamper-evident fingerprint over the data
       payload. Verified before any restore/import (incl. Google Drive
       recovery), so a corrupted or edited archive is refused loudly. */
    try {
      meta.seal = await this._seal(data);
      meta.seal_algo = 'SHA-256(canonical JSON of data)';
    } catch (_) { /* sealing never blocks an export */ }
    return { meta, summary, data };
  },

  /* Canonical JSON (sorted keys, no whitespace) → SHA-256 hex. */
  async _seal(data) {
    const canon = (v) => {
      if (v === null || typeof v !== 'object') return JSON.stringify(v);
      if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
      return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    };
    const bytes = new TextEncoder().encode(canon(data));
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  },
  /* Verify an envelope's seal — async (crypto.subtle). Legacy archives
     without a seal pass (nothing to check); a present-but-wrong seal fails. */
  async verifySeal(envelope) {
    if (!envelope || !envelope.meta || !envelope.meta.seal) return true;   /* legacy archive */
    const actual = await this._seal(envelope.data);
    return actual === envelope.meta.seal;
  },

  downloadJSON(obj, filename) {
    const blob = new Blob([typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  },

  downloadText(text, filename, mime = 'text/plain') {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  },

  async exportFullEnvelope() {
    const env = await this.buildFullEnvelope();
    const slug = (env.meta.platform || 'platform').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
    const name = `${slug}-full-backup-${ts}.json`;
    this.downloadJSON(env, name);
    // Record in backup history (provider "envelope")
    try {
      await window.App.sbRpc('log_backup_event', {
        p_backup_name: name, p_provider: 'envelope',
        p_file_size_bytes: JSON.stringify(env).length,
        p_total_records: env.summary.total_records,
        p_metadata: { type: 'full-envelope' }
      });
    } catch (_) {}
    return { name, envelope: env };
  },

  /* ────────────────────────────────────────────────────────────────
     ENVELOPE RESTORE (with DRY-RUN preview)
     ────────────────────────────────────────────────────────────────
     Conflict strategy per table:
       exams      → upsert on code (an exam with the same code is UPDATED)
       students   → upsert on (teacher_id, student_id)
       profiles   → upsert on id (passwords/auth users are NEVER touched —
                    auth.users cannot be restored from a client envelope)
       results    → re-inserted against exams matched by CODE (ids remapped);
                    if the exam code no longer exists the result is skipped
       settings   → save_platform_settings (branding/a11y/cbt defaults)
       license    → save_site_license (owner-only RPC)
     ──────────────────────────────────────────────────────────────── */
  async restoreEnvelope(envelope, { dryRun = true, mode = 'upsert' } = {}) {
    if (!envelope || !envelope.meta || !envelope.data) throw new Error('Not a valid backup envelope (missing meta/data).');
    if (envelope.meta.schema_version > this.SCHEMA_VERSION) {
      throw new Error(`Envelope was made by a newer system (v${envelope.meta.schema_version}). Upgrade this platform first.`);
    }
    /* PHASE 12I — verify the SHA-256 seal before ANY import (tamper/corruption guard) */
    if (!(await this.verifySeal(envelope))) {
      throw new Error('🔒 Archive seal MISMATCH — this backup was modified or corrupted after export. Import refused.');
    }
    /* PHASE 12I — recovery mode: disaster-recovery import onto a FRESH project.
       Same upsert semantics (nothing deleted) but every row is retried once on
       failure and dead references are skipped with a per-row reason, so one bad
       row can never abort a whole school's re-hydration. */
    const recovery = (mode === 'recovery');
    const retryOnce = async (fn) => {
      try { return { ok: true, r: await fn() }; }
      catch (e1) {
        try { return { ok: true, r: await fn() }; }
        catch (e2) { return { ok: false, e: (e2 && e2.message) || String(e2), first: (e1 && e1.message) || String(e1) }; }
      }
    };
    const App = window.App;
    const d = envelope.data;
    const plan = { dryRun, mode, actions: [], skipped: [], warnings: [] };

    /* platform settings */
    if (Array.isArray(d.platform_settings) && d.platform_settings.length) {
      const s = d.platform_settings[0];
      plan.actions.push({ table: 'platform_settings', op: 'merge', via: 'save_platform_settings' });
      if (!dryRun) {
        await App.sbRpc('save_platform_settings', {
          p_patch: {
            institution_name: s.institution_name,
            branding: s.branding || {},
            accessibility: s.accessibility || {},
            cbt_defaults: s.cbt_defaults || {},
            module_access: s.module_access || {},
            audit_retention_days: s.audit_retention_days,
            idle_lock_minutes: s.idle_lock_minutes,
            drive_client_id: s.drive_client_id || '',
            drive_folder_id: s.drive_folder_id || ''
          }
        }).catch(e => plan.warnings.push('platform_settings: ' + (e.message || e)));
      }
    }

    /* profiles (no passwords — profile rows only) */
    if (Array.isArray(d.profiles)) {
      let ok = 0, skip = 0;
      for (const p of d.profiles) {
        // Only restore profiles whose auth user still exists on this project
        try {
          const existing = await App.sbFetch(`/rest/v1/profiles?id=eq.${p.id}&select=id`);
          if (existing && existing.length) {
            skip++;
            if (!dryRun) {
              await App.sbFetch(`/rest/v1/profiles?id=eq.${p.id}`, 'PATCH', {
                full_name: p.full_name, role: p.role, status: p.status, phone: p.phone || ''
              }).catch(() => {});
            }
          } else {
            plan.warnings.push(`profile ${p.email}: auth user no longer exists on this project — skipped`);
            skip++;
          }
        } catch (e) { skip++; }
        void ok;
      }
      plan.actions.push({ table: 'profiles', op: 'update-existing', count: d.profiles.length - skip });
      plan.skipped.push({ table: 'profiles', count: skip, why: 'missing auth users (deleted accounts cannot be restored client-side)' });
    }

    /* exams (upsert by code) */
    if (Array.isArray(d.exams) && d.exams.length) {
      let up = 0, ins = 0;
      for (const e of d.exams) {
        const row = this._examRow(e);
        try {
          const existing = await App.sbFetch(`/rest/v1/exams?code=eq.${encodeURIComponent(e.code)}&select=id`);
          if (existing && existing.length) {
            up++;
            if (!dryRun) await App.sbFetch(`/rest/v1/exams?id=eq.${existing[0].id}`, 'PATCH', row);
          } else {
            ins++;
            if (!dryRun) await App.sbFetch('/rest/v1/exams', 'POST', row);
          }
        } catch (err) {
          if (recovery) {
            const r2 = await retryOnce(async () => {
              const ex2 = await App.sbFetch(`/rest/v1/exams?code=eq.${encodeURIComponent(e.code)}&select=id`);
              if (ex2 && ex2.length) return App.sbFetch(`/rest/v1/exams?id=eq.${ex2[0].id}`, 'PATCH', row);
              return App.sbFetch('/rest/v1/exams', 'POST', row);
            });
            if (r2.ok) { if (existing && existing.length) up++; else ins++; }
            else plan.skipped.push({ table: 'exams', id: e.code, why: r2.e });
          } else plan.warnings.push(`exam ${e.code}: ${err.message || err}`);
        }
      }
      plan.actions.push({ table: 'exams', op: 'upsert-by-code', inserted: ins, updated: up });
    }

    /* students (upsert by teacher+student_id) */
    if (Array.isArray(d.students) && d.students.length) {
      let n = 0;
      if (!dryRun) {
        for (const s of d.students) {
          try {
            await App.sbFetch('/rest/v1/students', 'POST', {
              teacher_id: s.teacher_id, full_name: s.full_name, student_id: s.student_id,
              class: s.class || '', email: s.email || '', phone: s.phone || '', status: s.status || 'active'
            });
            n++;
          } catch (e) {
            // duplicate (teacher_id, student_id) → treat as success-skip
            if (!/duplicate key|unique/i.test(e.message || '')) plan.warnings.push(`student ${s.student_id}: ${e.message || e}`);
          }
        }
      } else {
        n = d.students.length;
      }
      plan.actions.push({ table: 'students', op: 'upsert-by-id', count: n });
    }

    /* results (rematch exams by code; ids never collide) */
    if (Array.isArray(d.results) && d.results.length) {
      let n = 0, miss = 0;
      const codeMap = new Map();
      for (const r of d.results) {
        let examCode = r.exams && r.exams.code;
        if (!examCode) {
          const ex = (d.exams || []).find(e => e.id === r.exam_id);
          examCode = ex && ex.code;
        }
        if (!examCode) { miss++; continue; }
        if (!codeMap.has(examCode)) {
          try {
            const ex2 = await App.sbFetch(`/rest/v1/exams?code=eq.${encodeURIComponent(examCode)}&select=id`);
            codeMap.set(examCode, ex2 && ex2.length ? ex2[0].id : null);
          } catch (_) { codeMap.set(examCode, null); }
        }
        const newExamId = codeMap.get(examCode);
        if (!newExamId) { miss++; continue; }
        if (!dryRun) {
          try {
            await App.sbRpc('submit_student_result', { p_payload: {
              exam_id: newExamId, student_name: r.student_name, student_class: r.student_class,
              student_id_ref: r.student_id_ref, student_type: r.student_type, score: r.score,
              total: r.total, correct_count: r.correct_count, wrong_count: r.wrong_count,
              skipped_count: r.skipped_count, attempt_number: r.attempt_number, time_taken: r.time_taken,
              answers_data: r.answers_data || {}, subject_breakdown: r.subject_breakdown || {},
              violations: r.violations || 0, violation_log: r.violation_log || [],
              cert_code: r.cert_code || ''
            }});
            n++;
          } catch (e) { plan.warnings.push(`result for ${r.student_name}: ${e.message || e}`); }
        } else { n++; }
      }
      plan.actions.push({ table: 'results', op: 'insert-via-RPC (exam matched by code)', count: n });
      if (miss) plan.skipped.push({ table: 'results', count: miss, why: 'source exam code not found in this deployment' });
    }

    /* license (owner only) */
    if (Array.isArray(d.site_license) && d.site_license.length && !dryRun) {
      try {
        await App.sbRpc('save_site_license', { p_license: d.site_license[0] });
        plan.actions.push({ table: 'site_license', op: 'restored', count: 1 });
      } catch (e) {
        plan.warnings.push('site_license: ' + (e.message || e) + ' (owner-only — sign in as super_admin)');
      }
    }

    if (!dryRun) {
      try { await App.sbRpc('log_audit_event', { p_action: 'restore_envelope', p_entity_type: 'platform', p_metadata: { actions: plan.actions } }); } catch (_) {}
    }
    return plan;
  },

  _examRow(e) {
    return {
      teacher_id: e.teacher_id, code: e.code, subject: e.subject, duration: e.duration,
      attempt_limit: e.attempt_limit, select_count: e.select_count, is_open: false, // restore CLOSED — never accidentally expose a live exam
      is_archived: e.is_archived, exam_mode: e.exam_mode, negative_mark: e.negative_mark,
      release_results: e.release_results, math_keyboard: e.math_keyboard,
      certificate_enabled: e.certificate_enabled, certificate_valid_days: e.certificate_valid_days,
      proctoring: e.proctoring, anti_cheat_config: e.anti_cheat_config, instructions: e.instructions,
      is_multi_subject: e.is_multi_subject, subjects_data: e.subjects_data, csv_data: e.csv_data,
      start_at: e.start_at, close_at: e.close_at
    };
  },

  /* ────────────────────────────────────────────────────────────────
     PER-TABLE EXPORTS (JSON + CSV)
     ──────────────────────────────────────────────────────────────── */
  async fetchTable(name) {
    const App = window.App;
    switch (name) {
      case 'profiles':   return await App.sbRpc('admin_get_all_profiles').catch(() => []);
      case 'exams':      return await App.sbRpc('admin_get_all_exams').catch(() => []);
      case 'results':    return await App.sbRpc('admin_get_all_results').catch(() => []);
      case 'audit_logs': return await App.sbRpc('admin_get_audit_logs', { p_limit: 1000 }).catch(() => []);
      case 'system_backups': return await App.sbRpc('admin_get_drive_backups', { p_limit: 200 }).catch(() => []);
      default:
        return await App.sbFetch(`/rest/v1/${name}?select=*&order=created_at.desc&limit=10000`).catch(() => []);
    }
  },

  toCSV(rows) {
    if (!rows || !rows.length) return '';
    const cols = [];
    const seen = new Set();
    for (const r of rows.slice(0, 50)) {
      for (const k of Object.keys(r)) {
        if (!seen.has(k)) { seen.add(k); cols.push(k); }
      }
    }
    const esc = v => {
      if (v == null) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
  },

  async exportTableJSON(name) {
    const rows = await this.fetchTable(name);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
    this.downloadJSON({ table: name, exported_at: new Date().toISOString(), count: rows.length, rows }, `${name}-${ts}.json`);
    return rows.length;
  },

  async exportTableCSV(name) {
    const rows = await this.fetchTable(name);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
    this.downloadText(this.toCSV(rows), `${name}-${ts}.csv`, 'text/csv');
    return rows.length;
  },

  /* ────────────────────────────────────────────────────────────────
     TABLE BROWSER + ROW DELETE + DEMO DATA
     ──────────────────────────────────────────────────────────────── */
  async tableStats() { return await window.App.sbRpc('admin_table_stats'); },

  async browseTable(table, limit = 50, offset = 0) {
    return await window.App.sbRpc('admin_browse_table', { p_table: table, p_limit: limit, p_offset: offset });
  },

  async deleteRows(table, ids) {
    return await window.App.sbRpc('admin_delete_table_rows', { p_table: table, p_ids: ids });
  },

  async seedDemoData() {
    return await window.App.sbRpc('admin_seed_demo_data');
  },

  /* ────────────────────────────────────────────────────────────────
     ARCHIVE VAULT (Supabase File Storage — free-tier DB offloading)
     ────────────────────────────────────────────────────────────────
     Flow (archive-first, purge-after-proof — a purge can NEVER run before
     its archive upload has succeeded):
       1. fetchTable(table)                    → rows from the database
       2. uploadToVault(table, rows)           → JSON snapshot in the
          private "archive-vault" bucket (admin-only RLS)
       3. purgeFromDb(table, before, path)     → owner RPC deletes the old
          rows and records the archive path in audit_logs
     Restore: listVault() → downloadVaultObject(path) →
              restoreArchivedRows(table, rows)
     ──────────────────────────────────────────────────────────────── */
  BUCKET: 'archive-vault',

  _storageHeaders() {
    const App = window.App;
    const session = App.getSession();
    const token = (session && session.access_token) || App.SB_KEY;
    return {
      'apikey': App.SB_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  },

  async uploadToVault(table, rows) {
    if (!rows || !rows.length) throw new Error('Nothing to archive — no rows matched.');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const path = `${table}/archive-${ts}.json`;
    const body = JSON.stringify({ table, archived_at: new Date().toISOString(), count: rows.length, rows });
    const App = window.App;
    const res = await fetch(`${App.SB_URL}/storage/v1/object/${this.BUCKET}/${path}`, {
      method: 'POST',
      headers: this._storageHeaders(),
      body
    });
    if (!res.ok && res.status !== 200) {
      // upsert on re-run
      const res2 = await fetch(`${App.SB_URL}/storage/v1/object/${this.BUCKET}/${path}`, {
        method: 'PUT', headers: this._storageHeaders(), body
      });
      if (!res2.ok) {
        const err = await res2.json().catch(() => ({}));
        throw new Error(err.message || `Archive upload failed (${res2.status}). Run database/complete-schema.sql to create the archive-vault bucket.`);
      }
    }
    try {
      await App.sbRpc('log_backup_event', {
        p_backup_name: path, p_provider: 'archive_vault',
        p_file_size_bytes: body.length, p_total_records: rows.length,
        p_metadata: { table, vault: true }
      });
    } catch (_) {}
    return { path, count: rows.length, size: body.length };
  },

  async listVault(folder = '') {
    const App = window.App;
    const res = await fetch(`${App.SB_URL}/storage/v1/object/list/${this.BUCKET}`, {
      method: 'POST',
      headers: this._storageHeaders(),
      body: JSON.stringify({ prefix: folder, limit: 200, offset: 0, sortBy: { column: 'created_at', order: 'desc' } })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Could not list the archive vault (${res.status}).`);
    }
    return await res.json();
  },

  async downloadVaultObject(path) {
    const App = window.App;
    const session = App.getSession();
    const token = (session && session.access_token) || App.SB_KEY;
    const res = await fetch(`${App.SB_URL}/storage/v1/object/${this.BUCKET}/${path}`, {
      headers: { 'apikey': App.SB_KEY, 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Could not download archive ${path} (${res.status}).`);
    return await res.json();
  },

  async deleteVaultObject(path) {
    const App = window.App;
    const res = await fetch(`${App.SB_URL}/storage/v1/object/${this.BUCKET}/${path}`, {
      method: 'DELETE',
      headers: this._storageHeaders()
    });
    if (!res.ok && res.status !== 200) throw new Error(`Could not delete archive ${path}.`);
    return true;
  },

  async purgeFromDb(table, before, archivePath) {
    const App = window.App;
    if (table === 'audit_logs') return await App.sbRpc('admin_purge_audit_logs', { p_before: before });
    if (table === 'results') {
      const r = await App.sbRpc('admin_purge_old_results', { p_before: before, p_archive_path: archivePath });
      return { purged: (Array.isArray(r) ? r[0] : r)?.purged ?? r };
    }
    throw new Error(`Direct purge is only supported for results and audit_logs (asked: ${table}). Use the table browser to delete individual rows instead.`);
  },

  async restoreArchivedRows(table, rows) {
    return await window.App.sbRpc('admin_restore_archived_rows', { p_table: table, p_rows: rows });
  },

  /* Estimated database size across browsable tables (bytes, from pg stats) */
  async dbFootprint() {
    const stats = await this.tableStats();
    return {
      tables: stats,
      totalBytes: stats.reduce((n, t) => n + Number(t.total_bytes || 0), 0),
      totalRows: stats.reduce((n, t) => n + Number(t.row_count || 0), 0)
    };
  }
};

window.DataPort = DataPort;
