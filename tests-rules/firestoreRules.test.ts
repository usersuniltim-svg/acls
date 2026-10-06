/**
 * Firestore security rules, run against the Firestore emulator:
 *   npm run test:rules        (needs Java; starts the emulator itself)
 * CI runs this on every pull request (.github/workflows/quality.yml).
 */
import test, { after, before, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collectionGroup, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

const ADMIN_EMAIL = 'user.suniltim@gmail.com';
const doctor = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();
const claimAdmin = () => env.authenticatedContext('admin-claim', { email: 'ops@example.com', email_verified: true, admin: true }).firestore();
const emailAdmin = (verified = true) => env.authenticatedContext('admin-email', { email: ADMIN_EMAIL, email_verified: verified }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

const amendment = (by: string, n: number, kind = 'ADDENDUM') => ({ id: `am_${n}`, at: 1_000 + n, by, byName: 'Dr A', kind, text: `note ${n}` });

const signedCase = (uid: string, extra: Record<string, unknown> = {}) => ({
  id: 'case_1',
  userId: uid,
  patientCode: 'P-1',
  savedAt: 1000,
  signedAt: 1000,
  signedByUid: uid,
  certifiedBy: 'Dr A',
  councilRegistration: 'NMC-1',
  signatureDataUrl: 'data:image/png;base64,AAAA',
  contentHash: 'ab'.repeat(32),
  hashAlgorithm: 'SHA-256',
  totalDuration: 300,
  cprCycleCount: 2,
  shocksCount: 1,
  epiCount: 1,
  logs: [],
  clinicalEvents: [],
  updatedAt: 1000,
  storageVersion: 2,
  ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-acls-rules',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

// ---------------------------------------------------------------------------
// Profiles and KYC
// ---------------------------------------------------------------------------

test('a doctor creates their own profile, pending verification, and nobody else can read it', async () => {
  const db = doctor('alice');
  await assertSucceeds(setDoc(doc(db, 'profiles/alice'), { fullName: 'Dr Alice', councilRegistration: 'NMC-1', kyc: { kycStatus: 'pending', councilRegistration: 'NMC-1' } }));
  await assertSucceeds(getDoc(doc(db, 'profiles/alice')));
  await assertFails(getDoc(doc(doctor('bob'), 'profiles/alice')));
  await assertFails(getDoc(doc(anon(), 'profiles/alice')));
});

test('a doctor cannot approve themselves or make themselves admin', async () => {
  const db = doctor('alice');
  await assertFails(setDoc(doc(db, 'profiles/alice'), { fullName: 'Dr Alice', kyc: { kycStatus: 'approved' } }));
  await assertFails(setDoc(doc(db, 'profiles/alice'), { fullName: 'Dr Alice', isAdmin: true }));
  await seed('profiles/alice', { fullName: 'Dr Alice', kyc: { kycStatus: 'pending' } });
  await assertFails(updateDoc(doc(db, 'profiles/alice'), { 'kyc.kycStatus': 'approved' }));
  await assertFails(updateDoc(doc(db, 'profiles/alice'), { kyc: { kycStatus: 'pending', approvedBy: 'me' } }));
  await assertFails(updateDoc(doc(db, 'profiles/alice'), { isAdmin: true }));
});

test('after approval, changing identity details sends the doctor back to verification', async () => {
  const approved = { fullName: 'Dr Alice', councilRegistration: 'NMC-1', phone: '1', kyc: { kycStatus: 'approved', approvedAt: 5, approvedBy: ADMIN_EMAIL } };
  await seed('profiles/alice', approved);
  const db = doctor('alice');
  // Keeping the approval while changing what it vouches for: refused.
  await assertFails(updateDoc(doc(db, 'profiles/alice'), { councilRegistration: 'NMC-999' }));
  await assertFails(updateDoc(doc(db, 'profiles/alice'), { fullName: 'Dr Someone Else' }));
  // Other details can change freely.
  await assertSucceeds(updateDoc(doc(db, 'profiles/alice'), { phone: '2' }));
  // Changing identity together with resubmitting for verification: allowed.
  await assertSucceeds(updateDoc(doc(db, 'profiles/alice'), {
    councilRegistration: 'NMC-999',
    kyc: { kycStatus: 'pending', councilRegistration: 'NMC-999' },
  }));
});

test('admin (custom claim, or the verified owner email) can approve; an unverified email cannot', async () => {
  await seed('profiles/alice', { fullName: 'Dr Alice', kyc: { kycStatus: 'pending' } });
  await assertSucceeds(updateDoc(doc(claimAdmin(), 'profiles/alice'), { kyc: { kycStatus: 'approved', approvedAt: 9 } }));
  await assertSucceeds(updateDoc(doc(emailAdmin(), 'profiles/alice'), { kyc: { kycStatus: 'rejected', rejectionReason: 'x' } }));
  await assertFails(updateDoc(doc(emailAdmin(false), 'profiles/alice'), { kyc: { kycStatus: 'approved' } }));
  await assertFails(updateDoc(doc(doctor('bob'), 'profiles/alice'), { kyc: { kycStatus: 'approved' } }));
});

// ---------------------------------------------------------------------------
// Signed cases
// ---------------------------------------------------------------------------

test('a doctor saves a signed case only under their own account', async () => {
  await assertSucceeds(setDoc(doc(doctor('alice'), 'users/alice/cases/case_1'), signedCase('alice')));
  await assertFails(setDoc(doc(doctor('bob'), 'users/alice/cases/case_2'), signedCase('alice', { id: 'case_2' })));
  await assertFails(setDoc(doc(doctor('alice'), 'users/alice/cases/case_3'), signedCase('bob', { id: 'case_3' })));
  await assertFails(getDoc(doc(doctor('bob'), 'users/alice/cases/case_1')));
});

test('the content of a signed case can never change', async () => {
  await seed('users/alice/cases/case_1', signedCase('alice'));
  const ref = doc(doctor('alice'), 'users/alice/cases/case_1');
  await assertFails(updateDoc(ref, { patientCode: 'P-2' }));
  await assertFails(updateDoc(ref, { shocksCount: 5 }));
  await assertFails(updateDoc(ref, { clinicalEvents: [{ kind: 'SHOCK' }] }));
  await assertFails(updateDoc(ref, { contentHash: 'cd'.repeat(32) }));
  await assertFails(updateDoc(ref, { signatureDataUrl: '' }));
  // A retry of the same upload only touches updatedAt: fine.
  await assertSucceeds(updateDoc(ref, { updatedAt: 2000 }));
  // Writing the identical content back (merge) is not a change: fine.
  await assertSucceeds(setDoc(ref, signedCase('alice', { updatedAt: 3000 }), { merge: true }));
});

test('amendments are append-only and written by the signed-in doctor', async () => {
  await seed('users/alice/cases/case_1', signedCase('alice', { amendments: [amendment('alice', 1)] }));
  const ref = doc(doctor('alice'), 'users/alice/cases/case_1');
  await assertSucceeds(updateDoc(ref, { amendments: [amendment('alice', 1), amendment('alice', 2, 'VOID')], updatedAt: 2 }));
  // Removing, editing or reordering earlier amendments: refused.
  await assertFails(updateDoc(ref, { amendments: [amendment('alice', 1)] }));
  await assertFails(updateDoc(ref, { amendments: [{ ...amendment('alice', 1), text: 'changed' }, amendment('alice', 2, 'VOID')] }));
  await assertFails(updateDoc(ref, { amendments: [amendment('alice', 2, 'VOID'), amendment('alice', 1)] }));
  const current = [amendment('alice', 1), amendment('alice', 2, 'VOID')];
  // Written in someone else's name, unknown kind, empty or too long: refused.
  await assertFails(updateDoc(ref, { amendments: [...current, amendment('bob', 3)] }));
  await assertFails(updateDoc(ref, { amendments: [...current, amendment('alice', 3, 'EDIT')] }));
  await assertFails(updateDoc(ref, { amendments: [...current, { ...amendment('alice', 3), text: '' }] }));
  await assertFails(updateDoc(ref, { amendments: [...current, { ...amendment('alice', 3), text: 'x'.repeat(2001) }] }));
  await assertFails(updateDoc(ref, { amendments: [...current, { ...amendment('alice', 3), extra: true }] }));
  // Up to five new ones in one write; six is refused.
  const five = [3, 4, 5, 6, 7].map(n => amendment('alice', n));
  await assertFails(updateDoc(ref, { amendments: [...current, ...five, amendment('alice', 8)] }));
  await assertSucceeds(updateDoc(ref, { amendments: [...current, ...five] }));
  // Someone else cannot amend Alice's case at all.
  await assertFails(updateDoc(doc(doctor('bob'), 'users/alice/cases/case_1'), { amendments: [...current, ...five, amendment('bob', 9)] }));
});

test('a new case may arrive with its amendments, if they are valid', async () => {
  await assertSucceeds(setDoc(doc(doctor('alice'), 'users/alice/cases/case_1'), signedCase('alice', { amendments: [amendment('alice', 1)] })));
  await assertFails(setDoc(doc(doctor('alice'), 'users/alice/cases/case_2'), signedCase('alice', { id: 'case_2', amendments: [amendment('bob', 1)] })));
});

test('a signed case is never deleted by the doctor; the admin can; unsigned drafts can be', async () => {
  await seed('users/alice/cases/case_1', signedCase('alice'));
  await seed('users/alice/cases/old_signed', signedCase('alice', { contentHash: null, id: 'old_signed' }));
  await seed('users/alice/cases/draft', { id: 'draft', userId: 'alice', patientCode: 'D', signatureDataUrl: '' });
  const db = doctor('alice');
  await assertFails(deleteDoc(doc(db, 'users/alice/cases/case_1')));
  await assertFails(deleteDoc(doc(db, 'users/alice/cases/old_signed')));
  await assertSucceeds(deleteDoc(doc(db, 'users/alice/cases/draft')));
  await assertSucceeds(deleteDoc(doc(claimAdmin(), 'users/alice/cases/case_1')));
});

test('older signed cases (signature, no fingerprint) are protected the same way', async () => {
  const { contentHash: _h, ...old } = signedCase('alice');
  await seed('users/alice/cases/case_1', old);
  const ref = doc(doctor('alice'), 'users/alice/cases/case_1');
  await assertFails(updateDoc(ref, { patientCode: 'P-2' }));
  await assertSucceeds(updateDoc(ref, { amendments: [amendment('alice', 1)] }));
});

test('only the admin reads every doctor\'s cases', async () => {
  await seed('users/alice/cases/case_1', signedCase('alice'));
  await seed('users/bob/cases/case_9', signedCase('bob', { id: 'case_9' }));
  await assertSucceeds(getDocs(collectionGroup(claimAdmin(), 'cases')));
  await assertSucceeds(getDocs(collectionGroup(emailAdmin(), 'cases')));
  await assertFails(getDocs(collectionGroup(doctor('alice'), 'cases')));
});

test('the old top-level /cases collection is read-only', async () => {
  await seed('cases/legacy_1', { userId: 'alice', patientCode: 'L' });
  await assertSucceeds(getDoc(doc(doctor('alice'), 'cases/legacy_1')));
  await assertFails(getDoc(doc(doctor('bob'), 'cases/legacy_1')));
  await assertFails(setDoc(doc(doctor('alice'), 'cases/new_1'), { userId: 'alice' }));
  await assertFails(setDoc(doc(claimAdmin(), 'cases/sample_1'), { userId: 'admin-claim', isSample: true }));
  await assertFails(updateDoc(doc(doctor('alice'), 'cases/legacy_1'), { patientCode: 'X' }));
  await assertFails(deleteDoc(doc(doctor('alice'), 'cases/legacy_1')));
  await assertSucceeds(deleteDoc(doc(claimAdmin(), 'cases/legacy_1')));
});

test('connection check document is readable, nothing else in /test', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'test/connection')));
  await assertFails(getDoc(doc(anon(), 'test/other')));
  await assertFails(setDoc(doc(doctor('alice'), 'test/connection'), { x: 1 }));
});
