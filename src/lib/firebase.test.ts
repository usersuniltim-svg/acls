// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleFirestoreError, OperationType, auth } from './firebase';

describe('handleFirestoreError', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats Error instance correctly and throws Error with JSON stringified info', () => {
    const originalError = new Error('Permission denied');

    expect(() => {
      handleFirestoreError(originalError, OperationType.GET, 'users/123');
    }).toThrow();

    try {
      handleFirestoreError(originalError, OperationType.GET, 'users/123');
    } catch (err: any) {
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
        operationType: OperationType.GET,
        path: 'users/123',
      });
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Firestore Error: ',
      expect.any(String)
    );
  });

  it('handles non-Error objects (e.g. string or object) correctly', () => {
    const stringError = 'String error message';

    try {
      handleFirestoreError(stringError, OperationType.CREATE, null);
    } catch (err: any) {
      const parsed = JSON.parse(err.message);
      expect(parsed.error).toBe('String error message');
      expect(parsed.path).toBeNull();
      expect(parsed.operationType).toBe(OperationType.CREATE);
    }

    const objectError = { code: 'resource-exhausted', details: 'Quota exceeded' };
    try {
      handleFirestoreError(objectError, OperationType.DELETE, 'cases/abc');
    } catch (err: any) {
      const parsed = JSON.parse(err.message);
      expect(parsed.error).toBe('[object Object]');
      expect(parsed.operationType).toBe(OperationType.DELETE);
      expect(parsed.path).toBe('cases/abc');
    }
  });

  it('includes auth info when user is authenticated', () => {
    const mockCurrentUser = {
      uid: 'user_123',
      email: 'doctor@example.com',
      emailVerified: true,
      isAnonymous: false,
      tenantId: 'tenant_456',
      providerData: [
        { providerId: 'google.com', email: 'doctor@example.com' },
      ],
    };

    vi.spyOn(auth, 'currentUser', 'get').mockReturnValue(mockCurrentUser as any);

    const testError = new Error('Network error');

    try {
      handleFirestoreError(testError, OperationType.UPDATE, 'profiles/user_123');
    } catch (err: any) {
      const parsed = JSON.parse(err.message);
      expect(parsed.authInfo).toEqual({
        userId: 'user_123',
        email: 'doctor@example.com',
        emailVerified: true,
        isAnonymous: false,
        tenantId: 'tenant_456',
        providerInfo: [
          { providerId: 'google.com', email: 'doctor@example.com' },
        ],
      });
      expect(parsed.operationType).toBe(OperationType.UPDATE);
      expect(parsed.path).toBe('profiles/user_123');
    }
  });

  it('handles auth user with missing providerData gracefully', () => {
    const mockCurrentUser = {
      uid: 'user_456',
      email: null,
      emailVerified: false,
      isAnonymous: true,
      tenantId: null,
      providerData: null,
    };

    vi.spyOn(auth, 'currentUser', 'get').mockReturnValue(mockCurrentUser as any);

    try {
      handleFirestoreError('Auth error', OperationType.LIST, 'cases');
    } catch (err: any) {
      const parsed = JSON.parse(err.message);
      expect(parsed.authInfo.providerInfo).toEqual([]);
      expect(parsed.authInfo.userId).toBe('user_456');
    }
  });
});
