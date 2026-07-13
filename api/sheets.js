// api/sheets.js — Vercel Serverless Function
// Proxy Google Sheets : lit et écrit via la SA sécurisée côté serveur

import { createSign, createHmac, timingSafeEqual } from 'node:crypto';

export default async function handler(req, res) {
  const reqOrigin = req.headers.origin || '';
  const originOk = isAllowedOrigin(reqOrigin);
  if (!originOk) {
    return res.status(403).json({ error: 'Origin non autorise' });
  }

  if (reqOrigin) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sessionToken = req.headers['x-session-token'];
  const sessionPayload = verifySession(sessionToken);
  if (!sessionPayload) {
    return res.status(401).json({ error: 'Session invalide' });
  }

  const { action, sid, range, values, data, requests } = req.body || {};
  if (!action || !sid || !range) {
    if (['batchUpdateSpreadsheet', 'batchUpdateValues'].indexOf(action) === -1) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }
  }

  if (['read', 'append', 'write', 'clear', 'batchUpdateSpreadsheet', 'batchUpdateValues'].indexOf(action) === -1) {
    return res.status(400).json({ error: 'Action inconnue' });
  }

  var auth = authorizeSheetsAccess(sessionPayload, sid, range, action, { data: data, requests: requests });
  if (!auth.ok) {
    return res.status(403).json({ error: auth.err || 'Accès refusé' });
  }

  const token = await getGoogleToken();
  if (!token) return res.status(500).json({ error: "Impossible d'obtenir le token Google" });

  // ⚠️ Encoder UNIQUEMENT le nom de la feuille, pas la plage A1
  // encodeURIComponent(':') = '%3A' → Sheets API rejette avec "unable to parse range"
  const parts = String(range || '').split('!');
  const enc = encodeURIComponent(parts[0] || '') + (parts[1] ? '!' + parts[1] : '');
  const baseUrl = enc ? `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${enc}` : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  try {
    let response, data;

    if (action === 'read') {
      response = await fetch(baseUrl + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING', { headers });
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

    } else if (action === 'clear') {
      response = await fetch(`${baseUrl}:clear`, {
        method: 'POST', headers,
        body: '{}',
      });
      data = await response.json();
      return res.status(200).json({ ok: !data.error, error: data.error?.message });

    } else if (action === 'batchUpdateValues') {
      response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}/values:batchUpdate?valueInputOption=USER_ENTERED`, {
        method: 'POST', headers,
        body: JSON.stringify({ data: data || [] }),
      });
      data = await response.json();
      return res.status(200).json({ ok: !data.error, error: data.error?.message });

    } else if (action === 'batchUpdateSpreadsheet') {
      response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sid}:batchUpdate`, {
        method: 'POST', headers,
        body: JSON.stringify({ requests: requests || [] }),
      });
      data = await response.json();
      return res.status(200).json({ ok: !data.error, error: data.error?.message });

    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ── Google Token ──
let _tokenCache = { token: null, exp: 0 };
async function getGoogleToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.exp - 60000) return _tokenCache.token;
  const pk = process.env.SA_PRIVATE_KEY;
  if (!pk) return null;
  const privateKey = pk.replace(/\\n/g, '\n');
  const clientEmail = process.env.SA_CLIENT_EMAIL;
  if (!clientEmail) return null;
  const now = Math.floor(Date.now() / 1000);
  const header  = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64u(JSON.stringify({ iss:clientEmail, scope:'https://www.googleapis.com/auth/spreadsheets', aud:'https://oauth2.googleapis.com/token', exp:now+3600, iat:now }));
  const sign = createSign('RSA-SHA256');
  sign.update(header+'.'+payload);
  const sig = sign.sign(privateKey,'base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const jwt = header+'.'+payload+'.'+sig;
  const r = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` });
  const d = await r.json();
  if (d.access_token) { _tokenCache = { token:d.access_token, exp:Date.now()+(d.expires_in*1000) }; return d.access_token; }
  return null;
}

function b64u(str) { return Buffer.from(str).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); }

function verifySession(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  if (!token) return null;
  try {
    const [payloadB64, hmac] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    const expected = createHmac('sha256', secret)
      .update(JSON.stringify(payload)).digest('hex');
    try {
      if (!timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null;
    } catch {
      if (hmac !== expected) return null;
    }
    return payload;
  } catch {
    return null;
  }
}

var KNOWN_SHEETS = [
  'Config_Cycle', 'Config_App', 'Config_Passwords',
  'Fiche_Quotidienne', 'SOP_Check', 'Stock_Nourriture', 'Incidents', 'Pesees', 'Sante_Mortalite',
  'Hebdomadaire', 'KPI_Mensuels', 'KPI_Hebdo', 'Historique_Cycles', 'SOP_Protocol',
  'Ventes_Betes', 'Suivi_Marche', 'Suivi_Aliments'
];

var ROLE_WRITABLE_SHEETS = {
  fondateur: ['*'],
  gerant: ['Fiche_Quotidienne', 'SOP_Check', 'Stock_Nourriture', 'Incidents', 'Pesees', 'Sante_Mortalite', 'Hebdomadaire', 'KPI_Mensuels', 'KPI_Hebdo'],
  rga: ['SOP_Check', 'Incidents', 'Sante_Mortalite', 'Hebdomadaire', 'Config_Cycle'],
  fallou: ['Suivi_Marche', 'Suivi_Aliments', 'Ventes_Betes']
};

function normalizeRole(role) {
  if (role === 'commerciale') return 'fallou';
  return role;
}

function getAllowedSidsForRole(role) {
  var r = normalizeRole(role);
  if (r === 'fondateur') {
    return [process.env.SID_FONDATEUR, process.env.SID_GERANT, process.env.SID_FALLOU].filter(Boolean);
  }
  if (r === 'gerant') {
    return [process.env.SID_GERANT, process.env.SID_FONDATEUR].filter(Boolean);
  }
  if (r === 'rga') {
    return [process.env.SID_RGA, process.env.SID_GERANT, process.env.SID_FONDATEUR].filter(Boolean);
  }
  if (r === 'fallou') {
    return [process.env.SID_FALLOU, process.env.SID_FONDATEUR].filter(Boolean);
  }
  return [];
}

function extractSheetName(range) {
  var s = String(range || '');
  var parts = s.split('!');
  return (parts[0] || '').trim();
}

function canWriteSheet(role, sheet) {
  var writable = ROLE_WRITABLE_SHEETS[role] || [];
  return writable.indexOf('*') >= 0 || writable.indexOf(sheet) >= 0;
}

function parseAddSheetRequests(reqs) {
  return (reqs || []).map(function(r) {
    return r && r.addSheet && r.addSheet.properties && r.addSheet.properties.title;
  }).filter(Boolean);
}

function authorizeSheetsAccess(payload, sid, range, action, extra) {
  extra = extra || {};
  var role = normalizeRole(payload && payload.role);
  if (!role) return { ok: false, err: 'Session sans rôle' };

  var allowedSids = getAllowedSidsForRole(role);
  if (allowedSids.indexOf(String(sid)) === -1) {
    return { ok: false, err: 'SID non autorisé pour ce rôle' };
  }

  if (action === 'batchUpdateSpreadsheet') {
    var addTitles = parseAddSheetRequests(extra.requests);
    if (!addTitles.length) return { ok: false, err: 'batchUpdate non autorisé' };
    for (var i = 0; i < addTitles.length; i++) {
      var t = addTitles[i];
      if (KNOWN_SHEETS.indexOf(t) === -1) return { ok: false, err: 'Feuille non autorisée' };
      if (!canWriteSheet(role, t)) return { ok: false, err: 'Écriture non autorisée pour ce rôle' };
    }
    return { ok: true };
  }

  if (action === 'batchUpdateValues') {
    var arr = extra.data || [];
    if (!arr.length) return { ok: false, err: 'Données batch manquantes' };
    for (var j = 0; j < arr.length; j++) {
      var rg = arr[j] && arr[j].range;
      var sh = extractSheetName(rg);
      if (!sh || KNOWN_SHEETS.indexOf(sh) === -1) return { ok: false, err: 'Feuille non autorisée' };
      if (!canWriteSheet(role, sh)) return { ok: false, err: 'Écriture non autorisée pour ce rôle' };
    }
    return { ok: true };
  }

  var sheet = extractSheetName(range);
  if (!sheet || KNOWN_SHEETS.indexOf(sheet) === -1) {
    return { ok: false, err: 'Feuille non autorisée' };
  }

  if (action === 'append' || action === 'write' || action === 'clear') {
    if (!canWriteSheet(role, sheet)) return { ok: false, err: 'Écriture non autorisée pour ce rôle' };
  }

  return { ok: true };
}

function isAllowedOrigin(origin) {
  if (!origin) return true;

  var configured = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(function(x) { return x.trim(); })
    .filter(Boolean);
  if (configured.indexOf(origin) >= 0) return true;

  return origin.endsWith('.vercel.app')
    || origin === 'https://vercel.app'
    || origin === 'http://localhost:3000'
    || origin === 'http://localhost:5000';
}
