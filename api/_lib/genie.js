/* Genie Business (Dialog) API v2. Endpoints and signing follow the official geniebiz/php-plugin client. */
const crypto = require('crypto');
const BASE = 'https://api.geniebiz.lk/public/';

function headers() {
  return { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: process.env.DIALOG_SECRET_KEY };
}

async function createTransaction(body) {
  const key = process.env.DIALOG_SECRET_KEY;
  const json = Object.assign({}, body, {
    apiVersion: '2.0', appVersion: 'sam-villa', signMethod: 'sha1',
    signature: crypto.createHash('sha1').update('amount=' + body.amount + '&currency=' + body.currency + '&apiKey=' + key).digest('hex')
  });
  const r = await fetch(BASE + 'transactions', { method: 'POST', headers: headers(), body: JSON.stringify(json) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('genie create failed', r.status, JSON.stringify(data)); throw new Error('genie_create_failed'); }
  return data;
}

async function getTransaction(id) {
  const r = await fetch(BASE + 'transactions/' + encodeURIComponent(id), { headers: headers() });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('genie get failed', r.status, JSON.stringify(data)); throw new Error('genie_get_failed'); }
  return data;
}

module.exports = { createTransaction, getTransaction };
