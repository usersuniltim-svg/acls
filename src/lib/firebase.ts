import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import {
  initializeFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  getDocs,
  deleteDoc,
  getDocFromServer,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { SavedCase, UserProfile } from '../types';

const app = initializeApp(firebaseConfig);

// Using initializeFirestore with settings to help with potential connectivity issues in iframes.
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
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
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
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/** Validates connection to Firestore server. */
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

/**
 * Synchronizes a practitioner profile only.
 * Saved cases deliberately do not live on the profile document anymore.
 */
export async function syncUserProfileToFirestore(userId: string, data: Partial<UserProfile>): Promise<boolean> {
  if (!userId) return false;
  const path = `profiles/${userId}`;
  try {
    const profileRef = doc(db, 'profiles', userId);
    const profileData = { ...data } as Record<string, unknown>;
    // Prevent legacy/accidental writes of the entire case collection into the profile document.
    delete profileData.savedCases;

    await setDoc(profileRef, {
      ...profileData,
      updatedAt: Date.now(),
    }, { merge: true });

    // Keep the secondary user profile mirror for compatibility, but never copy cases into it.
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...profileData,
      updatedAt: Date.now(),
    }, { merge: true }).catch(() => {});

    return true;
  } catch (error) {
    console.error('Failed to sync user profile to Firestore:', error);
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch (e) {}
    return false;
  }
}

/**
 * Saves the complete local case list into the authenticated user's private
 * subcollection: users/{uid}/cases/{caseId}.
 *
 * This replaces the old design where every case was duplicated inside
 * profiles/{uid}.savedCases and mirrored into a global /cases collection.
 */
export async function syncSavedCasesToFirestore(userId: string, cases: SavedCase[]): Promise<boolean> {
  if (!userId) return false;
  const basePath = `users/${userId}/cases`;

  try {
    const casesCollection = collection(db, 'users', userId, 'cases');
    const existingSnapshot = await getDocs(casesCollection);
    const nextIds = new Set(cases.map(c => c.id));

    // Remove records deleted locally so cloud state matches the local case list.
    for (const existingDoc of existingSnapshot.docs) {
      if (!nextIds.has(existingDoc.id)) {
        await deleteDoc(existingDoc.ref);
      }
    }

    // Upsert every current case independently. Firestore's local persistence
    // keeps these writes available when the device temporarily loses network.
    for (const c of cases) {
      await setDoc(doc(db, 'users', userId, 'cases', c.id), {
        ...c,
        userId,
        updatedAt: Date.now(),
      }, { merge: true });
    }

    return true;
  } catch (error) {
    console.error('Failed to sync saved cases to Firestore:', error);
    try {
      handleFirestoreError(error, OperationType.WRITE, basePath);
    } catch (e) {}
    return false;
  }
}

/**
 * Migrates the legacy profile.savedCases array into the new per-user case
 * collection. Existing IDs are preserved so PDFs/bookmarks remain stable.
 */
export async function migrateLegacySavedCasesToFirestore(userId: string, legacyCases?: SavedCase[]): Promise<boolean> {
  if (!userId || !Array.isArray(legacyCases) || legacyCases.length === 0) return true;

  try {
    for (const c of legacyCases) {
      await setDoc(doc(db, 'users', userId, 'cases', c.id), {
        ...c,
        userId,
        migratedFromProfileAt: Date.now(),
        updatedAt: Date.now(),
      }, { merge: true });
    }
    return true;
  } catch (error) {
    console.error('Failed to migrate legacy saved cases:', error);
    return false;
  }
}

/**
 * Real-time listener for a practitioner's private case collection.
 * Case records are no longer coupled to the profile document.
 */
export function subscribeToUserCases(
  userId: string,
  onData: (cases: SavedCase[]) => void,
  onError?: (error: any) => void,
): Unsubscribe {
  const casesRef = collection(db, 'users', userId, 'cases');

  return onSnapshot(casesRef, (snapshot) => {
    const cases = snapshot.docs
      .map(snapshotDoc => snapshotDoc.data() as SavedCase)
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

    onData(cases);
  }, (err) => {
    console.error('Error subscribing to user cases in Firestore:', err);
    if (onError) onError(err);
    try {
      handleFirestoreError(err, OperationType.LIST, `users/${userId}/cases`);
    } catch (e) {}
  });
}

/** Real-time listener for practitioner profile. */
export function subscribeToUserProfile(
  userId: string,
  onData: (profile: UserProfile) => void,
  onError?: (error: any) => void,
): Unsubscribe {
  const profileRef = doc(db, 'profiles', userId);
  return onSnapshot(profileRef, (snapshot) => {
    if (snapshot.exists()) {
      onData(snapshot.data() as UserProfile);
    }
  }, (err) => {
    console.error('Error subscribing to profile in Firestore:', err);
    if (onError) onError(err);
    try {
      handleFirestoreError(err, OperationType.GET, `profiles/${userId}`);
    } catch (e) {}
  });
}
