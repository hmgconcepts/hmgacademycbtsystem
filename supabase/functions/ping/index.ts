// ============================================================
// Supabase Edge Function "ping" — Free-Tier Keep-Alive (V4.0)
// ------------------------------------------------------------
// Deploy once with the Supabase CLI (see SUPABASE_FREE_TIER_PROTECTION.md,
// Layer 3), then point a free external monitor (UptimeRobot, cron-job.org)
// at this URL. Every call performs a REAL database write through the
// sc_keep_alive() RPC — exactly what the free-tier inactivity detector
// counts — so the project can never be paused for inactivity, even if
// nobody opens the platform for months.
//
// Deploy:
//   supabase functions deploy ping --no-verify-jwt
//
// Call:
//   https://YOUR_PROJECT_REF.supabase.co/functions/v1/ping
//
// Response:
//   { "status":"alive", "timestamp":"…", "database_heartbeat":"heartbeat written at …" }
// ============================================================

// Supabase injects SUPABASE_URL automatically; the anon key is safe to
// embed in an Edge Function (it is the public key — RLS still applies).
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (_req) => {
  const now = new Date().toISOString();

  // 1) Preferred: the dedicated heartbeat RPC — a genuine UPDATE whose
  //    returned timestamp proves the write happened.
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sc_keep_alive`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_src: 'edge-ping' })
    });
    if (r.ok) {
      const body = await r.text();
      if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(body)) {
        return new Response(
          JSON.stringify({
            status: 'alive',
            timestamp: now,
            database_heartbeat: `heartbeat written at ${body.replace(/"/g, '').slice(0, 32)}`,
            message: 'Supabase free-tier keep-alive ping — database activity confirmed.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch (_) { /* fall through */ }

  // 2) Legacy RPC (older schemas)
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/keep_alive_ping`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });
    if (r.ok) {
      return new Response(
        JSON.stringify({
          status: 'alive',
          timestamp: now,
          database_heartbeat: `heartbeat written at ${now}`,
          message: 'Supabase free-tier keep-alive ping — database activity confirmed (legacy RPC).'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (_) { /* fall through */ }

  // 3) Read-only fallback (still proves the project is awake)
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/institutions?select=id&limit=1`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (r.ok) {
      return new Response(
        JSON.stringify({
          status: 'alive',
          timestamp: now,
          database_heartbeat: 'read-only touch (run COMPLETE_SCHEMA_SQL.sql for verified writes)',
          message: 'Supabase reachable (read-only touch).'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ status: 'error', timestamp: now, message: `Supabase answered HTTP ${r.status}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ status: 'error', timestamp: now, message: String(e) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
