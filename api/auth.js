// api/auth.js — Vercel Serverless Function
// Vérifie les credentials et retourne les infos du rôle (sans exposer les SIDs)

const USERS = {
  fondateur: { name:'Direction',        pwd: process.env.PWD_FONDATEUR, tabs:['dashboard','saisie','livrables','marche'], sid: process.env.SID_FONDATEUR },
  gerant:    { name:'Gerant terrain',   pwd: process.env.PWD_GERANT,    tabs:['dashboard','saisie'],                      sid: process.env.SID_GERANT    },
  rga:       { name:'RGA',              pwd: process.env.PWD_RGA,       tabs:['dashboard','livrables'],                   sid: process.env.SID_RGA       },
  fallou:    { name:'Commerciale',      pwd: process.env.PWD_FALLOU,    tabs:['dashboard','marche'],                      sid: process.env.SID_FALLOU    },
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { login, password } = req.body || {};
  if (!login || !password) return res.status(400).json({ error: 'Identifiants manquants' });

  const user = USERS[login];
  if (!user) return res.status(401).json({ error: 'Identifiant inconnu' });

  // Vérifier d'abord les overrides dans Config_Passwords (Sheets)
  // puis fallback sur les env vars
  let expectedPwd = user.pwd;
  try {
    const token = await getGoogleToken();
    if (token) {
      const SID = process.env.SID_FONDATEUR;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SID}/values/Config_Passwords!A:B`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      const rows = d.values || [];
      const override = rows.find(row => row[0] === login);
      if (override && override[1]) {
        // Décoder le mot de passe stocké en base64
        expectedPwd = Buffer.from(override[1], 'base64').toString();
      }
    }
  } catch(e) {
    // Silently fallback to env var password if Sheets unavailable
  }

  if (password !== expectedPwd) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  // Générer un token de session simple (HMAC-SHA256 signé avec SESSION_SECRET)
  const crypto = await import('crypto');
  const payload = JSON.stringify({ login, exp: Date.now() + 8 * 3600 * 1000 }); // 8h
  const hmac = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'boanr_secret_dev')
    .update(payload).digest('hex');
  const sessionToken = Buffer.from(payload).toString('base64') + '.' + hmac;

  return res.status(200).json({
    ok: true,
    sessionToken,
    user: { login, name: user.name, tabs: user.tabs },
    sid: user.sid,  // SID retourné UNE SEULE FOIS au login, jamais dans le code HTML
  });
}


// ── Google Token helper (pour lire Config_Passwords) ──
let _tokenCache = { token: null, exp: 0 };
async function getGoogleToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.exp - 60000) return _tokenCache.token;
  const pk = process.env.SA_PRIVATE_KEY;
  if (!pk) return null;
  const privateKey = pk.replace(/\\n/g, '\n');
  const clientEmail = process.env.SA_CLIENT_EMAIL;
  const now = Math.floor(Date.now() / 1000);
  const crypto = await import('crypto');
  const b64u = s => Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const h = b64u(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const p = b64u(JSON.stringify({iss:clientEmail,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',exp:now+3600,iat:now}));
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(h+'.'+p);
  const sig = sign.sign(privateKey,'base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const r = await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${h}.${p}.${sig}`});
  const d = await r.json();
  if (d.access_token) { _tokenCache = {token:d.access_token,exp:Date.now()+(d.expires_in*1000)}; return d.access_token; }
  return null;
}
