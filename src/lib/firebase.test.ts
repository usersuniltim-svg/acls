// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { handleFirestoreError, OperationType } from './firebase';

// Mock firebase/auth
vi.mock('firebase/auth', () => {
  return {
    getAuth: vi.fn(() => ({
      currentUser: {
        uid: 'test-user-id',
        email: 'test@example.com',
        emailVerified: true,
        isAnonymous: false,
        tenantId: 'test-tenant-id',
        providerData: [
          { providerId: 'google.com', email: 'test@example.com' }
        ]
      }
    })),
    GoogleAuthProvider: vi.fn(),
    signInWithPopup: vi.fn()
  };
});

// Mock firebase/firestore
vi.mock('firebase/firestore', () => {
  return {
    initializeFirestore: vi.fn(),
    doc: vi.fn(),
    getDocFromCache: vi.fn(),
    getDocFromServer: vi.fn()
  };
});

describe('handleFirestoreError', () => {
  it('correctly handles non-Error string values', () => {
    const rawStringError = 'A custom string database error occurred';

    expect(() => {
      handleFirestoreError(rawStringError, OperationType.GET, 'test-path');
    }).toThrow();

    try {
      handleFirestoreError(rawStringError, OperationType.GET, 'test-path');
    } catch (e: any) {
      const errInfo = JSON.parse(e.message);
      expect(errInfo.error).toBe(rawStringError);
      expect(errInfo.operationType).toBe(OperationType.GET);
      expect(errInfo.path).toBe('test-path');
      expect(errInfo.authInfo.userId).toBe('test-user-id');
      expect(errInfo.authInfo.email).toBe('test@example.com');
    }
  });

  it('correctly handles non-Error objects like dictionary records', () => {
    const customObjError = { code: 'permission-denied', description: 'Access is restricted' };

    expect(() => {
      handleFirestoreError(customObjError, OperationType.UPDATE, 'users/123');
    }).toThrow();

    try {
      handleFirestoreError(customObjError, OperationType.UPDATE, 'users/123');
    } catch (e: any) {
      const errInfo = JSON.parse(e.message);
      // String(customObjError) evaluates to '[object Object]'
      expect(errInfo.error).toBe(String(customObjError));
      expect(errInfo.operationType).toBe(OperationType.UPDATE);
      expect(errInfo.path).toBe('users/123');
    }
  });

  it('correctly handles standard Error instances', () => {
    const standardError = new Error('Database connection failed');

    expect(() => {
      handleFirestoreError(standardError, OperationType.CREATE, null);
    }).toThrow();

    try {
      handleFirestoreError(standardError, OperationType.CREATE, null);
    } catch (e: any) {
      const errInfo = JSON.parse(e.message);
      expect(errInfo.error).toBe('Database connection failed');
      expect(errInfo.operationType).toBe(OperationType.CREATE);
      expect(errInfo.path).toBeNull();
    }
  });
});
