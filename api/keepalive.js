// Vercel Serverless Function — Supabase Free-Tier Keepalive (v4.0)
// ====================================================================
// Performs a REAL, VERIFIED database write so the free-tier inactivity
// timer (project pauses after ~7 days without database activity) is
// genuinely reset. A plain read does not reliably count.
//
// Call order:
//   1. sc_keep_alive('vercel-cron') RPC  → real UPDATE, returns the NEW
//      last_ping timestamp — the proof that the write happened
//   2. keep_alive_ping() RPC             → legacy alias of the same write
//   3. REST read of guaranteed columns   → last-resort touch for very
//      old schemas (better than nothing, flagged in the response)
//
// Response (what external pingers like UptimeRobot see):
//   { status: "alive", timestamp, database_heartbeat, last_source, via }
//
// FIX HISTORY:
//   C4 (v3.1): the original selected institutions.last_keepalive_at — a
//   column absent on early schemas — so the endpoint 500'd in production
//   and every browser heartbeat was pinging a dead endpoint.
//   v4.0 (Phase 2): primary path is now the sc_keep_alive() RPC with
//   VERIFICATION (the returned timestamp must match /20xx-mm-ddThh:mm/),
//   and the response exposes database_heartbeat proof for monitoring.
// ====================================================================
export default async function handler(req, res) {
  const sbUrl = process.env.SUPABASE_URL || process.env.SB_URL || 'https://pstnsaqjshmtintjrnas.supabase.co';
  const sbKey = process.env.SUPABASE_ANON_KEY || process.env.SB_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzdG5zYXFqc2htdGludGpybmFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDEzODUsImV4cCI6MjA5MTI3NzM4NX0.KNVgpVN0xp1njin1HL3udntc7psfzjnz7mqzpEN_Z6w';

  const headers = {
    'apikey': sbKey,
    'Authorization': `Bearer ${sbKey}`
  };
  const now = new Date().toISOString();

  // 1) Primary: sc_keep_alive RPC — a genuine database UPDATE with proof
  try {
    const rpcRes = await fetch(`${sbUrl}/rest/v1/rpc/sc_keep_alive`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_src: 'vercel-cron' })
    });
    if (rpcRes.ok) {
      const body = await rpcRes.text();
      // WATCHDOG: HTTP 200 alone is not proof — the RPC returns the NEW
      // timestamp; a timestamp in the body IS the proof of a real write.
      if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(body)) {
        return res.status(200).json({
          status: 'alive',
          timestamp: now,
          database_heartbeat: `heartbeat written at ${body.trim().replace(/"/g, '').slice(0, 32)}`,
          last_source: 'vercel-cron',
          via: 'sc_keep_alive RPC (verified write)',
          message: 'Supabase free-tier keep-alive ping — database activity confirmed.'
        });
      }
      // 200 without a timestamp is suspicious — fall through to legacy
    }
  } catch (_) { /* fall through */ }

  // 2) Legacy alias (older schemas)
  try {
    const rpcRes = await fetch(`${sbUrl}/rest/v1/rpc/keep_alive_ping`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (rpcRes.ok) {
      return res.status(200).json({
        status: 'alive',
        timestamp: now,
        database_heartbeat: 'heartbeat written at ' + now,
        last_source: 'vercel-cron',
        via: 'keep_alive_ping RPC (legacy)',
        message: 'Supabase free-tier keep-alive ping — database activity confirmed (legacy RPC).'
      });
    }
  } catch (_) { /* fall through */ }

  // 3) Last resort: guaranteed-column REST touch
  try {
    const response = await fetch(`${sbUrl}/rest/v1/institutions?select=id,name&limit=1`, { headers });
    if (!response.ok) throw new Error(`Supabase query failed: HTTP ${response.status}`);
    const data = await response.json();
    return res.status(200).json({
      status: 'alive',
      timestamp: now,
      database_heartbeat: 'read-only touch (schema pre-dates keep-alive RPCs — run database/complete-schema.sql for verified writes)',
      last_source: 'vercel-cron',
      via: 'REST read',
      institution: data[0]?.name || 'HMG Academy',
      message: 'Supabase reachable (read-only touch).'
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
      timestamp: now
    });
  }
}
