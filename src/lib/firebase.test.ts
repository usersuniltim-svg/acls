// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleFirestoreError, OperationType, auth } from './firebase';

describe('handleFirestoreError', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    Object.defineProperty(auth, 'currentUser', {
      value: null,
      configurable: true,
      writable: true,
    });
  });

  it('formats Error instance and throws Error containing serialized FirestoreErrorInfo', () => {
    const errorInstance = new Error('Permission denied');
    const path = 'profiles/user123';
    const operation = OperationType.GET;

    expect(() => {
      handleFirestoreError(errorInstance, operation, path);
    }).toThrowError();

    try {
      handleFirestoreError(errorInstance, operation, path);
    } catch (err: any) {
      expect(err).toBeInstanceOf(Error);
      const parsed = JSON.parse(err.message);
      expect(parsed).toEqual({
        error: 'Permission denied',
        authInfo: {
          userId: undefined,
          email: undefined,
          emailVerified: undefined,
          isAnonymous: undefined,
          tenantId: undefined,
          providerInfo: [],
        },
        operationType: 'get',
        path: 'profiles/user123',
      });
    }

    expect(consoleSpy).toHaveBeenCalledWith(
      'Firestore Error: ',
      expect.stringContaining('Permission denied')
    );
  });

  it('handles non-Error inputs correctly (strings, numbers, objects, null, undefined)', () => {
    // String error
    expect(() => handleFirestoreError('String error message', OperationType.CREATE, 'cases/1')).toThrow();
    try {
      handleFirestoreError('String error message', OperationType.CREATE, 'cases/1');
    } catch (err: any) {
      const parsed = JSON.parse(err.message);
      expect(parsed.error).toBe('String error message');
      expect(parsed.operationType).toBe('create');
      expect(parsed.path).toBe('cases/1');
    }

    // Number error
    try {
      handleFirestoreError(500, OperationType.DELETE, 'cases/2');
    } catch (err: any) {
      const parsed = JSON.parse(err.message);
      expect(parsed.error).toBe('500');
    }

    // Object error
    try {
      handleFirestoreError({ code: 'unavailable' }, OperationType.UPDATE, 'cases/3');
    } catch (err: any) {
      const parsed = JSON.parse(err.message);
      expect(parsed.error).toBe('[object Object]');
    }

    // null / undefined error
    try {
      handleFirestoreError(null, OperationType.LIST, null);
    } catch (err: any) {
      const parsed = JSON.parse(err.message);
      expect(parsed.error).toBe('null');
      expect(parsed.path).toBeNull();
      expect(parsed.operationType).toBe('list');
    }
  });

  it('captures authInfo details when a user is signed in', () => {
    const mockUser = {
      uid: 'uid-456',
      email: 'doctor@example.com',
      emailVerified: true,
      isAnonymous: false,
      tenantId: 'tenant-789',
      providerData: [
        { providerId: 'google.com', email: 'doctor@example.com' },
        { providerId: 'password', email: 'doctor@example.com' },
      ],
    };

    Object.defineProperty(auth, 'currentUser', {
      value: mockUser,
      configurable: true,
      writable: true,
    });

    try {
      handleFirestoreError(new Error('Quota exceeded'), OperationType.WRITE, 'users/uid-456');
    } catch (err: any) {
      const parsed = JSON.parse(err.message);
      expect(parsed.authInfo).toEqual({
        userId: 'uid-456',
        email: 'doctor@example.com',
        emailVerified: true,
        isAnonymous: false,
        tenantId: 'tenant-789',
        providerInfo: [
          { providerId: 'google.com', email: 'doctor@example.com' },
          { providerId: 'password', email: 'doctor@example.com' },
        ],
      });
    }
  });

  it('handles user signed in with empty or missing providerData', () => {
    const mockUser = {
      uid: 'uid-789',
      email: 'anonymous@example.com',
      emailVerified: false,
      isAnonymous: true,
      tenantId: null,
      providerData: undefined,
    };

    Object.defineProperty(auth, 'currentUser', {
      value: mockUser,
      configurable: true,
      writable: true,
    });

    try {
      handleFirestoreError(new Error('Unauthenticated'), OperationType.GET, 'secret/doc');
    } catch (err: any) {
      const parsed = JSON.parse(err.message);
      expect(parsed.authInfo).toEqual({
        userId: 'uid-789',
        email: 'anonymous@example.com',
        emailVerified: false,
        isAnonymous: true,
        tenantId: null,
        providerInfo: [],
      });
    }
  });
});
