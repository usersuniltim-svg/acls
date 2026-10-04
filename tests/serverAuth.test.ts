import test from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose';
import {
  AuthError, authorizeClinician, cachedKycStatus, fetchKycStatus, isAdminUser, verifyFirebaseIdToken,
  type VerifiedUser,
} from '../server/auth';

const PROJECT = 'demo-project';
const NOW = new Date('2026-10-05T00:00:00Z');
const nowSec = Math.floor(NOW.getTime() / 1000);

async function keys() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  return { privateKey, keySet: createLocalJWKSet({ keys: [jwk] }) };
}

async function token(privateKey: CryptoKey, over: Record<string, unknown> = {}, opts: { iss?: string; aud?: string; exp?: number; sub?: string } = {}) {
  return new SignJWT({ email: 'doc@x.com', email_verified: true, auth_time: nowSec - 60, ...over })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(opts.iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setAudience(opts.aud ?? PROJECT)
    .setSubject(opts.sub ?? 'uid-1')
    .setIssuedAt(nowSec - 60)
    .setExpirationTime(opts.exp ?? nowSec + 3600)
    .sign(privateKey);
}

test('a valid Firebase ID token for this project is accepted', async () => {
  const { privateKey, keySet } = await keys();
  const user = await verifyFirebaseIdToken(await token(privateKey), PROJECT, keySet, NOW);
  assert.equal(user.uid, 'uid-1');
  assert.equal(user.email, 'doc@x.com');
  assert.equal(user.emailVerified, true);
});

test('wrong project, wrong issuer, expired, or wrongly signed tokens are rejected with 401', async () => {
  const { privateKey, keySet } = await keys();
  const other = await keys();
  const bad = [
    await token(privateKey, {}, { aud: 'another-project' }),
    await token(privateKey, {}, { iss: 'https://evil.example.com' }),
    await token(privateKey, {}, { exp: nowSec - 10 }),
    await token(other.privateKey),
    'not-a-jwt',
  ];
  for (const t of bad) {
    await assert.rejects(verifyFirebaseIdToken(t, PROJECT, keySet, NOW), (e: any) => e instanceof AuthError && e.status === 401);
  }
});

const user = (over: Partial<VerifiedUser> = {}): VerifiedUser => ({
  uid: 'u1', email: 'doc@x.com', emailVerified: true, claims: {}, idToken: 'tok', ...over,
});

test('admin: custom claim, or the admin email only when verified', () => {
  assert.equal(isAdminUser(user({ claims: { admin: true } })), true);
  assert.equal(isAdminUser(user({ email: 'User.Suniltim@gmail.com' })), true);
  assert.equal(isAdminUser(user({ email: 'user.suniltim@gmail.com', emailVerified: false })), false, 'unverified email is not enough');
  assert.equal(isAdminUser(user()), false);
  assert.equal(isAdminUser(user({ claims: { admin: 'true' } })), false, 'claim must be boolean true');
});

test('KYC status is read from Firestore with the user\'s own token', async () => {
  let seen: { url: string; auth?: string } | null = null;
  const fetchImpl = async (url: string, init?: { headers?: Record<string, string> }) => {
    seen = { url, auth: init?.headers?.Authorization };
    return { ok: true, status: 200, json: async () => ({ fields: { kyc: { mapValue: { fields: { kycStatus: { stringValue: 'approved' } } } } } }) };
  };
  const status = await fetchKycStatus(user({ uid: 'abc', idToken: 'ID-TOKEN' }), { projectId: 'p1', databaseId: 'db-1', fetchImpl });
  assert.equal(status, 'approved');
  assert.equal(seen!.auth, 'Bearer ID-TOKEN');
  assert.match(seen!.url, /projects\/p1\/databases\/db-1\/documents\/profiles\/abc/);

  const missing = async () => ({ ok: false, status: 404, json: async () => ({}) });
  assert.equal(await fetchKycStatus(user(), { projectId: 'p1', fetchImpl: missing }), null);
  const broken = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(fetchKycStatus(user(), { projectId: 'p1', fetchImpl: broken }), (e: any) => e.status === 503);
});

test('who may use the copilot: admin or KYC-approved doctor; others get 401/403', async () => {
  const deps = (u: VerifiedUser, status: string | null) => ({
    verifyToken: async () => u,
    getKycStatus: async () => status,
  });
  await assert.rejects(authorizeClinician(undefined, deps(user(), 'approved')), (e: any) => e.status === 401);
  await assert.rejects(authorizeClinician('Basic abc', deps(user(), 'approved')), (e: any) => e.status === 401);
  assert.equal((await authorizeClinician('Bearer t', deps(user({ claims: { admin: true } }), null))).isAdmin, true);
  assert.equal((await authorizeClinician('Bearer t', deps(user(), 'approved'))).isAdmin, false);
  for (const s of ['pending', 'unsubmitted', 'rejected', null]) {
    await assert.rejects(authorizeClinician('Bearer t', deps(user(), s)), (e: any) => e.status === 403, String(s));
  }
});

test('only an approval is cached; pending is re-checked every time', async () => {
  let calls = 0;
  let answer: string | null = 'pending';
  let t = 0;
  const get = cachedKycStatus(async () => { calls++; return answer; }, 1000, () => t);
  await get(user()); await get(user());
  assert.equal(calls, 2);
  answer = 'approved';
  await get(user()); await get(user());
  assert.equal(calls, 3, 'approval cached');
  t = 2000;
  await get(user());
  assert.equal(calls, 4, 'cache expires');
});
