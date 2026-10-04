/**
 * Server-side identity for the AI endpoints.
 *
 * The browser sends its Firebase ID token as `Authorization: Bearer <token>`.
 * The server does not trust anything else the browser says about who it is:
 *
 *  1. The token's signature is checked against Google's published Firebase
 *     keys, and its issuer / audience must match this Firebase project.
 *  2. Admin: a Firebase custom claim `admin: true`, or (until that claim is
 *     set) the single admin email with a verified address.
 *  3. Verified doctor: the KYC status is read from Firestore with the
 *     user's own token (Firestore REST API, so the security rules apply and
 *     the server needs no service-account key).
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export const ADMIN_EMAIL = 'user.suniltim@gmail.com';
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

export class AuthError extends Error {
  constructor(public status: 401 | 403 | 503, message: string) {
    super(message);
  }
}

export interface VerifiedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  claims: Record<string, unknown>;
  idToken: string;
}

let remoteKeys: JWTVerifyGetKey | null = null;
export function firebasePublicKeys(): JWTVerifyGetKey {
  if (!remoteKeys) remoteKeys = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
  return remoteKeys;
}

/** Verify a Firebase ID token for this project. Throws AuthError(401) if it is not valid. */
export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string,
  keys: JWTVerifyGetKey = firebasePublicKeys(),
  currentDate?: Date,
): Promise<VerifiedUser> {
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(idToken, keys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
      ...(currentDate ? { currentDate } : {}),
    }));
  } catch {
    throw new AuthError(401, 'Your sign-in could not be verified. Please sign in again.');
  }
  const now = Math.floor((currentDate ?? new Date()).getTime() / 1000);
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new AuthError(401, 'Your sign-in could not be verified. Please sign in again.');
  }
  if (typeof payload.auth_time === 'number' && payload.auth_time > now + 300) {
    throw new AuthError(401, 'Your sign-in could not be verified. Please sign in again.');
  }
  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    emailVerified: payload.email_verified === true,
    claims: payload,
    idToken,
  };
}

/** Admin by custom claim, or (transitional) the one admin email with a verified address. */
export function isAdminUser(user: VerifiedUser): boolean {
  if (user.claims.admin === true) return true;
  return user.emailVerified && (user.email ?? '').trim().toLowerCase() === ADMIN_EMAIL;
}

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
}>;

/**
 * The user's KYC status from profiles/{uid}, read with their own ID token so
 * Firestore security rules decide what the server may see. null = no profile.
 */
export async function fetchKycStatus(
  user: VerifiedUser,
  opts: { projectId: string; databaseId?: string; fetchImpl?: FetchLike },
): Promise<string | null> {
  const db = encodeURIComponent(opts.databaseId || '(default)');
  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(opts.projectId)}` +
    `/databases/${db}/documents/profiles/${encodeURIComponent(user.uid)}?mask.fieldPaths=kyc`;
  const doFetch = opts.fetchImpl ?? (fetch as unknown as FetchLike);
  const res = await doFetch(url, { headers: { Authorization: `Bearer ${user.idToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new AuthError(503, 'Could not check your verification status. Please try again.');
  const doc = await res.json();
  const status = doc?.fields?.kyc?.mapValue?.fields?.kycStatus?.stringValue;
  return typeof status === 'string' ? status : null;
}

export interface AuthDeps {
  verifyToken: (idToken: string) => Promise<VerifiedUser>;
  getKycStatus: (user: VerifiedUser) => Promise<string | null>;
}

/** Wrap getKycStatus with a short per-user cache (approval changes are rare). */
export function cachedKycStatus(
  getKycStatus: AuthDeps['getKycStatus'],
  ttlMs = 5 * 60 * 1000,
  now: () => number = Date.now,
): AuthDeps['getKycStatus'] {
  const cache = new Map<string, { status: string | null; until: number }>();
  return async (user) => {
    const hit = cache.get(user.uid);
    if (hit && hit.until > now()) return hit.status;
    const status = await getKycStatus(user);
    // Only cache an approval briefly; a missing or pending status is re-checked next time.
    if (status === 'approved') cache.set(user.uid, { status, until: now() + ttlMs });
    return status;
  };
}

export interface ClinicianAccess {
  user: VerifiedUser;
  isAdmin: boolean;
}

/**
 * Who may use the AI copilot: the admin, or a doctor whose KYC was approved.
 * Throws AuthError(401) without a valid token, AuthError(403) otherwise.
 */
export async function authorizeClinician(authorizationHeader: string | undefined, deps: AuthDeps): Promise<ClinicianAccess> {
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader ?? '');
  if (!match) throw new AuthError(401, 'Please sign in to use the AI copilot.');
  const user = await deps.verifyToken(match[1].trim());
  if (isAdminUser(user)) return { user, isAdmin: true };
  const status = await deps.getKycStatus(user);
  if (status !== 'approved') {
    throw new AuthError(403, 'The AI copilot is available to verified doctors. Complete KYC and wait for approval.');
  }
  return { user, isAdmin: false };
}
