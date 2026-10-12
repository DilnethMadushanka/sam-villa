/* POST { bookingId } or { messageId } -> emails the owner about a new booking or contact message.
   The document is read from Firestore (never trusted from the client) and notified only once. */
const { admin, db } = require('./_lib/firebase');

const TO = process.env.NOTIFY_EMAIL || 'info@samvillalk.com';

function clean(v) { return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').slice(0, 600); }

async function send(subject, body, replyTo) {
  const key = process.env.EMAILJS_PRIVATE_KEY, tpl = process.env.EMAILJS_NOTIFY_TEMPLATE_ID;
  if (!key || !process.env.EMAILJS_SERVICE_ID || !tpl) return false;
  const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID, template_id: tpl,
      user_id: process.env.EMAILJS_PUBLIC_KEY || '', accessToken: key,
      template_params: { to_email: TO, subject: subject, body: body, reply_to: replyTo }
    })
  });
  if (!r.ok) console.error('notify email failed', r.status);
  return r.ok;
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const b = req.body || {};
  const isBooking = typeof b.bookingId === 'string', id = isBooking ? b.bookingId : b.messageId;
  if (typeof id !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(id)) return res.status(400).json({ error: 'bad_request' });
  try {
    const ref = db.collection(isBooking ? 'bookings' : 'messages').doc(id), snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'not_found' });
    const d = snap.data();
    if (d.notifiedAt) return res.json({ ok: true, already: true });
    if (!d.createdAt || Date.now() - d.createdAt.toMillis() > 10 * 60 * 1000) return res.json({ ignored: 'old' });

    const ref8 = id.slice(0, 8).toUpperCase();
    const ok = isBooking
      ? await send('New booking request ' + ref8 + ' - ' + clean(d.name), [
          'Reference: ' + ref8, 'Name: ' + clean(d.name), 'Email: ' + clean(d.email), 'Phone: ' + clean(d.phone),
          'Room: ' + clean(d.room), 'Check-in: ' + clean(d.checkIn), 'Check-out: ' + clean(d.checkOut),
          'Nights: ' + clean(d.nights), 'Guests: ' + clean(d.guests), 'Total: USD ' + clean(d.total), 'Notes: ' + clean(d.notes)
        ].join('\n'), clean(d.email))
      : await send('New message from ' + clean(d.name), [
          'Name: ' + clean(d.name), 'Email: ' + clean(d.email), '', String(d.message || '').slice(0, 2000)
        ].join('\n'), clean(d.email));
    if (ok) await ref.update({ notifiedAt: admin.firestore.FieldValue.serverTimestamp() });
    return res.json({ ok: ok });
  } catch (e) {
    console.error('notify', e.message);
    return res.status(500).json({ error: 'failed' });
  }
};
