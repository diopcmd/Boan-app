// api/notify-immediate.js - Immediate event notifications

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  isSendGridConfigured,
  resolveNotificationRecipients,
  sendSendGridMail
} from './_notify.js';

export default async function handler(req, res) {
  var reqOrigin = req.headers.origin || '';
  var originOk = isAllowedOrigin(reqOrigin);
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

  var sessionPayload = verifySession(req.headers['x-session-token']);
  if (!sessionPayload) {
    return res.status(401).json({ error: 'Session invalide' });
  }

  try {
    var body = req.body || {};
    var eventType = String(body.eventType || '').trim();
    var payload = body.payload || {};

    if (!eventType) {
      return res.status(400).json({ error: 'eventType manquant' });
    }

    var message = buildMessage(eventType, payload, sessionPayload);
    if (!message) {
      return res.status(400).json({ error: 'eventType non supporte' });
    }

    var recipients = resolveNotificationRecipients();
    if (!recipients.length) {
      return res.status(200).json({
        ok: true,
        simulated: true,
        reason: 'no_recipients',
        eventType: eventType
      });
    }

    if (!isSendGridConfigured()) {
      return res.status(200).json({
        ok: true,
        simulated: true,
        reason: 'sendgrid_not_configured',
        eventType: eventType,
        recipients: recipients.length
      });
    }

    var sendRes = await sendSendGridMail({
      to: recipients,
      subject: message.subject,
      text: message.text,
      html: message.html
    });

    if (!sendRes.ok) {
      return res.status(502).json({
        ok: false,
        error: 'Echec envoi SendGrid',
        details: sendRes.error || sendRes.reason || 'unknown_error'
      });
    }

    return res.status(200).json({
      ok: true,
      eventType: eventType,
      recipients: recipients.length,
      providerStatus: sendRes.providerStatus || 202
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function buildMessage(eventType, payload, actor) {
  var ts = new Date().toISOString();
  if (eventType === 'vente_bete') {
    var id = String(payload.id || 'N/A');
    var dateVente = String(payload.dateVente || 'N/A');
    var acheteur = String(payload.acheteur || 'N/A');
    var total = Number(payload.total || 0);
    var totalText = isFinite(total) ? Math.round(total).toLocaleString('fr-FR') : String(payload.total || '0');
    var actorText = String((actor && (actor.login || actor.role)) || 'inconnu');

    var subject = '[BOAN] Vente ' + id + ' - appel CNAAS requis';
    var text = [
      'Vente enregistree: ' + id,
      'Date: ' + dateVente,
      'Acheteur: ' + acheteur,
      'Montant: ' + totalText + ' FCFA',
      'Action: la RGA doit appeler la CNAAS pour cloture de garantie.',
      'Declencheur: ' + actorText,
      'Horodatage: ' + ts
    ].join('\n');

    var html = [
      '<h3>[BOAN] Vente ' + esc(id) + ' - appel CNAAS requis</h3>',
      '<p><strong>Date:</strong> ' + esc(dateVente) + '</p>',
      '<p><strong>Acheteur:</strong> ' + esc(acheteur) + '</p>',
      '<p><strong>Montant:</strong> ' + esc(totalText) + ' FCFA</p>',
      '<p><strong>Action:</strong> la RGA doit appeler la CNAAS pour cloture de garantie.</p>',
      '<p><strong>Declencheur:</strong> ' + esc(actorText) + '</p>',
      '<p><small>Horodatage: ' + esc(ts) + '</small></p>'
    ].join('');

    return { subject: subject, text: text, html: html };
  }
  return null;
}

function verifySession(token) {
  var secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  if (!token) return null;
  try {
    var parts = String(token).split('.');
    var payloadB64 = parts[0] || '';
    var hmac = parts[1] || '';
    var payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    var expected = createHmac('sha256', secret)
      .update(JSON.stringify(payload)).digest('hex');
    try {
      if (!timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null;
    } catch (_) {
      if (hmac !== expected) return null;
    }
    return payload;
  } catch (_) {
    return null;
  }
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

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
