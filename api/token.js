// api/token.js — Vercel Serverless Function
// Signe le JWT RS256 avec la clé SA et retourne l'access_token Google

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Vérifier le session token
  const sessionToken = req.headers['x-session-token'];
  if (!verifySession(sessionToken)) {
    return res.status(401).json({ error: 'Session invalide' });
  }

  try {
    const privateKey = process.env.SA_PRIVATE_KEY.replace(/\\n/g, '\n');
    const clientEmail = process.env.SA_CLIENT_EMAIL;
    const now = Math.floor(Date.now() / 1000);

    // Construire le JWT
    const header  = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }));
    const sigInput = header + '.' + payload;

    // Signer avec la clé privée (Node.js crypto)
    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(sigInput);
    const signature = sign.sign(privateKey, 'base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const jwt = sigInput + '.' + signature;

    // Échanger contre un access_token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const data = await response.json();

    if (data.error) return res.status(400).json({ error: data.error_description });
    return res.status(200).json({ access_token: data.access_token, expires_in: data.expires_in });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function verifySession(token) {
  if (!token) return false;
  try {
    const crypto = require('crypto');
    const [payloadB64, hmac] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    if (payload.exp < Date.now()) return false;
    const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'boanr_secret_dev')
      .update(JSON.stringify(payload)).digest('hex');
    // Comparaison timing-safe
    try {
      return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
    } catch { return hmac === expected; }
  } catch { return false; }
}
