/**
 * Signed cases: fingerprint, verification and amendments.
 *
 * When a clinician signs a case, its clinical content is fingerprinted with
 * SHA-256. The content never changes after that (Firestore rules refuse it);
 * later notes and voiding are appended as amendments, each with who and when.
 * Anyone holding the record can recompute the fingerprint and see whether the
 * signed content is still exactly what was signed.
 */
import type { CaseAmendment, SavedCase } from '../types';
import { sha256Hex } from './sha256';

/** The fields covered by the signature. Derived values (metrics) and storage metadata are not. */
const SIGNED_FIELDS = [
  'id',
  'patientCode',
  'savedAt',
  'signedAt',
  'signedByUid',
  'userId',
  'certifiedBy',
  'councilRegistration',
  'signatureDataUrl',
  'totalDuration',
  'cprCycleCount',
  'shocksCount',
  'epiCount',
  'logs',
  'clinicalEvents',
] as const;

/** Fields that may change after signing. Everything else is fixed. */
export const MUTABLE_AFTER_SIGNING = ['updatedAt', 'storageVersion', 'amendments'] as const;

export const MAX_AMENDMENT_LENGTH = 2000;
/** Most amendments one upload may add (the Firestore rules check this many). */
export const MAX_NEW_AMENDMENTS_PER_WRITE = 5;

/**
 * JSON with object keys sorted and undefined values left out, so the same
 * content always gives the same text, whatever order a database returns the
 * keys in (Firestore does not keep key order, and drops undefined values).
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(v => (v === undefined ? 'null' : canonicalJson(v))).join(',')}]`;
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .filter(k => (value as Record<string, unknown>)[k] !== undefined)
    .sort()
    .map(k => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(',')}}`;
}

export function signedContent(c: SavedCase): Record<string, unknown> {
  const content: Record<string, unknown> = {};
  for (const field of SIGNED_FIELDS) {
    if (c[field] !== undefined) content[field] = c[field];
  }
  return content;
}

export function computeCaseHash(c: SavedCase): string {
  return sha256Hex(canonicalJson(signedContent(c)));
}

/** Sign and fingerprint a case at the moment it is saved. */
export function sealCase(c: SavedCase, signer: { uid?: string }, signedAt: number = c.savedAt): SavedCase {
  const sealed: SavedCase = {
    ...c,
    signedAt,
    ...(signer.uid ? { signedByUid: signer.uid } : {}),
    hashAlgorithm: 'SHA-256',
  };
  delete sealed.contentHash;
  return { ...sealed, contentHash: computeCaseHash(sealed) };
}

export type CaseIntegrity = 'VERIFIED' | 'ALTERED' | 'UNSEALED';

/** Is the signed content still exactly what was signed? Cases saved before fingerprinting are UNSEALED. */
export function verifyCase(c: SavedCase): CaseIntegrity {
  if (!c.contentHash) return 'UNSEALED';
  return computeCaseHash(c) === c.contentHash ? 'VERIFIED' : 'ALTERED';
}

/** A signed case cannot be edited or deleted, only amended. Older signed cases count too. */
export function isSigned(c: Pick<SavedCase, 'contentHash' | 'signatureDataUrl'>): boolean {
  return Boolean(c.contentHash) || Boolean(c.signatureDataUrl);
}

export function voidAmendment(c: SavedCase): CaseAmendment | undefined {
  return (c.amendments ?? []).find(a => a.kind === 'VOID');
}

export const isVoided = (c: SavedCase) => voidAmendment(c) !== undefined;

let amendmentCounter = 0;

export function makeAmendment(
  kind: CaseAmendment['kind'],
  text: string,
  author: { uid?: string; name?: string },
  at: number = Date.now(),
): CaseAmendment {
  const clean = text.trim().slice(0, MAX_AMENDMENT_LENGTH);
  return {
    id: `am_${at.toString(36)}_${(amendmentCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at,
    by: author.uid ?? '',
    ...(author.name ? { byName: author.name } : {}),
    kind,
    text: clean,
  };
}

/** Why an amendment cannot be added, or null if it can. */
export function amendmentProblem(c: SavedCase, kind: CaseAmendment['kind'], text: string): string | null {
  const clean = text.trim();
  if (!clean) return kind === 'VOID' ? 'Give the reason for voiding this case.' : 'Write the addendum first.';
  if (kind === 'VOID' && clean.length < 5) return 'Give the reason for voiding this case (at least 5 characters).';
  if (clean.length > MAX_AMENDMENT_LENGTH) return `Keep it under ${MAX_AMENDMENT_LENGTH} characters.`;
  if (isVoided(c)) return 'This case has already been voided.';
  return null;
}

/** Append an amendment; the signed content is untouched. */
export function amendCase(c: SavedCase, amendment: CaseAmendment): SavedCase {
  return { ...c, amendments: [...(c.amendments ?? []), amendment] };
}

/**
 * Amendments to write: everything the server already has, in its order, then
 * the ones only this device has (oldest first). Nothing the server has is
 * ever dropped or reordered, so the write is a pure append.
 */
export function mergeAmendments(server: CaseAmendment[] | undefined, local: CaseAmendment[] | undefined): CaseAmendment[] {
  const have = new Set((server ?? []).map(a => a.id));
  const added = (local ?? []).filter(a => !have.has(a.id)).sort((a, b) => a.at - b.at);
  return [...(server ?? []), ...added];
}

/** First 16 hex characters, grouped, for display. */
export const shortFingerprint = (hash: string) => hash.slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ');
