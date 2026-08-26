// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase auth module before importing firebase
vi.mock('firebase/auth', () => {
  const mockAuth = { currentUser: null };
  return {
    getAuth: vi.fn(() => mockAuth),
    GoogleAuthProvider: vi.fn().mockImplementation(function (this: { providerId: string }) {
      this.providerId = 'google.com';
    }),
    signInWithPopup: vi.fn(),
  };
});

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/firestore', () => ({
  initializeFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
  collection: vi.fn(),
  getDocFromServer: vi.fn(),
}));

import { signInWithGoogle, auth, googleProvider } from './firebase';
import { signInWithPopup } from 'firebase/auth';

describe('signInWithGoogle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call signInWithPopup with auth and googleProvider', async () => {
    const mockUserCredential = {
      user: {
        uid: 'test-user-123',
        email: 'doctor@hospital.org',
        displayName: 'Dr. Test',
      },
    };
    vi.mocked(signInWithPopup).mockResolvedValueOnce(mockUserCredential as any);

    const result = await signInWithGoogle();

    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    expect(signInWithPopup).toHaveBeenCalledWith(auth, googleProvider);
    expect(result).toEqual(mockUserCredential);
  });

  it('should reject when signInWithPopup fails', async () => {
    const mockError = new Error('Auth popup closed by user');
    vi.mocked(signInWithPopup).mockRejectedValueOnce(mockError);

    await expect(signInWithGoogle()).rejects.toThrow('Auth popup closed by user');
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    expect(signInWithPopup).toHaveBeenCalledWith(auth, googleProvider);
  });
});
