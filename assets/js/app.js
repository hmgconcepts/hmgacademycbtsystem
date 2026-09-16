/* ====================================================================
   app.js — HMG CBT Pro Core Application Layer & Global Helpers
   ==================================================================== */
const App = {
  SB_URL: 'https://pstnsaqjshmtintjrnas.supabase.co',
  SB_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzdG5zYXFqc2htdGludGpybmFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDEzODUsImV4cCI6MjA5MTI3NzM4NX0.KNVgpVN0xp1njin1HL3udntc7psfzjnz7mqzpEN_Z6w',
  user: null,
  profile: null,
  institution: null,
  institutionName: 'HMG Academy CBT Pro',
  publicSettings: null,

  init() {
    /* v5 — access map first: cold visitors of internal pages are bounced
       to the matching login before anything else renders. */
    if (!this.guardPageAccess()) return;
    this.initTheme();
    this.restoreSession();
    this.bindHeader();
    this.injectEngines();
    this.loadPublicSettings().then(() => this.applyAccessibility());
    if (window.FreeTierKeeper) {
      FreeTierKeeper.ping();
    }
    this.guardSession();
  },

  /* ── Engine Loader (v4.0) — every app.js page automatically gets the
     site-license subscription guard and the free-tier keep-alive client,
     even pages whose <script> tags predate them. ── */
  injectEngines() {
    const load = (src) => {
      if (document.querySelector(`script[src="${src}"]`)) return;
      const s = document.createElement('script');
      s.src = src;
      s.async = false; // preserve execution order relative to each other
      document.head.appendChild(s);
    };
    if (!window.FreeTierKeeper) load('assets/js/keepalive.js');
    if (!window.SiteSub) load('assets/js/site-license.js');
  },

  /* ── Public Platform Settings service (platform_settings row, id=1).
     Readable pre-login via RLS; cached 5 minutes in localStorage so the
     branding/accessibility/license state survives offline reloads. ── */
  async loadPublicSettings(force = false) {
    const LS_KEY = 'cbt_public_settings_cache';
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
        if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
          this.publicSettings = cached.data;
          this.institutionName = (cached.data && cached.data.institution_name) || this.institutionName;
          return cached.data;
        }
      } catch (_) {}
    }
    let data = null;
    try {
      const rows = await this.sbFetch('/rest/v1/platform_settings?id=eq.1&select=institution_name,branding,accessibility,lockdown_mode,lockdown_message,watermark_text,idle_lock_minutes');
      data = (rows && rows[0]) || null;
    } catch (_) { /* offline or older schema — fall back to get_public_settings RPC */ }
    if (!data) {
      try { data = await this.sbRpc('get_public_settings'); } catch (_) {}
    }
    if (data) {
      this.publicSettings = data;
      if (data.institution_name) this.institutionName = data.institution_name;
      try { localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), data })); } catch (_) {}
    }
    return data;
  },

  /* ── Accessibility applier — honours the saved accessibility defaults
     (font scale, high contrast, reduced motion, dyslexia font, language)
     from Settings → Accessibility on every page load. ── */
  applyAccessibility() {
    const a = (this.publicSettings && this.publicSettings.accessibility) || {};
    try {
      const local = JSON.parse(localStorage.getItem('cbt_a11y') || 'null');
      Object.assign(a, local || {}); // local device choices win
    } catch (_) {}
    if (!Object.keys(a).length) return;
    const root = document.documentElement;
    if (a.font_scale && a.font_scale !== 1) root.style.fontSize = (16 * Number(a.font_scale)) + 'px';
    root.setAttribute('data-contrast', a.high_contrast ? 'high' : '');
    root.setAttribute('data-motion', a.reduced_motion ? 'reduced' : '');
    root.setAttribute('data-dyslexia', a.dyslexia_font ? 'on' : '');
    root.setAttribute('lang', a.language || 'en');
  },

  /* ── Session guard: lockdown mode (emergency portal lock) + idle
     auto-sign-out. Runs on every app.js page for signed-in users. ── */
  async guardSession() {
    const s = this.getSession();
    if (!s || !s.access_token) return;
    if (window.SecurityGuard) {
      const ok = await SecurityGuard.enforceLockdown(s);
      if (!ok) return; // page replaced by the lockdown notice
      const idleMins = Number((this.publicSettings && this.publicSettings.idle_lock_minutes) || 30);
      SecurityGuard.startIdleLock(idleMins);
    } else {
      // SecurityGuard not yet loaded on this page — load it, then guard
      const s2 = document.createElement('script');
      s2.src = 'assets/js/security-guard.js';
      s2.onload = () => this.guardSession();
      document.head.appendChild(s2);
    }
  },

  /* ── Theme Management ── */
  initTheme() {
    const saved = localStorage.getItem('cbt_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  },
  toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', cur);
    localStorage.setItem('cbt_theme', cur);
    this.showToast(`Switched to ${cur} theme`);
  },

  /* ── Session & Auth ──
     PHASE 11 WIRING FIX: teacher.html has always stored its session under
     'cbt_pro_session', but getSession() only read 'cbt_session' /
     'cbt_teacher_session' / 'cbt_admin_session' — so every page relying on
     App (multi-subject builder, settings, license, status manager, client
     monitor) could not see a signed-in teacher. getSession() now reads the
     teacher key too, and role-aware getters let each page demand exactly
     the persona it needs:
       getTeacherSession() — teacher portal sessions only (exam ownership)
       getAdminSession()   — admin panel sessions only
       getBestSession()    — admin preferred, else teacher (governance pages
                             that derive rights from the profile role)     */
  getSession() {
    try {
      const raw = localStorage.getItem('cbt_session') || localStorage.getItem('cbt_teacher_session')
        || localStorage.getItem('cbt_pro_session') || localStorage.getItem('cbt_admin_session');
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  },
  getTeacherSession() {
    try {
      const raw = localStorage.getItem('cbt_session') || localStorage.getItem('cbt_teacher_session') || localStorage.getItem('cbt_pro_session');
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  },
  getAdminSession() {
    try {
      const raw = localStorage.getItem('cbt_admin_session');
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  },
  getBestSession() {
    return this.getAdminSession() || this.getTeacherSession() || this.getSession();
  },
  setSession(sessionData) {
    if (sessionData) {
      localStorage.setItem('cbt_session', JSON.stringify(sessionData));
      this.user = sessionData.user;
    } else {
      localStorage.removeItem('cbt_session');
      localStorage.removeItem('cbt_teacher_session');
      localStorage.removeItem('cbt_pro_session');
      localStorage.removeItem('cbt_admin_session');
      this.user = null;
      this.profile = null;
    }
  },
  restoreSession() {
    const s = this.getSession();
    if (s && s.user) {
      this.user = s.user;
    }
  },
  async logout() {
    this.setSession(null);
    window.location.href = 'index.html';
  },

  /* ── REST / PostgREST Pure Fetch Client ── */
  async sbFetch(path, method = 'GET', body = null) {
    const session = this.getSession();
    const token = session?.access_token || this.SB_KEY;
    const headers = {
      'apikey': this.SB_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : undefined
    };
    if (!headers.Prefer) delete headers.Prefer;

    const res = await fetch(`${this.SB_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }

    if (!res.ok) {
      const err = (data && (data.message || data.error || data.hint)) || `HTTP ${res.status}`;
      throw new Error(err);
    }
    return data;
  },

  async sbRpc(name, body = {}) {
    return this.sbFetch(`/rest/v1/rpc/${name}`, 'POST', body);
  },

  /* ── Global UI Notifications ── */
  showToast(msg, type = 'info') {
    let t = document.getElementById('cbt-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'cbt-toast';
      document.body.appendChild(t);
    }
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', danger: '🚨' };
    t.innerHTML = `${icons[type] || 'ℹ️'} ${msg}`;
    t.className = 'show ' + type;
    setTimeout(() => { t.className = t.className.replace('show', '').trim(); }, 3500);
  },

  /* ════════════════════════════════════════════════════════════════════
     v5 — ROLE-AWARE NAVIGATION & PAGE ACCESS MAP
     Public visitors see only the public portal (take exam, verify, home).
     Teaching tools live behind the Teacher login; governance tools behind
     the Admin login. Nothing internal is reachable from the public nav,
     and internal pages bounce to the right login when opened cold.
     (Row-level security remains the real enforcement server-side; this
     mapping is the honest user experience on top of it.)
     ════════════════════════════════════════════════════════════════════ */
  PUBLIC_PAGES: ['index.html', 'student.html', 'certificate.html', 'offline.html', 'feature_guide.html'],
  /* NAV categories decide which workspace's menu a page shows. teacher.html
     and admin.html are deliberately NOT guard-redirected — they carry their
     own login screens and would otherwise bounce onto themselves. */
  TEACHER_PAGES: ['teacher.html', 'cbt-multi.html', 'cbt-prompts.html', 'question-types.html'],
  ADMIN_PAGES: ['admin.html', 'admin-data.html', 'disaster-recovery.html', 'storage.html',
                'platform-health.html', 'status-manager.html', 'settings.html', 'license.html',
                'activity_log.html', 'link_checker.html', 'deployment_validator.html', 'client-monitor.html'],
  /* GUARD categories decide who may open a page cold. */
  GUARD_TEACHER_PAGES: ['cbt-multi.html', 'cbt-prompts.html', 'question-types.html'],
  GUARD_ADMIN_PAGES: ['admin-data.html', 'disaster-recovery.html', 'storage.html',
                      'platform-health.html', 'status-manager.html', 'settings.html', 'license.html',
                      'activity_log.html', 'link_checker.html', 'deployment_validator.html', 'client-monitor.html'],

  pageName() {
    return (window.location.pathname.split('/').pop() || 'index.html').split(/[?#]/)[0];
  },

  sessionRole() {
    const s = this.getSession();
    if (!s || !s.access_token) return null;
    const meta = (s.user && s.user.user_metadata) || {};
    const appMeta = (s.user && s.user.app_metadata) || {};
    return String(appMeta.role || meta.role || (s.profile && s.profile.role) || 'teacher').toLowerCase();
  },

  /* Redirect cold visitors of internal pages to the matching login. */
  guardPageAccess() {
    const page = this.pageName();
    if (this.PUBLIC_PAGES.indexOf(page) !== -1) return true;
    const s = this.getSession();
    const authed = !!(s && s.access_token);
    const teacherPage = this.GUARD_TEACHER_PAGES.indexOf(page) !== -1;
    const adminPage = this.GUARD_ADMIN_PAGES.indexOf(page) !== -1;
    if ((teacherPage || adminPage) && !authed) {
      const login = adminPage ? 'admin.html' : 'teacher.html';
      const next = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
      window.location.replace(login + '?next=' + next);
      return false;
    }
    /* a teacher-role account opening an admin-only tool is bounced politely
       to the admin login (admins and super_admins pass) */
    if (adminPage && authed) {
      const role = this.sessionRole();
      if (['admin', 'super_admin'].indexOf(role) === -1) {
        window.location.replace('admin.html?next=' + encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search));
        return false;
      }
    }
    return true;
  },

  /* ── Header Binding (role-aware) ── */
  bindHeader() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;
    const page = this.pageName();
    const authed = !!(this.getSession() && this.getSession().access_token);
    const role = authed ? this.sessionRole() : null;
    const isAdmin = authed && ['admin', 'super_admin'].indexOf(role) !== -1;

    const PUBLIC_NAV = [
      { href: 'index.html', label: '🏠 Home' },
      { href: 'student.html', label: '📝 Take Exam' },
      { href: 'certificate.html', label: '🏅 Verify Result' }
    ];
    const TEACHER_NAV = [
      { href: 'teacher.html', label: '👨‍🏫 Dashboard' },
      { href: 'cbt-multi.html', label: '🧪 Multi-Subject' },
      { href: 'cbt-prompts.html', label: '🤖 AI Prompts' },
      { href: 'question-types.html', label: '📖 Type Guide' }
    ];
    const ADMIN_NAV = [
      { href: 'admin.html', label: '🛡️ Admin' },
      { href: 'admin-data.html', label: '💾 Data & Sync' },
      { href: 'disaster-recovery.html', label: '🚨 Recovery' },
      { href: 'storage.html', label: '📦 Storage' },
      { href: 'platform-health.html', label: '🩺 Health' },
      { href: 'status-manager.html', label: '👥 Roles' },
      { href: 'settings.html', label: '⚙️ Settings' },
      { href: 'license.html', label: '📜 License' },
      { href: 'client-monitor.html', label: '📡 Clients' },
      { href: 'activity_log.html', label: '📊 Audit' }
    ];

    let links;
    if (this.TEACHER_PAGES.indexOf(page) !== -1) {
      /* inside the teacher workspace: teacher tools + admin tools when admin */
      links = TEACHER_NAV.concat(isAdmin ? ADMIN_NAV : []);
      links = [{ href: 'index.html', label: '🏠 Home' }].concat(links);
    } else if (this.ADMIN_PAGES.indexOf(page) !== -1) {
      /* inside the admin workspace: admin tools + teacher tools (admins teach too) */
      links = ADMIN_NAV.concat(TEACHER_NAV.slice(1));
      links = [{ href: 'index.html', label: '🏠 Home' }].concat(links);
    } else {
      /* public surface: only the public portal, plus login entry points */
      links = PUBLIC_NAV.slice();
      if (authed) {
        links.push({ href: 'teacher.html', label: '👨‍🏫 Teacher Hub' });
        if (isAdmin) links.push({ href: 'admin.html', label: '🛡️ Admin' });
      }
    }

    nav.innerHTML = links.map(l => `
      <a href="${l.href}" class="nav-btn ${page === l.href ? 'active' : ''}">${l.label}</a>
    `).join('') +
    (authed
      ? `<button class="nav-btn" onclick="App.signOutUI()" title="Sign out">🚪 Sign out</button>`
      : `<a href="teacher.html" class="nav-btn" title="Teacher and admin sign-in">🔐 Staff Login</a>`) +
    `<button class="nav-btn" onclick="App.toggleTheme()" title="Toggle Dark/Light mode">🌓</button>`;
  },

  signOutUI() {
    if (!confirm('Sign out of this dashboard on this device?')) return;
    this.clearSession();
    try { localStorage.removeItem('cbt_theme'); } catch (e) {}
    location.href = 'index.html';
  },

  /* ── Formatting Helpers ── */
  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  decodeMeta(str) {
    if (!str || !str.includes('|')) return { subject: str || 'General', cls: '—', term: '—', topic: '—', type: '—', session: '—', passmark: 50 };
    const p = str.split('|');
    return {
      subject: p[0] || '—',
      cls: p[1] || '—',
      term: p[2] || '—',
      topic: p[3] || '—',
      type: p[4] || '—',
      session: p[5] || '—',
      passmark: parseInt(p[6]) || 50
    };
  }
};

window.App = App;
window.showToast = (msg, type) => App.showToast(msg, type);
window.escapeHtml = (s) => App.escapeHtml(s);
window.decodeMeta = (s) => App.decodeMeta(s);

document.addEventListener('DOMContentLoaded', () => App.init());

/* ── PWA install enforcer (GOSA-style persistent prompts) on every page ── */
(function () {
  if (document.querySelector('script[src="pwa_install_enforcer.js"]')) return;
  var s = document.createElement('script');
  s.src = 'pwa_install_enforcer.js';
  document.head.appendChild(s);
})();
