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
    this.injectShellStyles();
    if (!this.guardPageAccess()) return;
    this.initTheme();
    this.restoreSession();
    this.bindHeader();
    this.bindShell();
    this.bindPalette();
    this.bindUpdateWatcher();
    this.injectEngines();
    this.loadPublicSettings().then(() => {
      this.applyAccessibility();
      const bt = document.querySelector('#app-shell .shell-brand-title');
      if (bt) bt.textContent = this.institutionName || bt.textContent;
      this.renderAnnouncement();
    });
    if (window.FreeTierKeeper) {
      FreeTierKeeper.ping();
    }
    this.guardSession();
  },

  /* PHASE 12M — injectShellStyles(): every page running app.js automatically
     gets shell.css (sidebar, palette, announcements, update pill, chips).
     Fixes the "not well-rendered" bug on pages that don't link style.css
     (certificate, feature guide, link checker): the components were injected
     but had no styles. Component selectors only — the page's own design is
     never touched. */
  injectShellStyles() {
    if (document.querySelector('link[href="assets/css/shell.css"]')) return;
    try {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'assets/css/shell.css';
      document.head.appendChild(l);
    } catch (e) { /* never block the page */ }
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
    const s = this.getBestSession(); /* 12M: guard the ACTIVE persona */
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
                'platform-health.html', 'status-manager.html', 'settings.html',
                'activity_log.html', 'link_checker.html', 'deployment_validator.html'],
  /* GUARD categories decide who may open a page cold. */
  GUARD_TEACHER_PAGES: ['cbt-multi.html', 'cbt-prompts.html', 'question-types.html'],
  GUARD_ADMIN_PAGES: ['admin-data.html', 'disaster-recovery.html', 'storage.html',
                      'platform-health.html', 'status-manager.html', 'settings.html',
                      'activity_log.html', 'link_checker.html', 'deployment_validator.html'],

  pageName() {
    let p = (window.location.pathname.split('/').pop() || 'index.html').split(/[?#]/)[0];
    /* PHASE 12K — clean-URL normalization. Hosts like Vercel serve /storage
       for storage.html (HTTP 308). Without this, EVERY page-name comparison
       (access guards, shell, chatbot, help, license guard) silently failed
       under clean URLs: guarded admin pages rendered to anonymous visitors,
       page-aware help fell back to generic text, and an expired platform
       locked even the admin sign-in. */
    if (p && !/\.[a-z0-9]+$/i.test(p)) p += '.html';
    return p;
  },

  /* PHASE 12M FIX — role resolution.
     BUG: this used getSession(), which prefers the 'cbt_session' TEACHER
     alias, and defaulted every role-less session to 'teacher'. An admin
     (whose saved session carries no user_metadata.role) was therefore
     misread as a teacher on every governance page and bounced back to the
     admin dashboard. Fixes:
     1. resolve the BEST session (admin preferred), never a stale alias;
     2. a session stored under 'cbt_admin_session' is admin BY CONSTRUCTION
        (admin.html verifies ADMIN_EMAIL / profiles.is_admin before saving)
        — so it resolves to admin/super_admin even without metadata;
     3. a JWT 'role'/'user_role' claim is honoured when present. */
  sessionRole() {
    const fromMeta = (sess, fallback) => {
      const meta = (sess.user && sess.user.user_metadata) || {};
      const appMeta = (sess.user && sess.user.app_metadata) || {};
      let r = appMeta.role || meta.role || (sess.profile && sess.profile.role);
      if (!r && sess.access_token) {
        try {
          const payload = JSON.parse(atob(String(sess.access_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          r = payload.role || payload.user_role || null;
        } catch (e) {}
      }
      return String(r || fallback).toLowerCase();
    };
    const admin = this.getAdminSession();
    if (admin && admin.access_token) {
      const r = fromMeta(admin, 'admin');
      return r === 'teacher' ? 'admin' : r; /* an admin-panel session never downgrades */
    }
    const s = this.getTeacherSession() || this.getSession();
    if (!s || !s.access_token) return null;
    return fromMeta(s, 'teacher');
  },

  /* Redirect cold visitors of internal pages to the matching login. */
  guardPageAccess() {
    const page = this.pageName();
    if (this.PUBLIC_PAGES.indexOf(page) !== -1) return true;
    const s = this.getBestSession(); /* 12M: admin session is never masked by a stale teacher alias */
    const authed = !!(s && s.access_token);
    const teacherPage = this.GUARD_TEACHER_PAGES.indexOf(page) !== -1;
    const adminPage = this.GUARD_ADMIN_PAGES.indexOf(page) !== -1;
    if ((teacherPage || adminPage) && !authed) {
      const login = adminPage ? 'admin.html' : 'teacher.html';
      const next = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
      window.location.replace(login + '?next=' + next);
      return false;
    }
    /* PHASE 12M FIX: an authenticated teacher opening an admin-only tool is
       no longer dumped on the admin login (it read as being "logged out") —
       they return to their own hub with a friendly denial banner and stay
       signed in. Admins and super_admins pass. Anonymous visitors still go
       to the admin sign-in (they need an account). */
    if (adminPage && authed) {
      const role = this.sessionRole();
      if (['admin', 'super_admin'].indexOf(role) === -1) {
        window.location.replace('teacher.html?denied=' + encodeURIComponent(page));
        return false;
      }
    }
    return true;
  },


  /* ═══════════════════════════════════════════════════════════════════
     PHASE 12J — bindShell(): the unified sidebar navigation pane.
     Pages with their own workspace sidebar (teacher.html, admin.html) and
     the fullscreen student runner / landing keep their layouts; EVERY other
     internal page (governance console, guides, tools) gets this persistent,
     role-aware sidebar so navigation is always one click away — the pane
     never "disappears" between pages again. ═════════════════════════════ */
  SHELL_SKIP: ['student.html', 'index.html', 'offline.html', 'teacher.html', 'admin.html'],

  /* Role-aware navigation model — the single source of truth shared by the
     sidebar shell (12J) and the global search palette (12K). */
  navGroups(authed, isAdmin) {
    return [
      { name: 'Portal', items: [
        { href: 'index.html', label: '🏠 Home' },
        { href: 'student.html', label: '📝 Student Portal' },
        { href: 'certificate.html', label: '🏅 Verify Certificate' }
      ] },
      ...(authed ? [{ name: 'Teacher Workspace', items: [
        { href: 'teacher.html', label: '👨‍🏫 Teacher Hub' },
        { href: 'cbt-multi.html', label: '🧪 Multi-Subject Builder' },
        { href: 'cbt-prompts.html', label: '🤖 AI Prompts Studio' },
        { href: 'question-types.html', label: '📖 Question Types Guide' }
      ] }] : []),
      ...(isAdmin ? [{ name: 'Governance Console', items: [
        { href: 'admin.html', label: '🛡️ Admin Panel' },
        { href: 'admin-data.html', label: '💾 Data & Drive Sync' },
        { href: 'disaster-recovery.html', label: '🚨 Disaster Recovery' },
        { href: 'storage.html', label: '📦 Storage Manager' },
        { href: 'platform-health.html', label: '🩺 Platform Health' },
        { href: 'status-manager.html', label: '👥 Roles & Approvals' },
        { href: 'settings.html', label: '🛠️ Platform Settings' },
        { href: 'activity_log.html', label: '📊 Audit Trail' }
      ] }] : []),
      { name: 'Tools & Guides', items: [
        { href: 'feature_guide.html', label: '🗺️ Feature Guide' },
        { href: 'link_checker.html', label: '🔗 Link Checker' },
        { href: 'deployment_validator.html', label: '✅ Deployment Validator' }
      ] }
    ];
  },

  bindShell() {
    const page = this.pageName();
    if (this.SHELL_SKIP.indexOf(page) !== -1) return;
    if (document.getElementById('app-shell')) return;

    const sess = this.getBestSession(); /* 12M: never masked by a stale alias */
    const authed = !!(sess && sess.access_token);
    const role = authed ? this.sessionRole() : null;
    const isAdmin = authed && ['admin', 'super_admin'].indexOf(role) !== -1;
    const isTeacher = authed && !isAdmin;
    const GROUPS = this.navGroups(authed, isAdmin);

    /* 12K breadcrumbs — always-visible "you are here" trail */
    let crumbGroup = '', crumbLabel = page;
    for (const g of GROUPS) for (const l of g.items) {
      if (l.href === page) { crumbGroup = g.name; crumbLabel = l.label; }
    }

    const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const email = (sess && sess.user && sess.user.email) || '';
    const licChip = isAdmin
      ? '<div class="shell-lic" id="shell-lic"><span class="shell-lic-dot"></span><span id="shell-lic-text">Subscription: checking…</span></div>'
      : '';
    const userChip = authed
      ? '<div class="shell-user"><div class="shell-user-avatar">' + esc((email[0] || '?').toUpperCase()) + '</div>' +
        '<div class="shell-user-meta"><div class="shell-user-email" title="' + esc(email) + '">' + esc(email) + '</div>' +
        '<div class="shell-user-role">' + (isAdmin ? 'Administrator' : 'Teacher') + '</div></div>' +
        '<button class="shell-signout" id="shell-signout" title="Sign out">⎋</button></div>'
      : '';

    const aside = document.createElement('aside');
    aside.id = 'app-shell';
    aside.innerHTML =
      '<div class="shell-brand"><img src="assets/img/hmg-academy-logo.png" alt="" onerror="this.style.display=\'none\'">' +
      '<div><div class="shell-brand-title">' + esc(this.institutionName || 'HMG CBT Pro') + '</div>' +
      '<div class="shell-brand-sub">' + (isAdmin ? 'Admin workspace' : isTeacher ? 'Teacher workspace' : 'Platform tools') + '</div></div></div>' +
      (crumbGroup ? '<div class="shell-crumbs" aria-label="Breadcrumb"><a href="index.html">🏠 Home</a><span>›</span><span>' + esc(crumbGroup) + '</span><span>›</span><span class="crumb-here">' + crumbLabel + '</span></div>' : '') +
      '<nav class="shell-nav">' +
      GROUPS.map(g =>
        '<div class="shell-group"><div class="shell-group-title">' + g.name + '</div>' +
        g.items.map(l => {
          const gated = !isAdmin && this.GUARD_ADMIN_PAGES.indexOf(l.href) !== -1;
          return '<a href="' + l.href + '" class="shell-link' + (l.href === page ? ' active' : '') + '" title="' + (gated ? 'Administrator sign-in required' : '') + '">' + l.label + (gated ? ' 🔒' : '') + '</a>';
        }).join('') +
        '</div>'
      ).join('') +
      '</nav>' +
      licChip +
      userChip +
      '<div class="shell-foot">' +
      '<button class="shell-foot-btn" id="shell-search-btn" title="Search everywhere (Ctrl+K)">🔎 Search</button>' +
      '<button class="shell-foot-btn" onclick="history.length>1?history.back():location.href=\'index.html\'" title="Go back to the previous page">↩ Back</button>' +
      '<button class="shell-foot-btn" onclick="window.SiteHelp&&SiteHelp.openHelpCenter?SiteHelp.openHelpCenter():window.ChatBot&&ChatBot.open?ChatBot.open():void 0" title="Open the help center">📘 Help</button>' +
      '</div>';
    if (isAdmin) {
      const fillLic = (txt, cls) => {
        const el = document.getElementById('shell-lic');
        if (!el) return;
        el.className = 'shell-lic ' + (cls || '');
        const t = document.getElementById('shell-lic-text');
        if (t) t.textContent = txt;
      };
      if (window.SiteSub && SiteSub.status) {
        SiteSub.status().then((info) => {
          const r = (info && info.result) || {};
          const model = (info && info.lic && info.lic.model) || 'subscription';
          const st = r.state || 'unknown';
          const days = r.daysLeft != null ? (r.daysLeft + 'd left') : (r.daysOver != null ? (r.daysOver + 'd over') : '');
          const label = model === 'lifetime' ? 'Lifetime licence' : 'Subscription: ' + st;
          const cls = ['active', 'lifetime'].indexOf(st) !== -1 ? 'ok' : (st === 'warning' || st === 'grace' ? 'warn' : (st === 'unknown' ? '' : 'bad'));
          fillLic(label + (days ? ' — ' + days : '') + ' · renewals: HMG Concepts', cls);
        }).catch(() => fillLic('Subscription: managed by HMG Concepts', ''));
      } else fillLic('Subscription: managed by HMG Concepts', '');
    }
    const so = aside.querySelector('#shell-signout');
    if (so) so.onclick = () => this.signOutEverywhere();
    const sb = aside.querySelector('#shell-search-btn');
    if (sb) sb.onclick = () => { const f = document.getElementById('app-palette-fab'); if (f) f.click(); };

    const backdrop = document.createElement('div');
    backdrop.id = 'app-shell-backdrop';
    backdrop.onclick = () => { aside.classList.remove('open'); backdrop.classList.remove('open'); };

    const toggle = document.createElement('button');
    toggle.id = 'app-shell-toggle';
    toggle.setAttribute('aria-label', 'Open navigation');
    toggle.innerHTML = '☰';
    toggle.onclick = () => { aside.classList.toggle('open'); backdrop.classList.toggle('open'); };

    document.body.appendChild(aside);
    document.body.appendChild(backdrop);
    document.body.appendChild(toggle);
    document.body.classList.add('app-has-shell');
  },

  /* 12K — one-click sign out from any shell page: clears every session
     alias this ecosystem writes, then lands on Home. */
  signOutEverywhere() {
    for (const k of ['cbt_session', 'cbt_teacher_session', 'cbt_pro_session', 'cbt_admin_session']) {
      try { localStorage.removeItem(k); } catch (e) {}
    }
    location.href = 'index.html';
  },

  /* ═══════════════════════════════════════════════════════════════════
     PHASE 12L — PWA update watcher.
     After a redeploy, browsers keep serving the previous service-worker
     cache until the new worker installs — visitors (and owners) can stare
     at a "still broken" site that is actually fixed. This watches for a
     newly installed worker and offers a one-tap Refresh. Never appears on
     the exam runner or the offline screen. */
  bindUpdateWatcher() {
    const page = this.pageName();
    if (page === 'student.html' || page === 'offline.html') return; // never interrupt an exam
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.getRegistration) return;
    try {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        if (reg.waiting && navigator.serviceWorker.controller) this.showUpdateBanner();
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) this.showUpdateBanner();
          });
        });
      }).catch(() => {});
      setInterval(() => {
        try { navigator.serviceWorker.getRegistration().then((r) => { if (r && r.update) r.update(); }).catch(() => {}); } catch (e) {}
      }, 15 * 60 * 1000);
    } catch (e) { /* never break a page over the watcher */ }
  },
  showUpdateBanner() {
    if (document.getElementById('app-update-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'app-update-banner';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '🚀 <b>A new version is available.</b> ' +
      '<button class="ub-refresh">Refresh now</button> <button class="ub-later" aria-label="Dismiss">Later</button>';
    const rBtn = bar.querySelector('.ub-refresh'), lBtn = bar.querySelector('.ub-later');
    if (rBtn) rBtn.onclick = () => location.reload();
    if (lBtn) lBtn.onclick = () => bar.remove();
    document.body.appendChild(bar);
  },

  /* ═══════════════════════════════════════════════════════════════════
     PHASE 12K — Global command palette (Ctrl+K / ⌘K).
     Jump to any page, tool or action you are allowed to use. Role-aware
     (same model as the sidebar), zero dependencies, works offline. */
  bindPalette() {
    const page = this.pageName();
    if (page === 'student.html' || page === 'offline.html') return; // never intercept the exam runner
    if (document.getElementById('app-palette')) return;

    const sess = this.getBestSession(); /* 12M */
    const authed = !!(sess && sess.access_token);
    const isAdmin = authed && ['admin', 'super_admin'].indexOf(this.sessionRole()) !== -1;

    const ACTIONS = [
      { label: '🎨 Toggle light / dark theme', run: () => this.toggleTheme() },
      { label: '📘 Open the Help Center', run: () => { if (window.SiteHelp && SiteHelp.openHelpCenter) SiteHelp.openHelpCenter(); else if (window.CBTChatbot && CBTChatbot.open) CBTChatbot.open(); } },
      { label: '✅ Run the Deployment Validator', href: 'deployment_validator.html' },
      { label: '🏅 Verify a certificate', href: 'certificate.html' },
      { label: '📝 Take an exam (student portal)', href: 'student.html' },
      authed ? { label: '👋 Sign out', run: () => this.signOutEverywhere() }
             : { label: '🔑 Teacher sign-in', href: 'teacher.html' }
    ].filter(Boolean);
    if (!authed) ACTIONS.push({ label: '🛡️ Admin sign-in', href: 'admin.html' });

    const wrap = document.createElement('div');
    wrap.id = 'app-palette';
    wrap.style.display = 'none';
    wrap.innerHTML =
      '<div class="palette-backdrop"></div>' +
      '<div class="palette-box" role="dialog" aria-label="Global search">' +
      '<input id="app-palette-input" type="text" placeholder="Search pages, tools and actions…  (Ctrl+K)" autocomplete="off" spellcheck="false">' +
      '<div id="app-palette-list" role="listbox"></div>' +
      '<div class="palette-hint">↑↓ navigate · Enter opens · Esc closes</div></div>';
    document.body.appendChild(wrap);

    const fab = document.createElement('button');
    fab.id = 'app-palette-fab';
    fab.title = 'Search (Ctrl+K)';
    fab.setAttribute('aria-label', 'Open global search');
    fab.innerHTML = '🔎';
    document.body.appendChild(fab);

    const input = wrap.querySelector('#app-palette-input');
    const list = wrap.querySelector('#app-palette-list');
    let entries = [], active = 0;

    const close = () => { wrap.style.display = 'none'; };
    const open = () => { wrap.style.display = 'block'; input.value = ''; render(''); input.focus(); };

    const render = (q) => {
      q = String(q || '').trim().toLowerCase();
      const pages = [];
      for (const g of this.navGroups(authed, isAdmin))
        for (const l of g.items) pages.push({ label: l.label, sub: g.name, href: l.href });
      const all = pages.concat(ACTIONS.map(a => ({ label: a.label, sub: 'Action', href: a.href, run: a.run })))
        .filter(e => !q || (e.label + ' ' + e.sub).toLowerCase().indexOf(q) !== -1)
        .slice(0, 14);
      entries = all; active = 0;
      list.innerHTML = all.length
        ? all.map((e, i) => '<div class="palette-item' + (i === 0 ? ' sel' : '') + '" data-i="' + i + '">' +
            '<span class="palette-item-label">' + e.label + '</span><span class="palette-item-sub">' + e.sub + '</span></div>').join('')
        : '<div class="palette-empty">No matches — try “storage”, “exam” or “help”.</div>';
      Array.prototype.forEach.call(list.querySelectorAll('.palette-item'), el => { el.onclick = () => pick(+el.getAttribute('data-i')); });
    };
    const pick = (i) => { const e = entries[i]; if (!e) return; close(); if (e.run) e.run(); else location.href = e.href; };
    const move = (d) => {
      if (!entries.length) return;
      active = (active + d + entries.length) % entries.length;
      Array.prototype.forEach.call(list.querySelectorAll('.palette-item'), (el, i) => el.classList.toggle('sel', i === active));
    };

    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(active); }
      else if (e.key === 'Escape') { close(); }
    });
    wrap.querySelector('.palette-backdrop').onclick = close;
    fab.onclick = () => { wrap.style.display === 'block' ? close() : open(); };
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
        e.preventDefault();
        wrap.style.display === 'block' ? close() : open();
      }
    });
  },

  /* ═══════════════════════════════════════════════════════════════════
     PHASE 12K — platform-wide announcement banner.
     Admins broadcast a notice from Settings → Announcement Banner; it
     renders at the top of every page for every visitor. Dismissal is
     per-message and per-browser-session (a new message always shows).
     Stored inside the existing branding JSONB — zero schema migration. */
  announcementHash(msg) {
    let h = 0;
    for (let i = 0; i < msg.length; i++) h = (h * 31 + msg.charCodeAt(i)) >>> 0;
    return h;
  },
  renderAnnouncement() {
    try {
      const b = (this.publicSettings && this.publicSettings.branding) || {};
      const msg = String(b.announcement || '').trim();
      if (!msg || msg.length < 3) return;
      const level = b.announcement_level === 'warning' ? 'warning' : 'info';
      const key = 'cbt_announce_' + this.announcementHash(msg);
      try { if (sessionStorage.getItem(key) === '1') return; } catch (e) {}
      const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const bar = document.createElement('div');
      bar.className = 'announce-banner ' + level;
      bar.setAttribute('role', 'status');
      bar.innerHTML = '<span class="announce-icon">' + (level === 'warning' ? '⚠️' : '📣') + '</span>' +
        '<span class="announce-text">' + esc(msg) + '</span>' +
        '<button class="announce-dismiss" aria-label="Dismiss announcement">✕</button>';
      bar.querySelector('.announce-dismiss').onclick = () => {
        try { sessionStorage.setItem(key, '1'); } catch (e) {}
        bar.remove();
      };
      document.body.insertBefore(bar, document.body.firstChild);
    } catch (e) { /* an announcement must never break a page */ }
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
