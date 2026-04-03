// api/auth.js — Vercel Serverless Function v2
// Vérifie les credentials et retourne les infos du rôle

import { createHmac, createSign, timingSafeEqual } from 'node:crypto';

export default async function handler(req, res) {
  const USERS = {
    fondateur: { name:'Direction',      pwd: process.env.PWD_FONDATEUR, tabs:['dashboard','saisie','livrables','marche'], sid: process.env.SID_FONDATEUR },
    gerant:    { name:'Gerant terrain', pwd: process.env.PWD_GERANT,    tabs:['dashboard','saisie'],                      sid: process.env.SID_GERANT    },
    rga:       { name:'RGA',            pwd: process.env.PWD_RGA,       tabs:['dashboard','livrables'],                   sid: process.env.SID_RGA       },
    fallou:    { name:'Commerciale',    pwd: process.env.PWD_FALLOU,    tabs:['dashboard','marche'],                      sid: process.env.SID_FALLOU    },
  };

  // R-03 : restreindre CORS au domaine Vercel de production + localhost dev
  const allowedOrigins = [
    'https://boan-app-ur3x.vercel.app',
    'http://localhost:3000',
    'http://localhost:5000'
  ];
  const reqOrigin = req.headers.origin || '';
  if (reqOrigin && !allowedOrigins.includes(reqOrigin)) {
    return res.status(403).json({ ok: false, error: 'Origin non autorisé' });
  }
  res.setHeader('Access-Control-Allow-Origin', reqOrigin || 'https://boan-app-ur3x.vercel.app');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error: 'Method not allowed' });

  try {
    const { login, password } = req.body || {};
    if (!login || !password) {
      return res.status(400).json({ ok:false, error: 'Identifiants manquants' });
    }

    let role = login;
    let user = USERS[login];
    let expectedPwd = user ? user.pwd : null;

    // Lire Config_Passwords (overrides login + password)
    try {
      const token = await getGoogleToken();
      if (token && process.env.SID_FONDATEUR) {
        const sheetName = 'Config_Passwords';
        const enc = encodeURIComponent(sheetName);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SID_FONDATEUR}/values/${enc}!A:D`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        const rows = (d.values || []).filter(row => row[0] && row[0] !== 'role');

        if (!user) {
          const overrideRow = rows.find(row => row[3] && row[3] === login);
          if (overrideRow) {
            role = overrideRow[0];
            user = USERS[role];
            if (!user) return res.status(401).json({ ok:false, error: 'Identifiant inconnu' });
            expectedPwd = user.pwd;
            if (overrideRow[1]) expectedPwd = Buffer.from(overrideRow[1], 'base64').toString();
          }
        } else {
          const override = rows.find(row => row[0] === login);
          if (override && override[1]) {
            expectedPwd = Buffer.from(override[1], 'base64').toString();
          }
        }
      }
    } catch(e) {
      // Fallback silencieux sur env vars
    }

    if (!user) {
      return res.status(401).json({ ok:false, error: 'Identifiant inconnu' });
    }

    if (!user.pwd && !expectedPwd) {
      const missing = ['FONDATEUR','GERANT','RGA','FALLOU'].filter(k => !process.env['PWD_'+k]);
      return res.status(500).json({ ok:false, error: 'Config serveur manquante — variables manquantes : PWD_' + (missing.join(', PWD_') || '?') });
    }

    // R-02 : comparaison en temps constant (protection timing attack)
    const expected = expectedPwd || user.pwd;
    const b1 = Buffer.from(String(password));
    const b2 = Buffer.from(String(expected));
    const maxLen = Math.max(b1.length, b2.length);
    const padded1 = Buffer.concat([b1, Buffer.alloc(maxLen - b1.length)]);
    const padded2 = Buffer.concat([b2, Buffer.alloc(maxLen - b2.length)]);
    const pwdMatch = timingSafeEqual(padded1, padded2) && b1.length === b2.length;
    if (!pwdMatch) {
      return res.status(401).json({ ok:false, error: 'Mot de passe incorrect' });
    }

    // Générer session token
    const payload = JSON.stringify({ login, role, exp: Date.now() + 8 * 3600 * 1000 });
    const hmac = createHmac('sha256', process.env.SESSION_SECRET || 'boanr_dev_secret')
      .update(payload).digest('hex');
    const sessionToken = Buffer.from(payload).toString('base64') + '.' + hmac;

    // Construire l'objet SID selon le rôle — chaque rôle reçoit les SIDs nécessaires
    let sid;
    if (role === 'fondateur') {
      sid = {
        fondateur: process.env.SID_FONDATEUR,
        gerant:    process.env.SID_GERANT,
        fallou:    process.env.SID_FALLOU,
      };
    } else if (role === 'rga') {
      sid = {
        rga:       process.env.SID_RGA,
        gerant:    process.env.SID_GERANT,
        fondateur: process.env.SID_FONDATEUR,
      };
    } else if (role === 'fallou') {
      sid = {
        fallou:    process.env.SID_FALLOU,
        fondateur: process.env.SID_FONDATEUR,
      };
    } else {
      // gerant → reçoit aussi SID_FONDATEUR pour que writeAll synchronise les 2 sheets
      // (toutes les saisies terrain sont censées atterrir dans la sheet fondateur)
      sid = {
        gerant:    process.env.SID_GERANT,
        fondateur: process.env.SID_FONDATEUR,
      };
    }

    return res.status(200).json({
      ok: true,
      sessionToken,
      user: { login, role, name: user.name, tabs: user.tabs },
      sid,
    });

  } catch(e) {
    return res.status(500).json({ ok:false, error: 'Erreur serveur : ' + e.message });
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
  const b64u = s => Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const h = b64u(JSON.stringify({ alg:'RS256', typ:'JWT' }));
  const p = b64u(JSON.stringify({ iss:clientEmail, scope:'https://www.googleapis.com/auth/spreadsheets', aud:'https://oauth2.googleapis.com/token', exp:now+3600, iat:now }));
  const sign = createSign('RSA-SHA256');
  sign.update(h+'.'+p);
  const sig = sign.sign(privateKey,'base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const jwt = h+'.'+p+'.'+sig;
  const r = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` });
  const d = await r.json();
  if (d.access_token) { _tokenCache = { token:d.access_token, exp:Date.now()+(d.expires_in*1000) }; return d.access_token; }
  return null;
}
