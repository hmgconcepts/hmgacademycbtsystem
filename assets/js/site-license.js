/* ====================================================================
   site-license.js — HMG CBT Pro Subscription & Site License Engine
   ====================================================================
   WHY THIS FILE EXISTS
   --------------------
   CBT platforms are delivered two ways (see the Generator wizard):
     1. ONE-TIME (lifetime): the client pays once and owns the platform
        forever. This engine then does nothing visible.
     2. SUBSCRIPTION: the client pays per cycle (monthly / termly /
        annual / custom). This engine evaluates the license on every
        page load and, after expiry + grace days, locks the portal with
        a full renewal screen until the proprietor extends it.

   It complements — never replaces — assets/js/license.js, the OFFLINE
   perpetual-token engine (HMAC token pasted into the License page).
   That engine stays fully functional; this one adds subscription
   lifecycle, a remote registry source and tamper evidence.

   DATA SOURCES (evaluated in priority order)
     A. Remote License Registry (optional) — platform_settings.license_registry_url:
        a small JSON on HMG-controlled hosting the client cannot edit.
        If reachable it WINS. Format:
          { "sites": { "<slug>": { "model": "subscription", "status": "active",
            "expires_on": "YYYY-MM-DD", "grace_days": 7, "plan": "...",
            "renew_url": "..." } } }
     B. Supabase table public.site_license (row id = 1). Public read via
        RLS so the lock screen renders pre-login; writes require the
        owner through the save_site_license() RPC.
     C. Offline token / local cache fallback (last known good state).

   ANTI-BYPASS LAYERS (honest, layered — not unbreakable)
     • The guard runs on EVERY page (script tag after app.js), before
       the page boots, re-checks every 15 minutes and on tab refocus.
     • The lock and banner render inside a closed Shadow DOM and are
       re-attached by a MutationObserver if the node is removed.
     • Rows saved through the License page carry a SHA-256 signature
       (model|expires_on|grace_days|status|salt); a casually hand-edited
       database row fails verification and is flagged in the console.
     • The remote registry (when configured) lives on hosting the client
       does not control, so local edits cannot suspend or extend terms.
     Honest note: code on client-controlled hosting can never be 100%
     tamper-proof; these layers make bypass non-trivial and keep the
     authoritative status in the proprietor's hands.

   PUBLIC API (used by license.html and platform-health.html):
     SiteSub.evaluate(lic)      → {state, exp, daysLeft, ...}
     SiteSub.status()           → Promise<{source, lic, result}>
     SiteSub.signature(lic)     → Promise<hex>
     SiteSub.applyUi(res, lic)  → renders banner / lock as appropriate
     SiteSub.refresh()          → force re-evaluation now

   v5 — RENEWAL-ALWAYS-POSSIBLE + EXPIRED-BUT-ALIVE:
     • The guard now runs on EVERY page (public pages too — the engine
       finds the project credentials from App, window.SB_URL or the
       global SB_URL/SB_KEY lexical bindings).
     • The full lock screen is deliberately NOT shown on license.html
       and admin.html — the proprietor must always be able to sign in
       and renew from inside. Those pages show the banner instead.
     • The lock defers while a candidate has an exam in progress
       (examActive) — it appears after submission, never mid-paper.
     • When the state is grace/expired/suspended the engine fires a
       keepalive heartbeat too: an expired platform still generates
       real database activity, so Supabase NEVER pauses it for
       inactivity and renewal stays one click away.
   ==================================================================== */
(function () {
  'use strict';

  var LS_CACHE = 'cbt_site_license_cache_v1';
  var POLL_MS = 15 * 60 * 1000;       // re-check every 15 minutes
  var REGISTRY_TIMEOUT_MS = 3500;     // remote registry must answer fast
  var LS_LAST_CHECK = 'cbt_license_last_check';

  function cfg() {
    // The generator bakes window.CBT_LICENSE into generated platforms;
    // HMG's own deployment defaults to lifetime.
    var c = window.CBT_LICENSE || {};
    return {
      slug: c.slug || 'default',
      name: (window.App && App.institutionName) || c.name || 'this platform',
      model: c.model || 'lifetime',
      expires_on: c.expires_on || null,
      grace_days: (c.grace_days == null ? 7 : c.grace_days),
      status: c.status || 'active',
      plan: c.plan || '',
      renew_url: c.renew_url || '',
      salt: c.salt || 'HMG_CBT_PRO_V10_SECURE_SALT_2026',
      registry: c.registry || ''
    };
  }

  function normalize(raw) {
    raw = raw || {};
    return {
      model: (raw.model === 'subscription') ? 'subscription' : 'lifetime',
      plan: raw.plan || (raw.model === 'subscription' ? 'Subscription' : 'One-time purchase (lifetime ownership)'),
      cycle: raw.cycle || '',
      started_on: raw.started_on || '',
      expires_on: raw.expires_on || null,
      grace_days: (raw.grace_days == null ? 7 : Math.max(0, +raw.grace_days || 0)),
      status: raw.status === 'suspended' ? 'suspended' : 'active',
      renew_url: raw.renew_url || '',
      lock_message: raw.lock_message || '',
      signature: raw.signature || ''
    };
  }

  /** Core date/status evaluation — pure function, unit-testable. */
  function evaluate(raw) {
    var lic = normalize(raw);
    if (lic.model !== 'subscription') return { state: 'lifetime', lic: lic };
    if (lic.status !== 'active') return { state: 'suspended', lic: lic };
    if (!lic.expires_on) return { state: 'active', lic: lic };
    var now = new Date();
    var exp = new Date(String(lic.expires_on).slice(0, 10) + 'T23:59:59');
    if (isNaN(+exp)) return { state: 'active', lic: lic };
    var graceEnd = new Date(exp.getTime() + lic.grace_days * 86400000);
    if (now > graceEnd) {
      return { state: 'expired', lic: lic, exp: exp, daysOver: Math.max(1, Math.round((now - graceEnd) / 86400000)) };
    }
    if (now > exp) {
      return { state: 'grace', lic: lic, exp: exp, daysLeft: Math.max(1, Math.ceil((graceEnd - now) / 86400000)) };
    }
    var days = Math.ceil((exp - now) / 86400000);
    if (days <= 30) return { state: 'warning', lic: lic, exp: exp, daysLeft: days };
    return { state: 'active', lic: lic, exp: exp, daysLeft: days };
  }

  function sha256hex(text) {
    try {
      if (!window.crypto || !crypto.subtle) return Promise.resolve('');
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      }).catch(function () { return ''; });
    } catch (e) { return Promise.resolve(''); }
  }

  /** Tamper evidence: sha256(model|expires|grace|status|salt). */
  function signature(raw) {
    var lic = normalize(raw);
    return sha256hex([lic.model, lic.expires_on || '', lic.grace_days, lic.status, cfg().salt].join('|'));
  }

  function readCache() {
    try { return JSON.parse(localStorage.getItem(LS_CACHE) || 'null'); } catch (e) { return null; }
  }
  function writeCache(o) {
    try { localStorage.setItem(LS_CACHE, JSON.stringify(o)); } catch (e) { /* private mode */ }
  }

  /* ── Source A: remote registry (authoritative when configured) ── */
  function fromRegistry() {
    var c = cfg();
    if (!c.registry) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var ctl = ('AbortController' in window) ? new AbortController() : null;
      var t = setTimeout(function () { if (ctl) ctl.abort(); }, REGISTRY_TIMEOUT_MS);
      fetch(c.registry + (c.registry.indexOf('?') > -1 ? '&' : '?') + 'v=' + Date.now(),
           { signal: ctl ? ctl.signal : undefined, cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) {
          clearTimeout(t);
          var site = (j && j.sites && (j.sites[c.slug] || j.sites['default'])) || null;
          resolve(site);
        })
        .catch(function () { clearTimeout(t); resolve(null); }); // unreachable → fall through
    });
  }

  /* Project credentials, wherever the current page keeps them:
     internal pages use App.SB_URL/SB_KEY; public pages (student, index,
     certificate…) define global SB_URL/SB_KEY in their own scripts. */
  function sbCreds() {
    if (window.App && App.SB_URL && App.SB_KEY) return { u: App.SB_URL, k: App.SB_KEY };
    if (window.SB_URL && window.SB_KEY) return { u: window.SB_URL, k: window.SB_KEY };
    try { if (typeof SB_URL !== 'undefined' && typeof SB_KEY !== 'undefined') return { u: SB_URL, k: SB_KEY }; } catch (e) {}
    return null;
  }

  /* ── Source B: Supabase site_license row (public read) ── */
  function fromSupabase() {
    var c = sbCreds();
    if (!c) return Promise.resolve(null);
    return fetch(c.u + '/rest/v1/site_license?id=eq.1&select=model,plan,cycle,started_on,expires_on,grace_days,status,renew_url,lock_message,signature', {
      headers: { 'apikey': c.k, 'Authorization': 'Bearer ' + c.k }
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) { return (rows && rows.length) ? rows[0] : null; })
      .catch(function () { return null; });
  }

  /* A candidate is mid-exam on this tab → the lock must wait. */
  function examInProgress() {
    try {
      if (typeof examActive !== 'undefined' && examActive) return true;
      if (window.examActive) return true;
      if (document.body && document.body.getAttribute && document.body.getAttribute('data-exam-active') === '1') return true;
    } catch (e) {}
    return false;
  }

  /* Renewal pages never get the full lock — an admin must be able to sign
     in (admin.html) while expired. license.html exists only on the builder's
     master deployment; keeping it listed is harmless where it is absent. */
  function isRenewalPage() {
    var p = (window.location.pathname.split('/').pop() || 'index.html').split(/[?#]/)[0];
    if (p && !/\.[a-z0-9]+$/i.test(p)) p += '.html'; /* 12K: clean-URL hosts serve /storage for storage.html */
    return p === 'admin.html';
  }

  /* EXPIRED-BUT-ALIVE: keep the database warm even when the portal is
     locked, so Supabase never pauses the project and renewal is instant. */
  function keepAliveTouch() {
    try {
      if (window.FreeTierKeeper && typeof FreeTierKeeper.ping === 'function') { FreeTierKeeper.ping(); return; }
      var c = sbCreds();
      if (!c) return;
      fetch(c.u + '/rest/v1/rpc/sc_keep_alive', {
        method: 'POST',
        headers: { 'apikey': c.k, 'Authorization': 'Bearer ' + c.k, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_src: 'license-guard' })
      }).catch(function () {});
    } catch (e) {}
  }

  /* ── Full evaluation pipeline ── */
  function status() {
    return fromRegistry().then(function (regSite) {
      if (regSite) {
        var res = evaluate(regSite);
        return { source: 'registry', lic: normalize(regSite), result: res };
      }
      return fromSupabase().then(function (row) {
        if (row) {
          var res2 = evaluate(row);
          return { source: 'supabase', lic: normalize(row), result: res2 };
        }
        var fb = evaluate(cfg());
        return { source: 'fallback', lic: normalize(cfg()), result: fb };
      });
    }).then(function (out) {
      writeCache({ at: Date.now(), source: out.source, lic: out.lic, result: stripForCache(out.result) });
      verifySignature(out);
      return out;
    });
  }

  function stripForCache(res) {
    return { state: res.state, daysLeft: res.daysLeft || null, daysOver: res.daysOver || null };
  }

  function verifySignature(out) {
    if (out.source !== 'supabase' && out.source !== 'registry') return;
    var lic = out.lic;
    if (lic.model !== 'subscription' || !lic.signature) return; // unsigned = not tamper-checked (legacy rows)
    signature(lic).then(function (expected) {
      if (expected && lic.signature && expected !== lic.signature) {
        out.tampered = true;
        try { console.warn('[SiteLicense] signature mismatch — the license row may have been hand-edited.'); } catch (e) {}
      }
    });
  }

  /* ── UI: banner + full lock, rendered in a closed Shadow DOM so page
        styles/scripts cannot trivially remove them; a MutationObserver
        re-attaches the host if someone deletes the node. ── */
  var shadowHost = null, observer = null, lastUi = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function ensureShadow() {
    if (shadowHost && document.body.contains(shadowHost)) return shadowHost.shadowRoot;
    shadowHost = document.createElement('div');
    shadowHost.id = 'site-license-guard';
    shadowHost.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0;right:0;pointer-events:none;';
    var root = shadowHost.attachShadow ? shadowHost.attachShadow({ mode: 'closed' }) : shadowHost;
    (document.body || document.documentElement).appendChild(shadowHost);
    if (!observer && 'MutationObserver' in window) {
      observer = new MutationObserver(function () {
        if (shadowHost && !document.body.contains(shadowHost) && lastUi) {
          observer.disconnect(); observer = null; shadowHost = null;
          applyUi(lastUi.res, lastUi.lic);
        }
      });
      observer.observe(document.body, { childList: true });
    }
    return root;
  }

  function styles() {
    return ''
      + '.banner{position:fixed;top:0;left:0;right:0;pointer-events:auto;font:13px/1.5 system-ui,sans-serif;padding:10px 16px;text-align:center;color:#fff;}'
      + '.banner.warn{background:linear-gradient(90deg,#b45309,#d97706);}'
      + '.banner.grace{background:linear-gradient(90deg,#b91c1c,#ef4444);}'
      + '.banner a{color:#fff;font-weight:700;}'
      + '.lock{position:fixed;inset:0;pointer-events:auto;background:rgba(9,9,11,.97);color:#f4f4f5;display:flex;align-items:center;justify-content:center;font:15px/1.6 system-ui,sans-serif;}'
      + '.card{max-width:520px;margin:20px;padding:32px 28px;background:#18181b;border:1px solid #27272a;border-radius:16px;text-align:center;}'
      + '.card h2{margin:0 0 8px;font-size:22px;}'
      + '.card p{color:#a1a1aa;margin:8px 0 18px;}'
      + '.card .n{font-size:44px;margin-bottom:8px;}'
      + '.btn{display:inline-block;background:#10b981;color:#06281d;font-weight:700;padding:12px 26px;border-radius:10px;text-decoration:none;}'
      + '.small{font-size:12px;color:#71717a;margin-top:14px;}'
      + '.card a{color:#10b981;font-weight:700;}';
  }

  function applyUi(res, lic) {
    lastUi = { res: res, lic: lic };
    var state = res.state;
    if (state === 'lifetime' || state === 'active') return;

    /* EXPIRED-BUT-ALIVE: expired/grace/suspended platforms still touch the
       database so Supabase never pauses them — renewal stays instant. */
    if (state === 'grace' || state === 'expired' || state === 'suspended') keepAliveTouch();

    /* Never lock a candidate out of a paper mid-exam: retry after submission. */
    if ((state === 'expired' || state === 'suspended') && examInProgress()) {
      setTimeout(function () { status().then(function (o) { applyUi(o.result, o.lic); }); }, 60000);
      return;
    }

    var root = ensureShadow();
    if (!root) return;
    var styleEl = document.createElement('style');
    styleEl.textContent = styles();

    // Wipe previous content (except keep style fresh)
    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(styleEl);

    /* Renewal pages (license console, admin sign-in) never get the full
       lock — the proprietor must always be able to renew from inside. */
    if ((state === 'expired' || state === 'suspended') && isRenewalPage()) {
      var rb = document.createElement('div');
      rb.className = 'banner grace';
      /* PHASE 12: renewal is PROVIDER-MANAGED. Client deployments have no
         license console — and even where one exists (the builder's master),
         extensions are applied by the provider. Never advertise self-service. */
      rb.innerHTML = '🔒 ' + (state === 'suspended' ? 'Platform suspended' : 'Subscription expired') +
        ' — renewal is managed by the platform provider (HMG Concepts · WhatsApp +234 810 086 6322 · hismarvellousgrace@gmail.com).' +
        ' <a href="' + esc(lic.renew_url || '#') + '">Renew</a>';
      root.appendChild(rb);
      return;
    }

    if (state === 'warning' || state === 'grace') {
      var b = document.createElement('div');
      b.className = 'banner ' + (state === 'grace' ? 'grace' : 'warn');
      if (state === 'warning') {
        b.innerHTML = '⏳ Subscription expires in ' + (res.daysLeft || '?') + ' day(s). Renew to keep ' + esc(cfg().name) + ' running.';
      } else {
        b.innerHTML = '⚠️ Subscription EXPIRED — final grace period: ' + (res.daysLeft || '?') + ' day(s) left before the portal locks. <a href="' + esc(lic.renew_url || '#') + '">Renew now</a>';
      }
      root.appendChild(b);
      return;
    }

    // expired | suspended → full lock screen
    var l = document.createElement('div');
    l.className = 'lock';
    var msg = lic.lock_message || 'The subscription for this platform has expired. Contact the proprietor to renew access.';
    if (state === 'suspended') msg = lic.lock_message || 'This platform has been suspended by the proprietor.';
    l.innerHTML = '<div class="card">'
      + '<div class="n">🔒</div>'
      + '<h2>' + (state === 'suspended' ? 'Platform Suspended' : 'Subscription Expired') + '</h2>'
      + '<p>' + esc(msg) + '</p>'
      + '<p class="small">Renewal is quick and provider-managed: contact <b>HMG Concepts</b> (WhatsApp +234 810 086 6322 · hismarvellousgrace@gmail.com) or use the Renew button — the provider extends the platform remotely and access is restored instantly. Admin sign-in stays reachable at <a href="admin.html" style="color:#10b981;font-weight:700;">admin.html</a> while locked.</p>'
      + (lic.renew_url ? '<a class="btn" href="' + esc(lic.renew_url) + '" target="_blank" rel="noopener">Renew Subscription</a>' : '')
      + '<p class="small">' + esc(lic.plan || '') + (lic.expires_on ? ' · expired ' + esc(String(lic.expires_on).slice(0, 10)) : '') + '</p>'
      + '<p class="small">✅ Nothing is lost and this platform will NOT be paused — it is kept warm so renewal restores access instantly. Powered by HMG Academy Ecosystem</p>'
      + '</div>';
    root.appendChild(l);
  }

  /* ── Boot & periodic guard ── */
  var started = false;

  function boot() {
    if (started) return;
    started = true;

    // Re-check every 15 minutes while the tab stays open
    setInterval(function () { status().then(function (o) { applyUi(o.result, o.lic); }); }, POLL_MS);

    // Re-check when the tab regains focus (subscription may have been renewed)
    if ('visibilitychange' in document) {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
          var last = +(localStorage.getItem(LS_LAST_CHECK) || 0);
          if (Date.now() - last > 5 * 60 * 1000) status().then(function (o) { applyUi(o.result, o.lic); });
        }
      });
    }

    status().then(function (o) { applyUi(o.result, o.lic); });
  }

  function refresh() { return status().then(function (o) { applyUi(o.result, o.lic); return o; }); }

  // Boot once DOM is ready (script loads after app.js on every page)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ── Public API ── */
  window.SiteSub = {
    evaluate: evaluate,
    status: status,
    signature: signature,
    applyUi: applyUi,
    refresh: refresh,
    normalize: normalize
  };
})();
