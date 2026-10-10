/* Genie calls this when a payment changes state. The payload is never trusted: we take the transaction id,
   fetch the transaction from Genie with the secret key, and check it matches the booking before marking it paid. */
const { admin, db } = require('./_lib/firebase');
const { getTransaction } = require('./_lib/genie');
const { expectedMinor } = require('./_lib/price');

function pickId(req) {
  const b = req.body || {}, q = req.query || {};
  const v = b.id || b.transactionId || (b.transaction && b.transaction.id) || q.id || q.transactionId;
  return typeof v === 'string' && /^[A-Za-z0-9_-]{6,80}$/.test(v) ? v : null;
}

/* Optional: server-side receipt through EmailJS. Needs EMAILJS_* env vars and "Allow non-browser API calls" enabled in EmailJS. */
async function receipt(id, b) {
  const key = process.env.EMAILJS_PRIVATE_KEY;
  if (!key || !process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_TEMPLATE_ID) return;
  const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID, template_id: process.env.EMAILJS_TEMPLATE_ID,
      user_id: process.env.EMAILJS_PUBLIC_KEY || '', accessToken: key,
      template_params: {
        to_email: b.email, guest_name: b.name, reference: id.slice(0, 8).toUpperCase(), room: b.room,
        check_in: b.checkIn, check_out: b.checkOut, nights: b.nights, guests: b.guests,
        total: 'LKR ' + (b.payAmount / 100).toLocaleString('en-US'), status: 'paid'
      }
    })
  });
  if (!r.ok) console.error('receipt email failed', r.status);
}

module.exports = async function (req, res) {
  const txId = pickId(req);
  if (!txId) { console.error('webhook without id', JSON.stringify(req.body || {})); return res.status(400).json({ error: 'no_id' }); }
  try {
    const tx = await getTransaction(txId);
    const bookingId = tx.localId;
    if (typeof bookingId !== 'string') return res.status(200).json({ ignored: true });
    const state = String(tx.state || tx.status || '').toUpperCase();
    console.log('webhook', txId, state);
    if (state !== 'CONFIRMED') return res.status(200).json({ ok: true, state: state });

    const ref = db.collection('bookings').doc(bookingId), snap = await ref.get();
    if (!snap.exists) return res.status(200).json({ ignored: true });
    const b = snap.data();
    if (b.status === 'paid') return res.status(200).json({ ok: true });
    if (Number(tx.amount) !== await expectedMinor(b)) { console.error('amount mismatch', bookingId, tx.amount); return res.status(200).json({ ignored: 'amount' }); }

    await ref.update({ status: 'paid', paidAt: admin.firestore.FieldValue.serverTimestamp(), payId: txId });
    await receipt(bookingId, Object.assign({}, b, { payAmount: Number(tx.amount) })).catch(function (e) { console.error('receipt', e.message); });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('webhook', e.message);
    return res.status(500).json({ error: 'failed' });
  }
};
