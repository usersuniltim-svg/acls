import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  KeyValueStore,
  pendingKey,
  readPendingCases,
  addPendingCase,
  removePendingCase,
  isPending,
  mergeCaseLists,
  applyServerSnapshot,
  combineAdminCases,
  _resetMemoryQueue,
} from '../src/lib/caseStore';
import type { SavedCase } from '../src/types';

/** localStorage stand-in with an optional size limit. */
class MemStore implements KeyValueStore {
  data = new Map<string, string>();
  quota = Infinity;
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) {
    const used = [...this.data.entries()]
      .filter(([key]) => key !== k)
      .reduce((n, [key, val]) => n + key.length + val.length, 0);
    if (used + k.length + v.length > this.quota) throw new Error('QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) { this.data.delete(k); }
}

const mk = (id: string, savedAt: number, extra: Partial<SavedCase> = {}): SavedCase => ({
  id, savedAt, patientCode: id, totalDuration: 60, cprCycleCount: 1, shocksCount: 0, epiCount: 0,
  logs: [], certifiedBy: 'Dr A', councilRegistration: '123', ...extra,
});

beforeEach(() => _resetMemoryQueue());

test('upload queue: add, read and remove, kept separately per doctor', () => {
  const s = new MemStore();
  assert.equal(addPendingCase('u1', mk('a', 1), s), true);
  assert.equal(addPendingCase('u1', mk('b', 2), s), true);
  assert.equal(addPendingCase('u2', mk('c', 3), s), true);
  assert.deepEqual(readPendingCases('u1', s).map(c => c.id).sort(), ['a', 'b']);
  assert.deepEqual(readPendingCases('u2', s).map(c => c.id), ['c']);

  removePendingCase('u1', 'a', s);
  assert.deepEqual(readPendingCases('u1', s).map(c => c.id), ['b']);
  assert.equal(isPending('u1', 'a', s), false);
  assert.equal(isPending('u1', 'b', s), true);

  removePendingCase('u1', 'b', s);
  assert.equal(s.getItem(pendingKey('u1')), null, 'an empty queue removes its key');
});

test('a case saved offline survives the app being closed and reopened', () => {
  const s = new MemStore();
  addPendingCase('u1', mk('offline_case', 10), s);
  _resetMemoryQueue(); // app closed before the upload finished

  const afterReopen = readPendingCases('u1', s);
  assert.deepEqual(afterReopen.map(c => c.id), ['offline_case']);
  // It is shown even though the server does not have it yet.
  assert.deepEqual(mergeCaseLists([], afterReopen).map(c => c.id), ['offline_case']);
});

test('saving the same case again replaces the queued copy', () => {
  const s = new MemStore();
  addPendingCase('u1', mk('a', 1, { patientCode: 'old' }), s);
  addPendingCase('u1', mk('a', 1, { patientCode: 'new' }), s);
  const queue = readPendingCases('u1', s);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].patientCode, 'new');
});

test('storage full or blocked: reports it, but keeps the case for this session', () => {
  const full = new MemStore();
  full.quota = 10;
  assert.equal(addPendingCase('u1', mk('a', 1), full), false);
  assert.deepEqual(readPendingCases('u1', full).map(c => c.id), ['a']);

  assert.equal(addPendingCase('u2', mk('b', 1), null), false);
  assert.deepEqual(readPendingCases('u2', null).map(c => c.id), ['b']);
});

test('a damaged stored queue is ignored rather than crashing the app', () => {
  const s = new MemStore();
  s.data.set(pendingKey('u1'), '{not json');
  assert.deepEqual(readPendingCases('u1', s), []);
  s.data.set(pendingKey('u1'), JSON.stringify([{ nope: 1 }, mk('a', 1)]));
  assert.deepEqual(readPendingCases('u1', s).map(c => c.id), ['a']);
});

test('merge: server copy wins, both lists kept, newest first', () => {
  const merged = mergeCaseLists(
    [mk('a', 1, { patientCode: 'server' }), mk('b', 5)],
    [mk('a', 1, { patientCode: 'local' }), mk('c', 9)],
  );
  assert.deepEqual(merged.map(c => c.id), ['c', 'b', 'a']);
  assert.equal(merged.find(c => c.id === 'a')!.patientCode, 'server');
});

test('opening the app offline does not blank the last known list', () => {
  const view = applyServerSnapshot({ cases: [mk('a', 1), mk('b', 2)], confirmed: false }, [], true);
  assert.deepEqual(view.cases.map(c => c.id), ['b', 'a']);
  assert.equal(view.confirmed, false);
});

test('once the server has answered, its list replaces the old one (deletions show)', () => {
  let view = applyServerSnapshot({ cases: [mk('a', 1), mk('b', 2)], confirmed: false }, [mk('b', 2)], false);
  assert.equal(view.confirmed, true);
  assert.deepEqual(view.cases.map(c => c.id), ['b']);
  view = applyServerSnapshot(view, [], true); // e.g. deleted while offline
  assert.deepEqual(view.cases, []);
});

test('admin list: one entry per doctor+case, stored copy wins, email filled in', () => {
  const stored = [
    { ...mk('x', 5), doctorUid: 'd1' },
    { ...mk('x', 6), doctorUid: 'd2' }, // same id, different doctor: both kept
    { ...mk('m', 3, { patientCode: 'migrated' }), doctorUid: 'd3' },
  ];
  const legacy = [
    { ...mk('m', 3, { patientCode: 'legacy copy' }), doctorUid: 'd3', doctorEmail: 'd3@x' },
    { ...mk('old', 1), doctorUid: 'd4', doctorEmail: 'd4@x' },
  ];
  const samples = [{ ...mk('sample_1', 9), doctorUid: 'admin' }];
  const emails = new Map([['d1', 'd1@x'], ['d2', 'd2@x'], ['d3', 'd3@x'], ['admin', 'admin@x']]);

  const all = combineAdminCases([stored, legacy, samples], emails);
  assert.deepEqual(all.map(c => `${c.doctorUid}/${c.id}`), ['admin/sample_1', 'd2/x', 'd1/x', 'd3/m', 'd4/old']);
  assert.equal(all.find(c => c.doctorUid === 'd3')!.patientCode, 'migrated');
  assert.equal(all.find(c => c.doctorUid === 'd1')!.doctorEmail, 'd1@x');
});
