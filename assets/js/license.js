/* ====================================================================
   license.js — HMG CBT Pro Cryptographic Offline License Engine
   ====================================================================
   Validates perpetual, whitelabel, and institution site licenses
   completely offline using HMAC-SHA256 signature verification.
   No phone-home server required.
   ==================================================================== */
const SiteLicense = {
  MASTER_SALT: 'HMG_CBT_PRO_V10_SECURE_SALT_2026',

  async parseToken(tokenStr) {
    if (!tokenStr || typeof tokenStr !== 'string') return { valid: false, error: 'Empty token' };
    const parts = tokenStr.trim().split('.');
    if (parts.length !== 2) return { valid: false, error: 'Invalid token structure' };

    try {
      const payloadJson = decodeURIComponent(escape(atob(parts[0])));
      const payload = JSON.parse(payloadJson);
      const signature = parts[1];
      const expectedSig = await this.computeSig(parts[0]);

      if (signature !== expectedSig) {
        return { valid: false, error: 'Cryptographic signature mismatch. License is forged or corrupted.' };
      }

      if (payload.exp && payload.exp < Date.now()) {
        return { valid: false, expired: true, error: `License expired on ${new Date(payload.exp).toLocaleDateString()}` };
      }

      return {
        valid: true,
        payload,
        institutionName: payload.inst || payload.name || 'Licensed School',
        plan: payload.plan || 'Enterprise Perpetual',
        issuedAt: payload.iat ? new Date(payload.iat).toISOString() : null,
        expiresAt: payload.exp ? new Date(payload.exp).toISOString() : 'Never (Perpetual)',
        maxCandidates: payload.max_candidates || 'Unlimited',
        allowedDomains: payload.domains || ['*']
      };
    } catch (e) {
      return { valid: false, error: 'Malformed license token: ' + e.message };
    }
  },

  async computeSig(data) {
    const enc = new TextEncoder();
    const keyData = enc.encode(this.MASTER_SALT);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    return Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async generateToken(institutionName, plan = 'Enterprise Perpetual', domains = ['*'], maxCandidates = 0, expiryDays = 0) {
    const payload = {
      inst: institutionName,
      plan,
      domains,
      max_candidates: maxCandidates || 'Unlimited',
      iat: Date.now(),
      exp: expiryDays > 0 ? (Date.now() + expiryDays * 86400000) : null
    };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const sig = await this.computeSig(b64);
    return `${b64}.${sig}`;
  }
};

window.SiteLicense = SiteLicense;
