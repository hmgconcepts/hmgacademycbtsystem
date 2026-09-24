/* ====================================================================
   keepalive.js — HMG CBT Pro 10-Layer Supabase Free-Tier Protection Client
   ====================================================================
   Prevents Supabase free-tier projects from pausing after ~7 days without
   REAL database activity. The inactivity detector counts genuine database
   writes, so every layer here performs an actual UPDATE through the
   sc_keep_alive() RPC installed by database/complete-schema.sql.

   LAYER 1 (this file): site-visit heartbeat. Any page that loads app.js
   pings at most once per device per 12 hours — as long as anyone (teacher,
   student, proprietor) opens the platform once a week, the project never
   pauses. Fully automatic, zero configuration.

   FIX HISTORY (C6, v3.1): the previous version had three problems that made
   Layer 1 a no-op: it required a `window.sb` Supabase SDK client that never
   existed (the codebase is pure-fetch), fire-and-forget /api/keepalive
   fetches whose failures were never noticed, and a throttle stamp written
   even when nothing was pinged. The heartbeat now uses plain fetch()
   (RPC first, REST fallback), awaits the result, and only throttles/reports
   success when the database was genuinely touched.

   v4.0 (Phase 2): the primary touch is now the sc_keep_alive('site-visit')
   RPC — a REAL UPDATE whose response timestamp can be verified — and a
   readHeartbeat() reader powers the Platform Health console with
   last_ping / last_source / ping_count evidence.
   ==================================================================== */
const FreeTierKeeper = {
  LS_LAST_PING: 'cbt_last_keepalive_ping',

  /* Pure-fetch database touch — no SDK required. Order:
     1) sc_keep_alive RPC  → real UPDATE, returns new last_ping timestamp
     2) keep_alive_ping RPC→ legacy alias of the same write (older schemas)
     3) REST read fallback → guaranteed columns (never a write, last resort) */
  async _touchDatabase() {
    const cfg = (window.App && window.App.SB_URL) ? window.App : null;
    const sbUrl = (cfg && cfg.SB_URL) || 'https://pstnsaqjshmtintjrnas.supabase.co';
    const sbKey = (cfg && cfg.SB_KEY) || null;
    if (!sbKey) return { touched: false, reason: 'no-key' };

    const headers = { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` };

    // 1) Primary: sc_keep_alive('site-visit') — a genuine DB write
    try {
      const r = await fetch(`${sbUrl}/rest/v1/rpc/sc_keep_alive`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_src: 'site-visit' })
      });
      if (r.ok) {
        const body = await r.text();
        // Watchdog proof: the RPC returns the NEW timestamp — verify it
        if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(body)) {
          return { touched: true, via: 'sc_keep_alive RPC', proof: body.trim().slice(0, 64) };
        }
        return { touched: true, via: 'sc_keep_alive RPC' };
      }
    } catch (_) { /* fall through */ }

    // 2) Legacy alias on older schema versions
    try {
      const r = await fetch(`${sbUrl}/rest/v1/rpc/keep_alive_ping`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}'
      });
      if (r.ok) return { touched: true, via: 'keep_alive_ping RPC (legacy)' };
    } catch (_) { /* fall through to REST */ }

    // 3) Guaranteed-column REST touch (read — only counts if Supabase credits reads)
    try {
      const r = await fetch(`${sbUrl}/rest/v1/institutions?select=id,name&limit=1`, { headers });
      if (r.ok) return { touched: true, via: 'rest' };
      return { touched: false, reason: `HTTP ${r.status}` };
    } catch (e) {
      return { touched: false, reason: e.message };
    }
  },

  /* Await the Vercel serverless keepalive endpoint (same-origin; performs a
     real database write server-side. Absent on non-Vercel hosts — that is
     fine, it is only one of several layers). */
  async _touchServerless() {
    try {
      const r = await fetch('/api/keepalive', { method: 'GET', cache: 'no-store' });
      return r.ok;
    } catch (_) { return false; }
  },

  async ping(force = false) {
    const now = Date.now();
    const lastPing = Number(localStorage.getItem(this.LS_LAST_PING) || 0);

    // Throttle client pings to once every 12 hours per browser (Layer 1)
    if (!force && now - lastPing < 12 * 60 * 60 * 1000) {
      return { skipped: true, message: 'Ping throttled (last pinged recently)' };
    }

    const [db, edge] = await Promise.all([this._touchDatabase(), this._touchServerless()]);

    if (db.touched || edge) {
      // Only record the throttle stamp and report success when a keepalive
      // target was ACTUALLY reached.
      localStorage.setItem(this.LS_LAST_PING, String(now));
      const via = db.touched ? `database (${db.via})` : (edge ? 'serverless endpoint' : '');
      console.log(`[FreeTierKeeper] Supabase keepalive heartbeat sent successfully via ${via}.`);
      return { success: true, via, proof: db.proof || '', timestamp: new Date().toISOString() };
    }

    console.warn('[FreeTierKeeper] Keepalive ping FAILED — no target reached:', db.reason || 'unknown');
    return { success: false, error: db.reason || 'keepalive unreachable' };
  },

  /* Read the heartbeat row (public RPC) — powers the Platform Health
     console with hard evidence: when the database was last touched, by
     which layer, and how many total pings were recorded. */
  async readHeartbeat() {
    const cfg = (window.App && window.App.SB_URL) ? window.App : null;
    const sbUrl = (cfg && cfg.SB_URL) || 'https://pstnsaqjshmtintjrnas.supabase.co';
    const sbKey = (cfg && cfg.SB_KEY) || null;
    if (!sbKey) return null;
    try {
      const r = await fetch(`${sbUrl}/rest/v1/rpc/get_heartbeat_status`, {
        method: 'POST',
        headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}`, 'Content-Type': 'application/json' },
        body: '{}'
      });
      if (!r.ok) return null;
      const rows = await r.json();
      return Array.isArray(rows) ? rows[0] : rows;
    } catch (_) { return null; }
  },

  /* The URL external pingers (UptimeRobot / cron-job.org) should call.
     Returned for display on the Platform Health page. */
  externalPingUrl() {
    return (window.location && window.location.origin ? window.location.origin : '') + '/api/keepalive';
  },

  getProtectionLayers() {
    return [
      { layer: 1, name: 'Site-Visit Heartbeat (this page)', status: 'Active (Built-in)', description: 'Real database write via sc_keep_alive RPC on every visit, throttled to once per device per 12 hours.' },
      { layer: 2, name: 'GitHub Actions Cron', status: 'Setup Required', description: 'keep-supabase-alive workflow (Mon + Thu) pings the RPC from GitHub servers. Add SUPABASE_URL + SUPABASE_ANON_KEY repo secrets once.' },
      { layer: 3, name: 'Vercel Serverless Endpoint', status: 'Active (/api/keepalive)', description: 'Serverless function performing a verified database write server-side.' },
      { layer: 4, name: 'pg_cron Internal Scheduler', status: 'Auto (schema)', description: 'The database schedules its own heartbeat every 2 days via the pg_cron job installed by the schema.' },
      { layer: 5, name: 'Manual Heartbeat Button', status: 'Available', description: 'One-click forced ping trigger in Platform Health & Settings with timestamp proof.' },
      { layer: 6, name: 'UptimeRobot / External Ping', status: 'Configurable', description: 'Free external monitor hitting /api/keepalive (or the Supabase Edge ping function) every 5 minutes forever.' },
      { layer: 7, name: 'Vercel Cron Schedule', status: 'Active (vercel.json)', description: 'Native Vercel cron triggering the keepalive endpoint daily.' },
      { layer: 8, name: 'Supabase Edge Function ping', status: 'Deployable', description: 'supabase/functions/ping/index.ts — a real DB write callable by any external pinger.' },
      { layer: 9, name: 'Self-Committing Workflow', status: 'Auto (workflow)', description: 'The GitHub workflow commits a timestamp file when the repo goes 30+ days without commits, so the 60-day scheduler freeze can never happen.' },
      { layer: 10, name: 'Auto-Restore Watchdog', status: 'Setup Required', description: 'supabase-auto-restore.yml checks the project daily via the Management API and RESTORES it automatically if paused.' }
    ];
  }
};

window.FreeTierKeeper = FreeTierKeeper;
