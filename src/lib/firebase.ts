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
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { SavedCase, UserProfile } from '../types';

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
    await setDoc(doc(db, 'profiles', userId), { ...profileData, updatedAt: Date.now() }, { merge: true });
    await setDoc(doc(db, 'users', userId), { ...profileData, updatedAt: Date.now() }, { merge: true }).catch(() => {});
    return true;
  } catch (error) {
    console.error('Failed to sync user profile to Firestore:', error);
    try { handleFirestoreError(error, OperationType.WRITE, path); } catch (e) {}
    return false;
  }
}

/** Write exactly one canonical case. */
export async function saveUserCaseToFirestore(userId: string, caseRecord: SavedCase): Promise<boolean> {
  if (!userId || !caseRecord?.id) return false;
  const path = `users/${userId}/cases/${caseRecord.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'cases', caseRecord.id), {
      ...caseRecord,
      userId,
      updatedAt: Date.now(),
      storageVersion: 2,
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Failed to save case to Firestore:', error);
    try { handleFirestoreError(error, OperationType.WRITE, path); } catch (e) {}
    return false;
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

/** Legacy bulk synchronizer retained for migration/backward compatibility. */
export async function syncSavedCasesToFirestore(userId: string, cases: SavedCase[]): Promise<boolean> {
  if (!userId) return false;
  try {
    for (const c of cases) {
      const ok = await saveUserCaseToFirestore(userId, c);
      if (!ok) return false;
    }
    await setDoc(doc(db, 'profiles', userId), { lastCasesSyncAt: Date.now(), caseStorageVersion: 2 }, { merge: true });
    return true;
  } catch (error) {
    console.error('Failed to sync saved cases to Firestore:', error);
    try { handleFirestoreError(error, OperationType.WRITE, `users/${userId}/cases`); } catch (e) {}
    return false;
  }
}

export async function migrateLegacySavedCasesToFirestore(userId: string, legacyCases?: SavedCase[]): Promise<boolean> {
  if (!userId || !Array.isArray(legacyCases) || legacyCases.length === 0) return true;
  try {
    for (const c of legacyCases) {
      const ok = await saveUserCaseToFirestore(userId, c);
      if (!ok) return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to migrate legacy saved cases:', error);
    return false;
  }
}

export function subscribeToUserCases(userId: string, onData: (cases: SavedCase[]) => void, onError?: (error: any) => void): Unsubscribe {
  const casesRef = collection(db, 'users', userId, 'cases');
  return onSnapshot(casesRef, (snapshot) => {
    const cases = snapshot.docs
      .map(snapshotDoc => snapshotDoc.data() as SavedCase)
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    onData(cases);
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
