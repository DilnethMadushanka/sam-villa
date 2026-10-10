/* Server-side Firestore (Admin SDK). The service account comes from the FIREBASE_SERVICE_ACCOUNT env var (JSON or base64 JSON). */
const admin = require('firebase-admin');

function credential() {
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (!raw.trim().startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
  const sa = JSON.parse(raw);
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  return admin.credential.cert(sa);
}

if (!admin.apps.length) admin.initializeApp({ credential: credential() });

module.exports = { admin, db: admin.firestore() };
