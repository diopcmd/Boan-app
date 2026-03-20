// api/auth.js — Vercel Serverless Function v2
// Vérifie les credentials et retourne les infos du rôle

const USERS = {
  fondateur: { name:'Direction',      pwd: process.env.PWD_FONDATEUR, tabs:['dashboard','saisie','livrables','marche'], sid: process.env.SID_FONDATEUR },
  gerant:    { name:'Gerant terrain', pwd: process.env.PWD_GERANT,    tabs:['dashboard','saisie'],                      sid: process.env.SID_GERANT    },
  rga:       { name:'RGA',            pwd: process.env.PWD_RGA,       tabs:['dashboard','livrables'],                   sid: process.env.SID_RGA       },
  fallou:    { name:'Commerciale',    pwd: process.env.PWD_FALLOU,    tabs:['dashboard','marche'],                      sid: process.env.SID_FALLOU    },
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error: 'Method not allowed' });

  try {
    const { login, password } = req.body || {};

    // Vérif basique
    if (!login || !password) {
      return res.status(400).json({ ok:false, error: 'Identifiants manquants' });
    }

    // Lookup direct par login canonique, ou via override dans Config_Passwords
    let role = login;
    let user = USERS[login];
    let expectedPwd = user ? user.pwd : null;

    // Toujours lire Config_Passwords (password overrides + login overrides)
    try {
      const token = await getGoogleToken();
      if (token && process.env.SID_FONDATEUR) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SID_FONDATEUR}/values/Config_Passwords!A:D`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        const rows = d.values || [];

        if (!user) {
          // Login inconnu → chercher si c'est un identifiant overridé (colonne D)
          const overrideRow = rows.find(row => row[3] && row[3] === login);
          if (overrideRow) {
            role = overrideRow[0];
            user = USERS[role];
            if (!user) return res.status(401).json({ ok:false, error: 'Identifiant inconnu' });
            expectedPwd = user.pwd;
            if (overrideRow[1]) expectedPwd = Buffer.from(overrideRow[1], 'base64').toString();
          }
        } else {
          // Login canonique → chercher override de mot de passe (colonne B)
          const override = rows.find(row => row[0] === login);
          if (override && override[1]) {
            expectedPwd = Buffer.from(override[1], 'base64').toString();
          }
        }
      }
    } catch(e) {
      // Fallback silencieux
    }

    if (!user) {
      return res.status(401).json({ ok:false, error: 'Identifiant inconnu' });
    }

    // Debug : vérifier que les env vars sont chargées
    if (!user.pwd && !expectedPwd) {
      return res.status(500).json({ ok:false, error: 'Config serveur manquante — vérifiez les variables Vercel' });
    }

    if (password !== (expectedPwd || user.pwd)) {
      return res.status(401).json({ ok:false, error: 'Mot de passe incorrect' });
    }

    // Générer session token
    const crypto = await import('node:crypto');
    const payload = JSON.stringify({ login, role, exp: Date.now() + 8 * 3600 * 1000 });
    const hmac = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'boanr_dev_secret')
      .update(payload).digest('hex');
    const sessionToken = Buffer.from(payload).toString('base64') + '.' + hmac;

    return res.status(200).json({
      ok: true,
      sessionToken,
      user: { login, name: user.name, tabs: user.tabs },
      sid: user.sid,
    });

  } catch(e) {
    return res.status(500).json({ ok:false, error: 'Erreur serveur : ' + e.message });
  }
}

// ── Google Token (pour lire Config_Passwords) ──
let _tokenCache = { token: null, exp: 0 };
async function getGoogleToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.exp - 60000) return _tokenCache.token;
  const pk = process.env.SA_PRIVATE_KEY;
  if (!pk) return null;
  const privateKey = pk.replace(/\\n/g, '\n');
  const clientEmail = process.env.SA_CLIENT_EMAIL;
  if (!clientEmail) return null;
  const now = Math.floor(Date.now() / 1000);
  const { createSign, createHmac } = await import('node:crypto');
  const b64u = s => Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const h = b64u(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const p = b64u(JSON.stringify({iss:clientEmail,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',exp:now+3600,iat:now}));
  const sign = createSign('RSA-SHA256');
  sign.update(h+'.'+p);
  const sig = sign.sign(privateKey,'base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const jwt = h+'.'+p+'.'+sig;
  const r = await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`});
  const d = await r.json();
  if (d.access_token) { _tokenCache={token:d.access_token,exp:Date.now()+(d.expires_in*1000)}; return d.access_token; }
  return null;
}
