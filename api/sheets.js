// api/sheets.js — Vercel Serverless Function
// Proxy Google Sheets : lit et écrit via la SA sécurisée côté serveur

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Vérifier session
  const sessionToken = req.headers['x-session-token'];
  if (!verifySession(sessionToken)) {
    return res.status(401).json({ error: 'Session invalide' });
  }

  const { action, sid, range, values } = req.body || {};
  if (!action || !sid || !range) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  // Obtenir un access_token Google frais
  const token = await getGoogleToken();
  if (!token) return res.status(500).json({ error: 'Impossible d\'obtenir le token Google' });

  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodeURIComponent(range)}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  try {
    let response, data;

    if (action === 'read') {
      response = await fetch(baseUrl, { headers });
      data = await response.json();
      return res.status(200).json({ ok: true, values: data.values || [] });

    } else if (action === 'append') {
      response = await fetch(`${baseUrl}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
        method: 'POST', headers,
        body: JSON.stringify({ values: [values] }),
      });
      data = await response.json();
      return res.status(200).json({ ok: !data.error, error: data.error?.message });

    } else if (action === 'write') {
      response = await fetch(`${baseUrl}?valueInputOption=USER_ENTERED`, {
        method: 'PUT', headers,
        body: JSON.stringify({ values: [values] }),
      });
      data = await response.json();
      return res.status(200).json({ ok: !data.error, error: data.error?.message });

    } else {
      return res.status(400).json({ error: 'Action inconnue' });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// Cache token en mémoire (durée vie de la fonction)
let _tokenCache = { token: null, exp: 0 };

async function getGoogleToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.exp - 60000) return _tokenCache.token;

  const privateKey = process.env.SA_PRIVATE_KEY.replace(/\\n/g, '\n');
  const clientEmail = process.env.SA_CLIENT_EMAIL;
  const now = Math.floor(Date.now() / 1000);

  const crypto = require('crypto');
  const header  = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64u(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  }));
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(header + '.' + payload);
  const sig = sign.sign(privateKey, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const jwt = header + '.' + payload + '.' + sig;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const d = await r.json();
  if (d.access_token) {
    _tokenCache = { token: d.access_token, exp: Date.now() + (d.expires_in * 1000) };
    return d.access_token;
  }
  return null;
}

function b64u(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function verifySession(token) {
  if (!token) return false;
  try {
    const crypto = require('crypto');
    const [payloadB64, hmac] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    if (payload.exp < Date.now()) return false;
    const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'boanr_dev_secret')
      .update(JSON.stringify(payload)).digest('hex');
    try { return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected)); }
    catch { return hmac === expected; }
  } catch { return false; }
}
