import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleFirestoreError, OperationType } from './firebase';

// Better mock approach: spy on the getAuth getter instead, or just overwrite auth
vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>();
  return {
    ...actual,
    getAuth: vi.fn(() => ({
      currentUser: null,
    })),
  };
});

import { auth } from './firebase';

describe('handleFirestoreError', () => {
  beforeEach(() => {
    // Reset the mocked auth.currentUser before each test
    // Using Object.defineProperty since it might be read-only
    Object.defineProperty(auth, 'currentUser', {
      value: null,
      writable: true
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should format an Error object correctly', () => {
    const error = new Error('Test error message');

    expect(() => handleFirestoreError(error, OperationType.GET, 'users/123')).toThrow();

    expect(console.error).toHaveBeenCalledTimes(1);
    const consoleOutput = vi.mocked(console.error).mock.calls[0][1];
    const parsedLog = JSON.parse(consoleOutput);

    expect(parsedLog).toEqual({
      error: 'Test error message',
      authInfo: {
        providerInfo: []
      },
      operationType: OperationType.GET,
      path: 'users/123'
    });
  });

  it('should format a string error correctly', () => {
    const error = 'String error message';

    expect(() => handleFirestoreError(error, OperationType.WRITE, 'posts/456')).toThrow();

    const consoleOutput = vi.mocked(console.error).mock.calls[0][1];
    const parsedLog = JSON.parse(consoleOutput);

    expect(parsedLog).toEqual({
      error: 'String error message',
      authInfo: {
        providerInfo: []
      },
      operationType: OperationType.WRITE,
      path: 'posts/456'
    });
  });

  it('should format an object error correctly by converting to string', () => {
    const error = { code: 'permission-denied', msg: 'Not allowed' };

    expect(() => handleFirestoreError(error, OperationType.UPDATE, null)).toThrow();

    const consoleOutput = vi.mocked(console.error).mock.calls[0][1];
    const parsedLog = JSON.parse(consoleOutput);

    expect(parsedLog).toEqual({
      error: '[object Object]', // String(error)
      authInfo: {
        providerInfo: []
      },
      operationType: OperationType.UPDATE,
      path: null
    });
  });

  it('should include auth info when user is logged in', () => {
    const error = new Error('Auth error');

    // Set up mock user
    Object.defineProperty(auth, 'currentUser', {
      value: {
        uid: 'user123',
        email: 'test@example.com',
        emailVerified: true,
        isAnonymous: false,
        tenantId: 'tenant456',
        providerData: [
          {
            providerId: 'google.com',
            email: 'test@example.com',
            uid: 'google123',
            displayName: null,
            phoneNumber: null,
            photoURL: null
          }
        ]
      },
      writable: true
    });

    expect(() => handleFirestoreError(error, OperationType.DELETE, 'items/789')).toThrow();

    const consoleOutput = vi.mocked(console.error).mock.calls[0][1];
    const parsedLog = JSON.parse(consoleOutput);

    expect(parsedLog.authInfo).toEqual({
      userId: 'user123',
      email: 'test@example.com',
      emailVerified: true,
      isAnonymous: false,
      tenantId: 'tenant456',
      providerInfo: [
        {
          providerId: 'google.com',
          email: 'test@example.com',
        }
      ]
    });
  });
});
