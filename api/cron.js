// api/cron.js - Protected cron entrypoint for scheduled jobs

import { createSign, timingSafeEqual } from 'node:crypto';
import {
  isSendGridConfigured,
  resolveNotificationRecipients,
  sendSendGridMail
} from './_notify.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-Cron-Secret');
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorizedCronCall(req)) {
    return res.status(401).json({ error: 'Unauthorized cron call' });
  }

  try {
    var jobResult = await runCnaasReminderJob();
    return res.status(200).json({
      ok: true,
      message: 'Cron executed',
      at: new Date().toISOString(),
      job: jobResult
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message || 'Cron failure'
    });
  }
}

function isAuthorizedCronCall(req) {
  const secret = String(process.env.CRON_SECRET || '');
  if (!secret || secret.length < 32) return false;

  const authHeader = String(req.headers.authorization || '');
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const customHeader = String(req.headers['x-cron-secret'] || '').trim();
  const querySecret = String((req.query && req.query.secret) || '').trim();

  return secureEquals(bearer, secret)
    || secureEquals(customHeader, secret)
    || secureEquals(querySecret, secret);
}

function secureEquals(a, b) {
  if (!a || !b) return false;
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  try {
    return timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

async function runCnaasReminderJob() {
  var sid = String(process.env.SID_FONDATEUR || '');
  if (!sid) {
    return { ok: true, skipped: true, reason: 'sid_fondateur_missing' };
  }

  var token = await getGoogleToken();
  if (!token) {
    return { ok: false, reason: 'google_token_unavailable' };
  }

  var rows = await readSheetRows(sid, 'Ventes_CNAAS!A4:I500', token);
  var allTasks = rows.map(function(row, idx) {
    return rowToTask(row, idx + 4);
  }).filter(function(t) {
    return !!t.id;
  });

  var pending = allTasks.filter(function(t) {
    return String(t.status || 'PENDING').toUpperCase() !== 'DONE';
  });

  var overdue = pending.filter(function(t) {
    return t.ageHours >= 24;
  });

  if (!overdue.length) {
    return {
      ok: true,
      sent: false,
      pendingCount: pending.length,
      overdueCount: 0
    };
  }

  var recipients = resolveNotificationRecipients();
  if (!recipients.length) {
    return {
      ok: true,
      sent: false,
      simulated: true,
      reason: 'no_recipients',
      pendingCount: pending.length,
      overdueCount: overdue.length
    };
  }

  if (!isSendGridConfigured()) {
    return {
      ok: true,
      sent: false,
      simulated: true,
      reason: 'sendgrid_not_configured',
      pendingCount: pending.length,
      overdueCount: overdue.length,
      recipients: recipients.length
    };
  }

  var built = buildOverdueDigest(overdue, pending.length);
  var sent = await sendSendGridMail({
    to: recipients,
    subject: built.subject,
    text: built.text,
    html: built.html
  });

  if (!sent.ok) {
    return {
      ok: false,
      sent: false,
      reason: sent.error || sent.reason || 'sendgrid_error',
      pendingCount: pending.length,
      overdueCount: overdue.length
    };
  }

  return {
    ok: true,
    sent: true,
    pendingCount: pending.length,
    overdueCount: overdue.length,
    recipients: recipients.length,
    providerStatus: sent.providerStatus || 202
  };
}

function rowToTask(row, rowIndex) {
  row = row || [];
  var dateVente = String(row[0] || '');
  var dt = parseBoanDate(dateVente);
  var ageHours = dt ? Math.floor((Date.now() - dt.getTime()) / 3600000) : 0;
  return {
    rowIndex: rowIndex,
    dateVente: dateVente,
    id: String(row[1] || ''),
    race: String(row[2] || ''),
    acheteur: String(row[3] || ''),
    total: Number(row[4] || 0) || 0,
    status: String(row[5] || 'PENDING'),
    cnaasCalledAt: String(row[6] || ''),
    cnaasAgent: String(row[7] || ''),
    cycleDebut: String(row[8] || ''),
    ageHours: ageHours
  };
}

function parseBoanDate(value) {
  var s = String(value || '').trim();
  if (!s) return null;

  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    var day = Number(m[1]);
    var month = Number(m[2]) - 1;
    var year = Number(m[3]);
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  var dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt;
  return null;
}

function buildOverdueDigest(overdue, pendingCount) {
  var list = overdue.slice(0, 25);
  var textLines = [
    '[BOAN] Rappel CNAAS',
    'Ventes CNAAS en retard (>=24h): ' + overdue.length,
    'Total ventes CNAAS en attente: ' + pendingCount,
    ''
  ];
  var htmlRows = [];

  list.forEach(function(t) {
    var totalText = Number(t.total || 0).toLocaleString('fr-FR');
    textLines.push('- ' + t.id + ' | ' + t.dateVente + ' | ' + t.acheteur + ' | ' + totalText + ' FCFA | ' + t.ageHours + 'h');
    htmlRows.push(
      '<tr>' +
      '<td style="padding:6px;border:1px solid #dcdcdc">' + esc(t.id) + '</td>' +
      '<td style="padding:6px;border:1px solid #dcdcdc">' + esc(t.dateVente) + '</td>' +
      '<td style="padding:6px;border:1px solid #dcdcdc">' + esc(t.acheteur) + '</td>' +
      '<td style="padding:6px;border:1px solid #dcdcdc;text-align:right">' + esc(totalText) + ' FCFA</td>' +
      '<td style="padding:6px;border:1px solid #dcdcdc;text-align:right">' + esc(String(t.ageHours)) + 'h</td>' +
      '</tr>'
    );
  });

  if (overdue.length > list.length) {
    textLines.push('... +' + (overdue.length - list.length) + ' autres elements');
  }

  var subject = '[BOAN] CNAAS - ' + overdue.length + ' vente(s) en retard';
  var text = textLines.join('\n');
  var html = [
    '<h3>[BOAN] Rappel CNAAS</h3>',
    '<p><strong>Ventes CNAAS en retard (>=24h):</strong> ' + esc(String(overdue.length)) + '</p>',
    '<p><strong>Total ventes en attente:</strong> ' + esc(String(pendingCount)) + '</p>',
    '<table style="border-collapse:collapse;width:100%;max-width:760px">',
    '<thead><tr>',
    '<th style="padding:6px;border:1px solid #dcdcdc;text-align:left">ID</th>',
    '<th style="padding:6px;border:1px solid #dcdcdc;text-align:left">Date vente</th>',
    '<th style="padding:6px;border:1px solid #dcdcdc;text-align:left">Acheteur</th>',
    '<th style="padding:6px;border:1px solid #dcdcdc;text-align:right">Montant</th>',
    '<th style="padding:6px;border:1px solid #dcdcdc;text-align:right">Retard</th>',
    '</tr></thead>',
    '<tbody>' + htmlRows.join('') + '</tbody>',
    '</table>'
  ].join('');

  return { subject: subject, text: text, html: html };
}

async function readSheetRows(sid, range, token) {
  var parts = String(range || '').split('!');
  var enc = encodeURIComponent(parts[0]) + (parts[1] ? '!' + parts[1] : '');
  var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + sid
    + '/values/' + enc
    + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING';
  var response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });
  var data = await response.json();
  if (data && data.error) {
    throw new Error(data.error.message || 'Sheets read error');
  }
  return data.values || [];
}

var _tokenCache = { token: null, exp: 0 };
async function getGoogleToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.exp - 60000) return _tokenCache.token;

  var pk = process.env.SA_PRIVATE_KEY;
  var clientEmail = process.env.SA_CLIENT_EMAIL;
  if (!pk || !clientEmail) return null;

  var privateKey = pk.replace(/\\n/g, '\n');
  var now = Math.floor(Date.now() / 1000);
  var header = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var payload = b64u(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }));

  var sign = createSign('RSA-SHA256');
  sign.update(header + '.' + payload);
  var sig = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  var jwt = header + '.' + payload + '.' + sig;
  var response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt
  });
  var data = await response.json();
  if (!data.access_token) return null;

  _tokenCache = {
    token: data.access_token,
    exp: Date.now() + ((data.expires_in || 3600) * 1000)
  };
  return _tokenCache.token;
}

function b64u(str) {
  return Buffer.from(String(str))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
