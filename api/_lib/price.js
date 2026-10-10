/* Price is recomputed on the server from the rooms collection, never trusted from the browser. */
const { db } = require('./firebase');

async function expectedMinor(booking) {
  const rate = Number(process.env.USD_TO_LKR);
  if (!(rate > 0)) throw new Error('usd_to_lkr_not_set');
  const snap = await db.collection('rooms').where('name', '==', booking.room).limit(1).get();
  if (snap.empty) throw new Error('room_not_found');
  const nights = Math.round((new Date(booking.checkOut) - new Date(booking.checkIn)) / 864e5);
  if (!(nights >= 1) || nights !== booking.nights) throw new Error('bad_dates');
  return Math.round(snap.docs[0].data().rate * nights * rate * 100);   /* Genie amounts are in minor units (cents) */
}

module.exports = { expectedMinor };
