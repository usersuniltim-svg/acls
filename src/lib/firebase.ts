import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import {
  initializeFirestore,
  doc,
  setDoc,
  onSnapshot,
  collection,
  deleteDoc,
  getDocFromServer,
  runTransaction,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { SavedCase, UserProfile } from '../types';
import { MAX_NEW_AMENDMENTS_PER_WRITE, isSigned, mergeAmendments } from './caseIntegrity';

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
  ignoreUndefinedProperties: true,
}, (firebaseConfig as any).firestoreDatabaseId && (firebaseConfig as any).firestoreDatabaseId !== '(default)'
  ? (firebaseConfig as any).firestoreDatabaseId
  : undefined);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: { providerId?: string | null; email?: string | null }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({ providerId: provider.providerId, email: provider.email })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is operating offline, local cache enabled.');
    }
    return false;
  }
}

export async function syncUserProfileToFirestore(userId: string, data: Partial<UserProfile>): Promise<boolean> {
  if (!userId) return false;
  const path = `profiles/${userId}`;
  try {
    const profileData = { ...data } as Record<string, unknown>;
    delete profileData.savedCases;
    // Verification status and admin rights are never sent from here: a stale
    // copy on this device must not overwrite (or undo) an admin's decision.
    delete profileData.kyc;
    delete profileData.isAdmin;
    await setDoc(doc(db, 'profiles', userId), { ...profileData, updatedAt: Date.now() }, { merge: true });
    await setDoc(doc(db, 'users', userId), { ...profileData, updatedAt: Date.now() }, { merge: true }).catch(() => {});
    return true;
  } catch (error) {
    console.error('Failed to sync user profile to Firestore:', error);
    try { handleFirestoreError(error, OperationType.WRITE, path); } catch (e) {}
    return false;
  }
}

export type UploadResult = 'ok' | 'failed' | 'refused';

/**
 * Upload one case from the device queue, safely for signed records:
 *  - not on the server yet: create it as signed;
 *  - already there and signed: the server copy is final; only amendments this
 *    device added are appended (a retry after a lost reply changes nothing);
 *  - already there, older unsigned record: merged as before.
 * 'refused' means the server rejected it (rules); trying again will not help.
 */
export async function uploadUserCase(userId: string, caseRecord: SavedCase): Promise<UploadResult> {
  if (!userId || !caseRecord?.id) return 'refused';
  const ref = doc(db, 'users', userId, 'cases', caseRecord.id);
  const { syncPending: _pending, syncRefused: _refused, ...record } = caseRecord;
  try {
    let more = true;
    while (more) {
      more = false;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) {
          // A brand-new case. Amendments made before the first upload go in with it,
          // up to the number the rules accept in one write; the rest follow.
          const amendments = record.amendments ?? [];
          const first = amendments.slice(0, MAX_NEW_AMENDMENTS_PER_WRITE);
          more = amendments.length > first.length;
          tx.set(ref, {
            ...record,
            ...(record.amendments ? { amendments: first } : {}),
            userId,
            updatedAt: Date.now(),
            storageVersion: 2,
          });
          return;
        }
        const server = snap.data() as SavedCase;
        if (isSigned(server)) {
          const before = server.amendments ?? [];
          const merged = mergeAmendments(before, record.amendments);
          const next = merged.slice(0, before.length + MAX_NEW_AMENDMENTS_PER_WRITE);
          more = merged.length > next.length;
          if (next.length > before.length) tx.update(ref, { amendments: next, updatedAt: Date.now() });
          return;
        }
        tx.set(ref, { ...record, userId, updatedAt: Date.now(), storageVersion: 2 }, { merge: true });
      });
    }
    return 'ok';
  } catch (error) {
    const code = (error as { code?: string })?.code ?? '';
    console.error('Failed to upload case:', error);
    try { handleFirestoreError(error, OperationType.WRITE, `users/${userId}/cases/${caseRecord.id}`); } catch (e) {}
    return code === 'permission-denied' || code === 'invalid-argument' ? 'refused' : 'failed';
  }
}

/** Delete exactly one canonical case. */
export async function deleteUserCaseFromFirestore(userId: string, caseId: string): Promise<boolean> {
  if (!userId || !caseId) return false;
  const path = `users/${userId}/cases/${caseId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'cases', caseId));
    return true;
  } catch (error) {
    console.error('Failed to delete case from Firestore:', error);
    try { handleFirestoreError(error, OperationType.DELETE, path); } catch (e) {}
    return false;
  }
}

export function subscribeToUserCases(
  userId: string,
  onData: (cases: SavedCase[], meta: { fromCache: boolean }) => void,
  onError?: (error: any) => void,
): Unsubscribe {
  const casesRef = collection(db, 'users', userId, 'cases');
  // includeMetadataChanges: also tell us when the server confirms the list,
  // even if no case changed, so an offline start can be told apart from
  // "this doctor has no cases".
  return onSnapshot(casesRef, { includeMetadataChanges: true }, (snapshot) => {
    const cases = snapshot.docs
      .map(snapshotDoc => ({ ...(snapshotDoc.data() as SavedCase), id: snapshotDoc.id }))
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    onData(cases, { fromCache: snapshot.metadata.fromCache });
  }, (err) => {
    console.error('Error subscribing to user cases in Firestore:', err);
    if (onError) onError(err);
    try { handleFirestoreError(err, OperationType.LIST, `users/${userId}/cases`); } catch (e) {}
  });
}

export function subscribeToUserProfile(userId: string, onData: (profile: UserProfile) => void, onError?: (error: any) => void): Unsubscribe {
  const profileRef = doc(db, 'profiles', userId);
  return onSnapshot(profileRef, (snapshot) => {
    if (snapshot.exists()) onData(snapshot.data() as UserProfile);
  }, (err) => {
    console.error('Error subscribing to profile in Firestore:', err);
    if (onError) onError(err);
    try { handleFirestoreError(err, OperationType.GET, `profiles/${userId}`); } catch (e) {}
  });
}
