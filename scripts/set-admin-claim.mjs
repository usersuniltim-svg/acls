#!/usr/bin/env node
/**
 * Give (or take away) the app-admin role as a Firebase custom claim.
 *
 * The Firestore rules and the server accept `admin: true` on the sign-in
 * token. Once the claim is set for the admin account, the hard-coded admin
 * email can be removed from firestore.rules and server/auth.ts.
 *
 * Run it on your own computer, once, with a service-account key for the
 * Firebase project (Firebase console > Project settings > Service accounts >
 * Generate new private key). Keep that file private; never commit it.
 *
 *   npm install --no-save firebase-admin
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/set-admin-claim.mjs user.suniltim@gmail.com
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/set-admin-claim.mjs someone@example.com --remove
 *
 * The person must sign out and in again (or wait up to an hour) for the new
 * token to carry the claim.
 */
const args = process.argv.slice(2);
const email = args.find(a => !a.startsWith('--'));
const remove = args.includes('--remove');

if (!email) {
  console.error('Usage: node scripts/set-admin-claim.mjs <email> [--remove]');
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to the path of a service-account key for the Firebase project.');
  process.exit(1);
}

let admin;
try {
  admin = (await import('firebase-admin')).default;
} catch {
  console.error('firebase-admin is not installed. Run: npm install --no-save firebase-admin');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const auth = admin.auth();

const user = await auth.getUserByEmail(email);
if (!remove && !user.emailVerified) {
  console.error(`${email} has not verified its email address. Verify it first, then run this again.`);
  process.exit(1);
}
const claims = { ...(user.customClaims || {}) };
if (remove) delete claims.admin;
else claims.admin = true;
await auth.setCustomUserClaims(user.uid, claims);

console.log(`${remove ? 'Removed admin from' : 'Admin set for'} ${email} (uid ${user.uid}).`);
console.log('Claims now:', JSON.stringify(claims));
console.log('They need to sign out and back in for it to take effect.');
