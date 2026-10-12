/* POST { bookingId } -> { url }. Creates a Genie payment link for an unpaid booking. */
const { admin, db } = require('./_lib/firebase');
const { createTransaction } = require('./_lib/genie');
const { expectedMinor } = require('./_lib/price');

const ORIGIN = process.env.SITE_ORIGIN || 'https://samvillalk.com';

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const id = req.body && req.body.bookingId;
  if (typeof id !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(id)) return res.status(400).json({ error: 'bad_request' });
  try {
    const ref = db.collection('bookings').doc(id), snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'not_found' });
    const b = snap.data();
    if (b.status === 'paid') return res.status(409).json({ error: 'already_paid' });
    if (b.status === 'cancelled') return res.status(409).json({ error: 'cancelled' });
    if (b.payUrl && b.payExpires && b.payExpires.toMillis() > Date.now()) return res.json({ url: b.payUrl });

    const amount = await expectedMinor(b);
    const expires = new Date(Date.now() + 24 * 3600 * 1000);
    const tx = await createTransaction({
      amount: amount, currency: process.env.PAY_CURRENCY || 'LKR', localId: id,
      redirectUrl: ORIGIN + '/?pay=return&ref=' + id.slice(0, 8).toUpperCase(),
      webhook: ORIGIN + '/api/dialog-webhook', expires: expires.toISOString()
    });
    if (!tx || !tx.url) throw new Error('no_url');
    await ref.update({ payUrl: tx.url, payId: tx.id || null, payAmount: amount, payExpires: admin.firestore.Timestamp.fromDate(expires) });
    return res.json({ url: tx.url });
  } catch (e) {
    console.error('create-payment', e.message);
    return res.status(500).json({ error: 'payment_unavailable' });
  }
};
