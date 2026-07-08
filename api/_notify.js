// api/_notify.js - Shared helpers for notifications

export function resolveNotificationRecipients() {
  var values = [];
  values = values.concat(splitEmails(process.env.SENDGRID_TO_FONDATEUR));
  values = values.concat(splitEmails(process.env.SENDGRID_TO_RGA));
  values = values.concat(splitEmails(process.env.NOTIFY_TO));
  values = values.concat(splitEmails(process.env.SENDGRID_TO));

  var seen = {};
  return values.filter(function(email) {
    var key = String(email || '').toLowerCase();
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

export function isSendGridConfigured() {
  return !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
}

export async function sendSendGridMail(input) {
  var apiKey = process.env.SENDGRID_API_KEY;
  var fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    return { ok: false, skipped: true, reason: 'sendgrid_not_configured' };
  }

  var to = (input && input.to) || [];
  if (!Array.isArray(to) || !to.length) {
    return { ok: false, skipped: true, reason: 'no_recipient' };
  }

  var subject = String((input && input.subject) || 'BOAN Notification');
  var text = String((input && input.text) || 'Notification');
  var html = String((input && input.html) || '<p>Notification</p>');

  var payload = {
    personalizations: [{ to: to.map(function(email) { return { email: email }; }) }],
    from: { email: fromEmail, name: 'BOAN Alerts' },
    subject: subject,
    content: [
      { type: 'text/plain', value: text },
      { type: 'text/html', value: html }
    ]
  };

  var response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    return { ok: true, providerStatus: response.status };
  }

  var body = '';
  try {
    body = await response.text();
  } catch (_) {
    body = '';
  }

  return {
    ok: false,
    providerStatus: response.status,
    error: body || 'SendGrid error'
  };
}

function splitEmails(raw) {
  return String(raw || '')
    .split(',')
    .map(function(x) { return x.trim(); })
    .filter(function(x) { return !!x; });
}
