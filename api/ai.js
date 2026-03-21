// api/ai.js — Vercel Serverless Function
// Proxy Anthropic API : clé cachée côté serveur

import { createHmac, timingSafeEqual } from 'node:crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sessionToken = req.headers['x-session-token'];
  if (!verifySession(sessionToken)) {
    return res.status(401).json({ error: 'Session invalide' });
  }

  const { model, max_tokens, system, messages } = req.body || {};
  if (!messages) return res.status(400).json({ error: 'Messages manquants' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 1024,
        system, messages,
      }),
    });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function verifySession(token) {
  if (!token) return false;
  try {
    const [payloadB64, hmac] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    if (payload.exp < Date.now()) return false;
    const expected = createHmac('sha256', process.env.SESSION_SECRET || 'boanr_dev_secret')
      .update(JSON.stringify(payload)).digest('hex');
    try { return timingSafeEqual(Buffer.from(hmac), Buffer.from(expected)); }
    catch { return hmac === expected; }
  } catch { return false; }
}
