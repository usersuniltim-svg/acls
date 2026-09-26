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
  getDocFromServer,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { SavedCase, UserProfile } from '../types';

const app = initializeApp(firebaseConfig);

// Using initializeFirestore with settings to help with potential connectivity issues in iframes
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
  // Without this, any field set to `undefined` makes setDoc() throw before
  // it reaches the server - which silently blocked every new doctor profile.
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
  }
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
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates connection to Firestore server
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client is operating offline, local cache enabled.");
    }
    return false;
  }
}

/**
 * Synchronizes user profile to Firestore with guaranteed merging
 */
export async function syncUserProfileToFirestore(userId: string, data: Partial<UserProfile>): Promise<boolean> {
  if (!userId) return false;
  const path = `profiles/${userId}`;
  try {
    const profileRef = doc(db, 'profiles', userId);
    await setDoc(profileRef, {
      ...data,
      updatedAt: Date.now()
    }, { merge: true });

    // Also update secondary user collection for parity
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...data,
      updatedAt: Date.now()
    }, { merge: true }).catch(() => {});

    return true;
  } catch (error) {
    console.error("Failed to sync user profile to Firestore:", error);
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch (e) {}
    return false;
  }
}

/**
 * Synchronizes all saved resuscitation cases to Firestore
 */
export async function syncSavedCasesToFirestore(userId: string, cases: SavedCase[]): Promise<boolean> {
  if (!userId) return false;
  const path = `profiles/${userId}`;
  try {
    const profileRef = doc(db, 'profiles', userId);
    await setDoc(profileRef, {
      savedCases: cases,
      lastCasesSyncAt: Date.now()
    }, { merge: true });

    // Also mirror to global /cases collection for administrative review
    for (const c of cases) {
      try {
        const caseRef = doc(db, 'cases', c.id);
        await setDoc(caseRef, {
          ...c,
          userId: userId,
          syncedAt: Date.now()
        }, { merge: true });
      } catch (err) {
        // non-blocking
      }
    }

    return true;
  } catch (error) {
    console.error("Failed to sync saved cases to Firestore:", error);
    try {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } catch (e) {}
    return false;
  }
}

/**
 * Real-time listener for practitioner profile and cases
 */
export function subscribeToUserProfile(
  userId: string,
  onData: (profile: UserProfile) => void,
  onError?: (error: any) => void
): Unsubscribe {
  const profileRef = doc(db, 'profiles', userId);
  return onSnapshot(profileRef, (snapshot) => {
    if (snapshot.exists()) {
      onData(snapshot.data() as UserProfile);
    }
  }, (err) => {
    console.error("Error subscribing to profile in Firestore:", err);
    if (onError) onError(err);
    try {
      handleFirestoreError(err, OperationType.GET, `profiles/${userId}`);
    } catch (e) {}
  });
}

