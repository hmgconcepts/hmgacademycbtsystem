// ═══════════════════════════════════════════════════════════════
// HMG Academy CBT Pro v3.1 — Service Worker (FIXED)
// ═══════════════════════════════════════════════════════════════
// Provides PWA app shell caching for offline functionality.
// Supabase API calls always use the network (not cached).
// FIXED v3.1: Removed references to non-existent files from cache.
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'hmg-cbt-shell-v12-phase12-v1'; // PHASE 12: subscription-integrity client mode, teacher-nav fix, multi-subject csv_data fix

// Core application shell assets — ONLY files that actually exist
const SHELL_ASSETS = [
  './',
  './index.html',
  './teacher.html',
  './student.html',
  './cbt-multi.html',
  './cbt-prompts.html',
  './question-types.html',
  './admin.html',
  './admin-data.html',
  './storage.html',
  './platform-health.html',
  './status-manager.html',
  './settings.html',
  /*BUILDER-ONLY*/'./license.html',/*BUILDER-ONLY-END*/
  './activity_log.html',
  './certificate.html',
  './deployment_validator.html',
  './feature_guide.html',
  './link_checker.html',
  './offline.html',
  './manifest.webmanifest',
  './hmg-icon.svg',
  './assets/hmg-academy-logo.png',
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/js/drive-sync.js',
  './assets/js/cbt-engine.js',
  './assets/js/cbt-types.js',
  './assets/js/cbt-exam-kit.js',
  './assets/js/cbt-richtext.js',
  './assets/js/license.js',
  './assets/js/keepalive.js',
  './assets/js/site-help.js',
  './assets/js/chatbot.js',
  './pwa_install_enforcer.js',
  './robots.txt',
  './sitemap.xml',
  './browserconfig.xml',
  './llms.txt',
  './database/further_maths_sample.csv',
  './database/complete-schema.sql'
];

// Install event: cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(
        SHELL_ASSETS.map(asset =>
          cache.add(asset).catch(err => {
            console.warn('[SW] Failed to cache:', asset, err.message);
          })
        )
      ))
      .then(() => self.skipWaiting())
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch event: network-first strategy with cache fallback
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept Supabase, CDN, or external API calls
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(req).then(res => {
      // Cache successful responses for offline access
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => {
      // Network failed — try cache
      return caches.match(req).then(cached => {
        if (cached) return cached;
        // For navigation requests, serve the offline page
        if (req.mode === 'navigate') {
          return caches.match('./offline.html')
            .then(page => page || caches.match('/offline.html'))
            .then(page => page || caches.match('offline.html'))
            .then(page => page || caches.match('./index.html'))
            .then(page => page || caches.match('/index.html'));
        }
        return new Response('Offline and not cached.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    })
  );
});
