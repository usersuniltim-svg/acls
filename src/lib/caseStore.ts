/**
 * Local bookkeeping for saved resuscitation cases.
 *
 * The server copy lives in Firestore at users/{uid}/cases/{caseId}. This module
 * handles the parts that happen on the device:
 *
 *  - A per-user "waiting to upload" queue. A case goes in the moment it is
 *    saved and only leaves once Firestore has confirmed the write. The queue is
 *    kept in localStorage, so a case saved with no signal survives a reload, a
 *    closed tab or a phone restart and is uploaded next time the doctor is
 *    signed in and online.
 *  - Merging the server list with that queue so the doctor always sees both.
 *
 * Everything here is plain data in, data out (storage is injectable), so it can
 * be unit-tested without a browser or Firestore.
 */
import type { SavedCase } from '../types';
import { mergeAmendments } from './caseIntegrity';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PENDING_PREFIX = 'acls_pending_cases_';

export function pendingKey(uid: string): string {
  return `${PENDING_PREFIX}${uid}`;
}

function browserStore(): KeyValueStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // storage can be blocked entirely (some private modes)
  }
}

/**
 * Copies kept in memory as well, so that a case still shows and still uploads
 * during this session even if the device refuses to store it (storage full or
 * blocked).
 */
const memoryQueue = new Map<string, SavedCase[]>();

/** Only for tests. */
export function _resetMemoryQueue(): void {
  memoryQueue.clear();
}

function readStored(uid: string, store: KeyValueStore | null): SavedCase[] {
  if (!store) return [];
  try {
    const raw = store.getItem(pendingKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(c => c && typeof c.id === 'string') : [];
  } catch {
    return [];
  }
}

/** Returns false if the device would not store the queue. */
function writeStored(uid: string, cases: SavedCase[], store: KeyValueStore | null): boolean {
  if (!store) return false;
  try {
    if (cases.length === 0) store.removeItem(pendingKey(uid));
    else store.setItem(pendingKey(uid), JSON.stringify(cases));
    return true;
  } catch {
    return false;
  }
}

function unionById<T extends { id: string }>(first: T[], second: T[]): T[] {
  const map = new Map<string, T>();
  for (const c of first) map.set(c.id, c);
  for (const c of second) if (!map.has(c.id)) map.set(c.id, c);
  return Array.from(map.values());
}

/** Cases saved on this device that Firestore has not confirmed yet. */
export function readPendingCases(uid: string, store: KeyValueStore | null = browserStore()): SavedCase[] {
  if (!uid) return [];
  return unionById(readStored(uid, store), memoryQueue.get(uid) || []);
}

/**
 * Put a case in the upload queue (replacing any queued copy with the same id).
 * Returns false if it could only be kept in memory, i.e. it would be lost if
 * the app were closed before it uploads.
 */
export function addPendingCase(uid: string, caseRecord: SavedCase, store: KeyValueStore | null = browserStore()): boolean {
  if (!uid || !caseRecord?.id) return false;
  const mem = (memoryQueue.get(uid) || []).filter(c => c.id !== caseRecord.id);
  memoryQueue.set(uid, [caseRecord, ...mem]);
  const stored = readStored(uid, store).filter(c => c.id !== caseRecord.id);
  return writeStored(uid, [caseRecord, ...stored], store);
}

/** Take a case out of the queue (it reached the server, or it was deleted). */
export function removePendingCase(uid: string, caseId: string, store: KeyValueStore | null = browserStore()): void {
  if (!uid || !caseId) return;
  const mem = (memoryQueue.get(uid) || []).filter(c => c.id !== caseId);
  if (mem.length) memoryQueue.set(uid, mem);
  else memoryQueue.delete(uid);
  const stored = readStored(uid, store);
  if (stored.some(c => c.id === caseId)) {
    writeStored(uid, stored.filter(c => c.id !== caseId), store);
  }
}

export function isPending(uid: string, caseId: string, store: KeyValueStore | null = browserStore()): boolean {
  return readPendingCases(uid, store).some(c => c.id === caseId);
}

/**
 * Combine two case lists by id. When both have the same case, the copy from
 * `primary` is kept. Newest first.
 */
export function mergeCaseLists<T extends { id: string; savedAt?: number }>(primary: T[], secondary: T[]): T[] {
  return unionById(primary, secondary).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

/**
 * The list the doctor sees: the server's cases plus everything waiting to
 * upload. A server case with amendments still waiting to upload shows them
 * already (the signed content shown is always the server's).
 */
export function visibleCaseList(serverCases: SavedCase[], pending: SavedCase[]): SavedCase[] {
  const pendingById = new Map(pending.map(c => [c.id, c] as const));
  const serverIds = new Set(serverCases.map(c => c.id));
  const fromServer = serverCases.map(c => {
    const local = pendingById.get(c.id);
    if (!local) return c;
    const amendments = mergeAmendments(c.amendments, local.amendments);
    return { ...c, ...(amendments.length ? { amendments } : {}), syncPending: true };
  });
  const onlyLocal = pending.filter(c => !serverIds.has(c.id)).map(c => ({ ...c, syncPending: true }));
  return mergeCaseLists(fromServer, onlyLocal);
}

/** A case as the admin panel sees it: tagged with the doctor who saved it. */
export type AdminCase = SavedCase & { doctorUid?: string; doctorEmail?: string };

/**
 * One list of every case the admin can see, newest first. The same case can
 * arrive from more than one source (a copy still in an old profile array, or a
 * sample shown before Firestore confirms it); the first source listed wins.
 * Keyed by doctor + case id, so two doctors' cases never merge.
 */
export function combineAdminCases(sources: AdminCase[][], emailByUid: Map<string, string>): AdminCase[] {
  const map = new Map<string, AdminCase>();
  for (const list of sources) {
    for (const c of list) {
      const key = `${c.doctorUid || ''}/${c.id}`;
      if (!map.has(key)) map.set(key, c);
    }
  }
  return Array.from(map.values())
    .map(c => ({ ...c, doctorEmail: c.doctorEmail || (c.doctorUid ? emailByUid.get(c.doctorUid) : '') || '' }))
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

export interface ServerView {
  /** Best current picture of what is on the server. */
  cases: SavedCase[];
  /** True once a snapshot has come from the server itself this session. */
  confirmed: boolean;
}

/**
 * Update the picture of the server list from a Firestore snapshot.
 *
 * If the app starts with no signal, Firestore's first snapshot comes from its
 * (empty) in-memory cache. Treating that as "the doctor has no cases" would
 * blank the list, so until the server has answered once, cache-only snapshots
 * are added to the last known list instead of replacing it. After that, every
 * snapshot is a complete picture and replaces it, so deletions show up.
 */
export function applyServerSnapshot(prev: ServerView, snapshotCases: SavedCase[], fromCache: boolean): ServerView {
  if (fromCache && !prev.confirmed) {
    return { cases: mergeCaseLists(snapshotCases, prev.cases), confirmed: false };
  }
  return { cases: mergeCaseLists(snapshotCases, []), confirmed: true };
}
