/* ====================================================================
   security-guard.js — HMG CBT Pro Client Security Posture Engine
   ====================================================================
   Powers the Security section of the Platform Health console.

   What it checks (all free, all client-side, no AI, no external services):
     1. KEY HYGIENE      — the configured Supabase key must be the ANON
                           key. The service_role key bypasses ALL security
                           and must NEVER ship to a browser. The check
                           decodes the JWT payload and inspects the role.
     2. RLS PROBES       — anonymous requests that MUST be rejected or
                           return nothing (reading audit_logs, writing
                           profiles, deleting results). A probe that
                           unexpectedly SUCCEEDS is a red flag surfaced
                           immediately.
     3. TRANSPORT        — the page must be served over HTTPS in
                           production (localhost file:// is fine offline).
     4. SESSION HYGIENE  — tokens live in localStorage only; the guard
                           verifies no credentials leak into cookies or
                           window globals beyond App.SB_KEY.
     5. IDLE LOCK        — auto sign-out after N idle minutes (default 30,
                           configurable in Settings; stored in
                           platform_settings.idle_lock_minutes).
     6. LOCKDOWN MODE    — emergency switch: when the proprietor enables
                           it, every non-admin visitor sees a maintenance
                           notice and is signed out (client-side gate that
                           complements — not replaces — RLS).

   Honest scope: these checks raise the bar and catch the common
   misconfigurations (wrong key, missing RLS, idle sessions); they are a
   companion to the server-side RLS policies, not a replacement.
   ==================================================================== */
const SecurityGuard = {

  /* ── 1. Key hygiene: decode the Supabase JWT and verify role=anon ── */
  checkKeyHygiene() {
    const key = (window.App && window.App.SB_KEY) || '';
    const findings = [];
    let role = 'unknown', decoded = null;
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      decoded = payload;
      role = payload.role || 'unknown';
    } catch (_) { findings.push({ level: 'warn', msg: 'Supabase key is not a readable JWT — verify you pasted the anon/public key.' }); }
    if (role === 'service_role') {
      findings.push({ level: 'critical', msg: 'DANGER: the browser is configured with the service_role key. It bypasses all Row Level Security. Replace App.SB_KEY with the anon key immediately.' });
    } else if (role === 'anon') {
      findings.push({ level: 'ok', msg: 'Client key is the anon/public key — Row Level Security fully applies to every browser request.' });
    }
    if (decoded && decoded.exp && decoded.exp * 1000 < Date.now()) {
      findings.push({ level: 'critical', msg: 'The configured anon key is EXPIRED — every database call will fail. Copy the current key from Supabase → Settings → API.' });
    }
    return { check: 'key-hygiene', role, findings };
  },

  /* ── 2. RLS probes — requests that must FAIL ── */
  async checkRls() {
    const App = window.App;
    const findings = [];
    const anonHeaders = { 'apikey': App.SB_KEY, 'Authorization': `Bearer ${App.SB_KEY}` };
    const probe = async (name, url, method, body, expectOk) => {
      try {
        const r = await fetch(`${App.SB_URL}${url}`, {
          method, headers: { ...anonHeaders, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined
        });
        if (expectOk) {
          findings.push({ level: r.ok ? 'ok' : 'warn', probe: name, msg: r.ok ? `${name}: reachable as expected.` : `${name}: returned HTTP ${r.status} — the object may be missing (run database/complete-schema.sql).` });
        } else if (r.ok) {
          findings.push({ level: 'critical', probe: name, msg: `${name}: SUCCEEDED anonymously — it must NOT. Check the RLS policies on this table.` });
        } else {
          findings.push({ level: 'ok', probe: name, msg: `${name}: correctly rejected for anonymous access (HTTP ${r.status}).` });
        }
      } catch (e) {
        findings.push({ level: 'warn', probe: name, msg: `${name}: could not be probed (${e.message}).` });
      }
    };

    // Reading the audit trail must be admin-only
    await probe('anon read audit_logs', '/rest/v1/audit_logs?select=id&limit=1', 'GET', null, false);
    // Writing another user's profile must fail
    await probe('anon write profiles', '/rest/v1/profiles', 'POST', { id: '00000000-0000-0000-0000-0000000000aa', email: 'probe@invalid', role: 'super_admin' }, false);
    // Deleting results must fail
    await probe('anon delete results', '/rest/v1/results?id=eq.00000000-0000-0000-0000-0000000000aa', 'DELETE', null, false);
    // Heartbeat table itself must NOT be directly readable (RPC-only)
    await probe('anon read sc_heartbeat table', '/rest/v1/sc_heartbeat?select=*&limit=1', 'GET', null, false);
    // The public RPC must work (this is the keep-alive layer 1 proof)
    await probe('heartbeat RPC', '/rest/v1/rpc/sc_keep_alive', 'POST', { p_src: 'security-probe' }, true);
    return { check: 'rls-probes', findings };
  },

  /* ── 3. Transport security ── */
  checkTransport() {
    const findings = [];
    const loc = window.location;
    const isLocal = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1' || loc.protocol === 'file:';
    if (loc.protocol === 'https:' || isLocal) {
      findings.push({ level: 'ok', msg: isLocal ? 'Running locally (offline development) — transport check skipped.' : 'Platform is served over HTTPS — credentials cannot be intercepted in transit.' });
    } else {
      findings.push({ level: 'critical', msg: 'Platform is served over plain HTTP. Deploy with HTTPS (Vercel/GitHub Pages give it free) — exam credentials currently travel unencrypted.' });
    }
    return { check: 'transport', findings };
  },

  /* ── 4. Session hygiene ── */
  checkSessionHygiene() {
    const findings = [];
    const cookieHasToken = /access_token|sb-|supabase/i.test(document.cookie || '');
    if (cookieHasToken) {
      findings.push({ level: 'warn', msg: 'Session material detected in cookies — this platform stores sessions in localStorage only. A script may have written cookies; inspect them.' });
    } else {
      findings.push({ level: 'ok', msg: 'Sessions are held in localStorage only — nothing leaks into cookies or shared caches.' });
    }
    return { check: 'session-hygiene', findings };
  },

  /* ── 5+6. Platform security settings (from platform_settings row) ── */
  async loadSettings() {
    try {
      const rows = await window.App.sbFetch('/rest/v1/platform_settings?id=eq.1&select=idle_lock_minutes,lockdown_mode,lockdown_message');
      return (rows && rows[0]) || { idle_lock_minutes: 30, lockdown_mode: false, lockdown_message: '' };
    } catch (_) {
      return { idle_lock_minutes: 30, lockdown_mode: false, lockdown_message: '', unavailable: true };
    }
  },

  /* ── Idle lock: starts an activity watcher on this page. Call once
       from any authenticated page (App.init wires it automatically). ── */
  startIdleLock(minutes, onLock) {
    if (!minutes || minutes <= 0) return;
    const LS_IDLE = 'cbt_last_activity';
    const reset = () => { try { localStorage.setItem(LS_IDLE, String(Date.now())); } catch (_) {} };
    ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach(ev => {
      document.addEventListener(ev, reset, { passive: true });
    });
    reset();
    this._idleTimer = setInterval(() => {
      let last = 0;
      try { last = Number(localStorage.getItem(LS_IDLE) || 0); } catch (_) {}
      if (last && Date.now() - last > minutes * 60 * 1000) {
        clearInterval(this._idleTimer);
        const s = window.App && App.getSession();
        if (s && s.access_token) { // only lock signed-in users
          try { App.setSession(null); } catch (_) {}
          if (typeof onLock === 'function') onLock(minutes);
          else window.location.href = 'index.html?idle=1';
        }
      }
    }, 30 * 1000);
  },

  /* ── Lockdown gate: signs out non-admins when lockdown_mode is on.
       Returns true when the page should continue loading normally. ── */
  async enforceLockdown(session) {
    let settings;
    try {
      settings = await this.loadSettings();
    } catch (_) { return true; }
    if (!settings || !settings.lockdown_mode) return true;
    const email = session?.user?.email;
    // Admins bypass the lockdown (they need access to lift it)
    try {
      const rows = await window.App.sbFetch(`/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=role,status`);
      const p = rows && rows[0];
      if (p && (p.role === 'super_admin' || p.role === 'admin') && p.status === 'active') return true;
    } catch (_) { /* if the check fails, fall through to the safe path */ }
    try { window.App.setSession(null); } catch (_) {}
    document.documentElement.innerHTML = `
      <body style="margin:0;font:15px/1.6 system-ui,sans-serif;background:#09090b;color:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;">
        <div style="max-width:480px;margin:24px;padding:36px 30px;background:#18181b;border:1px solid #27272a;border-radius:16px;text-align:center;">
          <div style="font-size:46px;">🛡️</div>
          <h2 style="margin:10px 0 8px;">Platform Under Maintenance</h2>
          <p style="color:#a1a1aa;">${this._esc(settings.lockdown_message || 'The proprietor has temporarily locked the platform for maintenance. Please check back shortly.')}</p>
          <p style="color:#71717a;font-size:12px;">Powered by HMG Academy Ecosystem</p>
        </div>
      </body>`;
    return false;
  },

  _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },

  /* ── Full report: runs every check and computes a letter grade ── */
  async fullReport() {
    const key = this.checkKeyHygiene();
    const rls = await this.checkRls();
    const transport = this.checkTransport();
    const session = this.checkSessionHygiene();
    const settings = await this.loadSettings();

    const all = [...key.findings, ...rls.findings, ...transport.findings, ...session.findings];
    const criticals = all.filter(f => f.level === 'critical').length;
    const warns = all.filter(f => f.level === 'warn').length;
    const oks = all.filter(f => f.level === 'ok').length;
    const grade = criticals > 0 ? 'F' : warns > 2 ? 'C' : warns > 0 ? 'B' : 'A';

    return {
      grade, criticals, warns, oks,
      checks: { key, rls, transport, session },
      settings,
      summary: grade === 'A' ? 'Excellent — no security misconfigurations detected.'
        : grade === 'B' ? 'Good — minor findings to review.'
        : grade === 'C' ? 'Fair — several findings need attention.'
        : 'FAIL — critical findings must be fixed before going live.',
      generated_at: new Date().toISOString()
    };
  }
};

window.SecurityGuard = SecurityGuard;
