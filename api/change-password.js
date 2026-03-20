// api/change-password.js — Vercel Serverless Function
// Permet au fondateur de changer le mot de passe de n'importe quel acteur
// Sécurité : vérifie le mot de passe fondateur ET le session token avant toute modification

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Vérifier session token
  const sessionToken = req.headers['x-session-token'];
  const sessionPayload = verifySession(sessionToken);
  if (!sessionPayload || (sessionPayload.login !== 'fondateur' && sessionPayload.role !== 'fondateur')) {
    return res.status(403).json({ error: 'Réservé au fondateur' });
  }

  const { founderPassword, role, newPassword, newLogin } = req.body || {};

  // 2. Vérifier champs
  const validRoles = ['fondateur', 'gerant', 'rga', 'fallou'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }
  if (!newPassword && !newLogin) {
    return res.status(400).json({ error: 'Saisir un nouvel identifiant et/ou un nouveau mot de passe' });
  }
  if (newPassword && newPassword.length < 6) {
    return res.status(400).json({ error: 'Nouveau mot de passe trop court (6 car. min)' });
  }
  if (newLogin && !/^[a-z0-9_]{3,}$/.test(newLogin)) {
    return res.status(400).json({ error: 'Identifiant invalide (3+ caractères, minuscules/chiffres/_)' });
  }
  if (!founderPassword) {
    return res.status(400).json({ error: 'Mot de passe fondateur requis' });
  }

  // 3. Re-vérifier le mot de passe fondateur (double sécurité)
  const currentFounderPwd = process.env.PWD_FONDATEUR;
  if (founderPassword !== currentFounderPwd) {
    return res.status(401).json({ error: 'Mot de passe fondateur incorrect' });
  }

  // 4. Mettre à jour le mot de passe dans Vercel via l'API
  // Vercel ne permet pas de modifier les env vars depuis une Serverless Function
  // → On stocke les overrides dans un Google Sheet dédié (Config_Passwords)
  // → Au login, /api/auth vérifie d'abord Config_Passwords puis les env vars
  try {
    const token = await getGoogleToken();
    const SID_FONDATEUR = process.env.SID_FONDATEUR;

    // Auto-créer la feuille Config_Passwords si elle n'existe pas encore
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SID_FONDATEUR}?fields=sheets.properties.title`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meta = await metaRes.json();
    const sheets = (meta.sheets || []).map(s => s.properties.title);
    if (!sheets.includes('Config_Passwords')) {
      // Créer la feuille
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SID_FONDATEUR}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Config_Passwords' } } }] }),
      });
      // Ajouter la ligne d'en-tête
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SID_FONDATEUR}/values/Config_Passwords!A1:D1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [['role', 'pwd_encoded', 'updated_at', 'login_override']] }),
      });
    }

    // Lire les overrides existants
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SID_FONDATEUR}/values/Config_Passwords!A:D`;
    const readRes = await fetch(readUrl, { headers: { Authorization: `Bearer ${token}` } });
    const readData = await readRes.json();
    const rows = (readData.values || []).filter(r => r[0] !== 'role'); // ignorer l'en-tête

    // Trouver la ligne existante pour ce rôle
    // rows est sans l'en-tête, mais dans Sheets la ligne 1 = en-tête, données à partir de ligne 2
    let targetSheetRow = -1;
    let existingPwdEncoded = '';
    let existingLoginOverride = '';
    rows.forEach((row, i) => {
      if (row[0] === role) {
        targetSheetRow = i + 2; // +1 pour index 1-based, +1 pour l'en-tête
        existingPwdEncoded = row[1] || '';
        existingLoginOverride = row[3] || '';
      }
    });

    const timestamp = new Date().toISOString();
    const pwdEncoded = newPassword
      ? Buffer.from(newPassword).toString('base64')
      : existingPwdEncoded;
    const loginOverride = newLogin !== undefined ? newLogin : existingLoginOverride;

    const rowData = [role, pwdEncoded, timestamp, loginOverride];

    if (targetSheetRow >= 0) {
      // Mettre à jour la ligne existante
      const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SID_FONDATEUR}/values/Config_Passwords!A${targetSheetRow}:D${targetSheetRow}?valueInputOption=USER_ENTERED`;
      await fetch(writeUrl, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [rowData] }),
      });
    } else {
      // Ajouter une nouvelle ligne
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SID_FONDATEUR}/values/Config_Passwords!A:D:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      await fetch(appendUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [rowData] }),
      });
    }

    const parts = [];
    if (newPassword) parts.push('mot de passe mis à jour');
    if (newLogin)    parts.push(`identifiant → ${newLogin}`);
    return res.status(200).json({ ok: true, message: `${role} : ${parts.join(' + ')}` });

  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur : ' + e.message });
  }
}

// Cache token
let _tokenCache = { token: null, exp: 0 };
async function getGoogleToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.exp - 60000) return _tokenCache.token;
  const privateKey = process.env.SA_PRIVATE_KEY.replace(/\\n/g, '\n');
  const clientEmail = process.env.SA_CLIENT_EMAIL;
  const now = Math.floor(Date.now() / 1000);
  const crypto = require('crypto');
  const h = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ iss:clientEmail, scope:'https://www.googleapis.com/auth/spreadsheets', aud:'https://oauth2.googleapis.com/token', exp:now+3600, iat:now }));
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(h+'.'+p);
  const sig = sign.sign(privateKey,'base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${h}.${p}.${sig}`,
  });
  const d = await r.json();
  if (d.access_token) { _tokenCache = { token:d.access_token, exp:Date.now()+(d.expires_in*1000) }; return d.access_token; }
  return null;
}
function b64u(s) { return Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); }

function verifySession(token) {
  if (!token) return null;
  try {
    const crypto = require('crypto');
    const [payloadB64, hmac] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'boanr_dev_secret')
      .update(JSON.stringify(payload)).digest('hex');
    try { if(!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null; }
    catch { if(hmac !== expected) return null; }
    return payload;
  } catch { return null; }
}
