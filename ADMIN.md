# Sam Villa admin: setup and security

The site is static. The admin and the forms use **Firebase** (Auth + Firestore). Nothing sensitive lives in this repo:
the web config in `js/firebase-config.js` is public by design. Security comes from `firestore.rules` and Firebase Auth.

## One-time setup

1. Firebase console > create a project (disable Analytics if you do not need it).
2. **Build > Authentication > Sign-in method**: enable **Email/Password** only. Turn **off** "User sign-up" under Settings > User actions so nobody can self-register.
3. **Authentication > Users**: add your admin account(s) with a strong, unique password (14+ characters). Copy each user's **UID**.
4. **Build > Firestore Database**: create the database (production mode).
5. Firestore > **Rules**: paste the contents of `firestore.rules` and publish.
6. Firestore > Data: create collection `admins`, add a document whose **ID is the admin's UID** (any field, e.g. `role: "owner"`). Only people with this document can use the admin. It cannot be created from the app.
7. Project settings > Your apps > Web app: copy the config into `js/firebase-config.js`.
8. Authentication > Settings > **Authorized domains**: keep only your real domain(s) (remove anything you do not use).
9. Open `/admin/`, sign in, go to **Rooms and rates** and click "Add the three default rooms".

Run locally with a static server (modules and Firebase need http, not file://): `npx serve .` then open `/admin/`.

## What is protected, and how

| Risk | Control |
| --- | --- |
| Strangers reading bookings or messages | Rules: read/update/delete only for admins (uid document in `/admins`) |
| Strangers writing data | Public can only **create** a booking or message; fields, types, lengths and the server timestamp are validated in the rules; unknown fields are rejected |
| Becoming an admin from the browser | `/admins` cannot be written by any client; created by hand in the console |
| Stored XSS (a guest types `<script>` in a message) | Admin and public code render stored text with `textContent` only; admin page also has a strict CSP (no inline script, scripts only from self and gstatic) |
| Password guessing | Firebase rate limits sign-in; plus a client lockout (5 failures, growing wait); one generic error message, so accounts cannot be enumerated |
| Left-open sessions | Session-only login (closes with the tab) and automatic sign-out after 15 minutes idle |
| Form spam | Hidden honeypot field, 30 s resend limit, strict rules limits. For stronger protection turn on **App Check** (reCAPTCHA v3) and enforce it for Firestore |
| Search engines indexing admin | `noindex` meta on the admin page |

## Recommended extras (not automatic)

- Enable **multi-factor auth** for admin accounts (Authentication > Sign-in method > Multi-factor).
- Turn on **App Check** enforcement for Firestore.
- In Google Cloud console, restrict the Firebase **API key** to your site's domain (HTTP referrers).
- Set a **budget alert** so abuse cannot become a surprise bill.
- Host with security headers (e.g. Firebase Hosting `headers`): `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`) for `/admin/**`. A `<meta>` CSP cannot set `frame-ancestors`.
- Back up Firestore (scheduled export) before you rely on it for real bookings.

## Honest limits

- Booking and message submissions are **requests**, not confirmed reservations. The site does not check live availability against bookings; the room status you set in the admin is what visitors see.
- No email is sent automatically. You see requests in the admin; reply from your own email.
