// HMG Academy CBT Pro — PWA Install Enforcer v2 (GOSA-style persistence)
// ---------------------------------------------------------------------------
// Two layers of encouragement, matching the GOSA Portal behaviour:
//   1. A PERSISTENT bottom banner on every page — Install button, per-browser
//      instructions, dismissable for 48 hours, back again next session.
//   2. A weekly modal gate for devices that keep ignoring the banner
//      (double-confirm "never ask again" is honoured from then on).
// Everything is free and browser-native; browsers control the final install
// button, and the script is honest about that. Runs on every page, self-injects
// its own styles, and hides itself completely once the app is installed.
// ---------------------------------------------------------------------------
(function () {
  if (window.__hmgInstallEnforcer) return;   // loaded once per page, even via app.js + a script tag
  window.__hmgInstallEnforcer = true;
  const KEY = 'hmg_cbt_install_ack_v4';
  const KEY_BANNER = 'hmg_cbt_banner_dismissed';
  const KEY_NEVER = 'hmg_cbt_install_never';
  const BANNER_HOURS = 48;          // banner returns 48h after dismissal
  const MODAL_DAYS = 7;             // modal returns weekly until installed

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isStandalone()) { localStorage.setItem(KEY, 'installed:' + Date.now()); return; }

  let deferredPrompt = null;
  let installed = /installed/.test(localStorage.getItem(KEY) || '');
  let neverAsk = localStorage.getItem(KEY_NEVER) === '1';

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showBanner(true);
  });
  window.addEventListener('appinstalled', () => {
    installed = true; deferredPrompt = null;
    localStorage.setItem(KEY, 'installed:' + Date.now());
    hideBanner(); hideGate();
    toast('🎉 App installed! Find it on your home screen / desktop.');
  });

  /* ── styles (self-injected) ── */
  function css() {
    if (document.getElementById('hmg-install-style')) return;
    const st = document.createElement('style');
    st.id = 'hmg-install-style';
    st.textContent = `
      #hmg-install-banner{position:fixed;left:0;right:0;bottom:0;z-index:2147482000;transform:translateY(110%);transition:transform .35s ease;
        background:#101014;border-top:1px solid #2c2c33;box-shadow:0 -12px 40px rgba(0,0,0,.45);
        font-family:Inter,system-ui,-apple-system,'Segoe UI',Arial,sans-serif;padding:12px 16px calc(12px + env(safe-area-inset-bottom));
        display:flex;gap:12px;align-items:center;flex-wrap:wrap}
      #hmg-install-banner.show{transform:translateY(0)}
      #hmg-install-banner .ib-ico{font-size:26px;line-height:1}
      #hmg-install-banner .ib-txt{flex:1;min-width:220px}
      #hmg-install-banner .ib-title{color:#f4f4f5;font-size:13.5px;font-weight:800}
      #hmg-install-banner .ib-sub{color:#a1a1aa;font-size:12px;margin-top:2px;line-height:1.45}
      #hmg-install-banner .ib-sub b{color:#e4e4e7}
      .ib-btn{border:0;border-radius:10px;padding:10px 16px;font-weight:900;cursor:pointer;font-size:13px}
      .ib-btn.primary{background:#10b981;color:#000}
      .ib-btn.ghost{background:transparent;color:#d4d4d8;border:1px solid #3f3f46}
      .ib-btn.mini{padding:6px 10px;font-size:11px;font-weight:700;color:#71717a;background:transparent;border:0}
      #hmg-install-gate{position:fixed;inset:0;background:rgba(0,0,0,.86);backdrop-filter:blur(8px);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;
        font-family:Inter,system-ui,-apple-system,'Segoe UI',Arial,sans-serif;color:#f4f4f5}
      #hmg-install-card{max-width:520px;width:100%;background:#18181b;border:1px solid #27272a;border-radius:22px;box-shadow:0 24px 80px rgba(0,0,0,.55);padding:24px}
      #hmg-install-card h2{margin:0 0 8px;font-size:20px;line-height:1.2}
      #hmg-install-card p,#hmg-install-card li{color:#a1a1aa;line-height:1.65;font-size:13px}
      #hmg-install-card ul{padding-left:18px;margin:10px 0 16px}
      .hmg-install-actions{display:flex;gap:9px;flex-wrap:wrap}
      .hmg-install-note{font-size:11px!important;color:#f59e0b!important;margin-top:12px!important}
      @media print{#hmg-install-banner,#hmg-install-gate{display:none!important}}
    `;
    document.head.appendChild(st);
  }

  function toast(msg) {
    let t = document.getElementById('hmg-install-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'hmg-install-toast';
      t.style.cssText = 'position:fixed;bottom:96px;left:50%;transform:translateX(-50%);background:#18181b;color:#f4f4f5;border:1px solid #27272a;padding:12px 18px;border-radius:10px;font-weight:600;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.4);z-index:2147483200;max-width:90vw;font-family:Inter,system-ui,sans-serif;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    setTimeout(() => { t.textContent = ''; }, 5000);
  }

  /* ── LAYER 1: persistent banner ── */
  function bannerEl() { return document.getElementById('hmg-install-banner'); }
  function hideBanner() { const b = bannerEl(); if (b) b.classList.remove('show'); }

  function showBanner(force) {
    if (installed || neverAsk) return;
    const dismissedAt = Number(localStorage.getItem(KEY_BANNER) || 0);
    if (!force && dismissedAt && Date.now() - dismissedAt < BANNER_HOURS * 3600e3) return;
    css();
    let b = bannerEl();
    if (!b) {
      b = document.createElement('div');
      b.id = 'hmg-install-banner';
      b.setAttribute('role', 'dialog');
      b.setAttribute('aria-label', 'Install the app');
      const ios = isIOS();
      b.innerHTML = `
        <span class="ib-ico">📲</span>
        <div class="ib-txt">
          <div class="ib-title">Install ${document.title.split('•')[0].trim() || 'the CBT app'} on this device</div>
          <div class="ib-sub">${ios
            ? 'Tap <b>Share</b> ⬆️ then <b>Add to Home Screen</b> — it opens full-screen like a real exam app.'
            : 'It opens full-screen like a real exam app, loads faster and keeps working on weak networks.'}</div>
        </div>
        <button class="ib-btn primary" data-ib="install">${ios ? 'How to install' : 'Install app'}</button>
        <button class="ib-btn ghost" data-ib="later">Later</button>
        <button class="ib-btn mini" data-ib="never" title="Stop asking on this device">never ask</button>
      `;
      document.body.appendChild(b);
      b.addEventListener('click', (e) => {
        const act = e.target.dataset && e.target.dataset.ib;
        if (act === 'install') promptInstall();
        else if (act === 'later') { localStorage.setItem(KEY_BANNER, String(Date.now())); hideBanner(); }
        else if (act === 'never') {
          if (confirm('Stop reminding this device to install the app?\n\nYou can always install later from your browser menu — Install app / Add to Home Screen.')) {
            localStorage.setItem(KEY_NEVER, '1'); neverAsk = true; hideBanner(); hideGate();
          }
        }
      });
      requestAnimationFrame(() => b.classList.add('show'));
    } else {
      b.classList.add('show');
    }
  }

  async function promptInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => ({}));
      if (choice.outcome === 'accepted') toast('Installing… 🎉');
      else localStorage.setItem(KEY_BANNER, String(Date.now()));
      deferredPrompt = null;
      hideBanner();
      return;
    }
    if (isIOS()) { showIOSHelp(); return; }
    toast('Use your browser menu: ⋮ → "Install app" or "Add to Home screen".');
  }

  function showIOSHelp() {
    css();
    let m = document.getElementById('hmg-ios-help');
    if (m) m.remove();
    m = document.createElement('div');
    m.id = 'hmg-ios-help';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:2147483100;display:flex;align-items:center;justify-content:center;padding:18px;font-family:Inter,system-ui,sans-serif;';
    m.innerHTML = `<div style="max-width:420px;width:100%;background:#18181b;border:1px solid #27272a;border-radius:20px;padding:22px;color:#f4f4f5;">
      <div style="font-size:2.6rem;text-align:center;">📱</div>
      <h3 style="margin:8px 0 4px;text-align:center;font-size:16px;">Install on iPhone / iPad</h3>
      <ol style="color:#a1a1aa;font-size:13px;line-height:1.9;padding-left:20px;margin:12px 0;">
        <li>Open this page in <b style="color:#e4e4e7">Safari</b> (not Chrome).</li>
        <li>Tap the <b style="color:#e4e4e7">Share</b> button <span style="font-size:1.2rem">⬆️</span> at the bottom.</li>
        <li>Scroll and tap <b style="color:#e4e4e7">Add to Home Screen</b>.</li>
        <li>Tap <b style="color:#e4e4e7">Add</b> — done.</li>
      </ol>
      <button style="width:100%;border:0;border-radius:10px;padding:11px;background:#10b981;color:#000;font-weight:900;cursor:pointer;font-size:13px;" onclick="document.getElementById('hmg-ios-help').remove()">Got it</button>
    </div>`;
    document.body.appendChild(m);
  }

  /* ── LAYER 2: weekly modal gate ── */
  function gateEl() { return document.getElementById('hmg-install-gate'); }
  function hideGate() { const g = gateEl(); if (g) g.remove(); }

  function showGate(force) {
    if (installed || neverAsk) return;
    if (gateEl()) return;
    const ack = localStorage.getItem(KEY);
    const age = ack ? Date.now() - Number((ack.split(':')[1] || 0)) : Infinity;
    if (!force && ack && age < MODAL_DAYS * 864e5) return;
    css();
    const div = document.createElement('div');
    div.id = 'hmg-install-gate';
    div.innerHTML = `<div id="hmg-install-card" role="dialog" aria-modal="true" aria-labelledby="hmg-install-title">
      <h2 id="hmg-install-title">📲 Install the CBT platform on this device</h2>
      <p>Exams and teaching tools work best installed — it runs full-screen, loads the exam shell faster, and survives weak networks better than a browser tab.</p>
      <ul>
        <li><b>Android / Chrome, Edge, Samsung Internet:</b> tap <b>Install app</b> or menu ⋮ → Add to Home screen.</li>
        <li><b>iPhone / iPad:</b> open in Safari → Share ⬆️ → <b>Add to Home Screen</b>.</li>
        <li><b>Windows / Mac / Chromebook:</b> click the install icon in the address bar, or menu → Install.</li>
      </ul>
      <div class="hmg-install-actions">
        <button class="ib-btn primary" id="hmg-install-now">Install now</button>
        <button class="ib-btn ghost" id="hmg-install-done">I've installed it</button>
        <button class="ib-btn ghost" id="hmg-install-later">Remind me later</button>
      </div>
      <p class="hmg-install-note">Browsers control the final install button — if nothing appears, use the menu instructions above. You'll be reminded weekly until it's installed.</p>
    </div>`;
    document.body.appendChild(div);
    document.getElementById('hmg-install-now').onclick = () => { promptInstall(); };
    document.getElementById('hmg-install-done').onclick = () => { localStorage.setItem(KEY, 'ack:' + Date.now()); hideGate(); };
    document.getElementById('hmg-install-later').onclick = () => { localStorage.setItem(KEY, 'later:' + Date.now()); hideGate(); };
  }

  /* keep the banner honest: if we later discover it's installed, remove it */
  if (window.matchMedia) {
    try {
      const mq = window.matchMedia('(display-mode: standalone)');
      const onChange = (e) => { if (e.matches) { installed = true; hideBanner(); hideGate(); } };
      mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    } catch (e) { /* older browsers */ }
  }

  /* schedule: banner soon after load, gate a little later */
  window.addEventListener('load', () => {
    setTimeout(() => showBanner(false), 6000);
    setTimeout(() => showGate(false), 15000);
  });

  window.HMGShowInstallGate = () => showGate(true);
  window.HMGShowInstallBanner = () => showBanner(true);
})();
